import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistance,
  calculateFriisLoss,
  calculateLogDistanceLoss,
  calculateSNR,
  calculateBER,
  calculatePER,
  evaluatePhysicalLink,
  computeCoChannelInterferenceDbm,
  computeCsmaCollisionProbability,
} from '../src/core/math/rfPropagation';
import { SeededPRNG } from '../src/core/math/prng';
import {
  updateMobileNodesDetailed,
  updateDynamicMobilityLinks,
} from '../src/core/engine/mobility';
import { MeshNode, NetworkLink, SimulationConfig, SubMeshDomain } from '../src/types/simulator';

const BASE_CONFIG: SimulationConfig = {
  tickRateMs: 50,
  simSpeedMultiplier: 1.0,
  pathLossModel: 'LogDistance',
  pathLossExponent: 3.0,
  shadowingStdDevDb: 0,
  referenceDistanceMeters: 1.0,
  noiseFloorDbm: -95,
  carrierFreqGhz: 2.4,
  seed: 4242,
  fixedStepMs: 20,
  rxSensitivityDbm: -90,
  enableInterference: true,
  enableCollisions: true,
  defaultTtl: 16,
};

function makeNode(overrides: Partial<MeshNode> & { id: string; submeshId: string }): MeshNode {
  return {
    name: overrides.id,
    type: 'router',
    position: { x: 100, y: 100 },
    mobilityModel: 'static',
    txPowerDbm: 20,
    receiverSensitivityDbm: -90,
    queueCapacity: 32,
    currentQueue: [],
    isAlive: true,
    interfaces: [
      {
        id: `if_${overrides.id}`,
        type: 'wifi',
        mac: '00:1A:2B:00:00:01',
        channel: 6,
        frequencyBand: '2.4GHz',
        txPowerDbm: 20,
        bandwidthMbps: 54,
        submeshId: overrides.submeshId,
        isUp: true,
      },
    ],
    routingTable: {},
    ...overrides,
  };
}

describe('RF Propagation & Channel Physics', () => {
  it('computes Euclidean distance with 1m floor and safely guards NaN/invalid inputs', () => {
    assert.strictEqual(calculateDistance({ x: 0, y: 0 }, { x: 0, y: 0 }), 1.0);
    // 200px * 0.05 = 10m
    assert.strictEqual(calculateDistance({ x: 0, y: 0 }, { x: 200, y: 0 }), 10.0);
    assert.strictEqual(calculateDistance({ x: NaN, y: 0 }, { x: 100, y: 0 }), 5.0);

    const friisValid = calculateFriisLoss(10, 2.4);
    const friisBadFreq = calculateFriisLoss(10, -5);
    assert.ok(Number.isFinite(friisValid) && friisValid > 50);
    assert.strictEqual(friisBadFreq, friisValid); // falls back to 2.4GHz safely

    const snrZeroWidth = calculateSNR(-65, 0);
    assert.ok(Number.isFinite(snrZeroWidth));
  });

  it('produces reproducible seeded Gaussian shadow fading in Log-Distance path loss', () => {
    const rngA = new SeededPRNG(9876);
    const rngB = new SeededPRNG(9876);
    const rngC = new SeededPRNG(1111);

    const lossesA = Array.from({ length: 10 }, () =>
      calculateLogDistanceLoss(12, 5.2, 3.2, 3.5, 1.0, rngA)
    );
    const lossesB = Array.from({ length: 10 }, () =>
      calculateLogDistanceLoss(12, 5.2, 3.2, 3.5, 1.0, rngB)
    );
    const lossesC = Array.from({ length: 10 }, () =>
      calculateLogDistanceLoss(12, 5.2, 3.2, 3.5, 1.0, rngC)
    );

    assert.deepStrictEqual(lossesA, lossesB);
    assert.notDeepStrictEqual(lossesA, lossesC);
  });

  it('scales BER and PER monotonically with SNR and payload byte length', () => {
    assert.strictEqual(calculateBER(-5), 0.5);
    assert.strictEqual(calculateBER(30), 1e-8);
    assert.ok(calculateBER(6) > calculateBER(14));

    const ber = calculateBER(10);
    const perSmall = calculatePER(ber, 64);
    const perLarge = calculatePER(ber, 2048);
    assert.ok(perLarge > perSmall && perLarge <= 1 && perSmall >= 0);
  });

  it('marks long-range or jammed links non-viable with PER = 1.0 (no 0.95 cap)', () => {
    // 20,000 px = 1000 m -> well below -90 dBm sensitivity
    const farRes = evaluatePhysicalLink(
      { x: 0, y: 0 },
      { x: 20000, y: 0 },
      10,
      5.2,
      BASE_CONFIG
    );
    assert.strictEqual(farRes.isViable, false);
    assert.strictEqual(farRes.per, 1.0);
    assert.ok(farRes.rxPowerDbm < -90);

    const jammedRes = evaluatePhysicalLink(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      20,
      2.4,
      BASE_CONFIG,
      { isJammed: true }
    );
    assert.strictEqual(jammedRes.isViable, false);
    assert.strictEqual(jammedRes.per, 1.0);
  });

  it('computes co-channel interference and CSMA/CA collision probability on congested channels', () => {
    const sm: SubMeshDomain = {
      id: 'sm_24',
      name: '2.4GHz Mesh',
      protocol: 'AODV',
      frequencyBand: '2.4GHz',
      channelWidthMhz: 20,
      channelNumber: 6,
      color: '#EF4444',
      description: 'Shared channel',
    };
    const submeshes = new Map([[sm.id, sm]]);
    const n1 = makeNode({ id: 'n1', submeshId: sm.id, position: { x: 100, y: 100 } });
    const n2 = makeNode({ id: 'n2', submeshId: sm.id, position: { x: 200, y: 100 } });
    const n3 = makeNode({ id: 'n3', submeshId: sm.id, position: { x: 100, y: 200 } });
    const n4 = makeNode({ id: 'n4', submeshId: sm.id, position: { x: 200, y: 200 } });
    const nodes = new Map([
      [n1.id, n1],
      [n2.id, n2],
      [n3.id, n3],
      [n4.id, n4],
    ]);

    const link12: NetworkLink = {
      id: 'l12',
      source: 'n1',
      target: 'n2',
      bandwidthMbps: 12,
      lossRate: 0.01,
      distanceMeters: 5,
      snrDb: 28,
      per: 0.01,
      isSevered: false,
      isJammed: false,
      currentLoad: 1,
      traversalCount: 0,
      frequencyBand: '2.4GHz',
      channel: 6,
    };
    const link34: NetworkLink = {
      ...link12,
      id: 'l34',
      source: 'n3',
      target: 'n4',
      currentLoad: 2,
    };
    const links = [link12, link34];

    const interfDbm = computeCoChannelInterferenceDbm(link12, links, nodes, submeshes, BASE_CONFIG);
    assert.ok(Number.isFinite(interfDbm) && interfDbm > -95);

    const collProb = computeCsmaCollisionProbability(link12, links, nodes, submeshes, BASE_CONFIG);
    assert.ok(collProb > 0.1 && collProb <= 0.85);
  });
});

