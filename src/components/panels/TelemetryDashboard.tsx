/**
 * Real-Time Telemetry & Performance Analytics Dashboard
 * Implements Chapter 1.C, 5.1:
 * Packet Delivery Ratio (PDR) meter, End-to-End Latency distribution,
 * Gateway buffer heatmap, and throughput telemetry
 */

import React from 'react';
import { X, Activity, Gauge, TrendingUp, BarChart2, ShieldAlert } from 'lucide-react';
import { TelemetryMetrics } from '../../types/simulator';

interface TelemetryDashboardProps {
  metrics: TelemetryMetrics;
  isOpen: boolean;
  onClose: () => void;
}

export const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({
  metrics,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const maxHops = Math.max(...Object.keys(metrics.hopCountHistogram).map(Number), 5);
  const hopBars: Array<{ hop: number; count: number }> = [];
  for (let i = 1; i <= maxHops; i++) {
    hopBars.push({ hop: i, count: metrics.hopCountHistogram[i] || 0 });
  }
  const maxHopCount = Math.max(...hopBars.map(h => h.count), 1);

  return (
    <div className="absolute top-16 right-84 w-96 bg-[#1E293B]/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl z-30 p-4 text-slate-200 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 mb-3">
        <div className="flex items-center space-x-2 text-emerald-400">
          <Activity className="w-5 h-5 animate-pulse" />
          <h2 className="font-bold text-sm text-slate-100">Live Telemetry & Analytics</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4 text-xs">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 gap-2">
          {/* PDR Gauge */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <span className="text-slate-400 flex items-center space-x-1">
              <Gauge className="w-3.5 h-3.5 text-sky-400" />
              <span>Packet Delivery (PDR)</span>
            </span>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className={`text-2xl font-bold font-mono ${
                metrics.pdr >= 90 ? 'text-emerald-400' : metrics.pdr >= 70 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {metrics.pdr.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  metrics.pdr >= 90 ? 'bg-emerald-400' : metrics.pdr >= 70 ? 'bg-amber-400' : 'bg-red-400'
                }`}
                style={{ width: `${Math.min(metrics.pdr, 100)}%` }}
              />
            </div>
          </div>

          {/* Average Latency */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <span className="text-slate-400 flex items-center space-x-1">
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
              <span>End-to-End Latency</span>
            </span>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-2xl font-bold font-mono text-purple-300">
                {metrics.averageLatencyMs.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">ms / hop</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Delivered: <strong className="text-slate-200">{metrics.totalPacketsDelivered}</strong> | Dropped: <strong className="text-red-400">{metrics.totalPacketsDropped}</strong>
            </div>
          </div>
        </div>

        {/* Hop Count Distribution Histogram */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Hop Count Distribution</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Hops per packet</span>
          </div>

          <div className="h-20 flex items-end space-x-2 pt-2 border-b border-slate-800">
            {hopBars.map(bar => {
              const heightPct = (bar.count / maxHopCount) * 100;
              return (
                <div key={bar.hop} className="flex-1 flex flex-col items-center h-full justify-end">
                  <div className="text-[9px] text-sky-400 font-mono mb-0.5">{bar.count > 0 ? bar.count : ''}</div>
                  <div
                    className="w-full bg-sky-500/80 hover:bg-sky-400 rounded-t transition-all"
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                  />
                  <div className="text-[10px] text-slate-500 font-mono mt-1">{bar.hop}h</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gateway Buffer Heatmap */}
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
          <div className="font-semibold text-slate-300 mb-2 flex items-center justify-between">
            <span>Gateway Buffer Saturation Heatmap</span>
            <span className="text-[10px] text-slate-500">Green → Yellow → Red</span>
          </div>

          {Object.keys(metrics.gatewayLoadMap).length === 0 ? (
            <div className="text-slate-500 text-center py-2 text-[11px]">No active boundary gateways monitored.</div>
          ) : (
            <div className="space-y-2">
              {Object.entries(metrics.gatewayLoadMap).map(([gwId, load]) => {
                const color = load >= 80 ? 'bg-red-500' : load >= 40 ? 'bg-amber-400' : 'bg-emerald-400';
                return (
                  <div key={gwId} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-slate-300">{gwId}</span>
                      <span className="text-slate-400">{load.toFixed(1)}% queue full</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${load}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
