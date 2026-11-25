/**
 * Discrete-Event Simulation Engine
 * Deterministic priority-queue event-driven kernel with:
 * - Seeded Mulberry32 PRNG (zero Math.random / Date.now / setTimeout)
 * - Fixed-step mobility & dynamic link connectivity sync
 * - Full packet lifecycle: Created -> Queued -> Transmitting -> Received -> Forwarded -> Delivered/Dropped
 * - Genuine protocol state & control overhead tracking (AODV, OLSR, HWMP, RPL)
 * - Real gateway queuing, interface binding, translation, and failover
 * - Lossless JSON export/import and deterministic replay
 */

import {
  DomainTelemetryStat,
  FaultState,
  FrequencyBand,
  MeshNode,
  NetworkInterface,
  NetworkLink,
  NodeTelemetryStat,
  Packet,
  PacketTimelineEntry,
  ProtocolType,
  SerializedFaultState,
  SimulationConfig,
  SimulationEvent,
  SimulationEventType,
  SubMeshDomain,
  TelemetryMetrics,
  TopologyExportJSON,
  WorkloadHistoryEntry,
  isPacketTerminalState,
} from '../../types/simulator';
import { SeededPRNG } from '../math/prng';
import {
  computeCoChannelInterferenceDbm,
  computeCsmaCollisionProbability,
  evaluatePhysicalLink,
  frequencyBandToGhz,
  resolveLinkChannelContext,
} from '../math/rfPropagation';
import {
  calculateMultiMeshRoute,
  invalidateAodvRoutes,
  syncProtocolControlPlanes,
} from '../protocols/routing';
import {
  HeaderTranslationTrace,
  calculateGatewayDelay,
  gatewayHasActiveInterfaceForSubmesh,
  resolveActiveInterfaceForSubmesh,
  translatePacketHeader,
} from '../protocols/gateway';
import {
  updateDynamicMobilityLinks,
  updateMobileNodesDetailed,
} from './mobility';
import {
  TopologyValidationResult,
  isValidChannelForBand,
  validateLinkConnection,
  validatePacketInjection,
  validateTopology,
} from '../validation/topologyValidation';

export interface VisualParticle {
  packetId: string;
  sourceNodeId: string;
  targetNodeId: string;
  progress: number;
  color: string;
  protocol: string;
  payload: string;
}

export interface SimulationStepLog {
  timestamp: number;
  message: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'gateway';
  packetId?: string;
  nodeId?: string;
}

export interface ImportTopologyResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface ResetSimulationOptions {
  clearFaults?: boolean;
  preserveSeed?: boolean;
}

const DEFAULT_CONFIG: SimulationConfig = {
  tickRateMs: 50,
  simSpeedMultiplier: 1.0,
  pathLossModel: 'LogDistance',
  pathLossExponent: 2.8,
  shadowingStdDevDb: 0.0,
  referenceDistanceMeters: 1.0,
  noiseFloorDbm: -95.0,
  carrierFreqGhz: 2.4,
  seed: 12345,
  fixedStepMs: 20,
  rxSensitivityDbm: -90,
  enableInterference: true,
  enableCollisions: true,
  defaultTtl: 16,
};

function clonePacket(p: Packet): Packet {
  return {
    ...p,
    pathTraversed: [...p.pathTraversed],
    plannedRoute: p.plannedRoute ? [...p.plannedRoute] : undefined,
    protocolTrace: [...p.protocolTrace],
    timeline: p.timeline ? p.timeline.map(t => ({ ...t })) : undefined,
  };
}

function cloneNode(n: MeshNode): MeshNode {
  return {
    ...n,
    position: { ...n.position },
    velocity: n.velocity ? { ...n.velocity } : undefined,
    mobilityBounds: n.mobilityBounds ? { ...n.mobilityBounds } : undefined,
    waypointTarget: n.waypointTarget ? { ...n.waypointTarget } : n.waypointTarget,
    currentQueue: [],
    interfaces: (n.interfaces || []).map(i => ({ ...i })),
    mprNeighbors: n.mprNeighbors ? [...n.mprNeighbors] : undefined,
    routingTable: {},
  };
}

function createEmptyMetrics(): TelemetryMetrics {
  return {
    totalPacketsInjected: 0,
    totalPacketsDelivered: 0,
    totalPacketsDropped: 0,
    pdr: 100.0,
    completedPdr: 100.0,
    inFlightPackets: 0,
    averageLatencyMs: 0.0,
    minLatencyMs: 0.0,
    maxLatencyMs: 0.0,
    jitterMs: 0.0,
    averageQueueDelayMs: 0.0,
    averageTxDelayMs: 0.0,
    averageGatewayDelayMs: 0.0,
    latencySamplesMs: [],
    hopCountHistogram: {},
    dropReasonCounts: {},
    pdrTimeSeries: [],
    throughputKbps: 0.0,
    gatewayLoadMap: {},
    linkUtilizationMap: {},
    channelUtilizationMap: {},
    perDomainStats: {},
    perNodeStats: {},
    protocolOverheadBytes: 0,
  };
}

export class DiscreteEventEngine {
  public simTimeMs: number = 0;
  public isRunning: boolean = false;
  public speedMultiplier: number = 1.0;
  public config: SimulationConfig;

  public nodes: Map<string, MeshNode> = new Map();
  public links: NetworkLink[] = [];
  public submeshes: Map<string, SubMeshDomain> = new Map();

  public activePackets: Map<string, Packet> = new Map();
  public packetHistory: Packet[] = [];
  public eventQueue: SimulationEvent[] = [];
  public eventLog: SimulationEvent[] = [];
  public logs: SimulationStepLog[] = [];
  public translationTraces: HeaderTranslationTrace[] = [];

  public faults: FaultState = {
    killedNodes: new Set<string>(),
    severedLinks: new Set<string>(),
    jammedFrequencies: new Set<FrequencyBand>(),
    jammedChannels: new Set<string>(),
    failedGatewayInterfaces: new Set<string>(),
  };

  public metrics: TelemetryMetrics = createEmptyMetrics();
  public lastValidationError: string | null = null;

  private prng: SeededPRNG;
  private packetIdCounter: number = 1000;
  private eventOrderCounter: number = 0;
  private linkIdCounter: number = 100;
  private lastMobilityTickMs: number = 0;

  // Real accumulators for telemetry
  private latenciesSumMs: number = 0;
  private latencySamplesMs: number[] = [];
  private jitterDiffSumMs: number = 0;
  private deliveredBytesTotal: number = 0;
  private queueDelaySumMs: number = 0;
  private txDelaySumMs: number = 0;
  private gatewayDelaySumMs: number = 0;
  private deliveredCount: number = 0;
  private linkBusyTimeMs: Map<string, number> = new Map();
  private channelBusyTimeMs: Map<string, number> = new Map();
  private gatewayBusyTimeMs: Map<string, number> = new Map();
  private nodeStatsMap: Map<string, NodeTelemetryStat> = new Map();
  private domainPacketStats: Map<
    string,
    { originated: number; delivered: number; dropped: number }
  > = new Map();

  // Workload history & initial snapshot for replayLastRun()
  private workloadHistory: WorkloadHistoryEntry[] = [];
  private initialWorkloadTopology: TopologyExportJSON | null = null;

  constructor(config?: Partial<SimulationConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.speedMultiplier = this.config.simSpeedMultiplier || 1.0;
    this.prng = new SeededPRNG(this.config.seed);
  }

  public setSeed(seed: number): void {
    const normalized = SeededPRNG.normalizeSeed(seed);
    this.config.seed = normalized;
    this.prng.setSeed(normalized);
  }

  public getSeed(): number {
    return this.config.seed;
  }

  public loadTopology(
    submeshes: SubMeshDomain[],
    nodes: MeshNode[],
    links: NetworkLink[],
    options?: { preserveExportedLinkMetrics?: boolean }
  ) {
    this.resetSimulation({ clearFaults: true, preserveSeed: true });
    this.submeshes.clear();
    this.nodes.clear();
    this.links = [];
    this.workloadHistory = [];

    for (const sm of submeshes) {
      this.submeshes.set(sm.id, { ...sm });
    }

    for (const n of nodes) {
      const prepared = cloneNode(n);
      prepared.isAlive = n.isAlive !== undefined ? n.isAlive : true;
      prepared.isMultiRadio = n.isMultiRadio ?? prepared.interfaces.length >= 2;
      if (!prepared.isAlive) {
        this.faults.killedNodes.add(prepared.id);
      }
      for (const iface of prepared.interfaces) {
        if (iface.isUp === false) {
          this.faults.failedGatewayInterfaces?.add(`${prepared.id}:${iface.id}`);
        }
      }
      this.nodes.set(prepared.id, prepared);
    }

    this.links = links.map(l => {
      const copy: NetworkLink = {
        ...l,
        currentLoad: 0,
        traversalCount: options?.preserveExportedLinkMetrics ? l.traversalCount || 0 : 0,
        isSevered: l.isSevered || false,
        isJammed: l.isJammed || false,
        isViable: l.isViable !== undefined ? l.isViable : true,
      };
      if (copy.isSevered) this.faults.severedLinks.add(copy.id);
      return copy;
    });

    if (!options?.preserveExportedLinkMetrics) {
      this.refreshLinkProperties();
    } else {
      // Only compute RF metrics for links missing physical fields
      this.refreshLinkProperties(true);
    }

    const overhead = syncProtocolControlPlanes(
      this.nodes,
      this.links,
      this.submeshes,
      this.simTimeMs
    );
    this.metrics.protocolOverheadBytes += overhead;
    this.initTelemetryMaps();
    this.updateAllTelemetry();
    this.initialWorkloadTopology = this.exportTopologyJSON('Replay Snapshot');

    this.addLog(
      `Topology loaded: ${nodes.length} nodes across ${submeshes.length} sub-mesh domains (seed=${this.config.seed}).`,
      'info'
    );
  }

  public refreshLinkProperties(onlyIfMissing: boolean = false, incidentToNodeIds?: Set<string>) {
    for (const link of this.links) {
      if (
        incidentToNodeIds &&
        !incidentToNodeIds.has(link.source) &&
        !incidentToNodeIds.has(link.target)
      ) {
        continue;
      }
      if (
        onlyIfMissing &&
        Number.isFinite(link.snrDb) &&
        Number.isFinite(link.distanceMeters) &&
        Number.isFinite(link.per)
      ) {
        continue;
      }

      const srcNode = this.nodes.get(link.source);
      const dstNode = this.nodes.get(link.target);
      if (!srcNode || !dstNode) continue;

      const ctx = resolveLinkChannelContext(link, this.nodes, this.submeshes);
      const freqGhz = frequencyBandToGhz(ctx.frequencyBand);
      const chKey = `${ctx.frequencyBand}:${ctx.channel}`;
      const linkJammed =
        link.isJammed ||
        this.faults.jammedFrequencies.has(ctx.frequencyBand) ||
        this.faults.jammedChannels?.has(chKey) ||
        false;

      const rxSens = Math.max(
        srcNode.receiverSensitivityDbm ?? this.config.rxSensitivityDbm ?? -90,
        dstNode.receiverSensitivityDbm ?? this.config.rxSensitivityDbm ?? -90
      );

      const evalResult = evaluatePhysicalLink(
        srcNode.position,
        dstNode.position,
        ctx.txPowerDbm,
        freqGhz,
        this.config,
        {
          channelWidthMhz: ctx.channelWidthMhz,
          noiseFloorDbm: this.config.noiseFloorDbm,
          rxSensitivityDbm: rxSens,
          interferenceDbm: -Infinity,
          collisionProbability: 0,
          prng: this.prng,
          isJammed: linkJammed,
        }
      );

      link.frequencyBand = ctx.frequencyBand;
      link.channel = ctx.channel;
      link.distanceMeters = evalResult.distanceMeters;
      link.snrDb = evalResult.snrDb;
      link.rxPowerDbm = evalResult.rxPowerDbm;
      link.interferenceDbm = evalResult.interferenceDbm;
      link.collisionProbability = evalResult.collisionProbability;
      link.isViable = evalResult.isViable;
      link.per = evalResult.per;
      link.lossRate = evalResult.per;
    }
  }

