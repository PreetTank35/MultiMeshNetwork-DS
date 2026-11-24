/**
 * Inter-Domain Gateway Bridging & Protocol Translation Engine
 * Handles boundary gateway discovery, multi-interface channel binding,
 * and heterogeneous frame translation (HWMP <-> RPL <-> AODV <-> OLSR)
 */

import { MeshNode, NetworkInterface, NetworkLink, Packet, ProtocolType, SubMeshDomain } from '../../types/simulator';

export const GATEWAY_BASE_PROCESSING_DELAY_MS = 12.5;

export interface HeaderTranslationTrace {
  timestampSimMs: number;
  gatewayId: string;
  ingressSubmeshId: string;
  egressSubmeshId: string;
  ingressProtocol: ProtocolType;
  egressProtocol: ProtocolType;
  ingressChannel: number;
  egressChannel: number;
  ingressMac: string;
  egressMac: string;
  rawHeaderBefore: Record<string, any>;
  rawHeaderAfter: Record<string, any>;
  mrmcSwitchTimeMs?: number;
  translationSteps?: GatewayTranslationStep[];
}

export interface GatewayTranslationStep {
  step: number;
  name: string;
  description: string;
  layer: 'L1-PHY' | 'L2-MAC' | 'L3-NET' | 'L4-TRANS';
  status: 'completed' | 'in_progress';
  details: Record<string, any>;
}

export interface OsiLayerInspection {
  layer1Physical: {
    name: string;
    frequencyBand: string;
    channel: number;
    channelWidthMhz: number;
    txPowerDbm: number;
    modulation: string;
    snrDb: number;
    per: number;
    distanceMeters: number;
  };
  layer2DataLink: {
    name: string;
    frameStandard: string;
    sourceMac: string;
    destMac: string;
    macFrameType: string;
    channelAccess: string;
    meshTtl?: number;
    sequenceNum: number;
  };
  layer3Network: {
    name: string;
    protocol: ProtocolType;
    ingressDomain: string;
    egressDomain: string;
    routingCostMetric: number;
    hopCount: number;
    ttl: number;
    nextHopId?: string;
    protocolSpecificHeaders: Record<string, any>;
  };
  layer4Transport: {
    name: string;
    protocol: 'UDP' | 'TCP';
    srcPort: number;
    dstPort: number;
    payloadSizeBytes: number;
    checksum: string;
    windowSize?: number;
  };
  layer7Application: {
    name: string;
    payloadType: string;
    payloadSummary: string;
    dataRateKbps: number;
    generatedAtSimMs: number;
  };
}

/**
 * Checks whether a node acts as a boundary gateway between submeshes
 */
export function isBoundaryGateway(
  node: MeshNode,
  nodesMap: Map<string, MeshNode>,
  links: NetworkLink[]
): boolean {
  if (node.type !== 'gateway' && node.interfaces.length < 2) return false;

  const connectedSubmeshes = new Set<string>();
  connectedSubmeshes.add(node.submeshId);

  for (const link of links) {
    if (link.isSevered || link.isJammed) continue;
    let peerId: string | null = null;
    if (link.source === node.id) peerId = link.target;
    else if (link.target === node.id) peerId = link.source;

    if (peerId) {
      const peer = nodesMap.get(peerId);
      if (peer && peer.isAlive) {
        connectedSubmeshes.add(peer.submeshId);
      }
    }
  }

  return connectedSubmeshes.size > 1 || node.interfaces.length >= 2;
}

/**
 * Finds all boundary gateways capable of bridging two submeshes
 */
export function findBoundaryGateways(
  submeshAId: string,
  submeshBId: string,
  nodes: Map<string, MeshNode>,
  links: NetworkLink[]
): MeshNode[] {
  const gateways: MeshNode[] = [];

  for (const node of nodes.values()) {
    if (!node.isAlive) continue;

    // Check if node itself is configured as gateway with interfaces in both domains
    if (node.type === 'gateway') {
      const hasSubmeshA = node.submeshId === submeshAId;
      const hasSubmeshB = node.submeshId === submeshBId;
      
      // Dual interface check
      const hasDualRadios = node.interfaces.length >= 2;
      if (hasDualRadios && (hasSubmeshA || hasSubmeshB)) {
        gateways.push(node);
        continue;
      }

      // Or check if this gateway has direct links to the other submesh
      let connectedToOther = false;
      for (const link of links) {
        if (link.isSevered || link.isJammed) continue;
        if (link.source === node.id) {
          const peer = nodes.get(link.target);
          if (peer && peer.submeshId === (hasSubmeshA ? submeshBId : submeshAId)) {
            connectedToOther = true;
            break;
          }
        } else if (link.target === node.id) {
          const peer = nodes.get(link.source);
          if (peer && peer.submeshId === (hasSubmeshA ? submeshBId : submeshAId)) {
            connectedToOther = true;
            break;
          }
        }
      }

      if (connectedToOther) {
        gateways.push(node);
      }
    }
  }

  return gateways;
}

