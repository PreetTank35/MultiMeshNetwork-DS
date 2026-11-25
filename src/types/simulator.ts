/**
 * Multi-Mesh Network Simulator Data Types & Contracts
 * Based on MIT AOE Project Architecture Specification
 */

export type ProtocolType = 'AODV' | 'OLSR' | 'HWMP' | 'RPL';
export type FrequencyBand = '2.4GHz' | '5.2GHz' | '5.8GHz' | '915MHz' | '868MHz';
export type NodeType = 'router' | 'gateway' | 'sensor' | 'end_device' | 'mobile';
export type MobilityModel = 'static' | 'random_waypoint' | 'linear';
export type InterfaceType = 'wifi' | 'zigbee' | 'thread' | 'ethernet' | 'lora' | 'ble';
export type SubMeshTechnology = 'Wi-Fi 6' | '802.11s' | '802.15.4' | 'Thread' | 'Zigbee' | 'LoRa' | 'Custom';
export type BuilderTool =
  | 'select'
  | 'connect_link'
  | 'add_router'
  | 'add_gateway'
  | 'add_sensor'
  | 'add_end_device'
  | 'add_mobile';

export interface NetworkInterface {
  id: string;
  type: InterfaceType;
  mac: string;
  channel: number;
  frequencyBand: FrequencyBand;
  txPowerDbm: number;
  bandwidthMbps: number;
  submeshId?: string;
  technology?: SubMeshTechnology;
  receiverSensitivityDbm?: number;
  isUp?: boolean;
}

export interface NodePosition {
  x: number;
  y: number;
  z?: number;
}

export interface AodvRouteEntry {
  destId: string;
  nextHop: string;
  hopCount: number;
  destSeqNum: number;
  valid: boolean;
  expiresAtSimMs: number;
  lastUpdatedSimMs: number;
}

export interface AodvNodeState {
  seqNum: number;
  rreqId: number;
  routes: Record<string, AodvRouteEntry>;
  seenRreqs: Record<string, number>;
  pendingDiscoveries: string[];
}

export interface OlsrTcEntry {
  originId: string;
  mprSelectorId: string;
  cost: number;
  ansn: number;
  timestampMs: number;
}

export interface OlsrNodeState {
  ansn: number;
  oneHopNeighbors: string[];
  twoHopNeighbors: string[];
  mprSet: string[];
  mprSelectors: string[];
  tcTable: OlsrTcEntry[];
  routingTable: Record<string, { nextHop: string; cost: number; hops: number }>;
}

export interface HwmpNodeState {
  prepSeqNum: number;
  preqId: number;
  rootNodeId?: string;
  rootParentId?: string;
  rootAirtimeMetric?: number;
  reactivePaths: Record<
    string,
    { nextHop: string; airtimeCost: number; seqNum: number; expiresAtSimMs: number }
  >;
}

export interface RplNodeState {
  dodagId?: string;
  dodagVersion: number;
  rank: number;
  preferredParentId?: string;
  parentRank?: number;
  dioIntervalMs: number;
  daoDownstream: Record<string, string>;
}

export interface MeshNode {
  id: string;
  name: string;
  submeshId: string;
  type: NodeType;
  position: NodePosition;
  velocity?: { vx: number; vy: number };
  mobilityModel: MobilityModel;
  mobilityBounds?: { minX: number; maxX: number; minY: number; maxY: number };
  waypointTarget?: { x: number; y: number } | null;
  mobilityPauseRemainingSec?: number;
  txPowerDbm: number;
  receiverSensitivityDbm?: number;
  isMultiRadio?: boolean;
  queueCapacity: number;
  currentQueue: Packet[];
  interfaces: NetworkInterface[];
  isAlive: boolean;
  batteryPercent?: number;
  rplRank?: number; // For RPL DAG rank
  mprNeighbors?: string[]; // For OLSR Multipoint Relays
  aodvState?: AodvNodeState;
  olsrState?: OlsrNodeState;
  hwmpState?: HwmpNodeState;
  rplState?: RplNodeState;
  routingTable: Record<
    string,
    { nextHop: string; cost: number; protocol: ProtocolType; timestamp: number; seqNum?: number }
  >;
}

export interface SubMeshDomain {
  id: string;
  name: string;
  protocol: ProtocolType;
  frequencyBand: FrequencyBand;
  channelWidthMhz: number;
  channelNumber: number;
  color: string;
  description: string;
  technology?: SubMeshTechnology;
  defaultBandwidthMbps?: number;
}

