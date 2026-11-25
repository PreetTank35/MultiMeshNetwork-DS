/**
 * PathPickerHUD — Multi-Mesh Auto-Pathfinding & Route Inspector HUD
 * Tactile neomorphic panel docked cleanly inside the top-left flex column below NetworkBuilderToolbar.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Route,
  ArrowRight,
  ArrowRightLeft,
  Zap,
  Layers,
  Clock,
  Radio,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Send,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { MeshNode, NetworkLink, SubMeshDomain } from '../../types/simulator';
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
  onHighlightRoute,
  onTransmitPacket,
  className = '',
}) => {
  const [sourceId, setSourceId] = useState<string>('');
  const [destId, setDestId] = useState<string>('');
  const [payloadType, setPayloadType] = useState<string>('IoT Sensor Telemetry (512 B)');
  const [routeResult, setRouteResult] = useState<MultiMeshRouteResult | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [showSegmentDetails, setShowSegmentDetails] = useState<boolean>(false);
  const [transmissionFeedback, setTransmissionFeedback] = useState<string | null>(null);

  const aliveNodes = useMemo(() => nodes.filter(n => n.isAlive), [nodes]);

  useEffect(() => {
    if ((!sourceId || !aliveNodes.some(n => n.id === sourceId)) && aliveNodes.length > 0) {
      setSourceId(aliveNodes[0].id);
    }
    if ((!destId || !aliveNodes.some(n => n.id === destId)) && aliveNodes.length > 1) {
      const otherSubmeshNode = aliveNodes.find(n => n.submeshId !== aliveNodes[0]?.submeshId);
      setDestId(otherSubmeshNode ? otherSubmeshNode.id : aliveNodes[aliveNodes.length - 1].id);
    }
  }, [aliveNodes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && selectedNodeId) {
        if (!sourceId || sourceId === selectedNodeId) setSourceId(selectedNodeId);
        else if (destId !== selectedNodeId) setDestId(selectedNodeId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, sourceId, destId]);

  const handleCalculateRoute = () => {
    if (!sourceId || !destId) return;
    const result = calculateMultiMeshRoute(sourceId, destId, nodes, links, submeshes);
    setRouteResult(result);
    if (result.found && onHighlightRoute) onHighlightRoute(result.path);
  };

  const handleSwap = () => {
    const temp = sourceId;
    setSourceId(destId);
    setDestId(temp);
    setRouteResult(null);
    if (onHighlightRoute) onHighlightRoute(null);
  };

  const handleTransmit = () => {
    if (!sourceId || !destId || !onTransmitPacket) return;
    onTransmitPacket(sourceId, destId, payloadType);
    setTransmissionFeedback(`Dispatched ${payloadType.split(' ')[0]} frame`);
    setTimeout(() => setTransmissionFeedback(null), 2800);
  };

  const getSubmeshForNode = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;
    return submeshes.find(s => s.id === node.submeshId) || null;
  };

  const sourceSm = getSubmeshForNode(sourceId);
  const destSm = getSubmeshForNode(destId);

  return (
    <div
      className={`pointer-events-auto transition-all duration-200 font-sans select-none ${
        isMinimized ? 'w-fit' : 'w-[300px]'
      } ${className}`}
    >
      <div className="rounded-2xl neu-convex overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-neu-border">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-xl neu-pressed-sm flex items-center justify-center text-sky-600 dark:text-cyan-400">
              <Route className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-neu-text flex items-center space-x-1.5">
                <span>Path Finder</span>
                <span className="px-1.5 py-0.2 rounded-md text-[9px] font-mono neu-pressed-sm text-sky-600 dark:text-cyan-400 font-bold">
                  MRMC
                </span>
              </div>
              {!isMinimized && (
                <div className="text-[9.5px] text-neu-muted font-mono">
                  Point-to-Point Auto-Routing
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1 ml-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded-lg neu-button-sm text-neu-muted hover:text-neu-text"
              title={isMinimized ? 'Expand Path Finder' : 'Minimize Path Finder'}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Content Body */}
        {!isMinimized && (
          <div className="p-3.5 space-y-3 max-h-[calc(100vh-275px)] overflow-y-auto custom-scrollbar">
            {/* Source Selector */}
            <div>
              <div className="flex items-center justify-between text-[10px] text-neu-muted uppercase tracking-wider mb-1 font-semibold">
                <span className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  <span>Source</span>
                </span>
                {sourceSm && (
                  <span className="font-mono text-[9px] font-bold" style={{ color: sourceSm.color }}>
                    {sourceSm.protocol}
                  </span>
                )}
              </div>
              <select
                value={sourceId}
                onChange={e => { setSourceId(e.target.value); setRouteResult(null); }}
                className="w-full neu-select rounded-xl px-2.5 py-1.5 text-[11px] font-mono focus:outline-none"
              >
                <option value="">Select source node...</option>
                {aliveNodes.map(n => {
                  const sm = submeshes.find(s => s.id === n.submeshId);
                  return (
                    <option key={n.id} value={n.id}>
                      {n.name} [{sm?.protocol || 'M'}]
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Swap Divider */}
            <div className="flex items-center justify-center -my-1 relative z-10">
              <button
                onClick={handleSwap}
                title="Swap Source and Destination"
                className="p-1.5 rounded-full neu-button-sm text-neu-muted hover:text-neu-text"
              >
                <ArrowRightLeft className="w-3 h-3" />
              </button>
            </div>

            {/* Destination Selector */}
            <div>
              <div className="flex items-center justify-between text-[10px] text-neu-muted uppercase tracking-wider mb-1 font-semibold">
                <span className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                  <span>Destination</span>
                </span>
                {destSm && (
                  <span className="font-mono text-[9px] font-bold" style={{ color: destSm.color }}>
                    {destSm.protocol}
                  </span>
                )}
              </div>
              <select
                value={destId}
                onChange={e => { setDestId(e.target.value); setRouteResult(null); }}
                className="w-full neu-select rounded-xl px-2.5 py-1.5 text-[11px] font-mono focus:outline-none"
              >
                <option value="">Select destination node...</option>
                {aliveNodes
                  .filter(n => n.id !== sourceId)
                  .map(n => {
                    const sm = submeshes.find(s => s.id === n.submeshId);
                    return (
                      <option key={n.id} value={n.id}>
                        {n.name} [{sm?.protocol || 'M'}]
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* Action Button: Find Best Route */}
            <button
              disabled={!sourceId || !destId || sourceId === destId}
              onClick={handleCalculateRoute}
              className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all flex items-center justify-center space-x-1.5 shadow-md disabled:opacity-40"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Compute Best Route</span>
            </button>

            {routeResult && !routeResult.found && (
              <div className="p-2.5 rounded-xl neu-pressed text-red-600 dark:text-red-400 text-[11px] flex items-start space-x-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{routeResult.error || 'No viable path between nodes.'}</span>
              </div>
            )}

            {routeResult && routeResult.found && (
              <div className="space-y-2.5 pt-1">
                {/* Route Chain */}
                <div className="p-2.5 rounded-xl neu-pressed space-y-1.5">
                  <div className="flex items-center justify-between text-[9.5px] text-neu-muted">
                    <span className="font-semibold uppercase">Path</span>
                    <span className="font-mono font-bold text-sky-600 dark:text-cyan-400">
                      {routeResult.isCrossDomain ? '⚡ Cross-Domain' : '✓ Intra-Domain'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 overflow-x-auto custom-scrollbar pb-1 text-[10px] font-mono">
                    {routeResult.nodesTraversed.map((n, idx) => {
                      const isGw = n.type === 'gateway';
                      return (
                        <React.Fragment key={n.id}>
                          {idx > 0 && <ArrowRight className="w-2.5 h-2.5 text-neu-muted shrink-0" />}
                          <span
                            className={`px-1.5 py-0.5 rounded-md shrink-0 neu-flat-sm ${
                              isGw ? 'text-amber-600 dark:text-amber-300 font-bold' : 'text-neu-text'
                            }`}
                          >
                            {isGw ? '⟡ ' : ''}{n.name.split(' ')[0]}
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Compact 2x2 Metrics */}
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="p-2 rounded-xl neu-pressed flex items-center space-x-2">
                    <Route className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <div>
                      <div className="text-neu-muted text-[9px]">Hops</div>
                      <div className="font-bold font-mono text-neu-text">{routeResult.hops}</div>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl neu-pressed flex items-center space-x-2">
                    <Layers className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <div>
                      <div className="text-neu-muted text-[9px]">Domains</div>
                      <div className="font-bold font-mono text-neu-text">{routeResult.submeshesTraversed.length}</div>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl neu-pressed flex items-center space-x-2">
                    <Clock className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <div>
                      <div className="text-neu-muted text-[9px]">Latency</div>
                      <div className="font-bold font-mono text-neu-text">{routeResult.estimatedLatencyMs} ms</div>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl neu-pressed flex items-center space-x-2">
                    <Radio className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <div>
                      <div className="text-neu-muted text-[9px]">Min SNR</div>
                      <div className="font-bold font-mono text-neu-text">{routeResult.bottleneckSnrDb} dB</div>
                    </div>
                  </div>
                </div>

                {/* Expandable Segment Details */}
                <button
                  onClick={() => setShowSegmentDetails(!showSegmentDetails)}
                  className="w-full flex items-center justify-between text-[10px] text-neu-muted hover:text-neu-text py-0.5"
                >
                  <span>Hop Breakdown (C = {routeResult.metricCost})</span>
                  {showSegmentDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {showSegmentDetails && (
                  <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                    {routeResult.segmentTraces.map((seg, i) => (
                      <div key={i} className="p-2 rounded-lg neu-pressed text-[9.5px] font-mono">
                        <div className="flex justify-between text-neu-text font-semibold">
                          <span className="truncate">{seg.fromNodeName.split(' ')[0]} → {seg.toNodeName.split(' ')[0]}</span>
                          <span className={seg.type === 'gateway_transition' ? 'text-amber-500' : 'text-sky-500'}>
                            {seg.type === 'gateway_transition' ? 'GATEWAY' : seg.protocol}
                          </span>
                        </div>
                        <div className="text-neu-muted flex justify-between mt-0.5">
                          <span>{seg.bandwidthMbps}Mbps</span>
                          <span>{seg.snrDb}dB</span>
                          <span>{seg.hopDelayMs}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Transmit Controls */}
                <div className="pt-2 border-t border-neu-border space-y-2">
                  <select
                    value={payloadType}
                    onChange={e => setPayloadType(e.target.value)}
                    className="w-full neu-select rounded-xl px-2.5 py-1.5 text-[11px] font-mono focus:outline-none"
                  >
                    <option>IoT Sensor Telemetry (512 B)</option>
                    <option>Video Stream Keyframe (4 KB)</option>
                    <option>VoIP Audio Frame (160 B)</option>
                    <option>HTTP Management REST (1 KB)</option>
                  </select>

                  <button
                    onClick={handleTransmit}
                    className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all flex items-center justify-center space-x-1.5 shadow-md"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Transmit Packet</span>
                  </button>

                  {transmissionFeedback && (
                    <div className="p-1.5 rounded-lg neu-pressed text-emerald-600 dark:text-emerald-400 text-[10px] font-mono flex items-center justify-center space-x-1 animate-fade-up">
                      <CheckCircle2 className="w-3 h-3" />
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