/**
 * Gets the designated boundary gateway for a node trying to reach an external submesh
 */
export function getLocalGatewayForSubmesh(
  sourceSubmeshId: string,
  targetSubmeshId: string,
  nodes: Map<string, MeshNode>,
  links: NetworkLink[]
): MeshNode | null {
  const boundaryGateways = findBoundaryGateways(sourceSubmeshId, targetSubmeshId, nodes, links);
  
  // Prefer gateways located directly in sourceSubmeshId
  const localGateway = boundaryGateways.find(gw => gw.submeshId === sourceSubmeshId && gw.isAlive);
  if (localGateway) return localGateway;

  // Fallback to any active boundary gateway
  return boundaryGateways.find(gw => gw.isAlive) || null;
}

/**
 * Calculates estimated gateway processing and MRMC channel transition delay
 */
export function calculateGatewayDelay(
  gateway: MeshNode,
  ingressSubmesh?: SubMeshDomain,
  egressSubmesh?: SubMeshDomain
): number {
  let delay = GATEWAY_BASE_PROCESSING_DELAY_MS;

  // Multi-Radio Multi-Channel (MRMC) switching delay if cross-frequency transition
  if (ingressSubmesh && egressSubmesh && ingressSubmesh.frequencyBand !== egressSubmesh.frequencyBand) {
    delay += 3.5; // Additional radio RF front-end synthesis / queue handoff delay
  }

  // Queue congestion factor
  if (gateway.currentQueue && gateway.queueCapacity > 0) {
    const queueRatio = gateway.currentQueue.length / gateway.queueCapacity;
    delay += queueRatio * 15.0;
  }

  return Math.round(delay * 10) / 10;
}

/**
 * Resolves MRMC network interface for a given target submesh frequency/channel
 */
export function getMRMCInterfaceBinding(
  gateway: MeshNode,
  targetSubmesh: SubMeshDomain
): NetworkInterface {
  const match = gateway.interfaces.find(i => i.frequencyBand === targetSubmesh.frequencyBand);
  if (match) return match;

  // Fallback to highest bandwidth interface or first interface
  return gateway.interfaces[0] || {
    id: `if_${gateway.id}_fallback`,
    type: targetSubmesh.protocol === 'RPL' ? 'zigbee' : 'wifi',
    mac: '00:1A:2B:FF:00:01',
    channel: targetSubmesh.channelNumber,
    frequencyBand: targetSubmesh.frequencyBand,
    txPowerDbm: 20,
    bandwidthMbps: 54
  };
}

/**
 * Translates packet headers across heterogeneous protocols at boundary gateway
 * E.g., translates 802.11s 6-address Mesh Header to 6LoWPAN / IPv6 RPL Header
 */
