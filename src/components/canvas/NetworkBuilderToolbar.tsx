/**
 * NetworkBuilderToolbar — Neomorphic Floating Canvas Construction Toolbar
 * Allows operators to dynamically build, connect, configure, and persist multi-mesh topologies.
 */

import React, { useRef, useState } from 'react';
import { BuilderTool, NodeType, SubMeshDomain } from '../../types/simulator';
import {
  MousePointer,
  Link2,
  PlusCircle,
  Trash2,
  Save,
  Download,
  Upload,
  Radio,
  Layers,
  ChevronDown,
  FolderOpen,
  Wifi,
  Globe,
  Cpu,
  Smartphone,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface NetworkBuilderToolbarProps {
  activeTool: BuilderTool;
  onChangeTool: (tool: BuilderTool) => void;
  submeshes: SubMeshDomain[];
  selectedSubmeshId: string;
  onSelectSubmeshId: (id: string) => void;
  onAddNode: (type: NodeType, submeshId: string) => void;
  connectSourceId: string | null;
  onCancelConnect: () => void;
  onOpenSubMeshModal: () => void;
  onClearCanvas: () => void;
  onSaveLocalStorage: () => void;
  onLoadLocalStorage: () => void;
  onExportJSON: () => void;
  onImportJSON: (jsonString: string) => void;
  nodeCount: number;
  linkCount: number;
}

export const NetworkBuilderToolbar: React.FC<NetworkBuilderToolbarProps> = ({
  activeTool,
  onChangeTool,
  submeshes,
  selectedSubmeshId,
  onSelectSubmeshId,
  onAddNode,
  connectSourceId,
  onCancelConnect,
  onOpenSubMeshModal,
  onClearCanvas,
  onSaveLocalStorage,
  onLoadLocalStorage,
  onExportJSON,
  onImportJSON,
  nodeCount,
  linkCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showNodeMenu, setShowNodeMenu] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const activeSubmesh = submeshes.find((s) => s.id === selectedSubmeshId) || submeshes[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onImportJSON(content);
      }
    };
    reader.readAsText(file);
    // Reset file input value
    e.target.value = '';
  };

  const handleNodeAddClick = (type: NodeType) => {
    if (activeSubmesh) {
      onAddNode(type, activeSubmesh.id);
    }
    setShowNodeMenu(false);
  };

  return (
    <div className="absolute top-4 left-4 z-30 flex flex-col gap-2 pointer-events-auto select-none max-w-[calc(100vw-32px)]">
      {/* Primary Toolbar Pill */}
      <div
        className="flex items-center gap-1.5 p-1.5 rounded-2xl border border-slate-700/50 backdrop-blur-md"
        style={{
          background: 'rgba(22, 27, 38, 0.92)',
          boxShadow: '6px 6px 18px #0b0e15, -6px -6px 18px #1f2737',
        }}
      >
        {/* Pointer / Select Tool */}
        <button
          type="button"
          onClick={() => onChangeTool('select')}
          title="Pointer / Select & Move Mode"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTool === 'select'
              ? 'text-cyan-400 border border-cyan-500/40 bg-[#121620]'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
          style={{
            boxShadow:
              activeTool === 'select'
                ? 'inset 2px 2px 5px #090c12, inset -2px -2px 5px #1b2130'
                : '2px 2px 5px #0f121a, -2px -2px 5px #1d2432',
          }}
        >
          <MousePointer className="w-4 h-4" />
          <span className="hidden sm:inline">Select</span>
        </button>

        {/* Connect Link Tool */}
        <button
          type="button"
          onClick={() => onChangeTool(activeTool === 'connect_link' ? 'select' : 'connect_link')}
          title="Connect Wireless Link (Click Node A -> Click Node B)"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTool === 'connect_link'
              ? 'text-amber-400 border border-amber-500/50 bg-[#121620] ring-1 ring-amber-400/30'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
          style={{
            boxShadow:
              activeTool === 'connect_link'
                ? 'inset 2px 2px 5px #090c12, inset -2px -2px 5px #1b2130'
                : '2px 2px 5px #0f121a, -2px -2px 5px #1d2432',
          }}
        >
          <Link2 className="w-4 h-4" />
          <span className="hidden sm:inline">Connect Link</span>
        </button>

        <div className="w-[1px] h-6 bg-slate-800 mx-1" />

        {/* Add Node Dropdown / Quick Tools */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNodeMenu(!showNodeMenu)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-all border border-slate-700/40"
            style={{
              background: '#161B26',
              boxShadow: '3px 3px 6px #0f121a, -3px -3px 6px #1d2432',
            }}
          >
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>Add Node</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Node Selector Menu */}
          {showNodeMenu && (
            <div
              className="absolute left-0 top-full mt-2 w-56 rounded-2xl p-2 z-50 border border-slate-700/50 backdrop-blur-lg flex flex-col gap-1"
              style={{
                background: '#161B26',
                boxShadow: '8px 8px 24px #0a0d14, -8px -8px 24px #222a3c',
              }}
            >
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Target Domain: {activeSubmesh?.name}
              </div>

              <button
                type="button"
                onClick={() => handleNodeAddClick('router')}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-left text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                  △
                </div>
                <div>
                  <div className="font-semibold text-white">Mesh Router</div>
                  <div className="text-[10px] text-slate-400">Wi-Fi multi-hop forwarder</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleNodeAddClick('gateway')}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-left text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                  ⟡
                </div>
                <div>
                  <div className="font-semibold text-white">Border Gateway</div>
                  <div className="text-[10px] text-slate-400">Cross-domain MRMC bridge</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleNodeAddClick('sensor')}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-left text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  ●
                </div>
                <div>
                  <div className="font-semibold text-white">Sensor End Device</div>
                  <div className="text-[10px] text-slate-400">IoT leaf / telemetry sensor</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleNodeAddClick('mobile')}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-left text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">
                  ✦
                </div>
                <div>
                  <div className="font-semibold text-white">Mobile Unit</div>
                  <div className="text-[10px] text-slate-400">Dynamic waypoint mobility</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Sub-Mesh Domain Picker */}
        {submeshes.length > 0 && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/40 border border-slate-800 text-xs">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: activeSubmesh?.color || '#3B82F6' }}
            />
            <select
              value={selectedSubmeshId}
              onChange={(e) => onSelectSubmeshId(e.target.value)}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer max-w-[120px] truncate"
            >
              {submeshes.map((sm) => (
                <option key={sm.id} value={sm.id} className="bg-[#161B26] text-white">
                  {sm.name} ({sm.protocol})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Add Sub-Mesh Button */}
        <button
          type="button"
          onClick={onOpenSubMeshModal}
          title="Instantiate New Sub-Mesh Domain"
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-indigo-300 hover:text-white transition-all border border-indigo-500/20"
          style={{
            background: '#161B26',
            boxShadow: '3px 3px 6px #0f121a, -3px -3px 6px #1d2432',
          }}
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">+ Sub-Mesh</span>
        </button>

        <div className="w-[1px] h-6 bg-slate-800 mx-1" />

        {/* Save to LocalStorage */}
        <button
          type="button"
          onClick={onSaveLocalStorage}
          title="Save Network Snapshot to Browser Storage"
          className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 transition-colors"
          style={{
            background: '#161B26',
            boxShadow: '2px 2px 5px #0f121a, -2px -2px 5px #1d2432',
          }}
        >
          <Save className="w-4 h-4" />
        </button>

        {/* Load from LocalStorage */}
        <button
          type="button"
          onClick={onLoadLocalStorage}
          title="Load Network Snapshot from Browser Storage"
          className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 transition-colors"
          style={{
            background: '#161B26',
            boxShadow: '2px 2px 5px #0f121a, -2px -2px 5px #1d2432',
          }}
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        {/* Export JSON */}
        <button
          type="button"
          onClick={onExportJSON}
          title="Export Network JSON Topology"
          className="p-2 rounded-xl text-slate-400 hover:text-blue-400 transition-colors"
          style={{
            background: '#161B26',
            boxShadow: '2px 2px 5px #0f121a, -2px -2px 5px #1d2432',
          }}
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Import JSON */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Import Topology JSON File"
          className="p-2 rounded-xl text-slate-400 hover:text-purple-400 transition-colors"
          style={{
            background: '#161B26',
            boxShadow: '2px 2px 5px #0f121a, -2px -2px 5px #1d2432',
          }}
        >
          <Upload className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Clear Canvas */}
        <div className="relative">
          {confirmClear ? (
            <div className="flex items-center gap-1 bg-red-950/80 p-1 rounded-xl border border-red-500/50">
              <span className="text-[10px] text-red-300 font-bold px-1">Clear all?</span>
              <button
                type="button"
                onClick={() => {
                  onClearCanvas();
                  setConfirmClear(false);
                }}
                className="px-2 py-0.5 rounded-lg bg-red-600 text-white text-[10px] font-bold"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-1.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[10px]"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              title="Clear Canvas (Remove Nodes & Links)"
              className="p-2 rounded-xl text-slate-400 hover:text-red-400 transition-colors"
              style={{
                background: '#161B26',
                boxShadow: '2px 2px 5px #0f121a, -2px -2px 5px #1d2432',
              }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Active Link Connection Helper Banner */}
      {activeTool === 'connect_link' && (
        <div
          className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl border border-amber-500/40 text-xs font-medium text-amber-200 animate-fade-in"
          style={{
            background: 'rgba(22, 27, 38, 0.95)',
            boxShadow: '4px 4px 12px #0a0d14',
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>
              {connectSourceId ? (
                <>
                  Source Node selected (<span className="text-white font-bold">{connectSourceId}</span>). Now click{' '}
                  <span className="text-amber-300 underline">Target Node</span> to link.
                </>
              ) : (
                'Connect Mode: Click Node 1, then click Node 2 to establish RF link.'
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelConnect}
            className="text-[11px] font-semibold text-slate-400 hover:text-white px-2 py-0.5 rounded-lg bg-slate-800"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Topology summary stats micro-pill */}
      <div className="flex items-center gap-3 px-3 py-1 rounded-xl text-[11px] text-slate-400 bg-slate-900/70 border border-slate-800/80 w-fit backdrop-blur-sm">
        <span>Nodes: <strong className="text-slate-200">{nodeCount}</strong></span>
        <span>•</span>
        <span>Links: <strong className="text-slate-200">{linkCount}</strong></span>
        <span>•</span>
        <span>Domains: <strong className="text-slate-200">{submeshes.length}</strong></span>
      </div>
    </div>
  );
};
