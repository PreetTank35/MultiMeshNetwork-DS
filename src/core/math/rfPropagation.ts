/**
 * RF Propagation & Physical Channel Subsystem
 * Implements Friis Free-Space & Log-Distance Path Loss models,
 * deterministic seeded Gaussian shadow fading, co-channel interference,
 * and CSMA/CA collision probability.
 */

import { FrequencyBand, MeshNode, NetworkLink, SimulationConfig, SubMeshDomain } from '../../types/simulator';
import { hashStringToSeed, SeededPRNG } from './prng';

// Speed of light in m/s
export const SPEED_OF_LIGHT = 3e8;

export function frequencyBandToGhz(band?: FrequencyBand): number {
  switch (band) {
    case '5.2GHz':
      return 5.2;
    case '5.8GHz':
      return 5.8;
    case '915MHz':
      return 0.915;
    case '868MHz':
      return 0.868;
    case '2.4GHz':
    default:
      return 2.4;
  }
}

export function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.min(Math.max(val, min), max);
}

/**
 * Calculates Euclidean distance between two 2D/3D points in meters.
 * Safely clamps zero-distance or invalid coordinates without returning NaN.
 */
export function calculateDistance(
  pos1: { x: number; y: number; z?: number },
  pos2: { x: number; y: number; z?: number },
  scalePixelsToMeters: number = 0.05 // Matches CAD floor plan scale: 20px = 1 meter
): number {
  const x1 = Number.isFinite(pos1?.x) ? pos1.x : 0;
  const y1 = Number.isFinite(pos1?.y) ? pos1.y : 0;
  const z1 = Number.isFinite(pos1?.z) ? (pos1.z as number) : 0;
  const x2 = Number.isFinite(pos2?.x) ? pos2.x : 0;
  const y2 = Number.isFinite(pos2?.y) ? pos2.y : 0;
  const z2 = Number.isFinite(pos2?.z) ? (pos2.z as number) : 0;
  const scale = Number.isFinite(scalePixelsToMeters) && scalePixelsToMeters > 0 ? scalePixelsToMeters : 0.05;

  const dx = (x1 - x2) * scale;
  const dy = (y1 - y2) * scale;
  const dz = (z1 - z2) * scale;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!Number.isFinite(dist)) return 1.0;
  return Math.max(dist, 1.0); // Minimum 1 meter (d0) to avoid log(0) / NaN
}

/**
 * Friis Free-Space Transmission Loss Model
 * PL_free(d) [dB] = 20 log10(d) + 20 log10(f) + 20 log10(4*pi/c) - Gt - Gr
 */
export function calculateFriisLoss(
  distanceMeters: number,
  frequencyGhz: number,
  gainTxDbi: number = 2.0,
  gainRxDbi: number = 2.0
): number {
  const safeFreqGhz = Number.isFinite(frequencyGhz) && frequencyGhz > 0 ? frequencyGhz : 2.4;
  const fHz = safeFreqGhz * 1e9;
  const d = Math.max(Number.isFinite(distanceMeters) ? distanceMeters : 1.0, 1.0);
  const constantFactor = 20 * Math.log10((4 * Math.PI) / SPEED_OF_LIGHT);
  const plDb = 20 * Math.log10(d) + 20 * Math.log10(fHz) + constantFactor - gainTxDbi - gainRxDbi;
  return Math.max(plDb, 0);
}

/**
 * Log-Distance Path Loss Model with Deterministic Seeded Shadow Fading
 * PL(d) = PL(d0) + 10 * gamma * log10(d / d0) + X_sigma
 */
