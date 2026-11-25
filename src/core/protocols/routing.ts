/**
 * Core Wireless Mesh Routing Protocols
 * Genuinely models distinct protocol mechanics, routing tables, and control overhead:
 * - AODV (RFC 3561): Reactive RREQ/RREP/RERR discovery, sequence numbers, and route cache
 * - OLSR (RFC 3626): Proactive 1-hop/2-hop sensing, MPR selection, TC flooding & ETX tables
 * - HWMP (IEEE 802.11s): Airtime Link Metric (ALM), proactive root tree + reactive PREQ/PREP
 * - RPL (RFC 6550): DODAG rank tree rooted at border gateway, DIO upward & DAO downward tables
 * Plus strict MRMC Multi-Mesh Cross-Domain Pathfinding & Gateway Failover
 */

import {
  AodvNodeState,
  HwmpNodeState,
  MeshNode,
  NetworkLink,
  OlsrNodeState,
  OlsrTcEntry,
  ProtocolType,
  RplNodeState,
  SubMeshDomain,
} from '../../types/simulator';
import {
  calculateGatewayDelay,
  gatewayHasActiveInterfaceForSubmesh,
} from './gateway';

export interface RouteHopResult {
  nextHopId: string | null;
  totalCost: number;
  protocolUsed: ProtocolType;
  path: string[];
  controlOverheadBytes?: number;
  discoveryDelayMs?: number;
  cacheHit?: boolean;
  rerrGenerated?: boolean;
  error?: string;
}

export interface RouteMetricWeights {
  alpha: number; // Rate penalty factor: \alpha / Rate (Rate in Mbps)
  beta: number; // Hop penalty factor: \beta * hops
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
  metricCost: number;
  estimatedLatencyMs: number;
  bottleneckSnrDb: number;
  isCrossDomain: boolean;
  costBreakdown: {
    rateCost: number;
    hopCost: number;
    gatewayCost: number;
  };
  segmentTraces: RouteSegmentTrace[];
  controlOverheadBytes?: number;
  discoveryDelayMs?: number;
  error?: string;
}

interface PQItem {
  nodeId: string;
  cost: number;
}

/**
 * Finds active, viable link between two nodes.
 */
export function findLinkBetween(
  sourceId: string,
  targetId: string,
  links: NetworkLink[]
): NetworkLink | null {
  return (
    links.find(
      l =>
        !l.isSevered &&
        !l.isJammed &&
        l.isViable !== false &&
        ((l.source === sourceId && l.target === targetId) ||
          (l.source === targetId && l.target === sourceId))
    ) || null
  );
}

function isNodeInOrBridgingSubmesh(
  node: MeshNode,
  submeshId: string,
  submeshes?: Map<string, SubMeshDomain>
): boolean {
  if (!node.isAlive) return false;
  if (node.type === 'gateway') {
    const sm = submeshes?.get(submeshId);
    if (sm) return gatewayHasActiveInterfaceForSubmesh(node, sm);
    return (
      node.submeshId === submeshId ||
      node.interfaces.some(i => i.isUp !== false && i.submeshId === submeshId)
    );
  }
  return node.submeshId === submeshId;
}

function isLinkUsableInSubmesh(
  link: NetworkLink,
  u: MeshNode | undefined,
  v: MeshNode | undefined,
  submeshId?: string,
  submeshes?: Map<string, SubMeshDomain>
): boolean {
  if (!u || !v || !u.isAlive || !v.isAlive) return false;
  if (link.isSevered || link.isJammed || link.isViable === false) return false;

  if (submeshId) {
    return (
      isNodeInOrBridgingSubmesh(u, submeshId, submeshes) &&
      isNodeInOrBridgingSubmesh(v, submeshId, submeshes)
    );
  }

  // Global graph: cross-domain edges MUST pass through an alive gateway with active interfaces for both sides
  if (u.submeshId !== v.submeshId) {
    if (u.type !== 'gateway' && v.type !== 'gateway') {
      return false;
    }
    const uSm = submeshes?.get(u.submeshId);
    const vSm = submeshes?.get(v.submeshId);
    if (uSm && vSm) {
      const uBridgesBoth =
        u.type === 'gateway' &&
        gatewayHasActiveInterfaceForSubmesh(u, uSm) &&
        gatewayHasActiveInterfaceForSubmesh(u, vSm);
      const vBridgesBoth =
        v.type === 'gateway' &&
        gatewayHasActiveInterfaceForSubmesh(v, uSm) &&
        gatewayHasActiveInterfaceForSubmesh(v, vSm);
      if (!uBridgesBoth && !vBridgesBoth) {
        return false;
      }
    }
  } else if (submeshes) {
    const sm = submeshes.get(u.submeshId);
    if (sm) {
      if (u.type === 'gateway' && !gatewayHasActiveInterfaceForSubmesh(u, sm)) return false;
      if (v.type === 'gateway' && !gatewayHasActiveInterfaceForSubmesh(v, sm)) return false;
    }
  }

  return true;
}

/**
 * Shortest-path helper over custom edge cost function (used by protocols with distinct metrics)
 */
function runWeightedDijkstra(
  sourceId: string,
  targetId: string,
  nodes: Map<string, MeshNode>,
  links: NetworkLink[],
  edgeWeightFn: (link: NetworkLink, u: MeshNode, v: MeshNode) => number,
  restrictToSubmeshId?: string,
  submeshes?: Map<string, SubMeshDomain>
): { path: string[]; totalCost: number } | null {
  if (sourceId === targetId) return { path: [sourceId], totalCost: 0 };

  const adj = new Map<string, Array<{ target: string; weight: number }>>();
  for (const node of nodes.values()) {
    if (!node.isAlive) continue;
    if (!restrictToSubmeshId || isNodeInOrBridgingSubmesh(node, restrictToSubmeshId, submeshes)) {
      adj.set(node.id, []);
    }
  }

  if (!adj.has(sourceId) || !adj.has(targetId)) return null;

  for (const link of links) {
    const u = nodes.get(link.source);
    const v = nodes.get(link.target);
    if (!isLinkUsableInSubmesh(link, u, v, restrictToSubmeshId, submeshes)) continue;
    const weight = edgeWeightFn(link, u!, v!);
    if (!Number.isFinite(weight)) continue;
    adj.get(u!.id)?.push({ target: v!.id, weight });
    adj.get(v!.id)?.push({ target: u!.id, weight });
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
    pq.sort((a, b) => a.cost - b.cost || a.nodeId.localeCompare(b.nodeId));
    const current = pq.shift()!;
    if (current.nodeId === targetId) break;
    if (current.cost > (dist.get(current.nodeId) ?? Infinity)) continue;

    for (const edge of adj.get(current.nodeId) || []) {
      const alt = current.cost + edge.weight;
      if (alt < (dist.get(edge.target) ?? Infinity)) {
        dist.set(edge.target, alt);
        prev.set(edge.target, current.nodeId);
        pq.push({ nodeId: edge.target, cost: alt });
      }
    }
  }

  const totalCost = dist.get(targetId) ?? Infinity;
  if (!Number.isFinite(totalCost)) return null;

  const path: string[] = [];
  let curr: string | null = targetId;
  while (curr !== null) {
    path.unshift(curr);
    curr = prev.get(curr) ?? null;
  }

  return path[0] === sourceId ? { path, totalCost } : null;
}