export interface NetworkLink {
  id: string;
  source: string;
  target: string;
  bandwidthMbps: number;
  lossRate: number; // 0.0 to 1.0
  distanceMeters: number;
  snrDb: number;
  per: number; // Packet Error Rate
  isSevered: boolean;
  isJammed: boolean;
  currentLoad: number; // Packets currently traversing
  traversalCount: number;
  isViable?: boolean;
  isDynamic?: boolean;
  channel?: number;
  frequencyBand?: FrequencyBand;
  rxPowerDbm?: number;
  interferenceDbm?: number;
  collisionProbability?: number;
  utilizationPct?: number;
}

export type PacketState =
  | 'created'
  | 'queued'
  | 'transmitting'
  | 'received'
  | 'forwarded'
  | 'delivered'
  | 'dropped'
  | 'translated';

export function isPacketDeliveredState(state: PacketState): boolean {
  return state === 'delivered';
}

export function isPacketTerminalState(state: PacketState): boolean {
  return state === 'delivered' || state === 'dropped';
}

export interface PacketTimelineEntry {
  stage: PacketState | 'route_discovered' | 'route_changed' | 'gateway_translated';
  timestampMs: number;
  nodeId: string;
  nextNodeId?: string;
  hopIndex: number;
  protocol?: ProtocolType;
  submeshId?: string;
  queueDelayMs?: number;
  txDelayMs?: number;
  propDelayMs?: number;
  gatewayDelayMs?: number;
  details: string;
}

export interface Packet {
  id: string;
  packetId?: string;
  sequenceNum: number;
  src: string;
  dst: string;
  payload: string;
  payloadSizeBytes: number;
  size?: number;
  submeshSrc: string;
  submeshDst: string;
  currentHop: string;
  nextHop?: string;
  pathTraversed: string[];
  plannedRoute?: string[];
  protocolTrace: ProtocolType[];
  hops: number;
  ttl?: number;
  routeChangesCount?: number;
  queueDelayMs?: number;
  txDelayMs?: number;
  propDelayMs?: number;
  gatewayDelayMs?: number;
  timeline?: PacketTimelineEntry[];
  state: PacketState;
  createdAtSimTime: number;
  deliveredAtSimTime?: number;
  droppedAtSimTime?: number;
  dropReason?: string;
  color?: string;
  currentLinkId?: string;
  currentSubmeshId?: string;
  lastHopStartedAtMs?: number;
  lastHopDurationMs?: number;
}

export type SimulationEventType =
  | 'PacketCreated'
  | 'PacketQueued'
  | 'TransmissionStarted'
  | 'TransmissionCompleted'
  | 'PacketReceived'
  | 'PacketForwarded'
  | 'PacketDelivered'
  | 'PacketDropped'
  | 'RouteDiscovered'
  | 'RouteChanged'
  | 'NodeFailed'
  | 'NodeRecovered'
  | 'LinkFailed'
  | 'LinkRecovered'
  | 'ChannelJammed'
  | 'ChannelUnjammed'
  | 'GatewayOverloaded'
  | 'MobilityUpdated'
  | 'PACKET_GENERATE'
  | 'PACKET_HOP'
  | 'PACKET_DELIVER'
  | 'PACKET_DROP'
  | 'GATEWAY_TRANSLATE'
  | 'FAULT_TRIGGER'
  | 'MOBILITY_TICK';

export const SIMULATION_EVENT_LABELS: Record<SimulationEventType, string> = {
  PacketCreated: 'Packet Created',
  PacketQueued: 'Packet Queued',
  TransmissionStarted: 'Transmission Started',
  TransmissionCompleted: 'Transmission Completed',
  PacketReceived: 'Packet Received',
  PacketForwarded: 'Packet Forwarded',
  PacketDelivered: 'Packet Delivered',
  PacketDropped: 'Packet Dropped',
  RouteDiscovered: 'Route Discovered',
  RouteChanged: 'Route Changed',
  NodeFailed: 'Node Failed',
  NodeRecovered: 'Node Recovered',
  LinkFailed: 'Link Failed',
  LinkRecovered: 'Link Recovered',
  ChannelJammed: 'Channel Jammed',
  ChannelUnjammed: 'Channel Unjammed',
  GatewayOverloaded: 'Gateway Overloaded',
  MobilityUpdated: 'Mobility Updated',
  PACKET_GENERATE: 'Packet Created',
  PACKET_HOP: 'Packet Forwarded',
  PACKET_DELIVER: 'Packet Delivered',
  PACKET_DROP: 'Packet Dropped',
  GATEWAY_TRANSLATE: 'Gateway Translated',
  FAULT_TRIGGER: 'Fault Triggered',
  MOBILITY_TICK: 'Mobility Updated',
};