export function calculateLogDistanceLoss(
  distanceMeters: number,
  frequencyGhz: number,
  gamma: number = 2.8,
  shadowingStdDevDb: number = 0.0,
  referenceDistance: number = 1.0,
  prng?: SeededPRNG
): number {
  const d0 = Number.isFinite(referenceDistance) && referenceDistance > 0 ? referenceDistance : 1.0;
  const d = Math.max(Number.isFinite(distanceMeters) ? distanceMeters : d0, d0);
  const safeGamma = Number.isFinite(gamma) && gamma > 0 ? gamma : 2.8;
  const plD0 = calculateFriisLoss(d0, frequencyGhz);
  const logComponent = 10 * safeGamma * Math.log10(d / d0);

  let shadowFading = 0;
  if (Number.isFinite(shadowingStdDevDb) && shadowingStdDevDb > 0) {
    const rng = prng ?? new SeededPRNG(hashStringToSeed(`${d.toFixed(3)}:${frequencyGhz}:${safeGamma}`));
    shadowFading = rng.nextGaussian(0, shadowingStdDevDb);
  }

  return Math.max(plD0 + logComponent + shadowFading, 0);
}

/**
 * Calculates received signal power (Prx in dBm)
 * Prx [dBm] = Ptx [dBm] - PathLoss [dB]
 */
export function calculateReceivedPower(txPowerDbm: number, pathLossDb: number): number {
  const ptx = Number.isFinite(txPowerDbm) ? txPowerDbm : 20;
  const pl = Number.isFinite(pathLossDb) ? pathLossDb : 0;
  return ptx - pl;
}

/**
 * Evaluates Signal-to-Interference-plus-Noise Ratio (SNR / SINR) in dB
 */
export function calculateSNR(
  rxPowerDbm: number,
  channelWidthMhz: number = 20,
  noiseFigureDb: number = 7.0,
  noiseFloorDbm?: number,
  interferenceDbm: number = -Infinity
): number {
  const widthMhz = Number.isFinite(channelWidthMhz) && channelWidthMhz > 0 ? channelWidthMhz : 20;
  const bandwidthHz = widthMhz * 1e6;
  const thermalNoiseDbm = -174 + 10 * Math.log10(bandwidthHz) + noiseFigureDb;

  let totalNoiseMw = Math.pow(10, thermalNoiseDbm / 10);
  if (noiseFloorDbm !== undefined && Number.isFinite(noiseFloorDbm)) {
    totalNoiseMw += Math.pow(10, noiseFloorDbm / 10);
  }
  if (Number.isFinite(interferenceDbm) && interferenceDbm > -150) {
    totalNoiseMw += Math.pow(10, interferenceDbm / 10);
  }

  const effectiveNoiseDbm = 10 * Math.log10(Math.max(totalNoiseMw, 1e-18));
  return rxPowerDbm - effectiveNoiseDbm;
}

/**
 * Computes Bit Error Rate (BER) from SNR for BPSK/QPSK modulation
 */
export function calculateBER(snrDb: number): number {
  if (!Number.isFinite(snrDb) || snrDb <= 0) return 0.5;
  if (snrDb >= 25) return 1e-8;

  const snrLinear = Math.pow(10, snrDb / 10);
  const ebN0 = snrLinear / 2;
  const arg = Math.sqrt(2 * ebN0);
  const ber = (0.5 * Math.exp((-arg * arg) / 2)) / (Math.sqrt(2 * Math.PI) * arg);
  return clamp(ber, 1e-8, 0.5);
}

/**
 * Calculates Packet Error Rate (PER) for a given packet length L in bytes
 * PER = 1 - (1 - BER)^L_bits
 */
export function calculatePER(ber: number, packetSizeBytes: number = 512): number {
  const safeBytes = Number.isFinite(packetSizeBytes) && packetSizeBytes > 0 ? packetSizeBytes : 512;
  const safeBer = clamp(ber, 0, 1);
  const lengthBits = safeBytes * 8;
  const per = 1 - Math.pow(1 - safeBer, lengthBits);
  return clamp(per, 0.0, 1.0);
}

export interface PhysicalLinkEvalOptions {
  channelWidthMhz?: number;
  noiseFloorDbm?: number;
  noiseFigureDb?: number;
  attenuationDb?: number;
  interferenceDbm?: number;
  collisionProbability?: number;
  payloadSizeBytes?: number;
  rxSensitivityDbm?: number;
  packetErrorRateOverride?: number;
  prng?: SeededPRNG;
  scalePixelsToMeters?: number;
  isJammed?: boolean;
}

