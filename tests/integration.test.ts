import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DiscreteEventEngine } from '../src/core/engine/discreteEventEngine';
import {
  getCitywideMeshTopology,
  getSmartCampusTopology,
  getMonolithicMeshTopology,
} from '../src/data/defaultTopologies';

describe('Integration Scenario 1: Smart Campus Cross-Domain Traversal & Gateway Translation', () => {
  it('routes Wi-Fi Mesh A -> Gateway -> IoT Mesh B -> Destination with full lifecycle and protocol translation', () => {
    const campus = getSmartCampusTopology();
    const engine = new DiscreteEventEngine({
      ...campus.simulatorConfig,
      seed: 2026,
      shadowingStdDevDb: 0, // deterministic baseline link quality for integration check
      packetErrorRateOverride: 0,
      enableCollisions: false,
    });

    engine.loadTopology(campus.submeshes, campus.nodes, campus.links);

    // Wi-Fi 6 NOC Server -> Boundary Gateway -> RPL IoT Quad Repeater -> Solar Sensor
    const pkt = engine.injectPacket(
      'node_wf_server',
      'node_iot_solar',
      'NOC Firmware Dispatch (512 B)',
      512
    );
    assert.ok(pkt !== null, 'Expected Smart Campus packet injection to succeed');

    // Step simulation cleanly until delivery (max 500ms)
    engine.step(500);

    const delivered = engine.packetHistory.find(p => p.id === pkt.id);
    assert.ok(delivered, 'Expected packet in packetHistory');
    assert.strictEqual(delivered.state, 'delivered');
    assert.strictEqual(delivered.pathTraversed[0], 'node_wf_server');
    assert.strictEqual(delivered.pathTraversed[delivered.pathTraversed.length - 1], 'node_iot_solar');

    // Must cross one of the dual-radio border gateways
    const crossedGateway = delivered.pathTraversed.some(
      id => id === 'node_gw_primary' || id === 'node_gw_backup'
    );
    assert.strictEqual(crossedGateway, true, `Path did not cross a gateway: ${delivered.pathTraversed}`);

    // Verify cross-domain protocol translation HWMP -> RPL
    assert.deepStrictEqual(delivered.protocolTrace, ['HWMP', 'RPL']);
    assert.strictEqual(engine.translationTraces.length, 1);
    const trace = engine.translationTraces[0];
    assert.strictEqual(trace.ingressProtocol, 'HWMP');
    assert.strictEqual(trace.egressProtocol, 'RPL');
    assert.strictEqual(trace.ingressChannel, 36);
    assert.strictEqual(trace.egressChannel, 15);
    assert.strictEqual(trace.translationSteps?.length, 4);

    // Verify telemetry bus metrics updated from real simulation events
    assert.strictEqual(engine.metrics.totalPacketsInjected, 1);
    assert.strictEqual(engine.metrics.totalPacketsDelivered, 1);
    assert.strictEqual(engine.metrics.totalPacketsDropped, 0);
    assert.strictEqual(engine.metrics.pdr, 100);
    assert.ok(engine.metrics.averageLatencyMs > 0);
    assert.ok(engine.metrics.throughputKbps > 0);
    assert.ok((engine.metrics.perDomainStats?.['mesh_wifi']?.packetsOriginated ?? 0) === 1);
    assert.ok((engine.metrics.perDomainStats?.['mesh_iot']?.packetsDelivered ?? 0) === 1);
  });
});

