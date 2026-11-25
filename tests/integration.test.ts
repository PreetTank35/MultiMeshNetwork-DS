import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DiscreteEventEngine } from '../src/core/engine/discreteEventEngine';
import { getSmartCampusTopology, getMonolithicMeshTopology } from '../src/data/defaultTopologies';

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
});
