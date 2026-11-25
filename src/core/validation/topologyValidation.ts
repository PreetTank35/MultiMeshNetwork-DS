/**
 * Topology, Link & Packet Injection Validation Subsystem
 * Non-mutating validation checks for builder, import, and simulation edge cases.
 */

import {
  FrequencyBand,
  MeshNode,
  NetworkLink,
  SubMeshDomain,
} from '../../types/simulator';
import { resolveActiveInterfaceForSubmesh } from '../protocols/gateway';

export interface ValidationIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  entityId?: string;
}

export interface TopologyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  issues: ValidationIssue[];
}

export interface ConnectionValidationResult {
  valid: boolean;
  reason?: string;
  error?: string;
}

export interface PacketInjectionValidationResult {
  valid: boolean;
  reason?: string;
  error?: string;
}

export interface ValidateTopologyOptions {
  allowEmpty?: boolean;
  allowSingleNode?: boolean;
}

const VALID_BANDS = new Set<FrequencyBand>(['2.4GHz', '5.2GHz', '5.8GHz', '915MHz', '868MHz']);

/**
 * Validates channel number against RF frequency band allocations.
 */
export function isValidChannelForBand(band: FrequencyBand, channel: number): boolean {
  if (!Number.isFinite(channel) || !Number.isInteger(channel)) return false;
  switch (band) {
    case '2.4GHz':
      // Covers 802.11 channels 1-14 and IEEE 802.15.4 channels 11-26
      return channel >= 1 && channel <= 26;
    case '5.2GHz':
      // UNII-1 / UNII-2A (36..64)
      return channel >= 32 && channel <= 68;
    case '5.8GHz':
      // UNII-3 (149..177)
      return channel >= 149 && channel <= 177;
    case '915MHz':
      // Sub-GHz US ISM 902-928 MHz channels
      return channel >= 0 && channel <= 64;
    case '868MHz':
      // Sub-GHz EU ISM 868 MHz channels
      return channel >= 0 && channel <= 16;
    default:
      return false;
  }
}

export function isValidTxPowerDbm(txPowerDbm: number): boolean {
  return Number.isFinite(txPowerDbm) && txPowerDbm > -30 && txPowerDbm <= 40;
}

/**
 * Validates a full multi-mesh topology without mutating or silently fixing inputs.
 */
