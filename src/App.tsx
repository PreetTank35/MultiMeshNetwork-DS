/**
 * Multi-Mesh Network Simulator — Main Application Orchestrator
 * Hyper-minimalist, full-screen, tab-routed architecture
 */

import React, { useEffect, useRef, useState } from 'react';
import { DiscreteEventEngine } from './core/engine/discreteEventEngine';
import { updateMobileNodes } from './core/engine/mobility';
import { getMonolithicMeshTopology, getSmartCampusTopology } from './data/defaultTopologies';
import { BuilderTool, MeshNode, NetworkLink, NodeType, Packet, SubMeshDomain, TopologyExportJSON } from './types/simulator';

import { TopNavbar, ViewTab } from './components/navigation/TopNavbar';
import { TopologyCanvas } from './components/canvas/TopologyCanvas';
import { Isometric3DView } from './components/canvas/Isometric3DView';
import { FloatingPlayerBar } from './components/hud/FloatingPlayerBar';
import { NodeDrawer } from './components/hud/NodeDrawer';
import { PathPickerHUD } from './components/hud/PathPickerHUD';
import { PacketXRayModal } from './components/hud/PacketXRayModal';
import { TelemetryView } from './components/views/TelemetryView';
import { GuideView } from './components/views/GuideView';
import { PacketStudioView } from './components/views/PacketStudioView';
import { NetworkBuilderToolbar } from './components/canvas/NetworkBuilderToolbar';
import { SubMeshConfigModal } from './components/modals/SubMeshConfigModal';

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
  const [highlightedRoute, setHighlightedRoute] = useState<string[] | null>(null);

  // Network Builder State
  const [activeTool, setActiveTool] = useState<BuilderTool>('select');
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [isSubMeshModalOpen, setIsSubMeshModalOpen] = useState(false);
  const [activeSubmeshId, setActiveSubmeshId] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warn' } | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

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
    setConnectSourceId(null);
    if (topo.submeshes.length > 0) {
      setActiveSubmeshId(topo.submeshes[0].id);
    }
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

  // Network Builder Actions
  const handleAddNode = (type: NodeType, submeshId?: string) => {
    const targetSubmesh = submeshId
      ? engine.submeshes.get(submeshId)
      : (engine.submeshes.get(activeSubmeshId) || Array.from(engine.submeshes.values())[0]);

    if (!targetSubmesh) {
      showToast('Please create or select a sub-mesh domain first.', 'warn');
      return;
    }

    const id = `node_${type}_${Date.now().toString().slice(-4)}`;
    const countOfType = Array.from(engine.nodes.values()).filter((n) => n.type === type).length + 1;
    const typeLabel = type === 'router' ? 'RTR' : type === 'gateway' ? 'GW' : type === 'sensor' ? 'SNS' : 'MOB';

    const posX = 380 + (Math.random() - 0.5) * 320;
    const posY = 260 + (Math.random() - 0.5) * 220;
    const ifType = type === 'sensor' ? 'zigbee' : 'wifi';
    const defaultBandwidth = type === 'sensor' ? 0.25 : type === 'gateway' ? 100 : 54;
    const defaultTxPower = type === 'gateway' ? 24 : type === 'sensor' ? 14 : 20;

    const newNode: MeshNode = {
      id,
      name: `${typeLabel}-${countOfType} (${targetSubmesh.protocol})`,
      submeshId: targetSubmesh.id,
      type,
      position: { x: Math.round(posX), y: Math.round(posY) },
      mobilityModel: type === 'mobile' ? 'random_waypoint' : 'static',
      txPowerDbm: defaultTxPower,
      queueCapacity: type === 'gateway' ? 64 : 32,
      currentQueue: [],
      isAlive: true,
      interfaces: [
        {
          id: `if_${id}`,
          type: ifType,
          mac: `00:1A:2B:EE:${id.slice(-2)}:01`,
          channel: targetSubmesh.channelNumber,
          frequencyBand: targetSubmesh.frequencyBand,
          txPowerDbm: defaultTxPower,
          bandwidthMbps: defaultBandwidth,
        },
      ],
      routingTable: {},
    };

    engine.addNode(newNode, true);
    syncState();
    showToast(`Added ${newNode.name} to ${targetSubmesh.name}`, 'info');
  };

  const handleCreateLink = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const link = engine.addLink(sourceId, targetId);
    if (link) {
      showToast(
        `Link created: ${engine.nodes.get(sourceId)?.name} ↔ ${engine.nodes.get(targetId)?.name}`,
        'success'
      );
      syncState();
    } else {
      showToast('Cannot connect link: already connected or invalid nodes.', 'warn');
    }
  };

  const handleCreateSubMesh = (domain: SubMeshDomain) => {
    engine.addSubMesh(domain);
    setActiveSubmeshId(domain.id);
    syncState();
    showToast(`Created Sub-Mesh Domain "${domain.name}" [${domain.protocol}]`, 'success');
  };

  const handleClearCanvas = () => {
    engine.clearCanvas();
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    setConnectSourceId(null);
    syncState();
    showToast('Canvas cleared: All nodes and links removed.', 'warn');
  };

  const handleSaveLocalStorage = () => {
    const ok = engine.saveToLocalStorage('multimesh_custom_network');
    if (ok) {
      showToast('Custom network snapshot saved to LocalStorage!', 'success');
    } else {
      showToast('Failed to save to LocalStorage.', 'warn');
    }
  };

  const handleLoadLocalStorage = () => {
    const ok = engine.loadFromLocalStorage('multimesh_custom_network');
    if (ok) {
      syncState();
      showToast('Loaded custom network from LocalStorage.', 'success');
    } else {
      showToast('No saved custom network found in LocalStorage.', 'warn');
    }
  };

  const handleImportJSON = (jsonString: string) => {
    const ok = engine.importTopologyJSON(jsonString);
    if (ok) {
      syncState();
      showToast('Successfully imported network topology JSON!', 'success');
    } else {
      showToast('Failed to parse or import network JSON.', 'warn');
    }
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
    const data = engine.exportTopologyJSON('Multi-Mesh Export');
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    a.download = `multimesh_${Date.now()}.json`; document.body.appendChild(a); a.click(); a.remove();
    showToast('Exported topology JSON file.', 'info');
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
            {/* Dynamic Network Builder Floating Toolbar */}
            <NetworkBuilderToolbar
              activeTool={activeTool}
              onChangeTool={(tool) => {
                setActiveTool(tool);
                if (tool !== 'connect_link') setConnectSourceId(null);
              }}
              submeshes={submeshes}
              selectedSubmeshId={activeSubmeshId || (submeshes[0]?.id || '')}
              onSelectSubmeshId={setActiveSubmeshId}
              onAddNode={handleAddNode}
              connectSourceId={connectSourceId}
              onCancelConnect={() => {
                setConnectSourceId(null);
                setActiveTool('select');
              }}
              onOpenSubMeshModal={() => setIsSubMeshModalOpen(true)}
              onClearCanvas={handleClearCanvas}
              onSaveLocalStorage={handleSaveLocalStorage}
              onLoadLocalStorage={handleLoadLocalStorage}
              onExportJSON={handleExportJSON}
              onImportJSON={handleImportJSON}
              nodeCount={nodes.length}
              linkCount={links.length}
            />

            {is3DMode ? (
              <Isometric3DView nodes={nodes} links={links} submeshes={submeshes} activePackets={activePackets} />
            ) : (
              <TopologyCanvas nodes={nodes} links={links} submeshes={submeshes} activePackets={activePackets}
                selectedNodeId={selectedNodeId} selectedLinkId={selectedLinkId}
                highlightedRoute={highlightedRoute}
                onSelectNode={id => {
                  if (activeTool === 'connect_link' && id) {
                    if (!connectSourceId) {
                      setConnectSourceId(id);
                      showToast(`Source node selected (${engine.nodes.get(id)?.name}). Now click target node.`, 'info');
                    } else if (connectSourceId !== id) {
                      handleCreateLink(connectSourceId, id);
                      setConnectSourceId(null);
                    }
                    return;
                  }
                  setSelectedNodeId(id);
                  setSelectedLinkId(null);
                }}
                onSelectLink={id => { setSelectedLinkId(id); setSelectedNodeId(null); }}
                onMoveNode={handleMoveNode} />
            )}

            <FloatingPlayerBar isRunning={isRunning} simTimeMs={simTimeMs} speedMultiplier={speedMultiplier} logs={engine.logs}
              nodes={nodes} submeshes={submeshes} is3DMode={is3DMode}
              onTogglePlay={handleTogglePlay} onStepForward={handleStepForward} onChangeSpeed={handleChangeSpeed}
              onInjectPacket={handleInjectPacket} onToggle3D={() => setIs3DMode(!is3DMode)} onAddNode={handleAddNode} />

            <PathPickerHUD
              nodes={nodes}
              links={links}
              submeshes={submeshes}
              selectedNodeId={selectedNodeId}
              activeRoutePath={highlightedRoute}
              onHighlightRoute={setHighlightedRoute}
              onTransmitPacket={handleInjectPacket}
              className="top-4 left-4"
            />

            <NodeDrawer node={selectedNode} link={selectedLink} submeshes={submeshes} nodes={nodes}
              onClose={() => { setSelectedNodeId(null); setSelectedLinkId(null); }}
              onToggleKillNode={id => { engine.toggleKillNode(id); syncState(); }}
              onToggleSeverLink={id => { engine.toggleSeverLink(id); syncState(); }}
              onToggleJamFrequency={band => { engine.toggleJamFrequency(band); syncState(); }} />
          </>
        )}

        {/* TAB 2: Packet X-Ray Studio */}
        {activeTab === 'studio' && (
          <PacketStudioView nodes={nodes} links={links} submeshes={submeshes} activePackets={activePackets}
            translationTraces={engine.translationTraces} onInjectPacket={handleInjectPacket} />
        )}

        {/* TAB 3: Telemetry Hub */}
        {activeTab === 'telemetry' && <TelemetryView metrics={engine.metrics} />}

        {/* TAB 4: Interactive Guide */}
        {activeTab === 'guide' && <GuideView onRunExperiment={handleRunExperiment} />}
      </main>

      <PacketXRayModal packet={inspectedPacket} nodes={nodes} submeshes={submeshes} onClose={() => setInspectedPacket(null)} />

      {/* Sub-Mesh Domain Configuration Modal */}
      <SubMeshConfigModal
        isOpen={isSubMeshModalOpen}
        onClose={() => setIsSubMeshModalOpen(false)}
        onCreateSubMesh={handleCreateSubMesh}
        existingCount={submeshes.length}
      />

      {/* Floating Action Feedback Toast */}
      {toast && (
        <div
          className={`fixed bottom-24 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-semibold shadow-2xl backdrop-blur-md animate-fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
              : toast.type === 'warn'
              ? 'bg-amber-950/90 text-amber-200 border-amber-500/40'
              : 'bg-slate-900/90 text-cyan-200 border-cyan-500/40'
          }`}
          style={{
            boxShadow: '6px 6px 20px #080a0f, -6px -6px 20px #1c2332',
          }}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              toast.type === 'success'
                ? 'bg-emerald-400'
                : toast.type === 'warn'
                ? 'bg-amber-400'
                : 'bg-cyan-400'
            }`}
          />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
