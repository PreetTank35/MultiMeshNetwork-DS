/**
 * Multi-Mesh Network Simulator — Main Application Orchestrator
 * Hyper-minimalist, full-screen, tab-routed architecture
 */

import React, { useEffect, useRef, useState } from 'react';
import { DiscreteEventEngine } from './core/engine/discreteEventEngine';
import { updateMobileNodes } from './core/engine/mobility';
import { getMonolithicMeshTopology, getSmartCampusTopology } from './data/defaultTopologies';
import { MeshNode, NetworkLink, NodeType, Packet, SubMeshDomain, TopologyExportJSON } from './types/simulator';

import { TopNavbar, ViewTab } from './components/navigation/TopNavbar';
import { TopologyCanvas } from './components/canvas/TopologyCanvas';
import { Isometric3DView } from './components/canvas/Isometric3DView';
import { FloatingPlayerBar } from './components/hud/FloatingPlayerBar';
import { NodeDrawer } from './components/hud/NodeDrawer';
import { PacketXRayModal } from './components/hud/PacketXRayModal';
import { TelemetryView } from './components/views/TelemetryView';
import { GuideView } from './components/views/GuideView';
import { PacketStudioView } from './components/views/PacketStudioView';

export function App() {
  const engineRef = useRef(new DiscreteEventEngine());
  const engine = engineRef.current;

  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [links, setLinks] = useState<NetworkLink[]>([]);
  const [submeshes, setSubmeshes] = useState<SubMeshDomain[]>([]);
  const [activePackets, setActivePackets] = useState<Packet[]>([]);
  const [simTimeMs, setSimTimeMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);

  const [activeTab, setActiveTab] = useState<ViewTab>('canvas');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [inspectedPacket, setInspectedPacket] = useState<Packet | null>(null);
  const [is3DMode, setIs3DMode] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  useEffect(() => { loadTopology('smart_campus'); }, []);

  const syncState = () => {
    setNodes(Array.from(engine.nodes.values()));
    setLinks([...engine.links]);
    setSubmeshes(Array.from(engine.submeshes.values()));
    setActivePackets(Array.from(engine.activePackets.values()));
    setSimTimeMs(engine.simTimeMs);
    setIsRunning(engine.isRunning);
    setSpeedMultiplier(engine.speedMultiplier);
  };

  const loadTopology = (preset: 'smart_campus' | 'monolithic') => {
    const topo = preset === 'smart_campus' ? getSmartCampusTopology() : getMonolithicMeshTopology();
    engine.loadTopology(topo.submeshes, topo.nodes, topo.links);
    syncState();
    setSelectedNodeId(null); setSelectedLinkId(null);
  };

  // Main Simulation Loop
  useEffect(() => {
    let animId: number, lastT = performance.now();
    const loop = (now: number) => {
      const dt = now - lastT; lastT = now;
      if (engine.isRunning) {
        const dSim = Math.min(dt * engine.speedMultiplier, 100);
        if (updateMobileNodes(engine.nodes, dSim / 1000)) engine.refreshLinkProperties();
        engine.step(dSim);
        syncState();
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleTogglePlay = () => { engine.isRunning = !engine.isRunning; syncState(); };
  const handleStepForward = () => { engine.step(30); syncState(); };
  const handleReset = () => { engine.resetSimulation(); syncState(); };
  const handleChangeSpeed = (s: number) => { engine.speedMultiplier = s; setSpeedMultiplier(s); };

  const handleMoveNode = (id: string, x: number, y: number) => {
    const n = engine.nodes.get(id);
    if (!n) return;
    n.position.x = x; n.position.y = y;
    engine.refreshLinkProperties(); syncState();
  };

  const handleAddNode = (type: NodeType) => {
    const sm = submeshes[0]; if (!sm) return;
    const id = `node_${type}_${Date.now().toString().slice(-4)}`;
    const newNode: MeshNode = {
      id, name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${id.slice(-3)}`, submeshId: sm.id, type,
      position: { x: 300 + Math.random() * 300, y: 200 + Math.random() * 200 },
      mobilityModel: type === 'mobile' ? 'random_waypoint' : 'static', txPowerDbm: type === 'gateway' ? 24 : 18,
      queueCapacity: 32, currentQueue: [], isAlive: true,
      interfaces: [{ id: `if_${id}`, type: type === 'sensor' ? 'zigbee' : 'wifi', mac: `00:1A:2B:EE:${id.slice(-2)}:01`, channel: 36, frequencyBand: sm.frequencyBand, txPowerDbm: 20, bandwidthMbps: 54 }],
      routingTable: {}
    };
    engine.nodes.set(id, newNode);

    // Auto-link nearest
    let nearest: MeshNode | null = null, minD = Infinity;
    for (const o of engine.nodes.values()) { if (o.id === id) continue; const dd = Math.hypot(o.position.x - newNode.position.x, o.position.y - newNode.position.y); if (dd < minD) { minD = dd; nearest = o; } }
    if (nearest) engine.links.push({ id: `link_${id}_${nearest.id}`, source: id, target: nearest.id, bandwidthMbps: 54, lossRate: 0.01, distanceMeters: minD * 0.5, snrDb: 25, per: 0.01, isSevered: false, isJammed: false, currentLoad: 0, traversalCount: 0 });
    engine.refreshLinkProperties(); syncState();
  };

  const handleInjectPacket = (src: string, dst: string, payload: string) => {
    engine.injectPacket(src, dst, payload); syncState();
  };

  const handleRunExperiment = (scenario: 'smart_campus' | 'monolithic') => {
    loadTopology(scenario); setActiveTab('canvas');
    setTimeout(() => {
      if (scenario === 'smart_campus') engine.injectPacket('node_iot_solar', 'node_wf_server', 'Solar Telemetry via RPL');
      else engine.injectPacket('node_flat_0_0', 'node_flat_3_3', 'Contention Test');
      engine.isRunning = true; syncState();
    }, 300);
  };

  const handleExportJSON = () => {
    const data: TopologyExportJSON = {
      simulatorConfig: engine.config, submeshes, nodes, links,
      meta: { exportedAt: new Date().toISOString(), version: '1.0.0', scenarioTitle: 'Multi-Mesh Export', authors: ['Preet Tank', 'Tejas Waghmode', 'Vansh Thakre'] }
    };
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    a.download = `multimesh_${Date.now()}.json`; document.body.appendChild(a); a.click(); a.remove();
  };

  const selectedNode = selectedNodeId ? engine.nodes.get(selectedNodeId) || null : null;
  const selectedLink = selectedLinkId ? engine.links.find(l => l.id === selectedLinkId) || null : null;

  return (
    <div className="flex flex-col h-screen w-screen bg-canvas-deep overflow-hidden select-none font-sans text-slate-100">
      <TopNavbar activeTab={activeTab} onChangeTab={setActiveTab} onLoadScenario={loadTopology}
        isPresentationMode={isPresentationMode} onTogglePresentationMode={() => setIsPresentationMode(!isPresentationMode)}
        onExportJSON={handleExportJSON} onReset={handleReset} />

      <main className="flex-1 relative overflow-hidden">
        {/* TAB 1: Topology Canvas */}
        {activeTab === 'canvas' && (
          <>
            {is3DMode ? (
              <Isometric3DView nodes={nodes} links={links} submeshes={submeshes} activePackets={activePackets} />
            ) : (
              <TopologyCanvas nodes={nodes} links={links} submeshes={submeshes} activePackets={activePackets}
                selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId}
                onSelectNode={id => { setSelectedNodeId(id); setSelectedLinkId(null); }}
                onSelectLink={id => { setSelectedLinkId(id); setSelectedNodeId(null); }}
                onMoveNode={handleMoveNode} />
            )}

            <FloatingPlayerBar isRunning={isRunning} simTimeMs={simTimeMs} speedMultiplier={speedMultiplier} logs={engine.logs}
              nodes={nodes} submeshes={submeshes} is3DMode={is3DMode}
              onTogglePlay={handleTogglePlay} onStepForward={handleStepForward} onChangeSpeed={handleChangeSpeed}
              onInjectPacket={handleInjectPacket} onToggle3D={() => setIs3DMode(!is3DMode)} onAddNode={handleAddNode} />

            <NodeDrawer node={selectedNode} link={selectedLink} submeshes={submeshes} nodes={nodes}
              onClose={() => { setSelectedNodeId(null); setSelectedLinkId(null); }}
              onToggleKillNode={id => { engine.toggleKillNode(id); syncState(); }}
              onToggleSeverLink={id => { engine.toggleSeverLink(id); syncState(); }}
              onToggleJamFrequency={band => { engine.toggleJamFrequency(band); syncState(); }} />
          </>
        )}

        {/* TAB 2: Packet X-Ray Studio */}
        {activeTab === 'studio' && (
          <PacketStudioView nodes={nodes} submeshes={submeshes} activePackets={activePackets}
            translationTraces={engine.translationTraces} onInjectPacket={handleInjectPacket} />
        )}

        {/* TAB 3: Telemetry Hub */}
        {activeTab === 'telemetry' && <TelemetryView metrics={engine.metrics} />}

        {/* TAB 4: Interactive Guide */}
        {activeTab === 'guide' && <GuideView onRunExperiment={handleRunExperiment} />}
      </main>

      <PacketXRayModal packet={inspectedPacket} nodes={nodes} submeshes={submeshes} onClose={() => setInspectedPacket(null)} />
    </div>
  );
}