export function validateTopology(
  submeshes: SubMeshDomain[] | Map<string, SubMeshDomain>,
  nodes: MeshNode[] | Map<string, MeshNode>,
  links: NetworkLink[],
  options?: ValidateTopologyOptions
): TopologyValidationResult {
  const issues: ValidationIssue[] = [];
  const submeshList = Array.isArray(submeshes) ? submeshes : Array.from(submeshes.values());
  const nodeList = Array.isArray(nodes) ? nodes : Array.from(nodes.values());

  const addIssue = (
    severity: 'error' | 'warning',
    code: string,
    message: string,
    entityId?: string
  ) => {
    issues.push({ severity, code, message, entityId });
  };

  // 1. Submesh domain checks
  if (submeshList.length === 0 && !options?.allowEmpty) {
    addIssue('error', 'EMPTY_SUBMESHES', 'Topology must define at least one sub-mesh domain.');
  }

  const submeshMap = new Map<string, SubMeshDomain>();
  const seenSubmeshIds = new Set<string>();
  const seenSubmeshNames = new Set<string>();

  for (const sm of submeshList) {
    if (!sm.id || !sm.id.trim()) {
      addIssue('error', 'INVALID_SUBMESH_ID', 'Sub-mesh domain is missing an ID.');
      continue;
    }
    if (seenSubmeshIds.has(sm.id)) {
      addIssue('error', 'DUPLICATE_SUBMESH_ID', `Duplicate sub-mesh ID "${sm.id}".`, sm.id);
    } else {
      seenSubmeshIds.add(sm.id);
      submeshMap.set(sm.id, sm);
    }

    const normName = (sm.name || '').trim().toLowerCase();
    if (!normName) {
      addIssue('error', 'EMPTY_SUBMESH_NAME', `Sub-mesh "${sm.id}" has an empty name.`, sm.id);
    } else if (seenSubmeshNames.has(normName)) {
      addIssue('error', 'DUPLICATE_SUBMESH_NAME', `Duplicate sub-mesh name "${sm.name}".`, sm.id);
    } else {
      seenSubmeshNames.add(normName);
    }

    if (!VALID_BANDS.has(sm.frequencyBand)) {
      addIssue(
        'error',
        'INVALID_FREQUENCY_BAND',
        `Sub-mesh "${sm.name}" has unsupported frequency band "${sm.frequencyBand}".`,
        sm.id
      );
    } else if (!isValidChannelForBand(sm.frequencyBand, sm.channelNumber)) {
      addIssue(
        'error',
        'INVALID_CHANNEL',
        `Sub-mesh "${sm.name}" has invalid channel ${sm.channelNumber} for ${sm.frequencyBand}.`,
        sm.id
      );
    }

    if (!Number.isFinite(sm.channelWidthMhz) || sm.channelWidthMhz <= 0) {
      addIssue(
        'error',
        'INVALID_CHANNEL_WIDTH',
        `Sub-mesh "${sm.name}" has invalid channelWidthMhz (${sm.channelWidthMhz}); must be > 0.`,
        sm.id
      );
    }

    if (
      sm.defaultBandwidthMbps !== undefined &&
      (!Number.isFinite(sm.defaultBandwidthMbps) || sm.defaultBandwidthMbps <= 0)
    ) {
      addIssue(
        'error',
        'INVALID_DOMAIN_BANDWIDTH',
        `Sub-mesh "${sm.name}" has invalid defaultBandwidthMbps (${sm.defaultBandwidthMbps}); must be > 0.`,
        sm.id
      );
    }
  }

  // 2. Node count checks
  if (nodeList.length === 0 && !options?.allowEmpty) {
    addIssue('error', 'EMPTY_TOPOLOGY', 'Topology is empty: at least 2 nodes are required.');
  } else if (nodeList.length === 1 && !options?.allowSingleNode && !options?.allowEmpty) {
    addIssue(
      'error',
      'SINGLE_NODE_TOPOLOGY',
      'Topology contains only 1 node: at least 2 nodes are required.'
    );
  }

  // 3. Node checks
  const nodeMap = new Map<string, MeshNode>();
  const seenNodeIds = new Set<string>();
  const seenNodeNames = new Set<string>();

  for (const node of nodeList) {
    if (!node.id || !node.id.trim()) {
      addIssue('error', 'INVALID_NODE_ID', 'Node is missing a valid ID.');
      continue;
    }
    if (seenNodeIds.has(node.id)) {
      addIssue('error', 'DUPLICATE_NODE_ID', `Duplicate node ID "${node.id}".`, node.id);
    } else {
      seenNodeIds.add(node.id);
      nodeMap.set(node.id, node);
    }

    const normName = (node.name || '').trim().toLowerCase();
    if (!normName) {
      addIssue('error', 'EMPTY_NODE_NAME', `Node "${node.id}" has an empty name.`, node.id);
    } else if (seenNodeNames.has(normName)) {
      addIssue('error', 'DUPLICATE_NODE_NAME', `Duplicate node name "${node.name}".`, node.id);
    } else {
      seenNodeNames.add(normName);
    }

    if (!node.submeshId || !submeshMap.has(node.submeshId)) {
      addIssue(
        'error',
        'DANGLING_NODE_SUBMESH',
        `Node "${node.name || node.id}" references missing sub-mesh "${node.submeshId}".`,
        node.id
      );
    }

    if (!Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)) {
      addIssue(
        'error',
        'INVALID_POSITION',
        `Node "${node.name || node.id}" has invalid coordinates.`,
        node.id
      );
    }

    if (!isValidTxPowerDbm(node.txPowerDbm)) {
      addIssue(
        'error',
        'INVALID_TX_POWER',
        `Node "${node.name || node.id}" has invalid TX power (${node.txPowerDbm} dBm); expected (-30, 40].`,
        node.id
      );
    }

    if (!Number.isFinite(node.queueCapacity) || node.queueCapacity <= 0) {
      addIssue(
        'error',
        'INVALID_QUEUE_CAPACITY',
        `Node "${node.name || node.id}" has invalid queueCapacity (${node.queueCapacity}); must be > 0.`,
        node.id
      );
    }

    // Interface checks
    if (!Array.isArray(node.interfaces) || node.interfaces.length === 0) {
      addIssue(
        'warning',
        'NO_INTERFACES',
        `Node "${node.name || node.id}" has no configured network interfaces.`,
        node.id
      );
    } else {
      for (const iface of node.interfaces) {
        if (!isValidTxPowerDbm(iface.txPowerDbm)) {
          addIssue(
            'error',
            'INVALID_INTERFACE_TX_POWER',
            `Interface "${iface.id}" on "${node.name}" has invalid TX power (${iface.txPowerDbm} dBm).`,
            node.id
          );
        }
        if (!Number.isFinite(iface.bandwidthMbps) || iface.bandwidthMbps <= 0) {
          addIssue(
            'error',
            'INVALID_INTERFACE_BANDWIDTH',
            `Interface "${iface.id}" on "${node.name}" has invalid bandwidthMbps (${iface.bandwidthMbps}).`,
            node.id
          );
        }
        if (!VALID_BANDS.has(iface.frequencyBand)) {
          addIssue(
            'error',
            'INVALID_INTERFACE_BAND',
            `Interface "${iface.id}" on "${node.name}" has invalid frequency band "${iface.frequencyBand}".`,
            node.id
          );
        } else if (!isValidChannelForBand(iface.frequencyBand, iface.channel)) {
          addIssue(
            'error',
            'INVALID_INTERFACE_CHANNEL',
            `Interface "${iface.id}" on "${node.name}" has invalid channel ${iface.channel} for ${iface.frequencyBand}.`,
            node.id
          );
        }
        if (iface.submeshId && !submeshMap.has(iface.submeshId)) {
          addIssue(
            'error',
            'DANGLING_INTERFACE_SUBMESH',
            `Interface "${iface.id}" on "${node.name}" references unknown sub-mesh "${iface.submeshId}".`,
            node.id
          );
        }
      }
    }

    // Gateway domain coverage check
    if (node.type === 'gateway') {
      const activeIfaces = (node.interfaces || []).filter(i => i.isUp !== false);
      const coveredDomains = new Set<string>();
      for (const iface of activeIfaces) {
        if (iface.submeshId && submeshMap.has(iface.submeshId)) {
          coveredDomains.add(iface.submeshId);
        } else {
          for (const sm of submeshList) {
            if (
              iface.frequencyBand === sm.frequencyBand &&
              iface.channel === sm.channelNumber
            ) {
              coveredDomains.add(sm.id);
            }
          }
        }
      }
      if (activeIfaces.length < 2 || coveredDomains.size < 2) {
        addIssue(
          'error',
          'INVALID_GATEWAY',
          `Gateway "${node.name || node.id}" is invalid: requires at least 2 active interfaces serving distinct sub-mesh domains (found ${activeIfaces.length} active NICs covering ${coveredDomains.size} domain(s)).`,
          node.id
        );
      }
    }
  }

  // 4. Link checks
  const seenLinkIds = new Set<string>();
  const seenLinkPairs = new Set<string>();
  const connectedNodes = new Set<string>();

  for (const link of links) {
    if (!link.id || !link.id.trim()) {
      addIssue('error', 'INVALID_LINK_ID', 'Link is missing a valid ID.');
    } else if (seenLinkIds.has(link.id)) {
      addIssue('error', 'DUPLICATE_LINK_ID', `Duplicate link ID "${link.id}".`, link.id);
    } else {
      seenLinkIds.add(link.id);
    }

    if (link.source === link.target) {
      addIssue(
        'error',
        'SELF_LOOP_LINK',
        `Self-loop link detected on node "${link.source}".`,
        link.id
      );
      continue;
    }

    const srcNode = nodeMap.get(link.source);
    const dstNode = nodeMap.get(link.target);
    if (!srcNode || !dstNode) {
      addIssue(
        'error',
        'DANGLING_LINK_ENDPOINT',
        `Link "${link.id}" references missing endpoint(s): "${link.source}" -> "${link.target}".`,
        link.id
      );
      continue;
    }

    const pairKey =
      link.source < link.target
        ? `${link.source}::${link.target}`
        : `${link.target}::${link.source}`;
    if (seenLinkPairs.has(pairKey)) {
      addIssue(
        'error',
        'DUPLICATE_LINK',
        `Duplicate link between "${srcNode.name}" and "${dstNode.name}".`,
        link.id
      );
    } else {
      seenLinkPairs.add(pairKey);
    }

    if (!Number.isFinite(link.bandwidthMbps) || link.bandwidthMbps <= 0) {
      addIssue(
        'error',
        'INVALID_LINK_BANDWIDTH',
        `Link "${link.id}" has invalid bandwidthMbps (${link.bandwidthMbps}); must be > 0.`,
        link.id
      );
    }

    if (!link.isSevered) {
      connectedNodes.add(link.source);
      connectedNodes.add(link.target);
    }

    const srcSm = submeshMap.get(srcNode.submeshId);
    const dstSm = submeshMap.get(dstNode.submeshId);

    if (srcNode.submeshId !== dstNode.submeshId) {
      if (srcNode.type !== 'gateway' && dstNode.type !== 'gateway') {
        addIssue(
          'error',
          'CROSS_DOMAIN_NON_GATEWAY',
          `Invalid cross-domain link "${link.id}": "${srcNode.name}" (${srcSm?.name || srcNode.submeshId}) and "${dstNode.name}" (${dstSm?.name || dstNode.submeshId}) cannot connect directly without a boundary gateway.`,
          link.id
        );
      } else {
        // Verify gateway endpoint has active interface serving peer submesh
        const gwNode = srcNode.type === 'gateway' ? srcNode : dstNode;
        const peerSm = srcNode.type === 'gateway' ? dstSm : srcSm;
        const gwSm = srcNode.type === 'gateway' ? srcSm : dstSm;
        const hasPeerNic = peerSm ? resolveActiveInterfaceForSubmesh(gwNode, peerSm) : null;
        const hasOwnNic = gwSm ? resolveActiveInterfaceForSubmesh(gwNode, gwSm) : null;
        if (peerSm && !hasPeerNic) {
          addIssue(
            'error',
            'GATEWAY_MISSING_DOMAIN_INTERFACE',
            `Cross-domain link "${link.id}" is invalid: gateway "${gwNode.name}" has no active interface for domain "${peerSm.name}" (${peerSm.frequencyBand} CH ${peerSm.channelNumber}).`,
            link.id
          );
        }
        if (gwSm && !hasOwnNic) {
          addIssue(
            'error',
            'GATEWAY_MISSING_OWN_INTERFACE',
            `Gateway "${gwNode.name}" has no active interface for its primary domain "${gwSm.name}".`,
            link.id
          );
        }
      }
    } else if (srcSm && link.frequencyBand && link.frequencyBand !== srcSm.frequencyBand) {
      addIssue(
        'error',
        'LINK_BAND_MISMATCH',
        `Link "${link.id}" frequency (${link.frequencyBand}) does not match sub-mesh "${srcSm.name}" (${srcSm.frequencyBand}).`,
        link.id
      );
    }
  }

  for (const node of nodeList) {
    if (nodeList.length >= 2 && !connectedNodes.has(node.id)) {
      addIssue(
        'warning',
        'ISOLATED_NODE',
        `Node "${node.name}" has no active links and is isolated from the mesh.`,
        node.id
      );
    }
  }

  const errors = issues.filter(i => i.severity === 'error').map(i => i.message);
  const warnings = issues.filter(i => i.severity === 'warning').map(i => i.message);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    issues,
  };
}

