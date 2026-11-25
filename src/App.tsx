/**
 * Multi-Mesh Network Simulator — Main Application Orchestrator
 * Tactile Light/Dark Neomorphism • Zero-Overlap Floating Workspace • Blueprint Maps
 */

import React, { useEffect, useRef, useState } from 'react';
import { DiscreteEventEngine } from './core/engine/discreteEventEngine';
import { updateMobileNodes } from './core/engine/mobility';
import {
  getCitywideMeshTopology,
  getMonolithicMeshTopology,
  getSmartCampusTopology,
  getSmartLogisticsTopology,
} from './data/defaultTopologies';
import { BuilderTool, MeshNode, NetworkLink, NodeType, Packet, SubMeshDomain } from './types/simulator';

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
  const [activeTransfer, setActiveTransfer] = useState<{
    sourceId: string;
    destId: string;
    payload: string;
    packetsSent: number;
    nextPacketAtSimMs: number;
    packetIds: string[];
  } | null>(null);
  const activeTransferRef = useRef<typeof activeTransfer>(null);

  const [activeTab, setActiveTab] = useState<ViewTab>('canvas');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [inspectedPacket, setInspectedPacket] = useState<Packet | null>(null);
  const [is3DMode, setIs3DMode] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [highlightedRoute, setHighlightedRoute] = useState<string[] | null>(null);
  const [activeBlueprintId, setActiveBlueprintId] = useState<string>('none');
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false); // Default: Soft Light Neomorphism (#E4E9F2)

  // Builder State
  const [activeTool, setActiveTool] = useState<BuilderTool>('select');
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [isSubMeshModalOpen, setIsSubMeshModalOpen] = useState(false);
  const [activeSubmeshId, setActiveSubmeshId] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warn' } | null>(null);

  // Sync CSS data-theme attribute on documentElement
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
  }, [isDarkTheme]);

  const showToast = (message: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 3200);
  };

  useEffect(() => {
    loadTopology('citywide');
  }, []);

  const syncState = () => {
    setNodes(Array.from(engine.nodes.values()));
    setLinks([...engine.links]);
    setSubmeshes(Array.from(engine.submeshes.values()));
    setActivePackets(Array.from(engine.activePackets.values()));
    setSimTimeMs(engine.simTimeMs);
    setIsRunning(engine.isRunning);
    setSpeedMultiplier(engine.speedMultiplier);
  };

  const loadTopology = (preset: 'smart_campus' | 'smart_logistics' | 'monolithic' | 'citywide') => {
    const topo =
      preset === 'smart_campus'
        ? getSmartCampusTopology()
        : preset === 'smart_logistics'
        ? getSmartLogisticsTopology()
        : preset === 'citywide'
        ? getCitywideMeshTopology()
        : getMonolithicMeshTopology();

    setActiveBlueprintId(
      preset === 'smart_campus'
        ? 'campus_academic_wing'
        : preset === 'smart_logistics'
        ? 'smart_logistics'
        : 'none'
    );

    activeTransferRef.current = null;
    setActiveTransfer(null);
    engine.loadTopology(topo.submeshes, topo.nodes, topo.links);
    syncState();
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    setConnectSourceId(null);
    setHighlightedRoute(null);
    if (topo.submeshes.length > 0) setActiveSubmeshId(topo.submeshes[0].id);
  };

  // Simulation Loop
  useEffect(() => {
    let animId: number,
      lastT = performance.now();
    const loop = (now: number) => {
      const dt = now - lastT;
      lastT = now;
      if (engine.isRunning) {
        const dSim = Math.min(dt * engine.speedMultiplier, 100);
        if (updateMobileNodes(engine.nodes, dSim / 1000)) engine.refreshLinkProperties();
        engine.step(dSim);
        const transfer = activeTransferRef.current;
        if (transfer && engine.simTimeMs >= transfer.nextPacketAtSimMs) {
          const packet = engine.injectPacket(transfer.sourceId, transfer.destId, transfer.payload);
          if (!packet) {
            for (const packetId of transfer.packetIds) {
              engine.cancelPacket(packetId, 'Transfer stopped by user');
            }
            activeTransferRef.current = null;
            setActiveTransfer(null);
            showToast(`Data stream stopped: ${engine.lastValidationError || 'packet injection failed.'}`, 'warn');
          } else {
            const updatedTransfer = {
              ...transfer,
              packetsSent: transfer.packetsSent + 1,
              nextPacketAtSimMs: engine.simTimeMs + 1000,
              packetIds: [
                ...transfer.packetIds.filter(packetId => engine.activePackets.has(packetId)),
                packet.id,
              ],
            };
            activeTransferRef.current = updatedTransfer;
            setActiveTransfer(updatedTransfer);
          }
        }
        syncState();
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleTogglePlay = () => { engine.isRunning = !engine.isRunning; syncState(); };
  const handleStepForward = () => { engine.step(30); syncState(); };
  const handleReset = () => {
    activeTransferRef.current = null;
    setActiveTransfer(null);
    engine.resetSimulation();
    setHighlightedRoute(null);
    syncState();
  };
  const handleChangeSpeed = (s: number) => { engine.speedMultiplier = s; setSpeedMultiplier(s); };

  const handleMoveNode = (id: string, x: number, y: number) => {
    const n = engine.nodes.get(id);
    if (!n) return;
    n.position.x = x;
    n.position.y = y;
    engine.refreshLinkProperties();
    syncState();
  };

  const handleAddNode = (type: NodeType, submeshId?: string) => {
    const targetSubmesh = submeshId
      ? engine.submeshes.get(submeshId)
      : engine.submeshes.get(activeSubmeshId) || Array.from(engine.submeshes.values())[0];

    if (!targetSubmesh) {
      showToast('Create or select a sub-mesh domain first.', 'warn');
      return;
    }

    const id = `node_${type}_${Date.now().toString().slice(-4)}`;
    const count = Array.from(engine.nodes.values()).filter(n => n.type === type).length + 1;
    const typeLabel = type === 'router' ? 'RTR' : type === 'gateway' ? 'GW' : type === 'sensor' ? 'SNS' : 'MOB';
    const ifType = type === 'sensor' ? 'zigbee' : 'wifi';

    const newNode: MeshNode = {
      id,
      name: `${typeLabel}-${count} (${targetSubmesh.protocol})`,
      submeshId: targetSubmesh.id,
      type,
      position: { x: Math.round(450 + (Math.random() - 0.5) * 260), y: Math.round(300 + (Math.random() - 0.5) * 180) },
      mobilityModel: type === 'mobile' ? 'random_waypoint' : 'static',
      txPowerDbm: type === 'gateway' ? 24 : type === 'sensor' ? 14 : 20,
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
          txPowerDbm: type === 'gateway' ? 24 : 18,
          bandwidthMbps: type === 'sensor' ? 0.25 : 54,
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
      showToast(`Connected ${engine.nodes.get(sourceId)?.name} ↔ ${engine.nodes.get(targetId)?.name}`, 'success');
      syncState();
    } else {
      showToast('Link already exists or invalid nodes.', 'warn');
    }
  };

  const handleCreateSubMesh = (domain: SubMeshDomain) => {
    engine.addSubMesh(domain);
    setActiveSubmeshId(domain.id);
    syncState();
    showToast(`Created "${domain.name}" [${domain.protocol}]`, 'success');
  };

  const handleClearCanvas = () => {
    activeTransferRef.current = null;
    setActiveTransfer(null);
    engine.clearCanvas();
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    setConnectSourceId(null);
    setHighlightedRoute(null);
    syncState();
    showToast('Canvas cleared.', 'warn');
  };

  const handleSaveLocalStorage = () => {
    showToast(
      engine.saveToLocalStorage('multimesh_custom_network') ? 'Saved to Browser LocalStorage!' : 'Save failed.',
      'success'
    );
  };

  const handleLoadLocalStorage = () => {
    if (engine.loadFromLocalStorage('multimesh_custom_network')) {
      activeTransferRef.current = null;
      setActiveTransfer(null);
      syncState();
      showToast('Loaded saved network.', 'success');
    } else {
      showToast('No saved network found in LocalStorage.', 'warn');
    }
  };

  const handleImportJSON = (jsonString: string) => {
    if (engine.importTopologyJSON(jsonString)) {
      activeTransferRef.current = null;
      setActiveTransfer(null);
      syncState();
      showToast('Imported network JSON!', 'success');
    } else {
      showToast('Invalid network JSON.', 'warn');
    }
  };

  const handleInjectPacket = (src: string, dst: string, payload: string) => {
    engine.injectPacket(src, dst, payload);
    if (!engine.isRunning) engine.isRunning = true;
    syncState();
  };

  const handleStartContinuousTransfer = (src: string, dst: string, payload: string) => {
    const packet = engine.injectPacket(src, dst, payload);
    if (!packet) {
      showToast(`Could not start data stream: ${engine.lastValidationError || 'packet injection failed.'}`, 'warn');
      return;
    }

    const transfer = {
      sourceId: src,
      destId: dst,
      payload,
      packetsSent: 1,
      nextPacketAtSimMs: engine.simTimeMs + 1000,
      packetIds: [packet.id],
    };
    activeTransferRef.current = transfer;
    setActiveTransfer(transfer);
    engine.isRunning = true;
    syncState();
  };

  const handleStopContinuousTransfer = () => {
    const transfer = activeTransferRef.current;
    const cancelledCount = transfer
      ? transfer.packetIds.filter(packetId => engine.cancelPacket(packetId)).length
      : 0;
    activeTransferRef.current = null;
    setActiveTransfer(null);
    syncState();
    showToast(
      `Continuous transfer stopped; cancelled ${cancelledCount} in-flight packet${cancelledCount === 1 ? '' : 's'}.`,
      'info'
    );
  };

  const handleToggleSeverLink = (id: string) => {
    const isSevered = engine.toggleSeverLink(id);
    syncState();
    showToast(
      isSevered
        ? 'Connection cut. Active packets are checking alternate routes.'
        : 'Connection restored.',
      isSevered ? 'warn' : 'success'
    );
  };

  const handleRunExperiment = (scenario: 'smart_campus' | 'monolithic') => {
    loadTopology(scenario);
    setActiveTab('canvas');
    setTimeout(() => {
      if (scenario === 'smart_campus') engine.injectPacket('node_iot_solar', 'node_wf_server', 'Solar Telemetry via RPL');
      else engine.injectPacket('node_flat_0_0', 'node_flat_3_3', 'Contention Test');
      engine.isRunning = true;
      syncState();
    }, 300);
  };

  const handleExportJSON = () => {
    const data = engine.exportTopologyJSON('Multi-Mesh Export');
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    a.download = `multimesh_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Exported topology JSON.', 'info');
  };

  const selectedNode = selectedNodeId ? engine.nodes.get(selectedNodeId) || null : null;
  const selectedLink = selectedLinkId ? engine.links.find(l => l.id === selectedLinkId) || null : null;

  return (
    <div className="flex flex-col h-screen w-screen neu-base overflow-hidden select-none font-sans">
      <TopNavbar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onLoadScenario={loadTopology}
        isPresentationMode={isPresentationMode}
        onTogglePresentationMode={() => setIsPresentationMode(!isPresentationMode)}
        isDarkTheme={isDarkTheme}
        onToggleTheme={() => setIsDarkTheme(!isDarkTheme)}
        onExportJSON={handleExportJSON}
        onReset={handleReset}
      />

      <main className="flex-1 relative overflow-hidden">
        {activeTab === 'canvas' && (
          <>
            {is3DMode ? (
              <Isometric3DView
                nodes={nodes}
                links={links}
                submeshes={submeshes}
                activePackets={activePackets}
                isDarkTheme={isDarkTheme}
              />
            ) : (
              <TopologyCanvas
                nodes={nodes}
                links={links}
                submeshes={submeshes}
                activePackets={activePackets}
                selectedNodeId={selectedNodeId}
                selectedLinkId={selectedLinkId}
                activeBlueprintId={activeBlueprintId}
                highlightedRoute={highlightedRoute}
                isDarkTheme={isDarkTheme}
                isPresentationMode={isPresentationMode}
                onSelectNode={id => {
                  if (activeTool === 'connect_link' && id) {
                    if (!connectSourceId) {
                      setConnectSourceId(id);
                      showToast(`Source selected (${engine.nodes.get(id)?.name}). Click target node.`, 'info');
                    } else if (connectSourceId !== id) {
                      handleCreateLink(connectSourceId, id);
                      setConnectSourceId(null);
                    }
                    return;
                  }
                  setSelectedNodeId(id);
                  setSelectedLinkId(null);
                }}
                onSelectLink={id => {
                  setSelectedLinkId(id);
                  setSelectedNodeId(null);
                }}
                onMoveNode={handleMoveNode}
                isTransferActive={activeTransfer !== null}
                onToggleLinkFailure={handleToggleSeverLink}
              />
            )}

            {/* Static Independent HUD Anchors (never shift when nodes or links increase) */}
            {!isPresentationMode && (
              <>
                <NetworkBuilderToolbar
                  activeTool={activeTool}
                  onChangeTool={tool => {
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
                />

                <PathPickerHUD
                  nodes={nodes}
                  links={links}
                  submeshes={submeshes}
                  selectedNodeId={selectedNodeId}
                  activeRoutePath={highlightedRoute}
                  onHighlightRoute={setHighlightedRoute}
                  onTransmitPacket={handleInjectPacket}
                  activeTransfer={activeTransfer}
                  onStartContinuousTransfer={handleStartContinuousTransfer}
                  onStopContinuousTransfer={handleStopContinuousTransfer}
                />
              </>
            )}

            <FloatingPlayerBar
              isRunning={isRunning}
              simTimeMs={simTimeMs}
              speedMultiplier={speedMultiplier}
              logs={engine.logs}
              nodes={nodes}
              submeshes={submeshes}
              is3DMode={is3DMode}
              onTogglePlay={handleTogglePlay}
              onStepForward={handleStepForward}
              onChangeSpeed={handleChangeSpeed}
              onInjectPacket={handleInjectPacket}
              onToggle3D={() => setIs3DMode(!is3DMode)}
              onAddNode={handleAddNode}
            />

            <NodeDrawer
              node={selectedNode}
              link={selectedLink}
              submeshes={submeshes}
              nodes={nodes}
              onClose={() => {
                setSelectedNodeId(null);
                setSelectedLinkId(null);
              }}
              onToggleKillNode={id => {
                engine.toggleKillNode(id);
                syncState();
              }}
              onToggleSeverLink={id => {
                handleToggleSeverLink(id);
              }}
              onToggleJamFrequency={band => {
                engine.toggleJamFrequency(band);
                syncState();
              }}
            />
          </>
        )}

        {activeTab === 'studio' && (
          <PacketStudioView
            nodes={nodes}
            links={links}
            submeshes={submeshes}
            activePackets={[
              ...activePackets,
              ...engine.packetHistory.filter(h => !activePackets.some(a => a.id === h.id)),
            ]}
            translationTraces={engine.translationTraces}
            onInjectPacket={handleInjectPacket}
          />
        )}

        {activeTab === 'telemetry' && <TelemetryView metrics={engine.metrics} />}
        {activeTab === 'guide' && <GuideView onRunExperiment={handleRunExperiment} />}
      </main>

      <PacketXRayModal packet={inspectedPacket} nodes={nodes} submeshes={submeshes} onClose={() => setInspectedPacket(null)} />

      <SubMeshConfigModal
        isOpen={isSubMeshModalOpen}
        onClose={() => setIsSubMeshModalOpen(false)}
        onCreateSubMesh={handleCreateSubMesh}
        existingCount={submeshes.length}
      />

      {toast && (
        <div className="fixed bottom-20 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl neu-convex text-xs font-semibold text-neu-text animate-fade-up">
          <div
            className={`w-2 h-2 rounded-full ${
              toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'warn' ? 'bg-amber-500' : 'bg-sky-500'
            }`}
          />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
