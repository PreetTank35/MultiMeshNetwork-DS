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
  onAddNode
}) => {
  const [termOpen, setTermOpen] = useState(false);
  const [injectOpen, setInjectOpen] = useState(false);
  const [srcId, setSrcId] = useState('');
  const [dstId, setDstId] = useState('');
  const [payloadText, setPayloadText] = useState('Smart Sensor Telemetry');
  const speeds = [0.2, 0.5, 1.0, 2.0, 5.0];
  const aliveNodes = nodes.filter(n => n.isAlive);

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none select-none">
      {/* Collapsible Neomorphic Live Event Console */}
      {termOpen && (
        <div className="neu-convex rounded-2xl shadow-2xl mb-3 w-[660px] max-h-56 overflow-hidden pointer-events-auto border border-neu-border animate-fade-up">
          <div className="flex items-center justify-between px-4 py-2 border-b border-neu-border bg-neu-base/60">
            <div className="flex items-center space-x-2">
              <Terminal className="w-3.5 h-3.5 text-cyan-400 neu-led-route" />
              <span className="text-[11px] font-mono font-semibold text-slate-200">
                Discrete-Event Trace Terminal ({logs.length} events)
              </span>
            </div>
            <button
              onClick={() => setTermOpen(false)}
              className="p-1 rounded-lg neu-button-sm text-slate-400 hover:text-white"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="neu-pressed m-2 rounded-xl p-2.5 max-h-40 overflow-y-auto font-mono text-[10px] space-y-1 custom-scrollbar border border-black/30">
            {logs.length === 0 ? (
              <div className="text-slate-500 py-6 text-center italic">
                Ready for event emission. Inject a packet or resume playback to record discrete steps.
              </div>
            ) : (
              logs.slice(0, 80).map((log, i) => (
                <div key={i} className="flex space-x-2 leading-relaxed items-baseline">
                  <span className="text-cyan-500/70 select-none shrink-0 font-bold">[{log.timestamp}ms]</span>
                  <span
                    className={
                      log.level === 'success'
                        ? 'text-emerald-400'
                        : log.level === 'error'
                        ? 'text-red-400 font-semibold'
                        : log.level === 'warn'
                        ? 'text-amber-400'
                        : log.level === 'gateway'
                        ? 'text-cyan-300 font-bold'
                        : 'text-slate-300'
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

      {/* Tactile Neomorphic Packet Injection Console */}
      {injectOpen && (
        <div className="neu-convex rounded-2xl shadow-2xl mb-3 p-4 pointer-events-auto border border-neu-border animate-fade-up w-[660px]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-slate-200 flex items-center space-x-2">
              <Radio className="w-3.5 h-3.5 text-blue-400 neu-led-wifi" />
              <span>Direct RF Packet Injection Engine</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Cross-Domain L3 / MAC Flow</span>
          </div>
          <div className="flex items-center space-x-2.5 text-xs">
            <div className="neu-pressed rounded-xl p-1 flex-1 border border-black/20">
              <select
                value={srcId}
                onChange={e => setSrcId(e.target.value)}
                className="w-full bg-transparent px-2.5 py-1 text-slate-200 text-xs focus:outline-none font-mono"
              >
                <option value="" className="bg-neu-base text-slate-400">Select Source Node…</option>
                {aliveNodes.map(n => (
                  <option key={n.id} value={n.id} className="bg-neu-base text-slate-200">
                    {n.name} ({submeshes.find(s => s.id === n.submeshId)?.name || 'Mesh'})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-slate-500 font-bold text-sm">→</span>

            <div className="neu-pressed rounded-xl p-1 flex-1 border border-black/20">
              <select
                value={dstId}
                onChange={e => setDstId(e.target.value)}
                className="w-full bg-transparent px-2.5 py-1 text-slate-200 text-xs focus:outline-none font-mono"
              >
                <option value="" className="bg-neu-base text-slate-400">Select Destination…</option>
                {aliveNodes.filter(n => n.id !== srcId).map(n => (
                  <option key={n.id} value={n.id} className="bg-neu-base text-slate-200">
                    {n.name} ({submeshes.find(s => s.id === n.submeshId)?.name || 'Mesh'})
                  </option>
                ))}
              </select>
            </div>

            <button
              disabled={!srcId || !dstId}
              onClick={() => {
                onInjectPacket(srcId, dstId, payloadText);
                setInjectOpen(false);
              }}
              className="neu-button px-4 py-2 rounded-xl text-white font-semibold text-xs transition-all flex items-center space-x-1.5 disabled:opacity-30 disabled:pointer-events-none hover:shadow-[0_0_15px_rgba(37,99,235,0.4)] text-blue-400"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Emit Frame</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Floating Tactile Cockpit Dock */}
      <div className="neu-convex rounded-2xl shadow-2xl px-3 py-2 flex items-center space-x-2 pointer-events-auto border border-neu-border">
        {/* Play / Pause Tactile Button */}
        <button
          onClick={onTogglePlay}
          className={`p-2.5 rounded-xl transition-all ${
            isRunning
              ? 'neu-pressed text-amber-300 border border-amber-500/30 shadow-[0_0_12px_rgba(217,119,6,0.25)]'
              : 'neu-button text-cyan-300 hover:text-white'
          }`}
          title={isRunning ? 'Pause Discrete Engine' : 'Resume Playback'}
        >
          {isRunning ? <Pause className="w-4 h-4 fill-amber-300" /> : <Play className="w-4 h-4 fill-cyan-400 ml-0.5" />}
        </button>

        {/* Step Forward 1 Hop */}
        <button
          onClick={onStepForward}
          disabled={isRunning}
          className="p-2.5 rounded-xl neu-button text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
          title="Step +1 Discrete Hop (30ms delta)"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <div className="w-px h-7 bg-slate-700/50 mx-1" />

        {/* Recessed Speed Multiplier Rail */}
        <div className="flex items-center neu-pressed rounded-xl p-1 border border-black/20">
          {speeds.map(s => {
            const isSel = speedMultiplier === s;
            return (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-all ${
                  isSel
                    ? 'neu-button text-cyan-300 font-bold shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            );
          })}
        </div>

        <div className="w-px h-7 bg-slate-700/50 mx-1" />

        {/* Digital LCD Clock Panel */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl neu-pressed border border-black/20 text-xs font-mono">
          <Clock className="w-3.5 h-3.5 text-cyan-400/80" />
          <span className="text-cyan-300 font-bold tracking-wider tabular-nums">
            {(simTimeMs / 1000).toFixed(2)}s
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              isRunning ? 'bg-emerald-400 neu-led-iot animate-beacon' : 'bg-amber-400 neu-led-gateway'
            }`}
          />
        </div>

        <div className="w-px h-7 bg-slate-700/50 mx-1" />

        {/* Action Buttons: Inject, 3D, Console */}
        <button
          onClick={() => setInjectOpen(!injectOpen)}
          className={`p-2.5 rounded-xl transition-all ${
            injectOpen
              ? 'neu-pressed text-blue-400 border border-blue-500/30'
              : 'neu-button text-slate-300 hover:text-blue-400'
          }`}
          title="Inject RF Packet"
        >
          <Send className="w-4 h-4" />
        </button>

        <button
          onClick={onToggle3D}
          className={`p-2.5 rounded-xl transition-all ${
            is3DMode
              ? 'neu-pressed text-amber-300 border border-amber-500/30'
              : 'neu-button text-slate-300 hover:text-amber-300'
          }`}
          title={is3DMode ? 'Switch to 2D Blueprint Canvas' : 'Switch to 3D Isometric View'}
        >
          <Box className="w-4 h-4" />
        </button>

        <button
          onClick={() => setTermOpen(!termOpen)}
          className={`p-2.5 rounded-xl transition-all ${
            termOpen
              ? 'neu-pressed text-purple-300 border border-purple-500/30'
              : 'neu-button text-slate-300 hover:text-purple-300'
          }`}
          title="Toggle Discrete Trace Console"
        >
          <Terminal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