  public resetSimulation(options?: ResetSimulationOptions) {
    this.simTimeMs = 0;
    this.isRunning = false;
    this.lastMobilityTickMs = 0;
    this.activePackets.clear();
    this.packetHistory = [];
    this.eventQueue = [];
    this.eventLog = [];
    this.logs = [];
    this.translationTraces = [];
    this.lastValidationError = null;
    this.packetIdCounter = 1000;
    this.eventOrderCounter = 0;

    this.latenciesSumMs = 0;
    this.latencySamplesMs = [];
    this.jitterDiffSumMs = 0;
    this.deliveredBytesTotal = 0;
    this.queueDelaySumMs = 0;
    this.txDelaySumMs = 0;
    this.gatewayDelaySumMs = 0;
    this.deliveredCount = 0;
    this.linkBusyTimeMs.clear();
    this.channelBusyTimeMs.clear();
    this.gatewayBusyTimeMs.clear();
    this.nodeStatsMap.clear();
    this.domainPacketStats.clear();

    this.prng.setSeed(this.config.seed);

    for (const n of this.nodes.values()) {
      n.currentQueue = [];
      n.routingTable = {};
      n.aodvState = undefined;
      n.olsrState = undefined;
      n.hwmpState = undefined;
      n.rplState = undefined;
      n.waypointTarget = null;
      n.mobilityPauseRemainingSec = 0;
    }

    for (const l of this.links) {
      l.currentLoad = 0;
      l.traversalCount = 0;
      l.utilizationPct = 0;
    }

    if (options?.clearFaults) {
      this.faults.killedNodes.clear();
      this.faults.severedLinks.clear();
      this.faults.jammedFrequencies.clear();
      this.faults.jammedChannels?.clear();
      this.faults.failedGatewayInterfaces?.clear();
      for (const n of this.nodes.values()) {
        n.isAlive = true;
        for (const iface of n.interfaces) iface.isUp = true;
      }
      for (const l of this.links) {
        l.isSevered = false;
        l.isJammed = false;
      }
    }

    this.metrics = createEmptyMetrics();
    if (this.nodes.size > 0) {
      const overhead = syncProtocolControlPlanes(
        this.nodes,
        this.links,
        this.submeshes,
        0
      );
      this.metrics.protocolOverheadBytes += overhead;
    }
    this.initTelemetryMaps();
    this.updateAllTelemetry();
  }

  private initTelemetryMaps() {
    for (const n of this.nodes.values()) {
      this.ensureNodeStat(n);
    }
    for (const sm of this.submeshes.values()) {
      if (!this.domainPacketStats.has(sm.id)) {
        this.domainPacketStats.set(sm.id, { originated: 0, delivered: 0, dropped: 0 });
      }
    }
  }

  private ensureNodeStat(node: MeshNode): NodeTelemetryStat {
    let st = this.nodeStatsMap.get(node.id);
    if (!st) {
      st = {
        nodeId: node.id,
        name: node.name,
        type: node.type,
        packetsSent: 0,
        packetsReceived: 0,
        packetsForwarded: 0,
        packetsDropped: 0,
        queueOccupancyPct: 0,
        isAlive: node.isAlive,
      };
      this.nodeStatsMap.set(node.id, st);
    }
    st.name = node.name;
    st.isAlive = node.isAlive;
    st.queueOccupancyPct =
      node.queueCapacity > 0
        ? Math.min(100, (node.currentQueue.length / node.queueCapacity) * 100)
        : 0;
    return st;
  }

  public injectPacket(
    sourceId: string,
    targetId: string,
    payload: string = 'Telemetry Data Packet',
    payloadSizeBytes: number = 512,
    options?: { skipWorkloadRecord?: boolean }
  ): Packet | null {
    const srcNode = this.nodes.get(sourceId);
    const dstNode = this.nodes.get(targetId);

    const validation = validatePacketInjection(srcNode, dstNode, payloadSizeBytes);
    if (!validation.valid) {
      this.lastValidationError = validation.reason || 'Invalid packet injection';
      this.addLog(`Packet injection rejected: ${this.lastValidationError}`, 'error');
      return null;
    }

    const srcSubmesh = this.submeshes.get(srcNode!.submeshId);
    const dstSubmesh = this.submeshes.get(dstNode!.submeshId);
    if (!srcSubmesh || !dstSubmesh) {
      this.lastValidationError = 'Source or destination sub-mesh domain not found.';
      this.addLog(this.lastValidationError, 'error');
      return null;
    }

    this.lastValidationError = null;
    this.packetIdCounter++;
    const packetId = `PKT-${this.packetIdCounter}`;
    const ttl = this.config.defaultTtl > 0 ? this.config.defaultTtl : 16;

    if (!options?.skipWorkloadRecord) {
      if (this.workloadHistory.length === 0 && this.simTimeMs === 0) {
        this.initialWorkloadTopology = this.exportTopologyJSON('Replay Snapshot');
      }
      this.workloadHistory.push({
        offsetSimMs: this.simTimeMs,
        src: sourceId,
        dst: targetId,
        payload,
        payloadSizeBytes,
      });
    }

    const initialTimeline: PacketTimelineEntry[] = [
      {
        stage: 'created',
        timestampMs: this.simTimeMs,
        nodeId: sourceId,
        hopIndex: 0,
        protocol: srcSubmesh.protocol,
        submeshId: srcSubmesh.id,
        details: `Created ${packetId} (${payloadSizeBytes} B) toward ${dstNode!.name}`,
      },
    ];

    const newPacket: Packet = {
      id: packetId,
      packetId,
      sequenceNum: this.packetIdCounter,
      src: sourceId,
      dst: targetId,
      payload,
      payloadSizeBytes,
      size: payloadSizeBytes,
      submeshSrc: srcNode!.submeshId,
      submeshDst: dstNode!.submeshId,
      currentSubmeshId: srcNode!.submeshId,
      currentHop: sourceId,
      nextHop: undefined,
      pathTraversed: [sourceId],
      plannedRoute: [],
      protocolTrace: [srcSubmesh.protocol],
      hops: 0,
      ttl,
      routeChangesCount: 0,
      queueDelayMs: 0,
      txDelayMs: 0,
      propDelayMs: 0,
      gatewayDelayMs: 0,
      timeline: initialTimeline,
      state: 'created',
      createdAtSimTime: this.simTimeMs,
      color: srcSubmesh.color,
    };

    this.metrics.totalPacketsInjected++;
    const domStat = this.domainPacketStats.get(srcSubmesh.id) || {
      originated: 0,
      delivered: 0,
      dropped: 0,
    };
    domStat.originated++;
    this.domainPacketStats.set(srcSubmesh.id, domStat);
    this.ensureNodeStat(srcNode!).packetsSent++;

    this.activePackets.set(packetId, newPacket);

    this.recordEvent({
      id: `EV-CREATE-${packetId}`,
      timestamp: this.simTimeMs,
      type: 'PacketCreated',
      data: { packetId, src: sourceId, dst: targetId, payloadSizeBytes },
    });

    this.scheduleEvent({
      id: `EV-QUEUE-${packetId}-0`,
      timestamp: this.simTimeMs + 0.5,
      type: 'PacketQueued',
      data: { packetId, nodeId: sourceId },
    });

    this.addLog(
      `[Time ${this.simTimeMs.toFixed(1)}ms] Injected ${packetId} (${payloadSizeBytes}B) at ${srcNode!.name} -> ${dstNode!.name}`,
      'info',
      packetId,
      srcNode!.id
    );
    this.updateAllTelemetry();

    return newPacket;
  }

  /**
   * Replays the recorded packet injection workload deterministically with the same seed.
   */
  public replayLastRun(): boolean {
    if (this.workloadHistory.length === 0) {
      this.addLog('[Replay] No recorded packet workload to replay.', 'warn');
      return false;
    }

    const savedWorkload = this.workloadHistory.map(w => ({ ...w }));
    const savedSeed = this.config.seed;

    if (this.initialWorkloadTopology) {
      this.importTopologyJSON(this.initialWorkloadTopology);
    } else {
      this.resetSimulation({ clearFaults: false, preserveSeed: true });
    }

    this.setSeed(savedSeed);
    this.workloadHistory = savedWorkload;

    for (let i = 0; i < savedWorkload.length; i++) {
      const entry = savedWorkload[i];
      if (entry.offsetSimMs <= 0) {
        this.injectPacket(entry.src, entry.dst, entry.payload, entry.payloadSizeBytes, {
          skipWorkloadRecord: true,
        });
      } else {
        this.scheduleEvent({
          id: `EV-REPLAY-INJ-${i}`,
          timestamp: entry.offsetSimMs,
          type: 'PacketCreated',
          data: {
            replayInject: true,
            src: entry.src,
            dst: entry.dst,
            payload: entry.payload,
            payloadSizeBytes: entry.payloadSizeBytes,
          },
        });
      }
    }

    this.isRunning = true;
    this.addLog(
      `[Replay] Started deterministic replay of ${savedWorkload.length} packet flow(s) with seed ${savedSeed}.`,
      'info'
    );
    return true;
  }

  private recordEvent(event: SimulationEvent) {
    const seq = event.orderSeq ?? ++this.eventOrderCounter;
    this.eventLog.push({ ...event, orderSeq: seq });
    if (this.eventLog.length > 1000) this.eventLog.shift();
  }

  public scheduleEvent(event: SimulationEvent) {
    const orderSeq = event.orderSeq ?? ++this.eventOrderCounter;
    const prepared: SimulationEvent = {
      ...event,
      orderSeq,
      id: event.id || `EV-${event.timestamp.toFixed(2)}-${orderSeq}`,
    };
    this.eventQueue.push(prepared);
    this.eventQueue.sort(
      (a, b) => a.timestamp - b.timestamp || (a.orderSeq ?? 0) - (b.orderSeq ?? 0)
    );
  }

  /**
   * Advances simulation deterministically by fixedDtMs (default config.fixedStepMs = 20ms).
   */
  public stepFixed(fixedDtMs: number = this.config.fixedStepMs || 20): void {
    this.step(fixedDtMs);
  }

  /**
   * Advances simulation by deltaSimMs in deterministic fixed mobility increments,
   * executing every event strictly at its own event.timestamp.
   */
  public step(deltaSimMs: number) {
    if (!Number.isFinite(deltaSimMs) || deltaSimMs <= 0) return;
    const targetEndMs = this.simTimeMs + deltaSimMs;
    const fixedStep = Math.max(1, this.config.fixedStepMs || 20);

    while (this.simTimeMs < targetEndMs - 1e-9) {
      const nextMobBoundary = this.lastMobilityTickMs + fixedStep;
      const chunkEnd = Math.min(nextMobBoundary, targetEndMs);

      // Process all discrete events up to chunkEnd in deterministic (timestamp, orderSeq) order
      while (
        this.eventQueue.length > 0 &&
        this.eventQueue[0].timestamp <= chunkEnd + 1e-9
      ) {
        const event = this.eventQueue.shift()!;
        this.simTimeMs = Math.max(this.simTimeMs, event.timestamp);
        this.processEvent(event);
      }

      this.simTimeMs = chunkEnd;

      if (chunkEnd >= nextMobBoundary - 1e-9) {
        this.lastMobilityTickMs = nextMobBoundary;
        this.runFixedMobilityTick(fixedStep, nextMobBoundary);
      }
    }

    this.updateAllTelemetry();
  }

  /**
   * Steps strictly to the next discrete event in the priority queue (single event/hop step).
   */
  public stepNextEvent(): SimulationEvent | null {
    const fixedStep = Math.max(1, this.config.fixedStepMs || 20);
    const hasMobileNodes = Array.from(this.nodes.values()).some(
      n => n.isAlive && n.type === 'mobile' && n.mobilityModel !== 'static'
    );

    if (this.eventQueue.length === 0) {
      if (hasMobileNodes) {
        const nextMob = this.lastMobilityTickMs + fixedStep;
        this.simTimeMs = nextMob;
        this.lastMobilityTickMs = nextMob;
        this.runFixedMobilityTick(fixedStep, nextMob);
        this.updateAllTelemetry();
        return {
          id: `EV-MOB-${nextMob}`,
          timestamp: nextMob,
          type: 'MobilityUpdated',
          data: { simTimeMs: nextMob },
        };
      }
      return null;
    }

    const nextEvent = this.eventQueue[0];

    // Advance any overdue mobility ticks strictly before event.timestamp
    if (hasMobileNodes) {
      while (this.lastMobilityTickMs + fixedStep <= nextEvent.timestamp + 1e-9) {
        const mobTs = this.lastMobilityTickMs + fixedStep;
        this.simTimeMs = mobTs;
        this.lastMobilityTickMs = mobTs;
        this.runFixedMobilityTick(fixedStep, mobTs);
        // Re-check queue in case mobility tick spawned an earlier event
        if (this.eventQueue[0] !== nextEvent) break;
      }
    }

    const event = this.eventQueue.shift()!;
    this.simTimeMs = Math.max(this.simTimeMs, event.timestamp);
    this.processEvent(event);
    this.updateAllTelemetry();
    return event;
  }

