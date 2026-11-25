import React from 'react';
import { Activity, Gauge, BarChart2, Layers, Package, AlertTriangle, CheckCircle, Radio, Clock } from 'lucide-react';
import { TelemetryMetrics } from '../../types/simulator';

interface Props {
  metrics: TelemetryMetrics;
}

export const TelemetryView: React.FC<Props> = ({ metrics }) => {
  const hopBars: Array<{ hop: number; count: number }> = [];
  const maxHops = Math.max(...Object.keys(metrics.hopCountHistogram).map(Number), 6);
  for (let i = 1; i <= maxHops; i++) {
    hopBars.push({ hop: i, count: metrics.hopCountHistogram[i] || 0 });
  }
  const maxCount = Math.max(...hopBars.map(h => h.count), 1);

  const pdrColor = metrics.pdr >= 90 ? 'emerald' : metrics.pdr >= 70 ? 'amber' : 'red';
  const circumference = 2 * Math.PI * 44;
  const pdrDash = (metrics.pdr / 100) * circumference;

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar neu-base p-6 md:p-10 select-none">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-neu-border">
          <div>
            <div className="flex items-center space-x-2.5 mb-1">
              <Activity className="w-5 h-5 text-sky-600 dark:text-cyan-400" />
              <h1 className="text-xl font-bold text-neu-text tracking-wide">
                Live Telemetry & Multi-Mesh Analytics Hub
              </h1>
            </div>
            <p className="text-xs text-neu-muted">
              Real-time cyber-physical health metrics, per-hop latency distribution, and MRMC gateway buffer saturation.
            </p>
          </div>

          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl neu-pressed text-xs font-mono text-neu-text">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>Telemetry Bus: Active</span>
          </div>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <div className="neu-convex rounded-2xl p-5 space-y-2">
            <div className="text-[10px] text-neu-muted uppercase tracking-wider font-bold flex items-center space-x-1.5">
              <Package className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Packets Injected</span>
            </div>
            <div className="text-3xl font-bold font-mono text-neu-text">{metrics.totalPacketsInjected}</div>
            <div className="text-[10px] text-neu-muted font-mono">Total RF emissions</div>
          </div>

          <div className="neu-convex rounded-2xl p-5 space-y-2">
            <div className="text-[10px] text-neu-muted uppercase tracking-wider font-bold flex items-center space-x-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Frames Delivered</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{metrics.totalPacketsDelivered}</div>
            <div className="text-[10px] text-neu-muted font-mono">ACK confirmed</div>
          </div>

          <div className="neu-convex rounded-2xl p-5 space-y-2">
            <div className="text-[10px] text-neu-muted uppercase tracking-wider font-bold flex items-center space-x-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              <span>Frames Dropped</span>
            </div>
            <div className="text-3xl font-bold font-mono text-red-600 dark:text-red-400">{metrics.totalPacketsDropped}</div>
            <div className="text-[10px] text-neu-muted font-mono">Collision / SNR / Cut</div>
          </div>

          <div className="neu-convex rounded-2xl p-5 space-y-2">
            <div className="text-[10px] text-neu-muted uppercase tracking-wider font-bold flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
              <span>Average Latency</span>
            </div>
            <div className="text-3xl font-bold font-mono text-sky-600 dark:text-cyan-300">
              {metrics.averageLatencyMs.toFixed(1)}
              <span className="text-sm text-neu-muted font-sans ml-1">ms</span>
            </div>
            <div className="text-[10px] text-neu-muted font-mono">End-to-end traversal</div>
          </div>
        </div>

        {/* Center Graphs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="neu-convex rounded-2xl p-6 flex flex-col items-center">
            <div className="w-full text-xs font-bold text-neu-text mb-6 flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <Gauge className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                <span>Packet Delivery Ratio (PDR)</span>
              </span>
              <span className="text-[10px] font-mono text-neu-muted">Target ≥ 95%</span>
            </div>

            <div className="relative w-36 h-36 flex items-center justify-center p-3 rounded-full neu-pressed">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="44" fill="none" stroke="var(--neu-shadow-dark)" strokeWidth="8" opacity="0.35" />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke={pdrColor === 'emerald' ? '#059669' : pdrColor === 'amber' ? '#D97706' : '#DC2626'}
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - pdrDash}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={`text-2xl font-bold font-mono ${
                    pdrColor === 'emerald' ? 'text-emerald-600 dark:text-emerald-400'
                    : pdrColor === 'amber' ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {metrics.pdr.toFixed(1)}%
                </span>
                <span className="text-[9px] text-neu-muted font-mono uppercase">Reliability</span>
              </div>
            </div>

            <div className="mt-6 text-[11px] text-neu-muted font-mono text-center">
              PDR = (Delivered / Injected) × 100%
            </div>
          </div>

          <div className="neu-convex rounded-2xl p-6 flex flex-col">
            <div className="text-xs font-bold text-neu-text mb-6 flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                <span>Hop Count Distribution</span>
              </span>
              <span className="text-[10px] font-mono text-neu-muted">Path Lengths</span>
            </div>

            <div className="neu-pressed rounded-xl p-4 flex-1 flex items-end space-x-3 min-h-[140px]">
              {hopBars.map(bar => (
                <div key={bar.hop} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="text-[9px] font-mono text-sky-600 dark:text-cyan-400 font-bold mb-1">
                    {bar.count > 0 ? bar.count : ''}
                  </div>
                  <div
                    className="w-full rounded-t-lg bg-sky-500/80 hover:bg-sky-500 transition-all"
                    style={{ height: `${Math.max((bar.count / maxCount) * 100, 6)}%` }}
                  />
                  <div className="text-[10px] font-mono text-neu-muted mt-2">{bar.hop}h</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gateway Buffer Heatmap */}
        <div className="neu-convex rounded-2xl p-6">
          <div className="text-xs font-bold text-neu-text mb-4 flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>MRMC Gateway Buffer Saturation Heatmap</span>
            </span>
            <span className="text-[10px] text-neu-muted font-mono">Green &lt; 40% &lt; Amber &lt; 80% &lt; Red</span>
          </div>

          {Object.keys(metrics.gatewayLoadMap).length === 0 ? (
            <div className="text-center py-8 text-neu-muted text-xs neu-pressed rounded-xl">
              No cross-mesh gateway traffic recorded yet. Transmit packets between Wi-Fi and IoT domains to inspect queue load.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(metrics.gatewayLoadMap).map(([gwId, load]) => (
                <div key={gwId} className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-neu-text font-bold">{gwId}</span>
                    <span className="text-sky-600 dark:text-cyan-300 font-bold">{load.toFixed(1)}% Queue Filled</span>
                  </div>
                  <div className="w-full neu-pressed h-3.5 rounded-full p-0.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        load >= 80 ? 'bg-red-500' : load >= 40 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(load, 3)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
