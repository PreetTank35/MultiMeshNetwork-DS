/**
 * Multi-Mesh Network Simulator
 * Main Application Orchestrator
 * Integrates 2D Canvas, 3D Isometric View, Discrete-Event Engine,
 * Component Dock, Inspector Panels, Bottom Timeline, and Telemetry
 */

import React, { useEffect, useRef, useState } from 'react';
import { DiscreteEventEngine } from './core/engine/discreteEventEngine';
import { updateMobileNodes } from './core/engine/mobility';
import { getMonolithicMeshTopology, getSmartCampusTopology } from './data/defaultTopologies';
import { NetworkingLesson } from './data/networkingLessons';
import { MeshNode, NetworkLink, NodeType, Packet, SubMeshDomain, TopologyExportJSON } from './types/simulator';

import { TopologyCanvas } from './components/canvas/TopologyCanvas';
import { Isometric3DView } from './components/canvas/Isometric3DView';
import { ComponentDock } from './components/panels/ComponentDock';
import { RightInspector } from './components/panels/RightInspector';
import { BottomTimeline } from './components/panels/BottomTimeline';
import { TelemetryDashboard } from './components/panels/TelemetryDashboard';
import { TopNavbar } from './components/panels/TopNavbar';
import { LessonsModal } from './components/modals/LessonsModal';

