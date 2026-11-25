/**
 * Inter-Domain Gateway Bridging & Protocol Translation Engine
 * Handles boundary gateway discovery, multi-interface domain/channel binding,
 * heterogeneous frame translation (HWMP <-> RPL <-> AODV <-> OLSR),
 * and live OSI 5-layer inspection.
 */

import {
  MeshNode,
  NetworkInterface,
  NetworkLink,
  Packet,
  ProtocolType,
  SimulationConfig,
  SubMeshDomain,
} from '../../types/simulator';

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
  gatewayDelayMs?: number;
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
 * Resolves an active (isUp !== false) interface on a node bound to a given SubMeshDomain.
 */
export function resolveActiveInterfaceForSubmesh(
  node: MeshNode,
  submesh: SubMeshDomain | undefined
): NetworkInterface | null {
  if (!node.isAlive || !submesh) return null;

  const activeIfaces = node.interfaces.filter(i => i.isUp !== false);
  if (activeIfaces.length === 0) return null;

  // 1. Explicit submeshId binding takes strict precedence
  const explicitMatch = activeIfaces.find(i => i.submeshId === submesh.id);
  if (explicitMatch) return explicitMatch;

  // 2. If any interface explicitly claims a submeshId, don't hijack a differently-bound NIC
  const unboundIfaces = activeIfaces.filter(i => !i.submeshId);

  // 3. Exact band + channel match among unbound interfaces
  const exactRfMatch = unboundIfaces.find(
    i => i.frequencyBand === submesh.frequencyBand && i.channel === submesh.channelNumber
  );
  if (exactRfMatch) return exactRfMatch;

  // 4. Band match among unbound interfaces
  const bandMatch = unboundIfaces.find(i => i.frequencyBand === submesh.frequencyBand);
  if (bandMatch) return bandMatch;

  // 5. Non-gateway nodes in the submesh can fall back to their primary active NIC if unbound
  if (node.type !== 'gateway' && node.submeshId === submesh.id && unboundIfaces.length > 0) {
    return unboundIfaces[0];
  }

  return null;
}

/**
 * Checks whether a gateway has an active (isUp !== false) interface serving a submesh.
 */
export function gatewayHasActiveInterfaceForSubmesh(
  gateway: MeshNode,
  submesh: SubMeshDomain | undefined
): boolean {
  if (!gateway.isAlive || gateway.type !== 'gateway' || !submesh) return false;
  return resolveActiveInterfaceForSubmesh(gateway, submesh) !== null;
}

/**
 * Returns all domain IDs that a node actively participates in.
 */
export function getGatewayBoundSubmeshIds(
  node: MeshNode,
  submeshes?: Map<string, SubMeshDomain>
): string[] {
  const ids = new Set<string>();
  if (node.type !== 'gateway') {
    ids.add(node.submeshId);
    return Array.from(ids);
  }

  for (const iface of node.interfaces) {
    if (iface.isUp === false) continue;
    if (iface.submeshId) {
      ids.add(iface.submeshId);
    } else if (submeshes) {
      for (const sm of submeshes.values()) {
        if (iface.frequencyBand === sm.frequencyBand && iface.channel === sm.channelNumber) {
          ids.add(sm.id);
        }
      }
    }
  }

  // Fallback for gateways whose interfaces didn't specify submeshId
  if (ids.size === 0 && node.interfaces.some(i => i.isUp !== false)) {
    ids.add(node.submeshId);
  }

  return Array.from(ids);
}

/**
 * Checks whether a node acts as a boundary gateway bridging multiple submeshes.
 */
export function isBoundaryGateway(
  node: MeshNode,
  nodesMap: Map<string, MeshNode>,
  links: NetworkLink[],
  submeshes?: Map<string, SubMeshDomain>
): boolean {
  if (!node.isAlive || node.type !== 'gateway') return false;

  const activeIfaces = node.interfaces.filter(i => i.isUp !== false);
  if (activeIfaces.length < 2) return false;

  const boundSubmeshes = new Set<string>(getGatewayBoundSubmeshIds(node, submeshes));
  for (const link of links) {
    if (link.isSevered || link.isJammed || link.isViable === false) continue;
    const peerId = link.source === node.id ? link.target : link.target === node.id ? link.source : null;
    if (!peerId) continue;
    const peer = nodesMap.get(peerId);
    if (peer && peer.isAlive) {
      boundSubmeshes.add(peer.submeshId);
    }
  }

  return boundSubmeshes.size >= 2;
}

