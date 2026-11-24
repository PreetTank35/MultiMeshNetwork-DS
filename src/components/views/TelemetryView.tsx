import React from 'react';
import { Activity, Gauge, TrendingUp, BarChart2, Layers, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { TelemetryMetrics } from '../../types/simulator';

interface Props { metrics: TelemetryMetrics }

export const TelemetryView: React.FC<Props> = ({ metrics }) => {
  const hopBars: Array<{ hop: number; count: number }> = [];
  const maxHops = Math.max(...Object.keys(metrics.hopCountHistogram).map(Number), 6);
  for (let i = 1; i <= maxHops; i++) hopBars.push({ hop: i, count: metrics.hopCountHistogram[i] || 0 });
  const maxCount = Math.max(...hopBars.map(h => h.count), 1);

  const pdrColor = metrics.pdr >= 90 ? 'emerald' : metrics.pdr >= 70 ? 'amber' : 'red';
  const circumference = 2 * Math.PI * 42;
  const pdrDash = (metrics.pdr / 100) * circumference;

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar bg-canvas-deep p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-slate-100">Live Telemetry & Performance Analytics</h1>
          </div>
          <p className="text-xs text-slate-500">Real-time network health metrics, throughput analysis, and gateway saturation monitoring.</p>
        </div>

        {/* Summary Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass rounded-2xl p-5 space-y-1">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center space-x-1"><Package className="w-3 h-3" /><span>Injected</span></div>
            <div className="text-3xl font-bold font-mono text-slate-100">{metrics.totalPacketsInjected}</div>
          </div>
          <div className="glass rounded-2xl p-5 space-y-1">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center space-x-1"><CheckCircle className="w-3 h-3 text-emerald-400" /><span>Delivered</span></div>
            <div className="text-3xl font-bold font-mono text-emerald-400">{metrics.totalPacketsDelivered}</div>
          </div>
          <div className="glass rounded-2xl p-5 space-y-1">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center space-x-1"><AlertTriangle className="w-3 h-3 text-red-400" /><span>Dropped</span></div>
            <div className="text-3xl font-bold font-mono text-red-400">{metrics.totalPacketsDropped}</div>
          </div>
          <div className="glass rounded-2xl p-5 space-y-1">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider flex items-center space-x-1"><TrendingUp className="w-3 h-3 text-purple-400" /><span>Avg Latency</span></div>
            <div className="text-3xl font-bold font-mono text-purple-300">{metrics.averageLatencyMs.toFixed(1)}<span className="text-sm text-slate-500 ml-1">ms</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PDR Circular Gauge */}
          <div className="glass rounded-2xl p-6 flex flex-col items-center">
            <div className="text-xs font-semibold text-slate-400 mb-4 flex items-center space-x-1.5"><Gauge className="w-4 h-4 text-sky-400" /><span>Packet Delivery Ratio (PDR)</span></div>
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#1E293B" strokeWidth="6" />
                <circle cx="50" cy="50" r="42" fill="none" stroke={pdrColor === 'emerald' ? '#10B981' : pdrColor === 'amber' ? '#F59E0B' : '#EF4444'}
                  strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={circumference - pdrDash} strokeLinecap="round" className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold font-mono ${pdrColor === 'emerald' ? 'text-emerald-400' : pdrColor === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>{metrics.pdr.toFixed(1)}%</span>
              </div>
            </div>
            <div className="mt-3 text-[10px] text-slate-500 font-mono">Target: ≥ 95% for production networks</div>
          </div>

          {/* Hop Count Histogram */}
          <div className="glass rounded-2xl p-6">
            <div className="text-xs font-semibold text-slate-400 mb-4 flex items-center space-x-1.5"><BarChart2 className="w-4 h-4 text-sky-400" /><span>Hop Count Distribution</span></div>
            <div className="h-36 flex items-end space-x-3 px-2">
              {hopBars.map(bar => (
                <div key={bar.hop} className="flex-1 flex flex-col items-center h-full justify-end">
                  <div className="text-[9px] font-mono text-sky-400 mb-1">{bar.count > 0 ? bar.count : ''}</div>
                  <div className="w-full rounded-t-lg bg-sky-500/60 hover:bg-sky-400/80 transition-all" style={{ height: `${Math.max((bar.count / maxCount) * 100, 4)}%` }} />
                  <div className="text-[10px] font-mono text-slate-500 mt-1.5">{bar.hop}h</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gateway Buffer Saturation */}
        <div className="glass rounded-2xl p-6">
          <div className="text-xs font-semibold text-slate-400 mb-4 flex items-center justify-between">
            <span className="flex items-center space-x-1.5"><Layers className="w-4 h-4 text-amber-400" /><span>Gateway Buffer Saturation Heatmap</span></span>
            <span className="text-[10px] text-slate-600">Green → Yellow → Red</span>
          </div>
          {Object.keys(metrics.gatewayLoadMap).length === 0 ? (
            <div className="text-center py-8 text-slate-600 text-sm">No gateway traffic recorded yet. Inject a cross-domain packet to generate data.</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(metrics.gatewayLoadMap).map(([gwId, load]) => (
                <div key={gwId} className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-mono"><span className="text-slate-300">{gwId}</span><span className="text-slate-500">{load.toFixed(1)}%</span></div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${load >= 80 ? 'bg-red-500' : load >= 40 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.max(load, 2)}%` }} />
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

