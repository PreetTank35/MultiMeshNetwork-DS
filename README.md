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
| **1. Theoretical Hook** | 0:00–1:30 | Load default screen, open **Tutorials** modal. | State the Gupta-Kumar capacity limit $O(1/\sqrt{N})$. Explain why single monolithic meshes collapse under shared channel contention. |
| **2. Multi-Mesh Solution** | 1:30–3:30 | Click **"Scenario 1: Smart Campus"**. | Point out the blue Wi-Fi 6 domain (5.2 GHz) and green IoT sensor domain (2.4 GHz) separated by the Amber MRMC Gateways. |
| **3. Packet Injection** | 3:30–5:30 | Select Source: `Campus AQI Sensor`, Target: `Campus Main Server`. Click **Inject Packet**. Set speed to $0.5\times$. | Watch the packet hop along RPL $\to$ reach Gateway A $\to$ inspect **Gateway Translation** tab showing header rewrite $\to$ forward via HWMP Wi-Fi mesh to server. |
| **4. Fault Injection & Self-Healing** | 5:30–7:30 | In Fault Studio, click **"Sever Primary Gateway Link"** during an active packet flow. | Highlight instant autonomous rerouting: the simulator detects the severed link and forwards traffic through Backup Gateway B. Show live PDR meter and latency updating. |
| **5. 3D Isometric View & Telemetry** | 7:30–9:00 | Click **"3D View"** in the left dock. Drag mouse to orbit. Open **Telemetry Dashboard**. | Demonstrate the 3D parabolic hop arcs, gateway queue buffer heatmap, and hop count histogram. |
| **6. Trace Export & Defense** | 9:00–10:00 | Click **"Export Trace JSON"** in bottom bar. | Present the standardized schema matching Appendix A.1 of your project report for automated grading. |

