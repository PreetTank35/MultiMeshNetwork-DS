import React, { useState } from 'react';
import { BookOpen, Play, Lightbulb, Calculator, ArrowRight, Layers, Radio, Shield, Zap, Globe, Sparkles } from 'lucide-react';

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
      'As node count N increases, average multi-hop path length grows proportionally to √N. Intermediate nodes spend almost all radio airtime forwarding transit packets rather than originating new data.',
      'Furthermore, CSMA/CA contention and broadcast storms during AODV route discovery cause severe packet collisions and latency spikes.',
    ],
    formula: 'λ(N) = Θ( W / √(N log N) ) ≈ O( 1 / √N )',
    experiment: 'Load the Monolithic 16-node single-domain mesh and inject a cross-corner packet to observe high drop rates and contention degradation.',
    scenario: 'monolithic',
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
    experiment: 'Load Smart Campus and trace a packet from an IoT Sensor to the Wi-Fi Server through the MRMC Gateway.',
    scenario: 'smart_campus',
  },
  {
    id: '3',
    title: 'Routing Protocols Compared',
    category: 'AODV vs OLSR vs HWMP vs RPL',
    icon: <Globe className="w-5 h-5" />,
    color: '#7C3AED',
    content: [
      'AODV (Reactive): Discovers routes on-demand via RREQ broadcast flooding. Minimizes routing table memory but incurs discovery delay for new flows.',
      'OLSR (Proactive): Maintains full topology tables using Multipoint Relays (MPRs) to minimize broadcast overhead.',
      'HWMP (IEEE 802.11s): Hybrid mesh protocol combining proactive tree routing toward root with reactive Airtime Link Metric (ALM) on-demand paths.',
      'RPL (IETF RFC 6550): Distance-vector protocol organizing constrained IoT nodes into Destination-Oriented DAGs (DODAGs) rooted at border gateways.',
    ],
    experiment: 'Inject packets in the Smart Campus topology and compare Wi-Fi (HWMP) vs IoT (RPL) routing.',
    scenario: 'smart_campus',
  },
  {
    id: '4',
    title: 'RF Path Loss & Channel Physics',
    category: 'Friis & Log-Distance Models',
    icon: <Radio className="w-5 h-5" />,
    color: '#059669',
    content: [
      'Radio waves attenuate with distance and frequency. The simulator computes physical parameters dynamically for every wireless link.',
      'Friis Free-Space Loss: PL_free(d) = 20 log₁₀(d) + 20 log₁₀(f) + 20 log₁₀(4π/c) − Gₜ − Gᵣ',
      'Log-Distance Model: PL(d) = PL(d₀) + 10γ log₁₀(d/d₀) + X_σ, where γ is the path loss exponent (2.7–3.5) and X_σ is shadow fading.',
    ],
    formula: 'PER = 1 − (1 − BER(SNR))^L',
    experiment: 'Drag a node farther from its neighbor on the canvas and watch SNR drop and PER increase in real time.',
    scenario: 'smart_campus',
  },
  {
    id: '5',
    title: 'Self-Healing & Fault Recovery',
    category: 'Dynamic Rerouting',
    icon: <Shield className="w-5 h-5" />,
    color: '#D97706',
    content: [
      'A resilient mesh detects link failures (missing ACK frames or neighbor unreachability) and recalculates alternate routes autonomously.',
      'Click any node or link on the canvas to open the Inspector Drawer and trigger Kill Node, Sever Link, or Jam Frequency.',
      'Observe how traffic dynamically reroutes through the secondary backup border gateway.',
    ],
    experiment: 'Sever the primary gateway link during transmission to watch automatic failover to Backup Gateway B.',
    scenario: 'smart_campus',
  },
  {
    id: '6',
    title: 'Using This Simulator',
    category: 'Quick Start Guide',
    icon: <Lightbulb className="w-5 h-5" />,
    color: '#0891B2',
    content: [
      '1. Use the top Scenarios menu to load MIT AOE Smart Campus, Smart Industrial Logistics, or Monolithic Breakdown.',
      '2. Use the top-left Builder Bar to create custom Sub-Mesh domains, add Routers/Gateways/Sensors, and draw links.',
      '3. Use the left Path Finder card to pick Source & Destination, click Compute Best Route, and Transmit Packet.',
      '4. Switch to Packet X-Ray to inspect OSI 5-layer frames and 4-stage MRMC gateway translations.',
      '5. Open Telemetry Hub to analyze live PDR, hop count histogram, and gateway queue saturation.',
    ],
    experiment: 'Load Smart Campus, compute an optimal multi-mesh route, and transmit a packet.',
    scenario: 'smart_campus',
  },
];