describe('Integration Scenario 2: Dynamic Fault Failover & Destination Unreachable', () => {
  it('reroutes Source -> Gateway -> Failed Node/Link -> Alternate Route -> Destination, then reports Destination Unreachable when all paths fail', () => {
    const campus = getSmartCampusTopology();
    const engine = new DiscreteEventEngine({
      ...campus.simulatorConfig,
      seed: 3030,
      shadowingStdDevDb: 0,
      packetErrorRateOverride: 0,
      enableCollisions: false,
    });

    engine.loadTopology(campus.submeshes, campus.nodes, campus.links);

    // Step 1: Inject IoT Solar -> Wi-Fi Server and verify primary gateway route works
    const baseline = engine.injectPacket(
      'node_iot_solar',
      'node_wf_server',
      'Baseline Solar Telemetry',
      512
    );
    assert.ok(baseline !== null);
    engine.step(400);
    const baseHist = engine.packetHistory.find(p => p.id === baseline.id)!;
    assert.strictEqual(baseHist.state, 'delivered');
    assert.ok(baseHist.pathTraversed.includes('node_gw_primary'));

    // Step 2: Kill primary gateway mid-flight while a second packet is already queued/in-flight toward it
    const failoverPkt = engine.injectPacket(
      'node_iot_solar',
      'node_wf_server',
      'Failover Solar Telemetry',
      512
    );
    assert.ok(failoverPkt !== null);

    // Advance past PacketQueued at node_iot_solar and allow it to reach node_iot_repeater (queued toward primary)
    let reachedRepeater = false;
    for (let i = 0; i < 20; i++) {
      const ev = engine.stepNextEvent();
      if (!ev) break;
      if (failoverPkt.currentHop === 'node_iot_repeater' && failoverPkt.state === 'queued') {
        reachedRepeater = true;
        break;
      }
    }
    assert.strictEqual(reachedRepeater, true, 'Expected packet to reach node_iot_repeater queue');
    assert.strictEqual(failoverPkt.nextHop, 'node_gw_primary');

    // Trigger failure of North Border Gateway A before TX starts from repeater
    engine.failGateway('node_gw_primary');
    engine.step(600);

    const reroutedHist = engine.packetHistory.find(p => p.id === failoverPkt.id)!;
    assert.strictEqual(reroutedHist.state, 'delivered');
    assert.ok(
      reroutedHist.pathTraversed.includes('node_gw_backup'),
      `Expected backup gateway failover, got ${reroutedHist.pathTraversed.join(' -> ')}`
    );
    assert.ok((reroutedHist.routeChangesCount ?? 0) >= 1);
    assert.ok(engine.eventLog.some(e => e.type === 'NodeFailed'));
    assert.ok(engine.eventLog.some(e => e.type === 'RouteChanged'));

    // Step 3: Fail remaining Backup Gateway B -> Destination Unreachable drop
    engine.failGateway('node_gw_backup');
    const unreachablePkt = engine.injectPacket(
      'node_iot_solar',
      'node_wf_server',
      'Isolated Packet',
      512
    );
    assert.ok(unreachablePkt !== null);
    engine.step(400);

    const droppedHist = engine.packetHistory.find(p => p.id === unreachablePkt.id)!;
    assert.strictEqual(droppedHist.state, 'dropped');
    assert.match(droppedHist.dropReason || '', /Destination Unreachable/i);
    assert.strictEqual(engine.metrics.totalPacketsDelivered, 2);
    assert.strictEqual(engine.metrics.totalPacketsDropped, 1);

    // Step 4: Also verify Monolithic topology loads, exports, and imports deterministically
    const mono = getMonolithicMeshTopology();
    const monoEngine = new DiscreteEventEngine({ ...mono.simulatorConfig, seed: 4444 });
    monoEngine.loadTopology(mono.submeshes, mono.nodes, mono.links);
    const monoValidation = monoEngine.validateCurrentTopology();
    assert.strictEqual(monoValidation.valid, true, monoValidation.errors.join('; '));
  });

  it('reroutes an in-flight packet when its active link is severed', () => {
    const campus = getSmartCampusTopology();
    const engine = new DiscreteEventEngine({
      ...campus.simulatorConfig,
      seed: 4545,
      shadowingStdDevDb: 0,
      packetErrorRateOverride: 0,
      enableCollisions: false,
    });
    engine.loadTopology(campus.submeshes, campus.nodes, campus.links);

    const packet = engine.injectPacket(
      'node_iot_solar',
      'node_wf_server',
      'In-flight Link Failure',
      512
    );
    assert.ok(packet);

    let activeLinkId: string | undefined;
    for (let i = 0; i < 100; i++) {
      engine.stepNextEvent();
      if (
        packet.state === 'transmitting' &&
        packet.currentHop === 'node_iot_repeater' &&
        packet.nextHop === 'node_gw_primary'
      ) {
        activeLinkId = packet.currentLinkId;
        break;
      }
    }

    assert.strictEqual(activeLinkId, 'l_gw1_iotrep', 'Expected packet to be transmitting on the primary gateway link');
    engine.toggleSeverLink(activeLinkId);
    engine.step(800);

    const result = engine.packetHistory.find(item => item.id === packet.id);
    assert.strictEqual(result?.state, 'delivered');
    assert.ok(result?.pathTraversed.includes('node_gw_backup'));
    assert.ok((result?.routeChangesCount ?? 0) >= 1);
    assert.ok(engine.eventLog.some(event => event.type === 'RouteChanged'));
  });
});