/**
 * Legacy helper preserved for compatibility; delegates to ETX-weighted intra-mesh Dijkstra.
 */
export function calculateDijkstraPath(
  sourceId: string,
  targetId: string,
  nodes: Map<string, MeshNode>,
  links: NetworkLink[],
  restrictToSubmeshId?: string
): string[] | null {
  const res = runWeightedDijkstra(
    sourceId,
    targetId,
    nodes,
    links,
    link => {
      const etx = 1 / Math.max(1 - (link.per ?? link.lossRate), 0.05);
      return link.distanceMeters * 0.01 + etx;
    },
    restrictToSubmeshId
  );
  return res ? res.path : null;
}

// ============================================================================
// 1. AODV: Ad-hoc On-Demand Distance Vector (RFC 3561)
//    Reactive RREQ/RREP discovery, sequence numbers, RERR route invalidation
// ============================================================================

export function ensureAodvState(node: MeshNode): AodvNodeState {
  if (!node.aodvState) {
    node.aodvState = {
      seqNum: 1,
      rreqId: 0,
      routes: {},
      seenRreqs: {},
      pendingDiscoveries: [],
    };
  }
  return node.aodvState;
}

/**
 * Emits AODV RERR by invalidating cached routes through broken nodes or links.
 */
export function invalidateAodvRoutes(
  nodes: Map<string, MeshNode>,
  brokenNodeId?: string,
  brokenLink?: { source: string; target: string }
): number {
  let invalidatedCount = 0;

  for (const node of nodes.values()) {
    if (!node.aodvState) continue;
    for (const [destId, entry] of Object.entries(node.aodvState.routes)) {
      if (!entry.valid) continue;
      const matchesNode =
        brokenNodeId && (destId === brokenNodeId || entry.nextHop === brokenNodeId);
      const matchesLink =
        brokenLink &&
        ((node.id === brokenLink.source && entry.nextHop === brokenLink.target) ||
          (node.id === brokenLink.target && entry.nextHop === brokenLink.source));

      if (matchesNode || matchesLink) {
        entry.valid = false;
        entry.destSeqNum += 1;
        delete node.routingTable[destId];
        invalidatedCount++;
      }
    }
  }

  return invalidatedCount;
}

export function resolveAodvRoute(
  source: MeshNode,
  destination: MeshNode,
  nodes: Map<string, MeshNode>,
  links: NetworkLink[],
  options?: {
    simTimeMs?: number;
    routeLifetimeMs?: number;
    restrictToSubmeshId?: string;
    submeshes?: Map<string, SubMeshDomain>;
  }
): RouteHopResult {
  const simTimeMs = options?.simTimeMs ?? 0;
  const lifetimeMs = options?.routeLifetimeMs ?? 15000;
  const submeshScope = options?.restrictToSubmeshId;

  const srcState = ensureAodvState(source);
  const dstState = ensureAodvState(destination);

  if (source.id === destination.id) {
    return {
      nextHopId: null,
      totalCost: 0,
      protocolUsed: 'AODV',
      path: [source.id],
      controlOverheadBytes: 0,
      discoveryDelayMs: 0,
      cacheHit: true,
    };
  }

  // 1. Validate cached AODV route table entry along next hops
  const cached = srcState.routes[destination.id];
  if (cached && cached.valid && cached.expiresAtSimMs > simTimeMs) {
    const reconstructed: string[] = [source.id];
    const visited = new Set<string>([source.id]);
    let curr: MeshNode = source;
    let cacheIntact = true;

    while (curr.id !== destination.id) {
      const entry = curr.aodvState?.routes[destination.id];
      if (!entry || !entry.valid || entry.expiresAtSimMs <= simTimeMs) {
        cacheIntact = false;
        break;
      }
      const nextNode = nodes.get(entry.nextHop);
      const link = findLinkBetween(curr.id, entry.nextHop, links);
      if (
        !nextNode ||
        !isLinkUsableInSubmesh(link!, curr, nextNode, submeshScope, options?.submeshes) ||
        !link ||
        visited.has(nextNode.id)
      ) {
        cacheIntact = false;
        break;
      }
      reconstructed.push(nextNode.id);
      visited.add(nextNode.id);
      curr = nextNode;
    }

    if (cacheIntact && reconstructed[reconstructed.length - 1] === destination.id) {
      return {
        nextHopId: reconstructed[1],
        totalCost: reconstructed.length - 1,
        protocolUsed: 'AODV',
        path: reconstructed,
        controlOverheadBytes: 0,
        discoveryDelayMs: 0,
        cacheHit: true,
      };
    }

    // Cached route broke mid-lifetime -> invalidate & emit RERR
    cached.valid = false;
    cached.destSeqNum += 1;
    delete source.routingTable[destination.id];
  }

  // 2. Reactive RREQ Breadth-First Flood (minimum hop count, per RFC 3561)
  srcState.seqNum += 1;
  srcState.rreqId += 1;
  const rreqKey = `${source.id}:${srcState.rreqId}`;
  srcState.seenRreqs[rreqKey] = simTimeMs;

  const prev = new Map<string, string | null>();
  const dist = new Map<string, number>();
  const queue: string[] = [source.id];
  prev.set(source.id, null);
  dist.set(source.id, 0);

  let rreqTransmissions = 0;
  let found = false;

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const currNode = nodes.get(currId);
    if (!currNode) continue;

    if (currId === destination.id) {
      found = true;
      break;
    }

    rreqTransmissions++;
    const currHop = dist.get(currId)!;

    // Deterministic neighbor order sorted by node ID
    const neighbors: string[] = [];
    for (const link of links) {
      const peerId =
        link.source === currId ? link.target : link.target === currId ? link.source : null;
      if (!peerId) continue;
      const peer = nodes.get(peerId);
      if (!isLinkUsableInSubmesh(link, currNode, peer, submeshScope, options?.submeshes)) continue;
      neighbors.push(peerId);
    }
    neighbors.sort();

    for (const nId of neighbors) {
      if (!dist.has(nId)) {
        dist.set(nId, currHop + 1);
        prev.set(nId, currId);
        const peer = nodes.get(nId)!;
        const peerState = ensureAodvState(peer);
        peerState.seenRreqs[rreqKey] = simTimeMs;
        // Install reverse route toward source during RREQ flood
        peerState.routes[source.id] = {
          destId: source.id,
          nextHop: currId,
          hopCount: currHop + 1,
          destSeqNum: srcState.seqNum,
          valid: true,
          expiresAtSimMs: simTimeMs + lifetimeMs,
          lastUpdatedSimMs: simTimeMs,
        };
        peer.routingTable[source.id] = {
          nextHop: currId,
          cost: currHop + 1,
          protocol: 'AODV',
          timestamp: simTimeMs,
          seqNum: srcState.seqNum,
        };
        queue.push(nId);
      }
    }
  }

  const rreqBytes = rreqTransmissions * 24;

  if (!found) {
    return {
      nextHopId: null,
      totalCost: Infinity,
      protocolUsed: 'AODV',
      path: [],
      controlOverheadBytes: rreqBytes + (cached ? 20 : 0),
      discoveryDelayMs: 0,
      cacheHit: false,
      rerrGenerated: Boolean(cached),
      error: `Destination Unreachable: AODV RREQ flood found no path from "${source.name}" to "${destination.name}"`,
    };
  }

  // Reconstruct shortest-hop path and unicast RREP back from destination -> source
  const path: string[] = [];
  let cursor: string | null = destination.id;
  while (cursor !== null) {
    path.unshift(cursor);
    cursor = prev.get(cursor) ?? null;
  }

  dstState.seqNum += 1;
  const hops = path.length - 1;

  for (let i = 0; i < path.length - 1; i++) {
    const hopNode = nodes.get(path[i])!;
    const nextHopId = path[i + 1];
    const remainingHops = path.length - 1 - i;
    const hState = ensureAodvState(hopNode);

    hState.routes[destination.id] = {
      destId: destination.id,
      nextHop: nextHopId,
      hopCount: remainingHops,
      destSeqNum: dstState.seqNum,
      valid: true,
      expiresAtSimMs: simTimeMs + lifetimeMs,
      lastUpdatedSimMs: simTimeMs,
    };

    hopNode.routingTable[destination.id] = {
      nextHop: nextHopId,
      cost: remainingHops,
      protocol: 'AODV',
      timestamp: simTimeMs,
      seqNum: dstState.seqNum,
    };
  }

  const rrepBytes = hops * 20;
  const rerrBytes = cached ? 20 : 0;

  return {
    nextHopId: path[1],
    totalCost: hops,
    protocolUsed: 'AODV',
    path,
    controlOverheadBytes: rreqBytes + rrepBytes + rerrBytes,
    discoveryDelayMs: Math.round(hops * 3.5 * 10) / 10,
    cacheHit: false,
    rerrGenerated: Boolean(cached),
  };
}

