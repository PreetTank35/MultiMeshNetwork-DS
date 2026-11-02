/**
 * Right Inspector Panel
 * Features 4 Tabbed Workspaces:
 * [Properties] [Packet Injector] [Fault Studio] [Gateway Translation]
 */

import React, { useState } from 'react';
import {
  Sliders,
  Send,
  Zap,
  ArrowRightLeft,
  Trash2,
  AlertTriangle,
  Radio,
  CheckCircle2,
  XCircle,
  Wifi,
  Layers,
  ShieldAlert
} from 'lucide-react';
import { MeshNode, NetworkLink, SubMeshDomain } from '../../types/simulator';
import { HeaderTranslationTrace } from '../../core/protocols/gateway';

interface RightInspectorProps {
  nodes: MeshNode[];
  links: NetworkLink[];
  submeshes: SubMeshDomain[];
  selectedNode: MeshNode | null;
  selectedLink: NetworkLink | null;
  translationTraces: HeaderTranslationTrace[];
  onUpdateNode: (node: MeshNode) => void;
  onUpdateLink: (link: NetworkLink) => void;
  onInjectPacket: (sourceId: string, targetId: string, payload: string) => void;
  onToggleKillNode: (nodeId: string) => void;
  onToggleSeverLink: (linkId: string) => void;
  onToggleJamFrequency: (band: string) => void;
}

