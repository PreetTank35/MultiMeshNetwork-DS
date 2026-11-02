/**
 * Left Component Dock & Scenario Manager
 * Provides node templates, topology scenario presets, view toggles, and tutorial launcher
 */

import React from 'react';
import {
  Layers,
  Radio,
  Share2,
  Cpu,
  Smartphone,
  Box,
  Compass,
  BookOpen,
  PlusCircle,
  Eye,
  Activity
} from 'lucide-react';
import { NodeType, SubMeshDomain } from '../../types/simulator';

interface ComponentDockProps {
  submeshes: SubMeshDomain[];
  is3DMode: boolean;
  onToggle3D: () => void;
  onAddNode: (type: NodeType) => void;
  onLoadScenario: (scenario: 'smart_campus' | 'monolithic') => void;
  onOpenTutorials: () => void;
  onOpenTelemetry: () => void;
  isTelemetryOpen: boolean;
}

export const ComponentDock: React.FC<ComponentDockProps> = ({
  submeshes,
  is3DMode,
  onToggle3D,
  onAddNode,
  onLoadScenario,
  onOpenTutorials,
  onOpenTelemetry,
  isTelemetryOpen
}) => {
  return (
    <aside className="w-64 bg-[#1E293B]/95 backdrop-blur-md border-r border-slate-700/60 flex flex-col h-full z-10 text-slate-200 select-none">
      {/* Top Brand & Academic Header */}
      <div className="p-4 border-b border-slate-700/60 bg-[#0F172A]/70">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-sky-500/20 border border-sky-400/40 rounded-lg text-sky-400">
            <Share2 className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-100 tracking-wide">Multi-Mesh Simulator</h1>
            <p className="text-[10px] text-sky-400 font-mono">MIT AOE • Data Comm Lab</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-5 custom-scrollbar text-xs">
        {/* View Mode & Educational Tools */}
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2 px-1">
            Visual & Pedagogy
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={onToggle3D}
              className={`flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-lg border text-xs font-medium transition-all ${
                is3DMode
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 shadow-sm'
                  : 'bg-slate-800/80 border-slate-700/60 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>{is3DMode ? '3D View' : '2D Canvas'}</span>
            </button>

            <button
              onClick={onOpenTutorials}
              className="flex items-center justify-center space-x-1.5 py-2 px-2.5 rounded-lg border border-purple-500/40 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 font-medium transition-all"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Tutorials</span>
            </button>
          </div>

          <button
            onClick={onOpenTelemetry}
            className={`w-full mt-2 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
              isTelemetryOpen
                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                : 'bg-slate-800/80 border-slate-700/60 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Telemetry Dashboard</span>
          </button>
        </div>

        {/* Academic Benchmark Scenarios */}
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2 px-1">
            Academic Benchmarks
          </span>
          <div className="space-y-1.5">
            <button
              onClick={() => onLoadScenario('smart_campus')}
              className="w-full text-left p-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700/70 transition-all hover:border-sky-500/50 group"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-semibold text-slate-200 group-hover:text-sky-300 transition-colors">
                  1. Smart Campus
                </span>
                <span className="px-1.5 py-0.2 bg-sky-500/20 text-sky-400 rounded text-[9px] font-mono">
                  Multi-Mesh
                </span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-2">
                Wi-Fi 6 (5.2 GHz) + IoT Sensor Mesh (2.4 GHz) via dual MRMC gateways.
              </p>
            </button>

            <button
              onClick={() => onLoadScenario('monolithic')}
              className="w-full text-left p-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700/70 transition-all hover:border-red-500/50 group"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-semibold text-slate-200 group-hover:text-red-300 transition-colors">
                  2. Monolithic Failure
                </span>
                <span className="px-1.5 py-0.2 bg-red-500/20 text-red-400 rounded text-[9px] font-mono">
                  Gupta-Kumar
                </span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-2">
                Single-domain 16-node mesh demonstrating severe contention & capacity collapse.
              </p>
            </button>
          </div>
        </div>

        {/* Instantiate Node Palette */}
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2 px-1">
            Add Network Nodes
          </span>
          <div className="space-y-1.5">
            <button
              onClick={() => onAddNode('router')}
              className="w-full flex items-center space-x-2.5 p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 transition-colors text-slate-200 hover:text-sky-300"
            >
              <div className="p-1 rounded bg-sky-500/20 text-sky-400">
                <Radio className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <div className="font-medium">Mesh Router</div>
                <div className="text-[10px] text-slate-400">Relays multi-hop packets</div>
              </div>
            </button>

            <button
              onClick={() => onAddNode('gateway')}
              className="w-full flex items-center space-x-2.5 p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 transition-colors text-slate-200 hover:text-amber-300"
            >
              <div className="p-1 rounded bg-amber-500/20 text-amber-400">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <div className="font-medium">MRMC Gateway</div>
                <div className="text-[10px] text-slate-400">Dual-radio inter-mesh bridge</div>
              </div>
            </button>

            <button
              onClick={() => onAddNode('sensor')}
              className="w-full flex items-center space-x-2.5 p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 transition-colors text-slate-200 hover:text-emerald-300"
            >
              <div className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <div className="font-medium">IoT Sensor End Device</div>
                <div className="text-[10px] text-slate-400">Constrained telemetry node</div>
              </div>
            </button>

            <button
              onClick={() => onAddNode('mobile')}
              className="w-full flex items-center space-x-2.5 p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 transition-colors text-slate-200 hover:text-purple-300"
            >
              <div className="p-1 rounded bg-purple-500/20 text-purple-400">
                <Compass className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <div className="font-medium">Mobile Rover / Client</div>
                <div className="text-[10px] text-slate-400">Random waypoint kinematics</div>
              </div>
            </button>
          </div>
        </div>

        {/* Active Sub-Mesh Domains Legend */}
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2 px-1">
            Sub-Mesh Domains ({submeshes.length})
          </span>
          <div className="space-y-1.5">
            {submeshes.map(sm => (
              <div
                key={sm.id}
                className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sm.color }} />
                  <div>
                    <div className="font-medium text-slate-300">{sm.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {sm.protocol} • {sm.frequencyBand}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-700/60 bg-[#0F172A]/70 text-[10px] text-slate-400 font-mono text-center">
        Discrete-Event Core v1.0 • 60 FPS
      </div>
    </aside>
  );
};
