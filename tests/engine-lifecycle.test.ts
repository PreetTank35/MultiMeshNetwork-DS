import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DiscreteEventEngine } from '../src/core/engine/discreteEventEngine';
import { FrequencyBand, MeshNode, NetworkLink, ProtocolType, SubMeshDomain } from '../src/types/simulator';

function makeSm(
  id: string,
  protocol: ProtocolType,
  band: FrequencyBand,
  channel: number,
  bwMbps: number = 54
): SubMeshDomain {
  return {
    id,
    name: `SM-${id}`,
    protocol,
    frequencyBand: band,
    channelWidthMhz: 20,
    channelNumber: channel,
    color: '#2563EB',
    description: id,
    defaultBandwidthMbps: bwMbps,
  };
}

function makeNode(
  id: string,
  submeshId: string,
  type: MeshNode['type'],
  x: number,
  y: number,
  band: FrequencyBand,
  channel: number,
  extra?: Partial<MeshNode>
): MeshNode {
  return {
    id,
    name: id,
    submeshId,
    type,
    position: { x, y },
    mobilityModel: 'static',
    txPowerDbm: 22,
    receiverSensitivityDbm: -90,
    queueCapacity: 32,
    currentQueue: [],
    isAlive: true,
    interfaces: [
      {
        id: `if_${id}_0`,
        type: type === 'sensor' ? 'zigbee' : 'wifi',
        mac: `00:1A:2B:10:00:${id.slice(-2).padStart(2, '0')}`,
        channel,
        frequencyBand: band,
        txPowerDbm: 22,
        bandwidthMbps: type === 'sensor' ? 2.5 : 54,
        submeshId,
        isUp: true,
      },
    ],
    routingTable: {},
    ...extra,
  };
}

function makeLink(
  id: string,
  source: string,
  target: string,
  bwMbps: number = 54,
  band: FrequencyBand = '5.2GHz',
  channel: number = 36
): NetworkLink {
  return {
    id,
    source,
    target,
    bandwidthMbps: bwMbps,
    lossRate: 0.005,
    per: 0.005,
    distanceMeters: 5,
    snrDb: 30,
    isViable: true,
    isSevered: false,
    isJammed: false,
    currentLoad: 0,
    traversalCount: 0,
    frequencyBand: band,
    channel,
  };
}

function buildLinearMultiDomainFixture() {
  const smWifi = makeSm('sm_wifi', 'HWMP', '5.2GHz', 36, 100);
  const smIot = makeSm('sm_iot', 'RPL', '2.4GHz', 15, 2.5);

  const src = makeNode('n_src', 'sm_wifi', 'router', 100, 100, '5.2GHz', 36);
  const mid = makeNode('n_mid', 'sm_wifi', 'router', 200, 100, '5.2GHz', 36);

  const gw1 = makeNode('gw_1', 'sm_wifi', 'gateway', 300, 80, '5.2GHz', 36, {
    rplRank: 1,
    interfaces: [
      {
        id: 'if_gw1_w',
        type: 'wifi',
        mac: '00:1A:2B:GW:01:01',
        channel: 36,
        frequencyBand: '5.2GHz',
        txPowerDbm: 24,
        bandwidthMbps: 100,
        submeshId: 'sm_wifi',
        isUp: true,
      },
      {
        id: 'if_gw1_i',
        type: 'thread',
        mac: '00:1A:2B:GW:01:02',
        channel: 15,
        frequencyBand: '2.4GHz',
        txPowerDbm: 20,
        bandwidthMbps: 2.5,
        submeshId: 'sm_iot',
        isUp: true,
      },
    ],
  });

  const gw2 = makeNode('gw_2', 'sm_wifi', 'gateway', 300, 160, '5.2GHz', 36, {
    rplRank: 2,
    interfaces: [
      {
        id: 'if_gw2_w',
        type: 'wifi',
        mac: '00:1A:2B:GW:02:01',
        channel: 36,
        frequencyBand: '5.2GHz',
        txPowerDbm: 24,
        bandwidthMbps: 100,
        submeshId: 'sm_wifi',
        isUp: true,
      },
      {
        id: 'if_gw2_i',
        type: 'thread',
        mac: '00:1A:2B:GW:02:02',
        channel: 15,
        frequencyBand: '2.4GHz',
        txPowerDbm: 20,
        bandwidthMbps: 2.5,
        submeshId: 'sm_iot',
        isUp: true,
      },
    ],
  });

  const iotRelay = makeNode('n_iot_relay', 'sm_iot', 'router', 400, 100, '2.4GHz', 15);
  const dst = makeNode('n_dst', 'sm_iot', 'sensor', 500, 100, '2.4GHz', 15);

  const links = [
    makeLink('l_sm', 'n_src', 'n_mid', 100, '5.2GHz', 36),
    makeLink('l_mg1', 'n_mid', 'gw_1', 100, '5.2GHz', 36),
    makeLink('l_mg2', 'n_mid', 'gw_2', 100, '5.2GHz', 36),
    makeLink('l_g1r', 'gw_1', 'n_iot_relay', 2.5, '2.4GHz', 15),
    makeLink('l_g2r', 'gw_2', 'n_iot_relay', 2.5, '2.4GHz', 15),
    makeLink('l_rd', 'n_iot_relay', 'n_dst', 2.5, '2.4GHz', 15),
  ];

  return { submeshes: [smWifi, smIot], nodes: [src, mid, gw1, gw2, iotRelay, dst], links };
}