// ============================================================================
// 2. OLSR: Optimized Link State Routing (RFC 3626)
//    1-hop / 2-hop sensing, MPR selection, TC dissemination via MPRs, ETX routes
// ============================================================================

export function calculateMprSet(
  node: MeshNode,
  nodes: Map<string, MeshNode>,
  links: NetworkLink[],
  restrictToSubmeshId?: string,
  submeshes?: Map<string, SubMeshDomain>
): string[] {
  const scope = restrictToSubmeshId;
  const oneHopNeighbors = new Set<string>();
  const adjMap = new Map<string, Set<string>>();

  for (const link of links) {
    const u = nodes.get(link.source);
    const v = nodes.get(link.target);
    if (!isLinkUsableInSubmesh(link, u, v, scope, submeshes)) continue;

    if (!adjMap.has(u!.id)) adjMap.set(u!.id, new Set());
    if (!adjMap.has(v!.id)) adjMap.set(v!.id, new Set());
    adjMap.get(u!.id)!.add(v!.id);
    adjMap.get(v!.id)!.add(u!.id);

    if (u!.id === node.id) oneHopNeighbors.add(v!.id);
    else if (v!.id === node.id) oneHopNeighbors.add(u!.id);
  }

  // Collect strict 2-hop neighbors and which 1-hop neighbors cover each
  const twoHopCoverers = new Map<string, Set<string>>();
  for (const n1 of oneHopNeighbors) {
    for (const n2 of adjMap.get(n1) || []) {
      if (n2 === node.id || oneHopNeighbors.has(n2)) continue;
      if (!twoHopCoverers.has(n2)) twoHopCoverers.set(n2, new Set());
      twoHopCoverers.get(n2)!.add(n1);
    }
  }

  const mprSet = new Set<string>();
  const uncovered = new Set<string>(twoHopCoverers.keys());

  // RFC 3626 Step 1: Select 1-hop neighbors that are the ONLY cover for some 2-hop neighbor
  for (const [, coverers] of twoHopCoverers.entries()) {
    if (coverers.size === 1) {
      const sole = Array.from(coverers)[0];
      mprSet.add(sole);
    }
  }

  for (const mpr of mprSet) {
    for (const n2 of adjMap.get(mpr) || []) {
      uncovered.delete(n2);
    }
  }

  // RFC 3626 Step 2: Greedy cover of remaining 2-hop neighbors
  const sortedOneHop = Array.from(oneHopNeighbors).sort();
  while (uncovered.size > 0) {
    let bestNeighbor = '';
    let maxCoverage = -1;

    for (const n1 of sortedOneHop) {
      if (mprSet.has(n1)) continue;
      let count = 0;
      for (const n2 of adjMap.get(n1) || []) {
        if (uncovered.has(n2)) count++;
      }
      if (count > maxCoverage) {
        maxCoverage = count;
        bestNeighbor = n1;
      }
    }

    if (maxCoverage <= 0 || !bestNeighbor) break;
    mprSet.add(bestNeighbor);
    for (const n2 of adjMap.get(bestNeighbor) || []) {
      uncovered.delete(n2);
    }
  }

  return Array.from(mprSet).sort();
}

/**
 * Recomputes proactive OLSR HELLO neighbor tables, MPR sets, TC tables, and ETX routes.
 * Returns total HELLO + TC control overhead bytes.
 */
