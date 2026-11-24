import React, { useState } from 'react';
import { Globe, Microscope, BarChart3, BookOpen, MonitorPlay, Download, RotateCcw, ChevronDown, Zap, Activity, ShieldCheck } from 'lucide-react';

export type ViewTab = 'canvas' | 'studio' | 'telemetry' | 'guide';

interface Props {
  activeTab: ViewTab;
  onChangeTab: (tab: ViewTab) => void;
  onLoadScenario: (s: 'smart_campus' | 'monolithic') => void;
  isPresentationMode: boolean;
  onTogglePresentationMode: () => void;
  onExportJSON: () => void;
  onReset: () => void;
}

const tabs: Array<{ id: ViewTab; label: string; icon: React.ReactNode; accent: string }> = [
  { id: 'canvas', label: 'Topology Canvas', icon: <Globe className="w-3.5 h-3.5" />, accent: 'text-cyan-400' },
  { id: 'studio', label: 'Packet X-Ray', icon: <Microscope className="w-3.5 h-3.5" />, accent: 'text-blue-400' },
  { id: 'telemetry', label: 'Telemetry Hub', icon: <BarChart3 className="w-3.5 h-3.5" />, accent: 'text-emerald-400' },
  { id: 'guide', label: 'Interactive Guide', icon: <BookOpen className="w-3.5 h-3.5" />, accent: 'text-amber-400' },
];

export const TopNavbar: React.FC<Props> = ({
  activeTab,
  onChangeTab,
  onLoadScenario,
  isPresentationMode,
  onTogglePresentationMode,
  onExportJSON,
  onReset
}) => {
  const [scenarioOpen, setScenarioOpen] = useState(false);

  return (
    <header className="h-14 bg-neu-base border-b border-neu-border flex items-center justify-between px-4 z-50 select-none shrink-0 shadow-[0_4px_16px_rgba(10,13,19,0.8)]">
      {/* Left: Brand + Lab Badge + Scenario Selector */}
      <div className="flex items-center space-x-3.5">
        {/* Lab Emblem */}
        <div className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl neu-convex">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 neu-led-route animate-beacon" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-xs text-slate-100 tracking-wider uppercase">MultiMesh Studio</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 font-mono">v2.4</span>
            </div>
            <span className="text-[9px] text-slate-400 font-mono tracking-tight hidden lg:inline">
              Cyber-Physical Simulation Lab • MIT AOE
            </span>
          </div>
        </div>

        {/* Scenarios Dropdown */}
        <div className="relative">
          <button
            onClick={() => setScenarioOpen(!scenarioOpen)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-200 transition-all ${
              scenarioOpen ? 'neu-pressed text-amber-300' : 'neu-button hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 neu-led-gateway" />
            <span>Scenarios</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${scenarioOpen ? 'rotate-180' : ''}`} />
          </button>

          {scenarioOpen && (
            <div className="absolute top-full left-0 mt-2 w-72 neu-convex rounded-2xl shadow-2xl p-2 z-50 border border-neu-border animate-fade-up">
              <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Select Architecture</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              </div>

              <button
                onClick={() => { onLoadScenario('smart_campus'); setScenarioOpen(false); }}
                className="w-full text-left p-2.5 rounded-xl mt-1 hover:neu-pressed transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs text-slate-200 group-hover:text-cyan-300 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 neu-led-wifi" />
                    <span>Smart Campus Multi-Mesh</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40 font-mono">MRMC</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 pl-3.5 leading-relaxed">
                  Wi-Fi 6 (5.2 GHz) + IoT Thread (2.4 GHz) with boundary gateway translation
                </div>
              </button>

              <button
                onClick={() => { onLoadScenario('monolithic'); setScenarioOpen(false); }}
                className="w-full text-left p-2.5 rounded-xl mt-1.5 hover:neu-pressed transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs text-slate-200 group-hover:text-red-300 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 neu-led-failure" />
                    <span>Monolithic Capacity Breakdown</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-950/60 text-red-300 border border-red-800/40 font-mono">Collapse</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 pl-3.5 leading-relaxed">
                  16-node single-domain mesh demonstrating Gupta-Kumar asymptotic throughput collapse
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center: Tactile Recessed View Tabs Rail */}
      <nav className="flex items-center neu-pressed px-1.5 py-1 rounded-2xl border border-neu-border">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all relative ${
                isActive
                  ? 'neu-button text-slate-100 shadow-[0_0_12px_rgba(6,182,212,0.25)] border-t border-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:neu-convex-sm'
              }`}
            >
              <span className={isActive ? tab.accent : 'text-slate-500'}>{tab.icon}</span>
              <span className="hidden md:inline">{tab.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 neu-led-route ml-0.5" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Right: Tactile Lab Controls & Status */}
      <div className="flex items-center space-x-2">
        {/* Lab Status LED indicator */}
        <div className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-xl neu-pressed text-[10px] font-mono text-slate-400 border border-neu-border">
          <Activity className="w-3 h-3 text-emerald-400 neu-led-iot animate-pulse" />
          <span className="text-emerald-400 font-bold">RF ENGINE ACTIVE</span>
        </div>

        {/* Presentation Mode */}
        <button
          onClick={onTogglePresentationMode}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-all ${
            isPresentationMode
              ? 'neu-pressed text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(217,119,6,0.3)]'
              : 'neu-button text-slate-300 hover:text-white'
          }`}
          title={isPresentationMode ? 'Exit Presentation Mode' : 'Enter Presentation Mode'}
        >
          <MonitorPlay className={`w-3.5 h-3.5 ${isPresentationMode ? 'text-amber-400 neu-led-gateway' : 'text-slate-400'}`} />
          <span className="hidden sm:inline">{isPresentationMode ? 'Exit Stage' : 'Present'}</span>
        </button>

        {/* Export JSON */}
        <button
          onClick={onExportJSON}
          className="p-2 rounded-xl neu-button text-slate-300 hover:text-emerald-400 transition-colors"
          title="Export Multi-Mesh JSON Topology"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        {/* Reset Simulation */}
        <button
          onClick={onReset}
          className="p-2 rounded-xl neu-button text-slate-300 hover:text-red-400 transition-colors"
          title="Reset Simulation State"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
