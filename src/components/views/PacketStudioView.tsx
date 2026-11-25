import React, { useState, useMemo } from 'react';
import {
  Send,
  ArrowRight,
  Layers,
  Radio,
  Globe,
  FileJson,
  XCircle,
  ArrowRightLeft,
  Zap,
  Route,
  ShieldCheck,
  Server,
  Activity,
} from 'lucide-react';
import { MeshNode, NetworkLink, Packet, SubMeshDomain } from '../../types/simulator';
import {
  HeaderTranslationTrace,
  buildOsiLayerInspection,
  OsiLayerInspection,
} from '../../core/protocols/gateway';
import { calculateMultiMeshRoute, MultiMeshRouteResult } from '../../core/protocols/routing';

interface Props {
  nodes: MeshNode[];
  submeshes: SubMeshDomain[];
  activePackets: Packet[];
  translationTraces: HeaderTranslationTrace[];
  onInjectPacket: (src: string, dst: string, payload: string) => void;
  links?: NetworkLink[];
}

export const PacketStudioView: React.FC<Props> = ({
  nodes,
  submeshes,
  activePackets,
  translationTraces,
  onInjectPacket,
  links = [],
}) => {
  const [srcId, setSrcId] = useState<string>('');
  const [dstId, setDstId] = useState<string>('');
  const [payload, setPayload] = useState<string>('IoT Sensor Telemetry (512 B)');
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null);
  const [selectedTraceIndex, setSelectedTraceIndex] = useState<number | null>(null);
  const [centerTab, setCenterTab] = useState<'osi' | 'gateway_steps'>('osi');
  const [routePreview, setRoutePreview] = useState<MultiMeshRouteResult | null>(null);

  const aliveNodes = useMemo(() => nodes.filter(n => n.isAlive), [nodes]);

  useMemo(() => {
    if (!srcId && aliveNodes.length > 0) setSrcId(aliveNodes[0].id);
    if (!dstId && aliveNodes.length > 1) {
      const otherSm = aliveNodes.find(n => n.submeshId !== aliveNodes[0]?.submeshId);
      setDstId(otherSm ? otherSm.id : aliveNodes[aliveNodes.length - 1].id);
    }
  }, [aliveNodes, srcId, dstId]);

  const allPackets = useMemo(
    () => Array.from(activePackets).sort((a, b) => b.createdAtSimTime - a.createdAtSimTime),
    [activePackets]
  );

  const inspectedPacket = useMemo(() => {
    if (selectedPacketId) {
      const p = allPackets.find(pkt => pkt.id === selectedPacketId);
      if (p) return p;
    }
    return allPackets[0] || null;
  }, [selectedPacketId, allPackets]);

  const activeTrace = useMemo(() => {
    if (selectedTraceIndex !== null && translationTraces[selectedTraceIndex]) {
      return translationTraces[selectedTraceIndex];
    }
    return translationTraces[0] || null;
  }, [selectedTraceIndex, translationTraces]);

  const handlePreviewRoute = () => {
    if (!srcId || !dstId) return;
    setRoutePreview(calculateMultiMeshRoute(srcId, dstId, nodes, links, submeshes));
  };

  const osiData: OsiLayerInspection | null = useMemo(() => {
    if (!inspectedPacket) {
      const srcNode = nodes.find(n => n.id === srcId);
      if (!srcNode) return null;
      const sm = submeshes.find(s => s.id === srcNode.submeshId) || null;
      const syntheticPkt: Packet = {
        id: 'PKT-PREVIEW',
        sequenceNum: 1001,
        src: srcNode.id,
        dst: dstId || srcNode.id,
        payload,
        payloadSizeBytes: 512,
        submeshSrc: srcNode.submeshId,
        submeshDst: dstId ? (nodes.find(n => n.id === dstId)?.submeshId || srcNode.submeshId) : srcNode.submeshId,
        currentHop: srcNode.id,
        pathTraversed: [srcNode.id],
        protocolTrace: [sm?.protocol || 'HWMP'],
        hops: 0,
        state: 'queued',
        createdAtSimTime: 0,
      };
      return buildOsiLayerInspection(syntheticPkt, srcNode, null, null, sm);
    }

    const currNode = nodes.find(n => n.id === inspectedPacket.currentHop) || nodes.find(n => n.id === inspectedPacket.src);
    if (!currNode) return null;
    const nextNode = inspectedPacket.nextHop ? nodes.find(n => n.id === inspectedPacket.nextHop) : null;
    const currLink = links.find(
      l => (l.source === currNode.id && l.target === nextNode?.id) || (l.source === nextNode?.id && l.target === currNode.id)
    ) || null;
    const sm = submeshes.find(s => s.id === currNode.submeshId) || null;
    return buildOsiLayerInspection(inspectedPacket, currNode, nextNode || null, currLink, sm);
  }, [inspectedPacket, srcId, dstId, payload, nodes, links, submeshes]);

  return (
    <div className="w-full h-full flex flex-col md:flex-row neu-base text-neu-text overflow-hidden select-none font-sans">
      {/* LEFT COLUMN: Injector & Translations */}
      <div className="w-full md:w-80 lg:w-96 border-r border-neu-border flex flex-col shrink-0 overflow-y-auto custom-scrollbar p-4 gap-4">
        <div className="neu-convex rounded-2xl p-4 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-neu-text">
            <Send className="w-4 h-4 text-blue-600 dark:text-sky-400" />
            <span>Packet Studio & Route Pipeline</span>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="text-[10px] text-neu-muted uppercase tracking-wider mb-1 block font-bold">Source Node</label>
              <select
                value={srcId}
                onChange={e => { setSrcId(e.target.value); setRoutePreview(null); }}
                className="w-full neu-select rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
              >
                <option value="">Select source…</option>
                {aliveNodes.map(n => {
                  const sm = submeshes.find(s => s.id === n.submeshId);
                  return (
                    <option key={n.id} value={n.id}>
                      {n.name} [{sm?.protocol || 'Mesh'}]
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-neu-muted uppercase tracking-wider mb-1 block font-bold">Destination Node</label>
              <select
                value={dstId}
                onChange={e => { setDstId(e.target.value); setRoutePreview(null); }}
                className="w-full neu-select rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
              >
                <option value="">Select destination…</option>
                {aliveNodes.filter(n => n.id !== srcId).map(n => {
                  const sm = submeshes.find(s => s.id === n.submeshId);
                  return (
                    <option key={n.id} value={n.id}>
                      {n.name} [{sm?.protocol || 'Mesh'}]
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-neu-muted uppercase tracking-wider mb-1 block font-bold">Payload Type</label>
              <select
                value={payload}
                onChange={e => setPayload(e.target.value)}
                className="w-full neu-select rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
              >
                <option>IoT Sensor Telemetry (512 B)</option>
                <option>Video Stream Keyframe (4 KB)</option>
                <option>VoIP Audio Frame (160 B)</option>
                <option>HTTP REST Payload (1 KB)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                disabled={!srcId || !dstId}
                onClick={handlePreviewRoute}
                className="py-2 px-3 rounded-xl neu-button text-sky-600 dark:text-sky-300 disabled:opacity-30 font-semibold text-xs flex items-center justify-center space-x-1.5"
              >
                <Route className="w-3.5 h-3.5" />
                <span>Calc Path</span>
              </button>

              <button
                disabled={!srcId || !dstId}
                onClick={() => onInjectPacket(srcId, dstId, payload)}
                className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white font-semibold text-xs flex items-center justify-center space-x-1.5 shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Inject</span>
              </button>
            </div>

            {routePreview && (
              <div className="p-3 rounded-xl neu-pressed space-y-2 text-xs animate-fade-up">
                <div className="flex items-center justify-between text-[10px]">
                  <span className={`font-bold ${routePreview.found ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {routePreview.found ? '✓ Optimal Route' : '✕ No Path'}
                  </span>
                  <span className="font-mono text-neu-muted">{routePreview.hops} hops</span>
                </div>
                {routePreview.found ? (
                  <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono text-neu-muted pt-1">
                    <div>Latency: <strong className="text-neu-text">{routePreview.estimatedLatencyMs}ms</strong></div>
                    <div>SNR: <strong className="text-amber-600 dark:text-amber-400">{routePreview.bottleneckSnrDb}dB</strong></div>
                    <div>Cost: <strong className="text-sky-600 dark:text-cyan-400">C={routePreview.metricCost}</strong></div>
                  </div>
                ) : (
                  <div className="text-[10px] text-red-600 dark:text-red-400">{routePreview.error}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Gateway Translation Feed */}
        <div className="neu-convex rounded-2xl p-4 space-y-3 flex-1">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-neu-text">
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-500" />
            <span>Gateway Translations ({translationTraces.length})</span>
          </div>

          {translationTraces.length === 0 ? (
            <div className="text-center py-8 text-neu-muted text-xs neu-pressed rounded-xl p-3">
              Inject a cross-domain packet to observe boundary gateway header translations.
            </div>
          ) : (
            <div className="space-y-2">
              {translationTraces.slice(0, 15).map((trace, idx) => {
                const isSelected = activeTrace === trace;
                return (
                  <div
                    key={idx}
                    onClick={() => { setSelectedTraceIndex(idx); setCenterTab('gateway_steps'); }}
                    className={`p-3 rounded-xl cursor-pointer transition-all ${
                      isSelected ? 'neu-pressed' : 'neu-button-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="font-bold text-amber-600 dark:text-amber-400">Gateway: {trace.gatewayId}</span>
                      <span className="font-mono text-neu-muted">{trace.timestampSimMs}ms</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-[10px] font-mono">
                      <span className="px-1.5 py-0.5 rounded neu-flat-sm text-blue-600 dark:text-blue-300 font-bold">{trace.ingressProtocol}</span>
                      <ArrowRight className="w-3 h-3 text-neu-muted shrink-0" />
                      <span className="px-1.5 py-0.5 rounded neu-flat-sm text-emerald-600 dark:text-emerald-300 font-bold">{trace.egressProtocol}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CENTER COLUMN: OSI 5-Layer Dissector & Gateway Pipeline */}
      <div className="flex-1 flex flex-col border-r border-neu-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-neu-border">
          <div className="flex items-center space-x-2 neu-pressed p-1 rounded-2xl">
            <button
              onClick={() => setCenterTab('osi')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                centerTab === 'osi' ? 'neu-button text-blue-600 dark:text-sky-300' : 'text-neu-muted hover:text-neu-text'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>OSI 5-Layer Stack</span>
            </button>

            <button
              onClick={() => setCenterTab('gateway_steps')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                centerTab === 'gateway_steps' ? 'neu-button text-amber-600 dark:text-amber-300' : 'text-neu-muted hover:text-neu-text'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Gateway Translation Pipeline</span>
            </button>
          </div>

          {inspectedPacket && (
            <div className="text-xs font-mono text-neu-muted flex items-center space-x-2">
              <span className="font-bold text-blue-600 dark:text-cyan-400">{inspectedPacket.id}</span>
              <span className="px-2 py-0.5 rounded-lg text-[10px] neu-pressed-sm">Hop #{inspectedPacket.hops}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
          {centerTab === 'osi' && osiData && (
            <div className="space-y-4 max-w-3xl mx-auto">
              {/* Layer 7 */}
              <div className="p-4 rounded-2xl neu-convex border-l-4 border-l-purple-500 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-300">
                  <span className="flex items-center space-x-2"><FileJson className="w-4 h-4" /><span>{osiData.layer7Application.name}</span></span>
                  <span className="font-mono text-[10px]">Application PDU</span>
                </div>
                <div className="neu-pressed p-3 rounded-xl font-mono text-xs text-neu-text overflow-x-auto">
                  <code>{osiData.layer7Application.payloadSummary}</code>
                </div>
              </div>

              {/* Layer 4 */}
              <div className="p-4 rounded-2xl neu-convex border-l-4 border-l-blue-500 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-300">
                  <span className="flex items-center space-x-2"><Server className="w-4 h-4" /><span>{osiData.layer4Transport.name}</span></span>
                  <span className="font-mono text-[10px]">{osiData.layer4Transport.protocol} Segment</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl neu-pressed"><span className="text-neu-muted block text-[9px]">SRC PORT</span><span className="font-bold text-neu-text">{osiData.layer4Transport.srcPort}</span></div>
                  <div className="p-2.5 rounded-xl neu-pressed"><span className="text-neu-muted block text-[9px]">DST PORT</span><span className="font-bold text-neu-text">{osiData.layer4Transport.dstPort}</span></div>
                  <div className="p-2.5 rounded-xl neu-pressed"><span className="text-neu-muted block text-[9px]">CHECKSUM</span><span className="font-bold text-neu-text">{osiData.layer4Transport.checksum}</span></div>
                  <div className="p-2.5 rounded-xl neu-pressed"><span className="text-neu-muted block text-[9px]">LENGTH</span><span className="font-bold text-neu-text">{osiData.layer4Transport.payloadSizeBytes} B</span></div>
                </div>
              </div>

              {/* Layer 3 */}
              <div className="p-4 rounded-2xl neu-convex border-l-4 border-l-cyan-500 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-sky-600 dark:text-cyan-300">
                  <span className="flex items-center space-x-2"><Globe className="w-4 h-4" /><span>{osiData.layer3Network.name}</span></span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono neu-pressed-sm">{osiData.layer3Network.protocol}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl neu-pressed"><span className="text-neu-muted block text-[9px]">METRIC</span><span className="font-bold text-neu-text">{osiData.layer3Network.routingCostMetric}</span></div>
                  <div className="p-2.5 rounded-xl neu-pressed"><span className="text-neu-muted block text-[9px]">HOPS</span><span className="font-bold text-neu-text">{osiData.layer3Network.hopCount}</span></div>
                  <div className="p-2.5 rounded-xl neu-pressed"><span className="text-neu-muted block text-[9px]">TTL</span><span className="font-bold text-neu-text">{osiData.layer3Network.ttl}</span></div>
                  <div className="p-2.5 rounded-xl neu-pressed"><span className="text-neu-muted block text-[9px]">NEXT HOP</span><span className="font-bold text-neu-text truncate">{osiData.layer3Network.nextHopId || 'Direct'}</span></div>
                </div>
              </div>

              {/* Layer 2 */}
              <div className="p-4 rounded-2xl neu-convex border-l-4 border-l-emerald-500 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-300">
                  <span className="flex items-center space-x-2"><ShieldCheck className="w-4 h-4" /><span>{osiData.layer2DataLink.name}</span></span>
                  <span className="font-mono text-[10px]">{osiData.layer2DataLink.frameStandard}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl neu-pressed"><span className="text-neu-muted block text-[9px]">SRC MAC</span><span className="text-[10px] font-bold text-neu-text">{osiData.layer2DataLink.sourceMac}</span></div>
                  <div className="p-2.5 rounded-xl neu-pressed"><span className="text-neu-muted block text-[9px]">DST MAC</span><span className="text-[10px] font-bold text-neu-text">{osiData.layer2DataLink.destMac}</span></div>
                  <div className="p-2.5 rounded-xl neu-pressed"><span className="text-neu-muted block text-[9px]">ACCESS</span><span className="text-[10px] font-bold text-neu-text">{osiData.layer2DataLink.channelAccess}</span></div>
                  <div className="p-2.5 rounded-xl neu-pressed"><span className="text-neu-muted block text-[9px]">TYPE</span><span className="text-[10px] font-bold text-neu-text">{osiData.layer2DataLink.macFrameType}</span></div>
                </div>
              </div>

              {/* Layer 1 */}
              <div className="p-4 rounded-2xl neu-convex border-l-4 border-l-amber-500 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-300">
                  <span className="flex items-center space-x-2"><Radio className="w-4 h-4" /><span>{osiData.layer1Physical.name}</span></span>
                  <span className="font-mono text-[10px]">{osiData.layer1Physical.frequencyBand} (CH {osiData.layer1Physical.channel})</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl neu-pressed"><span className="text-neu-muted block text-[9px]">MODULATION</span><span className="font-bold text-neu-text">{osiData.layer1Physical.modulation}</span></div>
                  <div className="p-2.5 rounded-xl neu-pressed"><span className="text-neu-muted block text-[9px]">SNR</span><span className="font-bold text-amber-600 dark:text-amber-300">{osiData.layer1Physical.snrDb} dB</span></div>
                  <div className="p-2.5 rounded-xl neu-pressed"><span className="text-neu-muted block text-[9px]">PER</span><span className="font-bold text-neu-text">{osiData.layer1Physical.per}%</span></div>
                  <div className="p-2.5 rounded-xl neu-pressed"><span className="text-neu-muted block text-[9px]">DIST</span><span className="font-bold text-neu-text">{osiData.layer1Physical.distanceMeters}m</span></div>
                </div>
              </div>
            </div>
          )}

          {centerTab === 'gateway_steps' && (
            <div className="space-y-5 max-w-3xl mx-auto">
              {activeTrace ? (
                <>
                  <div className="p-4 rounded-2xl neu-convex flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                        Boundary Gateway: {activeTrace.gatewayId}
                      </div>
                      <div className="text-[10px] text-neu-muted font-mono mt-0.5">
                        Sim Time: {activeTrace.timestampSimMs}ms • MRMC Radio Retune: ~3.5ms
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 font-mono text-xs">
                      <span className="px-2.5 py-1 rounded-lg neu-pressed text-blue-600 dark:text-blue-300 font-bold">{activeTrace.ingressProtocol}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                      <span className="px-2.5 py-1 rounded-lg neu-pressed text-emerald-600 dark:text-emerald-300 font-bold">{activeTrace.egressProtocol}</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-neu-text uppercase tracking-wider flex items-center space-x-2">
                      <Activity className="w-3.5 h-3.5 text-amber-500" />
                      <span>4-Stage Gateway Translation Pipeline</span>
                    </div>
                    {(activeTrace.translationSteps || []).map((step, idx) => (
                      <div key={idx} className="p-3.5 rounded-2xl neu-convex flex items-start space-x-3">
                        <div className="w-6 h-6 rounded-lg neu-pressed text-amber-600 dark:text-amber-400 flex items-center justify-center font-mono text-xs font-bold shrink-0">
                          {step.step}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neu-text">{step.name}</span>
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-mono neu-pressed-sm text-neu-muted">{step.layer}</span>
                          </div>
                          <div className="text-[11px] text-neu-muted">{step.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-4 rounded-2xl neu-convex space-y-2">
                      <div className="font-bold text-blue-600 dark:text-blue-300 text-xs pb-1 border-b border-neu-border">
                        INGRESS HEADER (STRIPPED)
                      </div>
                      <div className="space-y-1 text-[11px]">
                        {Object.entries(activeTrace.rawHeaderBefore).map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-neu-muted">{k}:</span>
                            <span className="font-bold text-neu-text">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl neu-convex space-y-2">
                      <div className="font-bold text-emerald-600 dark:text-emerald-300 text-xs pb-1 border-b border-neu-border">
                        EGRESS HEADER (ENCAPSULATED)
                      </div>
                      <div className="space-y-1 text-[11px]">
                        {Object.entries(activeTrace.rawHeaderAfter).map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-neu-muted">{k}:</span>
                            <span className="font-bold text-neu-text">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-20 text-neu-muted text-sm">
                  No gateway translation traces recorded yet. Inject a cross-domain packet to populate.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Packet Journey Timeline */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col shrink-0 overflow-y-auto custom-scrollbar p-4 gap-3">
        <div className="flex items-center space-x-2 text-xs font-bold text-neu-text px-1">
          <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span>Packet Journey Timeline ({allPackets.length})</span>
        </div>

        {allPackets.length === 0 ? (
          <div className="text-center py-16 text-neu-muted text-xs neu-pressed rounded-2xl p-4">
            No packets in flight. Use the injector on the left to transmit a packet.
          </div>
        ) : (
          allPackets.slice(0, 15).map(pkt => {
            const isSelected = inspectedPacket?.id === pkt.id;
            const srcN = nodes.find(n => n.id === pkt.src);
            const dstN = nodes.find(n => n.id === pkt.dst);
            return (
              <div
                key={pkt.id}
                onClick={() => { setSelectedPacketId(pkt.id); setCenterTab('osi'); }}
                className={`p-3.5 rounded-2xl cursor-pointer transition-all space-y-2 ${
                  isSelected ? 'neu-pressed' : 'neu-convex-sm'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-neu-text font-mono">{pkt.id}</div>
                    <div className="text-[10px] text-neu-muted font-mono">
                      {srcN?.name} → {dstN?.name}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold neu-pressed-sm ${
                      pkt.state === 'received' ? 'text-emerald-600 dark:text-emerald-400'
                      : pkt.state === 'dropped' ? 'text-red-600 dark:text-red-400'
                      : 'text-sky-600 dark:text-cyan-400'
                    }`}
                  >
                    {pkt.state.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 text-[9.5px] font-mono pt-1 border-t border-neu-border text-neu-muted">
                  <div>Hops: <strong className="text-neu-text">{pkt.hops}</strong></div>
                  <div>Proto: <strong className="text-neu-text">{pkt.protocolTrace.join('→')}</strong></div>
                  <div>Latency: <strong className="text-sky-600 dark:text-cyan-400">{pkt.deliveredAtSimTime ? `${pkt.deliveredAtSimTime - pkt.createdAtSimTime}ms` : '—'}</strong></div>
                </div>

                {pkt.state === 'dropped' && pkt.dropReason && (
                  <div className="flex items-start space-x-1.5 p-2 rounded-lg neu-pressed text-[10px] text-red-600 dark:text-red-400 font-mono">
                    <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{pkt.dropReason}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