export function recomputeOlsrTopology(
  nodes: Map<string, MeshNode>,
  links: NetworkLink[],
  submeshes: Map<string, SubMeshDomain>,
  simTimeMs: number = 0,
  targetSubmeshId?: string
): number {
  let totalControlBytes = 0;

  const submeshIds = targetSubmeshId
    ? [targetSubmeshId]
    : Array.from(submeshes.values())
        .filter(sm => sm.protocol === 'OLSR')
        .map(sm => sm.id);

  for (const smId of submeshIds) {
    const domainNodes = Array.from(nodes.values()).filter(n =>
      isNodeInOrBridgingSubmesh(n, smId, submeshes)
    );
    if (domainNodes.length === 0) continue;

    // 1. HELLO neighbor discovery + MPR selection per node
    const mprSelectorsByNode = new Map<string, Set<string>>();
    for (const n of domainNodes) {
      mprSelectorsByNode.set(n.id, new Set());
    }

    for (const n of domainNodes) {
      const oneHop: string[] = [];
      for (const link of links) {
        const u = nodes.get(link.source);
        const v = nodes.get(link.target);
        if (!isLinkUsableInSubmesh(link, u, v, smId, submeshes)) continue;
        if (u!.id === n.id) oneHop.push(v!.id);
        else if (v!.id === n.id) oneHop.push(u!.id);
      }
      oneHop.sort();

      const twoHopSet = new Set<string>();
      for (const n1 of oneHop) {
        for (const link of links) {
          const u = nodes.get(link.source);
          const v = nodes.get(link.target);
          if (!isLinkUsableInSubmesh(link, u, v, smId, submeshes)) continue;
          const peer = u!.id === n1 ? v!.id : v!.id === n1 ? u!.id : null;
          if (peer && peer !== n.id && !oneHop.includes(peer)) {
            twoHopSet.add(peer);
          }
        }
      }

      const mprSet = calculateMprSet(n, nodes, links, smId, submeshes);
      for (const mprId of mprSet) {
        mprSelectorsByNode.get(mprId)?.add(n.id);
      }

      const prevAnsn = n.olsrState?.ansn ?? 0;
      const state: OlsrNodeState = {
        ansn: prevAnsn + 1,
        oneHopNeighbors: oneHop,
        twoHopNeighbors: Array.from(twoHopSet).sort(),
        mprSet,
        mprSelectors: [],
        tcTable: [],
        routingTable: {},
      };
      n.olsrState = state;
      n.mprNeighbors = mprSet;

      // HELLO frame overhead: 16B base + 4B per neighbor
      totalControlBytes += 16 + oneHop.length * 4;
    }

    // 2. Build global TC entries strictly advertised by MPR nodes for their MPR selectors
    const globalTcEntries: OlsrTcEntry[] = [];
    for (const n of domainNodes) {
      const selectors = Array.from(mprSelectorsByNode.get(n.id) || []).sort();
      n.olsrState!.mprSelectors = selectors;
      if (selectors.length === 0) continue;

      for (const selId of selectors) {
        const link = findLinkBetween(n.id, selId, links);
        const etx = link ? 1 / Math.max(1 - (link.per ?? link.lossRate), 0.05) : 1;
        globalTcEntries.push({
          originId: n.id,
          mprSelectorId: selId,
          cost: Math.round(etx * 100) / 100,
          ansn: n.olsrState!.ansn,
          timestampMs: simTimeMs,
        });
      }

      // TC message flooded only by nodes with non-empty MPR selectors
      totalControlBytes += 12 + selectors.length * 6;
    }

    // 3. Populate each node's TC table and compute proactive ETX routing table
    for (const src of domainNodes) {
      src.olsrState!.tcTable = globalTcEntries.map(e => ({ ...e }));

      // Build topology graph visible to src: 1-hop links + MPR TC links (and fallback direct viable links if sparse)
      const adj = new Map<string, Array<{ target: string; weight: number }>>();
      for (const dn of domainNodes) adj.set(dn.id, []);

      for (const link of links) {
        const u = nodes.get(link.source);
        const v = nodes.get(link.target);
        if (!isLinkUsableInSubmesh(link, u, v, smId, submeshes)) continue;

        const isLocalHop = u!.id === src.id || v!.id === src.id;
        const isTcAdvertised = globalTcEntries.some(
          tc =>
            (tc.originId === u!.id && tc.mprSelectorId === v!.id) ||
            (tc.originId === v!.id && tc.mprSelectorId === u!.id)
        );

        // RFC 3626: Routes use 1-hop links + TC links from MPRs; if neither endpoint is MPR-selected (leaf-to-leaf edge), still include symmetric links only if advertised or local
        if (isLocalHop || isTcAdvertised || globalTcEntries.length === 0) {
          const etx = 1 / Math.max(1 - (link.per ?? link.lossRate), 0.05);
          adj.get(u!.id)?.push({ target: v!.id, weight: etx });
          adj.get(v!.id)?.push({ target: u!.id, weight: etx });
        }
      }

      // Shortest ETX paths from src to all reachable domain nodes
      const dist = new Map<string, number>();
      const prev = new Map<string, string | null>();
      const hopsMap = new Map<string, number>();
      const pq: PQItem[] = [];

      for (const dn of domainNodes) {
        dist.set(dn.id, Infinity);
        prev.set(dn.id, null);
        hopsMap.set(dn.id, 0);
      }
      dist.set(src.id, 0);
      pq.push({ nodeId: src.id, cost: 0 });

      while (pq.length > 0) {
        pq.sort((a, b) => a.cost - b.cost || a.nodeId.localeCompare(b.nodeId));
        const curr = pq.shift()!;
        if (curr.cost > (dist.get(curr.nodeId) ?? Infinity)) continue;
        for (const edge of adj.get(curr.nodeId) || []) {
          const alt = curr.cost + edge.weight;
          if (alt < (dist.get(edge.target) ?? Infinity)) {
            dist.set(edge.target, alt);
            prev.set(edge.target, curr.nodeId);
            hopsMap.set(edge.target, (hopsMap.get(curr.nodeId) || 0) + 1);
            pq.push({ nodeId: edge.target, cost: alt });
          }
        }
      }

      for (const dst of domainNodes) {
        if (dst.id === src.id) continue;
        const dCost = dist.get(dst.id) ?? Infinity;
        if (!Number.isFinite(dCost)) continue;

        let nextHop = dst.id;
        let p = prev.get(dst.id) ?? null;
        while (p !== null && p !== src.id) {
          nextHop = p;
          p = prev.get(p) ?? null;
        }
        if (p === src.id) {
          const costRounded = Math.round(dCost * 100) / 100;
          src.olsrState!.routingTable[dst.id] = {
            nextHop,
            cost: costRounded,
            hops: hopsMap.get(dst.id) || 1,
          };
          src.routingTable[dst.id] = {
            nextHop,
            cost: costRounded,
            protocol: 'OLSR',
            timestamp: simTimeMs,
          };
        }
      }
    }
  }

  return totalControlBytes;
}

export function resolveOlsrRoute(
  source: MeshNode,
  destination: MeshNode,
  nodes: Map<string, MeshNode>,
  links: NetworkLink[],
  options?: {
    simTimeMs?: number;
    restrictToSubmeshId?: string;
    submeshes?: Map<string, SubMeshDomain>;
  }
): RouteHopResult {
  if (source.id === destination.id) {
    return {
      nextHopId: null,
      totalCost: 0,
      protocolUsed: 'OLSR',
      path: [source.id],
      controlOverheadBytes: 0,
      discoveryDelayMs: 0,
    };
  }

  const scope = options?.restrictToSubmeshId ?? source.submeshId;
  const submeshes = options?.submeshes ?? new Map<string, SubMeshDomain>();
  let controlBytes = 0;

  if (!source.olsrState || !source.olsrState.routingTable[destination.id]) {
    controlBytes = recomputeOlsrTopology(nodes, links, submeshes, options?.simTimeMs ?? 0, scope);
  }

  const path: string[] = [source.id];
  const visited = new Set<string>([source.id]);
  let curr: MeshNode = source;
  let totalCost = 0;

  while (curr.id !== destination.id) {
    const entry = curr.olsrState?.routingTable[destination.id];
    if (!entry) break;
    const nextNode = nodes.get(entry.nextHop);
    const link = findLinkBetween(curr.id, entry.nextHop, links);
    if (!nextNode || !link || !isLinkUsableInSubmesh(link, curr, nextNode, scope, options?.submeshes)) {
      break;
    }
    if (visited.has(nextNode.id)) break;
    if (curr.id === source.id) totalCost = entry.cost;
    path.push(nextNode.id);
    visited.add(nextNode.id);
    curr = nextNode;
  }

  if (path[path.length - 1] !== destination.id) {
    // Fallback over full OLSR ETX topology if MPR pruning disconnected a non-MPR leaf pair
    const directEtx = runWeightedDijkstra(
      source.id,
      destination.id,
      nodes,
      links,
      link => 1 / Math.max(1 - (link.per ?? link.lossRate), 0.05),
      scope,
      options?.submeshes
    );
    if (!directEtx || directEtx.path.length < 2) {
      return {
        nextHopId: null,
        totalCost: Infinity,
        protocolUsed: 'OLSR',
        path: [],
        controlOverheadBytes: controlBytes,
        discoveryDelayMs: 0,
        error: `Destination Unreachable: OLSR TC table has no route from "${source.name}" to "${destination.name}"`,
      };
    }
    return {
      nextHopId: directEtx.path[1],
      totalCost: Math.round(directEtx.totalCost * 100) / 100,
      protocolUsed: 'OLSR',
      path: directEtx.path,
      controlOverheadBytes: controlBytes,
      discoveryDelayMs: 0,
    };
  }

  return {
    nextHopId: path[1],
    totalCost,
    protocolUsed: 'OLSR',
    path,
    controlOverheadBytes: controlBytes,
    discoveryDelayMs: 0,
  };
}