export interface PhysicalLinkEvalResult {
  distanceMeters: number;
  pathLossDb: number;
  rxPowerDbm: number;
  snrDb: number;
  ber: number;
  per: number;
  rfPer: number;
  collisionProbability: number;
  interferenceDbm: number;
  isViable: boolean;
}

/**
 * Evaluates complete physical layer link quality between two node positions.
 * Enforces receiver sensitivity and minimum SNR without capping PER at 0.95.
 */
export function evaluatePhysicalLink(
  pos1: { x: number; y: number; z?: number },
  pos2: { x: number; y: number; z?: number },
  txPowerDbm: number,
  frequencyGhz: number,
  config: SimulationConfig,
  options?: PhysicalLinkEvalOptions
): PhysicalLinkEvalResult {
  const distanceMeters = calculateDistance(pos1, pos2, options?.scalePixelsToMeters ?? 0.05);
  let basePathLossDb: number;

  if (config.pathLossModel === 'Friis') {
    basePathLossDb = calculateFriisLoss(distanceMeters, frequencyGhz);
  } else {
    basePathLossDb = calculateLogDistanceLoss(
      distanceMeters,
      frequencyGhz,
      config.pathLossExponent,
      config.shadowingStdDevDb,
      config.referenceDistanceMeters,
      options?.prng
    );
  }

  const extraAttenuationDb = Number.isFinite(options?.attenuationDb)
    ? Math.max(0, options!.attenuationDb!)
    : 0;
  const pathLossDb = basePathLossDb + extraAttenuationDb;
  const rxPowerDbm = calculateReceivedPower(txPowerDbm, pathLossDb);

  const channelWidthMhz =
    options?.channelWidthMhz && options.channelWidthMhz > 0 ? options.channelWidthMhz : 20;
  const noiseFloorDbm = options?.noiseFloorDbm ?? config.noiseFloorDbm;

  let interferenceDbm = options?.interferenceDbm ?? -Infinity;
  if (options?.isJammed) {
    // Active broadband / narrowband jammer injects strong interference at receiver
    const jammerPowerDbm = -40;
    if (Number.isFinite(interferenceDbm) && interferenceDbm > -150) {
      interferenceDbm =
        10 * Math.log10(Math.pow(10, interferenceDbm / 10) + Math.pow(10, jammerPowerDbm / 10));
    } else {
      interferenceDbm = jammerPowerDbm;
    }
  }

  const effectiveInterferenceDbm = config.enableInterference === false && !options?.isJammed
    ? -Infinity
    : interferenceDbm;

  const snrDb = calculateSNR(
    rxPowerDbm,
    channelWidthMhz,
    options?.noiseFigureDb ?? 7.0,
    noiseFloorDbm,
    effectiveInterferenceDbm
  );

  const ber = calculateBER(snrDb);
  const payloadBytes =
    options?.payloadSizeBytes && options.payloadSizeBytes > 0 ? options.payloadSizeBytes : 512;
  const rfPer = calculatePER(ber, payloadBytes);

  const rxSensitivityDbm = options?.rxSensitivityDbm ?? config.rxSensitivityDbm ?? -90;
  const isViable = !options?.isJammed && rxPowerDbm >= rxSensitivityDbm && snrDb >= 8.0;

  const collisionProb =
    config.enableCollisions === false
      ? 0
      : clamp(options?.collisionProbability ?? 0, 0, 1);

  const perOverride = options?.packetErrorRateOverride ?? config.packetErrorRateOverride;

  let effectivePer: number;
  if (!isViable) {
    effectivePer = 1.0;
  } else if (perOverride !== undefined && Number.isFinite(perOverride)) {
    effectivePer = clamp(perOverride, 0, 1);
  } else {
    effectivePer = clamp(1 - (1 - rfPer) * (1 - collisionProb), 0, 1);
  }

  return {
    distanceMeters,
    pathLossDb,
    rxPowerDbm,
    snrDb,
    ber,
    per: effectivePer,
    rfPer,
    collisionProbability: collisionProb,
    interferenceDbm: Number.isFinite(effectiveInterferenceDbm) ? effectiveInterferenceDbm : -174,
    isViable,
  };
}

