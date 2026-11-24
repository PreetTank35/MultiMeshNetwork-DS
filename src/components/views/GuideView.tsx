import React, { useState } from 'react';
import { BookOpen, Play, Lightbulb, Calculator, ArrowRight, Layers, Radio, Wifi, Cpu, Shield, Zap, Globe, Sparkles } from 'lucide-react';

interface Props {
  onRunExperiment: (scenario: 'smart_campus' | 'monolithic', srcId?: string, dstId?: string) => void;
}

interface Card {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  color: string;
  content: string[];
  formula?: string;
  experiment: string;
  scenario: 'smart_campus' | 'monolithic';
}

const cards: Card[] = [
  {
    id: '1',
    title: 'Why Single Meshes Fail',
    category: 'Gupta-Kumar Capacity Limit',
    icon: <Zap className="w-5 h-5" />,
    color: '#DC2626',
    content: [
      'In a flat, single-domain wireless mesh sharing one radio channel, Gupta & Kumar (2000) proved that per-node throughput degrades asymptotically as network size grows.',
      'As node count N increases, average multi-hop path length grows proportionally to √N. Intermediate nodes spend all their radio airtime retransmitting transit packets rather than originating new data.',
      'Furthermore, CSMA/CA contention and broadcast storms during AODV route discovery cause severe packet collisions and latency spikes.',
    ],
    formula: 'λ(N) = Θ( W / √(N log N) ) ≈ O( 1 / √N )',
    experiment: 'Load the Monolithic 16-node single-domain mesh and inject a cross-corner packet to observe high drop rates and contention degradation.',
    scenario: 'monolithic'
  },
  {
    id: '2',
    title: 'The Multi-Mesh Solution',
    category: 'MRMC Architecture',
    icon: <Layers className="w-5 h-5" />,
    color: '#2563EB',
    content: [
      'To circumvent the single-mesh bottleneck, modern networks partition the environment into autonomous sub-meshes operating on orthogonal (non-overlapping) frequency channels.',
      'For example: a high-speed IEEE 802.11s Wi-Fi 6 mesh on 5.2 GHz alongside an ultra-low-power IEEE 802.15.4 Thread/Zigbee IoT mesh on 2.4 GHz.',
      'Multi-Radio Multi-Channel (MRMC) Boundary Gateways bridge traffic between heterogeneous domains by stripping the ingress protocol header, translating the address format, retuning the radio frequency, and re-emitting on the egress channel.',
    ],
    formula: 'λ_multi(N) = O( √(M / N) ) — an improvement factor of √M',
    experiment: 'Load Smart Campus and trace a packet from an IoT Sensor to the Wi-Fi Server through the MRMC Gateway. Watch the protocol translation in real time.',
    scenario: 'smart_campus'
  },
  {
    id: '3',
    title: 'Routing Protocols Compared',
    category: 'AODV vs OLSR vs HWMP vs RPL',
    icon: <Globe className="w-5 h-5" />,
    color: '#8B5CF6',
    content: [
      'AODV (Reactive): Discovers routes on-demand via RREQ broadcast flooding. Minimizes routing table memory but incurs discovery delay for new flows.',
      'OLSR (Proactive): Maintains full topology tables using Multipoint Relays (MPRs) to minimize broadcast overhead. Instant path availability but higher memory cost.',
      'HWMP (IEEE 802.11s): The standardized hybrid mesh protocol combining proactive tree routing toward root with reactive Airtime Link Metric (ALM) on-demand paths.',
      'RPL (IETF RFC 6550): A distance-vector protocol organizing constrained IoT nodes into Destination-Oriented DAGs (DODAGs) rooted at border gateways, optimized for lossy networks.',
    ],
    experiment: 'Inject packets in the Smart Campus topology and observe the different routing matrices used by Wi-Fi (HWMP) vs IoT (RPL) sub-meshes.',
    scenario: 'smart_campus'
  },
  {
    id: '4',
    title: 'RF Path Loss & Channel Physics',
    category: 'Friis & Log-Distance Models',
    icon: <Radio className="w-5 h-5" />,
    color: '#059669',
    content: [
      'Radio waves attenuate with distance and frequency. The simulator computes physical parameters dynamically for every wireless link:',
      'Friis Free-Space Loss: PL_free(d) = 20 log₁₀(d) + 20 log₁₀(f) + 20 log₁₀(4π/c) − Gₜ − Gᵣ',
      'Log-Distance Model: PL(d) = PL(d₀) + 10γ log₁₀(d/d₀) + X_σ, where γ is the path loss exponent (2.7–3.5 for urban) and X_σ is zero-mean Gaussian shadow fading.',
      'If the computed Signal-to-Noise Ratio (SNR) falls below the receiver sensitivity threshold, the packet is dropped at the physical layer.',
    ],
    formula: 'PER = 1 − (1 − BER(SNR))^L',
    experiment: 'In the Topology Canvas, drag a node farther from its neighbor and observe the real-time SNR drop and increased packet error rate in the Node Inspector drawer.',
    scenario: 'smart_campus'
  },
  {
    id: '5',
    title: 'Self-Healing & Fault Recovery',
    category: 'Dynamic Rerouting',
    icon: <Shield className="w-5 h-5" />,
    color: '#D97706',
    content: [
      'A well-engineered mesh must detect link failures (missing ACK frames, timeout-based neighbor unreachability) and autonomously recalculate alternate routes.',
      'In the Fault Studio, you can trigger instant outages: Kill Node (simulates hardware crash), Sever Link (physical wire cut or obstruction), and Jam Frequency (intentional RF interference).',
      'After a fault, watch the AODV Route Error (RERR) mechanism or RPL DODAG Repair process reroute traffic through backup paths in milliseconds.',
    ],
    experiment: 'Start a cross-domain packet flow, then sever the primary gateway link. Watch traffic automatically reroute through the backup Gateway B.',
    scenario: 'smart_campus'
  },
  {
    id: '6',
    title: 'Using This Simulator',
    category: 'Quick Start Guide',
    icon: <Lightbulb className="w-5 h-5" />,
    color: '#06B6D4',
    content: [
      '1. Use the top Scenario dropdown to load a pre-built topology, or add nodes via the floating bar.',
      '2. Switch to the Topology Canvas tab and explore the network. Click any node or link to open the Inspector Drawer with physical parameters.',
      '3. Use the floating bottom bar to inject packets (select Source → Destination → Inject). Control playback speed with the speed buttons.',
      '4. Open the Packet X-Ray tab to inspect OSI-layer details of each packet, including gateway header translations.',
      '5. Switch to the Telemetry Hub for live PDR gauges, latency charts, and gateway buffer heatmaps.',
      '6. Trigger faults from the Node Inspector drawer (Kill Node, Sever Link, Jam Channel) and observe self-healing in action.',
    ],
    experiment: 'Load Smart Campus, inject a packet from Campus AQI Sensor to Campus Main Server, and explore every tab.',
    scenario: 'smart_campus'
  }
];

