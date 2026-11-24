/**
 * PathPickerHUD — Multi-Mesh Auto-Pathfinding & Route Inspector HUD
 * Sleek tactile Cyber-Physical Lab neomorphic floating panel for canvas
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Route,
  ArrowRight,
  ArrowRightLeft,
  Zap,
  Activity,
  Layers,
  Clock,
  Radio,
  Sliders,
  ChevronDown,
  ChevronUp,
  X,
  AlertTriangle,
  CheckCircle2,
  Send,
  Eye,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { MeshNode, NetworkLink, ProtocolType, SubMeshDomain } from '../../types/simulator';
import { calculateMultiMeshRoute, MultiMeshRouteResult } from '../../core/protocols/routing';

interface Props {
  nodes: MeshNode[];
  links: NetworkLink[];
  submeshes: SubMeshDomain[];
  selectedNodeId?: string | null;
  activeRoutePath?: string[] | null;
  onHighlightRoute?: (path: string[] | null) => void;
  onTransmitPacket?: (sourceId: string, destId: string, payload: string) => void;
  className?: string;
}

export const PathPickerHUD: React.FC<Props> = ({
  nodes,
  links,
  submeshes,
  selectedNodeId,
  activeRoutePath,
  onHighlightRoute,
  onTransmitPacket,
  className = ''
}) => {
  const [sourceId, setSourceId] = useState<string>('');
  const [destId, setDestId] = useState<string>('');
  const [payloadType, setPayloadType] = useState<string>('IoT Sensor Telemetry (512 B)');
  const [routeResult, setRouteResult] = useState<MultiMeshRouteResult | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [showSegmentDetails, setShowSegmentDetails] = useState<boolean>(false);
  const [transmissionFeedback, setTransmissionFeedback] = useState<string | null>(null);

  const aliveNodes = useMemo(() => nodes.filter(n => n.isAlive), [nodes]);

  // Set default initial source and destination if unselected
  useEffect(() => {
    if (!sourceId && aliveNodes.length > 0) {
      // Pick first node as source
      setSourceId(aliveNodes[0].id);
    }
    if (!destId && aliveNodes.length > 1) {
      // Pick a node in another submesh or the last node
      const otherSubmeshNode = aliveNodes.find(n => n.submeshId !== aliveNodes[0]?.submeshId);
      setDestId(otherSubmeshNode ? otherSubmeshNode.id : aliveNodes[aliveNodes.length - 1].id);
    }
  }, [aliveNodes]);

  // Listen to canvas Shift-Click or selection to quickly populate source / destination
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && selectedNodeId) {
        if (!sourceId || sourceId === selectedNodeId) {
          setSourceId(selectedNodeId);
        } else if (destId !== selectedNodeId) {
          setDestId(selectedNodeId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, sourceId, destId]);

  // Handle Find Best Route
  const handleCalculateRoute = () => {
    if (!sourceId || !destId) return;

    const result = calculateMultiMeshRoute(sourceId, destId, nodes, links, submeshes);
    setRouteResult(result);

    if (result.found && onHighlightRoute) {
      onHighlightRoute(result.path);
    }
  };

  // Handle Swap
  const handleSwap = () => {
    const temp = sourceId;
    setSourceId(destId);
    setDestId(temp);
    setRouteResult(null);
    if (onHighlightRoute) onHighlightRoute(null);
  };

  // Handle Transmit
  const handleTransmit = () => {
    if (!sourceId || !destId || !onTransmitPacket) return;

    onTransmitPacket(sourceId, destId, payloadType);
    setTransmissionFeedback(`Dispatched ${payloadType.split(' ')[0]} to route!`);
    setTimeout(() => setTransmissionFeedback(null), 3000);
  };

  // Helper to get submesh for node
  const getSubmeshForNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;
    return submeshes.find(s => s.id === node.submeshId) || null;
  };

  const sourceNode = nodes.find(n => n.id === sourceId);
  const destNode = nodes.find(n => n.id === destId);
  const sourceSm = getSubmeshForNode(sourceId);
  const destSm = getSubmeshForNode(destId);

  return (
    <div
      className={`absolute z-30 transition-all duration-300 font-sans select-none ${
        isMinimized ? 'w-auto' : 'w-80 md:w-96'
      } ${className}`}
      style={{
        filter: 'drop-shadow(0 12px 24px rgba(0, 0, 0, 0.45))'
      }}
    >
      {/* Neomorphic Card Frame */}
      <div
        className="rounded-2xl border border-slate-700/60 overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #181E2B, #121620)',
          boxShadow: '8px 8px 18px #0b0e15, -6px -6px 14px #1e2637'
        }}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Route className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-100 flex items-center space-x-1.5">
                <span>Multi-Mesh Path Finder</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  MRMC
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Auto-Pathfinding & Metric Optimization
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {selectedNodeId && (
              <button
                onClick={() => {
                  if (!sourceId || (sourceId && destId)) {
                    setSourceId(selectedNodeId);
                    setDestId('');
                  } else {
                    setDestId(selectedNodeId);
                  }
                }}
                title="Use selected node from canvas"
                className="px-2 py-1 rounded-md text-[10px] bg-slate-800/80 hover:bg-slate-700 text-sky-300 border border-slate-700"
              >
                Use Selection
              </button>
            )}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
              title={isMinimized ? 'Expand HUD' : 'Collapse HUD'}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Content Body */}
        {!isMinimized && (
          <div className="p-4 space-y-3.5 max-h-[82vh] overflow-y-auto custom-scrollbar">
            {/* Node Selection Grid */}
            <div className="space-y-2">
              {/* Source Selector */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">
                  <span className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    <span>Source Node</span>
                  </span>
                  {sourceSm && (
                    <span
                      className="px-1.5 py-0.2 rounded font-mono text-[9px]"
                      style={{ color: sourceSm.color, backgroundColor: `${sourceSm.color}15` }}
                    >
                      {sourceSm.name} ({sourceSm.protocol})
                    </span>
                  )}
                </div>
                <select
                  value={sourceId}
                  onChange={e => {
                    setSourceId(e.target.value);
                    setRouteResult(null);
                  }}
                  className="w-full bg-[#0E121A] border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                  style={{
                    boxShadow: 'inset 2px 2px 6px #090c12, inset -2px -2px 6px #161b26'
                  }}
                >
                  <option value="">Select source node...</option>
                  {aliveNodes.map(n => {
                    const sm = submeshes.find(s => s.id === n.submeshId);
                    return (
                      <option key={n.id} value={n.id}>
                        {n.name} [{sm?.name || 'Mesh'} / {sm?.protocol || 'HWMP'}] {n.type === 'gateway' ? '⟡ GW' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Swap Button Divider */}
              <div className="flex items-center justify-center -my-1 relative z-10">
                <button
                  onClick={handleSwap}
                  title="Swap Source and Destination"
                  className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition shadow-md active:scale-95"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Destination Selector */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">
                  <span className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
                    <span>Destination Node</span>
                  </span>
                  {destSm && (
                    <span
                      className="px-1.5 py-0.2 rounded font-mono text-[9px]"
                      style={{ color: destSm.color, backgroundColor: `${destSm.color}15` }}
                    >
                      {destSm.name} ({destSm.protocol})
                    </span>
                  )}
                </div>
                <select
                  value={destId}
                  onChange={e => {
                    setDestId(e.target.value);
                    setRouteResult(null);
                  }}
                  className="w-full bg-[#0E121A] border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                  style={{
                    boxShadow: 'inset 2px 2px 6px #090c12, inset -2px -2px 6px #161b26'
                  }}
                >
                  <option value="">Select destination node...</option>
                  {aliveNodes
                    .filter(n => n.id !== sourceId)
                    .map(n => {
                      const sm = submeshes.find(s => s.id === n.submeshId);
                      return (
                        <option key={n.id} value={n.id}>
                          {n.name} [{sm?.name || 'Mesh'} / {sm?.protocol || 'HWMP'}] {n.type === 'gateway' ? '⟡ GW' : ''}
                        </option>
                      );
                    })}
                </select>
              </div>
            </div>

            {/* Action Button: Find Best Route */}
            <button
              disabled={!sourceId || !destId || sourceId === destId}
              onClick={handleCalculateRoute}
              className="w-full py-2.5 rounded-xl text-white font-semibold text-xs transition-all flex items-center justify-center space-x-2 border disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(145deg, #1E3A8A, #1D4ED8)',
                borderColor: '#3B82F6',
                boxShadow: '3px 3px 8px #0d121c, -3px -3px 8px #1f2a3e'
              }}
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Compute Optimal Multi-Mesh Route</span>
            </button>

            {/* Error Display if route calculation failed */}
            {routeResult && !routeResult.found && (
              <div className="p-3 rounded-xl bg-red-950/30 border border-red-900/50 text-red-300 text-xs flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <span>{routeResult.error || 'No viable route could be computed between nodes.'}</span>
              </div>
            )}

            {/* Route Output Card & Metrics Grid */}
            {routeResult && routeResult.found && (
              <div className="space-y-3 pt-1">
                {/* Route Path Flow Visualization */}
                <div
                  className="p-3 rounded-xl border border-slate-700/50 bg-[#10141D]"
                  style={{
                    boxShadow: 'inset 2px 2px 6px #0a0d13, inset -2px -2px 6px #161c28'
                  }}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2">
                    <span className="font-semibold uppercase tracking-wider text-slate-300">
                      Computed Multi-Hop Path
                    </span>
                    <span className="font-mono text-cyan-400">
                      {routeResult.isCrossDomain ? '⚡ Multi-Domain Bridged' : '✓ Intra-Domain'}
                    </span>
                  </div>

                  {/* Horizontal Scroll Node Chain */}
                  <div className="flex items-center space-x-1.5 overflow-x-auto custom-scrollbar pb-1 text-xs font-mono">
                    {routeResult.nodesTraversed.map((n, idx) => {
                      const isSrc = idx === 0;
                      const isDst = idx === routeResult.nodesTraversed.length - 1;
                      const isGw = n.type === 'gateway';
                      const sm = submeshes.find(s => s.id === n.submeshId);

                      return (
                        <React.Fragment key={n.id}>
                          {idx > 0 && <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />}
                          <div
                            className={`px-2 py-1 rounded-lg shrink-0 border flex items-center space-x-1 ${
                              isGw
                                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                                : isSrc
                                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                                : isDst
                                ? 'bg-sky-950/40 border-sky-500/50 text-sky-300'
                                : 'bg-slate-800/60 border-slate-700 text-slate-300'
                            }`}
                          >
                            {isGw && <span className="text-[10px] text-amber-400">⟡</span>}
                            <span>{n.name}</span>
                            <span className="text-[9px] opacity-70">[{sm?.protocol || 'M'}]</span>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* 4-Stat Primary Metric Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Metric 1: Total Hops */}
                  <div
                    className="p-2.5 rounded-xl border border-slate-700/40 bg-slate-900/60 flex items-center space-x-2.5"
                    style={{
                      boxShadow: '3px 3px 8px #0b0e14, -3px -3px 8px #19212f'
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                      <Route className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Total Hops</div>
                      <div className="text-sm font-bold font-mono text-slate-100">
                        {routeResult.hops} <span className="text-[10px] font-normal text-slate-400">hops</span>
                      </div>
                    </div>
                  </div>

                  {/* Metric 2: Sub-Meshes Traversed */}
                  <div
                    className="p-2.5 rounded-xl border border-slate-700/40 bg-slate-900/60 flex items-center space-x-2.5"
                    style={{
                      boxShadow: '3px 3px 8px #0b0e14, -3px -3px 8px #19212f'
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Sub-Meshes</div>
                      <div className="text-sm font-bold font-mono text-slate-100">
                        {routeResult.submeshesTraversed.length}{' '}
                        <span className="text-[10px] font-normal text-slate-400">
                          {routeResult.submeshesTraversed.length === 1 ? 'domain' : 'domains'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Metric 3: Estimated Latency */}
                  <div
                    className="p-2.5 rounded-xl border border-slate-700/40 bg-slate-900/60 flex items-center space-x-2.5"
                    style={{
                      boxShadow: '3px 3px 8px #0b0e14, -3px -3px 8px #19212f'
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Est. Latency</div>
                      <div className="text-sm font-bold font-mono text-purple-300">
                        {routeResult.estimatedLatencyMs} <span className="text-[10px] font-normal">ms</span>
                      </div>
                    </div>
                  </div>

                  {/* Metric 4: Bottleneck Link SNR */}
                  <div
                    className="p-2.5 rounded-xl border border-slate-700/40 bg-slate-900/60 flex items-center space-x-2.5"
                    style={{
                      boxShadow: '3px 3px 8px #0b0e14, -3px -3px 8px #19212f'
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Bottleneck SNR</div>
                      <div className="text-sm font-bold font-mono text-amber-300">
                        {routeResult.bottleneckSnrDb} <span className="text-[10px] font-normal">dB</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Path Metric Cost Breakdown Box */}
                <div className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400">Metric Cost </span>
                    <span className="font-bold text-sky-300">C = {routeResult.metricCost}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 space-x-2">
                    <span>Rate: {routeResult.costBreakdown.rateCost}</span>
                    <span>•</span>
                    <span>Hops: {routeResult.costBreakdown.hopCost}</span>
                    {routeResult.costBreakdown.gatewayCost > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-amber-400">GW: {routeResult.costBreakdown.gatewayCost}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Toggle Hop Segment Details */}
                <div>
                  <button
                    onClick={() => setShowSegmentDetails(!showSegmentDetails)}
                    className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 py-1"
                  >
                    <span>Hop-by-Hop Physical & Protocol Breakdown</span>
                    {showSegmentDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showSegmentDetails && (
                    <div className="mt-1 space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                      {routeResult.segmentTraces.map((seg, i) => (
                        <div
                          key={i}
                          className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[10px] font-mono space-y-1"
                        >
                          <div className="flex items-center justify-between text-slate-300">
                            <span className="font-semibold">
                              Hop #{seg.segmentIndex}: {seg.fromNodeName} → {seg.toNodeName}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] ${
                                seg.type === 'gateway_transition'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-blue-500/20 text-blue-300'
                              }`}
                            >
                              {seg.type === 'gateway_transition' ? 'MRMC GATEWAY' : seg.protocol}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-400 text-[9px]">
                            <span>BW: {seg.bandwidthMbps} Mbps</span>
                            <span>Dist: {seg.distanceMeters}m</span>
                            <span>SNR: {seg.snrDb} dB</span>
                            <span>Hop Delay: {seg.hopDelayMs}ms</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Transmit Section */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Simulate Packet Transmission
                  </div>

                  <select
                    value={payloadType}
                    onChange={e => setPayloadType(e.target.value)}
                    className="w-full bg-[#0E121A] border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-mono"
                    style={{
                      boxShadow: 'inset 2px 2px 6px #090c12, inset -2px -2px 6px #161b26'
                    }}
                  >
                    <option>IoT Sensor Telemetry (512 B)</option>
                    <option>Video Stream Keyframe (4 KB)</option>
                    <option>VoIP Audio Frame (160 B)</option>
                    <option>HTTP REST Payload (1 KB)</option>
                    <option>Critical SCADA Control Alarm (64 B)</option>
                  </select>

                  <button
                    onClick={handleTransmit}
                    className="w-full py-2.5 rounded-xl text-white font-semibold text-xs transition-all flex items-center justify-center space-x-2 border"
                    style={{
                      background: 'linear-gradient(145deg, #059669, #10B981)',
                      borderColor: '#34D399',
                      boxShadow: '3px 3px 8px #0a1310, -3px -3px 8px #132b21'
                    }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Transmit Packet Along Computed Route</span>
                  </button>

                  {transmissionFeedback && (
                    <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-[10px] font-mono flex items-center justify-center space-x-1.5 animate-fade-up">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{transmissionFeedback}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