  private runFixedMobilityTick(fixedStepMs: number, tickTimestampMs: number) {
    const mobResult = updateMobileNodesDetailed(
      this.nodes,
      fixedStepMs / 1000,
      this.prng
    );
    if (!mobResult.anyMoved) return;

    const syncRes = updateDynamicMobilityLinks(
      this.nodes,
      this.links,
      this.submeshes,
      this.config,
      {
        prng: this.prng,
        jammedFrequencies: this.faults.jammedFrequencies,
        jammedChannels: this.faults.jammedChannels,
      }
    );

    this.refreshLinkProperties(false, new Set(mobResult.movedNodeIds));

    if (syncRes.topologyChanged) {
      const overhead = syncProtocolControlPlanes(
        this.nodes,
        this.links,
        this.submeshes,
        tickTimestampMs
      );
      this.metrics.protocolOverheadBytes += overhead;

      // Check active in-flight packets for route disruption caused by mobility
      for (const pkt of this.activePackets.values()) {
        if (isPacketTerminalState(pkt.state) || pkt.state === 'transmitting') continue;
        if (!pkt.nextHop) continue;
        const stillValid = this.findLink(pkt.currentHop, pkt.nextHop);
        if (!stillValid || stillValid.isSevered || stillValid.isJammed || stillValid.isViable === false) {
          this.recomputeMidFlightRoute(pkt, tickTimestampMs, 'Mobility topology change');
        }
      }
    }

    this.recordEvent({
      id: `EV-MOB-${tickTimestampMs}`,
      timestamp: tickTimestampMs,
      type: 'MobilityUpdated',
      data: {
        movedNodeIds: mobResult.movedNodeIds,
        addedLinks: syncRes.addedLinks.map(l => l.id),
        removedLinks: syncRes.removedLinks.map(l => l.id),
      },
    });
  }

  private processEvent(event: SimulationEvent) {
    this.recordEvent(event);

    switch (event.type) {
      case 'PacketCreated':
        if (event.data?.replayInject) {
          this.injectPacket(
            event.data.src,
            event.data.dst,
            event.data.payload,
            event.data.payloadSizeBytes,
            { skipWorkloadRecord: true }
          );
        }
        break;
      case 'PacketQueued':
        this.handlePacketQueued(event.data.packetId, event.data.nodeId, event.timestamp);
        break;
      case 'TransmissionStarted':
        this.handleTransmissionStarted(event.data.packetId, event.data.nodeId, event.timestamp);
        break;
      case 'TransmissionCompleted':
        this.handleTransmissionCompleted(
          event.data.packetId,
          event.data.fromNodeId,
          event.data.toNodeId,
          event.data.linkId,
          event.timestamp
        );
        break;
      case 'PacketReceived':
        this.handlePacketReceived(event.data.packetId, event.data.nodeId, event.timestamp);
        break;
      case 'PacketForwarded':
        this.handlePacketForwarded(event.data.packetId, event.data.nodeId, event.timestamp);
        break;
      case 'PacketDelivered':
      case 'PACKET_DELIVER':
        this.handlePacketDeliver(event.data.packetId, event.timestamp);
        break;
      case 'PacketDropped':
      case 'PACKET_DROP':
        this.handlePacketDrop(event.data.packetId, event.data.reason, event.timestamp);
        break;
      case 'GATEWAY_TRANSLATE':
        this.handleGatewayTranslateEvent(
          event.data.packetId,
          event.data.gatewayId,
          event.data.nextHopId,
          event.timestamp
        );
        break;
      case 'PACKET_HOP':
        // Legacy alias compatibility: treat as PacketQueued / PacketForwarded
        this.handlePacketQueued(
          event.data.packetId,
          this.activePackets.get(event.data.packetId)?.currentHop || '',
          event.timestamp
        );
        break;
      default:
        break;
    }
  }

  private appendTimeline(packet: Packet, entry: PacketTimelineEntry) {
    if (!packet.timeline) packet.timeline = [];
    packet.timeline.push(entry);
  }

  private removeFromNodeQueue(node: MeshNode | undefined, packetId: string) {
    if (!node) return;
    const idx = node.currentQueue.findIndex(p => p.id === packetId);
    if (idx !== -1) node.currentQueue.splice(idx, 1);
  }

  private recomputeMidFlightRoute(
    packet: Packet,
    timestampMs: number,
    triggerReason: string
  ): { nextHopId: string | null; discoveryDelayMs: number; error?: string } {
    const route = calculateMultiMeshRoute(
      packet.currentHop,
      packet.dst,
      this.nodes,
      this.links,
      this.submeshes,
      undefined,
      { simTimeMs: timestampMs }
    );

    if (route.controlOverheadBytes) {
      this.metrics.protocolOverheadBytes += route.controlOverheadBytes;
    }

    if (!route.found || route.path.length < 2) {
      return {
        nextHopId: null,
        discoveryDelayMs: route.discoveryDelayMs || 0,
        error: route.error || `Destination Unreachable: No alternate route (${triggerReason})`,
      };
    }

    const newNextHop = route.path[1];
    const prevPlanned = packet.plannedRoute || [];
    const changed =
      prevPlanned.length > 0 &&
      (prevPlanned.join('>') !== route.path.join('>') &&
        prevPlanned[1] !== newNextHop);

    if (prevPlanned.length === 0) {
      packet.plannedRoute = [...route.path];
      this.scheduleEvent({
        id: `EV-RDISC-${packet.id}-${packet.hops}`,
        timestamp: timestampMs,
        type: 'RouteDiscovered',
        data: { packetId: packet.id, nodeId: packet.currentHop, path: route.path },
      });
      this.appendTimeline(packet, {
        stage: 'route_discovered',
        timestampMs,
        nodeId: packet.currentHop,
        nextNodeId: newNextHop,
        hopIndex: packet.hops,
        protocol: route.protocolsUsed[0],
        details: `Discovered route: ${route.path.join(' -> ')}`,
      });
    } else if (changed) {
      packet.routeChangesCount = (packet.routeChangesCount || 0) + 1;
      packet.plannedRoute = [...route.path];
      this.scheduleEvent({
        id: `EV-RCHG-${packet.id}-${packet.hops}-${packet.routeChangesCount}`,
        timestamp: timestampMs,
        type: 'RouteChanged',
        data: {
          packetId: packet.id,
          nodeId: packet.currentHop,
          newNextHop,
          path: route.path,
          reason: triggerReason,
        },
      });
      this.appendTimeline(packet, {
        stage: 'route_changed',
        timestampMs,
        nodeId: packet.currentHop,
        nextNodeId: newNextHop,
        hopIndex: packet.hops,
        protocol: route.protocolsUsed[0],
        details: `Rerouted (${triggerReason}) via ${newNextHop}`,
      });
      this.addLog(
        `[Time ${timestampMs.toFixed(1)}ms] Rerouted ${packet.id} at ${this.nodes.get(packet.currentHop)?.name}: ${triggerReason} -> next hop ${this.nodes.get(newNextHop)?.name}`,
        'warn',
        packet.id,
        packet.currentHop
      );
    } else {
      packet.plannedRoute = [...route.path];
    }

    return {
      nextHopId: newNextHop,
      discoveryDelayMs: route.discoveryDelayMs || 0,
    };
  }

  private handlePacketQueued(packetId: string, nodeId: string, timestampMs: number) {
    const packet = this.activePackets.get(packetId);
    if (!packet || isPacketTerminalState(packet.state)) return;

    const currentNode = this.nodes.get(nodeId || packet.currentHop);
    const targetNode = this.nodes.get(packet.dst);

    if (!currentNode || !currentNode.isAlive) {
      this.handlePacketDrop(
        packetId,
        `Destination Unreachable: Relay node "${currentNode?.name || nodeId}" is offline`,
        timestampMs
      );
      return;
    }
    if (!targetNode || !targetNode.isAlive) {
      this.handlePacketDrop(
        packetId,
        'Destination Unreachable: Destination node is offline',
        timestampMs
      );
      return;
    }

    if (currentNode.id === targetNode.id) {
      this.scheduleEvent({
        id: `EV-DELIV-${packetId}`,
        timestamp: timestampMs,
        type: 'PacketDelivered',
        data: { packetId },
      });
      return;
    }

    // Queue capacity enforcement
    if (!currentNode.currentQueue.some(p => p.id === packetId)) {
      if (currentNode.currentQueue.length >= currentNode.queueCapacity) {
        if (currentNode.type === 'gateway') {
          this.recordEvent({
            id: `EV-GWOVR-${currentNode.id}-${timestampMs.toFixed(1)}`,
            timestamp: timestampMs,
            type: 'GatewayOverloaded',
            data: {
              gatewayId: currentNode.id,
              queueLength: currentNode.currentQueue.length,
              queueCapacity: currentNode.queueCapacity,
              packetId,
            },
          });
        }
        this.handlePacketDrop(
          packetId,
          `Queue overflow at ${currentNode.name} (${currentNode.currentQueue.length}/${currentNode.queueCapacity})`,
          timestampMs
        );
        return;
      }
      currentNode.currentQueue.push(packet);
    }

    if (
      currentNode.type === 'gateway' &&
      currentNode.queueCapacity > 0 &&
      currentNode.currentQueue.length / currentNode.queueCapacity >= 0.8
    ) {
      this.recordEvent({
        id: `EV-GWOVR-${currentNode.id}-${timestampMs.toFixed(1)}`,
        timestamp: timestampMs,
        type: 'GatewayOverloaded',
        data: {
          gatewayId: currentNode.id,
          queueLength: currentNode.currentQueue.length,
          queueCapacity: currentNode.queueCapacity,
          packetId,
        },
      });
    }

    packet.state = 'queued';
    const queueDepth = Math.max(0, currentNode.currentQueue.length - 1);
    const queueDelayMs = Math.round((0.8 + queueDepth * 2.0) * 100) / 100;
    packet.queueDelayMs = (packet.queueDelayMs || 0) + queueDelayMs;

    const sm = this.submeshes.get(currentNode.submeshId);
    this.appendTimeline(packet, {
      stage: 'queued',
      timestampMs,
      nodeId: currentNode.id,
      hopIndex: packet.hops,
      protocol: sm?.protocol,
      submeshId: currentNode.submeshId,
      queueDelayMs,
      details: `Queued at ${currentNode.name} (depth ${currentNode.currentQueue.length}/${currentNode.queueCapacity})`,
    });

    // Compute route at node
    const routeRes = this.recomputeMidFlightRoute(packet, timestampMs, 'Hop route resolution');
    if (!routeRes.nextHopId) {
      this.removeFromNodeQueue(currentNode, packetId);
      this.handlePacketDrop(
        packetId,
        routeRes.error || `Destination Unreachable: No route from ${currentNode.name}`,
        timestampMs
      );
      return;
    }

    packet.nextHop = routeRes.nextHopId;
    const nextNode = this.nodes.get(routeRes.nextHopId);

    // Check gateway translation delay if forwarding across submesh boundaries
    let gatewayDelayMs = 0;
    if (
      currentNode.type === 'gateway' &&
      nextNode &&
      packet.currentSubmeshId &&
      nextNode.submeshId !== packet.currentSubmeshId
    ) {
      const ingressSm = this.submeshes.get(packet.currentSubmeshId);
      const egressSm = this.submeshes.get(nextNode.submeshId);
      if (ingressSm && egressSm) {
        const res = this.handleGatewayTranslateEvent(
          packetId,
          currentNode.id,
          nextNode.id,
          timestampMs
        );
        if (!res.ok) {
          this.removeFromNodeQueue(currentNode, packetId);
          this.handlePacketDrop(packetId, res.error || 'Gateway translation failed', timestampMs);
          return;
        }
        gatewayDelayMs = res.gatewayDelayMs;
      }
    } else if (
      nextNode?.type === 'gateway' &&
      currentNode.submeshId !== nextNode.submeshId
    ) {
      // Packet crossing into a gateway from another submesh will translate at the gateway upon arrival
    }

    this.updateGatewayTelemetry();

    const startDelay = queueDelayMs + (routeRes.discoveryDelayMs || 0) + gatewayDelayMs;
    this.scheduleEvent({
      id: `EV-TXSTART-${packetId}-${packet.hops}`,
      timestamp: timestampMs + startDelay,
      type: 'TransmissionStarted',
      data: { packetId, nodeId: currentNode.id },
    });
  }

