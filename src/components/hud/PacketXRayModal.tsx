import React from 'react';
import { X, Radio, Layers, Globe, FileJson, ArrowRight } from 'lucide-react';
import { Packet, MeshNode, SubMeshDomain } from '../../types/simulator';

interface Props {
  packet: Packet | null;
  nodes: MeshNode[];
  submeshes: SubMeshDomain[];
  onClose: () => void;
}

export const PacketXRayModal: React.FC<Props> = ({ packet, nodes, submeshes, onClose }) => {
  if (!packet) return null;

  const srcNode = nodes.find(n => n.id === packet.src);
  const dstNode = nodes.find(n => n.id === packet.dst);
  const currentNode = nodes.find(n => n.id === packet.currentHop);
  const srcSubmesh = submeshes.find(s => s.id === packet.submeshSrc);
  const dstSubmesh = submeshes.find(s => s.id === packet.submeshDst);
  const iface = currentNode?.interfaces[0];

  const layers = [
    {
      name: 'Physical Layer (L1)',
      icon: <Radio className="w-4 h-4 text-sky-400" />,
      color: 'sky',
      fields: [
        { label: 'Carrier Frequency', value: iface?.frequencyBand || '2.4GHz' },
        { label: 'Channel', value: `CH ${iface?.channel || 'N/A'}` },
        { label: 'Channel Width', value: '20 MHz' },
        { label: 'TX Power', value: `${currentNode?.txPowerDbm || 20} dBm` },
        { label: 'Modulation', value: 'OFDM / QPSK' },
      ]
    },
    {
      name: 'Data Link / MAC (L2)',
      icon: <Layers className="w-4 h-4 text-purple-400" />,
      color: 'purple',
      fields: [
        { label: 'Source MAC', value: srcNode?.interfaces[0]?.mac || '00:1A:2B:XX:XX:XX' },
        { label: 'Next-Hop MAC', value: currentNode?.interfaces[0]?.mac || '00:1A:2B:YY:YY:YY' },
        { label: 'Frame Type', value: 'IEEE 802.11 Data Frame' },
        { label: 'Retry Count', value: '0' },
        { label: 'Sequence #', value: `${packet.sequenceNum}` },
      ]
    },
    {
      name: 'Network Layer (L3)',
      icon: <Globe className="w-4 h-4 text-emerald-400" />,
      color: 'emerald',
      fields: [
        { label: 'Routing Protocol', value: packet.protocolTrace[packet.protocolTrace.length - 1] || 'HWMP' },
        { label: 'Hop Count', value: `${packet.hops}` },
        { label: 'TTL', value: `${32 - packet.hops}` },
        { label: 'Source Domain', value: srcSubmesh?.name || 'Unknown' },
        { label: 'Target Domain', value: dstSubmesh?.name || 'Unknown' },
      ]
    },
    {
      name: 'Application Payload (L7)',
      icon: <FileJson className="w-4 h-4 text-amber-400" />,
      color: 'amber',
      fields: [
        { label: 'Payload Type', value: packet.payload },
        { label: 'Size', value: `${packet.payloadSizeBytes} bytes` },
        { label: 'Simulated Data', value: '{"sensor":"AQI","pm25":18.4,"temp":"24°C"}' },
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg glass rounded-2xl shadow-2xl overflow-hidden animate-fade-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/60 bg-canvas-deep/60">
          <div>
            <div className="font-bold text-sm text-slate-100 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-sky-400" />
              <span>Packet X-Ray Inspector</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-0.5">{packet.id} • {srcNode?.name} → {dstNode?.name}</div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
        </div>

        {/* Route Trace */}
        <div className="px-5 py-3 border-b border-slate-800/40 flex items-center space-x-1.5 text-[10px] font-mono text-slate-400 overflow-x-auto custom-scrollbar">
          {packet.pathTraversed.map((nodeId, i) => {
            const n = nodes.find(nd => nd.id === nodeId);
            const isGw = n?.type === 'gateway';
            return (
              <React.Fragment key={i}>
                {i > 0 && <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />}
                <span className={`px-1.5 py-0.5 rounded whitespace-nowrap ${isGw ? 'bg-amber-500/15 text-amber-300' : 'text-slate-300'}`}>
                  {n?.name || nodeId}
                </span>
              </React.Fragment>
            );
          })}
        </div>

        {/* OSI Layers */}
        <div className="p-4 space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
          {layers.map((layer, idx) => (
            <div key={idx} className="rounded-xl bg-slate-900/50 border border-slate-800/40 overflow-hidden">
              <div className="flex items-center space-x-2 px-3 py-2 border-b border-slate-800/30">
                {layer.icon}
                <span className="font-semibold text-xs text-slate-200">{layer.name}</span>
              </div>
              <div className="px-3 py-2 space-y-1.5">
                {layer.fields.map((f, fi) => (
                  <div key={fi} className="flex justify-between text-[11px]">
                    <span className="text-slate-500">{f.label}</span>
                    <span className="font-mono text-slate-200">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Status */}
        <div className="px-5 py-2.5 border-t border-slate-800/40 flex items-center justify-between text-[10px] font-mono">
          <span className={`px-2 py-0.5 rounded-lg font-bold ${packet.state === 'received' ? 'bg-emerald-500/15 text-emerald-400' : packet.state === 'dropped' ? 'bg-red-500/15 text-red-400' : 'bg-sky-500/15 text-sky-400'}`}>
            {packet.state.toUpperCase()}
          </span>
          <span className="text-slate-500">Latency: {packet.deliveredAtSimTime ? `${packet.deliveredAtSimTime - packet.createdAtSimTime}ms` : 'in-flight'}</span>
        </div>
      </div>
    </div>
  );
};