export function translatePacketHeader(
  packet: Packet,
  gateway: MeshNode,
  ingressSubmesh: SubMeshDomain,
  egressSubmesh: SubMeshDomain,
  currentSimTimeMs: number
): { packet: Packet; trace: HeaderTranslationTrace } {
  // Determine ingress and egress interfaces on this gateway
  const ingressIface = gateway.interfaces.find(i => i.frequencyBand === ingressSubmesh.frequencyBand) || gateway.interfaces[0];
  const egressIface = gateway.interfaces.find(i => i.frequencyBand === egressSubmesh.frequencyBand) || gateway.interfaces[1] || gateway.interfaces[0];

  const rawHeaderBefore = {
    standard: ingressSubmesh.protocol === 'HWMP' ? 'IEEE 802.11s WLAN Mesh' : ingressSubmesh.protocol === 'RPL' ? '6LoWPAN / IEEE 802.15.4' : 'IEEE 802.11 Ad-Hoc',
    protocol: ingressSubmesh.protocol,
    meshTTL: 32,
    meshSequence: packet.sequenceNum,
    sourceMAC: ingressIface?.mac || '00:1A:2B:3C:4D:01',
    radioFreq: ingressSubmesh.frequencyBand,
    channel: ingressIface?.channel || ingressSubmesh.channelNumber,
    bandwidth: `${ingressIface?.bandwidthMbps || 54} Mbps`
  };

  const rawHeaderAfter = {
    standard: egressSubmesh.protocol === 'RPL' ? '6LoWPAN / IEEE 802.15.4' : egressSubmesh.protocol === 'HWMP' ? 'IEEE 802.11s WLAN Mesh' : 'IEEE 802.11 Ad-Hoc',
    protocol: egressSubmesh.protocol,
    ipV6HopLimit: 64,
    rplInstanceId: '0x01',
    rplRank: gateway.rplRank || 1,
    sourceMAC: egressIface?.mac || '00:1A:2B:3C:4D:02',
    radioFreq: egressSubmesh.frequencyBand,
    channel: egressIface?.channel || egressSubmesh.channelNumber,
    bandwidth: `${egressIface?.bandwidthMbps || 54} Mbps`
  };

  const translationSteps: GatewayTranslationStep[] = [
    {
      step: 1,
      name: 'L2 Header Stripping & CRC Check',
      description: `Ingress frame CRC validated; removed ${rawHeaderBefore.standard} preamble & frame control.`,
      layer: 'L2-MAC',
      status: 'completed',
      details: { ingressMac: ingressIface?.mac, strippedBytes: 24 }
    },
    {
      step: 2,
      name: 'MRMC Dual-Radio Queue Transition',
      description: `Crossed MRMC bus from ${ingressSubmesh.frequencyBand} (CH ${ingressIface?.channel || ingressSubmesh.channelNumber}) to ${egressSubmesh.frequencyBand} (CH ${egressIface?.channel || egressSubmesh.channelNumber}).`,
      layer: 'L1-PHY',
      status: 'completed',
      details: { busTransferTimeMs: 1.8, queueDelayMs: 4.2 }
    },
    {
      step: 3,
      name: 'L3 Protocol Translation & Rank Remap',
      description: `Protocol translated: ${ingressSubmesh.protocol} -> ${egressSubmesh.protocol}. Remapped routing tables & DAG hierarchy.`,
      layer: 'L3-NET',
      status: 'completed',
      details: { fromProtocol: ingressSubmesh.protocol, toProtocol: egressSubmesh.protocol, rplRank: gateway.rplRank || 1 }
    },
    {
      step: 4,
      name: 'L2 Re-Encapsulation & Channel Scheduling',
      description: `Constructed ${rawHeaderAfter.standard} header with MAC ${egressIface?.mac}; scheduled for CSMA/CA airtime.`,
      layer: 'L2-MAC',
      status: 'completed',
      details: { egressMac: egressIface?.mac, encapsulatedBytes: 28 }
    }
  ];

  const updatedPacket: Packet = {
    ...packet,
    state: 'translated',
    protocolTrace: [...packet.protocolTrace, egressSubmesh.protocol]
  };

  const trace: HeaderTranslationTrace = {
    timestampSimMs: currentSimTimeMs,
    gatewayId: gateway.id,
    ingressSubmeshId: ingressSubmesh.id,
    egressSubmeshId: egressSubmesh.id,
    ingressProtocol: ingressSubmesh.protocol,
    egressProtocol: egressSubmesh.protocol,
    ingressChannel: ingressIface?.channel || ingressSubmesh.channelNumber,
    egressChannel: egressIface?.channel || egressSubmesh.channelNumber,
    ingressMac: ingressIface?.mac || '00:1A:2B:3C:4D:01',
    egressMac: egressIface?.mac || '00:1A:2B:3C:4D:02',
    rawHeaderBefore,
    rawHeaderAfter,
    mrmcSwitchTimeMs: 3.5,
    translationSteps
  };

  return { packet: updatedPacket, trace };
}

/**
 * Builds a comprehensive 5-layer OSI inspection snapshot for any node/link state
 */
