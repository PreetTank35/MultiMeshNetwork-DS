/**
 * Discrete-Event Simulation Engine
 * High-performance non-blocking event-driven kernel
 * Implements Chapters 3.3, 5.1, 5.4 from the MIT AOE Project Specification
 */

import {
  FaultState,
  MeshNode,
  NetworkLink,
  Packet,
  SimulationConfig,
  SimulationEvent,
  SubMeshDomain,
  TelemetryMetrics,
  TopologyExportJSON
} from '../../types/simulator';
import { calculateDistance, evaluatePhysicalLink } from '../math/rfPropagation';
import { calculateMultiMeshRoute } from '../protocols/routing';
import { translatePacketHeader, HeaderTranslationTrace } from '../protocols/gateway';

export interface VisualParticle {
  packetId: string;
  sourceNodeId: string;
  targetNodeId: string;
  progress: number; // 0.0 to 1.0 between current hop and next hop
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

export class DiscreteEventEngine {
  public simTimeMs: number = 0;
  public isRunning: boolean = false;
  public speedMultiplier: number = 1.0;
  public config: SimulationConfig;

  public nodes: Map<string, MeshNode> = new Map();
  public links: NetworkLink[] = [];
  public submeshes: Map<string, SubMeshDomain> = new Map();

  // Active in-flight packets & retained history
  public activePackets: Map<string, Packet> = new Map();
  public packetHistory: Packet[] = [];
  public eventQueue: SimulationEvent[] = [];
  public logs: SimulationStepLog[] = [];
  public translationTraces: HeaderTranslationTrace[] = [];

  // Telemetry metrics
  public metrics: TelemetryMetrics = {
    totalPacketsInjected: 0,
    totalPacketsDelivered: 0,
    totalPacketsDropped: 0,
    pdr: 100.0,
    averageLatencyMs: 0.0,
    hopCountHistogram: {},
    throughputKbps: 0.0,
    gatewayLoadMap: {},
    protocolOverheadBytes: 0,
  };

  private latenciesSumMs: number = 0;
  private deliveredCount: number = 0;
  private packetIdCounter: number = 1000;

  constructor(config?: Partial<SimulationConfig>) {
    this.config = {
      tickRateMs: 50,
      simSpeedMultiplier: 1.0,
      pathLossModel: 'LogDistance',
      pathLossExponent: 2.8,
      shadowingStdDevDb: 0.0,
      referenceDistanceMeters: 1.0,
      noiseFloorDbm: -95.0,
      carrierFreqGhz: 2.4,
      ...config
    };
  }

  public loadTopology(
    submeshes: SubMeshDomain[],
    nodes: MeshNode[],
    links: NetworkLink[]
  ) {
    this.resetSimulation();
    this.submeshes.clear();
    this.nodes.clear();
    this.links = [];

    for (const sm of submeshes) {
      this.submeshes.set(sm.id, sm);
    }

    for (const n of nodes) {
      this.nodes.set(n.id, {
        ...n,
        currentQueue: [],
        routingTable: {},
        isAlive: n.isAlive !== undefined ? n.isAlive : true
      });
    }

    this.links = links.map(l => ({
      ...l,
      currentLoad: 0,
      traversalCount: 0,
      isSevered: l.isSevered || false,
      isJammed: l.isJammed || false
    }));

    // Recompute link RF physical parameters
    this.refreshLinkProperties();

    this.addLog(`Topology loaded successfully: ${nodes.length} nodes across ${submeshes.length} sub-mesh domains.`, 'info');
  }

  public refreshLinkProperties() {
    for (const link of this.links) {
      const srcNode = this.nodes.get(link.source);
      const dstNode = this.nodes.get(link.target);
      if (!srcNode || !dstNode) continue;

      const submesh = this.submeshes.get(srcNode.submeshId);
      const freqGhz = submesh?.frequencyBand === '5.2GHz' ? 5.2
        : submesh?.frequencyBand === '5.8GHz' ? 5.8
        : submesh?.frequencyBand === '915MHz' ? 0.915
        : submesh?.frequencyBand === '868MHz' ? 0.868
        : 2.4;

      const evalResult = evaluatePhysicalLink(
        srcNode.position,
        dstNode.position,
        srcNode.txPowerDbm,
        freqGhz,
        this.config
      );

      link.distanceMeters = evalResult.distanceMeters;
      link.snrDb = evalResult.snrDb;
      link.lossRate = Math.min(Math.max(evalResult.per, 0.005), 0.95);
      link.per = link.lossRate;
    }
  }