/**
 * Resolves the RF band & channel used by a link based on its endpoint interfaces and submesh.
 */
export function resolveLinkChannelContext(
  link: NetworkLink,
  nodes: Map<string, MeshNode>,
  submeshes: Map<string, SubMeshDomain>
): { frequencyBand: FrequencyBand; channel: number; channelWidthMhz: number; txPowerDbm: number } {
  const srcNode = nodes.get(link.source);
  const dstNode = nodes.get(link.target);
  const srcSm = srcNode ? submeshes.get(srcNode.submeshId) : undefined;
  const dstSm = dstNode ? submeshes.get(dstNode.submeshId) : undefined;

  // Prefer matching interface bound to target or peer submesh when gateway is involved
  const targetSubmeshId =
    srcNode?.type === 'gateway' && dstSm
      ? dstSm.id
      : dstNode?.type === 'gateway' && srcSm
      ? srcSm.id
      : srcSm?.id || dstSm?.id;

  const activeSm = (targetSubmeshId ? submeshes.get(targetSubmeshId) : undefined) || srcSm || dstSm;

  const srcIface =
    srcNode?.interfaces.find(i => i.isUp !== false && (!targetSubmeshId || i.submeshId === targetSubmeshId)) ||
    srcNode?.interfaces.find(i => i.isUp !== false && (!activeSm || i.frequencyBand === activeSm.frequencyBand)) ||
    srcNode?.interfaces[0];

  const dstIface =
    dstNode?.interfaces.find(i => i.isUp !== false && (!targetSubmeshId || i.submeshId === targetSubmeshId)) ||
    dstNode?.interfaces.find(i => i.isUp !== false && (!activeSm || i.frequencyBand === activeSm.frequencyBand)) ||
    dstNode?.interfaces[0];

  const frequencyBand: FrequencyBand =
    link.frequencyBand || activeSm?.frequencyBand || srcIface?.frequencyBand || dstIface?.frequencyBand || '2.4GHz';
  const channel: number =
    link.channel ?? activeSm?.channelNumber ?? srcIface?.channel ?? dstIface?.channel ?? 6;
  const channelWidthMhz: number = activeSm?.channelWidthMhz && activeSm.channelWidthMhz > 0 ? activeSm.channelWidthMhz : 20;
  const txPowerDbm = Math.min(
    srcIface?.txPowerDbm ?? srcNode?.txPowerDbm ?? 20,
    dstIface?.txPowerDbm ?? dstNode?.txPowerDbm ?? 20
  );

  return { frequencyBand, channel, channelWidthMhz, txPowerDbm };
}

/**
 * Computes co-channel interference (dBm) at the target link receiver from concurrent transmissions
 * on the same frequency band and channel, plus any jammed channel energy.
 */
