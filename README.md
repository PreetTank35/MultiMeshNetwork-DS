# Multi-Mesh Network Simulator
### Architecture, Discrete-Event Routing, and Interactive Web Simulation

**Academic Department:** Department of Information Technology, MIT Academy of Engineering, Alandi (D), Pune  
**Affiliation:** Savitribai Phule Pune University (SPPU)  
**Academic Year:** 2026–2027  
**Supervisor / Guide:** Mr. Shivaji Patil  
**Project Coordinator:** Mr. Sopan Kshirsagar | **HOD:** Dr. Santosh Warpe  
**Project Authors:**
- Preet Tank (Exam Seat No. 202501080043)
- Tejas Waghmode (Exam Seat No. 202501080035)
- Vansh Thakre (Exam Seat No. 202501080057)

---

## 1. Project Overview & Significance

Traditional single-domain wireless mesh networks (WMNs) suffer from severe throughput collapse as the network scales. In their foundational study, **Gupta & Kumar (2000)** proved that per-node capacity degrades asymptotically:

$$\lambda(N) = \Theta\left(\frac{W}{\sqrt{N \log N}}\right) \approx O\left(\frac{1}{\sqrt{N}}\right)$$

This simulator models **Heterogeneous Multi-Mesh Networks**, partitioning nodes into autonomous sub-mesh domains (e.g., high-speed IEEE 802.11s Wi-Fi 6 on 5.2 GHz alongside low-power IEEE 802.15.4 / RPL Thread on 2.4 GHz) interconnected by **Multi-Radio Multi-Channel (MRMC) Boundary Gateways**. Partitioning into $M$ sub-domains restores capacity to:

$$\lambda_{\text{multi}}(N) = O\left(\sqrt{\frac{M}{N}}\right)$$

---

## 2. Implemented Subsystems & Features

### A. Presentation & Visual Canvas (2D + 3D Isometric)
- **Interactive HTML5 Canvas:** Infinite pan and zoom, drag-and-drop node placement, visual convex-hull sub-mesh perimeters, animated glowing packet particles.
- **Default City-Scale Scenario:** Load two dense urban meshes (City A and City B) with 78 nodes and 183 links across neighborhood relays, civic services, and redundant dual-radio intercity gateways. The cities use separate HWMP and OLSR routing domains.
- **3D Isometric Holographic View:** Toggleable Three.js WebGL view rendering nodes as elevated holographic towers and multi-hop traversals as 3D parabolic arcs.
- **Engineering Dashboard Theme:** High-contrast slate color palette (`#0F172A`, `#1E293B`, `#3B82F6`, `#10B981`, `#F59E0B`, `#EF4444`).

### B. Discrete-Event Scheduling & Physical RF Engine
- **Non-blocking Event Scheduler:** Prioritized min-heap event queue maintaining strict simulation determinism.
- **Friis Free-Space Model & Log-Distance Path Loss:** Real-time distance, path loss ($\gamma = 3.2$), Gaussian shadow fading ($\sigma = 4.0\text{ dB}$), and SNR calculations.
- **Packet Error Rate (PER):** Dynamic evaluation of channel noise drops ($PER = 1 - (1 - BER)^L$).
- **Random Waypoint Mobility:** Kinematic velocity updates for mobile rovers with boundary collision rebound.

### C. Multi-Protocol Routing Matrix & MRMC Gateways
- **Intra-Domain Protocols:**
  - **AODV:** Reactive route discovery (RREQ/RREP) and route table caching.
  - **OLSR:** Proactive Multipoint Relay (MPR) calculation covering 2-hop neighborhoods.
  - **HWMP (IEEE 802.11s):** Tree routing rooted at gateways with reactive Airtime Link Metric.
  - **RPL (IETF RFC 6550):** Destination-Oriented DAG (DODAG) rank routing for constrained IoT sensors.
- **Boundary Gateway Bridging:** Automated discovery of dual-radio boundary gateways, protocol translation, and cross-channel egress forwarding.

### D. Fault Injection Studio & Live Telemetry
- **Fault Studio:** One-click triggers for **"Kill Node"**, **"Cut Gateway Link"**, and **"Jam Frequency Channel"**.
- **Live Data Transfer:** Stream packets between selected endpoints until stopped; severed links trigger alternate-route discovery for in-flight packets when a viable path remains.
- **Real-Time Telemetry:** Live Packet Delivery Ratio (PDR %) gauge, End-to-End Latency distribution, Hop Count Histogram, and Gateway Buffer Saturation Heatmap.
- **JSON Schema Persistence:** One-click export of complete topologies and simulation traces for academic submission.

---

## 3. Quick Start & Execution

### Prerequisites
- Node.js $\ge$ 18.x
- npm $\ge$ 9.x

### Running Locally
```bash
# 1. Install dependencies (already completed)
npm install

# 2. Start development server with live reload
npm run dev

# 3. Build optimized production distribution
npm run build

# 4. Preview production build
npm run preview
```

Open your browser to `http://localhost:5173`.

---

## 4. Live Presentation Runbook (For Faculty & External Examiners)

| Step | Time | Action | Key Talking Points |
|---|---|---|---|
| **1. Default City Meshes** | 0:00–1:30 | Load the default screen and open **Path Finder**. | Introduce City A and City B as separate routing domains connected by two dual-radio gateways. |
| **2. Multi-Mesh Routing** | 1:30–3:30 | In **Path Finder**, select a City A service and a City B service. | Follow cross-city traffic through a gateway and note the HWMP-to-OLSR domain transition. |
| **3. Continuous Packet Transfer** | 3:30–5:30 | Choose **Start Continuous Transfer** and leave the stream running. | Packets continue across the selected route until **Stop Data Transfer** is clicked. |
| **4. Fault Injection & Self-Healing** | 5:30–7:30 | While streaming, click any canvas connection to sever it; click it again to restore it. | The simulator retries packets interrupted mid-transmission and discovers an alternate route when available. Follow route changes in the event console. |
| **5. 3D Isometric View & Telemetry** | 7:30–9:00 | Click **"3D View"** in the left dock. Drag mouse to orbit. Open **Telemetry Dashboard**. | Demonstrate the 3D parabolic hop arcs, gateway queue buffer heatmap, and hop count histogram. |
| **6. Trace Export & Defense** | 9:00–10:00 | Click **"Export Trace JSON"** in bottom bar. | Present the standardized schema matching Appendix A.1 of your project report for automated grading. |