  public resetSimulation() {
    this.simTimeMs = 0;
    this.isRunning = false;
    this.activePackets.clear();
    this.packetHistory = [];
    this.eventQueue = [];
    this.logs = [];
    this.translationTraces = [];
    this.latenciesSumMs = 0;
    this.deliveredCount = 0;
    this.metrics = {
      totalPacketsInjected: 0,
      totalPacketsDelivered: 0,
      totalPacketsDropped: 0,
      pdr: 100.0,
      averageLatencyMs: 0.0,
      hopCountHistogram: {},
      throughputKbps: 0.0,
      gatewayLoadMap: {},
      protocolOverheadBytes: 0,
    };

    for (const n of this.nodes.values()) {
      n.currentQueue = [];
      n.routingTable = {};
    }

    for (const l of this.links) {
      l.currentLoad = 0;
    }
  }

  public injectPacket(
    sourceId: string,
    targetId: string,
    payload: string = 'Telemetry Data Packet',
    payloadSizeBytes: number = 512
  ): Packet | null {
    const srcNode = this.nodes.get(sourceId);
    const dstNode = this.nodes.get(targetId);

    if (!srcNode || !dstNode) {
      this.addLog(`Error injecting packet: Node not found.`, 'error');
      return null;
    }

    if (!srcNode.isAlive) {
      this.addLog(`Cannot inject packet: Source node ${srcNode.name} is offline.`, 'warn');
      return null;
    }

    const srcSubmesh = this.submeshes.get(srcNode.submeshId);
    const dstSubmesh = this.submeshes.get(dstNode.submeshId);

    if (!srcSubmesh || !dstSubmesh) return null;

    this.packetIdCounter++;
    const packetId = `PKT-${this.packetIdCounter}`;

    const newPacket: Packet = {
      id: packetId,
      sequenceNum: this.packetIdCounter,
      src: sourceId,
      dst: targetId,
      payload,
      payloadSizeBytes,
      submeshSrc: srcNode.submeshId,
      submeshDst: dstNode.submeshId,
      currentHop: sourceId,
      nextHop: undefined,
      pathTraversed: [sourceId],
      protocolTrace: [srcSubmesh.protocol],
      hops: 0,
      state: 'queued',
      createdAtSimTime: this.simTimeMs,
      color: srcSubmesh.color
    };

    this.metrics.totalPacketsInjected++;
    this.activePackets.set(packetId, newPacket);

    // Schedule initial routing step
    this.scheduleEvent({
      id: `EV-${Date.now()}-${Math.random()}`,
      timestamp: this.simTimeMs + 5, // 5ms local queue latency
      type: 'PACKET_HOP',
      data: { packetId }
    });

    this.addLog(`[Time ${this.simTimeMs}ms] Injected ${packetId} at ${srcNode.name} -> Target: ${dstNode.name} (${srcSubmesh.name} -> ${dstSubmesh.name})`, 'info', packetId, srcNode.id);

    return newPacket;
  }

  public scheduleEvent(event: SimulationEvent) {
    this.eventQueue.push(event);
    this.eventQueue.sort((a, b) => a.timestamp - b.timestamp);
  }

  public step(deltaSimMs: number) {
    this.simTimeMs += deltaSimMs;

    // Process all events up to current simTimeMs
    while (this.eventQueue.length > 0 && this.eventQueue[0].timestamp <= this.simTimeMs) {
      const event = this.eventQueue.shift()!;
      this.processEvent(event);
    }

    // Update real-time gateway load telemetry
    this.updateGatewayTelemetry();
  }

  private processEvent(event: SimulationEvent) {
    switch (event.type) {
      case 'PACKET_HOP':
        this.handlePacketHop(event.data.packetId);
        break;
      case 'PACKET_DELIVER':
        this.handlePacketDeliver(event.data.packetId);
        break;
      case 'PACKET_DROP':
        this.handlePacketDrop(event.data.packetId, event.data.reason);
        break;
      case 'GATEWAY_TRANSLATE':
        this.handleGatewayTranslate(event.data.packetId, event.data.gatewayId);
        break;
    }
  }

