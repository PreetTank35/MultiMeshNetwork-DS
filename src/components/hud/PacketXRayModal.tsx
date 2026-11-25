import React from 'react';
import { X, Radio, Layers, Globe, FileJson, ArrowRight, Cpu } from 'lucide-react';
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
      icon: <Radio className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
      accent: 'border-l-blue-500',
      fields: [
        { label: 'Carrier Frequency', value: iface?.frequencyBand || '2.4GHz' },
        { label: 'RF Channel', value: `CH ${iface?.channel || 'N/A'}` },
        { label: 'Transmit Power', value: `${currentNode?.txPowerDbm || 20} dBm` },
        { label: 'Modulation', value: 'OFDM / QPSK' },
      ],
    },
    {
      name: 'Data Link / MAC (L2)',
      icon: <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
      accent: 'border-l-purple-500',
      fields: [
        { label: 'Source MAC', value: srcNode?.interfaces[0]?.mac || '00:1A:2B:EE:01:01' },
        { label: 'Next-Hop MAC', value: currentNode?.interfaces[0]?.mac || '00:1A:2B:EE:02:01' },
        { label: 'Channel Access', value: 'CSMA/CA Slotted' },
        { label: 'Sequence Number', value: `#${packet.sequenceNum}` },
      ],
    },
    {
      name: 'Network Routing (L3)',
      icon: <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      accent: 'border-l-emerald-500',
      fields: [
        { label: 'Routing Protocol', value: packet.protocolTrace[packet.protocolTrace.length - 1] || 'HWMP' },
        { label: 'Hops Traversed', value: `${packet.hops}` },
        { label: 'TTL', value: `${Math.max(32 - packet.hops, 0)}` },
        { label: 'Domain Route', value: `${srcSubmesh?.name || 'Src'} → ${dstSubmesh?.name || 'Dst'}` },
      ],
    },
    {
      name: 'Application Payload (L7)',
      icon: <FileJson className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
      accent: 'border-l-amber-500',
      fields: [
        { label: 'Payload', value: packet.payload },
        { label: 'Frame Size', value: `${packet.payloadSizeBytes} bytes` },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 select-none" onClick={onClose}>
      <div className="w-full max-w-xl neu-convex rounded-3xl overflow-hidden animate-fade-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-neu-border">
          <div>
            <div className="font-bold text-sm text-neu-text flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
              <span>Deep Packet X-Ray & OSI Dissector</span>
            </div>
            <div className="text-[10px] font-mono text-neu-muted mt-0.5">
              {packet.id} • {srcNode?.name} → {dstNode?.name}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl neu-button-sm text-neu-muted hover:text-neu-text">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-neu-border flex items-center space-x-2 text-[10px] font-mono overflow-x-auto custom-scrollbar">
          <span className="text-neu-muted uppercase text-[9px] font-bold shrink-0">Trace:</span>
          {packet.pathTraversed.map((nodeId, i) => {
            const n = nodes.find(nd => nd.id === nodeId);
            const isGw = n?.type === 'gateway';
            return (
              <React.Fragment key={i}>
                {i > 0 && <ArrowRight className="w-3 h-3 text-neu-muted shrink-0" />}
                <span className={`px-2 py-0.5 rounded-lg whitespace-nowrap neu-pressed-sm ${isGw ? 'text-amber-600 dark:text-amber-300 font-bold' : 'text-neu-text'}`}>
                  {n?.name || nodeId}{isGw && ' [GW]'}
                </span>
              </React.Fragment>
            );
          })}
        </div>

        <div className="p-5 space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
          {layers.map((layer, idx) => (
            <div key={idx} className={`rounded-2xl neu-flat-sm border-l-4 ${layer.accent} overflow-hidden`}>
              <div className="flex items-center space-x-2 px-4 py-2 border-b border-neu-border">
                {layer.icon}
                <span className="font-bold text-xs text-neu-text">{layer.name}</span>
              </div>
              <div className="p-3 space-y-1.5 neu-pressed m-2 rounded-xl">
                {layer.fields.map((f, fi) => (
                  <div key={fi} className="flex justify-between items-center text-[11px]">
                    <span className="text-neu-muted">{f.label}</span>
                    <span className="font-mono text-neu-text font-semibold">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-neu-border flex items-center justify-between text-[11px] font-mono">
          <span className={`font-bold ${packet.state === 'received' ? 'text-emerald-600 dark:text-emerald-400' : packet.state === 'dropped' ? 'text-red-600 dark:text-red-400' : 'text-sky-600 dark:text-cyan-400'}`}>
            STATE: {packet.state.toUpperCase()}
          </span>
          <span className="text-neu-muted">
            Latency: <strong className="text-neu-text">{packet.deliveredAtSimTime ? `${packet.deliveredAtSimTime - packet.createdAtSimTime} ms` : 'In-Transit'}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