export function App() {
  // Simulator Engine Reference
  const engineRef = useRef<DiscreteEventEngine>(new DiscreteEventEngine());
  const engine = engineRef.current;

  // React State Synchronization
  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [links, setLinks] = useState<NetworkLink[]>([]);
  const [submeshes, setSubmeshes] = useState<SubMeshDomain[]>([]);
  const [activePackets, setActivePackets] = useState<Packet[]>([]);
  const [simTimeMs, setSimTimeMs] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);

  // Selection & UI Modes
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [is3DMode, setIs3DMode] = useState<boolean>(false);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState<boolean>(true);
  const [isTutorialsOpen, setIsTutorialsOpen] = useState<boolean>(false);
  const [isPresentationMode, setIsPresentationMode] = useState<boolean>(false);

  // Initialize with Smart Campus Topology on Mount
  useEffect(() => {
    loadTopologyPreset('smart_campus');
  }, []);

  const loadTopologyPreset = (preset: 'smart_campus' | 'monolithic') => {
    const topology = preset === 'smart_campus' ? getSmartCampusTopology() : getMonolithicMeshTopology();
    engine.loadTopology(topology.submeshes, topology.nodes, topology.links);
    syncState();
    setSelectedNodeId(null);
    setSelectedLinkId(null);
  };

  const syncState = () => {
    setNodes(Array.from(engine.nodes.values()));
    setLinks([...engine.links]);
    setSubmeshes(Array.from(engine.submeshes.values()));
    setActivePackets(Array.from(engine.activePackets.values()));
    setSimTimeMs(engine.simTimeMs);
    setIsRunning(engine.isRunning);
    setSpeedMultiplier(engine.speedMultiplier);
  };

  // Main Simulation Loop (Discrete-Event Stepper + Mobility)
  useEffect(() => {
    let animId: number;
    let lastWallTime = performance.now();

    const loop = (currentWallTime: number) => {
      const deltaWallMs = currentWallTime - lastWallTime;
      lastWallTime = currentWallTime;

      if (engine.isRunning) {
        // Delta sim time scaled by speedMultiplier
        const deltaSimMs = Math.min(deltaWallMs * engine.speedMultiplier, 100);
        
        // Update mobility kinematics
        const anyMoved = updateMobileNodes(engine.nodes, deltaSimMs / 1000);
        if (anyMoved) {
          engine.refreshLinkProperties();
        }

        // Advance discrete-event scheduler
        engine.step(deltaSimMs);
        syncState();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Playback Control Handlers
  const handleTogglePlay = () => {
    engine.isRunning = !engine.isRunning;
    setIsRunning(engine.isRunning);
    syncState();
  };

  const handleStepForward = () => {
    engine.step(30); // 30ms single step
    syncState();
  };

  const handleReset = () => {
    engine.resetSimulation();
    syncState();
  };

  const handleChangeSpeed = (speed: number) => {
    engine.speedMultiplier = speed;
    setSpeedMultiplier(speed);
  };

  // Node Movement & Interaction
  const handleMoveNode = (nodeId: string, x: number, y: number) => {
    const node = engine.nodes.get(nodeId);
    if (!node) return;

    node.position.x = x;
    node.position.y = y;
    engine.refreshLinkProperties();
    syncState();
  };

  const handleAddNode = (type: NodeType) => {
    const currentSubmesh = submeshes[0] || { id: 'mesh_wifi', frequencyBand: '5.2GHz', color: '#3B82F6' };
    const id = `node_${type}_${Date.now().toString().slice(-4)}`;
    const newNode: MeshNode = {
      id,
      name: `${type.toUpperCase()} Node ${id.slice(-3)}`,
      submeshId: currentSubmesh.id,
      type,
      position: { x: 300 + Math.random() * 200, y: 250 + Math.random() * 150 },
      mobilityModel: type === 'mobile' ? 'random_waypoint' : 'static',
      txPowerDbm: type === 'gateway' ? 24 : 18,
      queueCapacity: 32,
      currentQueue: [],
      isAlive: true,
      interfaces: [
        {
          id: `if_${id}`,
          type: type === 'sensor' ? 'zigbee' : 'wifi',
          mac: `00:1A:2B:EE:${id.slice(-2)}:01`,
          channel: 36,
          frequencyBand: currentSubmesh.frequencyBand,
          txPowerDbm: 20,
          bandwidthMbps: 54
        }
      ],
      routingTable: {}
    };

    engine.nodes.set(id, newNode);

    // Automatically link to nearest existing node
    let nearestNode: MeshNode | null = null;
    let minDist = Infinity;
    for (const other of engine.nodes.values()) {
      if (other.id === id) continue;
      const d = Math.hypot(other.position.x - newNode.position.x, other.position.y - newNode.position.y);
      if (d < minDist) {
        minDist = d;
        nearestNode = other;
      }
    }

    if (nearestNode) {
      engine.links.push({
        id: `link_${id}_${nearestNode.id}`,
        source: id,
        target: nearestNode.id,
        bandwidthMbps: 54,
        lossRate: 0.01,
        distanceMeters: minDist * 0.5,
        snrDb: 25,
        per: 0.01,
        isSevered: false,
        isJammed: false,
        currentLoad: 0,
        traversalCount: 0
      });
    }

    engine.refreshLinkProperties();
    syncState();
  };

  const handleInjectPacket = (sourceId: string, targetId: string, payload: string) => {
    engine.injectPacket(sourceId, targetId, payload);
    syncState();
  };

  const handleRunLessonExperiment = (lesson: NetworkingLesson) => {
    loadTopologyPreset(lesson.recommendedTopology);
    if (lesson.recommendedTopology === 'smart_campus') {
      // Inject packet from IoT sensor to Wi-Fi server after 300ms
      setTimeout(() => {
        engine.injectPacket('node_iot_solar', 'node_wf_server', 'Solar Plant Telemetry via RPL');
        engine.isRunning = true;
        syncState();
      }, 300);
    } else {
      setTimeout(() => {
        engine.injectPacket('node_flat_0_0', 'node_flat_3_3', 'Contention Test Payload');
        engine.isRunning = true;
        syncState();
      }, 300);
    }
  };

  const handleExportJSON = () => {
    const exportData: TopologyExportJSON = {
      simulatorConfig: engine.config,
      submeshes,
      nodes,
      links,
      meta: {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        scenarioTitle: 'Multi-Mesh Simulator State Export',
        authors: ['Preet Tank', 'Tejas Waghmode', 'Vansh Thakre']
      }
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `multimesh_topology_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const selectedNode = selectedNodeId ? engine.nodes.get(selectedNodeId) || null : null;
  const selectedLink = selectedLinkId ? engine.links.find(l => l.id === selectedLinkId) || null : null;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0F172A] overflow-hidden select-none font-sans text-slate-100">
      {/* Top Navbar */}
      <TopNavbar
        isPresentationMode={isPresentationMode}
        onTogglePresentationMode={() => setIsPresentationMode(!isPresentationMode)}
        onOpenTutorials={() => setIsTutorialsOpen(true)}
      />

      {/* Main Workspace (Dock + Center Canvas + Inspector) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Component Dock (collapses in presentation mode) */}
        {!isPresentationMode && (
          <ComponentDock
            submeshes={submeshes}
            is3DMode={is3DMode}
            onToggle3D={() => setIs3DMode(!is3DMode)}
            onAddNode={handleAddNode}
            onLoadScenario={loadTopologyPreset}
            onOpenTutorials={() => setIsTutorialsOpen(true)}
            onOpenTelemetry={() => setIsTelemetryOpen(!isTelemetryOpen)}
            isTelemetryOpen={isTelemetryOpen}
          />
        )}

        {/* Center Canvas Area: 2D Canvas OR 3D Isometric View */}
        <main className="flex-1 relative h-full bg-[#0F172A] overflow-hidden">
          {is3DMode ? (
            <Isometric3DView
              nodes={nodes}
              links={links}
              submeshes={submeshes}
              activePackets={activePackets}
            />
          ) : (
            <TopologyCanvas
              nodes={nodes}
              links={links}
              submeshes={submeshes}
              activePackets={activePackets}
              selectedNodeId={selectedNodeId}
              selectedLinkId={selectedLinkId}
              onSelectNode={(id) => {
                setSelectedNodeId(id);
                setSelectedLinkId(null);
              }}
              onSelectLink={(id) => {
                setSelectedLinkId(id);
                setSelectedNodeId(null);
              }}
              onMoveNode={handleMoveNode}
            />
          )}

          {/* Floating Telemetry Analytics Overlay */}
          <TelemetryDashboard
            metrics={engine.metrics}
            isOpen={isTelemetryOpen}
            onClose={() => setIsTelemetryOpen(false)}
          />
        </main>

        {/* Right Inspector Panel */}
        <RightInspector
          nodes={nodes}
          links={links}
          submeshes={submeshes}
          selectedNode={selectedNode}
          selectedLink={selectedLink}
          translationTraces={engine.translationTraces}
          onUpdateNode={(n) => {
            engine.nodes.set(n.id, n);
            engine.refreshLinkProperties();
            syncState();
          }}
          onUpdateLink={(l) => {
            const idx = engine.links.findIndex(lnk => lnk.id === l.id);
            if (idx >= 0) engine.links[idx] = l;
            syncState();
          }}
          onInjectPacket={handleInjectPacket}
          onToggleKillNode={(nodeId) => {
            engine.toggleKillNode(nodeId);
            syncState();
          }}
          onToggleSeverLink={(linkId) => {
            engine.toggleSeverLink(linkId);
            syncState();
          }}
          onToggleJamFrequency={(band) => {
            engine.toggleJamFrequency(band);
            syncState();
          }}
        />
      </div>

      {/* Bottom Timeline Media Player */}
      <BottomTimeline
        isRunning={isRunning}
        simTimeMs={simTimeMs}
        speedMultiplier={speedMultiplier}
        logs={engine.logs}
        onTogglePlay={handleTogglePlay}
        onStepForward={handleStepForward}
        onReset={handleReset}
        onChangeSpeed={handleChangeSpeed}
        onExportJSON={handleExportJSON}
      />

      {/* Classroom Pedagogy Modal */}
      <LessonsModal
        isOpen={isTutorialsOpen}
        onClose={() => setIsTutorialsOpen(false)}
        onRunLessonExperiment={handleRunLessonExperiment}
      />
    </div>
  );
}
