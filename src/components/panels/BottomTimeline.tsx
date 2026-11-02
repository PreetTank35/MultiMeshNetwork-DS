/**
 * Bottom Timeline Bar & Media Player Control
 * Implements Chapter 1.A, Table 5.1:
 * Play/pause, step-forward, time slider, speed multipliers (0.1x to 5x),
 * and live discrete-event trace log table with JSON schema export.
 */

import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Download,
  Terminal,
  Clock,
  Layers,
  FileJson,
  CheckCircle,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { SimulationStepLog } from '../../core/engine/discreteEventEngine';
import { TopologyExportJSON } from '../../types/simulator';

interface BottomTimelineProps {
  isRunning: boolean;
  simTimeMs: number;
  speedMultiplier: number;
  logs: SimulationStepLog[];
  onTogglePlay: () => void;
  onStepForward: () => void;
  onReset: () => void;
  onChangeSpeed: (speed: number) => void;
  onExportJSON: () => void;
}

export const BottomTimeline: React.FC<BottomTimelineProps> = ({
  isRunning,
  simTimeMs,
  speedMultiplier,
  logs,
  onTogglePlay,
  onStepForward,
  onReset,
  onChangeSpeed,
  onExportJSON
}) => {
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [isLogExpanded, setIsLogExpanded] = useState<boolean>(false);

  const filteredLogs = logs.filter(log => {
    if (filterLevel === 'all') return true;
    return log.level === filterLevel;
  });

  return (
    <footer className="bg-[#1E293B]/95 backdrop-blur-md border-t border-slate-700/60 z-20 flex flex-col select-none text-slate-200">
      {/* Upper Timeline Control Bar */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-slate-700/50">
        {/* Left: Playback Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onTogglePlay}
            className={`p-2 rounded-lg font-semibold flex items-center space-x-1.5 transition-all shadow-md ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/30'
            }`}
            title={isRunning ? 'Pause Simulation' : 'Play Simulation'}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            <span className="text-xs">{isRunning ? 'Pause' : 'Play'}</span>
          </button>

          <button
            onClick={onStepForward}
            disabled={isRunning}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-300 transition-colors"
            title="Step Forward (1 Discrete Event)"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={onReset}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="Reset Simulation Clock & Clear Packets"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Speed Multipliers */}
          <div className="flex items-center space-x-1 ml-3 bg-slate-900/80 p-1 rounded-lg border border-slate-700/60 text-xs font-mono">
            {[0.2, 0.5, 1.0, 2.0, 5.0].map(s => (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  speedMultiplier === s ? 'bg-sky-500 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Center: Simulation Clock & Status */}
        <div className="flex items-center space-x-3 bg-slate-900/90 px-3.5 py-1.5 rounded-lg border border-slate-700 font-mono text-xs">
          <Clock className="w-4 h-4 text-sky-400" />
          <span className="text-slate-400">Sim Clock:</span>
          <span className="text-sky-300 font-bold text-sm tracking-wider">
            {(simTimeMs / 1000).toFixed(2)}s ({simTimeMs} ms)
          </span>
          <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
        </div>

        {/* Right: Log Table Toggle & JSON Export */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsLogExpanded(!isLogExpanded)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
              isLogExpanded
                ? 'bg-slate-800 border-sky-500 text-sky-400'
                : 'bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Trace Console ({logs.length})</span>
          </button>

          <button
            onClick={onExportJSON}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors"
            title="Export standardized JSON topology & simulation parameters"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Trace JSON</span>
          </button>
        </div>
      </div>

      {/* Expandable Trace Log Console */}
      {isLogExpanded && (
        <div className="h-44 bg-[#0F172A] p-2 flex flex-col font-mono text-[11px] border-t border-slate-800">
          <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-800 px-2 text-xs">
            <span className="text-slate-400 font-semibold">Discrete-Event Execution Log</span>
            <div className="flex items-center space-x-2">
              <span className="text-slate-500 text-[10px]">Filter:</span>
              {['all', 'info', 'gateway', 'success', 'warn', 'error'].map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setFilterLevel(lvl)}
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                    filterLevel === lvl ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 px-2 custom-scrollbar">
            {filteredLogs.length === 0 ? (
              <div className="text-slate-600 py-4 text-center">No execution events recorded yet.</div>
            ) : (
              filteredLogs.map((log, index) => (
                <div key={index} className="flex items-start space-x-2 leading-relaxed">
                  <span className="text-slate-500 select-none">[{log.timestamp}ms]</span>
                  <span
                    className={
                      log.level === 'success'
                        ? 'text-emerald-400'
                        : log.level === 'warn'
                        ? 'text-amber-400'
                        : log.level === 'error'
                        ? 'text-red-400'
                        : log.level === 'gateway'
                        ? 'text-sky-300 font-semibold'
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
    </footer>
  );
};