// ============================================================================
// 3. HWMP: Hybrid Wireless Mesh Protocol (IEEE 802.11s)
//    Airtime Link Metric Ca = [O + Bt / r] / (1 - PER) + proactive root tree + reactive PREQ/PREP
// ============================================================================

/**
 * IEEE 802.11s Airtime Link Metric:
 * Ca = [O + Bt / r] / (1 - PER)
 * Returns metric in 0.1ms units (microseconds / 100) for clean cost scaling.
 */
export function calculateAirtimeLinkMetric(
  link: NetworkLink,
  testFrameBits: number = 8192
): number {
  const overheadUs = 185; // Oca (75us) + Op (110us) per IEEE 802.11s
  const rateMbps = Math.max(link.bandwidthMbps || 54, 0.25);
  const txTimeUs = testFrameBits / rateMbps; // bits / (bits/us) = us
  const per = Math.min(Math.max(link.per ?? link.lossRate, 0), 0.99);
  const almUs = (overheadUs + txTimeUs) / Math.max(1 - per, 0.01);
  return Math.round((almUs / 100) * 1000) / 1000;
}

export function ensureHwmpState(node: MeshNode): HwmpNodeState {
  if (!node.hwmpState) {
    node.hwmpState = {
      prepSeqNum: 1,
      preqId: 0,
      reactivePaths: {},
    };
  }
  return node.hwmpState;
}

/**
 * Builds IEEE 802.11s proactive root tree using RANN / proactive PREQ toward root station.
 */
export function recomputeHwmpRootTree(
  nodes: Map<string, MeshNode>,
  links: NetworkLink[],
  submeshes: Map<string, SubMeshDomain>,
  simTimeMs: number = 0,
  targetSubmeshId?: string
): number {
  let controlBytes = 0;

  const submeshIds = targetSubmeshId
    ? [targetSubmeshId]
    : Array.from(submeshes.values())
        .filter(sm => sm.protocol === 'HWMP')
        .map(sm => sm.id);

  for (const smId of submeshIds) {
    const domainNodes = Array.from(nodes.values()).filter(n =>
      isNodeInOrBridgingSubmesh(n, smId, submeshes)
    );
    if (domainNodes.length === 0) continue;

    // Select root: prefer gateway or highest-queue router/server
    const rootNode = [...domainNodes].sort((a, b) => {
      const aScore = (a.type === 'gateway' ? 1000 : a.type === 'router' ? 500 : 0) + a.queueCapacity;
      const bScore = (b.type === 'gateway' ? 1000 : b.type === 'router' ? 500 : 0) + b.queueCapacity;
      return bScore - aScore || a.id.localeCompare(b.id);
    })[0];

    if (!rootNode) continue;

    for (const dn of domainNodes) {
      const hs = ensureHwmpState(dn);
      hs.rootNodeId = rootNode.id;
      hs.rootParentId = undefined;
      hs.rootAirtimeMetric = dn.id === rootNode.id ? 0 : Infinity;

      if (dn.id === rootNode.id) continue;
      const res = runWeightedDijkstra(
        dn.id,
        rootNode.id,
        nodes,
        links,
        link => calculateAirtimeLinkMetric(link),
        smId,
        submeshes
      );
      if (res && res.path.length >= 2) {
        hs.rootParentId = res.path[1];
        hs.rootAirtimeMetric = Math.round(res.totalCost * 100) / 100;
        dn.routingTable[rootNode.id] = {
          nextHop: res.path[1],
          cost: hs.rootAirtimeMetric,
          protocol: 'HWMP',
          timestamp: simTimeMs,
        };
      }
      controlBytes += 32; // Proactive RANN beacon
    }
  }

  return controlBytes;
}

export function resolveHwmpRoute(
  source: MeshNode,
  destination: MeshNode,
  nodes: Map<string, MeshNode>,
  links: NetworkLink[],
  options?: {
    simTimeMs?: number;
    restrictToSubmeshId?: string;
    submeshes?: Map<string, SubMeshDomain>;
  }
): RouteHopResult {
  const simTimeMs = options?.simTimeMs ?? 0;
  const scope = options?.restrictToSubmeshId ?? source.submeshId;
  const submeshes = options?.submeshes ?? new Map<string, SubMeshDomain>();

  if (source.id === destination.id) {
    return {
      nextHopId: null,
      totalCost: 0,
      protocolUsed: 'HWMP',
      path: [source.id],
      controlOverheadBytes: 0,
      discoveryDelayMs: 0,
    };
  }

  const srcHwmp = ensureHwmpState(source);
  if (!srcHwmp.rootNodeId) {
    recomputeHwmpRootTree(nodes, links, submeshes, simTimeMs, scope);
  }

  // 1. Check cached reactive PREQ/PREP path
  const cached = srcHwmp.reactivePaths[destination.id];
  if (cached && cached.expiresAtSimMs > simTimeMs) {
    const link = findLinkBetween(source.id, cached.nextHop, links);
    const nextNode = nodes.get(cached.nextHop);
    if (nextNode && link && isLinkUsableInSubmesh(link, source, nextNode, scope, submeshes)) {
      const verified = runWeightedDijkstra(
        source.id,
        destination.id,
        nodes,
        links,
        l => calculateAirtimeLinkMetric(l),
        scope,
        submeshes
      );
      if (verified && verified.path.length >= 2 && verified.path[1] === cached.nextHop) {
        return {
          nextHopId: verified.path[1],
          totalCost: Math.round(verified.totalCost * 100) / 100,
          protocolUsed: 'HWMP',
          path: verified.path,
          controlOverheadBytes: 0,
          discoveryDelayMs: 0,
          cacheHit: true,
        };
      }
    }
    delete srcHwmp.reactivePaths[destination.id];
  }

  // 2. Reactive PREQ/PREP path setup using IEEE 802.11s Airtime Link Metric (ALM)
  srcHwmp.preqId += 1;
  srcHwmp.prepSeqNum += 1;
  const res = runWeightedDijkstra(
    source.id,
    destination.id,
    nodes,
    links,
    l => calculateAirtimeLinkMetric(l),
    scope,
    submeshes
  );

  if (!res || res.path.length < 2) {
    return {
      nextHopId: null,
      totalCost: Infinity,
      protocolUsed: 'HWMP',
      path: [],
      controlOverheadBytes: 48,
      discoveryDelayMs: 0,
      error: `Destination Unreachable: HWMP ALM path lookup failed from "${source.name}" to "${destination.name}"`,
    };
  }

  const hops = res.path.length - 1;
  const cost = Math.round(res.totalCost * 100) / 100;

  for (let i = 0; i < res.path.length - 1; i++) {
    const hopNode = nodes.get(res.path[i])!;
    const hs = ensureHwmpState(hopNode);
    hs.reactivePaths[destination.id] = {
      nextHop: res.path[i + 1],
      airtimeCost: cost,
      seqNum: srcHwmp.prepSeqNum,
      expiresAtSimMs: simTimeMs + 20000,
    };
    hopNode.routingTable[destination.id] = {
      nextHop: res.path[i + 1],
      cost,
      protocol: 'HWMP',
      timestamp: simTimeMs,
      seqNum: srcHwmp.prepSeqNum,
    };
  }

  const isProactiveRootDest = destination.id === srcHwmp.rootNodeId;
  return {
    nextHopId: res.path[1],
    totalCost: cost,
    protocolUsed: 'HWMP',
    path: res.path,
    controlOverheadBytes: isProactiveRootDest ? 0 : hops * 48 + 40,
    discoveryDelayMs: isProactiveRootDest ? 0 : Math.round(hops * 2.0 * 10) / 10,
    cacheHit: isProactiveRootDest,
  };
}