  private handleGatewayTranslateEvent(
    packetId: string,
    gatewayId: string,
    nextHopId: string,
    timestampMs: number
  ): { ok: boolean; gatewayDelayMs: number; error?: string } {
    const packet = this.activePackets.get(packetId);
    const gateway = this.nodes.get(gatewayId);
    const nextNode = this.nodes.get(nextHopId);
    if (!packet || !gateway || !nextNode) {
      return { ok: false, gatewayDelayMs: 0, error: 'Destination Unreachable: Gateway missing' };
    }

    const ingressSubmesh = this.submeshes.get(packet.currentSubmeshId || packet.submeshSrc);
    const egressSubmesh = this.submeshes.get(nextNode.submeshId);
    if (!ingressSubmesh || !egressSubmesh) {
      return { ok: false, gatewayDelayMs: 0, error: 'Submesh domain missing at gateway' };
    }

    const { packet: translatedPacket, trace, ok, error, gatewayDelayMs } = translatePacketHeader(
      packet,
      gateway,
      ingressSubmesh,
      egressSubmesh,
      timestampMs
    );

    if (!ok) {
      return { ok: false, gatewayDelayMs: 0, error };
    }

    this.activePackets.set(packetId, translatedPacket);
    this.translationTraces.push(trace);
    this.gatewayBusyTimeMs.set(
      gateway.id,
      (this.gatewayBusyTimeMs.get(gateway.id) || 0) + gatewayDelayMs
    );

    this.appendTimeline(translatedPacket, {
      stage: 'gateway_translated',
      timestampMs,
      nodeId: gateway.id,
      nextNodeId: nextNode.id,
      hopIndex: translatedPacket.hops,
      protocol: egressSubmesh.protocol,
      submeshId: egressSubmesh.id,
      gatewayDelayMs,
      details: `Translated ${ingressSubmesh.protocol} (${ingressSubmesh.frequencyBand}) -> ${egressSubmesh.protocol} (${egressSubmesh.frequencyBand})`,
    });

    this.addLog(
      `[Time ${timestampMs.toFixed(1)}ms] GATEWAY BRIDGE at ${gateway.name}: ${ingressSubmesh.protocol} (${ingressSubmesh.frequencyBand}) -> ${egressSubmesh.protocol} (${egressSubmesh.frequencyBand}) (+${gatewayDelayMs.toFixed(1)}ms)`,
      'gateway',
      packetId,
      gateway.id
    );

    return { ok: true, gatewayDelayMs };
  }

  private handleTransmissionStarted(packetId: string, nodeId: string, timestampMs: number) {
    const packet = this.activePackets.get(packetId);
    if (!packet || isPacketTerminalState(packet.state)) return;

    const currentNode = this.nodes.get(nodeId || packet.currentHop);
    const targetNode = this.nodes.get(packet.dst);

    if (!currentNode || !currentNode.isAlive) {
      this.removeFromNodeQueue(currentNode, packetId);
      this.handlePacketDrop(
        packetId,
        `Destination Unreachable: Node "${currentNode?.name || nodeId}" failed before transmission`,
        timestampMs
      );
      return;
    }
    if (!targetNode || !targetNode.isAlive) {
      this.removeFromNodeQueue(currentNode, packetId);
      this.handlePacketDrop(
        packetId,
        'Destination Unreachable: Destination node is offline',
        timestampMs
      );
      return;
    }

    // Verify next hop and link viability before transmitting; reroute dynamically if broken while queued
    let nextHopId = packet.nextHop;
    let activeLink = nextHopId ? this.findLink(currentNode.id, nextHopId) : null;
    const nextHopNode = nextHopId ? this.nodes.get(nextHopId) : undefined;

    const linkBroken =
      !nextHopId ||
      !nextHopNode ||
      !nextHopNode.isAlive ||
      !activeLink ||
      activeLink.isSevered ||
      activeLink.isJammed ||
      activeLink.isViable === false;

    if (linkBroken) {
      const reroute = this.recomputeMidFlightRoute(
        packet,
        timestampMs,
        'Pre-TX link/node failure'
      );
      if (!reroute.nextHopId) {
        this.removeFromNodeQueue(currentNode, packetId);
        this.handlePacketDrop(
          packetId,
          reroute.error || `Destination Unreachable: Link failure from ${currentNode.name}`,
          timestampMs
        );
        return;
      }
      nextHopId = reroute.nextHopId;
      packet.nextHop = nextHopId;
      activeLink = this.findLink(currentNode.id, nextHopId);
    }

    if (!activeLink || activeLink.isSevered || activeLink.isJammed || activeLink.isViable === false) {
      this.removeFromNodeQueue(currentNode, packetId);
      this.handlePacketDrop(
        packetId,
        `Destination Unreachable: Physical link unavailable between ${currentNode.name} and ${this.nodes.get(nextHopId!)?.name || nextHopId}`,
        timestampMs
      );
      return;
    }

    // Dequeue from currentNode upon starting TX
    this.removeFromNodeQueue(currentNode, packetId);

    const bandwidthBps = Math.max(activeLink.bandwidthMbps, 0.05) * 1e6;
    const txDelayMs = Math.round(((packet.payloadSizeBytes * 8) / bandwidthBps) * 1000 * 1000) / 1000;
    const propDelayMs = Math.round((activeLink.distanceMeters / 3e8) * 1000 * 10000) / 10000;
    const hopDurationMs = Math.max(txDelayMs + propDelayMs, 0.05);

    activeLink.currentLoad += 1;
    activeLink.traversalCount += 1;

    packet.state = 'transmitting';
    packet.currentHop = currentNode.id; // Keep currentHop as sender while frame is in flight!
    packet.nextHop = nextHopId;
    packet.currentLinkId = activeLink.id;
    packet.txDelayMs = (packet.txDelayMs || 0) + txDelayMs;
    packet.propDelayMs = (packet.propDelayMs || 0) + propDelayMs;
    packet.lastHopStartedAtMs = timestampMs;
    packet.lastHopDurationMs = hopDurationMs;

    const ctx = resolveLinkChannelContext(activeLink, this.nodes, this.submeshes);
    const chKey = `${ctx.frequencyBand}:${ctx.channel}`;
    this.linkBusyTimeMs.set(activeLink.id, (this.linkBusyTimeMs.get(activeLink.id) || 0) + hopDurationMs);
    this.channelBusyTimeMs.set(chKey, (this.channelBusyTimeMs.get(chKey) || 0) + hopDurationMs);

    const sm = this.submeshes.get(currentNode.submeshId);
    this.appendTimeline(packet, {
      stage: 'transmitting',
      timestampMs,
      nodeId: currentNode.id,
      nextNodeId: nextHopId,
      hopIndex: packet.hops + 1,
      protocol: sm?.protocol,
      submeshId: currentNode.submeshId,
      txDelayMs,
      propDelayMs,
      details: `TX ${currentNode.name} -> ${this.nodes.get(nextHopId!)?.name} (${txDelayMs.toFixed(2)}ms TX, ${activeLink.bandwidthMbps} Mbps)`,
    });

    this.addLog(
      `[Time ${timestampMs.toFixed(1)}ms] ${packet.id} TX: ${currentNode.name} -> ${this.nodes.get(nextHopId!)?.name} (Hop #${packet.hops + 1}, TX: ${txDelayMs.toFixed(2)}ms)`,
      'info',
      packet.id,
      currentNode.id
    );

    this.scheduleEvent({
      id: `EV-TXEND-${packet.id}-${packet.hops + 1}`,
      timestamp: timestampMs + hopDurationMs,
      type: 'TransmissionCompleted',
      data: {
        packetId: packet.id,
        fromNodeId: currentNode.id,
        toNodeId: nextHopId,
        linkId: activeLink.id,
      },
    });
  }

  private handleTransmissionCompleted(
    packetId: string,
    fromNodeId: string,
    toNodeId: string,
    linkId: string,
    timestampMs: number
  ) {
    const link = this.links.find(l => l.id === linkId) || this.findLink(fromNodeId, toNodeId);
    if (link) {
      link.currentLoad = Math.max(0, link.currentLoad - 1);
    }

    const packet = this.activePackets.get(packetId);
    if (!packet || isPacketTerminalState(packet.state)) return;

    const fromNode = this.nodes.get(fromNodeId);
    const toNode = this.nodes.get(toNodeId);

    if (!fromNode || !fromNode.isAlive) {
      this.handlePacketDrop(
        packetId,
        `Transmitting node "${fromNode?.name || fromNodeId}" failed mid-transmission`,
        timestampMs
      );
      return;
    }
    if (!toNode || !toNode.isAlive) {
      this.handlePacketDrop(
        packetId,
        toNodeId === packet.dst
          ? 'Destination Unreachable: Destination node is offline'
          : `Next-hop node "${toNode?.name || toNodeId}" went offline mid-transmission`,
        timestampMs
      );
      return;
    }
    if (!link || link.isSevered) {
      this.handlePacketDrop(
        packetId,
        `Link severed mid-transmission between ${fromNode.name} and ${toNode.name}`,
        timestampMs
      );
      return;
    }

    // Evaluate live RF + interference + CSMA/CA collision + payload length PER at receiver
    const ctx = resolveLinkChannelContext(link, this.nodes, this.submeshes);
    const freqGhz = frequencyBandToGhz(ctx.frequencyBand);
    const chKey = `${ctx.frequencyBand}:${ctx.channel}`;
    const isJammed =
      link.isJammed ||
      this.faults.jammedFrequencies.has(ctx.frequencyBand) ||
      this.faults.jammedChannels?.has(chKey) ||
      false;

    const interferenceDbm = computeCoChannelInterferenceDbm(
      link,
      this.links,
      this.nodes,
      this.submeshes,
      this.config,
      this.faults.jammedFrequencies,
      this.faults.jammedChannels
    );
    const collisionProb = computeCsmaCollisionProbability(
      link,
      this.links,
      this.nodes,
      this.submeshes,
      this.config
    );
    const rxSens = Math.max(
      fromNode.receiverSensitivityDbm ?? this.config.rxSensitivityDbm ?? -90,
      toNode.receiverSensitivityDbm ?? this.config.rxSensitivityDbm ?? -90
    );

    const evalRes = evaluatePhysicalLink(
      fromNode.position,
      toNode.position,
      ctx.txPowerDbm,
      freqGhz,
      this.config,
      {
        channelWidthMhz: ctx.channelWidthMhz,
        noiseFloorDbm: this.config.noiseFloorDbm,
        rxSensitivityDbm: rxSens,
        interferenceDbm,
        collisionProbability: collisionProb,
        payloadSizeBytes: packet.payloadSizeBytes,
        prng: this.prng,
        isJammed,
      }
    );

    link.distanceMeters = evalRes.distanceMeters;
    link.snrDb = evalRes.snrDb;
    link.rxPowerDbm = evalRes.rxPowerDbm;
    link.interferenceDbm = evalRes.interferenceDbm;
    link.collisionProbability = evalRes.collisionProbability;
    // Keep structural link viability independent of transient concurrent transmissions
    const baselineViable =
      !isJammed &&
      evalRes.rxPowerDbm >= rxSens &&
      (Number.isFinite(evalRes.interferenceDbm) && evalRes.interferenceDbm > -150
        ? evalRes.rxPowerDbm - this.config.noiseFloorDbm >= 8.0
        : evalRes.isViable);
    link.isViable = baselineViable;
    link.per = evalRes.per;
    link.lossRate = evalRes.per;

    if (isJammed) {
      this.handlePacketDrop(
        packetId,
        `Channel jammed on ${ctx.frequencyBand} CH${ctx.channel} between ${fromNode.name} and ${toNode.name}`,
        timestampMs
      );
      return;
    }

    if (!evalRes.isViable) {
      this.handlePacketDrop(
        packetId,
        `RF link non-viable (Rx ${evalRes.rxPowerDbm.toFixed(1)} dBm < ${rxSens} dBm or SNR ${evalRes.snrDb.toFixed(1)} dB < 8 dB)`,
        timestampMs
      );
      return;
    }

    const roll = this.prng.next();
    if (roll < evalRes.per) {
      const collisionDominant = evalRes.collisionProbability > evalRes.rfPer;
      this.handlePacketDrop(
        packetId,
        collisionDominant
          ? `CSMA/CA collision drop (P_coll ${(evalRes.collisionProbability * 100).toFixed(1)}%, SNR ${evalRes.snrDb.toFixed(1)} dB)`
          : `RF noise drop (PER ${(evalRes.per * 100).toFixed(1)}%, SNR ${evalRes.snrDb.toFixed(1)} dB)`,
        timestampMs
      );
      return;
    }

    // Hop succeeded
    packet.hops += 1;
    packet.ttl = (packet.ttl ?? this.config.defaultTtl) - 1;
    packet.currentHop = toNodeId;
    packet.nextHop = undefined;
    packet.currentLinkId = undefined;
    packet.pathTraversed.push(toNodeId);
    packet.state = 'received';

    // Update currentSubmeshId if receiving at non-gateway in new domain
    if (toNode.type !== 'gateway') {
      packet.currentSubmeshId = toNode.submeshId;
    }

    const toSm = this.submeshes.get(toNode.submeshId);
    if (toSm && packet.protocolTrace[packet.protocolTrace.length - 1] !== toSm.protocol) {
      packet.protocolTrace.push(toSm.protocol);
    }

    this.ensureNodeStat(toNode).packetsReceived++;

    this.appendTimeline(packet, {
      stage: 'received',
      timestampMs,
      nodeId: toNodeId,
      hopIndex: packet.hops,
      protocol: toSm?.protocol,
      submeshId: toNode.submeshId,
      details: `Received at ${toNode.name} (Hop #${packet.hops}, TTL=${packet.ttl})`,
    });

    this.scheduleEvent({
      id: `EV-RX-${packet.id}-${packet.hops}`,
      timestamp: timestampMs,
      type: 'PacketReceived',
      data: { packetId: packet.id, nodeId: toNodeId },
    });
  }

