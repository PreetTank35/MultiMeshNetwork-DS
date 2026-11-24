import React from 'react';
import { X, Radio, Layers, Globe, FileJson, ArrowRight, ShieldCheck, Cpu } from 'lucide-react';
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
      icon: <Radio className="w-4 h-4 text-blue-400" />,
      accent: 'border-l-blue-500',
      fields: [
        { label: 'Carrier Frequency', value: iface?.frequencyBand || '2.4GHz' },
        { label: 'RF Channel', value: `CH ${iface?.channel || 'N/A'}` },
        { label: 'Channel Bandwidth', value: '20 MHz' },
        { label: 'Transmit Power', value: `${currentNode?.txPowerDbm || 20} dBm` },
        { label: 'Modulation / Coding', value: 'OFDM / QPSK' },
      ]
    },
    {
      name: 'Data Link / MAC (L2)',
      icon: <Layers className="w-4 h-4 text-purple-400" />,
      accent: 'border-l-purple-500',
      fields: [
        { label: 'Source MAC Address', value: srcNode?.interfaces[0]?.mac || '00:1A:2B:EE:01:01' },
        { label: 'Next-Hop MAC', value: currentNode?.interfaces[0]?.mac || '00:1A:2B:EE:02:01' },
        { label: 'Frame Structure', value: 'IEEE 802.11 / 802.15.4 Data Frame' },
        { label: 'Contention Backoff', value: 'CSMA/CA Slotted' },
        { label: 'Sequence Number', value: `#${packet.sequenceNum}` },
      ]
    },
    {
      name: 'Network Routing (L3)',
      icon: <Globe className="w-4 h-4 text-emerald-400" />,
      accent: 'border-l-emerald-500',
      fields: [
        { label: 'Routing Protocol', value: packet.protocolTrace[packet.protocolTrace.length - 1] || 'HWMP' },
        { label: 'Hop Count Traversed', value: `${packet.hops}` },
        { label: 'Time-to-Live (TTL)', value: `${Math.max(32 - packet.hops, 0)}` },
        { label: 'Ingress Sub-Mesh', value: srcSubmesh?.name || 'Wi-Fi Domain' },
        { label: 'Egress Sub-Mesh', value: dstSubmesh?.name || 'IoT Domain' },
      ]
    },
    {
      name: 'Application Payload (L7)',
      icon: <FileJson className="w-4 h-4 text-amber-400" />,
      accent: 'border-l-amber-500',
      fields: [
        { label: 'Payload Identifier', value: packet.payload },
        { label: 'Frame Size', value: `${packet.payloadSizeBytes} bytes` },
        { label: 'Sensor Readings', value: '{"type":"telemetry","val":42.8,"unit":"dBm"}' },
      ]
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl neu-convex rounded-3xl shadow-2xl overflow-hidden animate-fade-up border border-neu-border"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neu-border bg-neu-base/80">
          <div>
            <div className="font-bold text-sm text-slate-100 flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-cyan-400 neu-led-route" />
              <span>Deep Packet X-Ray & OSI Dissector</span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
              {packet.id} • {srcNode?.name} → {dstNode?.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl neu-button-sm text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Route Traversal Trace Line */}
        <div className="px-6 py-3 border-b border-neu-border bg-neu-base/40 flex items-center space-x-2 text-[10px] font-mono overflow-x-auto custom-scrollbar">
          <span className="text-slate-400 uppercase text-[9px] font-bold tracking-wider shrink-0 mr-1">Hop Trace:</span>
          {packet.pathTraversed.map((nodeId, i) => {
            const n = nodes.find(nd => nd.id === nodeId);
            const isGw = n?.type === 'gateway';
            return (
              <React.Fragment key={i}>
                {i > 0 && <ArrowRight className="w-3 h-3 text-cyan-500/70 shrink-0" />}
                <span
                  className={`px-2 py-0.5 rounded-lg whitespace-nowrap border ${
                    isGw
                      ? 'neu-pressed text-amber-300 border-amber-500/30 font-bold'
                      : 'neu-pressed text-slate-200 border-black/20'
                  }`}
                >
                  {n?.name || nodeId}
                  {isGw && ' [MRMC GW]'}
                </span>
              </React.Fragment>
            );
          })}
        </div>

        {/* OSI Layers Breakdown */}
        <div className="p-5 space-y-3.5 max-h-96 overflow-y-auto custom-scrollbar">
          {layers.map((layer, idx) => (
            <div
              key={idx}
              className={`rounded-2xl neu-convex border border-neu-border border-l-4 ${layer.accent} overflow-hidden`}
            >
              <div className="flex items-center space-x-2.5 px-4 py-2.5 border-b border-neu-border bg-neu-base/50">
                {layer.icon}
                <span className="font-semibold text-xs text-slate-200">{layer.name}</span>
              </div>
              <div className="p-3.5 space-y-2 neu-pressed m-2.5 rounded-xl border border-black/20">
                {layer.fields.map((f, fi) => (
                  <div key={fi} className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">{f.label}</span>
                    <span className="font-mono text-cyan-200 font-medium">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Status Footer */}
        <div className="px-6 py-3 border-t border-neu-border bg-neu-base/80 flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2 h-2 rounded-full ${
                packet.state === 'received'
                  ? 'bg-emerald-400 neu-led-iot'
                  : packet.state === 'dropped'
                  ? 'bg-red-500 neu-led-failure'
                  : 'bg-cyan-400 neu-led-route'
              }`}
            />
            <span
              className={`font-bold ${
                packet.state === 'received'
                  ? 'text-emerald-400'
                  : packet.state === 'dropped'
                  ? 'text-red-400'
                  : 'text-cyan-300'
              }`}
            >
              FRAME STATE: {packet.state.toUpperCase()}
            </span>
          </div>

          <div className="text-slate-400">
            End-to-End Latency:{' '}
            <span className="text-slate-200 font-bold">
              {packet.deliveredAtSimTime
                ? `${packet.deliveredAtSimTime - packet.createdAtSimTime} ms`
                : 'In-Transit'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
