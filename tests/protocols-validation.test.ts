import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DiscreteEventEngine } from '../src/core/engine/discreteEventEngine';
import {
  resolveAodvRoute,
  resolveOlsrRoute,
  resolveHwmpRoute,
  resolveRplRoute,
  calculateMprSet,
  calculateAirtimeLinkMetric,
  calculateMultiMeshRoute,
} from '../src/core/protocols/routing';
import {
  isValidChannelForBand,
  validateTopology,
  validateLinkConnection,
} from '../src/core/validation/topologyValidation';
import { FrequencyBand, MeshNode, NetworkLink, ProtocolType, SubMeshDomain } from '../src/types/simulator';

function buildSubmesh(
  id: string,
  protocol: ProtocolType,
  band: FrequencyBand,
  channel: number
): SubMeshDomain {
  return {
    id,
    name: `Domain ${id}`,
    protocol,
    frequencyBand: band,
    channelWidthMhz: 20,
    channelNumber: channel,
    color: '#2563EB',
    description: `${protocol} domain`,
  };
}

function buildNode(
  id: string,
  submeshId: string,
  type: MeshNode['type'] = 'router',
  x: number = 100,
  y: number = 100,
  band: FrequencyBand = '2.4GHz',
  channel: number = 6
): MeshNode {
  return {
    id,
    name: `Node ${id}`,
    submeshId,
    type,
    position: { x, y },
    mobilityModel: 'static',
    txPowerDbm: 20,
    receiverSensitivityDbm: -90,
    queueCapacity: 32,
    currentQueue: [],
    isAlive: true,
    interfaces: [
      {
        id: `if_${id}`,
        type: type === 'sensor' || type === 'end_device' ? 'zigbee' : 'wifi',
        mac: `00:1A:2B:00:00:${id.slice(-2).padStart(2, '0')}`,
        channel,
        frequencyBand: band,
        txPowerDbm: 20,
        bandwidthMbps: type === 'sensor' ? 0.25 : 54,
        submeshId,
        isUp: true,
      },
    ],
    routingTable: {},
  };
}

function buildLink(
  id: string,
  source: string,
  target: string,
  bwMbps: number = 54,
  per: number = 0.01,
  snrDb: number = 28
): NetworkLink {
  return {
    id,
    source,
    target,
    bandwidthMbps: bwMbps,
    lossRate: per,
    per,
    distanceMeters: 10,
    snrDb,
    isViable: true,
    isSevered: false,
    isJammed: false,
    currentLoad: 0,
    traversalCount: 0,
  };
}