  private handlePacketHop(packetId: string) {
    const packet = this.activePackets.get(packetId);
    if (!packet) return;

    const currentNode = this.nodes.get(packet.currentHop);
    const targetNode = this.nodes.get(packet.dst);

    if (!currentNode || !targetNode) {
      this.handlePacketDrop(packetId, 'Node offline or missing');
      return;
    }

    if (!currentNode.isAlive) {
      this.handlePacketDrop(packetId, `Current node ${currentNode.name} died`);
      return;
    }

    // Check if reached final destination
    if (currentNode.id === targetNode.id) {
      this.handlePacketDeliver(packetId);
      return;
    }

    // Check if at a boundary gateway needing cross-domain protocol translation (once per gateway per packet)
    const alreadyTranslatedHere = this.translationTraces.some(
      t => t.gatewayId === currentNode.id && t.rawHeaderBefore?.meshSequence === packet.sequenceNum
    );
    if (currentNode.type === 'gateway' && packet.submeshSrc !== packet.submeshDst && !alreadyTranslatedHere) {
      this.handleGatewayTranslate(packetId, currentNode.id);
      return;
    }

    // Compute multi-mesh shortest path across current submeshes & gateways
    const route = calculateMultiMeshRoute(currentNode.id, targetNode.id, this.nodes, this.links, this.submeshes);
    const nextHopId: string | null = route.found && route.path.length >= 2 ? route.path[1] : null;

    if (!nextHopId) {
      this.handlePacketDrop(packetId, route.error || `Routing failure: No viable route from ${currentNode.name} toward target`);
      return;
    }

    // Find physical link between currentNode and nextHopId
    const activeLink = this.findLink(currentNode.id, nextHopId);
    if (!activeLink || activeLink.isSevered || activeLink.isJammed) {
      this.handlePacketDrop(packetId, `Physical link severed/jammed between ${currentNode.name} and next hop`);
      return;
    }

    // Evaluate physical layer packet corruption / channel drop
    if (Math.random() < activeLink.lossRate) {
      this.handlePacketDrop(packetId, `RF noise drop (PER ${(activeLink.lossRate * 100).toFixed(1)}%, SNR ${activeLink.snrDb.toFixed(1)} dB)`);
      return;
    }

    // Compute hop transmission delay
    const bandwidthBps = activeLink.bandwidthMbps * 1e6;
    const txDelayMs = ((packet.payloadSizeBytes * 8) / bandwidthBps) * 1000;
    const propDelayMs = (activeLink.distanceMeters / 3e8) * 1000;
    const queueDelayMs = Math.min((currentNode.currentQueue.length / currentNode.queueCapacity) * 20, 50);
    const hopDelayMs = Math.max(txDelayMs + propDelayMs + queueDelayMs, 15); // Minimum 15ms simulated duration

    packet.hops++;
    packet.nextHop = nextHopId;
    packet.state = 'transmitting';
    activeLink.currentLoad++;
    activeLink.traversalCount++;

    this.addLog(
      `[Time ${this.simTimeMs}ms] ${packet.id} hopping: ${currentNode.name} -> ${this.nodes.get(nextHopId)?.name} (Hop #${packet.hops}, Delay: ${hopDelayMs.toFixed(1)}ms)`,
      'info',
      packet.id,
      currentNode.id
    );

    // Schedule arrival at next hop
    this.scheduleEvent({
      id: `EV-ARRIVE-${packet.id}-${packet.hops}`,
      timestamp: this.simTimeMs + hopDelayMs,
      type: 'PACKET_HOP',
      data: { packetId }
    });

    // Advance hop state
    packet.currentHop = nextHopId;
    packet.pathTraversed.push(nextHopId);
  }

  private handleGatewayTranslate(packetId: string, gatewayId: string) {
    const packet = this.activePackets.get(packetId);
    const gateway = this.nodes.get(gatewayId);
    const targetNode = this.nodes.get(packet?.dst || '');

    if (!packet || !gateway || !targetNode) return;

    const ingressSubmesh = this.submeshes.get(packet.submeshSrc);
    const egressSubmesh = this.submeshes.get(targetNode.submeshId);

    if (!ingressSubmesh || !egressSubmesh) return;

    // Translate packet headers
    const { packet: translatedPacket, trace } = translatePacketHeader(
      packet,
      gateway,
      ingressSubmesh,
      egressSubmesh,
      this.simTimeMs
    );

    this.activePackets.set(packetId, translatedPacket);
    this.translationTraces.push(trace);

    this.addLog(
      `[Time ${this.simTimeMs}ms] GATEWAY BRIDGE at ${gateway.name}: Translated ${ingressSubmesh.protocol} (${ingressSubmesh.frequencyBand}) -> ${egressSubmesh.protocol} (${egressSubmesh.frequencyBand})`,
      'gateway',
      packetId,
      gateway.id
    );

    // Schedule forwarding inside destination submesh
    this.scheduleEvent({
      id: `EV-GW-FWD-${packetId}`,
      timestamp: this.simTimeMs + 25, // 25ms gateway processing & radio retune time
      type: 'PACKET_HOP',
      data: { packetId }
    });
  }