describe('Mobility Kinematics & Dynamic Neighbor Links', () => {
  it('moves linear mobile nodes deterministically and bounces off bounds', () => {
    const mobile = makeNode({
      id: 'mob_lin',
      submeshId: 'sm1',
      type: 'mobile',
      position: { x: 195, y: 150 },
      velocity: { vx: 20, vy: 0 },
      mobilityModel: 'linear',
      mobilityBounds: { minX: 100, maxX: 200, minY: 100, maxY: 200 },
    });
    const nodes = new Map([[mobile.id, mobile]]);

    // 1.0s at 20px/s from x=195 -> hits maxX=200 and bounces back to x=185 with vx=-20
    const res = updateMobileNodesDetailed(nodes, 1.0, new SeededPRNG(1));
    assert.strictEqual(res.anyMoved, true);
    assert.strictEqual(mobile.position.x, 185);
    assert.strictEqual(mobile.velocity?.vx, -20);
  });

  it('reproduces identical Random Waypoint trajectories with seeded PRNG and updates dynamic links', () => {
    const runRwp = (seed: number) => {
      const m = makeNode({
        id: 'mob_rwp',
        submeshId: 'sm1',
        type: 'mobile',
        position: { x: 150, y: 150 },
        mobilityModel: 'random_waypoint',
        mobilityBounds: { minX: 100, maxX: 400, minY: 100, maxY: 400 },
      });
      const map = new Map([[m.id, m]]);
      const rng = new SeededPRNG(seed);
      for (let i = 0; i < 40; i++) {
        updateMobileNodesDetailed(map, 0.05, rng);
      }
      return { x: m.position.x, y: m.position.y, wp: m.waypointTarget };
    };

    assert.deepStrictEqual(runRwp(555), runRwp(555));
    assert.notDeepStrictEqual(runRwp(555), runRwp(556));

    // Dynamic neighbor link creation and range-drop test
    const sm: SubMeshDomain = {
      id: 'sm1',
      name: 'WiFi',
      protocol: 'HWMP',
      frequencyBand: '5.2GHz',
      channelWidthMhz: 40,
      channelNumber: 36,
      color: '#2563EB',
      description: 'Test',
    };
    const rover = makeNode({
      id: 'rover',
      submeshId: 'sm1',
      type: 'mobile',
      position: { x: 120, y: 100 },
      mobilityModel: 'linear',
      interfaces: [
        {
          id: 'if_r',
          type: 'wifi',
          mac: '00:11:22:33:44:01',
          channel: 36,
          frequencyBand: '5.2GHz',
          txPowerDbm: 20,
          bandwidthMbps: 54,
          submeshId: 'sm1',
          isUp: true,
        },
      ],
    });
    const apNear = makeNode({
      id: 'ap_near',
      submeshId: 'sm1',
      position: { x: 180, y: 100 }, // 3m away -> viable
      interfaces: [
        {
          id: 'if_ap',
          type: 'wifi',
          mac: '00:11:22:33:44:02',
          channel: 36,
          frequencyBand: '5.2GHz',
          txPowerDbm: 20,
          bandwidthMbps: 54,
          submeshId: 'sm1',
          isUp: true,
        },
      ],
    });
    const nodes = new Map([
      [rover.id, rover],
      [apNear.id, apNear],
    ]);
    const submeshes = new Map([[sm.id, sm]]);
    const links: NetworkLink[] = [];

    const addSync = updateDynamicMobilityLinks(nodes, links, submeshes, BASE_CONFIG, {
      prng: new SeededPRNG(12),
    });
    assert.strictEqual(addSync.addedLinks.length, 1);
    assert.strictEqual(links.length, 1);

    // Move rover way out of range (4000px = 200m > 25m maxRangeMeters * 1.2)
    rover.position.x = 4200;
    const dropSync = updateDynamicMobilityLinks(nodes, links, submeshes, BASE_CONFIG, {
      prng: new SeededPRNG(12),
    });
    assert.strictEqual(dropSync.removedLinks.length, 1);
    assert.strictEqual(links.length, 0);
  });
});