describe('Builder Creation & Validation Edge Cases', () => {
  it('supports validated creation of domains, routers, end_devices, gateways, and links', () => {
    const engine = new DiscreteEventEngine({ seed: 101 });
    const smWifi = buildSubmesh('sm_wifi', 'HWMP', '5.2GHz', 36);
    const smIot = buildSubmesh('sm_iot', 'RPL', '2.4GHz', 15);
    engine.addSubMesh(smWifi);
    engine.addSubMesh(smIot);

    const r1 = engine.addNodeValidated(buildNode('r1', 'sm_wifi', 'router', 100, 100, '5.2GHz', 36));
    const ed1 = engine.addNodeValidated(buildNode('ed1', 'sm_iot', 'end_device', 300, 100, '2.4GHz', 15));
    const gw = buildNode('gw1', 'sm_wifi', 'gateway', 200, 100, '5.2GHz', 36);
    gw.interfaces.push({
      id: 'if_gw1_iot',
      type: 'thread',
      mac: '00:1A:2B:GW:00:02',
      channel: 15,
      frequencyBand: '2.4GHz',
      txPowerDbm: 18,
      bandwidthMbps: 2.5,
      submeshId: 'sm_iot',
      isUp: true,
    });
    const gwRes = engine.addNodeValidated(gw);

    assert.strictEqual(r1.ok, true);
    assert.strictEqual(ed1.ok, true);
    assert.strictEqual(gwRes.ok, true);

    const l1 = engine.addLinkValidated('r1', 'gw1');
    const l2 = engine.addLinkValidated('gw1', 'ed1');
    assert.strictEqual(l1.ok, true);
    assert.strictEqual(l2.ok, true);

    const topoVal = engine.validateCurrentTopology();
    assert.strictEqual(topoVal.valid, true, topoVal.errors.join('; '));
  });

  it('rejects duplicate IDs/names, self-loops, duplicate links, non-gateway cross-domain links, single-domain gateways, and invalid channels/packet inputs', () => {
    const engine = new DiscreteEventEngine({ seed: 202 });
    const sm1 = buildSubmesh('sm1', 'AODV', '2.4GHz', 6);
    const sm2 = buildSubmesh('sm2', 'RPL', '5.2GHz', 36);
    engine.addSubMesh(sm1);
    engine.addSubMesh(sm2);

    const n1 = buildNode('n1', 'sm1', 'router', 100, 100, '2.4GHz', 6);
    const n2 = buildNode('n2', 'sm1', 'router', 180, 100, '2.4GHz', 6);
    const n3 = buildNode('n3', 'sm2', 'sensor', 260, 100, '5.2GHz', 36);
    const offline = buildNode('n4', 'sm1', 'router', 150, 200, '2.4GHz', 6);
    offline.isAlive = false;

    engine.addNode(n1);
    engine.addNode(n2);
    engine.addNode(n3);
    engine.addNode(offline);

    // Duplicate node ID and duplicate node name
    const dupId = engine.addNodeValidated({ ...n2, name: 'Unique Name' });
    assert.strictEqual(dupId.ok, false);
    const dupName = engine.addNodeValidated(buildNode('n99', 'sm1', 'router', 50, 50, '2.4GHz', 6));
    assert.strictEqual(dupName.ok, true);
    const renameDup = engine.renameNode('n99', 'Node n1');
    assert.strictEqual(renameDup.ok, false);

    // Self-loop and duplicate link
    const selfLoop = engine.addLinkValidated('n1', 'n1');
    assert.strictEqual(selfLoop.ok, false);
    assert.ok(engine.addLink('n1', 'n2') !== null);
    assert.strictEqual(engine.addLink('n1', 'n2'), null);
    assert.strictEqual(engine.addLink('n2', 'n1'), null);

    // Cross-domain link without gateway rejected
    const badCross = engine.addLinkValidated('n2', 'n3');
    assert.strictEqual(badCross.ok, false);
    assert.match(badCross.reason || '', /gateway/i);

    // Packet edge cases: payloadSizeBytes <= 0, NaN, self-packet, offline dst
    assert.strictEqual(engine.injectPacket('n1', 'n2', 'Zero', 0), null);
    assert.strictEqual(engine.injectPacket('n1', 'n2', 'Negative', -64), null);
    assert.strictEqual(engine.injectPacket('n1', 'n2', 'NaN', Number.NaN), null);
    assert.strictEqual(engine.injectPacket('n1', 'n1', 'Self', 512), null);
    assert.strictEqual(engine.injectPacket('n1', 'n4', 'OfflineDst', 512), null);

    // Invalid RF channel for band
    assert.strictEqual(isValidChannelForBand('2.4GHz', 149), false);
    assert.strictEqual(isValidChannelForBand('5.2GHz', 6), false);
    assert.strictEqual(isValidChannelForBand('5.8GHz', 149), true);

    // Single-domain gateway rejected by validateTopology
    const badGw = buildNode('gw_bad', 'sm1', 'gateway', 120, 120, '2.4GHz', 6);
    const valSingleGw = validateTopology(
      [sm1, sm2],
      [n1, n2, n3, badGw],
      [buildLink('l1', 'n1', 'n2')]
    );
    assert.strictEqual(valSingleGw.valid, false);
    assert.ok(valSingleGw.issues.some(i => i.code === 'INVALID_GATEWAY'));

    // validateLinkConnection detects invalid bandwidthMbps <= 0 via addLinkValidated
    const badBw = engine.addLinkValidated('n1', 'n99', 0);
    assert.strictEqual(badBw.ok, false);
    const connCheck = validateLinkConnection(n1, n3, [sm1, sm2], []);
    assert.strictEqual(connCheck.valid, false);
  });
});

