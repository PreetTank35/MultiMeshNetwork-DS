/**
 * Mobility Kinematic & Dynamic Connectivity Subsystem
 * Implements deterministic Static, Random Waypoint (RWP with target + pause timer),
 * and Linear Trajectory models, plus dynamic RF neighbor link maintenance.
 */

import {
  FrequencyBand,
  MeshNode,
  NetworkLink,
  SimulationConfig,
  SubMeshDomain,
} from '../../types/simulator';
import { hashStringToSeed, SeededPRNG } from '../math/prng';
import { clamp, evaluatePhysicalLink, frequencyBandToGhz } from '../math/rfPropagation';

const fallbackNodePrngs = new WeakMap<MeshNode, SeededPRNG>();

function getFallbackPrng(node: MeshNode): SeededPRNG {
  let rng = fallbackNodePrngs.get(node);
  if (!rng) {
    rng = new SeededPRNG(hashStringToSeed(node.id));
    fallbackNodePrngs.set(node, rng);
  }
  return rng;
}

export interface MobilityUpdateResult {
  anyMoved: boolean;
  movedNodeIds: string[];
}

/**
 * Advances mobile nodes deterministically over deltaSimSeconds.
 * Zero Math.random() calls; uses provided SeededPRNG.
 */
export function updateMobileNodesDetailed(
  nodes: Map<string, MeshNode>,
  deltaSimSeconds: number,
  prng?: SeededPRNG
): MobilityUpdateResult {
  if (!Number.isFinite(deltaSimSeconds) || deltaSimSeconds <= 0) {
    return { anyMoved: false, movedNodeIds: [] };
  }

  let anyMoved = false;
  const movedNodeIds: string[] = [];

  for (const node of nodes.values()) {
    if (!node.isAlive || node.type !== 'mobile' || node.mobilityModel === 'static') {
      continue;
    }

    const rng = prng ?? getFallbackPrng(node);
    const rawBounds = node.mobilityBounds || { minX: 100, maxX: 900, minY: 100, maxY: 600 };
    const minX = Math.min(rawBounds.minX, rawBounds.maxX);
    const maxX = Math.max(rawBounds.minX, rawBounds.maxX);
    const minY = Math.min(rawBounds.minY, rawBounds.maxY);
    const maxY = Math.max(rawBounds.minY, rawBounds.maxY);

    const prevX = node.position.x;
    const prevY = node.position.y;

    if (node.mobilityModel === 'random_waypoint') {
      let remainingDt = deltaSimSeconds;

      // Handle arrival pause timer
      if ((node.mobilityPauseRemainingSec ?? 0) > 0) {
        const pauseLeft = node.mobilityPauseRemainingSec!;
        if (pauseLeft >= remainingDt) {
          node.mobilityPauseRemainingSec = pauseLeft - remainingDt;
          node.velocity = { vx: 0, vy: 0 };
          continue;
        }
        remainingDt -= pauseLeft;
        node.mobilityPauseRemainingSec = 0;
      }

      // Select a new deterministic waypoint if none active
      if (!node.waypointTarget) {
        const tx = minX === maxX ? minX : rng.nextRange(minX, maxX);
        const ty = minY === maxY ? minY : rng.nextRange(minY, maxY);
        const speed = rng.nextRange(25, 60);
        const dx = tx - node.position.x;
        const dy = ty - node.position.y;
        const dist = Math.hypot(dx, dy);

        node.waypointTarget = { x: tx, y: ty };
        if (dist > 1e-6) {
          node.velocity = { vx: (dx / dist) * speed, vy: (dy / dist) * speed };
        } else {
          node.velocity = { vx: 0, vy: 0 };
        }
      }

      const target = node.waypointTarget;
      const dx = target.x - node.position.x;
      const dy = target.y - node.position.y;
      const dist = Math.hypot(dx, dy);
      const speed = Math.max(
        Math.hypot(node.velocity?.vx ?? 0, node.velocity?.vy ?? 0),
        25
      );
      const stepDist = speed * remainingDt;

      if (dist <= stepDist || dist < 1e-3) {
        // Arrived at waypoint; enter pause interval
        node.position.x = clamp(target.x, minX, maxX);
        node.position.y = clamp(target.y, minY, maxY);
        node.waypointTarget = null;
        node.velocity = { vx: 0, vy: 0 };
        node.mobilityPauseRemainingSec = rng.nextRange(0.4, 2.0);
      } else {
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;
        node.position.x = clamp(node.position.x + vx * remainingDt, minX, maxX);
        node.position.y = clamp(node.position.y + vy * remainingDt, minY, maxY);
        node.velocity = { vx, vy };
      }

      if (Math.abs(node.position.x - prevX) > 1e-6 || Math.abs(node.position.y - prevY) > 1e-6) {
        anyMoved = true;
        movedNodeIds.push(node.id);
      }
    } else if (node.mobilityModel === 'linear') {
      let vx = node.velocity?.vx ?? 0;
      let vy = node.velocity?.vy ?? 0;
      if (vx === 0 && vy === 0) {
        vx = 30;
        vy = 0;
      }

      let newX = node.position.x + vx * deltaSimSeconds;
      let newY = node.position.y + vy * deltaSimSeconds;

      if (minX === maxX) {
        newX = minX;
        vx = 0;
      } else if (newX < minX) {
        newX = minX + (minX - newX);
        vx = Math.abs(vx);
      } else if (newX > maxX) {
        newX = maxX - (newX - maxX);
        vx = -Math.abs(vx);
      }
      newX = clamp(newX, minX, maxX);

      if (minY === maxY) {
        newY = minY;
        vy = 0;
      } else if (newY < minY) {
        newY = minY + (minY - newY);
        vy = Math.abs(vy);
      } else if (newY > maxY) {
        newY = maxY - (newY - maxY);
        vy = -Math.abs(vy);
      }
      newY = clamp(newY, minY, maxY);

      node.position.x = newX;
      node.position.y = newY;
      node.velocity = { vx, vy };

      if (Math.abs(newX - prevX) > 1e-6 || Math.abs(newY - prevY) > 1e-6) {
        anyMoved = true;
        movedNodeIds.push(node.id);
      }
    }
  }

  return { anyMoved, movedNodeIds };
}

