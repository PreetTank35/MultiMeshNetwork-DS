/**
 * Top Navbar Header Component
 * Displays project branding, institution details, presentation mode toggle,
 * and quick academic information.
 */

import React from 'react';
import { Share2, GraduationCap, MonitorPlay, HelpCircle } from 'lucide-react';

interface TopNavbarProps {
  isPresentationMode: boolean;
  onTogglePresentationMode: () => void;
  onOpenTutorials: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  isPresentationMode,
  onTogglePresentationMode,
  onOpenTutorials
}) => {
  return (
    <header className="h-12 bg-[#0F172A] border-b border-slate-700/60 px-4 flex items-center justify-between select-none z-20">
      {/* Left: Project & Institutional Info */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
          <span className="font-bold text-sm text-slate-100 tracking-wide">
            Multi-Mesh Discrete-Event Visualizer
          </span>
        </div>

        <span className="text-slate-600">|</span>

        <div className="flex items-center space-x-1.5 text-xs text-slate-400">
          <GraduationCap className="w-4 h-4 text-sky-400" />
          <span className="font-medium text-slate-300">MIT Academy of Engineering, Pune</span>
          <span className="text-slate-500">•</span>
          <span className="text-[11px] text-slate-400">Preet Tank, Tejas Waghmode, Vansh Thakre</span>
        </div>
      </div>

      {/* Right: Quick Action Controls */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onTogglePresentationMode}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
            isPresentationMode
              ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 shadow-md shadow-amber-500/20'
              : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
          }`}
          title="Toggle Presentation Mode for Evaluation & Project Defense"
        >
          <MonitorPlay className="w-3.5 h-3.5 text-amber-400" />
          <span>{isPresentationMode ? 'Exit Presentation' : 'Presentation Mode'}</span>
        </button>

        <button
          onClick={onOpenTutorials}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          title="Open Networking Pedagogy Tutorials"
        >
          <HelpCircle className="w-4 h-4 text-purple-400" />
        </button>
      </div>
    </header>
  );
};
