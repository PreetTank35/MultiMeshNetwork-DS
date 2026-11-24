/**
 * Multi-Mesh Network Simulator Data Types & Contracts
 * Based on MIT AOE Project Architecture Specification
 */

export type ProtocolType = 'AODV' | 'OLSR' | 'HWMP' | 'RPL';
export type FrequencyBand = '2.4GHz' | '5.2GHz' | '5.8GHz' | '915MHz' | '868MHz';
export type NodeType = 'router' | 'gateway' | 'sensor' | 'mobile';
export type MobilityModel = 'static' | 'random_waypoint' | 'linear';
export type InterfaceType = 'wifi' | 'zigbee' | 'thread' | 'ethernet';
export type BuilderTool = 'select' | 'connect_link' | 'add_router' | 'add_gateway' | 'add_sensor' | 'add_mobile';

export interface NetworkInterface {
  id: string;
  type: InterfaceType;
  mac: string;
  channel: number;
  frequencyBand: FrequencyBand;
  txPowerDbm: number;
  bandwidthMbps: number;
}

export interface NodePosition {
  x: number;
  y: number;
  z?: number;
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
  txPowerDbm: number;
  queueCapacity: number;
  currentQueue: Packet[];
  interfaces: NetworkInterface[];
  isAlive: boolean;
  batteryPercent?: number;
  rplRank?: number; // For RPL DAG rank
  mprNeighbors?: string[]; // For OLSR Multipoint Relays
  routingTable: Record<string, { nextHop: string; cost: number; protocol: ProtocolType; timestamp: number }>;
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
}

export type PacketState = 'queued' | 'transmitting' | 'received' | 'dropped' | 'translated';

export interface Packet {
  id: string;
  sequenceNum: number;
  src: string;
  dst: string;
  payload: string;
  payloadSizeBytes: number;
  submeshSrc: string;
  submeshDst: string;
  currentHop: string;
  nextHop?: string;
  pathTraversed: string[];
  protocolTrace: ProtocolType[];
  hops: number;
  state: PacketState;
  createdAtSimTime: number;
  deliveredAtSimTime?: number;
  dropReason?: string;
  color?: string;
}

export interface SimulationEvent {
  id: string;
  timestamp: number; // Simulation time in ms
  type: 'PACKET_GENERATE' | 'PACKET_HOP' | 'PACKET_DELIVER' | 'PACKET_DROP' | 'GATEWAY_TRANSLATE' | 'FAULT_TRIGGER' | 'MOBILITY_TICK';
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
}

export interface TelemetryMetrics {
  totalPacketsInjected: number;
  totalPacketsDelivered: number;
  totalPacketsDropped: number;
  pdr: number; // Packet Delivery Ratio %
  averageLatencyMs: number;
  hopCountHistogram: Record<number, number>;
  throughputKbps: number;
  gatewayLoadMap: Record<string, number>; // Gateway ID -> utilization %
  protocolOverheadBytes: number;
}

export interface FaultState {
  killedNodes: Set<string>;
  severedLinks: Set<string>;
  jammedFrequencies: Set<FrequencyBand>;
}

export interface TopologyExportJSON {
  simulatorConfig: SimulationConfig;
  submeshes: SubMeshDomain[];
  nodes: MeshNode[];
  links: NetworkLink[];
  meta: {
    exportedAt: string;
    version: string;
    scenarioTitle: string;
    authors: string[];
  };
}