export interface SimulationEvent {
  id: string;
  timestamp: number; // Simulation time in ms
  orderSeq?: number; // Deterministic tie-breaker
  type: SimulationEventType;
  data: any;
}

export interface SimulationConfig {
  tickRateMs: number;
  simSpeedMultiplier: number;
  pathLossModel: 'Friis' | 'LogDistance';
  pathLossExponent: number; // gamma (e.g. 2.7 to 3.5)
  shadowingStdDevDb: number; // sigma
  referenceDistanceMeters: number; // d0 = 1.0m
  noiseFloorDbm: number; // -95 dBm default
  carrierFreqGhz: number;
  packetErrorRateOverride?: number;
  seed: number;
  fixedStepMs: number;
  rxSensitivityDbm: number;
  enableInterference: boolean;
  enableCollisions: boolean;
  defaultTtl: number;
}

export interface DomainTelemetryStat {
  domainId: string;
  name: string;
  protocol: ProtocolType;
  packetsOriginated: number;
  packetsDelivered: number;
  packetsDropped: number;
  activeNodes: number;
  totalNodes: number;
  avgSnrDb: number;
}

export interface NodeTelemetryStat {
  nodeId: string;
  name: string;
  type: NodeType;
  packetsSent: number;
  packetsReceived: number;
  packetsForwarded: number;
  packetsDropped: number;
  queueOccupancyPct: number;
  isAlive: boolean;
}

export interface PdrTimeSeriesPoint {
  timestampMs: number;
  pdr: number;
  completedPdr: number;
  delivered: number;
  dropped: number;
  injected: number;
}

export interface TelemetryMetrics {
  totalPacketsInjected: number;
  totalPacketsDelivered: number;
  totalPacketsDropped: number;
  pdr: number; // Packet Delivery Ratio % (delivered / injected * 100)
  completedPdr?: number; // delivered / (delivered + dropped) * 100
  inFlightPackets?: number;
  averageLatencyMs: number;
  minLatencyMs?: number;
  maxLatencyMs?: number;
  jitterMs?: number;
  averageQueueDelayMs?: number;
  averageTxDelayMs?: number;
  averageGatewayDelayMs?: number;
  latencySamplesMs?: number[];
  hopCountHistogram: Record<number, number>;
  dropReasonCounts?: Record<string, number>;
  pdrTimeSeries?: PdrTimeSeriesPoint[];
  throughputKbps: number;
  gatewayLoadMap: Record<string, number>; // Gateway ID -> utilization %
  linkUtilizationMap?: Record<string, number>;
  channelUtilizationMap?: Record<string, number>;
  perDomainStats?: Record<string, DomainTelemetryStat>;
  perNodeStats?: Record<string, NodeTelemetryStat>;
  protocolOverheadBytes: number;
}

export interface FaultState {
  killedNodes: Set<string>;
  severedLinks: Set<string>;
  jammedFrequencies: Set<FrequencyBand>;
  jammedChannels?: Set<string>; // key: `${band}:${channel}`
  failedGatewayInterfaces?: Set<string>; // key: `${nodeId}:${ifaceId}`
}

export interface SerializedFaultState {
  killedNodes: string[];
  severedLinks: string[];
  jammedFrequencies: FrequencyBand[];
  jammedChannels: Array<{ band: FrequencyBand; channel: number }>;
  failedGatewayInterfaces: string[];
}

export interface WorkloadHistoryEntry {
  offsetSimMs: number;
  src: string;
  dst: string;
  payload: string;
  payloadSizeBytes: number;
}

export interface TopologyRuntimeSnapshot {
  simTimeMs: number;
  seed: number;
  prngState?: number;
  packetIdCounter?: number;
  workload?: WorkloadHistoryEntry[];
}

export interface TopologyExportJSON {
  simulatorConfig: SimulationConfig;
  submeshes: SubMeshDomain[];
  nodes: MeshNode[];
  links: NetworkLink[];
  faults?: SerializedFaultState;
  runtimeState?: TopologyRuntimeSnapshot;
  meta: {
    exportedAt: string;
    version: string;
    scenarioTitle: string;
    authors: string[];
  };
}