/**
 * Validates whether a new link can be created between sourceNode and targetNode.
 * Rejects self-loops, duplicates, and incompatible cross-domain non-gateway links.
 */
export function validateLinkConnection(
  sourceNode: MeshNode | undefined,
  targetNode: MeshNode | undefined,
  submeshes: SubMeshDomain[] | Map<string, SubMeshDomain>,
  existingLinks: NetworkLink[]
): ConnectionValidationResult {
  if (!sourceNode || !targetNode) {
    const reason = 'Source or target node does not exist.';
    return { valid: false, reason, error: reason };
  }

  if (sourceNode.id === targetNode.id) {
    const reason = 'Self-loop links are not allowed: choose two different nodes.';
    return { valid: false, reason, error: reason };
  }

  const duplicate = existingLinks.some(
    l =>
      (l.source === sourceNode.id && l.target === targetNode.id) ||
      (l.source === targetNode.id && l.target === sourceNode.id)
  );
  if (duplicate) {
    const reason = `Duplicate link: "${sourceNode.name}" and "${targetNode.name}" are already connected.`;
    return { valid: false, reason, error: reason };
  }

  const submeshMap = Array.isArray(submeshes)
    ? new Map(submeshes.map(s => [s.id, s]))
    : submeshes;

  const srcSm = submeshMap.get(sourceNode.submeshId);
  const dstSm = submeshMap.get(targetNode.submeshId);

  if (sourceNode.submeshId !== targetNode.submeshId) {
    if (sourceNode.type !== 'gateway' && targetNode.type !== 'gateway') {
      const reason = `Cross-domain connection rejected: "${sourceNode.name}" (${srcSm?.name || sourceNode.submeshId}, ${srcSm?.frequencyBand || '?'}) and "${targetNode.name}" (${dstSm?.name || targetNode.submeshId}, ${dstSm?.frequencyBand || '?'}) are in incompatible domains. Connect through a Boundary Gateway.`;
      return { valid: false, reason, error: reason };
    }

    // Validate gateway active radio interface matches peer domain
    if (sourceNode.type === 'gateway' && targetNode.type === 'gateway') {
      const sCanBridge =
        srcSm && dstSm &&
        resolveActiveInterfaceForSubmesh(sourceNode, srcSm) &&
        resolveActiveInterfaceForSubmesh(sourceNode, dstSm);
      const tCanBridge =
        srcSm && dstSm &&
        resolveActiveInterfaceForSubmesh(targetNode, srcSm) &&
        resolveActiveInterfaceForSubmesh(targetNode, dstSm);
      if (!sCanBridge && !tCanBridge) {
        const reason = `Incompatible gateway interfaces: neither "${sourceNode.name}" nor "${targetNode.name}" bridges both "${srcSm?.name}" and "${dstSm?.name}".`;
        return { valid: false, reason, error: reason };
      }
    } else {
      const gw = sourceNode.type === 'gateway' ? sourceNode : targetNode;
      const peer = sourceNode.type === 'gateway' ? targetNode : sourceNode;
      const peerSm = submeshMap.get(peer.submeshId);
      if (peerSm && !resolveActiveInterfaceForSubmesh(gw, peerSm)) {
        const reason = `Gateway "${gw.name}" lacks an active interface bound to "${peerSm.name}" (${peerSm.frequencyBand} CH ${peerSm.channelNumber}). Bind a radio interface to that domain first.`;
        return { valid: false, reason, error: reason };
      }
    }
  }

  return { valid: true };
}

/**
 * Validates packet injection arguments before creating a packet.
 */
export function validatePacketInjection(
  srcNode: MeshNode | undefined,
  dstNode: MeshNode | undefined,
  payloadSizeBytes: number
): PacketInjectionValidationResult {
  if (!srcNode) {
    const reason = 'Destination Unreachable: Source node not found.';
    return { valid: false, reason, error: reason };
  }
  if (!dstNode) {
    const reason = 'Destination Unreachable: Destination node not found.';
    return { valid: false, reason, error: reason };
  }
  if (srcNode.id === dstNode.id) {
    const reason = 'Invalid transmission: source and destination must be different nodes.';
    return { valid: false, reason, error: reason };
  }
  if (!srcNode.isAlive) {
    const reason = `Source node "${srcNode.name}" is offline.`;
    return { valid: false, reason, error: reason };
  }
  if (!dstNode.isAlive) {
    const reason = 'Destination Unreachable: Destination node is offline';
    return { valid: false, reason, error: reason };
  }
  if (!Number.isFinite(payloadSizeBytes) || payloadSizeBytes <= 0) {
    const reason = `Invalid payload size (${payloadSizeBytes} bytes): must be > 0.`;
    return { valid: false, reason, error: reason };
  }

  return { valid: true };
}
