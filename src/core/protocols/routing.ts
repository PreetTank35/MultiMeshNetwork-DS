/**
 * Core Wireless Mesh Routing Protocols
 * Implements AODV, OLSR, HWMP, and RPL routing matrices
 * Plus Advanced Multi-Mesh Cross-Domain Auto-Pathfinding Pipeline
 */

import { MeshNode, NetworkLink, ProtocolType, SubMeshDomain } from '../../types/simulator';
import { calculateGatewayDelay } from './gateway';

export interface RouteHopResult {
  nextHopId: string | null;
  totalCost: number;
  protocolUsed: ProtocolType;
  path: string[];
}

export interface RouteMetricWeights {
  alpha: number; // Rate penalty factor: \alpha / Rate (Rate in Mbps)
  beta: number;  // Hop penalty factor: \beta * hops
  gamma: number; // Gateway delay penalty factor: \gamma * GatewayDelay (ms)
}

export const DEFAULT_ROUTE_WEIGHTS: RouteMetricWeights = {
  alpha: 50.0,
  beta: 1.0,
  gamma: 0.2,
};

export interface RouteSegmentTrace {
  segmentIndex: number;
  fromNodeId: string;
  fromNodeName: string;
  toNodeId: string;
  toNodeName: string;
  type: 'intra_mesh' | 'gateway_transition' | 'destination_delivery';
  submeshId: string;
  submeshName: string;
  protocol: ProtocolType;
  bandwidthMbps: number;
  distanceMeters: number;
  snrDb: number;
  lossRate: number;
  hopDelayMs: number;
  gatewayDelayMs: number;
  isGateway: boolean;
}

export interface MultiMeshRouteResult {
  sourceId: string;
  destId: string;
  found: boolean;
  path: string[];
  nodesTraversed: MeshNode[];
  linksTraversed: NetworkLink[];
  hops: number;
  submeshesTraversed: SubMeshDomain[];
  submeshIds: string[];
  gatewaysTraversed: MeshNode[];
  protocolsUsed: ProtocolType[];
  metricCost: number; // explicit cost C = \sum (\alpha/Rate + \beta*Hops + \gamma*GatewayDelay)
  estimatedLatencyMs: number; // estimated total latency in ms
  bottleneckSnrDb: number; // minimum link SNR across the path
  isCrossDomain: boolean;
  costBreakdown: {
    rateCost: number;
    hopCost: number;
    gatewayCost: number;
  };
  segmentTraces: RouteSegmentTrace[];
  error?: string;
}

/**
 * Priority queue item for Dijkstra search
 */
interface PQItem {
  nodeId: string;
  cost: number;
}

/**
 * Calculates Dijkstra shortest path within a submesh domain or across active links
 */
