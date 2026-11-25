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
  onToggleJamFrequency,
}) => {
  if (!node && !link) return null;

  const getSubmesh = (id: string) => submeshes.find(s => s.id === id);

  return (
    <div className="absolute top-0 right-0 h-full w-96 max-w-[92vw] z-40 animate-slide-in-right flex flex-col pointer-events-auto select-none p-2.5">
      <div className="flex-1 neu-convex rounded-3xl overflow-hidden flex flex-col">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neu-border">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 neu-led-route" />
            <span className="font-bold text-sm text-neu-text">
              {node ? 'Node Inspector' : 'Link Inspector'}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl neu-button-sm text-neu-muted hover:text-neu-text">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
          {node && (() => {
            const sm = getSubmesh(node.submeshId);
            const typeIcon =
              node.type === 'gateway' ? <Layers className="w-4 h-4 text-amber-500" />
              : node.type === 'router' ? <Wifi className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              : <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;

            return (
              <>
                <div className="p-3 rounded-2xl neu-pressed flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl neu-convex-sm">{typeIcon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-neu-text text-sm truncate">{node.name}</div>
                    <div className="text-[10px] font-mono text-neu-muted truncate">
                      {sm?.name} • {sm?.protocol} • {sm?.frequencyBand}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl neu-pressed">
                  <span className="text-neu-muted font-medium">Power State</span>
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${node.isAlive ? 'bg-emerald-500 neu-led-iot' : 'bg-red-500 neu-led-failure'}`} />
                    <span className={`font-mono text-[10px] font-bold ${node.isAlive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {node.isAlive ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-1.5 text-[10px] font-bold text-neu-muted uppercase tracking-wider">
                    <Signal className="w-3 h-3 text-sky-500" />
                    <span>Physical RF Parameters</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl neu-pressed">
                      <span className="text-neu-muted block text-[10px]">TX Power</span>
                      <span className="font-mono text-sky-600 dark:text-cyan-300 font-bold">{node.txPowerDbm} dBm</span>
                    </div>
                    <div className="p-2.5 rounded-xl neu-pressed">
                      <span className="text-neu-muted block text-[10px]">Queue</span>
                      <span className="font-mono text-amber-600 dark:text-amber-300 font-bold">
                        {node.currentQueue.length}/{node.queueCapacity}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl neu-pressed">
                      <span className="text-neu-muted block text-[10px]">Coords</span>
                      <span className="font-mono text-neu-text">{Math.round(node.position.x)}, {Math.round(node.position.y)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl neu-pressed">
                      <span className="text-neu-muted block text-[10px]">Mobility</span>
                      <span className="font-mono text-neu-text capitalize">{node.mobilityModel.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-neu-muted uppercase tracking-wider">
                    Interfaces ({node.interfaces.length})
                  </div>
                  {node.interfaces.map(iface => (
                    <div key={iface.id} className="p-2.5 rounded-xl neu-pressed font-mono text-[10px] space-y-1">
                      <div className="flex justify-between text-sky-600 dark:text-cyan-300 font-bold">
                        <span>{iface.type.toUpperCase()} NIC</span>
                        <span className="text-neu-muted">{iface.frequencyBand} CH{iface.channel}</span>
                      </div>
                      <div className="text-neu-muted text-[9.5px] flex justify-between">
                        <span>{iface.mac}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{iface.bandwidthMbps} Mbps</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-neu-border">
                  <div className="text-[10px] font-bold text-neu-muted uppercase tracking-wider flex items-center space-x-1.5">
                    <Zap className="w-3 h-3 text-red-500" />
                    <span>Fault Injection Studio</span>
                  </div>

                  <button
                    onClick={() => onToggleKillNode(node.id)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold neu-button flex items-center justify-center space-x-2 ${
                      node.isAlive ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {node.isAlive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                    <span>{node.isAlive ? 'Kill Node (Simulate Crash)' : 'Revive Node'}</span>
                  </button>

                  <button
                    onClick={() => onToggleJamFrequency(sm?.frequencyBand || '2.4GHz')}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold neu-button text-amber-600 dark:text-amber-400 flex items-center justify-center space-x-2"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Jam {sm?.frequencyBand || '2.4GHz'} Spectrum</span>
                  </button>
                </div>
              </>
            );
          })()}

          {link && (() => {
            const srcNode = nodes.find(n => n.id === link.source);
            const dstNode = nodes.find(n => n.id === link.target);
            return (
              <>
                <div className="p-3 rounded-2xl neu-pressed flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl neu-convex-sm text-sky-600 dark:text-cyan-400">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-neu-text text-sm">RF Link Conduit</div>
                    <div className="text-[10px] font-mono text-neu-muted truncate">
                      {srcNode?.name || link.source} ↔ {dstNode?.name || link.target}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl neu-pressed">
                  <span className="text-neu-muted font-medium">Status</span>
                  <span className={`font-mono text-[10px] font-bold ${link.isSevered ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {link.isSevered ? 'SEVERED' : 'ACTIVE'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl neu-pressed">
                    <span className="text-neu-muted block text-[10px]">Distance</span>
                    <span className="font-mono text-sky-600 dark:text-cyan-300 font-bold">{link.distanceMeters.toFixed(1)} m</span>
                  </div>
                  <div className="p-2.5 rounded-xl neu-pressed">
                    <span className="text-neu-muted block text-[10px]">Bandwidth</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{link.bandwidthMbps} Mbps</span>
                  </div>
                  <div className="p-2.5 rounded-xl neu-pressed">
                    <span className="text-neu-muted block text-[10px]">SNR</span>
                    <span className="font-mono text-amber-600 dark:text-amber-300 font-bold">{link.snrDb.toFixed(1)} dB</span>
                  </div>
                  <div className="p-2.5 rounded-xl neu-pressed">
                    <span className="text-neu-muted block text-[10px]">Packet Loss</span>
                    <span className="font-mono text-red-600 dark:text-red-400 font-bold">{(link.lossRate * 100).toFixed(1)}%</span>
                  </div>
                </div>

                <button
                  onClick={() => onToggleSeverLink(link.id)}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold neu-button flex items-center justify-center space-x-2 ${
                    link.isSevered ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>{link.isSevered ? 'Repair Link' : 'Sever Link (Cut Wire)'}</span>
                </button>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