describe('DiscreteEventEngine Packet Lifecycle, Forwarding & Gateway', () => {
  it('progresses packet through full created->queued->transmitting->received->forwarded->delivered lifecycle and computes real telemetry', () => {
    const engine = new DiscreteEventEngine({
      seed: 1001,
      packetErrorRateOverride: 0,
      enableCollisions: false,
      enableInterference: false,
    });
    const topo = buildLinearMultiDomainFixture();
    engine.loadTopology(topo.submeshes, topo.nodes, topo.links);

    const pkt1 = engine.injectPacket('n_src', 'n_dst', 'Telemetry-1', 512);
    assert.ok(pkt1 !== null);
    assert.strictEqual(pkt1.state, 'created');
    assert.strictEqual(engine.metrics.inFlightPackets, 1);

    engine.step(200);

    const pkt2 = engine.injectPacket('n_src', 'n_dst', 'Telemetry-2', 1024);
    assert.ok(pkt2 !== null);
    engine.step(200);

    assert.strictEqual(engine.metrics.totalPacketsInjected, 2);
    assert.strictEqual(engine.metrics.totalPacketsDelivered, 2);
    assert.strictEqual(engine.metrics.totalPacketsDropped, 0);
    assert.strictEqual(engine.metrics.pdr, 100);
    assert.strictEqual(engine.metrics.completedPdr, 100);
    assert.strictEqual(engine.metrics.inFlightPackets, 0);
    assert.ok(engine.metrics.averageLatencyMs > 0);
    assert.ok((engine.metrics.jitterMs ?? 0) > 0); // 512B vs 1024B yields different latencies
    assert.ok((engine.metrics.averageTxDelayMs ?? 0) > 0);
    assert.ok((engine.metrics.averageQueueDelayMs ?? 0) > 0);
    assert.ok((engine.metrics.averageGatewayDelayMs ?? 0) > 0);
    assert.ok(engine.metrics.throughputKbps > 0);
    assert.strictEqual(engine.metrics.hopCountHistogram[4], 2);

    // Every link currentLoad returns cleanly to 0 after completion
    assert.ok(engine.links.every(l => l.currentLoad === 0));
    assert.ok((engine.metrics.gatewayLoadMap['gw_1'] ?? 0) > 0);
    assert.ok((engine.metrics.linkUtilizationMap?.['l_sm'] ?? 0) > 0);
    assert.ok((engine.metrics.channelUtilizationMap?.['5.2GHz:36'] ?? 0) > 0);
    assert.ok((engine.metrics.perDomainStats?.['sm_wifi']?.packetsOriginated ?? 0) === 2);
    assert.ok((engine.metrics.perNodeStats?.['n_mid']?.packetsForwarded ?? 0) === 2);

    // Verify full lifecycle stages on delivered packet timeline
    const histPkt = engine.packetHistory.find(p => p.id === pkt1.id)!;
    assert.strictEqual(histPkt.state, 'delivered');
    const stages = new Set((histPkt.timeline || []).map(t => t.stage));
    for (const reqStage of [
      'created',
      'queued',
      'transmitting',
      'received',
      'forwarded',
      'gateway_translated',
      'delivered',
    ] as const) {
      assert.ok(stages.has(reqStage), `Missing timeline stage ${reqStage}`);
    }
    assert.deepStrictEqual(histPkt.protocolTrace, ['HWMP', 'RPL']);
    assert.strictEqual(engine.translationTraces.length, 2);
  });

  it('drops packets for RF noise, TTL exhaustion, queue overflow, and destination unreachable', () => {
    // 1. RF Noise drop (PER override = 1.0)
    {
      const engine = new DiscreteEventEngine({ seed: 11, packetErrorRateOverride: 1.0 });
      const topo = buildLinearMultiDomainFixture();
      engine.loadTopology(topo.submeshes, topo.nodes, topo.links);
      engine.injectPacket('n_src', 'n_dst', 'NoiseTest', 256);
      engine.step(200);
      assert.strictEqual(engine.metrics.totalPacketsDropped, 1);
      assert.match(engine.packetHistory[0].dropReason || '', /RF noise|drop/i);
    }

    // 2. TTL exhaustion (defaultTtl = 2 on a 4-hop route)
    {
      const engine = new DiscreteEventEngine({
        seed: 12,
        defaultTtl: 2,
        packetErrorRateOverride: 0,
      });
      const topo = buildLinearMultiDomainFixture();
      engine.loadTopology(topo.submeshes, topo.nodes, topo.links);
      engine.injectPacket('n_src', 'n_dst', 'TtlTest', 256);
      engine.step(200);
      assert.strictEqual(engine.metrics.totalPacketsDropped, 1);
      assert.match(engine.packetHistory[0].dropReason || '', /TTL expired/i);
      assert.strictEqual(engine.metrics.dropReasonCounts?.['TTL Expired'], 1);
    }

    // 3. Queue overflow + GatewayOverloaded event
    {
      const engine = new DiscreteEventEngine({
        seed: 13,
        packetErrorRateOverride: 0,
        enableCollisions: false,
      });
      const topo = buildLinearMultiDomainFixture();
      const gw1 = topo.nodes.find(n => n.id === 'gw_1')!;
      gw1.queueCapacity = 1; // capacity 1 at gateway
      // Force all traffic through gw_1
      topo.nodes.find(n => n.id === 'gw_2')!.isAlive = false;
      engine.loadTopology(topo.submeshes, topo.nodes, topo.links);

      // Inject 3 back-to-back packets so 2nd/3rd arrive at gw_1 while gw_1 is queued/translating
      engine.injectPacket('n_src', 'n_dst', 'Burst-1', 512);
      engine.injectPacket('n_src', 'n_dst', 'Burst-2', 512);
      engine.injectPacket('n_src', 'n_dst', 'Burst-3', 512);
      engine.step(500);

      assert.ok(engine.metrics.totalPacketsDropped >= 1);
      assert.ok(
        engine.packetHistory.some(p => /Queue overflow/i.test(p.dropReason || '')),
        'Expected at least one Queue overflow drop'
      );
      assert.ok(
        engine.eventLog.some(e => e.type === 'GatewayOverloaded'),
        'Expected GatewayOverloaded event'
      );
    }

    // 4. Destination unreachable when all paths are severed
    {
      const engine = new DiscreteEventEngine({ seed: 14 });
      const topo = buildLinearMultiDomainFixture();
      engine.loadTopology(topo.submeshes, topo.nodes, topo.links);
      engine.toggleSeverLink('l_rd');
      engine.injectPacket('n_src', 'n_dst', 'Unreachable', 256);
      engine.step(100);
      assert.strictEqual(engine.metrics.totalPacketsDropped, 1);
      assert.match(engine.packetHistory[0].dropReason || '', /Destination Unreachable/i);
      assert.strictEqual(engine.metrics.dropReasonCounts?.['Destination Unreachable'], 1);
    }
  });
});