  private handlePacketDeliver(packetId: string) {
    const packet = this.activePackets.get(packetId);
    if (!packet) return;

    packet.state = 'received';
    packet.deliveredAtSimTime = this.simTimeMs;
    const latencyMs = this.simTimeMs - packet.createdAtSimTime;

    this.deliveredCount++;
    this.metrics.totalPacketsDelivered++;
    this.latenciesSumMs += latencyMs;
    this.metrics.averageLatencyMs = this.latenciesSumMs / this.deliveredCount;
    this.metrics.pdr = (this.metrics.totalPacketsDelivered / this.metrics.totalPacketsInjected) * 100;

    // Histogram update
    this.metrics.hopCountHistogram[packet.hops] = (this.metrics.hopCountHistogram[packet.hops] || 0) + 1;

    this.addLog(
      `[Time ${this.simTimeMs}ms] SUCCESS: Packet ${packet.id} delivered to ${this.nodes.get(packet.dst)?.name} in ${packet.hops} hops (Total Latency: ${latencyMs.toFixed(1)}ms)`,
      'success',
      packetId,
      packet.dst
    );

    // Retain in packet history and clean up active flight animation
    this.packetHistory.unshift({ ...packet });
    if (this.packetHistory.length > 40) this.packetHistory.pop();

    setTimeout(() => {
      this.activePackets.delete(packetId);
    }, 2000);
  }

  private handlePacketDrop(packetId: string, reason: string) {
    const packet = this.activePackets.get(packetId);
    if (!packet) return;

    packet.state = 'dropped';
    packet.dropReason = reason;

    this.metrics.totalPacketsDropped++;
    this.metrics.pdr = (this.metrics.totalPacketsDelivered / this.metrics.totalPacketsInjected) * 100;

    this.addLog(
      `[Time ${this.simTimeMs}ms] DROPPED: Packet ${packet.id} at node ${this.nodes.get(packet.currentHop)?.name || 'unknown'}: ${reason}`,
      'error',
      packetId,
      packet.currentHop
    );

    this.packetHistory.unshift({ ...packet });
    if (this.packetHistory.length > 40) this.packetHistory.pop();

    setTimeout(() => {
      this.activePackets.delete(packetId);
    }, 3000);
  }

  public findLink(nodeAId: string, nodeBId: string): NetworkLink | null {
    for (const link of this.links) {
      if ((link.source === nodeAId && link.target === nodeBId) || (link.source === nodeBId && link.target === nodeAId)) {
        return link;
      }
    }
    return null;
  }

  // Fault Studio Actions
  public toggleKillNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.isAlive = !node.isAlive;
    this.addLog(
      `[Fault Studio] Node ${node.name} is now ${node.isAlive ? 'ONLINE' : 'TERMINATED (OFFLINE)'}`,
      node.isAlive ? 'info' : 'warn',
      undefined,
      node.id
    );

    // Invalidate cached routing entries
    for (const n of this.nodes.values()) {
      delete n.routingTable[nodeId];
    }

    return node.isAlive;
  }

  public toggleSeverLink(linkId: string): boolean {
    const link = this.links.find(l => l.id === linkId);
    if (!link) return false;

    link.isSevered = !link.isSevered;
    this.addLog(
      `[Fault Studio] Link ${link.source} <-> ${link.target} ${link.isSevered ? 'SEVERED' : 'RESTORED'}`,
      link.isSevered ? 'warn' : 'info'
    );

    return link.isSevered;
  }

  public toggleJamFrequency(band: string): boolean {
    let affected = 0;
    for (const link of this.links) {
      const srcNode = this.nodes.get(link.source);
      const submesh = srcNode ? this.submeshes.get(srcNode.submeshId) : null;
      if (submesh && submesh.frequencyBand === band) {
        link.isJammed = !link.isJammed;
        affected++;
      }
    }

    this.addLog(
      `[Fault Studio] RF Frequency Channel ${band} jamming toggled (${affected} links affected).`,
      'warn'
    );
    return true;
  }

