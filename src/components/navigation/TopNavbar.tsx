import React, { useState } from 'react';
import {
  Globe,
  Microscope,
  BarChart3,
  BookOpen,
  MonitorPlay,
  Download,
  RotateCcw,
  ChevronDown,
  Zap,
  Activity,
  Sun,
  Moon,
} from 'lucide-react';

export type ViewTab = 'canvas' | 'studio' | 'telemetry' | 'guide';

interface Props {
  activeTab: ViewTab;
  onChangeTab: (tab: ViewTab) => void;
  onLoadScenario: (s: 'smart_campus' | 'smart_logistics' | 'monolithic') => void;
  isPresentationMode: boolean;
  onTogglePresentationMode: () => void;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
  onExportJSON: () => void;
  onReset: () => void;
}

const tabs: Array<{ id: ViewTab; label: string; icon: React.ReactNode; accent: string }> = [
  { id: 'canvas', label: 'Topology Canvas', icon: <Globe className="w-3.5 h-3.5" />, accent: 'text-sky-600 dark:text-cyan-400' },
  { id: 'studio', label: 'Packet X-Ray', icon: <Microscope className="w-3.5 h-3.5" />, accent: 'text-blue-600 dark:text-blue-400' },
  { id: 'telemetry', label: 'Telemetry Hub', icon: <BarChart3 className="w-3.5 h-3.5" />, accent: 'text-emerald-600 dark:text-emerald-400' },
  { id: 'guide', label: 'How It Works', icon: <BookOpen className="w-3.5 h-3.5" />, accent: 'text-amber-600 dark:text-amber-400' },
];

export const TopNavbar: React.FC<Props> = ({
  activeTab,
  onChangeTab,
  onLoadScenario,
  isPresentationMode,
  onTogglePresentationMode,
  isDarkTheme,
  onToggleTheme,
  onExportJSON,
  onReset,
}) => {
  const [scenarioOpen, setScenarioOpen] = useState(false);

  return (
    <header className="h-14 neu-base border-b border-neu-border flex items-center justify-between px-4 z-50 select-none shrink-0">
      {/* Left: Brand + Scenario Selector */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2.5 px-3 py-1.5 rounded-2xl neu-convex-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 neu-led-route animate-beacon" />
          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-xs text-neu-text tracking-wider uppercase">MultiMesh Studio</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-md neu-pressed-sm text-sky-600 dark:text-cyan-400 font-mono font-bold">
                V3
              </span>
            </div>
            <span className="text-[9px] text-neu-muted font-mono tracking-tight hidden xl:inline">
              Cyber-Physical Simulation Lab • MIT AOE
            </span>
          </div>
        </div>

        {/* Scenarios Dropdown */}
        <div className="relative">
          <button
            onClick={() => setScenarioOpen(!scenarioOpen)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              scenarioOpen ? 'neu-pressed text-amber-600 dark:text-amber-300' : 'neu-button text-neu-text'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Scenarios</span>
            <ChevronDown className={`w-3 h-3 text-neu-muted transition-transform duration-200 ${scenarioOpen ? 'rotate-180' : ''}`} />
          </button>

          {scenarioOpen && (
            <div className="absolute top-full left-0 mt-2.5 w-76 neu-convex rounded-2xl p-2 z-50 animate-fade-up">
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-neu-muted flex items-center justify-between">
                <span>Select Blueprint Topology</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              </div>

              <button
                onClick={() => { onLoadScenario('smart_campus'); setScenarioOpen(false); }}
                className="w-full text-left p-2.5 rounded-xl mt-1 hover:neu-pressed transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs text-neu-text group-hover:text-blue-600 dark:group-hover:text-cyan-300 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 neu-led-wifi" />
                    <span>MIT AOE Smart Campus</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md neu-pressed-sm text-blue-600 dark:text-blue-300 font-mono font-bold">
                    MRMC
                  </span>
                </div>
                <div className="text-[10px] text-neu-muted mt-1 pl-4 leading-relaxed">
                  Wi-Fi 6 (5.2 GHz) + IoT Thread (2.4 GHz) across campus wing & courtyard
                </div>
              </button>

              <button
                onClick={() => { onLoadScenario('smart_logistics'); setScenarioOpen(false); }}
                className="w-full text-left p-2.5 rounded-xl mt-1 hover:neu-pressed transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs text-neu-text group-hover:text-amber-600 dark:group-hover:text-amber-300 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 neu-led-gateway" />
                    <span>Smart Industrial Logistics</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md neu-pressed-sm text-amber-600 dark:text-amber-300 font-mono font-bold">
                    915MHz
                  </span>
                </div>
                <div className="text-[10px] text-neu-muted mt-1 pl-4 leading-relaxed">
                  AGV transit corridor + high-bay 915MHz warehouse rack telemetry
                </div>
              </button>

              <button
                onClick={() => { onLoadScenario('monolithic'); setScenarioOpen(false); }}
                className="w-full text-left p-2.5 rounded-xl mt-1 hover:neu-pressed transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs text-neu-text group-hover:text-red-600 dark:group-hover:text-red-300 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 neu-led-failure" />
                    <span>Monolithic Capacity Collapse</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md neu-pressed-sm text-red-600 dark:text-red-300 font-mono font-bold">
                    O(1/√N)
                  </span>
                </div>
                <div className="text-[10px] text-neu-muted mt-1 pl-4 leading-relaxed">
                  16-node flat shared-channel mesh demonstrating Gupta-Kumar collapse
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center: Tactile Recessed View Tabs Rail */}
      <nav className="flex items-center neu-pressed px-1.5 py-1 rounded-2xl gap-1">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isActive ? 'neu-button text-neu-text' : 'text-neu-muted hover:text-neu-text'
              }`}
            >
              <span className={isActive ? tab.accent : 'text-neu-subtle'}>{tab.icon}</span>
              <span className="hidden md:inline">{tab.label}</span>
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-sky-500 neu-led-route ml-0.5" />}
            </button>
          );
        })}
      </nav>

      {/* Right: Controls & Theme Toggle */}
      <div className="flex items-center space-x-2">
        <div className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl neu-pressed-sm text-[10px] font-mono text-neu-muted">
          <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">RF ACTIVE</span>
        </div>

        {/* Light / Dark Neomorph Switch */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-xl neu-button text-neu-muted hover:text-amber-500 transition-colors"
          title={isDarkTheme ? 'Switch to Soft Light Neomorphism' : 'Switch to Obsidian Dark Neomorphism'}
        >
          {isDarkTheme ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
        </button>

        {/* Presentation Mode */}
        <button
          onClick={onTogglePresentationMode}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all ${
            isPresentationMode ? 'neu-pressed text-amber-600 dark:text-amber-300' : 'neu-button text-neu-text'
          }`}
          title={isPresentationMode ? 'Exit Presentation Mode' : 'Enter Presentation Mode'}
        >
          <MonitorPlay className={`w-3.5 h-3.5 ${isPresentationMode ? 'text-amber-500' : 'text-neu-muted'}`} />
          <span className="hidden sm:inline">{isPresentationMode ? 'Exit Stage' : 'Present'}</span>
        </button>

        {/* Export JSON */}
        <button
          onClick={onExportJSON}
          className="p-2 rounded-xl neu-button text-neu-muted hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          title="Export Multi-Mesh JSON Topology"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        {/* Reset Simulation */}
        <button
          onClick={onReset}
          className="p-2 rounded-xl neu-button text-neu-muted hover:text-red-600 dark:hover:text-red-400 transition-colors"
          title="Reset Simulation State"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