describe('Fault Studio Actions, Mid-Flight Rerouting, Serialization & Determinism', () => {
  it('handles node failure, link failure mid-TX, gateway interface failure, channel jamming, and restoreAllFaults', () => {
    const engine = new DiscreteEventEngine({ seed: 303, packetErrorRateOverride: 0 });
    const topo = buildLinearMultiDomainFixture();
    engine.loadTopology(topo.submeshes, topo.nodes, topo.links);

    // 1. Mid-transmission link sever triggers rerouting, then drops if no alternate path exists
    const midTxPkt = engine.injectPacket('n_src', 'n_mid', 'MidTxSever', 4096)!;
    // Step event-by-event until TransmissionStarted fires so packet is in 'transmitting' state
    for (let i = 0; i < 10 && midTxPkt.state !== 'transmitting'; i++) {
      engine.stepNextEvent();
    }
    assert.strictEqual(midTxPkt.state, 'transmitting');
    engine.toggleSeverLink('l_sm');
    engine.step(50);
    assert.strictEqual(engine.metrics.totalPacketsDropped, 1);
    assert.match(engine.packetHistory[0].dropReason || '', /Destination Unreachable/i);

    engine.toggleSeverLink('l_sm'); // restore

    // 2. Gateway interface failure fails over from gw_1 to gw_2
    assert.strictEqual(engine.failGateway('gw_1', 'if_gw1_i'), true);
    const pktAlt = engine.injectPacket('n_src', 'n_dst', 'GwFailover', 512)!;
    engine.step(200);
    const histAlt = engine.packetHistory.find(p => p.id === pktAlt.id)!;
    assert.strictEqual(histAlt.state, 'delivered');
    assert.ok(histAlt.pathTraversed.includes('gw_2'));
    assert.ok(!histAlt.pathTraversed.includes('gw_1'));

    // 3. Jamming 2.4GHz channel drops packet
    engine.toggleJamChannel('2.4GHz', 15);
    engine.injectPacket('n_src', 'n_dst', 'Jammed', 512);
    engine.step(100);
    assert.strictEqual(engine.packetHistory[0].state, 'dropped');

    // 4. Kill node & restoreAllFaults
    engine.toggleKillNode('n_mid');
    assert.strictEqual(engine.nodes.get('n_mid')?.isAlive, false);

    engine.restoreAllFaults();
    assert.strictEqual(engine.nodes.get('n_mid')?.isAlive, true);
    assert.strictEqual(engine.links.every(l => !l.isSevered && !l.isJammed), true);
    assert.strictEqual(engine.restoreGateway('gw_1'), true);
    assert.strictEqual(
      engine.nodes.get('gw_1')?.interfaces.every(i => i.isUp !== false),
      true
    );

    const pktRecovered = engine.injectPacket('n_src', 'n_dst', 'Recovered', 512)!;
    engine.step(200);
    assert.strictEqual(engine.packetHistory.find(p => p.id === pktRecovered.id)?.state, 'delivered');
  });

  it('dynamically reroutes queued packets mid-flight when pre-TX link fails', () => {
    const engine = new DiscreteEventEngine({ seed: 404, packetErrorRateOverride: 0 });
    const topo = buildLinearMultiDomainFixture();
    engine.loadTopology(topo.submeshes, topo.nodes, topo.links);

    const pkt = engine.injectPacket('n_src', 'n_dst', 'RerouteMidFlight', 512)!;
    // Step until packet arrives and queues at n_mid (planned via gw_1)
    let safety = 0;
    while (safety++ < 20) {
      const ev = engine.stepNextEvent();
      if (!ev) break;
      if (pkt.currentHop === 'n_mid' && pkt.state === 'queued') {
        break;
      }
    }
    assert.strictEqual(pkt.currentHop, 'n_mid');
    assert.strictEqual(pkt.nextHop, 'gw_1');

    // Sever link n_mid <-> gw_1 BEFORE TransmissionStarted fires at n_mid
    engine.toggleSeverLink('l_mg1');
    engine.step(200);

    const delivered = engine.packetHistory.find(p => p.id === pkt.id)!;
    assert.strictEqual(delivered.state, 'delivered');
    assert.ok(delivered.pathTraversed.includes('gw_2'));
    assert.ok((delivered.routeChangesCount ?? 0) >= 1);
    assert.ok(engine.eventLog.some(e => e.type === 'RouteChanged'));
  });

  it('exports/imports losslessly (with severed link & runtime state) and rejects malformed JSON atomically without wiping existing topology', () => {
    const engineA = new DiscreteEventEngine({ seed: 777, packetErrorRateOverride: 0 });
    const topo = buildLinearMultiDomainFixture();
    engineA.loadTopology(topo.submeshes, topo.nodes, topo.links);
    engineA.toggleSeverLink('l_mg2');
    engineA.injectPacket('n_src', 'n_dst', 'ExportFlow', 512);
    engineA.step(120);

    const exported = engineA.exportTopologyJSON('Roundtrip Scenario');
    const jsonStr = JSON.stringify(exported);

    // Import into fresh engineB
    const engineB = new DiscreteEventEngine();
    const okRes = engineB.importTopologyJSONValidated(jsonStr);
    assert.strictEqual(okRes.ok, true, okRes.errors.join('; '));
    assert.strictEqual(engineB.nodes.size, engineA.nodes.size);
    assert.strictEqual(engineB.links.length, engineA.links.length);
    assert.strictEqual(engineB.links.find(l => l.id === 'l_mg2')?.isSevered, true);
    assert.strictEqual(engineB.simTimeMs, engineA.simTimeMs);
    assert.strictEqual(engineB.getSeed(), 777);

    // Malformed / dangling import must fail atomically and preserve engineB's topology & state!
    const badJsonRes = engineB.importTopologyJSONValidated('{not-valid-json');
    assert.strictEqual(badJsonRes.ok, false);
    assert.strictEqual(engineB.nodes.size, topo.nodes.length);
    assert.strictEqual(engineB.links.find(l => l.id === 'l_mg2')?.isSevered, true);

    const danglingJson = JSON.stringify({
      submeshes: [makeSm('s1', 'AODV', '2.4GHz', 6)],
      nodes: [makeNode('x1', 'missing_sm', 'router', 10, 10, '2.4GHz', 6)],
      links: [],
    });
    const danglingRes = engineB.importTopologyJSONValidated(danglingJson);
    assert.strictEqual(danglingRes.ok, false);
    assert.strictEqual(engineB.nodes.size, topo.nodes.length);
    assert.ok(engineB.nodes.has('n_src'));
  });

  it('preserves killed gateway faults across export/import round-trip', () => {
    const engineA = new DiscreteEventEngine({ seed: 778, packetErrorRateOverride: 0 });
    const topo = buildLinearMultiDomainFixture();
    engineA.loadTopology(topo.submeshes, topo.nodes, topo.links);
    engineA.toggleKillNode('gw_2');

    const jsonStr = JSON.stringify(engineA.exportTopologyJSON('Killed Gateway Export'));
    const engineB = new DiscreteEventEngine();
    const res = engineB.importTopologyJSONValidated(jsonStr);
    assert.strictEqual(res.ok, true, res.errors.join('; '));
    assert.strictEqual(engineB.nodes.get('gw_2')?.isAlive, false);
  });

  it('guarantees deterministic seeded replay across independent engines and step granularities', () => {
    const runWithStep = (seed: number, stepChunkMs: number) => {
      const engine = new DiscreteEventEngine({ seed, fixedStepMs: 20 });
      const topo = buildLinearMultiDomainFixture();
      // Enable stochastic RF shadowing & moderate PER
      topo.links.forEach(l => {
        l.per = 0.08;
        l.lossRate = 0.08;
      });
      engine.loadTopology(topo.submeshes, topo.nodes, topo.links);
      engine.config.shadowingStdDevDb = 2.5;
      engine.refreshLinkProperties();

      for (let i = 0; i < 6; i++) {
        engine.injectPacket('n_src', 'n_dst', `Flow-${i}`, 512);
        for (let t = 0; t < 100; t += stepChunkMs) {
          engine.step(stepChunkMs);
        }
      }
      return {
        metrics: engine.metrics,
        history: engine.packetHistory.map(p => ({
          id: p.id,
          state: p.state,
          hops: p.hops,
          deliveredAt: p.deliveredAtSimTime,
          droppedAt: p.droppedAtSimTime,
          path: p.pathTraversed,
        })),
      };
    };

    const runA = runWithStep(9001, 5);
    const runB = runWithStep(9001, 25);
    const runC = runWithStep(9002, 5);

    assert.deepStrictEqual(runA.history, runB.history);
    assert.strictEqual(runA.metrics.pdr, runB.metrics.pdr);
    assert.strictEqual(runA.metrics.averageLatencyMs, runB.metrics.averageLatencyMs);

    // replayLastRun() reproduces recorded workload deterministically
    const engineReplay = new DiscreteEventEngine({ seed: 5555 });
    const topo = buildLinearMultiDomainFixture();
    engineReplay.loadTopology(topo.submeshes, topo.nodes, topo.links);
    engineReplay.injectPacket('n_src', 'n_dst', 'P1', 512);
    engineReplay.step(60);
    engineReplay.injectPacket('n_src', 'n_dst', 'P2', 768);
    engineReplay.step(200);
    const origDelivered = engineReplay.metrics.totalPacketsDelivered;
    const origAvgLat = engineReplay.metrics.averageLatencyMs;

    assert.strictEqual(engineReplay.replayLastRun(), true);
    engineReplay.step(300);
    assert.strictEqual(engineReplay.metrics.totalPacketsDelivered, origDelivered);
    assert.strictEqual(engineReplay.metrics.averageLatencyMs, origAvgLat);
    assert.ok(runC.metrics.totalPacketsInjected === 6);
  });
});