  // ==========================================
  // Dynamic Network Builder Engine Capabilities
  // ==========================================

  /**
   * Adds a user-defined node dynamically into the active simulation topology
   */
  public addNode(node: MeshNode, autoConnectNearest: boolean = false): MeshNode {
    const preparedNode: MeshNode = {
      ...node,
      currentQueue: [],
      routingTable: {},
      isAlive: node.isAlive !== undefined ? node.isAlive : true,
    };
    this.nodes.set(preparedNode.id, preparedNode);

    if (autoConnectNearest && this.nodes.size > 1) {
      let nearest: MeshNode | null = null;
      let minDistance = Infinity;

      for (const other of this.nodes.values()) {
        if (other.id === preparedNode.id) continue;
        const d = Math.hypot(other.position.x - preparedNode.position.x, other.position.y - preparedNode.position.y);
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
    this.addLog(`[Builder] Added node "${preparedNode.name}" (${preparedNode.type}) at (${Math.round(preparedNode.position.x)}, ${Math.round(preparedNode.position.y)})`, 'info', undefined, preparedNode.id);
    return preparedNode;
  }

  /**
   * Removes a node and all of its incident links
   */
  public removeNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Remove connected links
    const originalLinkCount = this.links.length;
    this.links = this.links.filter(l => l.source !== nodeId && l.target !== nodeId);
    const removedLinks = originalLinkCount - this.links.length;

    // Delete node
    this.nodes.delete(nodeId);

    // Invalidate cached routing tables in remaining nodes
    for (const n of this.nodes.values()) {
      delete n.routingTable[nodeId];
    }

    this.addLog(`[Builder] Removed node "${node.name}" and ${removedLinks} connected link(s).`, 'warn');
    return true;
  }

  /**
   * Creates an RF-evaluated wireless link between two nodes
   * Automatically computes Euclidean distance, Log-Distance / Friis path loss, SNR, and PER
   */
  public addLink(sourceId: string, targetId: string, bandwidthMbps?: number): NetworkLink | null {
    if (sourceId === targetId) return null;

    const srcNode = this.nodes.get(sourceId);
    const dstNode = this.nodes.get(targetId);
    if (!srcNode || !dstNode) return null;

    // Prevent duplicate links
    const existing = this.findLink(sourceId, targetId);
    if (existing) {
      this.addLog(`[Builder] Link between ${srcNode.name} and ${dstNode.name} already exists.`, 'warn');
      return existing;
    }

    const submesh = this.submeshes.get(srcNode.submeshId);
    const freqGhz = submesh?.frequencyBand === '5.2GHz' ? 5.2
      : submesh?.frequencyBand === '5.8GHz' ? 5.8
      : submesh?.frequencyBand === '915MHz' ? 0.915
      : submesh?.frequencyBand === '868MHz' ? 0.868
      : 2.4;

    const evalResult = evaluatePhysicalLink(
      srcNode.position,
      dstNode.position,
      srcNode.txPowerDbm,
      freqGhz,
      this.config
    );

    const defaultBw = (srcNode.type === 'sensor' || dstNode.type === 'sensor') ? 0.25 : 54;
    const finalBandwidth = bandwidthMbps !== undefined && bandwidthMbps > 0 ? bandwidthMbps : defaultBw;

    const newLink: NetworkLink = {
      id: `link_${sourceId}_${targetId}_${Date.now()}`,
      source: sourceId,
      target: targetId,
      bandwidthMbps: finalBandwidth,
      lossRate: Math.min(Math.max(evalResult.per, 0.005), 0.95),
      distanceMeters: evalResult.distanceMeters,
      snrDb: evalResult.snrDb,
      per: evalResult.per,
      isSevered: false,
      isJammed: false,
      currentLoad: 0,
      traversalCount: 0
    };

    this.links.push(newLink);
    this.addLog(
      `[Builder] Linked ${srcNode.name} ↔ ${dstNode.name} (Dist: ${evalResult.distanceMeters.toFixed(1)}m, SNR: ${evalResult.snrDb.toFixed(1)} dB, PER: ${(newLink.lossRate * 100).toFixed(1)}%)`,
      'info'
    );

    return newLink;
  }

  /**
   * Removes a specific link by ID
   */
  public removeLink(linkId: string): boolean {
    const idx = this.links.findIndex(l => l.id === linkId);
    if (idx === -1) return false;

    const link = this.links[idx];
    this.links.splice(idx, 1);
    this.addLog(`[Builder] Severed and deleted link ${link.source} ↔ ${link.target}`, 'info');
    return true;
  }

  /**
   * Registers a new SubMeshDomain
   */
  public addSubMesh(domain: SubMeshDomain): SubMeshDomain {
    this.submeshes.set(domain.id, domain);
    this.addLog(`[Builder] Added Sub-Mesh domain "${domain.name}" [${domain.protocol} / ${domain.frequencyBand}]`, 'info');
    return domain;
  }

  /**
   * Removes a sub-mesh domain
   */
  public removeSubMesh(submeshId: string): boolean {
    if (!this.submeshes.has(submeshId)) return false;
    const sm = this.submeshes.get(submeshId)!;
    this.submeshes.delete(submeshId);
    this.addLog(`[Builder] Removed Sub-Mesh domain "${sm.name}"`, 'warn');
    return true;
  }

  /**
   * Clears the current canvas topology
   */
  public clearCanvas(keepSubmeshes: boolean = true) {
    this.resetSimulation();
    this.nodes.clear();
    this.links = [];
    if (!keepSubmeshes) {
      this.submeshes.clear();
    }
    this.addLog('[Builder] Canvas cleared: All nodes and links removed.', 'warn');
  }

  /**
   * Saves topology to LocalStorage
   */
  public saveToLocalStorage(key: string = 'multimesh_custom_network'): boolean {
    try {
      const data: TopologyExportJSON = {
        simulatorConfig: this.config,
        submeshes: Array.from(this.submeshes.values()),
        nodes: Array.from(this.nodes.values()),
        links: this.links,
        meta: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          scenarioTitle: 'Custom Multi-Mesh User Topology',
          authors: ['User Custom Network']
        }
      };
      localStorage.setItem(key, JSON.stringify(data));
      this.addLog(`[Storage] Saved network snapshot (${this.nodes.size} nodes, ${this.links.length} links) to "${key}".`, 'success');
      return true;
    } catch (err) {
      this.addLog(`[Storage] Failed to save to localStorage: ${String(err)}`, 'error');
      return false;
    }
  }