describe('Genuine Routing Protocols (AODV, OLSR, HWMP, RPL)', () => {
  it('AODV discovers RREQ/RREP paths, hits cache, and safely handles broken downstream links without throwing', () => {
    const sm = buildSubmesh('sm_aodv', 'AODV', '2.4GHz', 6);
    const submeshes = new Map([[sm.id, sm]]);
    const a = buildNode('a', sm.id, 'router', 100, 100);
    const b = buildNode('b', sm.id, 'router', 150, 100);
    const c = buildNode('c', sm.id, 'router', 200, 100);
    const d = buildNode('d', sm.id, 'router', 250, 100);
    const e = buildNode('e', sm.id, 'router', 175, 160);
    const nodes = new Map([
      ['a', a],
      ['b', b],
      ['c', c],
      ['d', d],
      ['e', e],
    ]);
    const lAB = buildLink('l_ab', 'a', 'b');
    const lBC = buildLink('l_bc', 'b', 'c');
    const lCD = buildLink('l_cd', 'c', 'd');
    const lAE = buildLink('l_ae', 'a', 'e');
    const lED = buildLink('l_ed', 'e', 'd');
    const links = [lAB, lBC, lCD, lAE, lED];

    // Shortest hop path is a -> e -> d (2 hops)
    const r1 = resolveAodvRoute(a, d, nodes, links, { simTimeMs: 100, submeshes });
    assert.deepStrictEqual(r1.path, ['a', 'e', 'd']);
    assert.strictEqual(r1.cacheHit, false);
    assert.ok((r1.controlOverheadBytes || 0) > 0);

    // Second lookup hits AODV cache with 0 overhead
    const r2 = resolveAodvRoute(a, d, nodes, links, { simTimeMs: 200, submeshes });
    assert.strictEqual(r2.cacheHit, true);
    assert.strictEqual(r2.controlOverheadBytes, 0);

    // Sever downstream link e-d directly without pre-calling invalidateAodvRoutes:
    // AODV must detect the broken cached hop safely and fall back to a -> b -> c -> d without throwing!
    lED.isSevered = true;
    const r3 = resolveAodvRoute(a, d, nodes, links, { simTimeMs: 300, submeshes });
    assert.deepStrictEqual(r3.path, ['a', 'b', 'c', 'd']);
    assert.strictEqual(r3.rerrGenerated, true);
  });

  it('OLSR computes minimal MPR sets for 2-hop coverage and routes by ETX', () => {
    const sm = buildSubmesh('sm_olsr', 'OLSR', '2.4GHz', 11);
    const submeshes = new Map([[sm.id, sm]]);
    const s = buildNode('s', sm.id, 'router', 100, 100, '2.4GHz', 11);
    const m1 = buildNode('m1', sm.id, 'router', 160, 80, '2.4GHz', 11);
    const m2 = buildNode('m2', sm.id, 'router', 160, 140, '2.4GHz', 11);
    const leaf1 = buildNode('leaf1', sm.id, 'router', 220, 80, '2.4GHz', 11);
    const leaf2 = buildNode('leaf2', sm.id, 'router', 220, 140, '2.4GHz', 11);
    const nodes = new Map([
      ['s', s],
      ['m1', m1],
      ['m2', m2],
      ['leaf1', leaf1],
      ['leaf2', leaf2],
    ]);
    // m1 covers BOTH leaf1 and leaf2; m2 only covers leaf2 -> m1 is the sole cover for leaf1 and covers both
    const links = [
      buildLink('l_sm1', 's', 'm1', 54, 0.01),
      buildLink('l_sm2', 's', 'm2', 54, 0.01),
      buildLink('l_m1l1', 'm1', 'leaf1', 54, 0.01),
      buildLink('l_m1l2', 'm1', 'leaf2', 54, 0.01),
      buildLink('l_m2l2', 'm2', 'leaf2', 54, 0.4),
    ];

    const mprs = calculateMprSet(s, nodes, links, sm.id, submeshes);
    assert.deepStrictEqual(mprs, ['m1']);

    const res = resolveOlsrRoute(s, leaf2, nodes, links, { simTimeMs: 50, submeshes });
    assert.deepStrictEqual(res.path, ['s', 'm1', 'leaf2']);
    assert.strictEqual(res.protocolUsed, 'OLSR');
    assert.ok((s.olsrState?.tcTable.length || 0) > 0);
  });

  it('HWMP computes IEEE 802.11s Airtime Link Metric (ALM), root tree, and prefers higher-rate reliable path', () => {
    const sm = buildSubmesh('sm_hwmp', 'HWMP', '5.2GHz', 36);
    const submeshes = new Map([[sm.id, sm]]);
    const src = buildNode('src', sm.id, 'router', 100, 100, '5.2GHz', 36);
    const slow = buildNode('slow', sm.id, 'router', 150, 70, '5.2GHz', 36);
    const fast = buildNode('fast', sm.id, 'router', 150, 130, '5.2GHz', 36);
    const root = buildNode('root', sm.id, 'router', 200, 100, '5.2GHz', 36);
    root.queueCapacity = 128;
    const nodes = new Map([
      ['src', src],
      ['slow', slow],
      ['fast', fast],
      ['root', root],
    ]);

    const slowL1 = buildLink('l_s1', 'src', 'slow', 2, 0.25, 16);
    const slowL2 = buildLink('l_s2', 'slow', 'root', 2, 0.25, 16);
    const fastL1 = buildLink('l_f1', 'src', 'fast', 150, 0.005, 32);
    const fastL2 = buildLink('l_f2', 'fast', 'root', 150, 0.005, 32);
    assert.ok(calculateAirtimeLinkMetric(slowL1) > calculateAirtimeLinkMetric(fastL1) * 5);

    const hwmpRes = resolveHwmpRoute(src, root, nodes, [slowL1, slowL2, fastL1, fastL2], {
      simTimeMs: 10,
      submeshes,
    });
    assert.deepStrictEqual(hwmpRes.path, ['src', 'fast', 'root']);
    assert.strictEqual(src.hwmpState?.rootNodeId, 'root');
  });

  it('RPL constructs loop-free monotonic DODAG ranks and DAO downward routes', () => {
    const sm = buildSubmesh('sm_rpl', 'RPL', '2.4GHz', 15);
    const submeshes = new Map([[sm.id, sm]]);
    const gwRoot = buildNode('gw_root', sm.id, 'gateway', 100, 100, '2.4GHz', 15);
    gwRoot.interfaces.push({
      id: 'if_gw_other',
      type: 'wifi',
      mac: '00:1A:2B:99:00:01',
      channel: 36,
      frequencyBand: '5.2GHz',
      txPowerDbm: 20,
      bandwidthMbps: 100,
      isUp: true,
    });
    const relay = buildNode('relay', sm.id, 'router', 180, 100, '2.4GHz', 15);
    const leaf = buildNode('leaf', sm.id, 'sensor', 260, 100, '2.4GHz', 15);
    const nodes = new Map([
      ['gw_root', gwRoot],
      ['relay', relay],
      ['leaf', leaf],
    ]);
    const links = [
      buildLink('l_gr', 'gw_root', 'relay', 2.5, 0.01, 26),
      buildLink('l_rl', 'relay', 'leaf', 0.25, 0.02, 22),
    ];

    const upRes = resolveRplRoute(leaf, gwRoot, nodes, links, 'gw_root', { simTimeMs: 0, submeshes });
    assert.deepStrictEqual(upRes.path, ['leaf', 'relay', 'gw_root']);
    assert.ok((gwRoot.rplState?.rank ?? 99) < (relay.rplState?.rank ?? 99));
    assert.ok((relay.rplState?.rank ?? 99) < (leaf.rplState?.rank ?? 99));
    assert.strictEqual(gwRoot.rplState?.daoDownstream['leaf'], 'relay');

    const downRes = resolveRplRoute(gwRoot, leaf, nodes, links, 'gw_root', { simTimeMs: 5, submeshes });
    assert.deepStrictEqual(downRes.path, ['gw_root', 'relay', 'leaf']);
  });

  it('calculateMultiMeshRoute blocks direct cross-domain paths without active gateway interfaces', () => {
    const sm1 = buildSubmesh('sm1', 'HWMP', '5.2GHz', 36);
    const sm2 = buildSubmesh('sm2', 'RPL', '2.4GHz', 15);
    const n1 = buildNode('n1', 'sm1', 'router', 100, 100, '5.2GHz', 36);
    const n2 = buildNode('n2', 'sm2', 'sensor', 200, 100, '2.4GHz', 15);
    // Illegally wired cross-domain link between two non-gateways
    const illegalLink = buildLink('l_bad', 'n1', 'n2', 54, 0.01, 30);

    const res = calculateMultiMeshRoute('n1', 'n2', [n1, n2], [illegalLink], [sm1, sm2]);
    assert.strictEqual(res.found, false);
    assert.match(res.error || '', /Destination Unreachable/i);
  });
});
