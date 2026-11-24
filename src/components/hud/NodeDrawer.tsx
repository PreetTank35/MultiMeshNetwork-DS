import React from 'react';
import { X, Power, PowerOff, Scissors, Radio, Wifi, Cpu, Layers, Shield } from 'lucide-react';
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

export const NodeDrawer: React.FC<Props> = ({ node, link, submeshes, nodes, onClose, onToggleKillNode, onToggleSeverLink, onToggleJamFrequency }) => {
  const isOpen = !!(node || link);
  if (!isOpen) return null;

  const getSubmesh = (id: string) => submeshes.find(s => s.id === id);

  return (
    <div className="absolute top-0 right-0 h-full w-80 z-40 animate-slide-in-right flex flex-col">
      <div className="flex-1 glass-light rounded-l-2xl shadow-2xl overflow-hidden flex flex-col m-2 mr-0 rounded-r-none">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/40">
          <span className="font-bold text-sm text-slate-100">{node ? 'Node Inspector' : 'Link Inspector'}</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
          {node && (() => {
            const sm = getSubmesh(node.submeshId);
            const typeIcon = node.type === 'gateway' ? <Layers className="w-4 h-4 text-amber-400" /> : node.type === 'router' ? <Wifi className="w-4 h-4 text-sky-400" /> : <Cpu className="w-4 h-4 text-emerald-400" />;
            return (
              <>
                {/* Identity */}
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl" style={{ backgroundColor: (sm?.color || '#3B82F6') + '20' }}>{typeIcon}</div>
                  <div>
                    <div className="font-bold text-slate-100 text-sm">{node.name}</div>
                    <div className="text-[10px] font-mono text-slate-400">{sm?.name} • {sm?.protocol} • {sm?.frequencyBand}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/50">
                  <span className="text-slate-400">Status</span>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold ${node.isAlive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {node.isAlive ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                {/* Physical Parameters */}
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Radio Physical Layer</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-900/50"><span className="text-slate-500 block text-[10px]">TX Power</span><span className="font-mono text-sky-300 font-semibold">{node.txPowerDbm} dBm</span></div>
                    <div className="p-2.5 rounded-xl bg-slate-900/50"><span className="text-slate-500 block text-[10px]">Queue</span><span className="font-mono text-amber-300 font-semibold">{node.currentQueue.length}/{node.queueCapacity}</span></div>
                    <div className="p-2.5 rounded-xl bg-slate-900/50"><span className="text-slate-500 block text-[10px]">Position</span><span className="font-mono text-slate-300 text-[11px]">({Math.round(node.position.x)}, {Math.round(node.position.y)})</span></div>
                    <div className="p-2.5 rounded-xl bg-slate-900/50"><span className="text-slate-500 block text-[10px]">Mobility</span><span className="font-mono text-slate-300 text-[11px]">{node.mobilityModel}</span></div>
                  </div>
                </div>

                {/* NICs */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Network Interface Cards ({node.interfaces.length})</span>
                  {node.interfaces.map(iface => (
                    <div key={iface.id} className="p-2.5 rounded-xl bg-slate-900/50 font-mono text-[10px]">
                      <div className="flex justify-between text-sky-300"><span>{iface.type.toUpperCase()}</span><span>{iface.frequencyBand} CH{iface.channel}</span></div>
                      <div className="text-slate-500 mt-0.5">MAC: {iface.mac} | {iface.bandwidthMbps} Mbps</div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="space-y-1.5 pt-2">
                  <button onClick={() => onToggleKillNode(node.id)}
                    className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2 ${
                      node.isAlive ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                    }`}>
                    {node.isAlive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                    <span>{node.isAlive ? 'Kill Node (Simulate Failure)' : 'Revive Node'}</span>
                  </button>
                  <button onClick={() => onToggleJamFrequency(sm?.frequencyBand || '2.4GHz')}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 flex items-center justify-center space-x-2 transition-all">
                    <Radio className="w-3.5 h-3.5" /><span>Jam {sm?.frequencyBand} Channel</span>
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
                <div className="flex items-center space-x-2 text-sm font-bold text-slate-100">
                  <Shield className="w-4 h-4 text-sky-400" />
                  <span>Physical Link</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/50 font-mono text-[11px] text-slate-300">
                  {srcNode?.name || link.source} ↔ {dstNode?.name || link.target}
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/50">
                  <span className="text-slate-400">Status</span>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold ${link.isSevered ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                    {link.isSevered ? 'SEVERED' : 'ACTIVE'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-900/50"><span className="text-slate-500 block text-[10px]">Distance</span><span className="font-mono text-sky-300 font-semibold">{link.distanceMeters.toFixed(1)} m</span></div>
                  <div className="p-2.5 rounded-xl bg-slate-900/50"><span className="text-slate-500 block text-[10px]">Bandwidth</span><span className="font-mono text-emerald-300 font-semibold">{link.bandwidthMbps} Mbps</span></div>
                  <div className="p-2.5 rounded-xl bg-slate-900/50"><span className="text-slate-500 block text-[10px]">SNR</span><span className="font-mono text-amber-300 font-semibold">{link.snrDb.toFixed(1)} dB</span></div>
                  <div className="p-2.5 rounded-xl bg-slate-900/50"><span className="text-slate-500 block text-[10px]">PER</span><span className="font-mono text-red-300 font-semibold">{(link.lossRate * 100).toFixed(1)}%</span></div>
                </div>

                <button onClick={() => onToggleSeverLink(link.id)}
                  className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2 ${
                    link.isSevered ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                  }`}>
                  <Scissors className="w-3.5 h-3.5" /><span>{link.isSevered ? 'Restore Link' : 'Sever Link (Cut Wire)'}</span>
                </button>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