export const GuideView: React.FC<Props> = ({ onRunExperiment }) => {
  const [openCardId, setOpenCardId] = useState<string | null>('1');

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar neu-base select-none">
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full neu-pressed text-xs text-sky-600 dark:text-cyan-400 font-mono font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Cyber-Physical Learning Module</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-neu-text tracking-tight leading-tight">
            How Multi-Mesh Networks Work
          </h1>
          <p className="text-sm text-neu-muted max-w-xl mx-auto leading-relaxed">
            A comprehensive, interactive curriculum covering wireless RF propagation, MRMC boundary gateway translation, and self-healing algorithms.
          </p>
        </div>

        {/* Concept Cards */}
        <div className="space-y-4">
          {cards.map(card => {
            const isOpen = openCardId === card.id;
            return (
              <div key={card.id} className="neu-convex rounded-3xl overflow-hidden transition-all">
                <button
                  onClick={() => setOpenCardId(isOpen ? null : card.id)}
                  className="w-full flex items-center justify-between p-5 text-left transition-all"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-2xl neu-pressed flex items-center justify-center" style={{ color: card.color }}>
                      {card.icon}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-neu-text">{card.title}</div>
                      <div className="text-[10px] text-neu-muted font-mono uppercase tracking-wider mt-0.5">{card.category}</div>
                    </div>
                  </div>
                  <div className={`p-2 rounded-xl neu-button-sm text-neu-muted transition-transform duration-200 ${isOpen ? 'rotate-90 text-sky-600 dark:text-cyan-400' : ''}`}>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 space-y-4 animate-fade-up">
                    <div className="space-y-2.5">
                      {card.content.map((p, i) => (
                        <p key={i} className="text-xs text-neu-text leading-relaxed neu-pressed p-3.5 rounded-2xl">
                          {p}
                        </p>
                      ))}
                    </div>

                    {card.formula && (
                      <div className="flex items-start space-x-3.5 p-4 rounded-2xl neu-pressed">
                        <Calculator className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1.5">
                            Mathematical Formulation
                          </div>
                          <div className="font-mono text-sm text-neu-text neu-convex-sm px-3.5 py-2 rounded-xl inline-block font-bold">
                            {card.formula}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start space-x-3.5 p-4 rounded-2xl neu-flat-sm">
                      <Lightbulb className="w-4 h-4 text-sky-600 dark:text-cyan-400 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-sky-600 dark:text-cyan-400 uppercase tracking-wider mb-1">
                          Live Interactive Experiment
                        </div>
                        <p className="text-xs text-neu-muted mb-3.5 leading-relaxed">{card.experiment}</p>
                        <button
                          onClick={() => onRunExperiment(card.scenario)}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all flex items-center space-x-2 shadow-md"
                        >
                          <Play className="w-3.5 h-3.5" />
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

        {/* Protocol Matrix */}
        <div className="neu-convex rounded-3xl p-6">
          <h2 className="text-sm font-bold text-neu-text mb-4 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-sky-500 neu-led-route" />
            <span>Multi-Mesh Routing Protocol Comparison Matrix</span>
          </h2>
          <div className="neu-pressed rounded-2xl p-3 overflow-x-auto custom-scrollbar">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="text-neu-muted border-b border-neu-border">
                  <th className="text-left py-2.5 px-3">Protocol</th>
                  <th className="text-left py-2.5 px-3">Type</th>
                  <th className="text-left py-2.5 px-3">Standard</th>
                  <th className="text-left py-2.5 px-3">Metric</th>
                  <th className="text-left py-2.5 px-3">Domain Role</th>
                </tr>
              </thead>
              <tbody className="text-neu-text">
                <tr className="border-b border-neu-border">
                  <td className="py-2.5 px-3 text-sky-600 dark:text-cyan-400 font-bold">AODV</td>
                  <td>Reactive</td>
                  <td>RFC 3561</td>
                  <td>Hop Count</td>
                  <td>Mobile Ad-Hoc</td>
                </tr>
                <tr className="border-b border-neu-border">
                  <td className="py-2.5 px-3 text-purple-600 dark:text-purple-400 font-bold">OLSR</td>
                  <td>Proactive (MPR)</td>
                  <td>RFC 3626</td>
                  <td>ETX / Hop Count</td>
                  <td>Dense Mesh</td>
                </tr>
                <tr className="border-b border-neu-border">
                  <td className="py-2.5 px-3 text-blue-600 dark:text-blue-400 font-bold">HWMP</td>
                  <td>Hybrid (Tree + ALM)</td>
                  <td>IEEE 802.11s</td>
                  <td>Airtime Link Metric</td>
                  <td>Wi-Fi 6 Infrastructure</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold">RPL</td>
                  <td>Distance-Vector (DAG)</td>
                  <td>RFC 6550</td>
                  <td>DODAG Rank / ETX</td>
                  <td>Constrained IoT / Thread</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-center text-[10px] text-neu-muted font-mono py-4 leading-relaxed">
          Multi-Mesh Network Simulator • MIT Academy of Engineering, Pune<br />
          Preet Tank • Tejas Waghmode • Vansh Thakre • Faculty Guide: Mr. Shivaji Patil
        </div>
      </div>
    </div>
  );
};