  private handlePacketReceived(packetId: string, nodeId: string, timestampMs: number) {
    const packet = this.activePackets.get(packetId);
    if (!packet || isPacketTerminalState(packet.state)) return;

    if (nodeId === packet.dst) {
      this.scheduleEvent({
        id: `EV-DELIV-${packetId}`,
        timestamp: timestampMs,
        type: 'PacketDelivered',
        data: { packetId },
      });
      return;
    }

    if ((packet.ttl ?? 0) <= 0) {
      this.handlePacketDrop(
        packetId,
        `TTL expired at ${this.nodes.get(nodeId)?.name || nodeId} (hop limit reached)`,
        timestampMs
      );
      return;
    }

    this.scheduleEvent({
      id: `EV-FWD-${packetId}-${packet.hops}`,
      timestamp: timestampMs + 0.1,
      type: 'PacketForwarded',
      data: { packetId, nodeId },
    });
  }

  private handlePacketForwarded(packetId: string, nodeId: string, timestampMs: number) {
    const packet = this.activePackets.get(packetId);
    if (!packet || isPacketTerminalState(packet.state)) return;

    const currentNode = this.nodes.get(nodeId || packet.currentHop);
    if (!currentNode || !currentNode.isAlive) {
      this.handlePacketDrop(
        packetId,
        `Destination Unreachable: Forwarder "${currentNode?.name || nodeId}" is offline`,
        timestampMs
      );
      return;
    }

    if ((packet.ttl ?? 0) <= 0) {
      this.handlePacketDrop(
        packetId,
        `TTL expired at ${currentNode.name} (hop limit reached)`,
        timestampMs
      );
      return;
    }

    packet.state = 'forwarded';
    this.ensureNodeStat(currentNode).packetsForwarded++;

    const sm = this.submeshes.get(currentNode.submeshId);
    this.appendTimeline(packet, {
      stage: 'forwarded',
      timestampMs,
      nodeId: currentNode.id,
      hopIndex: packet.hops,
      protocol: sm?.protocol,
      submeshId: currentNode.submeshId,
      details: `Forwarding from ${currentNode.name} toward ${this.nodes.get(packet.dst)?.name || packet.dst}`,
    });

    this.scheduleEvent({
      id: `EV-Q-${packetId}-${packet.hops}`,
      timestamp: timestampMs,
      type: 'PacketQueued',
      data: { packetId, nodeId: currentNode.id },
    });
  }

  private handlePacketDeliver(packetId: string, timestampMs: number) {
    const packet = this.activePackets.get(packetId);
    if (!packet || isPacketTerminalState(packet.state)) return;

    packet.state = 'delivered';
    packet.deliveredAtSimTime = timestampMs;
    packet.nextHop = undefined;
    packet.currentLinkId = undefined;

    const latencyMs = Math.max(0, timestampMs - packet.createdAtSimTime);

    this.appendTimeline(packet, {
      stage: 'delivered',
      timestampMs,
      nodeId: packet.dst,
      hopIndex: packet.hops,
      protocol: this.submeshes.get(packet.submeshDst)?.protocol,
      submeshId: packet.submeshDst,
      details: `Delivered to ${this.nodes.get(packet.dst)?.name || packet.dst} in ${packet.hops} hops (${latencyMs.toFixed(2)} ms)`,
    });

    this.deliveredCount++;
    this.metrics.totalPacketsDelivered++;
    this.latenciesSumMs += latencyMs;
    if (this.latencySamplesMs.length > 0) {
      this.jitterDiffSumMs += Math.abs(
        latencyMs - this.latencySamplesMs[this.latencySamplesMs.length - 1]
      );
    }
    this.latencySamplesMs.push(Math.round(latencyMs * 100) / 100);
    this.deliveredBytesTotal += packet.payloadSizeBytes;
    this.queueDelaySumMs += packet.queueDelayMs || 0;
    this.txDelaySumMs += packet.txDelayMs || 0;
    this.gatewayDelaySumMs += packet.gatewayDelayMs || 0;

    this.metrics.hopCountHistogram[packet.hops] =
      (this.metrics.hopCountHistogram[packet.hops] || 0) + 1;

    const dstDomStat = this.domainPacketStats.get(packet.submeshDst) || {
      originated: 0,
      delivered: 0,
      dropped: 0,
    };
    dstDomStat.delivered++;
    this.domainPacketStats.set(packet.submeshDst, dstDomStat);

    this.activePackets.delete(packetId);
    this.packetHistory.unshift(clonePacket(packet));
    if (this.packetHistory.length > 100) this.packetHistory.pop();

    this.recordPdrPoint(timestampMs);
    this.updateAllTelemetry();

    this.addLog(
      `[Time ${timestampMs.toFixed(1)}ms] DELIVERED ${packet.id} to ${this.nodes.get(packet.dst)?.name} in ${packet.hops} hops (Latency: ${latencyMs.toFixed(2)}ms)`,
      'success',
      packetId,
      packet.dst
    );
  }

  private handlePacketDrop(packetId: string, reason: string, timestampMs: number) {
    const packet = this.activePackets.get(packetId);
    if (!packet || isPacketTerminalState(packet.state)) return;

    const currentNode = this.nodes.get(packet.currentHop);
    this.removeFromNodeQueue(currentNode, packetId);
    if (packet.currentLinkId) {
      const link = this.links.find(l => l.id === packet.currentLinkId);
      if (link) link.currentLoad = Math.max(0, link.currentLoad - 1);
    }

    packet.state = 'dropped';
    packet.droppedAtSimTime = timestampMs;
    packet.dropReason = reason;
    packet.nextHop = undefined;
    packet.currentLinkId = undefined;

    this.appendTimeline(packet, {
      stage: 'dropped',
      timestampMs,
      nodeId: packet.currentHop,
      hopIndex: packet.hops,
      details: `Dropped: ${reason}`,
    });

    this.metrics.totalPacketsDropped++;
    const reasonBucket = this.classifyDropReason(reason);
    if (!this.metrics.dropReasonCounts) this.metrics.dropReasonCounts = {};
    this.metrics.dropReasonCounts[reasonBucket] =
      (this.metrics.dropReasonCounts[reasonBucket] || 0) + 1;

    const srcDomStat = this.domainPacketStats.get(packet.submeshSrc) || {
      originated: 0,
      delivered: 0,
      dropped: 0,
    };
    srcDomStat.dropped++;
    this.domainPacketStats.set(packet.submeshSrc, srcDomStat);

    if (currentNode) {
      this.ensureNodeStat(currentNode).packetsDropped++;
    }

    this.activePackets.delete(packetId);
    this.packetHistory.unshift(clonePacket(packet));
    if (this.packetHistory.length > 100) this.packetHistory.pop();

    this.recordPdrPoint(timestampMs);
    this.updateAllTelemetry();

    this.addLog(
      `[Time ${timestampMs.toFixed(1)}ms] DROPPED ${packet.id} at ${currentNode?.name || 'unknown'}: ${reason}`,
      'error',
      packetId,
      packet.currentHop
    );
  }

  private classifyDropReason(reason: string): string {
    const r = reason.toLowerCase();
    if (r.includes('ttl')) return 'TTL Expired';
    if (r.includes('queue overflow')) return 'Queue Overflow';
    if (r.includes('jam')) return 'Channel Jammed';
    if (r.includes('collision')) return 'CSMA/CA Collision';
    if (r.includes('unreachable') || r.includes('no viable') || r.includes('no route') || r.includes('offline')) {
      return 'Destination Unreachable';
    }
    if (r.includes('severed') || r.includes('link')) return 'Link Failure';
    return 'RF Noise / PER';
  }

  private recordPdrPoint(timestampMs: number) {
    if (!this.metrics.pdrTimeSeries) this.metrics.pdrTimeSeries = [];
    const inj = this.metrics.totalPacketsInjected;
    const del = this.metrics.totalPacketsDelivered;
    const drp = this.metrics.totalPacketsDropped;
    const completed = del + drp;
    this.metrics.pdrTimeSeries.push({
      timestampMs: Math.round(timestampMs * 10) / 10,
      pdr: inj > 0 ? Math.round((del / inj) * 1000) / 10 : 100,
      completedPdr: completed > 0 ? Math.round((del / completed) * 1000) / 10 : 100,
      delivered: del,
      dropped: drp,
      injected: inj,
    });
    if (this.metrics.pdrTimeSeries.length > 200) {
      this.metrics.pdrTimeSeries.shift();
    }
  }

  private updateGatewayTelemetry() {
    for (const node of this.nodes.values()) {
      if (node.type === 'gateway') {
        const queueOccupancyPct =
          node.queueCapacity > 0
            ? Math.min((node.currentQueue.length / node.queueCapacity) * 100, 100)
            : 0;
        const busyTimeMs = this.gatewayBusyTimeMs.get(node.id) || 0;
        const busyPct =
          this.simTimeMs > 0 ? Math.min((busyTimeMs / this.simTimeMs) * 100, 100) : 0;
        this.metrics.gatewayLoadMap[node.id] =
          Math.round(Math.max(queueOccupancyPct, busyPct) * 10) / 10;
      }
    }
  }

