/**
 * NetworkBuilderToolbar — Fixed-Size Static Neomorphic Construction Toolbar
 * Anchored statically at top-left; never resizes or shifts when nodes/domains are added.
 */

import React, { useRef, useState } from 'react';
import { BuilderTool, NodeType, SubMeshDomain } from '../../types/simulator';
import {
  MousePointer,
  Link2,
  Trash2,
  Save,
  Download,
  Upload,
  Radio,
  Layers,
  ChevronDown,
  FolderOpen,
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
      if (content) onImportJSON(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleNodeAddClick = (type: NodeType) => {
    if (activeSubmesh) onAddNode(type, activeSubmesh.id);
    setShowNodeMenu(false);
  };

  return (
    <>
      {/* Fixed Top-Left Static Single-Row Toolbar */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2 p-2 rounded-2xl neu-convex pointer-events-auto select-none">
        {/* Select */}
        <button
          type="button"
          onClick={() => onChangeTool('select')}
          title="Pointer / Select & Move Mode"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap ${
            activeTool === 'select'
              ? 'neu-pressed text-sky-600 dark:text-cyan-400'
              : 'neu-button-sm text-neu-muted hover:text-neu-text'
          }`}
        >
          <MousePointer className="w-4 h-4" />
          <span>Select</span>
        </button>

        {/* Link */}
        <button
          type="button"
          onClick={() => onChangeTool(activeTool === 'connect_link' ? 'select' : 'connect_link')}
          title="Connect Wireless Link (Click Node A -> Click Node B)"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap ${
            activeTool === 'connect_link'
              ? 'neu-pressed text-amber-600 dark:text-amber-400'
              : 'neu-button-sm text-neu-muted hover:text-neu-text'
          }`}
        >
          <Link2 className="w-4 h-4" />
          <span>Link</span>
        </button>

        <div className="w-[1px] h-6 bg-neu-muted/20 mx-0.5" />

        {/* Add Node Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNodeMenu(!showNodeMenu)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap ${
              showNodeMenu ? 'neu-pressed text-emerald-600 dark:text-emerald-400' : 'neu-button-sm text-neu-text'
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Add Node</span>
            <ChevronDown className={`w-3.5 h-3.5 text-neu-muted transition-transform ${showNodeMenu ? 'rotate-180' : ''}`} />
          </button>

          {showNodeMenu && (
            <div className="absolute left-0 top-full mt-2.5 w-64 rounded-2xl p-2.5 z-50 neu-convex flex flex-col gap-1.5 animate-fade-up">
              <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-neu-muted truncate">
                Into: {activeSubmesh?.name || 'Default'}
              </div>

              <button
                type="button"
                onClick={() => handleNodeAddClick('router')}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-left hover:neu-pressed transition-all"
              >
                <div className="w-7 h-7 rounded-lg neu-pressed-sm text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                  △
                </div>
                <div>
                  <div className="font-bold text-neu-text text-[13px]">Mesh Router</div>
                  <div className="text-[11px] text-neu-muted">Multi-hop wireless forwarder</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleNodeAddClick('gateway')}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-left hover:neu-pressed transition-all"
              >
                <div className="w-7 h-7 rounded-lg neu-pressed-sm text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                  ⟡
                </div>
                <div>
                  <div className="font-bold text-neu-text text-[13px]">Border Gateway</div>
                  <div className="text-[11px] text-neu-muted">Dual-radio MRMC bridge</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleNodeAddClick('sensor')}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-left hover:neu-pressed transition-all"
              >
                <div className="w-7 h-7 rounded-lg neu-pressed-sm text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                  ●
                </div>
                <div>
                  <div className="font-bold text-neu-text text-[13px]">IoT Sensor</div>
                  <div className="text-[11px] text-neu-muted">Constrained telemetry leaf</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleNodeAddClick('mobile')}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-left hover:neu-pressed transition-all"
              >
                <div className="w-7 h-7 rounded-lg neu-pressed-sm text-sky-600 dark:text-cyan-400 flex items-center justify-center font-bold text-sm">
                  ✦
                </div>
                <div>
                  <div className="font-bold text-neu-text text-[13px]">Mobile Unit</div>
                  <div className="text-[11px] text-neu-muted">Dynamic waypoint rover</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Fixed-Width Sub-Mesh Domain Picker */}
        {submeshes.length > 0 && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl neu-select text-xs w-[180px]">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: activeSubmesh?.color || '#2563EB' }}
            />
            <select
              value={selectedSubmeshId}
              onChange={(e) => onSelectSubmeshId(e.target.value)}
              className="bg-transparent text-neu-text font-semibold focus:outline-none cursor-pointer w-full truncate text-xs"
            >
              {submeshes.map((sm) => (
                <option key={sm.id} value={sm.id}>
                  {sm.name} ({sm.protocol})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* + Sub-Mesh */}
        <button
          type="button"
          onClick={onOpenSubMeshModal}
          title="Instantiate New Sub-Mesh Domain"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold neu-button-sm text-indigo-600 dark:text-indigo-300 whitespace-nowrap"
        >
          <Layers className="w-4 h-4" />
          <span>+ Sub-Mesh</span>
        </button>

        <div className="w-[1px] h-6 bg-neu-muted/20 mx-0.5" />

        {/* Persistence Tools */}
        <button
          type="button"
          onClick={onSaveLocalStorage}
          title="Save Snapshot to Browser"
          className="p-2 rounded-xl neu-button-sm text-neu-muted hover:text-emerald-600 dark:hover:text-emerald-400"
        >
          <Save className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onLoadLocalStorage}
          title="Load Saved Snapshot"
          className="p-2 rounded-xl neu-button-sm text-neu-muted hover:text-sky-600 dark:hover:text-cyan-400"
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onExportJSON}
          title="Export Topology JSON"
          className="p-2 rounded-xl neu-button-sm text-neu-muted hover:text-blue-600 dark:hover:text-blue-400"
        >
          <Download className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Import Topology JSON"
          className="p-2 rounded-xl neu-button-sm text-neu-muted hover:text-purple-600 dark:hover:text-purple-400"
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
            <div className="flex items-center gap-1.5 neu-pressed px-2.5 py-1 rounded-xl">
              <span className="text-xs text-red-600 dark:text-red-400 font-bold">Clear?</span>
              <button
                type="button"
                onClick={() => { onClearCanvas(); setConfirmClear(false); }}
                className="px-2 py-0.5 rounded-lg bg-red-600 text-white text-xs font-bold"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-2 py-0.5 rounded-lg neu-button-sm text-neu-muted text-xs"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              title="Clear Canvas"
              className="p-2 rounded-xl neu-button-sm text-neu-muted hover:text-red-600 dark:hover:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Floating Centered Connect Mode Prompt (Never pushes PathPickerHUD!) */}
      {activeTool === 'connect_link' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-2xl neu-convex text-xs font-semibold text-amber-700 dark:text-amber-300 pointer-events-auto animate-fade-up">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <span>
            {connectSourceId ? (
              <>
                Source selected (<strong>{connectSourceId}</strong>). Click <u>Target Node</u> to connect.
              </>
            ) : (
              'Link Mode: Click Source Node, then click Target Node to connect.'
            )}
          </span>
          <button
            type="button"
            onClick={onCancelConnect}
            className="text-xs font-bold neu-button-sm px-2.5 py-1 rounded-lg text-neu-muted hover:text-neu-text"
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
};
