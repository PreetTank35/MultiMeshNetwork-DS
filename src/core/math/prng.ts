/**
 * Deterministic Seeded PRNG Subsystem
 * Implements Mulberry32 PRNG + Box-Muller Gaussian sampling
 * Zero Math.random() or wall-clock dependencies for full reproducibility
 */

export class SeededPRNG {
  private state: number;
  private initialSeed: number;

  constructor(seed: number = 12345) {
    this.initialSeed = SeededPRNG.normalizeSeed(seed);
    this.state = this.initialSeed;
  }

  public static normalizeSeed(seed: number): number {
    if (!Number.isFinite(seed)) return 12345;
    const normalized = Math.trunc(seed) >>> 0;
    return normalized === 0 ? 12345 : normalized;
  }

  public getSeed(): number {
    return this.initialSeed;
  }

  public setSeed(seed: number): void {
    this.initialSeed = SeededPRNG.normalizeSeed(seed);
    this.state = this.initialSeed;
  }

  public getState(): number {
    return this.state >>> 0;
  }

  public setState(state: number): void {
    if (!Number.isFinite(state)) return;
    this.state = Math.trunc(state) >>> 0;
  }

  /**
   * Returns deterministic uniform float in [0, 1) using Mulberry32
   */
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Deterministic integer in [minInclusive, maxExclusive)
   */
  public nextInt(minInclusive: number, maxExclusive: number): number {
    if (maxExclusive <= minInclusive) return minInclusive;
    return minInclusive + Math.floor(this.next() * (maxExclusive - minInclusive));
  }

  /**
   * Deterministic float in [min, max)
   */
  public nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Zero-mean (or shifted) Gaussian sample via Box-Muller transform
   */
  public nextGaussian(mean: number = 0, stdDev: number = 1): number {
    if (stdDev <= 0) return mean;
    const u1 = Math.max(this.next(), 1e-12);
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }
}

export function hashStringToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return SeededPRNG.normalizeSeed(hash >>> 0);
}

export function createPrng(seed?: number): SeededPRNG {
  return new SeededPRNG(seed);
}