// ============================================================================
// 4. RPL: Routing Protocol for Low-Power and Lossy Networks (RFC 6550)
//    DODAG rooted at border gateway/sink, strict loop-free rank, DIO + DAO
// ============================================================================

export function ensureRplState(node: MeshNode): RplNodeState {
  if (!node.rplState) {
    node.rplState = {
      dodagVersion: 1,
      rank: node.rplRank ?? 255,
      dioIntervalMs: 4000,
      daoDownstream: {},
    };
  }
  return node.rplState;
}

/**
 * Recomputes RFC 6550 DODAG ranks, preferredParentId, and downward DAO tables
 * anchored at the submesh's active gateway/sink root.
 */
export function recomputeRplDodag(
  nodes: Map<string, MeshNode>,
  links: NetworkLink[],
  submeshes: Map<string, SubMeshDomain>,
  simTimeMs: number = 0,
  targetSubmeshId?: string,
  explicitRootId?: string
): number {
  let controlBytes = 0;

  const submeshIds = targetSubmeshId
    ? [targetSubmeshId]
    : Array.from(submeshes.values())
        .filter(sm => sm.protocol === 'RPL')
        .map(sm => sm.id);

  for (const smId of submeshIds) {
    const domainNodes = Array.from(nodes.values()).filter(n =>
      isNodeInOrBridgingSubmesh(n, smId, submeshes)
    );
    if (domainNodes.length === 0) continue;

    // Identify DODAG root(s): prefer alive boundary gateways with active interface in this submesh
    let roots = domainNodes.filter(n => {
      if (explicitRootId && n.id === explicitRootId) return true;
      if (!explicitRootId && n.type === 'gateway') {
        const sm = submeshes.get(smId);
        return sm ? gatewayHasActiveInterfaceForSubmesh(n, sm) : true;
      }
      return false;
    });

    if (roots.length === 0) {
      // Fallback: pick highest-capacity router in the RPL domain
      const fallbackRoot = [...domainNodes].sort(
        (a, b) => (a.type === 'router' ? 0 : 1) - (b.type === 'router' ? 0 : 1) || a.id.localeCompare(b.id)
      )[0];
      if (fallbackRoot) roots = [fallbackRoot];
    }

    // Sort roots deterministically (lowest configured rplRank / primary gateway first)
    roots.sort((a, b) => (a.rplRank ?? 1) - (b.rplRank ?? 1) || a.id.localeCompare(b.id));
    const primaryRoot = roots[0];
    if (!primaryRoot) continue;

    const adj = new Map<string, Array<{ target: string; rankStep: number }>>();
    for (const dn of domainNodes) {
      adj.set(dn.id, []);
      const rs = ensureRplState(dn);
      rs.dodagId = primaryRoot.id;
      rs.dodagVersion += 1;
      rs.rank = Infinity;
      rs.preferredParentId = undefined;
      rs.parentRank = undefined;
      rs.daoDownstream = {};
    }

    for (const link of links) {
      const u = nodes.get(link.source);
      const v = nodes.get(link.target);
      if (!isLinkUsableInSubmesh(link, u, v, smId, submeshes)) continue;

      const etx = 1 / Math.max(1 - (link.per ?? link.lossRate), 0.05);
      const snrPenalty = link.snrDb < 15 ? 0.5 : 0;
      const rankStep = Math.round((1 + (etx - 1) + snrPenalty) * 100) / 100; // Always >= 1.0 -> strict loop-free monotonicity
      adj.get(u!.id)?.push({ target: v!.id, rankStep });
      adj.get(v!.id)?.push({ target: u!.id, rankStep });
    }

    // Multi-source Dijkstra from active DODAG root(s) so backup gateway can serve nodes if primary gateway fails
    const dist = new Map<string, number>();
    const parent = new Map<string, string | undefined>();
    const pq: PQItem[] = [];

    for (const dn of domainNodes) dist.set(dn.id, Infinity);

    for (let idx = 0; idx < roots.length; idx++) {
      const r = roots[idx];
      const baseRank = idx === 0 ? 1 : 1.5; // Prefer primary root slightly while allowing seamless backup gateway failover
      dist.set(r.id, baseRank);
      parent.set(r.id, undefined);
      pq.push({ nodeId: r.id, cost: baseRank });
    }

    while (pq.length > 0) {
      pq.sort((a, b) => a.cost - b.cost || a.nodeId.localeCompare(b.nodeId));
      const curr = pq.shift()!;
      if (curr.cost > (dist.get(curr.nodeId) ?? Infinity)) continue;

      for (const edge of adj.get(curr.nodeId) || []) {
        const alt = Math.round((curr.cost + edge.rankStep) * 100) / 100;
        if (alt < (dist.get(edge.target) ?? Infinity)) {
          dist.set(edge.target, alt);
          parent.set(edge.target, curr.nodeId);
          pq.push({ nodeId: edge.target, cost: alt });
        }
      }
    }

    // Apply DODAG ranks & preferredParentId
    for (const dn of domainNodes) {
      const rankVal = dist.get(dn.id) ?? Infinity;
      const pId = parent.get(dn.id);
      const rs = dn.rplState!;
      rs.rank = Number.isFinite(rankVal) ? rankVal : 255;
      rs.preferredParentId = pId;
      rs.parentRank = pId ? dist.get(pId) : undefined;
      dn.rplRank = Number.isFinite(rankVal) ? Math.round(rankVal * 10) / 10 : 255;

      if (pId) {
        dn.routingTable[primaryRoot.id] = {
          nextHop: pId,
          cost: rs.rank,
          protocol: 'RPL',
          timestamp: simTimeMs,
        };
      }
      controlBytes += 28; // DIO message
    }

    // Upward DAO propagation to build downward routing tables on every ancestor
    for (const dn of domainNodes) {
      if (!Number.isFinite(dist.get(dn.id) ?? Infinity)) continue;
      let childId = dn.id;
      let pId = dn.rplState?.preferredParentId;
      const guard = new Set<string>([childId]);

      while (pId && !guard.has(pId)) {
        const pNode = nodes.get(pId);
        if (!pNode || !pNode.rplState) break;
        // Strict loop-free rank check: parent rank MUST be strictly less than child rank
        if (pNode.rplState.rank >= (nodes.get(childId)?.rplState?.rank ?? Infinity)) break;

        pNode.rplState.daoDownstream[dn.id] = childId;
        pNode.routingTable[dn.id] = {
          nextHop: childId,
          cost: Math.round(((dn.rplState?.rank ?? 1) - pNode.rplState.rank) * 100) / 100,
          protocol: 'RPL',
          timestamp: simTimeMs,
        };

        guard.add(pId);
        childId = pId;
        pId = pNode.rplState.preferredParentId;
        controlBytes += 24; // DAO message
      }
    }
  }

  return controlBytes;
}