  private updateAllTelemetry() {
    const inj = this.metrics.totalPacketsInjected;
    const del = this.metrics.totalPacketsDelivered;
    const drp = this.metrics.totalPacketsDropped;
    const completed = del + drp;

    this.metrics.inFlightPackets = this.activePackets.size;
    this.metrics.pdr = inj > 0 ? Math.round((del / inj) * 1000) / 10 : 100.0;
    this.metrics.completedPdr =
      completed > 0 ? Math.round((del / completed) * 1000) / 10 : 100.0;

    if (this.deliveredCount > 0) {
      this.metrics.averageLatencyMs =
        Math.round((this.latenciesSumMs / this.deliveredCount) * 100) / 100;
      this.metrics.minLatencyMs = Math.min(...this.latencySamplesMs);
      this.metrics.maxLatencyMs = Math.max(...this.latencySamplesMs);
      this.metrics.jitterMs =
        this.latencySamplesMs.length > 1
          ? Math.round((this.jitterDiffSumMs / (this.latencySamplesMs.length - 1)) * 100) / 100
          : 0;
      this.metrics.averageQueueDelayMs =
        Math.round((this.queueDelaySumMs / this.deliveredCount) * 100) / 100;
      this.metrics.averageTxDelayMs =
        Math.round((this.txDelaySumMs / this.deliveredCount) * 100) / 100;
      this.metrics.averageGatewayDelayMs =
        Math.round((this.gatewayDelaySumMs / this.deliveredCount) * 100) / 100;
    } else {
      this.metrics.averageLatencyMs = 0;
      this.metrics.minLatencyMs = 0;
      this.metrics.maxLatencyMs = 0;
      this.metrics.jitterMs = 0;
      this.metrics.averageQueueDelayMs = 0;
      this.metrics.averageTxDelayMs = 0;
      this.metrics.averageGatewayDelayMs = 0;
    }

    this.metrics.latencySamplesMs = [...this.latencySamplesMs];

    const durationSec = Math.max(this.simTimeMs / 1000, 0.001);
    this.metrics.throughputKbps =
      this.deliveredBytesTotal > 0
        ? Math.round(((this.deliveredBytesTotal * 8) / durationSec / 1000) * 100) / 100
        : 0;

    this.updateGatewayTelemetry();

    // Link & Channel utilization
    const linkUtilMap: Record<string, number> = {};
    for (const link of this.links) {
      const busy = this.linkBusyTimeMs.get(link.id) || 0;
      const pct = this.simTimeMs > 0 ? Math.min((busy / this.simTimeMs) * 100, 100) : 0;
      const rounded = Math.round(pct * 100) / 100;
      linkUtilMap[link.id] = rounded;
      link.utilizationPct = rounded;
    }
    this.metrics.linkUtilizationMap = linkUtilMap;

    const chanUtilMap: Record<string, number> = {};
    for (const [chKey, busy] of this.channelBusyTimeMs.entries()) {
      const pct = this.simTimeMs > 0 ? Math.min((busy / this.simTimeMs) * 100, 100) : 0;
      chanUtilMap[chKey] = Math.round(pct * 100) / 100;
    }
    this.metrics.channelUtilizationMap = chanUtilMap;

    // Per-node stats
    const perNode: Record<string, NodeTelemetryStat> = {};
    for (const n of this.nodes.values()) {
      const st = this.ensureNodeStat(n);
      perNode[n.id] = { ...st };
    }
    this.metrics.perNodeStats = perNode;

    // Per-domain stats
    const perDomain: Record<string, DomainTelemetryStat> = {};
    for (const sm of this.submeshes.values()) {
      const domNodes = Array.from(this.nodes.values()).filter(n => n.submeshId === sm.id);
      const domLinks = this.links.filter(l => {
        const u = this.nodes.get(l.source);
        const v = this.nodes.get(l.target);
        return u?.submeshId === sm.id || v?.submeshId === sm.id;
      });
      const avgSnr =
        domLinks.length > 0
          ? Math.round(
              (domLinks.reduce((s, l) => s + (l.snrDb || 0), 0) / domLinks.length) * 10
            ) / 10
          : 0;
      const pktStat = this.domainPacketStats.get(sm.id) || {
        originated: 0,
        delivered: 0,
        dropped: 0,
      };
      perDomain[sm.id] = {
        domainId: sm.id,
        name: sm.name,
        protocol: sm.protocol,
        packetsOriginated: pktStat.originated,
        packetsDelivered: pktStat.delivered,
        packetsDropped: pktStat.dropped,
        activeNodes: domNodes.filter(n => n.isAlive).length,
        totalNodes: domNodes.length,
        avgSnrDb: avgSnr,
      };
    }
    this.metrics.perDomainStats = perDomain;
  }

  public findLink(nodeAId: string, nodeBId: string): NetworkLink | null {
    for (const link of this.links) {
      if (
        (link.source === nodeAId && link.target === nodeBId) ||
        (link.source === nodeBId && link.target === nodeAId)
      ) {
        return link;
      }
    }
    return null;
  }

  // ==========================================
  // Fault Studio Actions
  // ==========================================

  public toggleKillNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.isAlive = !node.isAlive;
    if (node.isAlive) {
      this.faults.killedNodes.delete(nodeId);
      this.recordEvent({
        id: `EV-NREC-${nodeId}-${this.simTimeMs}`,
        timestamp: this.simTimeMs,
        type: 'NodeRecovered',
        data: { nodeId },
      });
    } else {
      this.faults.killedNodes.add(nodeId);
      // Drop any packets queued inside the killed node
      while (node.currentQueue.length > 0) {
        const qPkt = node.currentQueue.shift()!;
        this.handlePacketDrop(
          qPkt.id,
          `Node "${node.name}" crashed while packet was queued`,
          this.simTimeMs
        );
      }
      this.recordEvent({
        id: `EV-NFAIL-${nodeId}-${this.simTimeMs}`,
        timestamp: this.simTimeMs,
        type: 'NodeFailed',
        data: { nodeId },
      });
    }

    invalidateAodvRoutes(this.nodes, nodeId);
    for (const n of this.nodes.values()) {
      delete n.routingTable[nodeId];
    }
    const overhead = syncProtocolControlPlanes(
      this.nodes,
      this.links,
      this.submeshes,
      this.simTimeMs
    );
    this.metrics.protocolOverheadBytes += overhead;

    this.addLog(
      `[Fault Studio] Node ${node.name} is now ${node.isAlive ? 'ONLINE' : 'TERMINATED (OFFLINE)'}`,
      node.isAlive ? 'info' : 'warn',
      undefined,
      node.id
    );
    this.updateAllTelemetry();

