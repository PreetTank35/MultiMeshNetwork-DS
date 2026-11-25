import React, { useState } from 'react';
import { Play, Pause, SkipForward, Clock, Terminal, ChevronDown, Send, Box, Radio } from 'lucide-react';
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
  isRunning,
  simTimeMs,
  speedMultiplier,
  logs,
  nodes,
  submeshes,
  is3DMode,
  onTogglePlay,
  onStepForward,
  onChangeSpeed,
  onInjectPacket,
  onToggle3D,
}) => {
  const [termOpen, setTermOpen] = useState(false);
  const [injectOpen, setInjectOpen] = useState(false);
  const [srcId, setSrcId] = useState('');
  const [dstId, setDstId] = useState('');
  const speeds = [0.2, 0.5, 1.0, 2.0, 5.0];
  const aliveNodes = nodes.filter(n => n.isAlive);

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none select-none">
      {/* Collapsible Live Event Terminal */}
      {termOpen && (
        <div className="neu-convex rounded-2xl mb-3 w-[700px] max-w-[90vw] max-h-60 overflow-hidden pointer-events-auto animate-fade-up">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-neu-border">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
              <span className="text-xs font-mono font-bold text-neu-text">
                Discrete-Event Trace Terminal ({logs.length} events)
              </span>
            </div>
            <button onClick={() => setTermOpen(false)} className="p-1.5 rounded-lg neu-button-sm text-neu-muted hover:text-neu-text">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <div className="neu-pressed m-2.5 rounded-xl p-3 max-h-44 overflow-y-auto font-mono text-[11px] space-y-1.5 custom-scrollbar">
            {logs.length === 0 ? (
              <div className="text-neu-muted py-5 text-center italic">
                Ready for simulation events. Transmit a packet or press Play to record steps.
              </div>
            ) : (
              logs.slice(0, 80).map((log, i) => (
                <div key={i} className="flex space-x-2 leading-relaxed items-baseline">
                  <span className="text-sky-600 dark:text-cyan-400 select-none shrink-0 font-bold">[{log.timestamp}ms]</span>
                  <span
                    className={
                      log.level === 'success'
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : log.level === 'error'
                        ? 'text-red-600 dark:text-red-400 font-semibold'
                        : log.level === 'warn'
                        ? 'text-amber-600 dark:text-amber-400'
                        : log.level === 'gateway'
                        ? 'text-sky-700 dark:text-cyan-300 font-bold'
                        : 'text-neu-text'
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Quick Packet Injection Console */}
      {injectOpen && (
        <div className="neu-convex rounded-2xl mb-3 p-4 pointer-events-auto animate-fade-up w-[700px] max-w-[90vw]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-neu-text flex items-center space-x-2">
              <Radio className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Quick RF Packet Injector</span>
            </span>
            <span className="text-[11px] text-neu-muted font-mono">Cross-Domain Dispatch</span>
          </div>
          <div className="flex items-center space-x-2.5 text-xs">
            <select
              value={srcId}
              onChange={e => setSrcId(e.target.value)}
              className="flex-1 neu-select rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
            >
              <option value="">Select Source…</option>
              {aliveNodes.map(n => (
                <option key={n.id} value={n.id}>
                  {n.name} ({submeshes.find(s => s.id === n.submeshId)?.protocol || 'Mesh'})
                </option>
              ))}
            </select>

            <span className="text-neu-muted font-bold text-sm">→</span>

            <select
              value={dstId}
              onChange={e => setDstId(e.target.value)}
              className="flex-1 neu-select rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
            >
              <option value="">Select Target…</option>
              {aliveNodes.filter(n => n.id !== srcId).map(n => (
                <option key={n.id} value={n.id}>
                  {n.name} ({submeshes.find(s => s.id === n.submeshId)?.protocol || 'Mesh'})
                </option>
              ))}
            </select>

            <button
              disabled={!srcId || !dstId}
              onClick={() => {
                onInjectPacket(srcId, dstId, 'Smart Sensor Telemetry');
                setInjectOpen(false);
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all flex items-center space-x-1.5 disabled:opacity-40 shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Emit</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Tactile Floating Cockpit — Larger & Crisp */}
      <div className="neu-convex rounded-2xl px-3.5 py-2 flex items-center space-x-2 pointer-events-auto">
        <button
          onClick={onTogglePlay}
          className={`p-2.5 rounded-xl transition-all ${
            isRunning ? 'neu-pressed text-amber-600 dark:text-amber-300' : 'neu-button text-sky-600 dark:text-cyan-400'
          }`}
          title={isRunning ? 'Pause Simulation' : 'Play Simulation'}
        >
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <button
          onClick={onStepForward}
          disabled={isRunning}
          className="p-2.5 rounded-xl neu-button text-neu-muted hover:text-neu-text disabled:opacity-30 transition-all"
          title="Step +1 Discrete Hop"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <div className="w-px h-7 bg-neu-muted/20 mx-1" />

        <div className="flex items-center neu-pressed rounded-xl p-1 gap-0.5">
          {speeds.map(s => {
            const isSel = speedMultiplier === s;
            return (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                  isSel
                    ? 'neu-button text-sky-600 dark:text-cyan-300 font-bold'
                    : 'text-neu-muted hover:text-neu-text'
                }`}
              >
                {s}x
              </button>
            );
          })}
        </div>

        <div className="w-px h-7 bg-neu-muted/20 mx-1" />

        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl neu-pressed text-xs font-mono">
          <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
          <span className="text-neu-text font-bold tabular-nums">{(simTimeMs / 1000).toFixed(2)}s</span>
          <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 neu-led-iot animate-beacon' : 'bg-amber-500 neu-led-gateway'}`} />
        </div>

        <div className="w-px h-7 bg-neu-muted/20 mx-1" />

        <button
          onClick={() => setInjectOpen(!injectOpen)}
          className={`p-2.5 rounded-xl transition-all ${
            injectOpen ? 'neu-pressed text-blue-600 dark:text-blue-400' : 'neu-button text-neu-muted hover:text-blue-600 dark:hover:text-blue-400'
          }`}
          title="Quick Inject Packet"
        >
          <Send className="w-4 h-4" />
        </button>

        <button
          onClick={onToggle3D}
          className={`p-2.5 rounded-xl transition-all ${
            is3DMode ? 'neu-pressed text-amber-600 dark:text-amber-300' : 'neu-button text-neu-muted hover:text-amber-600 dark:hover:text-amber-300'
          }`}
          title={is3DMode ? 'Switch to 2D Blueprint' : 'Switch to 3D Isometric'}
        >
          <Box className="w-4 h-4" />
        </button>

        <button
          onClick={() => setTermOpen(!termOpen)}
          className={`p-2.5 rounded-xl transition-all ${
            termOpen ? 'neu-pressed text-purple-600 dark:text-purple-300' : 'neu-button text-neu-muted hover:text-purple-600 dark:hover:text-purple-300'
          }`}
          title="Event Console"
        >
          <Terminal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
