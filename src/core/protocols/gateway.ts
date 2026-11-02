/**
 * Inter-Domain Gateway Bridging & Protocol Translation Engine
 * Handles boundary gateway discovery, multi-interface channel binding,
 * and heterogeneous frame translation (HWMP <-> RPL <-> AODV <-> OLSR)
 */

import { MeshNode, NetworkLink, Packet, ProtocolType, SubMeshDomain } from '../../types/simulator';

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
  };

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
    rawHeaderAfter
  };

  return { packet: updatedPacket, trace };
}