/**
 * Backward-compatible wrapper returning boolean whether any mobile node moved.
 */
export function updateMobileNodes(
  nodes: Map<string, MeshNode>,
  deltaSimSeconds: number,
  prng?: SeededPRNG
): boolean {
  return updateMobileNodesDetailed(nodes, deltaSimSeconds, prng).anyMoved;
}

export interface DynamicMobilityLinkSyncResult {
  addedLinks: NetworkLink[];
  removedLinks: NetworkLink[];
  updatedLinks: NetworkLink[];
  topologyChanged: boolean;
}

function isGatewayCompatibleWithSubmesh(node: MeshNode, submesh: SubMeshDomain): boolean {
  if (node.submeshId === submesh.id) return true;
  if (node.type !== 'gateway') return false;
  return node.interfaces.some(
    iface =>
      iface.isUp !== false &&
      (iface.submeshId === submesh.id ||
        (iface.frequencyBand === submesh.frequencyBand && iface.channel === submesh.channelNumber))
  );
}

/**
 * Synchronizes wireless links for mobile nodes:
 * - Recalculates RF metrics on incident links
 * - Drops out-of-range / non-viable dynamic links
 * - Creates dynamic neighbor links to compatible in-range peers
 */
export function updateDynamicMobilityLinks(
  nodes: Map<string, MeshNode>,
  links: NetworkLink[],
  submeshes: Map<string, SubMeshDomain>,
  config: SimulationConfig,
  options?: {
    prng?: SeededPRNG;
    jammedFrequencies?: Set<FrequencyBand>;
    jammedChannels?: Set<string>;
    maxDynamicLinksPerMobileNode?: number;
    maxDynamicRangeMeters?: number;
  }
): DynamicMobilityLinkSyncResult {
  const addedLinks: NetworkLink[] = [];
  const removedLinks: NetworkLink[] = [];
  const updatedLinks: NetworkLink[] = [];

  const maxPerMobile = options?.maxDynamicLinksPerMobileNode ?? 2;
  const maxRangeMeters = options?.maxDynamicRangeMeters ?? 25;

  const findLinkIdx = (a: string, b: string) =>
    links.findIndex(
      l => (l.source === a && l.target === b) || (l.source === b && l.target === a)
    );

  // 1. Evaluate existing dynamic links incident to mobile nodes and drop non-viable ones
  for (let i = links.length - 1; i >= 0; i--) {
    const link = links[i];
    const src = nodes.get(link.source);
    const dst = nodes.get(link.target);
    if (!src || !dst) continue;

    if (src.type !== 'mobile' && dst.type !== 'mobile') continue;

    const mobileNode = src.type === 'mobile' ? src : dst;
    const peerNode = src.type === 'mobile' ? dst : src;
    const mobileSm = submeshes.get(mobileNode.submeshId);
    if (!mobileSm) continue;

    const compatible =
      mobileNode.isAlive &&
      peerNode.isAlive &&
      isGatewayCompatibleWithSubmesh(peerNode, mobileSm);

    const freqGhz = frequencyBandToGhz(mobileSm.frequencyBand);
    const txPower = Math.min(mobileNode.txPowerDbm, peerNode.txPowerDbm);
    const chKey = `${mobileSm.frequencyBand}:${mobileSm.channelNumber}`;
    const isJammed =
      link.isJammed ||
      options?.jammedFrequencies?.has(mobileSm.frequencyBand) ||
      options?.jammedChannels?.has(chKey) ||
      false;

    const evalRes = evaluatePhysicalLink(
      mobileNode.position,
      peerNode.position,
      txPower,
      freqGhz,
      config,
      {
        channelWidthMhz: mobileSm.channelWidthMhz,
        noiseFloorDbm: config.noiseFloorDbm,
        rxSensitivityDbm: Math.max(
          mobileNode.receiverSensitivityDbm ?? config.rxSensitivityDbm ?? -90,
          peerNode.receiverSensitivityDbm ?? config.rxSensitivityDbm ?? -90
        ),
        prng: options?.prng,
        isJammed,
      }
    );

    link.distanceMeters = evalRes.distanceMeters;
    link.snrDb = evalRes.snrDb;
    link.rxPowerDbm = evalRes.rxPowerDbm;
    link.per = evalRes.per;
    link.lossRate = evalRes.per;
    link.isViable = evalRes.isViable;
    updatedLinks.push(link);

    if (link.isDynamic && (!compatible || !evalRes.isViable || evalRes.distanceMeters > maxRangeMeters * 1.2)) {
      links.splice(i, 1);
      removedLinks.push(link);
    }
  }

  // 2. Discover new dynamic links for each alive mobile node
  for (const mobileNode of nodes.values()) {
    if (!mobileNode.isAlive || mobileNode.type !== 'mobile') continue;
    const mobileSm = submeshes.get(mobileNode.submeshId);
    if (!mobileSm) continue;

    // Count existing active (non-severed) links attached to this mobile node
    const existingIncident = links.filter(
      l => (l.source === mobileNode.id || l.target === mobileNode.id) && !l.isSevered
    );

    const freqGhz = frequencyBandToGhz(mobileSm.frequencyBand);
    const chKey = `${mobileSm.frequencyBand}:${mobileSm.channelNumber}`;
    const bandJammed =
      options?.jammedFrequencies?.has(mobileSm.frequencyBand) ||
      options?.jammedChannels?.has(chKey) ||
      false;

    const candidates: Array<{ peer: MeshNode; snrDb: number; distanceMeters: number; per: number; rxPowerDbm: number; isViable: boolean }> = [];

    for (const peer of nodes.values()) {
      if (peer.id === mobileNode.id || !peer.isAlive) continue;
      if (!isGatewayCompatibleWithSubmesh(peer, mobileSm)) continue;
      if (findLinkIdx(mobileNode.id, peer.id) !== -1) continue;

      const evalRes = evaluatePhysicalLink(
        mobileNode.position,
        peer.position,
        Math.min(mobileNode.txPowerDbm, peer.txPowerDbm),
        freqGhz,
        config,
        {
          channelWidthMhz: mobileSm.channelWidthMhz,
          noiseFloorDbm: config.noiseFloorDbm,
          rxSensitivityDbm: Math.max(
            mobileNode.receiverSensitivityDbm ?? config.rxSensitivityDbm ?? -90,
            peer.receiverSensitivityDbm ?? config.rxSensitivityDbm ?? -90
          ),
          prng: options?.prng,
          isJammed: bandJammed,
        }
      );

      if (evalRes.isViable && evalRes.distanceMeters <= maxRangeMeters) {
        candidates.push({
          peer,
          snrDb: evalRes.snrDb,
          distanceMeters: evalRes.distanceMeters,
          per: evalRes.per,
          rxPowerDbm: evalRes.rxPowerDbm,
          isViable: evalRes.isViable,
        });
      }
    }

    // Prefer closest / strongest SNR neighbors
    candidates.sort((a, b) => a.distanceMeters - b.distanceMeters || b.snrDb - a.snrDb);

    // Also prune excess dynamic links if mobile node now has a strictly closer neighbor
    let currentCount = existingIncident.length;
    for (const cand of candidates) {
      if (currentCount >= maxPerMobile) break;
      const bw =
        mobileNode.interfaces[0]?.bandwidthMbps ||
        mobileSm.defaultBandwidthMbps ||
        (mobileSm.protocol === 'RPL' ? 2.5 : 54);
      const newLink: NetworkLink = {
        id: `dyn_${mobileNode.id}_${cand.peer.id}`,
        source: mobileNode.id,
        target: cand.peer.id,
        bandwidthMbps: bw,
        lossRate: cand.per,
        per: cand.per,
        distanceMeters: cand.distanceMeters,
        snrDb: cand.snrDb,
        rxPowerDbm: cand.rxPowerDbm,
        isViable: cand.isViable,
        isSevered: false,
        isJammed: bandJammed,
        isDynamic: true,
        frequencyBand: mobileSm.frequencyBand,
        channel: mobileSm.channelNumber,
        currentLoad: 0,
        traversalCount: 0,
      };
      links.push(newLink);
      addedLinks.push(newLink);
      currentCount++;
    }
  }

  return {
    addedLinks,
    removedLinks,
    updatedLinks,
    topologyChanged: addedLinks.length > 0 || removedLinks.length > 0,
  };
}