export const RightInspector: React.FC<RightInspectorProps> = ({
  nodes,
  links,
  submeshes,
  selectedNode,
  selectedLink,
  translationTraces,
  onUpdateNode,
  onUpdateLink,
  onInjectPacket,
  onToggleKillNode,
  onToggleSeverLink,
  onToggleJamFrequency
}) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'injector' | 'faults' | 'gateway'>('injector');

  // Injector state
  const [injectSourceId, setInjectSourceId] = useState<string>(nodes[0]?.id || '');
  const [injectTargetId, setInjectTargetId] = useState<string>(nodes[nodes.length - 1]?.id || '');
  const [payloadType, setPayloadType] = useState<string>('Sensor Telemetry (JSON)');

  return (
    <aside className="w-80 bg-[#1E293B]/95 backdrop-blur-md border-l border-slate-700/60 flex flex-col h-full z-10 text-slate-200 select-none">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-700/60 bg-[#0F172A]/70 p-1">
        <button
          onClick={() => setActiveTab('properties')}
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-all flex items-center justify-center space-x-1 ${
            activeTab === 'properties' ? 'bg-slate-800 text-sky-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Properties</span>
        </button>

        <button
          onClick={() => setActiveTab('injector')}
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-all flex items-center justify-center space-x-1 ${
            activeTab === 'injector' ? 'bg-slate-800 text-sky-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Injector</span>
        </button>

        <button
          onClick={() => setActiveTab('faults')}
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-all flex items-center justify-center space-x-1 ${
            activeTab === 'faults' ? 'bg-slate-800 text-red-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Faults</span>
        </button>

        <button
          onClick={() => setActiveTab('gateway')}
          className={`flex-1 py-1.5 text-xs font-medium rounded transition-all flex items-center justify-center space-x-1 ${
            activeTab === 'gateway' ? 'bg-slate-800 text-amber-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>Gateway</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
        {/* TAB 1: PROPERTIES INSPECTOR */}
        {activeTab === 'properties' && (
          <div className="space-y-4">
            {selectedNode ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-sky-400" />
                    <span className="font-bold text-sm text-slate-100">{selectedNode.name}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${selectedNode.isAlive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {selectedNode.isAlive ? 'ONLINE' : 'DEAD'}
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Sub-Mesh Domain</label>
                    <select
                      value={selectedNode.submeshId}
                      onChange={(e) => onUpdateNode({ ...selectedNode, submeshId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                    >
                      {submeshes.map(sm => (
                        <option key={sm.id} value={sm.id}>{sm.name} ({sm.protocol})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">TX Power: {selectedNode.txPowerDbm} dBm</label>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      value={selectedNode.txPowerDbm}
                      onChange={(e) => onUpdateNode({ ...selectedNode, txPowerDbm: Number(e.target.value) })}
                      className="w-full accent-sky-400"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Queue Capacity: {selectedNode.queueCapacity} pkts</label>
                    <input
                      type="range"
                      min="8"
                      max="256"
                      step="8"
                      value={selectedNode.queueCapacity}
                      onChange={(e) => onUpdateNode({ ...selectedNode, queueCapacity: Number(e.target.value) })}
                      className="w-full accent-sky-400"
                    />
                  </div>

                  {/* Network Interfaces */}
                  <div className="pt-2">
                    <span className="text-slate-400 block mb-1 font-medium">Physical NIC Radios ({selectedNode.interfaces.length})</span>
                    <div className="space-y-1">
                      {selectedNode.interfaces.map(iface => (
                        <div key={iface.id} className="p-2 rounded bg-slate-900/80 border border-slate-800 text-[11px] font-mono">
                          <div className="flex justify-between text-sky-300">
                            <span>{iface.type.toUpperCase()} NIC</span>
                            <span>{iface.frequencyBand}</span>
                          </div>
                          <div className="text-slate-400 text-[10px] mt-0.5">
                            MAC: {iface.mac} • Ch: {iface.channel}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedLink ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                  <span className="font-bold text-sm text-slate-100">Physical Link</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${selectedLink.isSevered ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {selectedLink.isSevered ? 'SEVERED' : 'ACTIVE'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block">Distance</span>
                    <span className="font-mono text-sky-400 text-sm font-semibold">{selectedLink.distanceMeters.toFixed(1)} m</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block">Bandwidth</span>
                    <span className="font-mono text-emerald-400 text-sm font-semibold">{selectedLink.bandwidthMbps} Mbps</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block">SNR</span>
                    <span className="font-mono text-amber-400 text-sm font-semibold">{selectedLink.snrDb.toFixed(1)} dB</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block">Packet Error Rate</span>
                    <span className="font-mono text-red-400 text-sm font-semibold">{(selectedLink.lossRate * 100).toFixed(1)}%</span>
                  </div>
                </div>

                <button
                  onClick={() => onToggleSeverLink(selectedLink.id)}
                  className={`w-full py-2 px-3 rounded text-xs font-semibold transition-all ${
                    selectedLink.isSevered ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'
                  }`}
                >
                  {selectedLink.isSevered ? 'Restore Link Connection' : 'Sever Link Connection'}
                </button>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500">
                <Sliders className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Click on any node or link on the canvas to inspect its physical parameters.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PACKET INJECTOR & TRACER */}
        {activeTab === 'injector' && (
          <div className="space-y-4">
            <div>
              <span className="font-semibold text-slate-300 block mb-1">Source Node (Origin)</span>
              <select
                value={injectSourceId}
                onChange={(e) => setInjectSourceId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
              >
                {nodes.filter(n => n.isAlive).map(n => {
                  const sm = submeshes.find(s => s.id === n.submeshId);
                  return (
                    <option key={n.id} value={n.id}>
                      {n.name} [{sm?.protocol || 'Node'}]
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <span className="font-semibold text-slate-300 block mb-1">Destination Node (Target)</span>
              <select
                value={injectTargetId}
                onChange={(e) => setInjectTargetId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
              >
                {nodes.filter(n => n.isAlive).map(n => {
                  const sm = submeshes.find(s => s.id === n.submeshId);
                  return (
                    <option key={n.id} value={n.id}>
                      {n.name} [{sm?.protocol || 'Node'}]
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <span className="font-semibold text-slate-300 block mb-1">Payload Type</span>
              <select
                value={payloadType}
                onChange={(e) => setPayloadType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
              >
                <option value="Sensor Telemetry (JSON)">IoT Sensor Reading (512 B)</option>
                <option value="Video Stream Frame">H.264 Video Keyframe (4 KB)</option>
                <option value="Voice VoIP Frame">G.711 VoIP Packet (160 B)</option>
                <option value="HTTP Management REST">HTTP REST Payload (1 KB)</option>
              </select>
            </div>

            <button
              onClick={() => {
                if (injectSourceId && injectTargetId && injectSourceId !== injectTargetId) {
                  onInjectPacket(injectSourceId, injectTargetId, payloadType);
                }
              }}
              disabled={!injectSourceId || !injectTargetId || injectSourceId === injectTargetId}
              className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold transition-all flex items-center justify-center space-x-2 shadow-lg shadow-sky-600/30"
            >
              <Send className="w-4 h-4" />
              <span>Inject Packet Into Network</span>
            </button>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300">Discrete-Event Tracer:</div>
              <p>Packets hop according to calculated propagation, transmission, and queue latency. You can pause or step through the bottom media player.</p>
            </div>
          </div>
        )}

        {/* TAB 3: FAULT INJECTION STUDIO */}
        {activeTab === 'faults' && (
          <div className="space-y-4">
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] text-red-300 flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Fault Studio injects live physical outages to test mesh self-healing and reroute convergence.</span>
            </div>

            {/* Quick Fault Actions */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Primary Actions
              </span>

              {/* Sever Gateway Link */}
              <button
                onClick={() => {
                  const gwLink = links.find(l => l.id === 'l_laba_gw1' || l.source === 'node_gw_primary' || l.target === 'node_gw_primary');
                  if (gwLink) onToggleSeverLink(gwLink.id);
                }}
                className="w-full text-left p-2.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-amber-400">Sever Primary Gateway Link</div>
                  <div className="text-[10px] text-slate-400">Triggers dynamic failover to Backup Gateway B</div>
                </div>
                <Zap className="w-4 h-4 text-amber-400" />
              </button>

              {/* Kill Selected Node */}
              {selectedNode && (
                <button
                  onClick={() => onToggleKillNode(selectedNode.id)}
                  className={`w-full text-left p-2.5 rounded border transition-colors flex items-center justify-between ${
                    selectedNode.isAlive ? 'bg-red-950/40 border-red-800 hover:bg-red-900/50' : 'bg-emerald-950/40 border-emerald-800 hover:bg-emerald-900/50'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-slate-100">
                      {selectedNode.isAlive ? `Kill Node: ${selectedNode.name}` : `Revive Node: ${selectedNode.name}`}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {selectedNode.isAlive ? 'Simulates hardware crash / battery depletion' : 'Restores node to active routing fabric'}
                    </div>
                  </div>
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              )}

              {/* Jam RF Bands */}
              <button
                onClick={() => onToggleJamFrequency('2.4GHz')}
                className="w-full text-left p-2.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-red-400">Jam 2.4 GHz IoT Frequency</div>
                  <div className="text-[10px] text-slate-400">Floods noise floor, driving packet loss to 100%</div>
                </div>
                <Radio className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: GATEWAY TRANSLATION INSPECTOR */}
        {activeTab === 'gateway' && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-slate-300">
              <Layers className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-sm">Inter-Domain Bridges ({translationTraces.length})</span>
            </div>

            {translationTraces.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Inject a cross-domain packet (e.g. IoT Sensor to Wi-Fi Server) to inspect header rewrites in real time.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {translationTraces.slice(0, 5).map((trace, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-amber-400">Gateway: {trace.gatewayId}</span>
                      <span className="text-[10px] font-mono text-slate-500">{trace.timestampSimMs} ms</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      {/* Ingress */}
                      <div className="p-1.5 rounded bg-blue-950/40 border border-blue-900/60 text-blue-300">
                        <div className="font-bold mb-1">Ingress (Source)</div>
                        <div>Protocol: {trace.ingressProtocol}</div>
                        <div>Ch: {trace.ingressChannel}</div>
                        <div>MAC: {trace.ingressMac}</div>
                      </div>

                      {/* Egress */}
                      <div className="p-1.5 rounded bg-emerald-950/40 border border-emerald-900/60 text-emerald-300">
                        <div className="font-bold mb-1">Egress (Target)</div>
                        <div>Protocol: {trace.egressProtocol}</div>
                        <div>Ch: {trace.egressChannel}</div>
                        <div>MAC: {trace.egressMac}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