export function resolveRplRoute(
  source: MeshNode,
  destination: MeshNode,
  nodes: Map<string, MeshNode>,
  links: NetworkLink[],
  rootNodeId?: string,
  options?: {
    simTimeMs?: number;
    restrictToSubmeshId?: string;
    submeshes?: Map<string, SubMeshDomain>;
  }
): RouteHopResult {
  if (source.id === destination.id) {
    return {
      nextHopId: null,
      totalCost: 0,
      protocolUsed: 'RPL',
      path: [source.id],
      controlOverheadBytes: 0,
      discoveryDelayMs: 0,
    };
  }

  const scope = options?.restrictToSubmeshId ?? source.submeshId;
  const submeshes = options?.submeshes ?? new Map<string, SubMeshDomain>();
  const controlBytes = recomputeRplDodag(
    nodes,
    links,
    submeshes,
    options?.simTimeMs ?? 0,
    scope,
    rootNodeId
  );

  // Follow DODAG storing mode:
  // If current node has destination in downward DAO table, go down; else go up to preferredParentId (strictly decreasing rank).
  const path: string[] = [source.id];
  const visited = new Set<string>([source.id]);
  let curr: MeshNode = source;
  let totalCost = 0;

  while (curr.id !== destination.id) {
    const rpl = curr.rplState;
    if (!rpl) break;

    let nextId: string | undefined = rpl.daoDownstream[destination.id];
    if (!nextId) {
      nextId = rpl.preferredParentId;
      // Verify strict rank decrease on upward hop (loop freedom!)
      if (nextId) {
        const nextRank = nodes.get(nextId)?.rplState?.rank ?? Infinity;
        if (nextRank >= rpl.rank) nextId = undefined;
      }
    }

    if (!nextId || visited.has(nextId)) break;
    const nextNode = nodes.get(nextId);
    const link = findLinkBetween(curr.id, nextId, links);
    if (!nextNode || !link || !isLinkUsableInSubmesh(link, curr, nextNode, scope, submeshes)) {
      break;
    }

    const etx = 1 / Math.max(1 - (link.per ?? link.lossRate), 0.05);
    totalCost += etx;
    path.push(nextId);
    visited.add(nextId);
    curr = nextNode;
  }

  if (path[path.length - 1] !== destination.id) {
    return {
      nextHopId: null,
      totalCost: Infinity,
      protocolUsed: 'RPL',
      path: [],
      controlOverheadBytes: controlBytes,
      discoveryDelayMs: 0,
      error: `Destination Unreachable: RPL DODAG has no loop-free upward/downward path from "${source.name}" to "${destination.name}"`,
    };
  }

  return {
    nextHopId: path[1],
    totalCost: Math.round(totalCost * 100) / 100,
    protocolUsed: 'RPL',
    path,
    controlOverheadBytes: controlBytes,
    discoveryDelayMs: 0,
  };
}

/**
 * Syncs protocol control planes across all submeshes (OLSR MPR/TC, HWMP root tree, RPL DODAG, AODV state).
 */
export function syncProtocolControlPlanes(
  nodes: Map<string, MeshNode>,
  links: NetworkLink[],
  submeshes: Map<string, SubMeshDomain>,
  simTimeMs: number = 0
): number {
  let overhead = 0;
  overhead += recomputeOlsrTopology(nodes, links, submeshes, simTimeMs);
  overhead += recomputeHwmpRootTree(nodes, links, submeshes, simTimeMs);
  overhead += recomputeRplDodag(nodes, links, submeshes, simTimeMs);
  for (const node of nodes.values()) {
    const sm = submeshes.get(node.submeshId);
    if (sm?.protocol === 'AODV') ensureAodvState(node);
  }
  return overhead;
}

// ============================================================================
// Comprehensive Multi-Mesh Auto-Pathfinding Pipeline
// ============================================================================

