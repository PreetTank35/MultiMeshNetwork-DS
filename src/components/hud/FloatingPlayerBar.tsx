import React, { useState } from 'react';
import { Play, Pause, SkipForward, Clock, Terminal, ChevronUp, ChevronDown, Send, Box, Layers } from 'lucide-react';
import { MeshNode, SubMeshDomain, NodeType } from '../../types/simulator';
import { SimulationStepLog } from '../../core/engine/discreteEventEngine';

interface Props {
  isRunning: boolean;
  simTimeMs: number;
  speedMultiplier: number;
  logs: SimulationStepLog[];
  nodes: MeshNode[];
  submeshes: SubMeshDomain[];
  is3DMode: boolean;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onChangeSpeed: (s: number) => void;
  onInjectPacket: (src: string, dst: string, payload: string) => void;
  onToggle3D: () => void;
  onAddNode: (type: NodeType) => void;
}

export const FloatingPlayerBar: React.FC<Props> = ({
  isRunning, simTimeMs, speedMultiplier, logs, nodes, submeshes, is3DMode,
  onTogglePlay, onStepForward, onChangeSpeed, onInjectPacket, onToggle3D, onAddNode
}) => {
  const [termOpen, setTermOpen] = useState(false);
  const [injectOpen, setInjectOpen] = useState(false);
  const [srcId, setSrcId] = useState('');
  const [dstId, setDstId] = useState('');
  const speeds = [0.2, 0.5, 1.0, 2.0, 5.0];
  const aliveNodes = nodes.filter(n => n.isAlive);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none">
      {/* Collapsible Terminal */}
      {termOpen && (
        <div className="glass rounded-xl shadow-2xl mb-2 w-[640px] max-h-48 overflow-hidden pointer-events-auto animate-fade-up">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/60">
            <span className="text-[10px] font-mono text-slate-400">Live Event Console ({logs.length})</span>
            <button onClick={() => setTermOpen(false)} className="text-slate-500 hover:text-slate-300"><ChevronDown className="w-3.5 h-3.5" /></button>
          </div>
          <div className="overflow-y-auto max-h-36 p-2 font-mono text-[10px] space-y-0.5 custom-scrollbar">
            {logs.length === 0 ? <div className="text-slate-600 py-4 text-center">No events yet. Inject a packet to begin.</div> :
              logs.slice(0, 60).map((log, i) => (
                <div key={i} className="flex space-x-2 leading-relaxed">
                  <span className="text-slate-600 select-none shrink-0">[{log.timestamp}ms]</span>
                  <span className={log.level === 'success' ? 'text-emerald-400' : log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-amber-400' : log.level === 'gateway' ? 'text-sky-300 font-semibold' : 'text-slate-400'}>
                    {log.message}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Inline Inject Form */}
      {injectOpen && (
        <div className="glass rounded-xl shadow-2xl mb-2 p-3 pointer-events-auto animate-fade-up">
          <div className="flex items-center space-x-2 text-xs">
            <select value={srcId} onChange={e => setSrcId(e.target.value)} className="bg-slate-900/80 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 text-xs w-44">
              <option value="">Source node…</option>
              {aliveNodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
            <span className="text-slate-500">→</span>
            <select value={dstId} onChange={e => setDstId(e.target.value)} className="bg-slate-900/80 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 text-xs w-44">
              <option value="">Destination…</option>
              {aliveNodes.filter(n => n.id !== srcId).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
            <button disabled={!srcId || !dstId} onClick={() => { onInjectPacket(srcId, dstId, 'Telemetry Payload'); setInjectOpen(false); }}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-30 text-white font-semibold text-xs transition-colors flex items-center space-x-1 shadow-lg shadow-sky-600/20">
              <Send className="w-3 h-3" /><span>Inject</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Floating Bar */}
      <div className="glass rounded-2xl shadow-2xl px-2 py-1.5 flex items-center space-x-1 pointer-events-auto">
        {/* Playback */}
        <button onClick={onTogglePlay} className={`p-2 rounded-xl transition-all ${isRunning ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30'}`} title={isRunning ? 'Pause' : 'Play'}>
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <button onClick={onStepForward} disabled={isRunning} className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 disabled:opacity-30 transition-colors" title="Step +1 Hop">
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-6 bg-slate-700/60 mx-1" />

        {/* Speed */}
        <div className="flex items-center bg-slate-900/60 rounded-lg p-0.5">
          {speeds.map(s => (
            <button key={s} onClick={() => onChangeSpeed(s)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all ${speedMultiplier === s ? 'bg-sky-500/30 text-sky-300 font-bold' : 'text-slate-500 hover:text-slate-300'}`}>
              {s}x
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-slate-700/60 mx-1" />

        {/* Clock */}
        <div className="flex items-center space-x-1.5 px-2 text-xs font-mono">
          <Clock className="w-3 h-3 text-sky-400/70" />
          <span className="text-sky-300 font-semibold tabular-nums">{(simTimeMs / 1000).toFixed(2)}s</span>
          <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
        </div>

        <div className="w-px h-6 bg-slate-700/60 mx-1" />

        {/* Quick Actions */}
        <button onClick={() => setInjectOpen(!injectOpen)} className={`p-2 rounded-xl transition-all ${injectOpen ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-sky-300 hover:bg-slate-700/50'}`} title="Inject Packet">
          <Send className="w-3.5 h-3.5" />
        </button>
        <button onClick={onToggle3D} className={`p-2 rounded-xl transition-all ${is3DMode ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-amber-300 hover:bg-slate-700/50'}`} title={is3DMode ? 'Switch to 2D' : 'Switch to 3D'}>
          <Box className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setTermOpen(!termOpen)} className={`p-2 rounded-xl transition-all ${termOpen ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400 hover:text-purple-300 hover:bg-slate-700/50'}`} title="Event Console">
          <Terminal className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

