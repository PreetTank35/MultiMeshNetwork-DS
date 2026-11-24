import React from 'react';
import { Activity, Gauge, TrendingUp, BarChart2, Layers, Package, AlertTriangle, CheckCircle, Radio, Clock } from 'lucide-react';
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
    <div className="w-full h-full overflow-y-auto custom-scrollbar bg-neu-base p-6 md:p-10 select-none">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neu-border">
          <div>
            <div className="flex items-center space-x-2.5 mb-1">
              <Activity className="w-5 h-5 text-cyan-400 neu-led-route" />
              <h1 className="text-xl font-bold text-slate-100 tracking-wide">
                Live Telemetry & Multi-Mesh Analytics Hub
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Real-time cyber-physical health metrics, per-hop latency distribution, and MRMC gateway buffer saturation.
            </p>
          </div>

          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl neu-pressed border border-black/20 text-xs font-mono text-slate-300">
            <Radio className="w-3.5 h-3.5 text-emerald-400 neu-led-iot animate-pulse" />
            <span>Telemetry Bus: Active</span>
          </div>
        </div>

        {/* 4 Summary Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Injected */}
          <div className="neu-convex rounded-2xl p-5 space-y-2 border border-neu-border">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center space-x-1.5">
              <Package className="w-3.5 h-3.5 text-blue-400" />
              <span>Packets Injected</span>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-100">
              {metrics.totalPacketsInjected}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">Total RF emissions</div>
          </div>

          {/* Delivered */}
          <div className="neu-convex rounded-2xl p-5 space-y-2 border border-neu-border">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center space-x-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Frames Delivered</span>
            </div>
            <div className="text-3xl font-bold font-mono text-emerald-400 neu-led-iot">
              {metrics.totalPacketsDelivered}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">ACK confirmed</div>
          </div>

          {/* Dropped */}
          <div className="neu-convex rounded-2xl p-5 space-y-2 border border-neu-border">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center space-x-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>Frames Dropped</span>
            </div>
            <div className="text-3xl font-bold font-mono text-red-400 neu-led-failure">
              {metrics.totalPacketsDropped}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">Collision / SNR / Cut</div>
          </div>

          {/* Avg Latency */}
          <div className="neu-convex rounded-2xl p-5 space-y-2 border border-neu-border">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Average Latency</span>
            </div>
            <div className="text-3xl font-bold font-mono text-cyan-300">
              {metrics.averageLatencyMs.toFixed(1)}
              <span className="text-sm text-slate-400 font-sans ml-1">ms</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">End-to-end traversal</div>
          </div>
        </div>

        {/* Center Graphs Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Circular PDR Gauge Card */}
          <div className="neu-convex rounded-2xl p-6 flex flex-col items-center border border-neu-border">
            <div className="w-full text-xs font-semibold text-slate-200 mb-6 flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <span>Packet Delivery Ratio (PDR)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">Target ≥ 95%</span>
            </div>

            {/* Recessed Neomorphic Dial */}
            <div className="relative w-36 h-36 flex items-center justify-center p-3 rounded-full neu-pressed border border-black/30">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="44" fill="none" stroke="#131722" strokeWidth="8" />
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
                    pdrColor === 'emerald'
                      ? 'text-emerald-400'
                      : pdrColor === 'amber'
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`}
                >
                  {metrics.pdr.toFixed(1)}%
                </span>
                <span className="text-[9px] text-slate-400 font-mono uppercase">Reliability</span>
              </div>
            </div>

            <div className="mt-6 text-[11px] text-slate-400 font-mono text-center">
              Formula: PDR = (Delivered Packets / Injected Packets) × 100%
            </div>
          </div>

          {/* Hop Count Distribution Histogram */}
          <div className="neu-convex rounded-2xl p-6 border border-neu-border flex flex-col">
            <div className="text-xs font-semibold text-slate-200 mb-6 flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-cyan-400" />
                <span>Hop Count Distribution</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">Path Pathlengths</span>
            </div>

            {/* Recessed histogram container */}
            <div className="neu-pressed rounded-xl p-4 flex-1 flex items-end space-x-3 min-h-[140px] border border-black/30">
              {hopBars.map(bar => (
                <div key={bar.hop} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="text-[9px] font-mono text-cyan-400 mb-1 group-hover:scale-110 transition-transform">
                    {bar.count > 0 ? bar.count : ''}
                  </div>
                  <div
                    className="w-full rounded-t-lg bg-cyan-600/80 hover:bg-cyan-400 transition-all shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                    style={{ height: `${Math.max((bar.count / maxCount) * 100, 5)}%` }}
                  />
                  <div className="text-[10px] font-mono text-slate-400 mt-2">{bar.hop}h</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gateway Buffer Saturation Heatmap */}
        <div className="neu-convex rounded-2xl p-6 border border-neu-border">
          <div className="text-xs font-semibold text-slate-200 mb-4 flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>MRMC Gateway Buffer Saturation Heatmap</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Queue Load: Green &lt; 40% &lt; Amber &lt; 80% &lt; Red</span>
          </div>

          {Object.keys(metrics.gatewayLoadMap).length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs neu-pressed rounded-xl border border-black/20">
              No cross-mesh gateway traffic recorded yet. Inject packets between Wi-Fi and IoT sub-meshes to record queuing load.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(metrics.gatewayLoadMap).map(([gwId, load]) => (
                <div key={gwId} className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-300 font-bold">{gwId}</span>
                    <span className="text-cyan-300 font-bold">{load.toFixed(1)}% Queue Filled</span>
                  </div>
                  <div className="w-full neu-pressed h-3.5 rounded-full p-0.5 border border-black/30 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        load >= 80 ? 'bg-red-500 neu-led-failure' : load >= 40 ? 'bg-amber-400 neu-led-gateway' : 'bg-emerald-400 neu-led-iot'
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
