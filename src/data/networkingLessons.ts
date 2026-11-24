/**
 * Interactive Networking Educational Lessons
 * Designed for Data Communication Lab pedagogy & examination walkthrough
 */

export interface NetworkingLesson {
  id: string;
  title: string;
  tagline: string;
  category: 'Fundamentals' | 'Theory & Math' | 'Protocols' | 'Faults & Diagnostics';
  durationMinutes: number;
  content: string[];
  keyFormula?: string;
  experimentGoal: string;
  recommendedTopology: 'smart_campus' | 'monolithic';
  interactiveStepAction?: string;
}

export const NETWORKING_LESSONS: NetworkingLesson[] = [
  {
    id: 'lesson_1_mesh_basics',
    title: '1. What is a Wireless Mesh Network?',
    tagline: 'Decentralized, self-configuring & self-healing multi-hop topology',
    category: 'Fundamentals',
    durationMinutes: 3,
    content: [
      'Unlike traditional Wi-Fi star topologies where every device must connect directly to a single central Access Point, wireless mesh nodes cooperate to route packets hop-by-hop across intermediate peers.',
      'Three fundamental node roles coexist in a mesh:',
      '• Mesh Gateway / Border Router: Bridges local sub-mesh domains to external IP networks or high-speed backhauls.',
      '• Mesh Router: Intermediate forwarding device that maintains routing tables and relays packets for adjacent peers.',
      '• Mesh End Device (Sensor/Client): Leaf nodes that consume or originate application data payloads.'
    ],
    experimentGoal: 'Observe how packets hop between non-adjacent nodes through intermediate relays without any central controller.',
    recommendedTopology: 'smart_campus',
    interactiveStepAction: 'Inject a packet from IT Lab Router A to Data Comm Lab Router B and observe the intermediate hop.'
  },
  {
    id: 'lesson_2_gupta_kumar',
    title: '2. Why Single-Domain Meshes Fail (Gupta-Kumar Capacity Limit)',
    tagline: 'The mathematical bottleneck of flat shared-channel mesh networks',
    category: 'Theory & Math',
    durationMinutes: 4,
    content: [
      'In their landmark theoretical analysis, Gupta and Kumar (2000) proved that in a flat, single-domain wireless network sharing one radio frequency channel, per-node throughput degrades asymptotically as:',
      'As node count N grows, average path length grows proportionally to sqrt(N). Intermediate nodes spend almost all radio airtime re-transmitting transit packets rather than originating new data.',
      'Furthermore, CSMA/CA channel contention and broadcast storms during route discovery cause severe packet drops and latency spikes.'
    ],
    keyFormula: 'λ(N) = Θ( W / √(N log N) ) ≈ O( 1 / √N )',
    experimentGoal: 'Load the Monolithic Mesh scenario and observe the high drop rate and latency degradation under single-channel contention.',
    recommendedTopology: 'monolithic',
    interactiveStepAction: 'Load Monolithic benchmark, inject a packet across opposite corners, and notice the hop count and contention drops.'
  },
  {
    id: 'lesson_3_multi_mesh',
    title: '3. The Multi-Mesh Architecture & MRMC Gateways',
    tagline: 'Partitioning networks into heterogeneous domains to restore capacity',
    category: 'Fundamentals',
    durationMinutes: 4,
    content: [
      'To circumvent the single-mesh bottleneck, modern networks partition the environment into autonomous sub-meshes operating on orthogonal channels (e.g., 5.2 GHz Wi-Fi 6 vs 2.4 GHz IoT Thread).',
      'Partitioning into M balanced sub-meshes restores throughput capacity to O(√(M/N)), giving an asymptotic improvement of √M times.',
      'Boundary Gateways equipped with Multi-Radio Multi-Channel (MRMC) network interfaces dynamically bridge and translate traffic between incompatible protocol domains.'
    ],
    keyFormula: 'λ_multi(N) = O( √(M / N) )',
    experimentGoal: 'Witness packet traversal from an IoT Sensor (2.4 GHz RPL) traversing the boundary gateway to an Enterprise Wi-Fi Server (5.2 GHz HWMP).',
    recommendedTopology: 'smart_campus',
    interactiveStepAction: 'Inject packet from Campus AQI Sensor to Campus Main Server and open Gateway Inspector.'
  },
  {
    id: 'lesson_4_protocols',
    title: '4. Wireless Mesh Routing Protocols Comparison',
    tagline: 'AODV vs. OLSR vs. HWMP (802.11s) vs. RPL (RFC 6550)',
    category: 'Protocols',
    durationMinutes: 5,
    content: [
      '• AODV (Reactive): Discovers routes on-demand using RREQ broadcast and unicast RREP. Minimizes routing table memory but incurs initial discovery delay.',
      '• OLSR (Proactive): Table-driven protocol using Multipoint Relays (MPRs) to flood Link State packets with minimal broadcast overhead.',
      '• HWMP (IEEE 802.11s): Standardized hybrid mesh protocol combining proactive tree routing towards root stations with reactive Airtime Link Metric (ALM) on-demand paths.',
      '• RPL (IETF RFC 6550): Distance-vector protocol organizing constrained IoT nodes into Destination-Oriented DAGs (DODAGs) rooted at border routers based on rank calculations.'
    ],
    experimentGoal: 'Compare routing metrics and table caching across heterogeneous protocols in action.',
    recommendedTopology: 'smart_campus'
  },
  {
    id: 'lesson_5_rf_propagation',
    title: '5. Physical Layer RF Propagation & Attenuation',
    tagline: 'Friis Transmission Equation & Log-Distance Shadow Fading',
    category: 'Theory & Math',
    durationMinutes: 4,
    content: [
      'Radio waves attenuate with distance and frequency. The simulator computes physical layer parameters dynamically for every wireless link:',
      '• Friis Free Space Loss: PL_free(d) = 20 log10(d) + 20 log10(f) + 20 log10(4π/c) - Gt - Gr',
      '• Log-Distance Model: PL(d) = PL(d0) + 10γ log10(d/d0) + X_σ (where γ is path loss exponent and X_σ is shadow fading).',
      '• Packet Error Rate (PER): Calculated from Signal-to-Noise Ratio (SNR) and Bit Error Rate (BER). If random noise exceeds threshold, the packet drops at the physical layer.'
    ],
    keyFormula: 'PER = 1 - (1 - BER(SNR))^L',
    experimentGoal: 'Drag nodes farther apart on the canvas and observe the real-time SNR drop, PER increase, and eventual link severance.',
    recommendedTopology: 'smart_campus',
    interactiveStepAction: 'Drag IT Lab Router A to the far edge of the screen and inspect its link loss rate.'
  },
  {
    id: 'lesson_6_self_healing',
    title: '6. Self-Healing & Dynamic Fault Rerouting',
    tagline: 'Evaluating network survivability during live physical outages',
    category: 'Faults & Diagnostics',
    durationMinutes: 3,
    content: [
      'When an active link is severed or an intermediate router runs out of battery, a well-engineered mesh must detect missing ACK frames and recalculate an alternate route autonomously.',
      'In our simulator, the Fault Studio allows examiners and students to trigger instant outages:',
      '1. "Kill Node": Shuts down an active router; adjacent nodes detect failure and route around it.',
      '2. "Cut Gateway Link": Disables primary boundary link; traffic dynamically switches to secondary backup gateway.',
      '3. "Jam Channel": Slices SNR across an entire RF band to simulate intentional radio interference.'
    ],
    experimentGoal: 'Sever the primary gateway link during packet flow and observe real-time rerouting to Backup Gateway B.',
    recommendedTopology: 'smart_campus',
    interactiveStepAction: 'Click "Sever Primary Link" in Fault Studio while tracing packets to observe automatic failover.'
  }
];

