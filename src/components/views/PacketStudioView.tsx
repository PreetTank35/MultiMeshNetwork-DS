import React, { useState, useMemo } from 'react';
import {
  Send,
  ArrowRight,
  Layers,
  Radio,
  Globe,
  FileJson,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  Zap,
  Route,
  ShieldCheck,
  Server,
  Activity,
  Cpu,
  Eye,
  Sliders,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { MeshNode, NetworkLink, Packet, ProtocolType, SubMeshDomain } from '../../types/simulator';
import {
  HeaderTranslationTrace,
  buildOsiLayerInspection,
  OsiLayerInspection,
  GatewayTranslationStep
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
  links = []
}) => {
  const [srcId, setSrcId] = useState<string>('');
  const [dstId, setDstId] = useState<string>('');
  const [payload, setPayload] = useState<string>('IoT Sensor Telemetry (512 B)');
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null);
  const [selectedTraceIndex, setSelectedTraceIndex] = useState<number | null>(null);
  const [centerTab, setCenterTab] = useState<'osi' | 'gateway_steps'>('osi');
  const [routePreview, setRoutePreview] = useState<MultiMeshRouteResult | null>(null);

  const aliveNodes = useMemo(() => nodes.filter(n => n.isAlive), [nodes]);

  // Set default initial selection
  useMemo(() => {
    if (!srcId && aliveNodes.length > 0) setSrcId(aliveNodes[0].id);
    if (!dstId && aliveNodes.length > 1) {
      const otherSm = aliveNodes.find(n => n.submeshId !== aliveNodes[0]?.submeshId);
      setDstId(otherSm ? otherSm.id : aliveNodes[aliveNodes.length - 1].id);
    }
  }, [aliveNodes, srcId, dstId]);

  // Sort packets: newest first
  const allPackets = useMemo(
    () => Array.from(activePackets).sort((a, b) => b.createdAtSimTime - a.createdAtSimTime),
    [activePackets]
  );

  // Active inspected packet
  const inspectedPacket = useMemo(() => {
    if (selectedPacketId) {
      const p = allPackets.find(pkt => pkt.id === selectedPacketId);
      if (p) return p;
    }
    return allPackets[0] || null;
  }, [selectedPacketId, allPackets]);

  // Selected translation trace
  const activeTrace = useMemo(() => {
    if (selectedTraceIndex !== null && translationTraces[selectedTraceIndex]) {
      return translationTraces[selectedTraceIndex];
    }
    return translationTraces[0] || null;
  }, [selectedTraceIndex, translationTraces]);

  // Handle Calculate Preview Route
  const handlePreviewRoute = () => {
    if (!srcId || !dstId) return;
    const result = calculateMultiMeshRoute(srcId, dstId, nodes, links, submeshes);
    setRoutePreview(result);
  };

  // Generate OSI inspection for current packet
  const osiData: OsiLayerInspection | null = useMemo(() => {
    if (!inspectedPacket) {
      // Fallback: build synthetic inspection from source node if available
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
    <div className="w-full h-full flex flex-col md:flex-row bg-[#0B1019] text-slate-100 overflow-hidden select-none font-sans">
      {/* =========================================================================
          LEFT COLUMN: Packet Injector & Multi-Mesh Route Calculator
         ========================================================================= */}
      <div className="w-full md:w-80 lg:w-96 border-r border-slate-800/80 flex flex-col shrink-0 bg-[#0E131F]/90 overflow-y-auto custom-scrollbar">
        {/* Injector & Path Calculator Header */}
        <div className="p-4 border-b border-slate-800/80 space-y-3.5">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-100">
            <Send className="w-4 h-4 text-sky-400" />
            <span>Packet Studio & Route Pipeline</span>
          </div>

          <div className="space-y-2.5">
            {/* Source Node */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block font-semibold">
                Source Node
              </label>
              <select
                value={srcId}
                onChange={e => {
                  setSrcId(e.target.value);
                  setRoutePreview(null);
                }}
                className="w-full bg-[#131926] border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
              >
                <option value="">Select source…</option>
                {aliveNodes.map(n => {
                  const sm = submeshes.find(s => s.id === n.submeshId);
                  return (
                    <option key={n.id} value={n.id}>
                      {n.name} [{sm?.protocol || 'Mesh'}] {n.type === 'gateway' ? '⟡ GW' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Destination Node */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block font-semibold">
                Destination Node
              </label>
              <select
                value={dstId}
                onChange={e => {
                  setDstId(e.target.value);
                  setRoutePreview(null);
                }}
                className="w-full bg-[#131926] border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
              >
                <option value="">Select destination…</option>
                {aliveNodes
                  .filter(n => n.id !== srcId)
                  .map(n => {
                    const sm = submeshes.find(s => s.id === n.submeshId);
                    return (
                      <option key={n.id} value={n.id}>
                        {n.name} [{sm?.protocol || 'Mesh'}] {n.type === 'gateway' ? '⟡ GW' : ''}
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* Payload Type */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 block font-semibold">
                Payload Type & Size
              </label>
              <select
                value={payload}
                onChange={e => setPayload(e.target.value)}
                className="w-full bg-[#131926] border border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
              >
                <option>IoT Sensor Telemetry (512 B)</option>
                <option>Video Stream Keyframe (4 KB)</option>
                <option>VoIP Audio Frame (160 B)</option>
                <option>HTTP REST Payload (1 KB)</option>
                <option>Critical SCADA Control Alarm (64 B)</option>
              </select>
            </div>

            {/* Buttons Row */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                disabled={!srcId || !dstId}
                onClick={handlePreviewRoute}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-sky-300 font-semibold text-xs transition border border-slate-700 flex items-center justify-center space-x-1.5"
              >
                <Route className="w-3.5 h-3.5" />
                <span>Calc Path</span>
              </button>

              <button
                disabled={!srcId || !dstId}
                onClick={() => onInjectPacket(srcId, dstId, payload)}
                className="py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-30 text-white font-semibold text-xs transition flex items-center justify-center space-x-1.5 shadow-md shadow-sky-600/30"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Inject Packet</span>
              </button>
            </div>

            {/* Route Calculation Result Card */}
            {routePreview && (
              <div className="p-3 rounded-xl bg-[#121824] border border-slate-700/70 space-y-2 text-xs animate-fade-up">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-sky-400">
                    {routePreview.found ? '✓ Optimal Route Calculated' : '✕ Path Calculation Failed'}
                  </span>
                  <span className="font-mono text-slate-400">{routePreview.hops} hops</span>
                </div>

                {routePreview.found ? (
                  <>
                    <div className="flex items-center space-x-1 overflow-x-auto custom-scrollbar pb-1 text-[10px] font-mono">
                      {routePreview.nodesTraversed.map((n, idx) => (
                        <React.Fragment key={n.id}>
                          {idx > 0 && <ArrowRight className="w-2.5 h-2.5 text-slate-600 shrink-0" />}
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              n.type === 'gateway'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {n.name}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-[9px] font-mono text-slate-400 pt-1 border-t border-slate-800">
                      <div>
                        Latency: <span className="text-purple-300 font-bold">{routePreview.estimatedLatencyMs}ms</span>
                      </div>
                      <div>
                        SNR: <span className="text-amber-300 font-bold">{routePreview.bottleneckSnrDb}dB</span>
                      </div>
                      <div>
                        Cost: <span className="text-sky-300 font-bold">C={routePreview.metricCost}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] text-red-400">{routePreview.error}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Gateway Translation Traces Feed */}
        <div className="p-4 space-y-2.5 flex-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center space-x-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
              <span>Gateway Translations ({translationTraces.length})</span>
            </span>
          </div>

          {translationTraces.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Inject a cross-submesh packet to observe boundary gateway translation traces.
            </div>
          ) : (
            translationTraces.slice(0, 15).map((trace, idx) => {
              const isSelected = activeTrace === trace;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedTraceIndex(idx);
                    setCenterTab('gateway_steps');
                  }}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-900/20'
                      : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] mb-1.5">
                    <span className="font-bold text-amber-400">Gateway: {trace.gatewayId}</span>
                    <span className="font-mono text-slate-500">{trace.timestampSimMs}ms</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-[10px] font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-800/40 text-blue-300">
                      {trace.ingressProtocol}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300">
                      {trace.egressProtocol}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* =========================================================================
          CENTER COLUMN: Deep OSI 5-Layer Inspection & Gateway Translation Pipeline
         ========================================================================= */}
      <div className="flex-1 flex flex-col border-r border-slate-800/80 overflow-hidden bg-[#0D121C]">
        {/* Top Segment Tabs */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCenterTab('osi')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                centerTab === 'osi'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>OSI 5-Layer Stack Inspection</span>
            </button>

            <button
              onClick={() => setCenterTab('gateway_steps')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                centerTab === 'gateway_steps'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Gateway Header Translation Pipeline</span>
            </button>
          </div>

          {inspectedPacket && (
            <div className="text-xs font-mono text-slate-400 flex items-center space-x-2">
              <span className="text-slate-500">Packet:</span>
              <span className="font-bold text-sky-400">{inspectedPacket.id}</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-300">
                Hop #{inspectedPacket.hops}
              </span>
            </div>
          )}
        </div>

        {/* Content Pane */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
          {centerTab === 'osi' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              {osiData ? (
                <>
                  {/* Layer 7 Application */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/20 to-slate-900/60 border border-purple-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 text-purple-300 font-bold">
                        <FileJson className="w-4 h-4 text-purple-400" />
                        <span>{osiData.layer7Application.name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-purple-400">Application PDU</span>
                    </div>
                    <div className="bg-[#0A0E17] p-3 rounded-xl border border-slate-800 font-mono text-xs text-purple-200 overflow-x-auto">
                      <code>{osiData.layer7Application.payloadSummary}</code>
                    </div>
                  </div>

                  {/* Layer 4 Transport */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/20 to-slate-900/60 border border-blue-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 text-blue-300 font-bold">
                        <Server className="w-4 h-4 text-blue-400" />
                        <span>{osiData.layer4Transport.name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-blue-400">
                        {osiData.layer4Transport.protocol} Segment
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">SRC PORT</span>
                        <span className="text-blue-300">{osiData.layer4Transport.srcPort}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">DST PORT</span>
                        <span className="text-blue-300">{osiData.layer4Transport.dstPort}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">CHECKSUM</span>
                        <span className="text-blue-300">{osiData.layer4Transport.checksum}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">LENGTH</span>
                        <span className="text-blue-300">{osiData.layer4Transport.payloadSizeBytes} B</span>
                      </div>
                    </div>
                  </div>

                  {/* Layer 3 Network & Routing */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/20 to-slate-900/60 border border-cyan-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 text-cyan-300 font-bold">
                        <Globe className="w-4 h-4 text-cyan-400" />
                        <span>{osiData.layer3Network.name}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {osiData.layer3Network.protocol}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">METRIC COST</span>
                        <span className="text-cyan-300 font-bold">{osiData.layer3Network.routingCostMetric}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">HOPS TRAVERSED</span>
                        <span className="text-cyan-300">{osiData.layer3Network.hopCount}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">TIME-TO-LIVE</span>
                        <span className="text-cyan-300">{osiData.layer3Network.ttl}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">NEXT HOP</span>
                        <span className="text-cyan-300">{osiData.layer3Network.nextHopId || 'Direct'}</span>
                      </div>
                    </div>

                    {/* Protocol-Specific Parameters Box */}
                    <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-900/40 text-[10px] font-mono text-cyan-200">
                      <span className="text-slate-400 block mb-1 uppercase font-bold text-[9px]">
                        {osiData.layer3Network.protocol} Header Parameters:
                      </span>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(osiData.layer3Network.protocolSpecificHeaders).map(([k, v]) => (
                          <div key={k}>
                            <span className="text-slate-400">{k}:</span> <span className="font-bold">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Layer 2 Data Link / MAC */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/20 to-slate-900/60 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 text-emerald-300 font-bold">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>{osiData.layer2DataLink.name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-emerald-400">
                        {osiData.layer2DataLink.frameStandard}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">SOURCE MAC</span>
                        <span className="text-emerald-300 text-[11px]">{osiData.layer2DataLink.sourceMac}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">DESTINATION MAC</span>
                        <span className="text-emerald-300 text-[11px]">{osiData.layer2DataLink.destMac}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">CHANNEL ACCESS</span>
                        <span className="text-emerald-300 text-[11px]">{osiData.layer2DataLink.channelAccess}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">FRAME TYPE</span>
                        <span className="text-emerald-300 text-[11px]">{osiData.layer2DataLink.macFrameType}</span>
                      </div>
                    </div>
                  </div>

                  {/* Layer 1 Physical (PHY) */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/20 to-slate-900/60 border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 text-amber-300 font-bold">
                        <Radio className="w-4 h-4 text-amber-400" />
                        <span>{osiData.layer1Physical.name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-amber-400">
                        {osiData.layer1Physical.frequencyBand} (CH {osiData.layer1Physical.channel})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">MODULATION</span>
                        <span className="text-amber-300">{osiData.layer1Physical.modulation}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">SNR / LINK MARGIN</span>
                        <span className="text-amber-300 font-bold">{osiData.layer1Physical.snrDb} dB</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">PACKET ERROR RATE</span>
                        <span className="text-amber-300">{osiData.layer1Physical.per}%</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-500 block text-[9px]">PROPAGATION DIST</span>
                        <span className="text-amber-300">{osiData.layer1Physical.distanceMeters}m</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-20 text-slate-500 text-sm">
                  Select a packet from the journey timeline to inspect its full 5-layer OSI stack.
                </div>
              )}
            </div>
          )}

          {centerTab === 'gateway_steps' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              {activeTrace ? (
                <>
                  {/* Gateway Overview Header */}
                  <div className="p-4 rounded-2xl bg-[#121826] border border-amber-500/40 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-amber-400 flex items-center space-x-2">
                        <span>Boundary Gateway: {activeTrace.gatewayId}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 border border-amber-500/30">
                          MRMC Cross-Domain Translation
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Sim Time: {activeTrace.timestampSimMs}ms • Multi-Radio Channel Switch: ~3.5ms
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 font-mono text-xs">
                      <span className="px-2 py-1 rounded-lg bg-blue-950/60 border border-blue-800 text-blue-300 font-bold">
                        {activeTrace.ingressProtocol}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                      <span className="px-2 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-bold">
                        {activeTrace.egressProtocol}
                      </span>
                    </div>
                  </div>

                  {/* 4-Step Translation Sequence */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                      <Activity className="w-3.5 h-3.5 text-amber-400" />
                      <span>4-Stage Translation Pipeline Execution</span>
                    </div>

                    {(activeTrace.translationSteps || [
                      {
                        step: 1,
                        name: 'L2 Header Stripping & CRC Check',
                        description: `Validated CRC; removed ingress preamble & 6-address frame control.`,
                        layer: 'L2-MAC',
                        status: 'completed',
                        details: { ingressMac: activeTrace.ingressMac }
                      },
                      {
                        step: 2,
                        name: 'MRMC Dual-Radio Queue Transition',
                        description: `Crossed MRMC bus to channel ${activeTrace.egressChannel}; buffered in egress priority queue.`,
                        layer: 'L1-PHY',
                        status: 'completed',
                        details: { switchTimeMs: 3.5 }
                      },
                      {
                        step: 3,
                        name: 'L3 Protocol Translation & Rank Remap',
                        description: `Mapped ${activeTrace.ingressProtocol} route to ${activeTrace.egressProtocol} routing DAG.`,
                        layer: 'L3-NET',
                        status: 'completed',
                        details: { rplInstance: '0x01' }
                      },
                      {
                        step: 4,
                        name: 'L2 Re-Encapsulation & Channel Scheduling',
                        description: `Synthesized egress MAC ${activeTrace.egressMac}; scheduled for transmission.`,
                        layer: 'L2-MAC',
                        status: 'completed',
                        details: { egressMac: activeTrace.egressMac }
                      }
                    ]).map((step, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3"
                      >
                        <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-mono text-xs font-bold shrink-0">
                          {step.step}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200">{step.name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                              {step.layer}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">{step.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Side-by-Side Header Diff (Raw Headers) */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Side-by-Side Header Structure Comparison
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                      {/* Ingress Header */}
                      <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-900/40 space-y-2">
                        <div className="font-bold text-blue-300 text-xs pb-1 border-b border-blue-900/30 flex items-center justify-between">
                          <span>INGRESS HEADER (Pre-Translation)</span>
                          <span className="text-[9px] text-blue-400">STRIPPED</span>
                        </div>
                        <div className="space-y-1 text-[11px] text-blue-200/90">
                          {Object.entries(activeTrace.rawHeaderBefore).map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                              <span className="text-slate-400">{k}:</span>
                              <span className="font-semibold">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Egress Header */}
                      <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/40 space-y-2">
                        <div className="font-bold text-emerald-300 text-xs pb-1 border-b border-emerald-900/30 flex items-center justify-between">
                          <span>EGRESS HEADER (Post-Translation)</span>
                          <span className="text-[9px] text-emerald-400">ENCAPSULATED</span>
                        </div>
                        <div className="space-y-1 text-[11px] text-emerald-200/90">
                          {Object.entries(activeTrace.rawHeaderAfter).map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                              <span className="text-slate-400">{k}:</span>
                              <span className="font-semibold">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-20 text-slate-500 text-sm">
                  No gateway translation traces recorded yet. Inject a cross-domain packet to populate.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          RIGHT COLUMN: Packet Journey Timeline & Hop State
         ========================================================================= */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col shrink-0 bg-[#0E131F]/90 overflow-y-auto custom-scrollbar">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-100">
            <Zap className="w-4 h-4 text-purple-400" />
            <span>Packet Journey Timeline ({allPackets.length})</span>
          </div>
        </div>

        <div className="p-4 space-y-3.5 flex-1">
          {allPackets.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              No packets in simulation flight. Use the injector on the left to transmit a packet.
            </div>
          ) : (
            allPackets.slice(0, 15).map(pkt => {
              const isSelected = (inspectedPacket?.id === pkt.id);
              const srcN = nodes.find(n => n.id === pkt.src);
              const dstN = nodes.find(n => n.id === pkt.dst);
              const isCross = pkt.submeshSrc !== pkt.submeshDst;

              return (
                <div
                  key={pkt.id}
                  onClick={() => {
                    setSelectedPacketId(pkt.id);
                    setCenterTab('osi');
                  }}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all space-y-2.5 ${
                    isSelected
                      ? 'bg-purple-950/30 border-purple-500/60 shadow-lg shadow-purple-950/30'
                      : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-100 font-mono flex items-center space-x-1.5">
                        <span>{pkt.id}</span>
                        {isCross && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Cross-Domain
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {srcN?.name} → {dstN?.name}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold ${
                        pkt.state === 'received'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : pkt.state === 'dropped'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-sky-500/20 text-sky-400 border border-sky-500/30 animate-pulse'
                      }`}
                    >
                      {pkt.state === 'received'
                        ? '✓ DELIVERED'
                        : pkt.state === 'dropped'
                        ? '✕ DROPPED'
                        : '◉ IN-FLIGHT'}
                    </span>
                  </div>

                  {/* Hop Path Traversal */}
                  <div className="flex items-center space-x-1 overflow-x-auto custom-scrollbar py-0.5 text-[10px] font-mono">
                    {pkt.pathTraversed.map((nodeId, i) => {
                      const n = nodes.find(nd => nd.id === nodeId);
                      const isGw = n?.type === 'gateway';
                      return (
                        <React.Fragment key={i}>
                          {i > 0 && <ArrowRight className="w-2.5 h-2.5 text-slate-600 shrink-0" />}
                          <div
                            className={`px-1.5 py-0.5 rounded whitespace-nowrap border ${
                              isGw
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                                : 'bg-slate-800/80 border-slate-700 text-slate-300'
                            }`}
                          >
                            {isGw && <span className="text-amber-400 mr-1">⟡</span>}
                            {n?.name || nodeId}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Latency & Stats */}
                  <div className="grid grid-cols-3 gap-1 text-[9px] font-mono pt-1 border-t border-slate-800 text-slate-400">
                    <div>
                      Hops: <span className="text-slate-200 font-semibold">{pkt.hops}</span>
                    </div>
                    <div>
                      Protocols: <span className="text-slate-200 font-semibold">{pkt.protocolTrace.join('→')}</span>
                    </div>
                    <div>
                      Latency:{' '}
                      <span className="text-purple-300 font-semibold">
                        {pkt.deliveredAtSimTime ? `${pkt.deliveredAtSimTime - pkt.createdAtSimTime}ms` : '—'}
                      </span>
                    </div>
                  </div>

                  {pkt.state === 'dropped' && pkt.dropReason && (
                    <div className="flex items-start space-x-1.5 p-2 rounded-lg bg-red-950/30 border border-red-900/40 text-[10px] text-red-300 font-mono">
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
    </div>
  );
};