    return node.isAlive;
  }

  public toggleSeverLink(linkId: string): boolean {
    const link = this.links.find(l => l.id === linkId);
    if (!link) return false;

    link.isSevered = !link.isSevered;
    if (link.isSevered) {
      this.faults.severedLinks.add(linkId);
      this.recordEvent({
        id: `EV-LFAIL-${linkId}-${this.simTimeMs}`,
        timestamp: this.simTimeMs,
        type: 'LinkFailed',
        data: { linkId, source: link.source, target: link.target },
      });
    } else {
      this.faults.severedLinks.delete(linkId);
      this.recordEvent({
        id: `EV-LREC-${linkId}-${this.simTimeMs}`,
        timestamp: this.simTimeMs,
        type: 'LinkRecovered',
        data: { linkId, source: link.source, target: link.target },
      });
    }

    invalidateAodvRoutes(this.nodes, undefined, {
      source: link.source,
      target: link.target,
    });
    const overhead = syncProtocolControlPlanes(
      this.nodes,
      this.links,
      this.submeshes,
      this.simTimeMs
    );
    this.metrics.protocolOverheadBytes += overhead;

    this.addLog(
      `[Fault Studio] Link ${link.source} <-> ${link.target} ${link.isSevered ? 'SEVERED' : 'RESTORED'}`,
      link.isSevered ? 'warn' : 'info'
    );

    return link.isSevered;
  }

  public failGateway(gatewayId: string, interfaceId?: string): boolean {
    const gw = this.nodes.get(gatewayId);
    if (!gw || gw.type !== 'gateway') return false;

    if (interfaceId) {
      const iface = gw.interfaces.find(i => i.id === interfaceId);
      if (!iface) return false;
      iface.isUp = false;
      this.faults.failedGatewayInterfaces?.add(`${gatewayId}:${interfaceId}`);
      this.recordEvent({
        id: `EV-GWIFFAIL-${gatewayId}-${interfaceId}-${this.simTimeMs}`,
        timestamp: this.simTimeMs,
        type: 'LinkFailed',
        data: { gatewayId, interfaceId },
      });
      this.addLog(
        `[Fault Studio] Gateway ${gw.name} interface ${interfaceId} (${iface.frequencyBand} CH${iface.channel}) FAILED.`,
        'warn',
        undefined,
        gatewayId
      );
    } else {
      if (gw.isAlive) {
        this.toggleKillNode(gatewayId);
      }
    }

    invalidateAodvRoutes(this.nodes, gatewayId);
    const overhead = syncProtocolControlPlanes(
      this.nodes,
      this.links,
      this.submeshes,
      this.simTimeMs
    );
    this.metrics.protocolOverheadBytes += overhead;
    this.updateAllTelemetry();
    return true;
  }

  public restoreGateway(gatewayId: string, interfaceId?: string): boolean {
    const gw = this.nodes.get(gatewayId);
    if (!gw) return false;

    if (!gw.isAlive) {
      gw.isAlive = true;
      this.faults.killedNodes.delete(gatewayId);
      this.recordEvent({
        id: `EV-GWREC-${gatewayId}-${this.simTimeMs}`,
        timestamp: this.simTimeMs,
        type: 'NodeRecovered',
        data: { nodeId: gatewayId },
      });
    }

    for (const iface of gw.interfaces) {
      if (!interfaceId || iface.id === interfaceId) {
        iface.isUp = true;
        this.faults.failedGatewayInterfaces?.delete(`${gatewayId}:${iface.id}`);
      }
    }

    const overhead = syncProtocolControlPlanes(
      this.nodes,
      this.links,
      this.submeshes,
      this.simTimeMs
    );
    this.metrics.protocolOverheadBytes += overhead;
    this.addLog(
      `[Fault Studio] Gateway ${gw.name} restored${interfaceId ? ` (${interfaceId})` : ' (all interfaces UP)'}.`,
      'info',
      undefined,
      gatewayId
    );
    this.updateAllTelemetry();
    return true;
  }

  public toggleJamChannel(band: FrequencyBand, channel?: number): boolean {
    if (channel !== undefined) {
      const chKey = `${band}:${channel}`;
      const nowJammed = !this.faults.jammedChannels?.has(chKey);
      if (nowJammed) {
        this.faults.jammedChannels?.add(chKey);
      } else {
        this.faults.jammedChannels?.delete(chKey);
      }

      let affected = 0;
      for (const link of this.links) {
        const ctx = resolveLinkChannelContext(link, this.nodes, this.submeshes);
        if (ctx.frequencyBand === band && ctx.channel === channel) {
          link.isJammed = nowJammed || this.faults.jammedFrequencies.has(band);
          affected++;
        }
      }

      this.refreshLinkProperties();
      const overhead = syncProtocolControlPlanes(
        this.nodes,
        this.links,
        this.submeshes,
        this.simTimeMs
      );
      this.metrics.protocolOverheadBytes += overhead;

      this.recordEvent({
        id: `EV-JAM-${chKey}-${this.simTimeMs}`,
        timestamp: this.simTimeMs,
        type: nowJammed ? 'ChannelJammed' : 'ChannelUnjammed',
        data: { band, channel, affected },
      });

      this.addLog(
        `[Fault Studio] ${band} CH${channel} ${nowJammed ? 'JAMMED' : 'UNJAMMED'} (${affected} links affected).`,
        nowJammed ? 'warn' : 'info'
      );
      return nowJammed;
    }

    const nowJammed = !this.faults.jammedFrequencies.has(band);
    if (nowJammed) {
      this.faults.jammedFrequencies.add(band);
    } else {
      this.faults.jammedFrequencies.delete(band);
    }

    let affected = 0;
    for (const link of this.links) {
      const ctx = resolveLinkChannelContext(link, this.nodes, this.submeshes);
      const srcNode = this.nodes.get(link.source);
      const dstNode = this.nodes.get(link.target);
      const srcSm = srcNode ? this.submeshes.get(srcNode.submeshId) : undefined;
      const dstSm = dstNode ? this.submeshes.get(dstNode.submeshId) : undefined;
      if (
        ctx.frequencyBand === band ||
        srcSm?.frequencyBand === band ||
        dstSm?.frequencyBand === band
      ) {
        const chKey = `${ctx.frequencyBand}:${ctx.channel}`;
        link.isJammed = nowJammed || Boolean(this.faults.jammedChannels?.has(chKey));
        affected++;
      }
    }

    this.refreshLinkProperties();
    const overhead = syncProtocolControlPlanes(
      this.nodes,
      this.links,
      this.submeshes,
      this.simTimeMs
    );
    this.metrics.protocolOverheadBytes += overhead;

    this.recordEvent({
      id: `EV-JAM-${band}-${this.simTimeMs}`,
      timestamp: this.simTimeMs,
      type: nowJammed ? 'ChannelJammed' : 'ChannelUnjammed',
      data: { band, affected },
    });

    this.addLog(
      `[Fault Studio] RF Band ${band} ${nowJammed ? 'JAMMED' : 'UNJAMMED'} (${affected} links affected).`,
      nowJammed ? 'warn' : 'info'
    );
    return nowJammed;
  }

  public toggleJamFrequency(band: string): boolean {
    return this.toggleJamChannel(band as FrequencyBand);
  }

  public restoreAllFaults(): void {
    this.faults.killedNodes.clear();
    this.faults.severedLinks.clear();
    this.faults.jammedFrequencies.clear();
    this.faults.jammedChannels?.clear();
    this.faults.failedGatewayInterfaces?.clear();

    for (const node of this.nodes.values()) {
      node.isAlive = true;
      for (const iface of node.interfaces) {
        iface.isUp = true;
      }
    }

    for (const link of this.links) {
      link.isSevered = false;
      link.isJammed = false;
    }

    this.refreshLinkProperties();
    const overhead = syncProtocolControlPlanes(
      this.nodes,
      this.links,
      this.submeshes,
      this.simTimeMs
    );
    this.metrics.protocolOverheadBytes += overhead;
    this.updateAllTelemetry();
    this.addLog('[Fault Studio] All faults cleared: nodes, links, gateways & RF bands restored.', 'success');
  }

  // ==========================================
  // Dynamic Network Builder & Validation APIs
  // ==========================================

  public validateCurrentTopology(): TopologyValidationResult {
    return validateTopology(this.submeshes, this.nodes, this.links);
  }

  public addNodeValidated(
    node: MeshNode,
    autoConnectNearest: boolean = false
  ): { ok: boolean; node?: MeshNode; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!node.id || !node.id.trim()) {
      errors.push('Node ID must be non-empty.');
    } else if (this.nodes.has(node.id)) {
      errors.push(`Duplicate node ID "${node.id}".`);
    }

    const normName = (node.name || '').trim().toLowerCase();
    if (!normName) {
      errors.push('Node name must be non-empty.');
    } else {
      for (const existing of this.nodes.values()) {
        if (existing.name.trim().toLowerCase() === normName) {
          errors.push(`Duplicate node name "${node.name}".`);
          break;
        }
      }
    }

    if (!this.submeshes.has(node.submeshId)) {
      errors.push(`Sub-mesh domain "${node.submeshId}" does not exist.`);
    }
    if (!Number.isFinite(node.txPowerDbm) || node.txPowerDbm <= -30 || node.txPowerDbm > 40) {
      errors.push(`Invalid TX power (${node.txPowerDbm} dBm); expected (-30, 40].`);
    }
    if (!Number.isFinite(node.queueCapacity) || node.queueCapacity <= 0) {
      errors.push(`Invalid queueCapacity (${node.queueCapacity}); must be > 0.`);
    }

    if (errors.length > 0) {
      this.lastValidationError = errors[0];
      return { ok: false, errors, warnings };
    }

    const created = this.addNode(node, autoConnectNearest);
    if (created.type === 'gateway' && created.interfaces.length < 2) {
      warnings.push('Gateway created with <2 radio interfaces; assign a second domain interface.');
    }
    return { ok: true, node: created, errors: [], warnings };
  }

  public addNode(node: MeshNode, autoConnectNearest: boolean = false): MeshNode {
    const preparedNode: MeshNode = {
      ...cloneNode(node),
      isAlive: node.isAlive !== undefined ? node.isAlive : true,
      isMultiRadio: node.isMultiRadio ?? node.interfaces.length >= 2,
    };
    this.nodes.set(preparedNode.id, preparedNode);
    this.ensureNodeStat(preparedNode);

    if (autoConnectNearest && this.nodes.size > 1) {
      let nearest: MeshNode | null = null;
      let minDistance = Infinity;

      for (const other of this.nodes.values()) {
        if (other.id === preparedNode.id) continue;
        // Prefer same-domain or gateway connections when auto-connecting
        const connCheck = validateLinkConnection(
          preparedNode,
          other,
          this.submeshes,
          this.links
        );
        if (!connCheck.valid) continue;
        const d = Math.hypot(
          other.position.x - preparedNode.position.x,
          other.position.y - preparedNode.position.y
        );
        if (d < minDistance) {
          minDistance = d;
          nearest = other;
        }
      }

      if (nearest) {
        this.addLink(preparedNode.id, nearest.id);
      }
    }

    this.refreshLinkProperties();
    syncProtocolControlPlanes(this.nodes, this.links, this.submeshes, this.simTimeMs);
    this.updateAllTelemetry();
    this.addLog(
      `[Builder] Added node "${preparedNode.name}" (${preparedNode.type}) at (${Math.round(preparedNode.position.x)}, ${Math.round(preparedNode.position.y)})`,
      'info',
      undefined,
      preparedNode.id
    );
    return preparedNode;
  }

  public renameNode(nodeId: string, newName: string): { ok: boolean; error?: string } {
    const node = this.nodes.get(nodeId);
    if (!node) return { ok: false, error: `Node "${nodeId}" not found.` };

    const trimmed = newName.trim();
    if (!trimmed) return { ok: false, error: 'Node name cannot be empty.' };

    for (const other of this.nodes.values()) {
      if (other.id !== nodeId && other.name.trim().toLowerCase() === trimmed.toLowerCase()) {
        return { ok: false, error: `Duplicate node name "${trimmed}".` };
      }
    }

    const oldName = node.name;
    node.name = trimmed;
    this.ensureNodeStat(node);
    this.addLog(`[Builder] Renamed "${oldName}" -> "${trimmed}".`, 'info', undefined, nodeId);
    return { ok: true };
  }

  public assignNodeDomain(nodeId: string, submeshId: string): { ok: boolean; error?: string } {
    const node = this.nodes.get(nodeId);
    if (!node) return { ok: false, error: `Node "${nodeId}" not found.` };
    const sm = this.submeshes.get(submeshId);
    if (!sm) return { ok: false, error: `Sub-mesh domain "${submeshId}" not found.` };

    node.submeshId = submeshId;
    if (node.type !== 'gateway' && node.interfaces.length > 0) {
      node.interfaces[0] = {
        ...node.interfaces[0],
        submeshId,
        frequencyBand: sm.frequencyBand,
        channel: sm.channelNumber,
        bandwidthMbps:
          sm.defaultBandwidthMbps ??
          (node.type === 'sensor' || node.type === 'end_device' ? 0.25 : 54),
      };
    } else if (node.type === 'gateway') {
      const hasIface = resolveActiveInterfaceForSubmesh(node, sm);
      if (!hasIface && node.interfaces.length > 0) {
        node.interfaces[0] = {
          ...node.interfaces[0],
          submeshId,
          frequencyBand: sm.frequencyBand,
          channel: sm.channelNumber,
        };
      }
    }

    this.refreshLinkProperties();
    syncProtocolControlPlanes(this.nodes, this.links, this.submeshes, this.simTimeMs);
    this.updateAllTelemetry();
    this.addLog(
      `[Builder] Assigned "${node.name}" to domain "${sm.name}" (${sm.protocol}).`,
      'info',
      undefined,
      nodeId
    );
    return { ok: true };
  }

  public updateGatewayInterfaces(
    nodeId: string,
    interfaces: NetworkInterface[]
  ): { ok: boolean; errors: string[] } {
    const node = this.nodes.get(nodeId);
    if (!node) return { ok: false, errors: [`Node "${nodeId}" not found.`] };
    if (node.type !== 'gateway') {
      return { ok: false, errors: [`Node "${node.name}" is not a gateway.`] };
    }

    const errors: string[] = [];
    const seenIds = new Set<string>();
    const coveredSubmeshes = new Set<string>();

    for (const iface of interfaces) {
      if (!iface.id || seenIds.has(iface.id)) {
        errors.push(`Duplicate or empty interface ID "${iface.id}".`);
      }
      seenIds.add(iface.id);
      if (!isValidChannelForBand(iface.frequencyBand, iface.channel)) {
        errors.push(`Invalid channel ${iface.channel} for band ${iface.frequencyBand} on interface "${iface.id}".`);
      }
      if (!Number.isFinite(iface.bandwidthMbps) || iface.bandwidthMbps <= 0) {
        errors.push(`Invalid bandwidthMbps (${iface.bandwidthMbps}) on interface "${iface.id}".`);
      }
      if (iface.submeshId) {
        if (!this.submeshes.has(iface.submeshId)) {
          errors.push(`Interface "${iface.id}" references unknown sub-mesh "${iface.submeshId}".`);
        } else if (iface.isUp !== false) {
          coveredSubmeshes.add(iface.submeshId);
        }
      }
    }

    if (interfaces.filter(i => i.isUp !== false).length < 2 || coveredSubmeshes.size < 2) {
      errors.push('Gateway requires at least 2 active interfaces bound to distinct sub-mesh domains.');
    }

    if (errors.length > 0) {
      return { ok: false, errors };
    }

    node.interfaces = interfaces.map(i => ({ ...i }));
    node.isMultiRadio = interfaces.length >= 2;

    this.faults.failedGatewayInterfaces = new Set(
      Array.from(this.faults.failedGatewayInterfaces || []).filter(
        k => !k.startsWith(`${nodeId}:`)
      )
    );
    for (const iface of node.interfaces) {
      if (iface.isUp === false) {
        this.faults.failedGatewayInterfaces.add(`${nodeId}:${iface.id}`);
      }
    }

    this.refreshLinkProperties();
    syncProtocolControlPlanes(this.nodes, this.links, this.submeshes, this.simTimeMs);
    this.updateAllTelemetry();
    this.addLog(
      `[Builder] Updated gateway "${node.name}" interfaces (${node.interfaces.length} NICs).`,
      'info',
      undefined,
      nodeId
    );
    return { ok: true, errors: [] };
  }

  public removeNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    const originalLinkCount = this.links.length;
    this.links = this.links.filter(l => l.source !== nodeId && l.target !== nodeId);
    const removedLinks = originalLinkCount - this.links.length;

    // Drop any queued packets at removed node
    while (node.currentQueue.length > 0) {
      const pkt = node.currentQueue.shift()!;
      this.handlePacketDrop(pkt.id, `Node "${node.name}" deleted`, this.simTimeMs);
    }

    this.nodes.delete(nodeId);
    this.faults.killedNodes.delete(nodeId);
    this.nodeStatsMap.delete(nodeId);

    for (const n of this.nodes.values()) {
      delete n.routingTable[nodeId];
    }

    syncProtocolControlPlanes(this.nodes, this.links, this.submeshes, this.simTimeMs);
    this.updateAllTelemetry();
    this.addLog(
      `[Builder] Removed node "${node.name}" and ${removedLinks} connected link(s).`,
      'warn'
    );
    return true;
  }

  public addLinkValidated(
    sourceId: string,
    targetId: string,
    bandwidthMbps?: number
  ): { ok: boolean; link?: NetworkLink; reason?: string } {
    const srcNode = this.nodes.get(sourceId);
    const dstNode = this.nodes.get(targetId);

    const check = validateLinkConnection(srcNode, dstNode, this.submeshes, this.links);
    if (!check.valid) {
      this.lastValidationError = check.reason || 'Invalid link connection';
      this.addLog(`[Builder] ${this.lastValidationError}`, 'warn');
      return { ok: false, reason: check.reason };
    }

    if (bandwidthMbps !== undefined && (!Number.isFinite(bandwidthMbps) || bandwidthMbps <= 0)) {
      const reason = `Invalid link bandwidth (${bandwidthMbps} Mbps); must be > 0.`;
      this.lastValidationError = reason;
      return { ok: false, reason };
    }

    this.lastValidationError = null;
    const created = this.createValidatedLink(srcNode!, dstNode!, bandwidthMbps);
    return { ok: true, link: created };
  }

  /**
   * Creates an RF-evaluated wireless link between two nodes.
   * Returns null when connection is invalid or duplicate (never returns existing duplicate as success).
   */
  public addLink(
    sourceId: string,
    targetId: string,
    bandwidthMbps?: number
  ): NetworkLink | null {
    const res = this.addLinkValidated(sourceId, targetId, bandwidthMbps);
    return res.ok && res.link ? res.link : null;
  }

  private createValidatedLink(
    srcNode: MeshNode,
    dstNode: MeshNode,
    bandwidthMbps?: number
  ): NetworkLink {
    const srcSm = this.submeshes.get(srcNode.submeshId);
    const dstSm = this.submeshes.get(dstNode.submeshId);
    const activeSm =
      srcNode.type === 'gateway' && dstSm ? dstSm : srcSm || dstSm;

    const srcIface = activeSm ? resolveActiveInterfaceForSubmesh(srcNode, activeSm) : srcNode.interfaces[0];
    const dstIface = activeSm ? resolveActiveInterfaceForSubmesh(dstNode, activeSm) : dstNode.interfaces[0];

    const freqBand: FrequencyBand =
      activeSm?.frequencyBand || srcIface?.frequencyBand || '2.4GHz';
    const channel = activeSm?.channelNumber ?? srcIface?.channel ?? 6;
    const freqGhz = frequencyBandToGhz(freqBand);
    const txPower = Math.min(
      srcIface?.txPowerDbm ?? srcNode.txPowerDbm,
      dstIface?.txPowerDbm ?? dstNode.txPowerDbm
    );

    const chKey = `${freqBand}:${channel}`;
    const isJammed =
      this.faults.jammedFrequencies.has(freqBand) ||
      Boolean(this.faults.jammedChannels?.has(chKey));

    const evalResult = evaluatePhysicalLink(
      srcNode.position,
      dstNode.position,
      txPower,
      freqGhz,
      this.config,
      {
        channelWidthMhz: activeSm?.channelWidthMhz ?? 20,
        noiseFloorDbm: this.config.noiseFloorDbm,
        rxSensitivityDbm: Math.max(
          srcNode.receiverSensitivityDbm ?? this.config.rxSensitivityDbm ?? -90,
          dstNode.receiverSensitivityDbm ?? this.config.rxSensitivityDbm ?? -90
        ),
        prng: this.prng,
        isJammed,
      }
    );

    const ifaceBw = Math.min(
      srcIface?.bandwidthMbps ?? Infinity,
      dstIface?.bandwidthMbps ?? Infinity
    );
    const defaultBw =
      Number.isFinite(ifaceBw) && ifaceBw > 0
        ? ifaceBw
        : activeSm?.defaultBandwidthMbps ??
          (srcNode.type === 'sensor' ||
          dstNode.type === 'sensor' ||
          srcNode.type === 'end_device' ||
          dstNode.type === 'end_device'
            ? 0.25
            : 54);
    const finalBandwidth =
      bandwidthMbps !== undefined && bandwidthMbps > 0 ? bandwidthMbps : defaultBw;

    this.linkIdCounter++;
    const newLink: NetworkLink = {
      id: `link_${srcNode.id}_${dstNode.id}_${this.linkIdCounter}`,
      source: srcNode.id,
      target: dstNode.id,
      bandwidthMbps: finalBandwidth,
      lossRate: evalResult.per,
      per: evalResult.per,
      distanceMeters: evalResult.distanceMeters,
      snrDb: evalResult.snrDb,
      rxPowerDbm: evalResult.rxPowerDbm,
      isViable: evalResult.isViable,
      isSevered: false,
      isJammed,
      frequencyBand: freqBand,
      channel,
      currentLoad: 0,
      traversalCount: 0,
    };

    this.links.push(newLink);
    syncProtocolControlPlanes(this.nodes, this.links, this.submeshes, this.simTimeMs);
    this.updateAllTelemetry();

    this.addLog(
      `[Builder] Linked ${srcNode.name} ↔ ${dstNode.name} (${freqBand} CH${channel}, Dist: ${evalResult.distanceMeters.toFixed(1)}m, SNR: ${evalResult.snrDb.toFixed(1)} dB, PER: ${(newLink.per * 100).toFixed(1)}%)`,
      'info'
    );

    return newLink;
  }

  public removeLink(linkId: string): boolean {
    const idx = this.links.findIndex(l => l.id === linkId);
    if (idx === -1) return false;

    const link = this.links[idx];
    this.links.splice(idx, 1);
    this.faults.severedLinks.delete(linkId);
    invalidateAodvRoutes(this.nodes, undefined, {
      source: link.source,
      target: link.target,
    });
    syncProtocolControlPlanes(this.nodes, this.links, this.submeshes, this.simTimeMs);
    this.updateAllTelemetry();
    this.addLog(`[Builder] Deleted link ${link.source} ↔ ${link.target}`, 'info');
    return true;
  }

  public addSubMesh(domain: SubMeshDomain): SubMeshDomain {
    this.submeshes.set(domain.id, { ...domain });
    this.initTelemetryMaps();
    this.updateAllTelemetry();
    this.addLog(
      `[Builder] Added Sub-Mesh domain "${domain.name}" [${domain.protocol} / ${domain.frequencyBand}]`,
      'info'
    );
    return domain;
  }

  public removeSubMesh(submeshId: string): boolean {
    if (!this.submeshes.has(submeshId)) return false;
    const sm = this.submeshes.get(submeshId)!;
    this.submeshes.delete(submeshId);
    this.domainPacketStats.delete(submeshId);
    this.updateAllTelemetry();
    this.addLog(`[Builder] Removed Sub-Mesh domain "${sm.name}"`, 'warn');
    return true;
  }

  public clearCanvas(keepSubmeshes: boolean = true) {
    this.resetSimulation({ clearFaults: true, preserveSeed: true });
    this.nodes.clear();
    this.links = [];
    this.workloadHistory = [];
    if (!keepSubmeshes) {
      this.submeshes.clear();
    }
    this.updateAllTelemetry();
    this.addLog('[Builder] Canvas cleared: All nodes and links removed.', 'warn');
  }

  // ==========================================
  // Lossless JSON Export / Import & Storage
  // ==========================================

  private serializeFaults(): SerializedFaultState {
    const jammedChannels: Array<{ band: FrequencyBand; channel: number }> = [];
    for (const key of this.faults.jammedChannels || []) {
      const [band, chStr] = key.split(':');
      const ch = Number(chStr);
      if (band && Number.isFinite(ch)) {
        jammedChannels.push({ band: band as FrequencyBand, channel: ch });
      }
    }
    return {
      killedNodes: Array.from(this.faults.killedNodes),
      severedLinks: Array.from(this.faults.severedLinks),
      jammedFrequencies: Array.from(this.faults.jammedFrequencies),
      jammedChannels,
      failedGatewayInterfaces: Array.from(this.faults.failedGatewayInterfaces || []),
    };
  }

  public saveToLocalStorage(key: string = 'multimesh_custom_network'): boolean {
    try {
      const data = this.exportTopologyJSON('Custom Multi-Mesh User Topology');
      localStorage.setItem(key, JSON.stringify(data));
      this.addLog(
        `[Storage] Saved network snapshot (${this.nodes.size} nodes, ${this.links.length} links) to "${key}".`,
        'success'
      );
      return true;
    } catch (err) {
      this.addLog(`[Storage] Failed to save to localStorage: ${String(err)}`, 'error');
      return false;
    }
  }

  public loadFromLocalStorage(key: string = 'multimesh_custom_network'): boolean {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        this.addLog(`[Storage] No saved network found under key "${key}".`, 'warn');
        return false;
      }
      return this.importTopologyJSON(raw);
    } catch (err) {
      this.addLog(`[Storage] Failed to load from localStorage: ${String(err)}`, 'error');
      return false;
    }
  }

  public exportTopologyJSON(
    scenarioTitle: string = 'Custom Multi-Mesh Network'
  ): TopologyExportJSON {
    return {
      simulatorConfig: { ...this.config },
      submeshes: Array.from(this.submeshes.values()).map(s => ({ ...s })),
      nodes: Array.from(this.nodes.values()).map(n => ({
        ...n,
        position: { ...n.position },
        velocity: n.velocity ? { ...n.velocity } : undefined,
        mobilityBounds: n.mobilityBounds ? { ...n.mobilityBounds } : undefined,
        waypointTarget: n.waypointTarget ? { ...n.waypointTarget } : n.waypointTarget,
        currentQueue: n.currentQueue.map(clonePacket),
        interfaces: n.interfaces.map(i => ({ ...i })),
        mprNeighbors: n.mprNeighbors ? [...n.mprNeighbors] : undefined,
        routingTable: { ...n.routingTable },
      })),
      links: this.links.map(l => ({ ...l })),
      faults: this.serializeFaults(),
      runtimeState: {
        simTimeMs: this.simTimeMs,
        seed: this.config.seed,
        prngState: this.prng.getState(),
        packetIdCounter: this.packetIdCounter,
        workload: this.workloadHistory.map(w => ({ ...w })),
      },
      meta: {
        exportedAt: `simTime:${this.simTimeMs}ms`,
        version: '2.0.0',
        scenarioTitle,
        authors: ['User Network Architect'],
      },
    };
  }

  public importTopologyJSONValidated(
    data: TopologyExportJSON | string
  ): ImportTopologyResult {
    try {
      const parsed: TopologyExportJSON =
        typeof data === 'string' ? JSON.parse(data) : data;
      if (
        !parsed ||
        !Array.isArray(parsed.nodes) ||
        !Array.isArray(parsed.links) ||
        !Array.isArray(parsed.submeshes)
      ) {
        const err = 'Invalid topology JSON schema: missing submeshes, nodes, or links arrays.';
        this.addLog(`[Builder] ${err}`, 'error');
        return { ok: false, errors: [err], warnings: [] };
      }

      const validation = validateTopology(parsed.submeshes, parsed.nodes, parsed.links, {
        allowEmpty: false,
      });

      if (!validation.valid) {
        this.lastValidationError = validation.errors[0];
        this.addLog(
          `[Builder] Topology import rejected: ${validation.errors.join('; ')}`,
          'error'
        );
        return { ok: false, errors: validation.errors, warnings: validation.warnings };
      }

      if (parsed.simulatorConfig) {
        this.config = { ...DEFAULT_CONFIG, ...parsed.simulatorConfig };
        this.speedMultiplier = this.config.simSpeedMultiplier || 1.0;
        this.setSeed(this.config.seed);
      }

      this.loadTopology(parsed.submeshes, parsed.nodes, parsed.links, {
        preserveExportedLinkMetrics: true,
      });

      // Restore serialized fault state
      if (parsed.faults) {
        for (const nid of parsed.faults.killedNodes || []) {
          const n = this.nodes.get(nid);
          if (n) {
            n.isAlive = false;
            this.faults.killedNodes.add(nid);
          }
        }
        for (const lid of parsed.faults.severedLinks || []) {
          const l = this.links.find(lk => lk.id === lid);
          if (l) {
            l.isSevered = true;
            this.faults.severedLinks.add(lid);
          }
        }
        for (const band of parsed.faults.jammedFrequencies || []) {
          this.faults.jammedFrequencies.add(band);
        }
        for (const ch of parsed.faults.jammedChannels || []) {
          this.faults.jammedChannels?.add(`${ch.band}:${ch.channel}`);
        }
        for (const gwIfaceKey of parsed.faults.failedGatewayInterfaces || []) {
          this.faults.failedGatewayInterfaces?.add(gwIfaceKey);
          const [gwId, ifaceId] = gwIfaceKey.split(':');
          const gw = this.nodes.get(gwId);
          const iface = gw?.interfaces.find(i => i.id === ifaceId);
          if (iface) iface.isUp = false;
        }
        for (const link of this.links) {
          const ctx = resolveLinkChannelContext(link, this.nodes, this.submeshes);
          const chKey = `${ctx.frequencyBand}:${ctx.channel}`;
          if (
            this.faults.jammedFrequencies.has(ctx.frequencyBand) ||
            this.faults.jammedChannels?.has(chKey)
          ) {
            link.isJammed = true;
          }
        }
      }

      // Restore runtime snapshot for lossless round-trip
      if (parsed.runtimeState) {
        this.simTimeMs = parsed.runtimeState.simTimeMs ?? 0;
        this.lastMobilityTickMs = this.simTimeMs;
        if (parsed.runtimeState.seed !== undefined) {
          this.setSeed(parsed.runtimeState.seed);
        }
        if (parsed.runtimeState.prngState !== undefined) {
          this.prng.setState(parsed.runtimeState.prngState);
        }
        if (parsed.runtimeState.packetIdCounter !== undefined) {
          this.packetIdCounter = parsed.runtimeState.packetIdCounter;
        }
        if (Array.isArray(parsed.runtimeState.workload)) {
          this.workloadHistory = parsed.runtimeState.workload.map(w => ({ ...w }));
        }
      }

      this.lastValidationError = null;
      this.updateAllTelemetry();
      this.addLog(
        `[Builder] Imported topology "${parsed.meta?.scenarioTitle || 'Network'}" (${parsed.nodes.length} nodes).`,
        'success'
      );
      return { ok: true, errors: [], warnings: validation.warnings };
    } catch (err) {
      const msg = `Error parsing topology JSON: ${String(err)}`;
      this.addLog(`[Builder] ${msg}`, 'error');
      return { ok: false, errors: [msg], warnings: [] };
    }
  }

  public importTopologyJSON(data: TopologyExportJSON | string): boolean {
    return this.importTopologyJSONValidated(data).ok;
  }

  public addLog(
    message: string,
    level: SimulationStepLog['level'] = 'info',
    packetId?: string,
    nodeId?: string
  ) {
    this.logs.unshift({
      timestamp: this.simTimeMs,
      message,
      level,
      packetId,
      nodeId,
    });

    if (this.logs.length > 250) {
      this.logs.pop();
    }
  }
}