  /**
   * Loads topology from LocalStorage
   */
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

  /**
   * Exports full topology as JSON object
   */
  public exportTopologyJSON(scenarioTitle: string = 'Custom Multi-Mesh Network'): TopologyExportJSON {
    return {
      simulatorConfig: this.config,
      submeshes: Array.from(this.submeshes.values()),
      nodes: Array.from(this.nodes.values()),
      links: this.links,
      meta: {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        scenarioTitle,
        authors: ['User Network Architect']
      }
    };
  }

  /**
   * Imports full topology from JSON object or string
   */
  public importTopologyJSON(data: TopologyExportJSON | string): boolean {
    try {
      const parsed: TopologyExportJSON = typeof data === 'string' ? JSON.parse(data) : data;
      if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.links) || !Array.isArray(parsed.submeshes)) {
        this.addLog('[Builder] Invalid topology JSON schema.', 'error');
        return false;
      }

      if (parsed.simulatorConfig) {
        this.config = { ...this.config, ...parsed.simulatorConfig };
      }

      this.loadTopology(parsed.submeshes, parsed.nodes, parsed.links);
      this.addLog(`[Builder] Successfully imported topology "${parsed.meta?.scenarioTitle || 'Network'}" with ${parsed.nodes.length} nodes.`, 'success');
      return true;
    } catch (err) {
      this.addLog(`[Builder] Error importing JSON: ${String(err)}`, 'error');
      return false;
    }
  }

  private updateGatewayTelemetry() {
    for (const node of this.nodes.values()) {
      if (node.type === 'gateway') {
        const queueOccupancy = node.currentQueue.length / Math.max(node.queueCapacity, 1);
        this.metrics.gatewayLoadMap[node.id] = Math.min(queueOccupancy * 100, 100);
      }
    }
  }

  public addLog(message: string, level: SimulationStepLog['level'] = 'info', packetId?: string, nodeId?: string) {
    this.logs.unshift({
      timestamp: this.simTimeMs,
      message,
      level,
      packetId,
      nodeId
    });

    if (this.logs.length > 250) {
      this.logs.pop();
    }
  }
}