export function calculateDijkstraPath(
  sourceId: string,
  targetId: string,
  nodes: Map<string, MeshNode>,
  links: NetworkLink[],
  restrictToSubmeshId?: string
): string[] | null {
  if (sourceId === targetId) return [sourceId];

  // Build adjacency list for active, non-severed links
  const adj = new Map<string, Array<{ target: string; weight: number }>>();

  for (const node of nodes.values()) {
    if (node.isAlive && (!restrictToSubmeshId || node.submeshId === restrictToSubmeshId)) {
      adj.set(node.id, []);
    }
  }

  for (const link of links) {
    if (link.isSevered || link.isJammed) continue;
    
    const srcNode = nodes.get(link.source);
    const dstNode = nodes.get(link.target);

    if (!srcNode || !dstNode || !srcNode.isAlive || !dstNode.isAlive) continue;
    if (restrictToSubmeshId && (srcNode.submeshId !== restrictToSubmeshId || dstNode.submeshId !== restrictToSubmeshId)) {
      continue;
    }

    // Weight based on distance and loss rate (ETX concept: 1 / (1 - lossRate))
    const etx = 1 / Math.max(1 - link.lossRate, 0.05);
    const weight = link.distanceMeters * 0.01 + etx;

    adj.get(link.source)?.push({ target: link.target, weight });
    adj.get(link.target)?.push({ target: link.source, weight });
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const pq: PQItem[] = [];

  for (const nodeId of adj.keys()) {
    dist.set(nodeId, Infinity);
    prev.set(nodeId, null);
  }

  dist.set(sourceId, 0);
  pq.push({ nodeId: sourceId, cost: 0 });

  while (pq.length > 0) {
    // Pop minimum cost item
    pq.sort((a, b) => a.cost - b.cost);
    const current = pq.shift()!;

    if (current.nodeId === targetId) break;
    if (current.cost > (dist.get(current.nodeId) ?? Infinity)) continue;

    const neighbors = adj.get(current.nodeId) || [];
    for (const edge of neighbors) {
      const alt = current.cost + edge.weight;
      if (alt < (dist.get(edge.target) ?? Infinity)) {
        dist.set(edge.target, alt);
        prev.set(edge.target, current.nodeId);
        pq.push({ nodeId: edge.target, cost: alt });
      }
    }
  }

  // Reconstruct path
  if (!prev.has(targetId) || dist.get(targetId) === Infinity) {
    return null; // No path found
  }

  const path: string[] = [];
  let curr: string | null = targetId;
  while (curr !== null) {
    path.unshift(curr);
    curr = prev.get(curr) ?? null;
  }

  return path[0] === sourceId ? path : null;
}

/**
 * 1. AODV: Ad-hoc On-Demand Distance Vector
 * Reactive protocol: Establishes routes on-demand via simulated RREQ/RREP caching
 */
export function resolveAodvRoute(
  source: MeshNode,
  destination: MeshNode,
  nodes: Map<string, MeshNode>,
  links: NetworkLink[]
): RouteHopResult {
  // Check if source already has a valid routing table entry
  const cached = source.routingTable[destination.id];
  if (cached && nodes.get(cached.nextHop)?.isAlive) {
    return {
      nextHopId: cached.nextHop,
      totalCost: cached.cost,
      protocolUsed: 'AODV',
      path: [source.id, cached.nextHop]
    };
  }

  // Perform on-demand route discovery (simulated RREQ flood)
  const path = calculateDijkstraPath(source.id, destination.id, nodes, links, source.submeshId);
  if (!path || path.length < 2) {
    return { nextHopId: null, totalCost: Infinity, protocolUsed: 'AODV', path: [] };
  }

  const nextHopId = path[1];
  // Cache route in source routing table
  source.routingTable[destination.id] = {
    nextHop: nextHopId,
    cost: path.length - 1,
    protocol: 'AODV',
    timestamp: Date.now()
  };

  return {
    nextHopId,
    totalCost: path.length - 1,
    protocolUsed: 'AODV',
    path
  };
}

/**
 * 2. OLSR: Optimized Link State Routing (RFC 3626)
 * Proactive protocol: Pre-computes Multipoint Relays (MPRs) and routing table
 */
export function calculateMprSet(
  node: MeshNode,
  nodes: Map<string, MeshNode>,
  links: NetworkLink[]
): string[] {
  const oneHopNeighbors = new Set<string>();
  const twoHopNeighbors = new Set<string>();

  for (const link of links) {
    if (link.isSevered || link.isJammed) continue;
    if (link.source === node.id && nodes.get(link.target)?.isAlive) {
      oneHopNeighbors.add(link.target);
    } else if (link.target === node.id && nodes.get(link.source)?.isAlive) {
      oneHopNeighbors.add(link.source);
    }
  }

  for (const n1 of oneHopNeighbors) {
    for (const link of links) {
      if (link.isSevered || link.isJammed) continue;
      const target = link.source === n1 ? link.target : link.target === n1 ? link.source : null;
      if (target && target !== node.id && !oneHopNeighbors.has(target) && nodes.get(target)?.isAlive) {
        twoHopNeighbors.add(target);
      }
    }
  }

  // Greedy heuristic: pick 1-hop neighbor covering most 2-hop neighbors
  const mprSet = new Set<string>();
  const uncovered = new Set(twoHopNeighbors);

  while (uncovered.size > 0 && oneHopNeighbors.size > 0) {
    let bestNeighbor = '';
    let maxCoverage = -1;

    for (const n1 of oneHopNeighbors) {
      let count = 0;
      for (const link of links) {
        const target = link.source === n1 ? link.target : link.target === n1 ? link.source : null;
        if (target && uncovered.has(target)) count++;
      }
      if (count > maxCoverage) {
        maxCoverage = count;
        bestNeighbor = n1;
      }
    }

    if (maxCoverage <= 0 || !bestNeighbor) break;
    mprSet.add(bestNeighbor);
    
    // Remove newly covered 2-hop neighbors
    for (const link of links) {
      const target = link.source === bestNeighbor ? link.target : link.target === bestNeighbor ? link.source : null;
      if (target) uncovered.delete(target);
    }
  }

  return Array.from(mprSet);
}

export function resolveOlsrRoute(
  source: MeshNode,
  destination: MeshNode,
  nodes: Map<string, MeshNode>,
  links: NetworkLink[]
): RouteHopResult {
  const path = calculateDijkstraPath(source.id, destination.id, nodes, links, source.submeshId);
  if (!path || path.length < 2) {
    return { nextHopId: null, totalCost: Infinity, protocolUsed: 'OLSR', path: [] };
  }

  return {
    nextHopId: path[1],
    totalCost: path.length - 1,
    protocolUsed: 'OLSR',
    path
  };
}

/**
 * 3. HWMP: Hybrid Wireless Mesh Protocol (IEEE 802.11s)
 * Synthesizes proactive tree rooting with reactive Airtime Link Metric (ALM)
 */
export function resolveHwmpRoute(
  source: MeshNode,
  destination: MeshNode,
  nodes: Map<string, MeshNode>,
  links: NetworkLink[]
): RouteHopResult {
  // Uses Airtime Link Metric: ALM = [O + (Bt / r)] / (1 - ef)
  const path = calculateDijkstraPath(source.id, destination.id, nodes, links, source.submeshId);
  if (!path || path.length < 2) {
    return { nextHopId: null, totalCost: Infinity, protocolUsed: 'HWMP', path: [] };
  }

  return {
    nextHopId: path[1],
    totalCost: (path.length - 1) * 1.2,
    protocolUsed: 'HWMP',
    path
  };
}

/**
 * 4. RPL: Routing Protocol for Low-Power & Lossy Networks (RFC 6550)
 * Destination-Oriented DAG (DODAG) rooted at border gateway
 */
export function resolveRplRoute(
  source: MeshNode,
  destination: MeshNode,
  nodes: Map<string, MeshNode>,
  links: NetworkLink[],
  rootNodeId: string
): RouteHopResult {
  const path = calculateDijkstraPath(source.id, destination.id, nodes, links, source.submeshId);
  if (!path || path.length < 2) {
    return { nextHopId: null, totalCost: Infinity, protocolUsed: 'RPL', path: [] };
  }

  return {
    nextHopId: path[1],
    totalCost: path.length - 1,
    protocolUsed: 'RPL',
    path
  };
}

/**
 * Helper to find active link between two nodes
 */
export function findLinkBetween(
  sourceId: string,
  targetId: string,
  links: NetworkLink[]
): NetworkLink | null {
  return links.find(
    l => !l.isSevered && !l.isJammed &&
      ((l.source === sourceId && l.target === targetId) ||
       (l.source === targetId && l.target === sourceId))
  ) || null;
}

/**
 * =========================================================================
 * Comprehensive Multi-Mesh Auto-Pathfinding Pipeline
 * Computes multi-hop shortest paths across heterogeneous sub-meshes,
 * MRMC boundary gateway transitions, and destination sub-mesh delivery.
 *
 * Explicit Path Metric Cost:
 *   C = \sum (\alpha / Rate + \beta * Hops + \gamma * GatewayDelay)
 * =========================================================================
 */
export function calculateMultiMeshRoute(
  sourceId: string,
  destId: string,
  nodes: Map<string, MeshNode> | MeshNode[],
  links: NetworkLink[],
  submeshes: Map<string, SubMeshDomain> | SubMeshDomain[],
  weights: RouteMetricWeights = DEFAULT_ROUTE_WEIGHTS
): MultiMeshRouteResult {
  // Normalize maps
  const nodeMap = nodes instanceof Map ? nodes : new Map(nodes.map(n => [n.id, n]));
  const submeshMap = submeshes instanceof Map ? submeshes : new Map(submeshes.map(s => [s.id, s]));

  const sourceNode = nodeMap.get(sourceId);
  const destNode = nodeMap.get(destId);

  const failResult = (reason: string): MultiMeshRouteResult => ({
    sourceId,
    destId,
    found: false,
    path: [],
    nodesTraversed: [],
    linksTraversed: [],
    hops: 0,
    submeshesTraversed: [],
    submeshIds: [],
    gatewaysTraversed: [],
    protocolsUsed: [],
    metricCost: Infinity,
    estimatedLatencyMs: 0,
    bottleneckSnrDb: 0,
    isCrossDomain: false,
    costBreakdown: { rateCost: 0, hopCost: 0, gatewayCost: 0 },
    segmentTraces: [],
    error: reason,
  });

  if (!sourceNode) return failResult(`Source node "${sourceId}" not found in network topology`);
  if (!destNode) return failResult(`Destination node "${destId}" not found in network topology`);
  if (!sourceNode.isAlive) return failResult(`Source node "${sourceNode.name}" is offline / decommissioned`);
  if (!destNode.isAlive) return failResult(`Destination node "${destNode.name}" is offline / decommissioned`);

  // Identical source and destination
  if (sourceId === destId) {
    const sm = submeshMap.get(sourceNode.submeshId);
    return {
      sourceId,
      destId,
      found: true,
      path: [sourceId],
      nodesTraversed: [sourceNode],
      linksTraversed: [],
      hops: 0,
      submeshesTraversed: sm ? [sm] : [],
      submeshIds: sm ? [sm.id] : [],
      gatewaysTraversed: [],
      protocolsUsed: sm ? [sm.protocol] : [],
      metricCost: 0,
      estimatedLatencyMs: 0,
      bottleneckSnrDb: 100,
      isCrossDomain: false,
      costBreakdown: { rateCost: 0, hopCost: 0, gatewayCost: 0 },
      segmentTraces: [],
    };
  }

  // Build full multi-mesh weighted adjacency graph
  const adj = new Map<string, Array<{ target: string; link: NetworkLink; weight: number; isGatewayHop: boolean }>>();

  for (const node of nodeMap.values()) {
    if (node.isAlive) adj.set(node.id, []);
  }

  for (const link of links) {
    if (link.isSevered || link.isJammed) continue;
    const u = nodeMap.get(link.source);
    const v = nodeMap.get(link.target);
    if (!u || !v || !u.isAlive || !v.isAlive) continue;

    const rate = Math.max(link.bandwidthMbps, 0.5);
    const rateCost = weights.alpha / rate;
    const hopCost = weights.beta * 1.0;
    const lossPenalty = 3.0 * Math.max(link.lossRate, 0) + (1 / Math.max(1 - link.lossRate, 0.05) - 1);

    // Cross-domain or gateway boundary detection
    const isCrossDomainHop = u.submeshId !== v.submeshId;
    const isGatewayHop = u.type === 'gateway' || v.type === 'gateway' || isCrossDomainHop;

    let gatewayDelayMs = 0;
    if (isGatewayHop && isCrossDomainHop) {
      const uSm = submeshMap.get(u.submeshId);
      const vSm = submeshMap.get(v.submeshId);
      gatewayDelayMs = calculateGatewayDelay(u.type === 'gateway' ? u : v, uSm, vSm);
    }
    const gatewayCost = weights.gamma * gatewayDelayMs;

    // Protocol Airtime & DAG adjustments
    const uSm = submeshMap.get(u.submeshId);
    let protoModifier = 1.0;
    if (uSm?.protocol === 'HWMP') {
      // Airtime Link Metric factor: ALM overhead
      protoModifier = 1.15;
    } else if (uSm?.protocol === 'RPL') {
      // RPL low-power links prioritize high SNR
      if (link.snrDb < 15) protoModifier = 1.5;
    }

    const weight = (rateCost + hopCost + lossPenalty + gatewayCost) * protoModifier;

    adj.get(u.id)?.push({ target: v.id, link, weight, isGatewayHop });
    adj.get(v.id)?.push({ target: u.id, link, weight, isGatewayHop });
  }

  // Dijkstra multi-mesh shortest path
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const pq: PQItem[] = [];

  for (const nodeId of adj.keys()) {
    dist.set(nodeId, Infinity);
    prev.set(nodeId, null);
  }

  dist.set(sourceId, 0);
  pq.push({ nodeId: sourceId, cost: 0 });

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const curr = pq.shift()!;

    if (curr.nodeId === destId) break;
    if (curr.cost > (dist.get(curr.nodeId) ?? Infinity)) continue;

    const neighbors = adj.get(curr.nodeId) || [];
    for (const edge of neighbors) {
      const alt = curr.cost + edge.weight;
      if (alt < (dist.get(edge.target) ?? Infinity)) {
        dist.set(edge.target, alt);
        prev.set(edge.target, curr.nodeId);
        pq.push({ nodeId: edge.target, cost: alt });
      }
    }
  }

  if (!prev.has(destId) || dist.get(destId) === Infinity) {
    return failResult(`No viable multi-mesh path found between "${sourceNode.name}" and "${destNode.name}". Check link status or gateway boundaries.`);
  }

  // Reconstruct path
  const path: string[] = [];
  let current: string | null = destId;
  while (current !== null) {
    path.unshift(current);
    current = prev.get(current) ?? null;
  }

  if (path[0] !== sourceId) {
    return failResult(`Discontinuous routing tree between "${sourceNode.name}" and "${destNode.name}"`);
  }

  // Extract detailed path metrics, segment traces, and cost breakdown
  const nodesTraversed: MeshNode[] = path.map(id => nodeMap.get(id)!);
  const linksTraversed: NetworkLink[] = [];
  const segmentTraces: RouteSegmentTrace[] = [];
  const submeshIdSet = new Set<string>();
  const gatewaySet = new Set<string>();
  const protocolsUsedSet = new Set<ProtocolType>();

  let sumRateCost = 0;
  let sumGatewayCost = 0;
  let totalLatencyMs = 0;
  let bottleneckSnr = Infinity;

  for (let i = 0; i < path.length - 1; i++) {
    const fromN = nodesTraversed[i];
    const toN = nodesTraversed[i + 1];
    const link = findLinkBetween(fromN.id, toN.id, links);

    if (link) {
      linksTraversed.push(link);
      bottleneckSnr = Math.min(bottleneckSnr, link.snrDb);
    }

    const fromSm = submeshMap.get(fromN.submeshId);
    const toSm = submeshMap.get(toN.submeshId);

    if (fromSm) {
      submeshIdSet.add(fromSm.id);
      protocolsUsedSet.add(fromSm.protocol);
    }
    if (toSm) {
      submeshIdSet.add(toSm.id);
      protocolsUsedSet.add(toSm.protocol);
    }

    const bw = link?.bandwidthMbps || 54;
    const distM = link?.distanceMeters || 15;
    const snr = link?.snrDb || 25;
    const loss = link?.lossRate || 0.01;

    // Rate cost component: \alpha / Rate
    sumRateCost += weights.alpha / Math.max(bw, 0.5);

    // Hop transmission delays
    const txDelayMs = ((512 * 8) / (bw * 1e6)) * 1000;
    const propDelayMs = (distM / 3e8) * 1000;
    const queueDelayMs = Math.min((fromN.currentQueue?.length || 0) * 1.5 + 4.0, 30);
    const hopDelayMs = Math.max(txDelayMs + propDelayMs + queueDelayMs, 8.0);

    // Gateway transition check
    const isGw = fromN.type === 'gateway' || toN.type === 'gateway';
    const isDomainChange = fromN.submeshId !== toN.submeshId;
    let gatewayDelayMs = 0;

    if (isGw && isDomainChange) {
      const gwNode = fromN.type === 'gateway' ? fromN : toN;
      gatewaySet.add(gwNode.id);
      gatewayDelayMs = calculateGatewayDelay(gwNode, fromSm, toSm);
      sumGatewayCost += weights.gamma * gatewayDelayMs;
    }

    totalLatencyMs += hopDelayMs + gatewayDelayMs;

    // Determine segment type
    let segmentType: 'intra_mesh' | 'gateway_transition' | 'destination_delivery' = 'intra_mesh';
    if (isDomainChange || isGw) {
      segmentType = 'gateway_transition';
    } else if (i === path.length - 2) {
      segmentType = 'destination_delivery';
    }

    segmentTraces.push({
      segmentIndex: i + 1,
      fromNodeId: fromN.id,
      fromNodeName: fromN.name,
      toNodeId: toN.id,
      toNodeName: toN.name,
      type: segmentType,
      submeshId: fromSm?.id || fromN.submeshId,
      submeshName: fromSm?.name || fromN.submeshId,
      protocol: fromSm?.protocol || 'HWMP',
      bandwidthMbps: bw,
      distanceMeters: Math.round(distM * 10) / 10,
      snrDb: Math.round(snr * 10) / 10,
      lossRate: Math.round(loss * 1000) / 10,
      hopDelayMs: Math.round(hopDelayMs * 10) / 10,
      gatewayDelayMs: Math.round(gatewayDelayMs * 10) / 10,
      isGateway: isGw,
    });
  }

  const hops = path.length - 1;
  const sumHopCost = weights.beta * hops;
  const metricCost = Math.round((sumRateCost + sumHopCost + sumGatewayCost) * 100) / 100;
  const estimatedLatencyMs = Math.round(totalLatencyMs * 10) / 10;
  const bottleneckSnrDb = bottleneckSnr === Infinity ? 0 : Math.round(bottleneckSnr * 10) / 10;

  const submeshesTraversed: SubMeshDomain[] = Array.from(submeshIdSet)
    .map(id => submeshMap.get(id))
    .filter((s): s is SubMeshDomain => !!s);

  const gatewaysTraversed: MeshNode[] = Array.from(gatewaySet)
    .map(id => nodeMap.get(id))
    .filter((g): g is MeshNode => !!g);

  return {
    sourceId,
    destId,
    found: true,
    path,
    nodesTraversed,
    linksTraversed,
    hops,
    submeshesTraversed,
    submeshIds: Array.from(submeshIdSet),
    gatewaysTraversed,
    protocolsUsed: Array.from(protocolsUsedSet),
    metricCost,
    estimatedLatencyMs,
    bottleneckSnrDb,
    isCrossDomain: submeshIdSet.size > 1,
    costBreakdown: {
      rateCost: Math.round(sumRateCost * 100) / 100,
      hopCost: Math.round(sumHopCost * 100) / 100,
      gatewayCost: Math.round(sumGatewayCost * 100) / 100,
    },
    segmentTraces,
  };
}