export function calculateMultiMeshRoute(
  sourceId: string,
  destId: string,
  nodes: Map<string, MeshNode> | MeshNode[],
  links: NetworkLink[],
  submeshes: Map<string, SubMeshDomain> | SubMeshDomain[],
  weights: RouteMetricWeights = DEFAULT_ROUTE_WEIGHTS,
  options?: { simTimeMs?: number }
): MultiMeshRouteResult {
  const nodeMap = nodes instanceof Map ? nodes : new Map(nodes.map(n => [n.id, n]));
  const submeshMap = submeshes instanceof Map ? submeshes : new Map(submeshes.map(s => [s.id, s]));
  const simTimeMs = options?.simTimeMs ?? 0;

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
    error: reason.startsWith('Destination Unreachable')
      ? reason
      : `Destination Unreachable: ${reason}`,
  });

  if (!sourceNode) return failResult(`Source node "${sourceId}" not found in network topology`);
  if (!destNode) return failResult(`Destination node "${destId}" not found in network topology`);
  if (!sourceNode.isAlive) return failResult(`Source node "${sourceNode.name}" is offline`);
  if (!destNode.isAlive) return failResult(`Destination node "${destNode.name}" is offline`);

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
      controlOverheadBytes: 0,
      discoveryDelayMs: 0,
    };
  }

  // Synchronize proactive / DAG control planes before route resolution
  const syncOverhead = syncProtocolControlPlanes(nodeMap, links, submeshMap, simTimeMs);
  let routeOverheadBytes = syncOverhead;
  let discoveryDelayMs = 0;

  let chosenPath: string[] | null = null;

  // Intra-domain fast-path: use the domain's genuine protocol resolver directly
  if (sourceNode.submeshId === destNode.submeshId) {
    const domain = submeshMap.get(sourceNode.submeshId);
    const protocol = domain?.protocol ?? 'HWMP';
    let protoRes: RouteHopResult;

    if (protocol === 'AODV') {
      protoRes = resolveAodvRoute(sourceNode, destNode, nodeMap, links, {
        simTimeMs,
        restrictToSubmeshId: sourceNode.submeshId,
        submeshes: submeshMap,
      });
    } else if (protocol === 'OLSR') {
      protoRes = resolveOlsrRoute(sourceNode, destNode, nodeMap, links, {
        simTimeMs,
        restrictToSubmeshId: sourceNode.submeshId,
        submeshes: submeshMap,
      });
    } else if (protocol === 'RPL') {
      protoRes = resolveRplRoute(sourceNode, destNode, nodeMap, links, undefined, {
        simTimeMs,
        restrictToSubmeshId: sourceNode.submeshId,
        submeshes: submeshMap,
      });
    } else {
      protoRes = resolveHwmpRoute(sourceNode, destNode, nodeMap, links, {
        simTimeMs,
        restrictToSubmeshId: sourceNode.submeshId,
        submeshes: submeshMap,
      });
    }

    routeOverheadBytes += protoRes.controlOverheadBytes ?? 0;
    discoveryDelayMs += protoRes.discoveryDelayMs ?? 0;
    if (protoRes.nextHopId && protoRes.path.length >= 2) {
      chosenPath = protoRes.path;
    }
  }

  // Cross-domain or intra-domain failover via multi-mesh gateway graph
  if (!chosenPath) {
    const adj = new Map<string, Array<{ target: string; link: NetworkLink; weight: number }>>();
    for (const node of nodeMap.values()) {
      if (node.isAlive) adj.set(node.id, []);
    }

    for (const link of links) {
      const u = nodeMap.get(link.source);
      const v = nodeMap.get(link.target);
      if (!isLinkUsableInSubmesh(link, u, v, undefined, submeshMap)) continue;

      const srcN = u!;
      const dstN = v!;
      const rate = Math.max(link.bandwidthMbps, 0.25);
      const rateCost = weights.alpha / rate;
      const hopCost = weights.beta * 1.0;
      const per = link.per ?? link.lossRate;
      const lossPenalty = 3.0 * Math.max(per, 0) + (1 / Math.max(1 - per, 0.05) - 1);

      const isCrossDomainHop = srcN.submeshId !== dstN.submeshId;
      const uSm = submeshMap.get(srcN.submeshId);
      const vSm = submeshMap.get(dstN.submeshId);

      // Compute directional protocol + gateway cost
      const computeDirectionalWeight = (fromN: MeshNode, toN: MeshNode): number => {
        const fromSm = submeshMap.get(fromN.submeshId);
        let gatewayDelayMs = 0;
        if (isCrossDomainHop) {
          const gwNode = fromN.type === 'gateway' ? fromN : toN;
          gatewayDelayMs = calculateGatewayDelay(gwNode, fromN.id === srcN.id ? uSm : vSm, fromN.id === srcN.id ? vSm : uSm);
          if (!Number.isFinite(gatewayDelayMs)) return Infinity;
        }
        const gatewayCost = weights.gamma * gatewayDelayMs;

        // Protocol-authentic edge weighting
        const proto = fromSm?.protocol ?? 'HWMP';
        let protoSpecific = 0;
        if (proto === 'HWMP') {
          protoSpecific = calculateAirtimeLinkMetric(link) * 0.25;
        } else if (proto === 'RPL') {
          const fromRank = fromN.rplState?.rank ?? fromN.rplRank ?? 10;
          const toRank = toN.rplState?.rank ?? toN.rplRank ?? 10;
          const isDodagEdge =
            fromN.rplState?.preferredParentId === toN.id ||
            toN.rplState?.preferredParentId === fromN.id;
          protoSpecific = isDodagEdge ? 0 : 2.5;
          if (link.snrDb < 15) protoSpecific += 2.0;
          if (fromRank === toRank) protoSpecific += 1.0;
        } else if (proto === 'OLSR') {
          const isMprLink =
            fromN.olsrState?.mprSet.includes(toN.id) || toN.olsrState?.mprSet.includes(fromN.id);
          protoSpecific = (1 / Math.max(1 - per, 0.05)) * (isMprLink ? 0.8 : 1.15);
        } else {
          // AODV optimizes minimum hop count
          protoSpecific = hopCost;
        }

        return rateCost + hopCost + lossPenalty + gatewayCost + protoSpecific;
      };

      const wUV = computeDirectionalWeight(srcN, dstN);
      const wVU = computeDirectionalWeight(dstN, srcN);
      if (Number.isFinite(wUV)) adj.get(srcN.id)?.push({ target: dstN.id, link, weight: wUV });
      if (Number.isFinite(wVU)) adj.get(dstN.id)?.push({ target: srcN.id, link, weight: wVU });
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
      pq.sort((a, b) => a.cost - b.cost || a.nodeId.localeCompare(b.nodeId));
      const curr = pq.shift()!;
      if (curr.nodeId === destId) break;
      if (curr.cost > (dist.get(curr.nodeId) ?? Infinity)) continue;

      for (const edge of adj.get(curr.nodeId) || []) {
        const alt = curr.cost + edge.weight;
        if (alt < (dist.get(edge.target) ?? Infinity)) {
          dist.set(edge.target, alt);
          prev.set(edge.target, curr.nodeId);
          pq.push({ nodeId: edge.target, cost: alt });
        }
      }
    }

    if (!prev.has(destId) || !Number.isFinite(dist.get(destId) ?? Infinity)) {
      return failResult(
        `No viable multi-mesh path between "${sourceNode.name}" and "${destNode.name}". Check link status, RF viability, or gateway interfaces.`
      );
    }

    const reconstructed: string[] = [];
    let curr: string | null = destId;
    while (curr !== null) {
      reconstructed.unshift(curr);
      curr = prev.get(curr) ?? null;
    }
    if (reconstructed[0] !== sourceId) {
      return failResult(`Discontinuous routing tree between "${sourceNode.name}" and "${destNode.name}"`);
    }
    chosenPath = reconstructed;

    // Account for reactive AODV/HWMP discovery along any reactive domains crossed
    const crossedAodv = Array.from(submeshMap.values()).some(
      s => s.protocol === 'AODV' && (s.id === sourceNode.submeshId || s.id === destNode.submeshId)
    );
    if (crossedAodv) {
      const cached = sourceNode.aodvState?.routes[destId];
      if (!cached || !cached.valid) {
        routeOverheadBytes += (chosenPath.length - 1) * 44;
        discoveryDelayMs += Math.round((chosenPath.length - 1) * 2.5 * 10) / 10;
      }
    }
  }

  const path = chosenPath;
  const nodesTraversed: MeshNode[] = path.map(id => nodeMap.get(id)!);
  const linksTraversed: NetworkLink[] = [];
  const segmentTraces: RouteSegmentTrace[] = [];
  const submeshIdSet = new Set<string>();
  const gatewaySet = new Set<string>();
  const protocolsUsedSet = new Set<ProtocolType>();

  let sumRateCost = 0;
  let sumGatewayCost = 0;
  let totalLatencyMs = discoveryDelayMs;
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

    const bw = link?.bandwidthMbps ?? fromSm?.defaultBandwidthMbps ?? 54;
    const distM = link?.distanceMeters ?? 15;
    const snr = link?.snrDb ?? 25;
    const loss = link?.per ?? link?.lossRate ?? 0.01;

    sumRateCost += weights.alpha / Math.max(bw, 0.25);

    const txDelayMs = ((512 * 8) / (Math.max(bw, 0.05) * 1e6)) * 1000;
    const propDelayMs = (distM / 3e8) * 1000;
    const queueDelayMs =
      fromN.queueCapacity > 0
        ? (fromN.currentQueue.length / fromN.queueCapacity) * 20
        : 0;
    const hopDelayMs = Math.max(txDelayMs + propDelayMs + queueDelayMs, 0.5);

    const isGw = fromN.type === 'gateway' || toN.type === 'gateway';
    const isDomainChange = fromN.submeshId !== toN.submeshId;
    let gatewayDelayMs = 0;

    if (isGw && isDomainChange) {
      const gwNode = fromN.type === 'gateway' ? fromN : toN;
      gatewaySet.add(gwNode.id);
      gatewayDelayMs = calculateGatewayDelay(gwNode, fromSm, toSm);
      if (Number.isFinite(gatewayDelayMs)) {
        sumGatewayCost += weights.gamma * gatewayDelayMs;
      } else {
        gatewayDelayMs = 0;
      }
    }

    totalLatencyMs += hopDelayMs + (Number.isFinite(gatewayDelayMs) ? gatewayDelayMs : 0);

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
      hopDelayMs: Math.round(hopDelayMs * 100) / 100,
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
    controlOverheadBytes: routeOverheadBytes,
    discoveryDelayMs,
  };
}