export function buildOsiLayerInspection(
  packet: Packet,
  currentNode: MeshNode,
  nextNode: MeshNode | null,
  link: NetworkLink | null,
  submesh: SubMeshDomain | null
): OsiLayerInspection {
  const currentIface = currentNode.interfaces[0];
  const nextIface = nextNode?.interfaces[0];

  const freq = submesh?.frequencyBand || '2.4GHz';
  const protocol = submesh?.protocol || 'HWMP';
  const channel = currentIface?.channel || submesh?.channelNumber || 6;
  const bw = link?.bandwidthMbps || currentIface?.bandwidthMbps || 54;
  const snr = link?.snrDb ?? 28.5;
  const per = link?.lossRate ?? 0.01;
  const dist = link?.distanceMeters ?? 15.0;

  let modulation = 'OFDM / 64-QAM';
  if (protocol === 'RPL') modulation = 'O-QPSK (DSSS 250 kbps)';
  else if (freq === '5.2GHz') modulation = '1024-QAM (Wi-Fi 6)';

  let frameStandard = 'IEEE 802.11s Mesh Frame (6-Addr)';
  if (protocol === 'RPL') frameStandard = 'IEEE 802.15.4 / 6LoWPAN';
  else if (protocol === 'AODV' || protocol === 'OLSR') frameStandard = 'IEEE 802.11 Ad-Hoc Frame';

  const protocolSpecificHeaders: Record<string, any> = {};
  if (protocol === 'HWMP') {
    protocolSpecificHeaders['meshTTL'] = 32 - packet.hops;
    protocolSpecificHeaders['meshSeqNum'] = packet.sequenceNum;
    protocolSpecificHeaders['airtimeMetricALM'] = (1.2 * (packet.hops + 1)).toFixed(2);
  } else if (protocol === 'RPL') {
    protocolSpecificHeaders['dodagRoot'] = 'node_gw_core';
    protocolSpecificHeaders['rplRank'] = currentNode.rplRank || (packet.hops + 1);
    protocolSpecificHeaders['instanceId'] = '0x01';
  } else if (protocol === 'AODV') {
    protocolSpecificHeaders['rreqId'] = 104;
    protocolSpecificHeaders['destSeqNum'] = 240;
    protocolSpecificHeaders['hopCount'] = packet.hops;
  } else if (protocol === 'OLSR') {
    protocolSpecificHeaders['mprSelector'] = currentNode.mprNeighbors?.join(', ') || 'Self';
    protocolSpecificHeaders['ansn'] = 42;
    protocolSpecificHeaders['vtime'] = '6.0s';
  }

  return {
    layer1Physical: {
      name: 'Layer 1 — Physical (PHY)',
      frequencyBand: freq,
      channel,
      channelWidthMhz: submesh?.channelWidthMhz || 20,
      txPowerDbm: currentNode.txPowerDbm,
      modulation,
      snrDb: Math.round(snr * 10) / 10,
      per: Math.round(per * 1000) / 10,
      distanceMeters: Math.round(dist * 10) / 10,
    },
    layer2DataLink: {
      name: 'Layer 2 — Data Link & MAC',
      frameStandard,
      sourceMac: currentIface?.mac || `00:1A:2B:${currentNode.id.slice(-2)}:01`,
      destMac: nextIface?.mac || (nextNode ? `00:1A:2B:${nextNode.id.slice(-2)}:01` : 'FF:FF:FF:FF:FF:FF'),
      macFrameType: 'Data (Mesh Forwarding QoS)',
      channelAccess: protocol === 'RPL' ? 'Slotted CSMA/CA' : 'EDCA / CSMA/CA',
      meshTtl: 32 - packet.hops,
      sequenceNum: packet.sequenceNum,
    },
    layer3Network: {
      name: 'Layer 3 — Network & Routing',
      protocol,
      ingressDomain: packet.submeshSrc,
      egressDomain: packet.submeshDst,
      routingCostMetric: Math.round((50 / Math.max(bw, 1) + 1.5 * packet.hops) * 100) / 100,
      hopCount: packet.hops,
      ttl: 64 - packet.hops,
      nextHopId: nextNode?.id,
      protocolSpecificHeaders,
    },
    layer4Transport: {
      name: 'Layer 4 — Transport',
      protocol: 'UDP',
      srcPort: 5683, // CoAP default port
      dstPort: 5683,
      payloadSizeBytes: packet.payloadSizeBytes || 512,
      checksum: '0x8F4E (Valid)',
      windowSize: 64240,
    },
    layer7Application: {
      name: 'Layer 7 — Application',
      payloadType: packet.payload,
      payloadSummary: packet.payload.includes('Telemetry')
        ? '{"sensor_id":"TMP-01","temp_c":24.6,"humidity_pct":48.2,"status":"NOMINAL"}'
        : packet.payload,
      dataRateKbps: Math.round(bw * 1000),
      generatedAtSimMs: packet.createdAtSimTime,
    }
  };
}
