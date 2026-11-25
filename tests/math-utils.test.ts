import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SeededPRNG, hashStringToSeed, createPrng } from '../src/core/math/prng';
import { MinHeap } from '../src/core/math/minHeap';

describe('hashStringToSeed', () => {
  it('produces deterministic normalized unsigned 32-bit integers for strings', () => {
    const h1 = hashStringToSeed('smart-campus-seed');
    const h2 = hashStringToSeed('smart-campus-seed');
    assert.strictEqual(h1, h2);
    assert.ok(Number.isInteger(h1) && h1 > 0 && h1 <= 0xffffffff);

    assert.notStrictEqual(hashStringToSeed('smart-campus'), hashStringToSeed('smart-logistics'));
    assert.notStrictEqual(hashStringToSeed('42'), hashStringToSeed('43'));
  });
});

describe('SeededPRNG', () => {
  it('reproduces identical sequences for identical seeds and diverges for different seeds', () => {
    const rngA = new SeededPRNG(20261125);
    const rngB = createPrng(20261125);
    const rngC = new SeededPRNG(20261126);

    const seqA = Array.from({ length: 50 }, () => rngA.next());
    const seqB = Array.from({ length: 50 }, () => rngB.next());
    const seqC = Array.from({ length: 50 }, () => rngC.next());

    assert.deepStrictEqual(seqA, seqB);
    assert.notDeepStrictEqual(seqA, seqC);

    const strSeed = hashStringToSeed('mit-aoe-campus');
    const strA = new SeededPRNG(strSeed);
    const strB = new SeededPRNG(strSeed);
    assert.deepStrictEqual(
      Array.from({ length: 20 }, () => strA.next()),
      Array.from({ length: 20 }, () => strB.next())
    );
  });

  it('keeps next(), nextRange(), and nextInt() strictly within bounds and normalizes seed 0', () => {
    const rng = new SeededPRNG(0);
    assert.strictEqual(rng.getSeed(), 12345);

    for (let i = 0; i < 5000; i++) {
      const v = rng.next();
      assert.ok(v >= 0 && v < 1, `next() out of bounds: ${v}`);
    }

    for (let i = 0; i < 1000; i++) {
      const r = rng.nextRange(-10, 25);
      assert.ok(r >= -10 && r < 25, `nextRange() out of bounds: ${r}`);
    }
    assert.strictEqual(rng.nextRange(7, 7), 7);

    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const k = rng.nextInt(1, 7);
      assert.ok(Number.isInteger(k) && k >= 1 && k <= 6);
      seen.add(k);
    }
    assert.strictEqual(seen.size, 6);
    assert.strictEqual(rng.nextInt(4, 4), 4);
  });

  it('produces finite Gaussian samples and supports deterministic state save/restore', () => {
    const rng = new SeededPRNG(999);
    assert.strictEqual(rng.nextGaussian(12, 0), 12);
    assert.strictEqual(rng.nextGaussian(12, -3), 12);

    let sum = 0;
    const count = 4000;
    for (let i = 0; i < count; i++) {
      const g = rng.nextGaussian(5, 3.5);
      assert.ok(Number.isFinite(g), `nextGaussian() produced non-finite value: ${g}`);
      sum += g;
    }
    const empiricalMean = sum / count;
    assert.ok(Math.abs(empiricalMean - 5) < 0.3, `empirical mean ${empiricalMean} drifted from 5`);

    const savedState = rng.getState();
    const seq1 = Array.from({ length: 15 }, () => rng.next());
    rng.setState(savedState);
    const seq2 = Array.from({ length: 15 }, () => rng.next());
    assert.deepStrictEqual(seq1, seq2);

    rng.setSeed(777);
    assert.strictEqual(rng.getSeed(), 777);
  });
});

describe('MinHeap', () => {
  it('handles empty state, peek, clear, and toArray safely', () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    assert.strictEqual(heap.size, 0);
    assert.strictEqual(heap.isEmpty(), true);
    assert.strictEqual(heap.peek(), undefined);
    assert.strictEqual(heap.pop(), undefined);

    heap.push(10);
    heap.push(3);
    heap.push(7);
    assert.strictEqual(heap.size, 3);
    assert.strictEqual(heap.isEmpty(), false);
    assert.strictEqual(heap.peek(), 3);

    const snapshot = heap.toArray();
    snapshot.push(999);
    assert.strictEqual(heap.size, 3);

    heap.clear();
    assert.strictEqual(heap.size, 0);
    assert.strictEqual(heap.peek(), undefined);
    assert.strictEqual(heap.pop(), undefined);
  });

  it('pops arbitrary seeded sequences with duplicates in strict ascending order', () => {
    const rng = new SeededPRNG(hashStringToSeed('heap-order-check'));
    const heap = new MinHeap<number>((a, b) => a - b);
    const values: number[] = [];

    for (let i = 0; i < 500; i++) {
      const val = rng.nextInt(-50, 51);
      values.push(val);
      heap.push(val);
    }

    const popped: number[] = [];
    while (heap.size > 0) {
      popped.push(heap.pop()!);
    }

    const expected = [...values].sort((a, b) => a - b);
    assert.deepStrictEqual(popped, expected);
  });

  it('supports deterministic tie-breaking with custom object comparators', () => {
    interface EventItem {
      timestamp: number;
      seq: number;
      label: string;
    }

    const heap = new MinHeap<EventItem>((a, b) =>
      a.timestamp !== b.timestamp ? a.timestamp - b.timestamp : a.seq - b.seq
    );

    heap.push({ timestamp: 50, seq: 3, label: 'late-seq3' });
    heap.push({ timestamp: 20, seq: 2, label: 'early-seq2' });
    heap.push({ timestamp: 20, seq: 1, label: 'early-seq1' });
    heap.push({ timestamp: 50, seq: 1, label: 'late-seq1' });
    heap.push({ timestamp: 10, seq: 9, label: 'first' });

    const labels: string[] = [];
    while (!heap.isEmpty()) {
      labels.push(heap.pop()!.label);
    }

    assert.deepStrictEqual(labels, ['first', 'early-seq1', 'early-seq2', 'late-seq1', 'late-seq3']);
  });
});
