import React, { useState } from 'react';
import { Send, ArrowRight, Layers, Radio, Globe, FileJson, Clock, CheckCircle, XCircle, ArrowRightLeft, Zap } from 'lucide-react';
import { MeshNode, Packet, SubMeshDomain } from '../../types/simulator';
import { HeaderTranslationTrace } from '../../core/protocols/gateway';

interface Props {
  nodes: MeshNode[];
  submeshes: SubMeshDomain[];
  activePackets: Packet[];
  translationTraces: HeaderTranslationTrace[];
  onInjectPacket: (src: string, dst: string, payload: string) => void;
}

export const PacketStudioView: React.FC<Props> = ({ nodes, submeshes, activePackets, translationTraces, onInjectPacket }) => {
  const [srcId, setSrcId] = useState('');
  const [dstId, setDstId] = useState('');
  const [payload, setPayload] = useState('IoT Sensor Telemetry (512 B)');
  const aliveNodes = nodes.filter(n => n.isAlive);

  // All packets (active + recent)
  const allPackets = Array.from(activePackets).sort((a, b) => b.createdAtSimTime - a.createdAtSimTime);

  return (
    <div className="w-full h-full flex bg-canvas-deep overflow-hidden">
      {/* Left: Injection Controls & Traces */}
      <div className="w-96 border-r border-slate-800/40 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800/40 space-y-4">
          <div className="flex items-center space-x-2 text-sm font-bold text-slate-100">
            <Send className="w-4 h-4 text-sky-400" /><span>Packet Injector & X-Ray Studio</span>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Source Node</label>
              <select value={srcId} onChange={e => setSrcId(e.target.value)} className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-slate-200">
                <option value="">Select source…</option>
                {aliveNodes.map(n => { const sm = submeshes.find(s => s.id === n.submeshId); return <option key={n.id} value={n.id}>{n.name} [{sm?.protocol}]</option>; })}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Destination Node</label>
              <select value={dstId} onChange={e => setDstId(e.target.value)} className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-slate-200">
                <option value="">Select destination…</option>
                {aliveNodes.filter(n => n.id !== srcId).map(n => { const sm = submeshes.find(s => s.id === n.submeshId); return <option key={n.id} value={n.id}>{n.name} [{sm?.protocol}]</option>; })}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Payload Type</label>
              <select value={payload} onChange={e => setPayload(e.target.value)} className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-slate-200">
                <option>IoT Sensor Telemetry (512 B)</option>
                <option>Video Stream Keyframe (4 KB)</option>
                <option>VoIP Audio Frame (160 B)</option>
                <option>HTTP REST Payload (1 KB)</option>
              </select>
            </div>

            <button disabled={!srcId || !dstId} onClick={() => onInjectPacket(srcId, dstId, payload)}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-30 text-white font-semibold text-xs transition-all flex items-center justify-center space-x-2 shadow-lg shadow-sky-600/20">
              <Send className="w-3.5 h-3.5" /><span>Inject Packet Into Network</span>
            </button>
          </div>
        </div>

        {/* Gateway Translation Traces */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400">
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" /><span>Gateway Protocol Translations ({translationTraces.length})</span>
          </div>

          {translationTraces.length === 0 ? (
            <div className="text-center py-10 text-slate-600 text-xs">Inject a cross-domain packet to observe protocol header translations at boundary gateways.</div>
          ) : (
            translationTraces.slice(0, 10).map((trace, idx) => (
              <div key={idx} className="glass rounded-xl p-3 space-y-2 animate-fade-up">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-amber-400">Gateway: {trace.gatewayId}</span>
                  <span className="font-mono text-slate-500">{trace.timestampSimMs}ms</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="p-2 rounded-lg bg-blue-950/30 border border-blue-900/30 text-blue-300">
                    <div className="font-bold text-[9px] mb-1">INGRESS (Strip)</div>
                    <div>{trace.ingressProtocol}</div>
                    <div>{trace.ingressMac}</div>
                    <div>CH {trace.ingressChannel}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-900/30 text-emerald-300">
                    <div className="font-bold text-[9px] mb-1">EGRESS (Encap)</div>
                    <div>{trace.egressProtocol}</div>
                    <div>{trace.egressMac}</div>
                    <div>CH {trace.egressChannel}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: Packet Journey Timeline */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center space-x-2 text-sm font-bold text-slate-100">
            <Zap className="w-4 h-4 text-purple-400" /><span>Packet Journey Timeline</span>
          </div>

          {allPackets.length === 0 ? (
            <div className="text-center py-20 text-slate-600 text-sm">No packets tracked yet. Use the injector to send a packet through the network.</div>
          ) : (
            allPackets.slice(0, 8).map(pkt => {
              const srcN = nodes.find(n => n.id === pkt.src);
              const dstN = nodes.find(n => n.id === pkt.dst);
              const srcSm = submeshes.find(s => s.id === pkt.submeshSrc);
              const dstSm = submeshes.find(s => s.id === pkt.submeshDst);
              const isCross = pkt.submeshSrc !== pkt.submeshDst;

              return (
                <div key={pkt.id} className="glass rounded-2xl p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-slate-100">{pkt.id}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{srcN?.name} → {dstN?.name} {isCross && '(Cross-Domain)'}</div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold ${
                      pkt.state === 'received' ? 'bg-emerald-500/15 text-emerald-400' : pkt.state === 'dropped' ? 'bg-red-500/15 text-red-400' : 'bg-sky-500/15 text-sky-400 animate-pulse'
                    }`}>
                      {pkt.state === 'received' ? '✓ DELIVERED' : pkt.state === 'dropped' ? '✕ DROPPED' : '◉ IN-FLIGHT'}
                    </span>
                  </div>

                  {/* Hop Path Visualization */}
                  <div className="flex items-center space-x-1 overflow-x-auto custom-scrollbar py-1 text-[10px] font-mono">
                    {pkt.pathTraversed.map((nodeId, i) => {
                      const n = nodes.find(nd => nd.id === nodeId);
                      const isGw = n?.type === 'gateway';
                      const nSm = n ? submeshes.find(s => s.id === n.submeshId) : null;
                      return (
                        <React.Fragment key={i}>
                          {i > 0 && <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />}
                          <div className={`px-2 py-1 rounded-lg whitespace-nowrap border ${
                            isGw ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-slate-900/50 border-slate-800/40 text-slate-300'
                          }`}>
                            {isGw && <span className="text-amber-400 mr-1">⟡</span>}
                            {n?.name || nodeId}
                            {isGw && <span className="text-[8px] text-amber-500 ml-1">[TRANSLATE]</span>}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-4 gap-2 text-[10px]">
                    <div className="p-2 rounded-lg bg-slate-900/40"><span className="text-slate-500 block">Hops</span><span className="font-mono text-slate-200 font-semibold">{pkt.hops}</span></div>
                    <div className="p-2 rounded-lg bg-slate-900/40"><span className="text-slate-500 block">Protocols</span><span className="font-mono text-slate-200 font-semibold">{pkt.protocolTrace.join(' → ')}</span></div>
                    <div className="p-2 rounded-lg bg-slate-900/40"><span className="text-slate-500 block">Latency</span><span className="font-mono text-slate-200 font-semibold">{pkt.deliveredAtSimTime ? `${pkt.deliveredAtSimTime - pkt.createdAtSimTime}ms` : '—'}</span></div>
                    <div className="p-2 rounded-lg bg-slate-900/40"><span className="text-slate-500 block">Size</span><span className="font-mono text-slate-200 font-semibold">{pkt.payloadSizeBytes}B</span></div>
                  </div>

                  {pkt.state === 'dropped' && pkt.dropReason && (
                    <div className="flex items-start space-x-2 p-3 rounded-xl bg-red-950/20 border border-red-900/30 text-[11px] text-red-300">
                      <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{pkt.dropReason}</span>
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