export function computeCoChannelInterferenceDbm(
  targetLink: NetworkLink,
  allLinks: NetworkLink[],
  nodes: Map<string, MeshNode>,
  submeshes: Map<string, SubMeshDomain>,
  config: SimulationConfig,
  jammedFrequencies?: Set<FrequencyBand>,
  jammedChannels?: Set<string>
): number {
  const ctx = resolveLinkChannelContext(targetLink, nodes, submeshes);
  const chKey = `${ctx.frequencyBand}:${ctx.channel}`;

  if (
    targetLink.isJammed ||
    jammedFrequencies?.has(ctx.frequencyBand) ||
    jammedChannels?.has(chKey)
  ) {
    return -40.0;
  }

  if (config.enableInterference === false) {
    return -Infinity;
  }

  const rxNode = nodes.get(targetLink.target);
  const txNode = nodes.get(targetLink.source);
  if (!rxNode || !txNode) return -Infinity;

  const freqGhz = frequencyBandToGhz(ctx.frequencyBand);
  let totalInterferenceMw = 0;

  for (const other of allLinks) {
    if (other.id === targetLink.id || other.isSevered) continue;
    if (other.currentLoad <= 0) continue;
    // Skip links sharing an endpoint with targetLink (coordinated by same-node CSMA/CA MAC)
    if (
      other.source === targetLink.source ||
      other.source === targetLink.target ||
      other.target === targetLink.source ||
      other.target === targetLink.target
    ) {
      continue;
    }

    const otherCtx = resolveLinkChannelContext(other, nodes, submeshes);
    if (otherCtx.frequencyBand !== ctx.frequencyBand) continue;
    // Orthogonal channels on the same band experience minimal overlap (~20 dB isolation)
    const channelIsolationDb = otherCtx.channel === ctx.channel ? 0 : 22;

    const interfererNode = nodes.get(other.source);
    if (!interfererNode || !interfererNode.isAlive) continue;

    const dist = calculateDistance(interfererNode.position, rxNode.position);
    const pl =
      config.pathLossModel === 'Friis'
        ? calculateFriisLoss(dist, freqGhz)
        : calculateLogDistanceLoss(
            dist,
            freqGhz,
            config.pathLossExponent,
            0,
            config.referenceDistanceMeters
          );
    const rxInterfDbm = otherCtx.txPowerDbm - pl - channelIsolationDb;
    totalInterferenceMw += Math.pow(10, rxInterfDbm / 10);
  }

  if (totalInterferenceMw <= 0) return -Infinity;
  return 10 * Math.log10(totalInterferenceMw);
}

/**
 * Computes CSMA/CA contention & hidden-terminal collision probability on a shared channel.
 */
export function computeCsmaCollisionProbability(
  targetLink: NetworkLink,
  allLinks: NetworkLink[],
  nodes: Map<string, MeshNode>,
  submeshes: Map<string, SubMeshDomain>,
  config: SimulationConfig
): number {
  if (config.enableCollisions === false) return 0;

  const ctx = resolveLinkChannelContext(targetLink, nodes, submeshes);
  let sameChannelLinks = 0;
  let activeSameChannelContenders = 0;
  let totalConcurrentLoad = Math.max(0, targetLink.currentLoad);

  for (const other of allLinks) {
    if (other.id === targetLink.id || other.isSevered) continue;
    const otherCtx = resolveLinkChannelContext(other, nodes, submeshes);
    if (otherCtx.frequencyBand !== ctx.frequencyBand || otherCtx.channel !== ctx.channel) continue;

    sameChannelLinks++;
    const sharesEndpoint =
      other.source === targetLink.source ||
      other.source === targetLink.target ||
      other.target === targetLink.source ||
      other.target === targetLink.target;

    if (other.currentLoad > 0) {
      activeSameChannelContenders += sharesEndpoint ? 1.5 : 1.0;
      totalConcurrentLoad += other.currentLoad;
    }
  }

  // Also check queued backlog on same-channel nodes
  let queuedContenders = 0;
  for (const node of nodes.values()) {
    if (!node.isAlive) continue;
    const sm = submeshes.get(node.submeshId);
    if (sm && sm.frequencyBand === ctx.frequencyBand && sm.channelNumber === ctx.channel) {
      if (node.currentQueue.length > 0 && node.id !== targetLink.source && node.id !== targetLink.target) {
        queuedContenders++;
      }
    }
  }

  if (activeSameChannelContenders <= 0 && queuedContenders <= 0 && targetLink.currentLoad <= 1) {
    // Single isolated transmission has negligible collision risk; very dense monolithic shared channels still incur small RTS/ACK contention when busy
    return sameChannelLinks >= 12 && targetLink.currentLoad > 0 ? 0.03 : 0;
  }

  const effectiveContenders = activeSameChannelContenders + queuedContenders * 0.5;
  const densityPenalty = Math.max(0, sameChannelLinks - 6) * 0.012;
  const collisionProb =
    1 - Math.exp(-(0.12 * effectiveContenders + 0.06 * Math.max(0, totalConcurrentLoad - 1) + densityPenalty));

  return clamp(collisionProb, 0, 0.85);
}