export const GuideView: React.FC<Props> = ({ onRunExperiment }) => {
  const [openCardId, setOpenCardId] = useState<string | null>('1');

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar bg-neu-base select-none">
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-10 space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full neu-pressed text-xs text-cyan-400 font-mono border border-black/30">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 neu-led-route" />
            <span>Interactive Cyber-Physical Learning Module</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-100 tracking-tight leading-tight">
            How Multi-Mesh <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400">
              Architectures Work
            </span>
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            A comprehensive, interactive curriculum covering wireless mesh physical RF attenuation, MRMC boundary translation, and self-healing algorithms.
          </p>
        </div>

        {/* Tactile Cards */}
        <div className="space-y-4">
          {cards.map(card => {
            const isOpen = openCardId === card.id;
            return (
              <div
                key={card.id}
                className="neu-convex rounded-3xl overflow-hidden transition-all border border-neu-border"
              >
                <button
                  onClick={() => setOpenCardId(isOpen ? null : card.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:neu-pressed transition-all"
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className="p-3 rounded-2xl neu-pressed flex items-center justify-center border border-black/30"
                      style={{ color: card.color }}
                    >
                      {card.icon}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-100 tracking-wide">{card.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mt-0.5">
                        {card.category}
                      </div>
                    </div>
                  </div>
                  <div className={`p-2 rounded-xl neu-button-sm text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90 text-cyan-300' : ''}`}>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 space-y-4 animate-fade-up">
                    <div className="space-y-2.5">
                      {card.content.map((p, i) => (
                        <p
                          key={i}
                          className="text-xs text-slate-300 leading-relaxed neu-pressed p-3.5 rounded-2xl border border-black/20"
                        >
                          {p}
                        </p>
                      ))}
                    </div>

                    {card.formula && (
                      <div className="flex items-start space-x-3.5 p-4 rounded-2xl neu-pressed border border-purple-500/30">
                        <Calculator className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1.5">
                            Mathematical Proof / Formulation
                          </div>
                          <div className="font-mono text-sm text-slate-100 neu-convex px-3.5 py-2 rounded-xl border border-neu-border inline-block shadow-sm">
                            {card.formula}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start space-x-3.5 p-4 rounded-2xl neu-convex border border-cyan-500/20">
                      <Lightbulb className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0 neu-led-route" />
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1">
                          Live Interactive Experiment
                        </div>
                        <p className="text-xs text-slate-300 mb-3.5 leading-relaxed">{card.experiment}</p>
                        <button
                          onClick={() => onRunExperiment(card.scenario)}
                          className="neu-button px-4 py-2 rounded-xl text-white text-xs font-semibold transition-all flex items-center space-x-2 text-cyan-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.35)]"
                        >
                          <Play className="w-3.5 h-3.5 fill-cyan-400" />
                          <span>Launch Live Experiment</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Protocol Comparison Table */}
        <div className="neu-convex rounded-3xl p-6 border border-neu-border">
          <h2 className="text-sm font-bold text-slate-100 mb-4 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 neu-led-route" />
            <span>Multi-Mesh Routing Protocol Comparison Matrix</span>
          </h2>
          <div className="neu-pressed rounded-2xl p-2 border border-black/30 overflow-x-auto custom-scrollbar">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-slate-400 border-b border-white/5">
                  <th className="text-left py-2.5 px-3">Protocol</th>
                  <th className="text-left py-2.5 px-3">Classification</th>
                  <th className="text-left py-2.5 px-3">Standard</th>
                  <th className="text-left py-2.5 px-3">Routing Metric</th>
                  <th className="text-left py-2.5 px-3">Domain Role</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                <tr className="border-b border-white/5">
                  <td className="py-2.5 px-3 text-cyan-400 font-bold">AODV</td>
                  <td>Reactive (On-Demand)</td>
                  <td>RFC 3561</td>
                  <td>Minimum Hop Count</td>
                  <td>Mobile Ad-Hoc / MANET</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2.5 px-3 text-purple-400 font-bold">OLSR</td>
                  <td>Proactive Link-State (MPR)</td>
                  <td>RFC 3626</td>
                  <td>ETX / Hop Count</td>
                  <td>Dense Tactical Mesh</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2.5 px-3 text-blue-400 font-bold">HWMP</td>
                  <td>Hybrid (Proactive Tree + Reactive ALM)</td>
                  <td>IEEE 802.11s</td>
                  <td>Airtime Link Metric (ALM)</td>
                  <td>Wi-Fi 6 Infrastructure Mesh</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">RPL</td>
                  <td>Distance-Vector (DODAG)</td>
                  <td>RFC 6550</td>
                  <td>Expected Transmissions / Rank</td>
                  <td>Constrained IoT / Thread / Zigbee</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-slate-500 font-mono py-4 leading-relaxed">
          Multi-Mesh Network Simulator • Cyber-Physical Lab • MIT Academy of Engineering, Pune<br />
          Preet Tank • Tejas Waghmode • Vansh Thakre • Faculty Mentor: Mr. Shivaji Patil
        </div>
      </div>
    </div>
  );
};