/**
 * Finds all active boundary gateways capable of bridging submeshAId <-> submeshBId.
 */
export function findBoundaryGateways(
  submeshAId: string,
  submeshBId: string,
  nodes: Map<string, MeshNode>,
  links: NetworkLink[],
  submeshes?: Map<string, SubMeshDomain>
): MeshNode[] {
  const gateways: MeshNode[] = [];
  const smA = submeshes?.get(submeshAId);
  const smB = submeshes?.get(submeshBId);

  for (const node of nodes.values()) {
    if (!node.isAlive || node.type !== 'gateway') continue;

    if (smA && smB) {
      if (
        gatewayHasActiveInterfaceForSubmesh(node, smA) &&
        gatewayHasActiveInterfaceForSubmesh(node, smB)
      ) {
        gateways.push(node);
      }
      continue;
    }

    // Fallback when submeshes map wasn't supplied by caller
    const activeIfaces = node.interfaces.filter(i => i.isUp !== false);
    if (activeIfaces.length < 2) continue;

    const boundIds = new Set(getGatewayBoundSubmeshIds(node));
    for (const link of links) {
      if (link.isSevered || link.isJammed || link.isViable === false) continue;
      const peerId = link.source === node.id ? link.target : link.target === node.id ? link.source : null;
      const peer = peerId ? nodes.get(peerId) : undefined;
      if (peer && peer.isAlive) boundIds.add(peer.submeshId);
    }

    if (boundIds.has(submeshAId) && boundIds.has(submeshBId)) {
      gateways.push(node);
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
  links: NetworkLink[],
  submeshes?: Map<string, SubMeshDomain>
): MeshNode | null {
  const boundaryGateways = findBoundaryGateways(
    sourceSubmeshId,
    targetSubmeshId,
    nodes,
    links,
    submeshes
  );

  // Prefer gateways located directly in sourceSubmeshId with lower queue load
  const sorted = [...boundaryGateways].sort((a, b) => {
    const aLocal = a.submeshId === sourceSubmeshId ? 0 : 1;
    const bLocal = b.submeshId === sourceSubmeshId ? 0 : 1;
    if (aLocal !== bLocal) return aLocal - bLocal;
    const aLoad = (a.currentQueue?.length || 0) / Math.max(a.queueCapacity, 1);
    const bLoad = (b.currentQueue?.length || 0) / Math.max(b.queueCapacity, 1);
    return aLoad - bLoad;
  });

  return sorted[0] || null;
}

/**
 * Calculates gateway processing, queue congestion, protocol translation, and MRMC RF retuning delay.
 */
export function calculateGatewayDelay(
  gateway: MeshNode,
  ingressSubmesh?: SubMeshDomain,
  egressSubmesh?: SubMeshDomain
): number {
  if (!gateway.isAlive) return Infinity;
  if (ingressSubmesh && !gatewayHasActiveInterfaceForSubmesh(gateway, ingressSubmesh)) {
    return Infinity;
  }
  if (egressSubmesh && !gatewayHasActiveInterfaceForSubmesh(gateway, egressSubmesh)) {
    return Infinity;
  }

  let delay = GATEWAY_BASE_PROCESSING_DELAY_MS;

  // Multi-Radio Multi-Channel (MRMC) RF front-end synthesis / channel switching delay
  if (ingressSubmesh && egressSubmesh) {
    if (ingressSubmesh.frequencyBand !== egressSubmesh.frequencyBand) {
      delay += 3.5;
    } else if (ingressSubmesh.channelNumber !== egressSubmesh.channelNumber) {
      delay += 1.5;
    }
    if (ingressSubmesh.protocol !== egressSubmesh.protocol) {
      delay += 2.5; // L3 header remap & address translation overhead
    }
  }

  // Real gateway queue congestion factor
  if (gateway.currentQueue && gateway.queueCapacity > 0) {
    const queueRatio = gateway.currentQueue.length / gateway.queueCapacity;
    delay += queueRatio * 20.0;
  }

  return Math.round(delay * 10) / 10;
}

/**
 * Resolves MRMC network interface for a given target submesh.
 */
export function getMRMCInterfaceBinding(
  gateway: MeshNode,
  targetSubmesh: SubMeshDomain
): NetworkInterface {
  const active = resolveActiveInterfaceForSubmesh(gateway, targetSubmesh);
  if (active) return active;

  const bandFallback = gateway.interfaces.find(
    i => i.isUp !== false && i.frequencyBand === targetSubmesh.frequencyBand
  );
  if (bandFallback) return bandFallback;

  return (
    gateway.interfaces.find(i => i.isUp !== false) ||
    gateway.interfaces[0] || {
      id: `if_${gateway.id}_fallback`,
      type: targetSubmesh.protocol === 'RPL' ? 'zigbee' : 'wifi',
      mac: '00:1A:2B:FF:00:01',
      channel: targetSubmesh.channelNumber,
      frequencyBand: targetSubmesh.frequencyBand,
      txPowerDbm: gateway.txPowerDbm ?? 20,
      bandwidthMbps: targetSubmesh.defaultBandwidthMbps ?? 54,
      submeshId: targetSubmesh.id,
      isUp: true,
    }
  );
}

function describeProtocolStandard(protocol: ProtocolType): string {
  switch (protocol) {
    case 'HWMP':
      return 'IEEE 802.11s WLAN Mesh';
    case 'RPL':
      return '6LoWPAN / IEEE 802.15.4';
    case 'OLSR':
      return 'IEEE 802.11 OLSR MANET';
    case 'AODV':
    default:
      return 'IEEE 802.11 Ad-Hoc';
  }
}

/**
 * Translates packet headers across heterogeneous submesh protocols at a boundary gateway.
 * Uses the hop's true ingressSubmesh -> egressSubmesh and checks interface isUp status.
 */
export function translatePacketHeader(
  packet: Packet,
  gateway: MeshNode,
  ingressSubmesh: SubMeshDomain,
  egressSubmesh: SubMeshDomain,
  currentSimTimeMs: number
): { packet: Packet; trace: HeaderTranslationTrace; ok: boolean; error?: string; gatewayDelayMs: number } {
  const ingressIface = resolveActiveInterfaceForSubmesh(gateway, ingressSubmesh);
  const egressIface = resolveActiveInterfaceForSubmesh(gateway, egressSubmesh);

  const mrmcSwitchTimeMs =
    ingressSubmesh.frequencyBand !== egressSubmesh.frequencyBand
      ? 3.5
      : ingressSubmesh.channelNumber !== egressSubmesh.channelNumber
      ? 1.5
      : 0.5;

  const queueDelayMs =
    gateway.queueCapacity > 0
      ? Math.round(((gateway.currentQueue?.length || 0) / gateway.queueCapacity) * 200) / 10
      : 0;

  const gatewayDelayMs = calculateGatewayDelay(gateway, ingressSubmesh, egressSubmesh);

  const fallbackIngressIface = ingressIface || gateway.interfaces[0];
  const fallbackEgressIface = egressIface || gateway.interfaces[1] || gateway.interfaces[0];

  const ingressStandard = describeProtocolStandard(ingressSubmesh.protocol);
  const egressStandard = describeProtocolStandard(egressSubmesh.protocol);
  const currentTtl = packet.ttl ?? 16;

  const rawHeaderBefore = {
    standard: ingressStandard,
    protocol: ingressSubmesh.protocol,
    domain: ingressSubmesh.name,
    ttl: currentTtl,
    meshSequence: packet.sequenceNum,
    sourceMAC: fallbackIngressIface?.mac || '00:1A:2B:3C:4D:01',
    radioFreq: ingressSubmesh.frequencyBand,
    channel: fallbackIngressIface?.channel ?? ingressSubmesh.channelNumber,
    bandwidth: `${fallbackIngressIface?.bandwidthMbps ?? ingressSubmesh.defaultBandwidthMbps ?? 54} Mbps`,
  };

  const rawHeaderAfter = {
    standard: egressStandard,
    protocol: egressSubmesh.protocol,
    domain: egressSubmesh.name,
    ttl: currentTtl,
    rplInstanceId: egressSubmesh.protocol === 'RPL' ? '0x01' : undefined,
    rplRank: gateway.rplState?.rank ?? gateway.rplRank ?? 1,
    sourceMAC: fallbackEgressIface?.mac || '00:1A:2B:3C:4D:02',
    radioFreq: egressSubmesh.frequencyBand,
    channel: fallbackEgressIface?.channel ?? egressSubmesh.channelNumber,
    bandwidth: `${fallbackEgressIface?.bandwidthMbps ?? egressSubmesh.defaultBandwidthMbps ?? 54} Mbps`,
  };

  const translationSteps: GatewayTranslationStep[] = [
    {
      step: 1,
      name: 'L2 Header Stripping & CRC Check',
      description: `Ingress frame CRC validated on ${ingressIface?.id || 'NIC'}; stripped ${ingressStandard} MAC header.`,
      layer: 'L2-MAC',
      status: 'completed',
      details: { ingressMac: fallbackIngressIface?.mac, strippedBytes: 24 },
    },
    {
      step: 2,
      name: 'MRMC Dual-Radio Queue Transition',
      description: `Crossed MRMC bus from ${ingressSubmesh.frequencyBand} (CH ${rawHeaderBefore.channel}) to ${egressSubmesh.frequencyBand} (CH ${rawHeaderAfter.channel}).`,
      layer: 'L1-PHY',
      status: 'completed',
      details: { busTransferTimeMs: mrmcSwitchTimeMs, queueDelayMs },
    },
    {
      step: 3,
      name: 'L3 Protocol Translation & Table Lookup',
      description: `Translated ${ingressSubmesh.protocol} -> ${egressSubmesh.protocol} across ${ingressSubmesh.name} → ${egressSubmesh.name}.`,
      layer: 'L3-NET',
      status: 'completed',
      details: {
        fromProtocol: ingressSubmesh.protocol,
        toProtocol: egressSubmesh.protocol,
        rplRank: rawHeaderAfter.rplRank,
      },
    },
    {
      step: 4,
      name: 'L2 Re-Encapsulation & Channel Scheduling',
      description: `Encapsulated ${egressStandard} header with MAC ${fallbackEgressIface?.mac}; queued on egress NIC.`,
      layer: 'L2-MAC',
      status: 'completed',
      details: { egressMac: fallbackEgressIface?.mac, encapsulatedBytes: 28 },
    },
  ];

  const trace: HeaderTranslationTrace = {
    timestampSimMs: currentSimTimeMs,
    gatewayId: gateway.id,
    ingressSubmeshId: ingressSubmesh.id,
    egressSubmeshId: egressSubmesh.id,
    ingressProtocol: ingressSubmesh.protocol,
    egressProtocol: egressSubmesh.protocol,
    ingressChannel: rawHeaderBefore.channel,
    egressChannel: rawHeaderAfter.channel,
    ingressMac: rawHeaderBefore.sourceMAC,
    egressMac: rawHeaderAfter.sourceMAC,
    rawHeaderBefore,
    rawHeaderAfter,
    mrmcSwitchTimeMs,
    gatewayDelayMs: Number.isFinite(gatewayDelayMs) ? gatewayDelayMs : 0,
    translationSteps,
  };

  if (!gateway.isAlive) {
    return {
      ok: false,
      error: `Destination Unreachable: Gateway "${gateway.name}" is offline`,
      gatewayDelayMs: 0,
      packet: { ...packet, state: 'dropped', dropReason: `Gateway "${gateway.name}" is offline` },
      trace,
    };
  }

  if (!ingressIface || !egressIface) {
    const missingDomain = !ingressIface ? ingressSubmesh.name : egressSubmesh.name;
    return {
      ok: false,
      error: `Destination Unreachable: Gateway "${gateway.name}" has no active interface for "${missingDomain}"`,
      gatewayDelayMs: 0,
      packet: {
        ...packet,
        state: 'dropped',
        dropReason: `Gateway "${gateway.name}" interface down for ${missingDomain}`,
      },
      trace,
    };
  }

  const nextProtoTrace =
    packet.protocolTrace[packet.protocolTrace.length - 1] === egressSubmesh.protocol
      ? [...packet.protocolTrace]
      : [...packet.protocolTrace, egressSubmesh.protocol];

  const updatedPacket: Packet = {
    ...packet,
    state: 'forwarded',
    currentSubmeshId: egressSubmesh.id,
    protocolTrace: nextProtoTrace,
    gatewayDelayMs: (packet.gatewayDelayMs || 0) + gatewayDelayMs,
  };

  return {
    ok: true,
    gatewayDelayMs,
    packet: updatedPacket,
    trace,
  };
}

/**
 * Builds a real 5-layer OSI inspection snapshot from live packet, node, link, interface, and config state.
 */
export function buildOsiLayerInspection(
  packet: Packet,
  currentNode: MeshNode,
  nextNode: MeshNode | null,
  link: NetworkLink | null,
  submesh: SubMeshDomain | null,
  config?: Partial<SimulationConfig>
): OsiLayerInspection {
  const currentIface =
    (submesh ? resolveActiveInterfaceForSubmesh(currentNode, submesh) : null) ||
    currentNode.interfaces.find(i => i.isUp !== false) ||
    currentNode.interfaces[0];
  const nextIface =
    (nextNode && submesh ? resolveActiveInterfaceForSubmesh(nextNode, submesh) : null) ||
    nextNode?.interfaces.find(i => i.isUp !== false) ||
    nextNode?.interfaces[0];

  const freq = link?.frequencyBand || submesh?.frequencyBand || currentIface?.frequencyBand || '2.4GHz';
  const protocol = submesh?.protocol || packet.protocolTrace[packet.protocolTrace.length - 1] || 'HWMP';
  const channel = link?.channel ?? currentIface?.channel ?? submesh?.channelNumber ?? 6;
  const bw = link?.bandwidthMbps ?? currentIface?.bandwidthMbps ?? submesh?.defaultBandwidthMbps ?? 54;
  const snr = link ? link.snrDb : 0;
  const per = link ? link.per ?? link.lossRate : 0;
  const dist = link ? link.distanceMeters : 0;

  let modulation = 'OFDM / 64-QAM';
  if (submesh?.technology === 'LoRa' || currentIface?.type === 'lora') {
    modulation = 'CSS (LoRa Chirp Spread Spectrum)';
  } else if (protocol === 'RPL' || currentIface?.type === 'zigbee' || currentIface?.type === 'thread') {
    modulation = 'O-QPSK (DSSS 250 kbps)';
  } else if (freq === '5.2GHz' || freq === '5.8GHz' || submesh?.technology === 'Wi-Fi 6') {
    modulation = '1024-QAM (OFDMA Wi-Fi 6)';
  }

  let frameStandard = 'IEEE 802.11s Mesh Frame (6-Addr)';
  if (protocol === 'RPL') frameStandard = 'IEEE 802.15.4 / 6LoWPAN';
  else if (protocol === 'AODV' || protocol === 'OLSR') frameStandard = 'IEEE 802.11 Ad-Hoc Frame';

  const ttlRemaining = packet.ttl ?? Math.max((config?.defaultTtl ?? 16) - packet.hops, 0);
  const protocolSpecificHeaders: Record<string, any> = {};

  if (protocol === 'HWMP') {
    const alm =
      currentNode.hwmpState?.reactivePaths[packet.dst]?.airtimeCost ??
      currentNode.hwmpState?.rootAirtimeMetric ??
      ((0.185 + (packet.payloadSizeBytes * 8) / (Math.max(bw, 0.25) * 1000)) / Math.max(1 - per, 0.01));
    protocolSpecificHeaders['meshTTL'] = ttlRemaining;
    protocolSpecificHeaders['meshSeqNum'] = currentNode.hwmpState?.prepSeqNum ?? packet.sequenceNum;
    protocolSpecificHeaders['airtimeMetricALM'] = Number(alm.toFixed(2));
    protocolSpecificHeaders['rootNodeId'] = currentNode.hwmpState?.rootNodeId || 'N/A';
  } else if (protocol === 'RPL') {
    protocolSpecificHeaders['dodagRoot'] = currentNode.rplState?.dodagId || 'Unattached';
    protocolSpecificHeaders['rplRank'] = currentNode.rplState?.rank ?? currentNode.rplRank ?? 1;
    protocolSpecificHeaders['preferredParent'] = currentNode.rplState?.preferredParentId || 'Root';
    protocolSpecificHeaders['instanceId'] = '0x01';
  } else if (protocol === 'AODV') {
    const aodvEntry = currentNode.aodvState?.routes[packet.dst];
    protocolSpecificHeaders['rreqId'] = currentNode.aodvState?.rreqId ?? 0;
    protocolSpecificHeaders['destSeqNum'] = aodvEntry?.destSeqNum ?? currentNode.aodvState?.seqNum ?? 1;
    protocolSpecificHeaders['hopCount'] = aodvEntry?.hopCount ?? packet.hops;
    protocolSpecificHeaders['routeValid'] = aodvEntry ? aodvEntry.valid : false;
  } else if (protocol === 'OLSR') {
    const mprs = currentNode.olsrState?.mprSet ?? currentNode.mprNeighbors ?? [];
    protocolSpecificHeaders['mprSet'] = mprs.length > 0 ? mprs.join(', ') : 'None';
    protocolSpecificHeaders['ansn'] = currentNode.olsrState?.ansn ?? 1;
    protocolSpecificHeaders['tcEntries'] = currentNode.olsrState?.tcTable.length ?? 0;
  }

  const routeEntry = currentNode.routingTable[packet.dst];
  const routingCostMetric =
    routeEntry?.cost ?? Math.round((50 / Math.max(bw, 0.25) + packet.hops) * 100) / 100;

  return {
    layer1Physical: {
      name: 'Layer 1 — Physical (PHY)',
      frequencyBand: freq,
      channel,
      channelWidthMhz: submesh?.channelWidthMhz || 20,
      txPowerDbm: currentIface?.txPowerDbm ?? currentNode.txPowerDbm,
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
      macFrameType: link ? 'Data (Mesh Forwarding QoS)' : 'Data (Local Buffer / Preview)',
      channelAccess: protocol === 'RPL' ? 'Slotted CSMA/CA' : 'EDCA / CSMA/CA',
      meshTtl: ttlRemaining,
      sequenceNum: packet.sequenceNum,
    },
    layer3Network: {
      name: 'Layer 3 — Network & Routing',
      protocol,
      ingressDomain: packet.submeshSrc,
      egressDomain: packet.submeshDst,
      routingCostMetric: Math.round(routingCostMetric * 100) / 100,
      hopCount: packet.hops,
      ttl: ttlRemaining,
      nextHopId: nextNode?.id || packet.nextHop,
      protocolSpecificHeaders,
    },
    layer4Transport: {
      name: 'Layer 4 — Transport',
      protocol: 'UDP',
      srcPort: 5683,
      dstPort: 5683,
      payloadSizeBytes: packet.payloadSizeBytes,
      checksum: `0x${((packet.sequenceNum * 2654435761) >>> 16).toString(16).toUpperCase().padStart(4, '0')}`,
      windowSize: currentNode.queueCapacity * 1024,
    },
    layer7Application: {
      name: 'Layer 7 — Application',
      payloadType: packet.payload,
      payloadSummary: packet.payload,
      dataRateKbps: Math.round(bw * 1000),
      generatedAtSimMs: packet.createdAtSimTime,
    },
  };
}
