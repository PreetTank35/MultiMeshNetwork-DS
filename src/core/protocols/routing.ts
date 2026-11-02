/**
 * Core Wireless Mesh Routing Protocols
 * Implements AODV, OLSR, HWMP, and RPL routing matrices
 */

import { MeshNode, NetworkLink, ProtocolType, SubMeshDomain } from '../../types/simulator';

export interface RouteHopResult {
  nextHopId: string | null;
  totalCost: number;
  protocolUsed: ProtocolType;
  path: string[];
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
  // If destination is higher rank (upward routing toward root)
  // or downward routing along DAG branches
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
