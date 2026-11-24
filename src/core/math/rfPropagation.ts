/**
 * RF Propagation & Physical Channel Subsystem
 * Implements Friis Free-Space & Log-Distance Path Loss models from Chapter 5.2
 */

import { SimulationConfig } from '../../types/simulator';

// Speed of light in m/s
export const SPEED_OF_LIGHT = 3e8;

/**
 * Calculates Euclidean distance between two 2D/3D points in meters
 */
export function calculateDistance(
  pos1: { x: number; y: number; z?: number },
  pos2: { x: number; y: number; z?: number },
  scalePixelsToMeters: number = 0.5 // 1 pixel = 0.5 meters default
): number {
  const dx = (pos1.x - pos2.x) * scalePixelsToMeters;
  const dy = (pos1.y - pos2.y) * scalePixelsToMeters;
  const dz = ((pos1.z || 0) - (pos2.z || 0)) * scalePixelsToMeters;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Math.max(dist, 1.0); // Minimum 1 meter to avoid division by zero / log(0)
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
  const fHz = frequencyGhz * 1e9;
  const d = Math.max(distanceMeters, 1.0);
  const constantFactor = 20 * Math.log10((4 * Math.PI) / SPEED_OF_LIGHT);
  const plDb = 20 * Math.log10(d) + 20 * Math.log10(fHz) + constantFactor - gainTxDbi - gainRxDbi;
  return Math.max(plDb, 0);
}

/**
 * Log-Distance Path Loss Model with Shadow Fading
 * PL(d) = PL(d0) + 10 * gamma * log10(d / d0) + X_sigma
 * Where d0 is reference distance (1m), gamma is path loss exponent (2.7 to 3.5),
 * and X_sigma is zero-mean Gaussian random variable with std dev sigma.
 */
export function calculateLogDistanceLoss(
  distanceMeters: number,
  frequencyGhz: number,
  gamma: number = 3.2,
  shadowingStdDevDb: number = 4.0,
  referenceDistance: number = 1.0
): number {
  const d = Math.max(distanceMeters, referenceDistance);
  // Free space loss at reference distance d0
  const plD0 = calculateFriisLoss(referenceDistance, frequencyGhz);
  
  // Deterministic log-distance progression
  const logComponent = 10 * gamma * Math.log10(d / referenceDistance);

  // Box-Muller transform for zero-mean Gaussian shadow fading
  const u1 = Math.random() || 0.0001;
  const u2 = Math.random() || 0.0001;
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const shadowFading = z0 * shadowingStdDevDb;

  return Math.max(plD0 + logComponent + shadowFading, 0);
}

/**
 * Calculates received signal power (Prx in dBm)
 * Prx [dBm] = Ptx [dBm] - PathLoss [dB]
 */
export function calculateReceivedPower(
  txPowerDbm: number,
  pathLossDb: number
): number {
  return txPowerDbm - pathLossDb;
}

/**
 * Evaluates Signal-to-Noise Ratio (SNR) in dB
 * SNR [dB] = Prx [dBm] - NoiseFloor [dBm]
 * where NoiseFloor N0 = -174 dBm/Hz + 10 log10(B) + NF
 */
export function calculateSNR(
  rxPowerDbm: number,
  channelWidthMhz: number = 20,
  noiseFigureDb: number = 7.0
): number {
  const bandwidthHz = channelWidthMhz * 1e6;
  const thermalNoiseDbm = -174 + 10 * Math.log10(bandwidthHz) + noiseFigureDb;
  return rxPowerDbm - thermalNoiseDbm;
}

/**
 * Computes Bit Error Rate (BER) from SNR for BPSK/QPSK modulation
 * Approximated via complementary error function Q-function
 */
export function calculateBER(snrDb: number): number {
  if (snrDb <= 0) return 0.5; // Complete noise
  if (snrDb >= 25) return 1e-8; // Virtually error-free

  // Convert SNR from dB to linear scale
  const snrLinear = Math.pow(10, snrDb / 10);
  const ebN0 = snrLinear / 2; // For standard wireless channels
  
  // Approximation of Q(sqrt(2 * Eb/N0))
  const arg = Math.sqrt(2 * ebN0);
  const ber = 0.5 * Math.exp(-arg * arg / 2) / (Math.sqrt(2 * Math.PI) * arg);
  return Math.min(Math.max(ber, 1e-8), 0.5);
}

/**
 * Calculates Packet Error Rate (PER) for a given packet length L in bits
 * PER = 1 - (1 - BER)^L
 */
export function calculatePER(
  ber: number,
  packetSizeBytes: number = 512
): number {
  const lengthBits = packetSizeBytes * 8;
  const per = 1 - Math.pow(1 - ber, lengthBits);
  return Math.min(Math.max(per, 0.0), 1.0);
}

/**
 * Evaluates entire link physical status given two node positions and environmental parameters
 */
export function evaluatePhysicalLink(
  pos1: { x: number; y: number; z?: number },
  pos2: { x: number; y: number; z?: number },
  txPowerDbm: number,
  frequencyGhz: number,
  config: SimulationConfig
): {
  distanceMeters: number;
  pathLossDb: number;
  rxPowerDbm: number;
  snrDb: number;
  ber: number;
  per: number;
  isViable: boolean;
} {
  const distanceMeters = calculateDistance(pos1, pos2);
  let pathLossDb: number;

  if (config.pathLossModel === 'Friis') {
    pathLossDb = calculateFriisLoss(distanceMeters, frequencyGhz);
  } else {
    pathLossDb = calculateLogDistanceLoss(
      distanceMeters,
      frequencyGhz,
      config.pathLossExponent,
      config.shadowingStdDevDb,
      config.referenceDistanceMeters
    );
  }

  const rxPowerDbm = calculateReceivedPower(txPowerDbm, pathLossDb);
  const snrDb = calculateSNR(rxPowerDbm, 20);
  const ber = calculateBER(snrDb);
  const per = calculatePER(ber, 512);

  // A link is considered viable if SNR is >= 8.0 dB and received power is above receiver sensitivity (-90 dBm)
  const isViable = snrDb >= 8.0 && rxPowerDbm >= -90;

  return {
    distanceMeters,
    pathLossDb,
    rxPowerDbm,
    snrDb,
    ber,
    per,
    isViable
  };
}