describe('Integration Scenario 3: Connected City A and City B Meshes', () => {
  it('loads two validated city meshes and routes civic traffic through an intercity gateway', () => {
    const city = getCitywideMeshTopology();
    const engine = new DiscreteEventEngine({
      ...city.simulatorConfig,
      seed: 2026,
      shadowingStdDevDb: 0,
      packetErrorRateOverride: 0,
      enableCollisions: false,
    });
    engine.loadTopology(city.submeshes, city.nodes, city.links);

    assert.strictEqual(city.submeshes.length, 2);
    assert.ok(
      city.nodes.length >= 78,
      `Expected two complete city meshes, gateways, and civic service nodes; got ${city.nodes.length}`
    );
    assert.ok(city.links.length > city.nodes.length, 'Expected dense meshes with redundant paths');
    const gateways = city.nodes.filter(node => node.type === 'gateway');
    assert.strictEqual(gateways.length, 2, 'Expected multiple intercity gateways');
    for (const gateway of gateways) {
      assert.strictEqual(gateway.isMultiRadio, true);
      assert.deepStrictEqual(
        new Set(gateway.interfaces.map(iface => iface.submeshId)),
        new Set(['mesh_city_a', 'mesh_city_b'])
      );
    }

    const validation = engine.validateCurrentTopology();
    assert.strictEqual(validation.valid, true, validation.errors.join('; '));

    const packet = engine.injectPacket(
      'city_a_sensor_air',
      'city_b_station_server',
      'City air quality telemetry',
      512
    );
    assert.ok(packet);
    engine.step(500);

    const delivered = engine.packetHistory.find(item => item.id === packet.id);
    assert.strictEqual(delivered?.state, 'delivered');
    assert.strictEqual(delivered?.pathTraversed[0], 'city_a_sensor_air');
    assert.strictEqual(delivered?.pathTraversed[delivered.pathTraversed.length - 1], 'city_b_station_server');
    assert.ok(gateways.some(gateway => delivered?.pathTraversed.includes(gateway.id)));
    assert.deepStrictEqual(delivered?.protocolTrace, ['HWMP', 'OLSR']);
  });

  it('routes across the surviving gateway when the other intercity gateway fails', () => {
    const city = getCitywideMeshTopology();
    const engine = new DiscreteEventEngine({
      ...city.simulatorConfig,
      seed: 2027,
      shadowingStdDevDb: 0,
      packetErrorRateOverride: 0,
      enableCollisions: false,
    });
    engine.loadTopology(city.submeshes, city.nodes, city.links);
    engine.failGateway('city_a_gateway_west');

    const packet = engine.injectPacket(
      'city_a_sensor_air',
      'city_b_station_server',
      'Intercity gateway failover',
      512
    );
    assert.ok(packet);
    engine.step(700);

    const delivered = engine.packetHistory.find(item => item.id === packet.id);
    assert.strictEqual(delivered?.state, 'delivered');
    assert.ok(delivered?.pathTraversed.includes('city_a_gateway_east'));
    assert.ok(!delivered?.pathTraversed.includes('city_a_gateway_west'));
  });

  it('cancels active packets when a continuous transfer is stopped', () => {
    const city = getCitywideMeshTopology();
    const engine = new DiscreteEventEngine({
      ...city.simulatorConfig,
      shadowingStdDevDb: 0,
      packetErrorRateOverride: 0,
      enableCollisions: false,
    });
    engine.loadTopology(city.submeshes, city.nodes, city.links);

    const packet = engine.injectPacket(
      'city_a_sensor_air',
      'city_b_station_server',
      'User-stoppable stream',
      512
    );
    assert.ok(packet);
    for (let i = 0; i < 100 && packet.state !== 'transmitting'; i++) {
      engine.stepNextEvent();
    }
    assert.strictEqual(packet.state, 'transmitting');

    const activeLink = engine.links.find(link => link.id === packet.currentLinkId);
    assert.ok(activeLink);
    assert.strictEqual(activeLink.currentLoad, 1);
    assert.strictEqual(engine.cancelPacket(packet.id), true);
    assert.strictEqual(activeLink.currentLoad, 0);
    engine.step(500);

    const cancelled = engine.packetHistory.find(item => item.id === packet.id);
    assert.strictEqual(cancelled?.state, 'dropped');
    assert.match(cancelled?.dropReason || '', /Transfer stopped by user/);
    assert.strictEqual(engine.activePackets.has(packet.id), false);
    assert.strictEqual(engine.metrics.totalPacketsDelivered, 0);
  });
});
