import React from 'react';
import { X, Power, PowerOff, Scissors, Radio, Wifi, Cpu, Layers, Shield, Signal, Zap } from 'lucide-react';
import { MeshNode, NetworkLink, SubMeshDomain } from '../../types/simulator';

interface Props {
  node: MeshNode | null;
  link: NetworkLink | null;
  submeshes: SubMeshDomain[];
  nodes: MeshNode[];
  onClose: () => void;
  onToggleKillNode: (id: string) => void;
  onToggleSeverLink: (id: string) => void;
  onToggleJamFrequency: (band: string) => void;
}

export const NodeDrawer: React.FC<Props> = ({
  node,
  link,
  submeshes,
  nodes,
  onClose,
  onToggleKillNode,
  onToggleSeverLink,
  onToggleJamFrequency
}) => {
  const isOpen = !!(node || link);
  if (!isOpen) return null;

  const getSubmesh = (id: string) => submeshes.find(s => s.id === id);

  return (
    <div className="absolute top-0 right-0 h-full w-84 z-40 animate-slide-in-right flex flex-col pointer-events-auto select-none">
      <div className="flex-1 neu-convex rounded-l-3xl shadow-[-8px_0_24px_rgba(15,19,27,0.85)] border-l border-t border-b border-neu-border overflow-hidden flex flex-col my-3 mr-0">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neu-border bg-neu-base/60">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 neu-led-route" />
            <span className="font-bold text-sm text-slate-100 tracking-wide">
              {node ? 'Node Hardware Inspector' : 'RF Conduit Inspector'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl neu-button-sm text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar text-xs">
          {/* Node Inspection Details */}
          {node && (() => {
            const sm = getSubmesh(node.submeshId);
            const typeIcon =
              node.type === 'gateway' ? (
                <Layers className="w-4 h-4 text-amber-400" />
              ) : node.type === 'router' ? (
                <Wifi className="w-4 h-4 text-blue-400" />
              ) : (
                <Cpu className="w-4 h-4 text-emerald-400" />
              );

            return (
              <>
                {/* Node Identity Card */}
                <div className="p-3.5 rounded-2xl neu-convex border border-neu-border flex items-center space-x-3.5">
                  <div
                    className="p-2.5 rounded-xl neu-pressed flex items-center justify-center border border-black/30"
                    style={{ color: sm?.color || '#2563EB' }}
                  >
                    {typeIcon}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-100 text-sm">{node.name}</div>
                    <div className="text-[10px] font-mono text-cyan-400 mt-0.5">
                      {sm?.name} • {sm?.protocol} • {sm?.frequencyBand}
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center justify-between p-3 rounded-xl neu-pressed border border-black/20">
                  <span className="text-slate-400 font-medium">Power State</span>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        node.isAlive ? 'bg-emerald-400 neu-led-iot' : 'bg-red-500 neu-led-failure'
                      }`}
                    />
                    <span
                      className={`font-mono text-[10px] font-bold tracking-wider ${
                        node.isAlive ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {node.isAlive ? 'OPERATIONAL' : 'SYSTEM OFFLINE'}
                    </span>
                  </div>
                </div>

                {/* Physical RF Parameters Grid */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Signal className="w-3 h-3 text-cyan-400" />
                    <span>Physical RF Transceiver</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl neu-pressed border border-black/20">
                      <span className="text-slate-400 block text-[10px]">TX Power</span>
                      <span className="font-mono text-cyan-300 font-bold text-xs">{node.txPowerDbm} dBm</span>
                    </div>
                    <div className="p-3 rounded-xl neu-pressed border border-black/20">
                      <span className="text-slate-400 block text-[10px]">Queue Buffer</span>
                      <span className="font-mono text-amber-300 font-bold text-xs">
                        {node.currentQueue.length}/{node.queueCapacity} pkts
                      </span>
                    </div>
                    <div className="p-3 rounded-xl neu-pressed border border-black/20">
                      <span className="text-slate-400 block text-[10px]">Grid Coords</span>
                      <span className="font-mono text-slate-200 text-xs">
                        {Math.round(node.position.x)}, {Math.round(node.position.y)}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl neu-pressed border border-black/20">
                      <span className="text-slate-400 block text-[10px]">Mobility Model</span>
                      <span className="font-mono text-slate-200 text-[11px] capitalize">
                        {node.mobilityModel.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Interfaces */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Interfaces ({node.interfaces.length})</span>
                    <span className="text-cyan-400 font-mono">MAC / PHY</span>
                  </div>
                  {node.interfaces.map(iface => (
                    <div key={iface.id} className="p-3 rounded-xl neu-pressed border border-black/20 font-mono text-[10px] space-y-1">
                      <div className="flex justify-between items-center text-cyan-300 font-bold">
                        <span>{iface.type.toUpperCase()} NIC</span>
                        <span className="text-slate-400 font-normal">{iface.frequencyBand} CH{iface.channel}</span>
                      </div>
                      <div className="text-slate-400 text-[9px] flex justify-between">
                        <span>MAC: {iface.mac}</span>
                        <span className="text-emerald-400">{iface.bandwidthMbps} Mbps</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Fault Simulation Studio */}
                <div className="space-y-2 pt-2 border-t border-neu-border">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Zap className="w-3 h-3 text-red-400" />
                    <span>Fault Simulation Studio</span>
                  </div>

                  <button
                    onClick={() => onToggleKillNode(node.id)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2 ${
                      node.isAlive
                        ? 'neu-button text-red-400 hover:shadow-[0_0_15px_rgba(220,38,38,0.35)]'
                        : 'neu-button text-emerald-400 hover:shadow-[0_0_15px_rgba(5,150,105,0.35)]'
                    }`}
                  >
                    {node.isAlive ? <PowerOff className="w-3.5 h-3.5 neu-led-failure" /> : <Power className="w-3.5 h-3.5 neu-led-iot" />}
                    <span>{node.isAlive ? 'Simulate Node Failure (Kill)' : 'Revive & Recover Node'}</span>
                  </button>

                  <button
                    onClick={() => onToggleJamFrequency(sm?.frequencyBand || '2.4GHz')}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold neu-button text-amber-400 hover:shadow-[0_0_15px_rgba(217,119,6,0.35)] flex items-center justify-center space-x-2 transition-all"
                  >
                    <Radio className="w-3.5 h-3.5 neu-led-gateway" />
                    <span>Jam {sm?.frequencyBand || '2.4GHz'} Radio Spectrum</span>
                  </button>
                </div>
              </>
            );
          })()}

          {/* Link Inspection Details */}
          {link && (() => {
            const srcNode = nodes.find(n => n.id === link.source);
            const dstNode = nodes.find(n => n.id === link.target);

            return (
              <>
                <div className="p-3.5 rounded-2xl neu-convex border border-neu-border flex items-center space-x-3.5">
                  <div className="p-2.5 rounded-xl neu-pressed text-cyan-400 flex items-center justify-center border border-black/30">
                    <Shield className="w-4 h-4 neu-led-route" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-100 text-sm">RF Conduit Link</div>
                    <div className="text-[10px] font-mono text-cyan-300 mt-0.5">
                      {srcNode?.name || link.source} ↔ {dstNode?.name || link.target}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl neu-pressed border border-black/20">
                  <span className="text-slate-400 font-medium">Conduit Status</span>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        link.isSevered ? 'bg-red-500 neu-led-failure' : 'bg-emerald-400 neu-led-iot'
                      }`}
                    />
                    <span
                      className={`font-mono text-[10px] font-bold tracking-wider ${
                        link.isSevered ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {link.isSevered ? 'LINK SEVERED' : 'CONDUIT ACTIVE'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Wireless Propagation Metrics
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl neu-pressed border border-black/20">
                      <span className="text-slate-400 block text-[10px]">Distance</span>
                      <span className="font-mono text-cyan-300 font-bold text-xs">
                        {link.distanceMeters.toFixed(1)} m
                      </span>
                    </div>
                    <div className="p-3 rounded-xl neu-pressed border border-black/20">
                      <span className="text-slate-400 block text-[10px]">Capacity</span>
                      <span className="font-mono text-emerald-400 font-bold text-xs">
                        {link.bandwidthMbps} Mbps
                      </span>
                    </div>
                    <div className="p-3 rounded-xl neu-pressed border border-black/20">
                      <span className="text-slate-400 block text-[10px]">Signal / Noise (SNR)</span>
                      <span className="font-mono text-amber-300 font-bold text-xs">
                        {link.snrDb.toFixed(1)} dB
                      </span>
                    </div>
                    <div className="p-3 rounded-xl neu-pressed border border-black/20">
                      <span className="text-slate-400 block text-[10px]">Packet Error (PER)</span>
                      <span className="font-mono text-red-400 font-bold text-xs">
                        {(link.lossRate * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-neu-border">
                  <button
                    onClick={() => onToggleSeverLink(link.id)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2 ${
                      link.isSevered
                        ? 'neu-button text-emerald-400 hover:shadow-[0_0_15px_rgba(5,150,105,0.35)]'
                        : 'neu-button text-red-400 hover:shadow-[0_0_15px_rgba(220,38,38,0.35)]'
                    }`}
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>{link.isSevered ? 'Reconnect & Repair Link' : 'Sever Link (Simulate Cut)'}</span>
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
