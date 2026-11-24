import React from 'react';
import { Globe, Microscope, BarChart3, BookOpen, MonitorPlay, Download, RotateCcw, ChevronDown, Zap } from 'lucide-react';

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

const tabs: Array<{ id: ViewTab; label: string; icon: React.ReactNode }> = [
  { id: 'canvas', label: 'Topology Canvas', icon: <Globe className="w-3.5 h-3.5" /> },
  { id: 'studio', label: 'Packet X-Ray', icon: <Microscope className="w-3.5 h-3.5" /> },
  { id: 'telemetry', label: 'Telemetry Hub', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: 'guide', label: 'Interactive Guide', icon: <BookOpen className="w-3.5 h-3.5" /> },
];

export const TopNavbar: React.FC<Props> = ({ activeTab, onChangeTab, onLoadScenario, isPresentationMode, onTogglePresentationMode, onExportJSON, onReset }) => {
  const [scenarioOpen, setScenarioOpen] = React.useState(false);

  return (
    <header className="h-12 bg-canvas-deep/95 backdrop-blur-md border-b border-slate-800/60 flex items-center justify-between px-4 z-50 select-none shrink-0">
      {/* Left: Brand + Scenario */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="font-bold text-sm text-slate-100 tracking-wide whitespace-nowrap">MultiMesh Studio</span>
          <span className="text-[10px] text-slate-500 font-mono hidden lg:inline">MIT AOE • Data Comm Lab</span>
        </div>

        <div className="relative">
          <button onClick={() => setScenarioOpen(!scenarioOpen)} className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800/70 border border-slate-700/50 text-xs text-slate-300 hover:bg-slate-700/70 transition-colors">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Scenarios</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>
          {scenarioOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-64 glass rounded-xl shadow-2xl p-1.5 z-50 animate-fade-up">
              <button onClick={() => { onLoadScenario('smart_campus'); setScenarioOpen(false); }} className="w-full text-left p-2.5 rounded-lg hover:bg-slate-700/60 transition-colors">
                <div className="font-semibold text-xs text-slate-200">Smart Campus Multi-Mesh</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Wi-Fi 6 (5.2 GHz) + IoT Thread (2.4 GHz) via MRMC gateways</div>
              </button>
              <button onClick={() => { onLoadScenario('monolithic'); setScenarioOpen(false); }} className="w-full text-left p-2.5 rounded-lg hover:bg-slate-700/60 transition-colors">
                <div className="font-semibold text-xs text-slate-200">Monolithic Capacity Breakdown</div>
                <div className="text-[10px] text-slate-400 mt-0.5">16-node single-domain mesh showing Gupta-Kumar collapse</div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center: View Tabs */}
      <nav className="flex items-center bg-slate-900/80 p-0.5 rounded-lg border border-slate-800/60">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => onChangeTab(tab.id)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-sky-500/20 text-sky-300 shadow-sm shadow-sky-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}>
            {tab.icon}
            <span className="hidden md:inline">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Right: Controls */}
      <div className="flex items-center space-x-1.5">
        <button onClick={onTogglePresentationMode}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all border ${
            isPresentationMode ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200'
          }`}>
          <MonitorPlay className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isPresentationMode ? 'Exit Presentation' : 'Present'}</span>
        </button>
        <button onClick={onExportJSON} className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-emerald-400 transition-colors" title="Export JSON">
          <Download className="w-3.5 h-3.5" />
        </button>
        <button onClick={onReset} className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-red-400 transition-colors" title="Reset">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};

