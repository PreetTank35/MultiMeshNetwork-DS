/**
 * High-Performance Full-Screen 2D Topology & Architectural Blueprint Canvas
 * Features:
 * - High-fidelity CAD architectural blueprint floor plans (MIT Campus Wing & Industrial Logistics)
 * - Blueprint opacity slider control (0% to 100%) and element toggles
 * - Dynamic RF radio wave propagation rings with frequency-dependent wavelength ripples
 * - Glowing active conduit beams (#06B6D4 / #F59E0B) with photon energy pulses
 * - High-tech packet particles with comet trails, gateway protocol translation tags,
 *   drop burst shockwaves with debris sparks, and ACK return pulses
 * - 60 FPS smooth rendering loop with interactive panning, zooming, and node repositioning
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Layers, Maximize2, Radio, Sliders, Zap } from 'lucide-react';
import { MeshNode, NetworkLink, Packet, SubMeshDomain } from '../../types/simulator';
import {
  BLUEPRINT_PRESETS,
  BlueprintFloorPlan,
  CAMPUS_ACADEMIC_BLUEPRINT,
  drawBlueprintFloorPlan,
  LOGISTICS_FACILITY_BLUEPRINT
} from '../../data/blueprintMaps';

// Particle & visual effect interfaces
interface WaveEffect {
  x: number;
  y: number;
  startTime: number;
  maxRadius: number;
  color: string;
  frequencyBand?: string;
}

interface DropBurst {
  x: number;
  y: number;
  startTime: number;
  reason: string;
  sparks: Array<{ vx: number; vy: number; color: string }>;
}

interface AckParticle {
  sx: number;
  sy: number;
  dx: number;
  dy: number;
  startTime: number;
  color: string;
}

interface Props {
  nodes: MeshNode[];
  links: NetworkLink[];
  submeshes: SubMeshDomain[];
  activePackets: Packet[];
  selectedNodeId: string | null;
  selectedLinkId: string | null;
  onSelectNode: (id: string | null) => void;
  onSelectLink: (id: string | null) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
  activeBlueprintId?: string;
}

export const TopologyCanvas: React.FC<Props> = ({
  nodes,
  links,
  submeshes,
  activePackets,
  selectedNodeId,
  selectedLinkId,
  onSelectNode,
  onSelectLink,
  onMoveNode,
  activeBlueprintId = 'campus_academic_wing'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Transform (pan & zoom)
  const [transform, setTransform] = useState({ x: 60, y: 30, scale: 0.95 });
  const isDraggingCanvas = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const draggedNodeId = useRef<string | null>(null);

  // Blueprint Controls State
  const [selectedBlueprintKey, setSelectedBlueprintKey] = useState<string>(activeBlueprintId);
  const [blueprintOpacity, setBlueprintOpacity] = useState<number>(0.85);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [showConduits, setShowConduits] = useState<boolean>(true);
  const [showWaveRings, setShowWaveRings] = useState<boolean>(true);
  const [showConduitGlow, setShowConduitGlow] = useState<boolean>(true);
  const [showHulls, setShowHulls] = useState<boolean>(true);
  const [isToolbarOpen, setIsToolbarOpen] = useState<boolean>(false);

  // Auto-switch blueprint when nodes match logistics
  useEffect(() => {
    const isLogistics = nodes.some(n => n.id.includes('node_log_'));
    if (isLogistics) {
      setSelectedBlueprintKey('smart_logistics');
    } else {
      setSelectedBlueprintKey('campus_academic_wing');
    }
  }, [nodes]);

  // Effect Buffers
  const waveEffects = useRef<WaveEffect[]>([]);
  const dropBursts = useRef<DropBurst[]>([]);
  const ackParticles = useRef<AckParticle[]>([]);
  const prevPacketHops = useRef<Map<string, number>>(new Map());

  // Convex Hull algorithm
  const getConvexHull = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length < 3) return pts;
    const sorted = [...pts].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
    const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

    const lower: typeof pts = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper: typeof pts = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  };

  const screenToWorld = useCallback((cx: number, cy: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const r = canvasRef.current.getBoundingClientRect();
    return {
      x: (cx - r.left - transform.x) / transform.scale,
      y: (cy - r.top - transform.y) / transform.scale
    };
  }, [transform]);

  // Fit and center view
  const handleFitView = useCallback(() => {
    if (!canvasRef.current) return;
    const cw = canvasRef.current.clientWidth;
    const ch = canvasRef.current.clientHeight;
    if (cw === 0 || ch === 0) return;

    // Default bounds covering the architectural blueprint (1040 x 680)
    const targetW = 1040;
    const targetH = 680;
    const scale = Math.min((cw - 80) / targetW, (ch - 80) / targetH, 1.2);
    const x = (cw - targetW * scale) / 2;
    const y = (ch - targetH * scale) / 2;
    setTransform({ x: Math.max(x, 20), y: Math.max(y, 20), scale: Math.max(scale, 0.6) });
  }, []);

  // Detect packet events: hops -> radio waves, delivered -> ACK, dropped -> drop burst
  useEffect(() => {
    for (const pkt of activePackets) {
      const prevHops = prevPacketHops.current.get(pkt.id) ?? 0;

      // New hop transmission
      if (pkt.hops > prevHops && pkt.state === 'transmitting') {
        const hopNode = nodes.find(n => n.id === pkt.currentHop);
        const sm = hopNode ? submeshes.find(s => s.id === hopNode.submeshId) : null;
        if (hopNode && showWaveRings) {
          waveEffects.current.push({
            x: hopNode.position.x,
            y: hopNode.position.y,
            startTime: performance.now(),
            maxRadius: 130,
            color: sm?.color || '#38BDF8',
            frequencyBand: sm?.frequencyBand || '2.4GHz'
          });
        }
      }
      prevPacketHops.current.set(pkt.id, pkt.hops);

      // Packet delivered -> ACK return pulse
      if (pkt.state === 'received' && prevHops !== -1) {
        const srcN = nodes.find(n => n.id === pkt.src);
        const dstN = nodes.find(n => n.id === pkt.dst);
        if (srcN && dstN) {
          ackParticles.current.push({
            sx: dstN.position.x,
            sy: dstN.position.y,
            dx: srcN.position.x,
            dy: srcN.position.y,
            startTime: performance.now(),
            color: '#10B981'
          });
        }
        prevPacketHops.current.set(pkt.id, -1);
      }

      // Packet dropped -> drop burst shockwave
      if (pkt.state === 'dropped' && prevHops >= 0) {
        const dropNode = nodes.find(n => n.id === pkt.currentHop) || nodes.find(n => n.id === pkt.src);
        if (dropNode) {
          const sparks = Array.from({ length: 8 }, () => {
            const angle = Math.random() * Math.PI * 2;
            const spd = 20 + Math.random() * 45;
            return {
              vx: Math.cos(angle) * spd,
              vy: Math.sin(angle) * spd,
              color: Math.random() > 0.5 ? '#EF4444' : '#F59E0B'
            };
          });

          dropBursts.current.push({
            x: dropNode.position.x,
            y: dropNode.position.y,
            startTime: performance.now(),
            reason: pkt.dropReason || 'RF Attenuation Drop',
            sparks
          });
        }
        prevPacketHops.current.set(pkt.id, -1);
      }
    }
  }, [activePackets, nodes, submeshes, showWaveRings]);

  // Main 60 FPS Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    let animId: number;

    const getActiveLinks = () => {
      const s = new Set<string>();
      for (const p of activePackets) {
        if (p.currentHop && p.nextHop && p.state === 'transmitting') {
          s.add(`${p.currentHop}|${p.nextHop}`);
          s.add(`${p.nextHop}|${p.currentHop}`);
        }
        if (p.pathTraversed.length >= 2) {
          const p1 = p.pathTraversed[p.pathTraversed.length - 2];
          const p2 = p.pathTraversed[p.pathTraversed.length - 1];
          s.add(`${p1}|${p2}`);
          s.add(`${p2}|${p1}`);
        }
      }
      return s;
    };

    const render = () => {
      const parent = canvas.parentElement;
      if (parent && (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight)) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }

      const now = performance.now();
      const activeLinkSet = getActiveLinks();
      const currentBlueprint: BlueprintFloorPlan | null =
        selectedBlueprintKey === 'none' ? null : BLUEPRINT_PRESETS[selectedBlueprintKey] || CAMPUS_ACADEMIC_BLUEPRINT;

      // 1. Dark Neomorphic Canvas Background (#0B0F19)
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      // 2. High-Tech Blueprint Faint Grid Background (Always active across viewport)
      const gridSize = 40;
      const sx = -transform.x / transform.scale - 100;
      const sy = -transform.y / transform.scale - 100;
      const ex = sx + canvas.width / transform.scale + 200;
      const ey = sy + canvas.height / transform.scale + 200;

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
      ctx.lineWidth = 1 / transform.scale;
      ctx.beginPath();
      for (let x = Math.floor(sx / gridSize) * gridSize; x <= ex; x += gridSize) {
        ctx.moveTo(x, sy);
        ctx.lineTo(x, ey);
      }
      for (let y = Math.floor(sy / gridSize) * gridSize; y <= ey; y += gridSize) {
        ctx.moveTo(sx, y);
        ctx.lineTo(ex, y);
      }
      ctx.stroke();

      // 3. Render Architectural CAD Blueprint Floor Plan
      if (currentBlueprint && blueprintOpacity > 0) {
        drawBlueprintFloorPlan(ctx, currentBlueprint, blueprintOpacity, {
          showGrid,
          showDimensions,
          showConduits
        });
      }

      // 4. Sub-Mesh Domain Convex Hulls
      if (showHulls) {
        for (const sm of submeshes) {
          const smNodes = nodes.filter(n => n.submeshId === sm.id);
          if (smNodes.length < 2) continue;
          const pts = smNodes.map(n => n.position);
          const hull = getConvexHull(pts);
          if (hull.length < 2) continue;

          ctx.save();
          ctx.beginPath();
          ctx.lineJoin = 'round';
          ctx.moveTo(hull[0].x, hull[0].y);
          for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y);
          ctx.closePath();

          // Outer halo
          ctx.lineWidth = 42;
          ctx.strokeStyle = sm.color + '0A';
          ctx.stroke();

          // Soft translucent body
          ctx.lineWidth = 18;
          ctx.strokeStyle = sm.color + '12';
          ctx.stroke();
          ctx.fillStyle = sm.color + '07';
          ctx.fill();

          // Domain Header Badge
          const avgX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
          const minY = Math.min(...pts.map(p => p.y)) - 28;

          ctx.fillStyle = sm.color + 'CC';
          ctx.font = '700 9.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`⌁ ${sm.protocol} • ${sm.name} [${sm.frequencyBand}]`, avgX, minY);
          ctx.restore();
        }
      }

      // 5. Network Links & Glowing Conduit Beams
      for (const link of links) {
        const sn = nodes.find(n => n.id === link.source);
        const dn = nodes.find(n => n.id === link.target);
        if (!sn || !dn) continue;

        const isActive = activeLinkSet.has(`${link.source}|${link.target}`);
        const isInterDomain = sn.submeshId !== dn.submeshId;
        const isSelected = selectedLinkId === link.id;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sn.position.x, sn.position.y);
        ctx.lineTo(dn.position.x, dn.position.y);

        if (link.isSevered) {
          // Severed Faulted Link
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([5, 5]);
          ctx.stroke();

          const mx = (sn.position.x + dn.position.x) / 2;
          const my = (sn.position.y + dn.position.y) / 2;
          ctx.fillStyle = '#EF4444';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✕', mx, my);
        } else if (link.isJammed) {
          // Jammed Link
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
        } else if (isActive && showConduitGlow) {
          // Glowing Active Conduit Beam (#06B6D4 for intra-domain, #F59E0B for cross-domain gateway)
          const beamColor = isInterDomain ? '#F59E0B' : '#06B6D4';

          // Outer soft glow aura
          ctx.strokeStyle = beamColor + '66';
          ctx.lineWidth = 6;
          ctx.shadowColor = beamColor;
          ctx.shadowBlur = 18;
          ctx.stroke();

          // Intense core beam
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.8;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Traveling photon energy pulse
          const t = ((now / 550) % 1);
          const px = sn.position.x + (dn.position.x - sn.position.x) * t;
          const py = sn.position.y + (dn.position.y - sn.position.y) * t;

          const g = ctx.createRadialGradient(px, py, 0, px, py, 12);
          g.addColorStop(0, '#FFFFFF');
          g.addColorStop(0.3, beamColor);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, 12, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Idle Link
          ctx.strokeStyle = isInterDomain ? 'rgba(245, 158, 11, 0.28)' : 'rgba(56, 189, 248, 0.18)';
          ctx.lineWidth = isInterDomain ? 1.8 : 1.2;
          if (isInterDomain) ctx.setLineDash([6, 3]);
          ctx.stroke();
        }

        // Link Selection Halo
        if (isSelected) {
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2.8;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(sn.position.x, sn.position.y);
          ctx.lineTo(dn.position.x, dn.position.y);
          ctx.stroke();
        }

        ctx.restore();
      }

      // 6. Dynamic RF Radio Wave Propagation Rings
      if (showWaveRings) {
        waveEffects.current = waveEffects.current.filter(w => now - w.startTime < 1000);
        for (const w of waveEffects.current) {
          const elapsed = (now - w.startTime) / 1000;
          const radius = elapsed * w.maxRadius;
          const alpha = Math.max(0, 0.45 * (1 - elapsed));

          ctx.save();

          // Primary Wave Ring
          ctx.beginPath();
          ctx.arc(w.x, w.y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = w.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
          ctx.lineWidth = 2;
          ctx.stroke();

          // Secondary harmonic sub-ring (frequency ripple effect)
          if (radius > 20) {
            ctx.beginPath();
            ctx.arc(w.x, w.y, radius * 0.72, 0, Math.PI * 2);
            ctx.strokeStyle = w.color + Math.round(alpha * 0.5 * 255).toString(16).padStart(2, '0');
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          if (radius > 45) {
            ctx.beginPath();
            ctx.arc(w.x, w.y, radius * 0.45, 0, Math.PI * 2);
            ctx.strokeStyle = w.color + Math.round(alpha * 0.25 * 255).toString(16).padStart(2, '0');
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }

          ctx.restore();
        }
      }

      // 7. Drop Bursts with Shockwaves & Radiant Sparks
      dropBursts.current = dropBursts.current.filter(d => now - d.startTime < 1300);
      for (const d of dropBursts.current) {
        const elapsed = (now - d.startTime) / 1300;
        const radius = 8 + elapsed * 36;
        const alpha = Math.max(0, 1 - elapsed);

        ctx.save();

        // Expanding shockwave circle
        ctx.beginPath();
        ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.22})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Radiating debris sparks
        for (const sp of d.sparks) {
          const sx = d.x + sp.vx * elapsed;
          const sy = d.y + sp.vy * elapsed;
          ctx.fillStyle = sp.color;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(1, 2.5 * (1 - elapsed)), 0, Math.PI * 2);
          ctx.fill();
        }

        // Drop warning label
        if (elapsed < 0.75) {
          ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
          ctx.font = '700 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`DROP: ${d.reason}`, d.x, d.y - radius - 6);
        }

        ctx.restore();
      }

      // 8. ACK Return Pulses
      ackParticles.current = ackParticles.current.filter(a => now - a.startTime < 1400);
      for (const a of ackParticles.current) {
        const t = Math.min((now - a.startTime) / 1400, 1);
        const easeT = 1 - Math.pow(1 - t, 2);
        const ax = a.sx + (a.dx - a.sx) * easeT;
        const ay = a.sy + (a.dy - a.sy) * easeT;

        ctx.save();
        const g = ctx.createRadialGradient(ax, ay, 0, ax, ay, 9);
        g.addColorStop(0, '#FFFFFF');
        g.addColorStop(0.3, '#10B981');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ax, ay, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ax, ay, 2.8, 0, Math.PI * 2);
        ctx.fill();

        if (t < 0.4) {
          ctx.fillStyle = '#10B981';
          ctx.font = '700 8.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('ACK ✓', ax, ay - 11);
        }
        ctx.restore();
      }

      // 9. Packet Particles with Trails & Gateway Translation Tags
      for (const pkt of activePackets) {
        if (pkt.state !== 'transmitting') continue;

        let sn: MeshNode | undefined;
        let dn: MeshNode | undefined;

        if (pkt.pathTraversed.length >= 2) {
          sn = nodes.find(n => n.id === pkt.pathTraversed[pkt.pathTraversed.length - 2]);
          dn = nodes.find(n => n.id === pkt.currentHop);
        } else {
          sn = nodes.find(n => n.id === pkt.src);
          dn = nodes.find(n => n.id === (pkt.nextHop || pkt.currentHop));
        }

        if (!sn || !dn) continue;

        const t = ((now / 600) % 1);
        const px = sn.position.x + (dn.position.x - sn.position.x) * t;
        const py = sn.position.y + (dn.position.y - sn.position.y) * t;
        const color = pkt.color || '#38BDF8';
        const isGatewayHop = sn.type === 'gateway' || dn.type === 'gateway';

        ctx.save();

        // Multi-segment comet trail
        for (let i = 1; i <= 5; i++) {
          const tt = Math.max(0, t - i * 0.05);
          const tx = sn.position.x + (dn.position.x - sn.position.x) * tt;
          const ty = sn.position.y + (dn.position.y - sn.position.y) * tt;
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.22 * (1 - i / 6);
          ctx.beginPath();
          ctx.arc(tx, ty, Math.max(1.5, 4.5 - i * 0.6), 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = 1.0;

        // Core glow
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 14);
        glow.addColorStop(0, '#FFFFFF');
        glow.addColorStop(0.3, color);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(px, py, 3.8, 0, Math.PI * 2);
        ctx.fill();

        // Packet ID label
        ctx.fillStyle = '#E2E8F0';
        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(pkt.id, px + 9, py - 4);

        // Gateway Translation Tag when crossing or at gateway
        if (isGatewayHop) {
          const tagW = 105;
          const tagH = 17;
          const tagX = px - tagW / 2;
          const tagY = py - 26;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 1.2;
          ctx.fillRect(tagX, tagY, tagW, tagH);
          ctx.strokeRect(tagX, tagY, tagW, tagH);

          ctx.fillStyle = '#F59E0B';
          ctx.font = '700 8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⟡ GW: HWMP ➔ RPL', tagX + tagW / 2, tagY + tagH / 2);
        }

        ctx.restore();
      }

      // 10. Nodes Rendering
      for (const node of nodes) {
        const isSel = selectedNodeId === node.id;
        const sm = submeshes.find(s => s.id === node.submeshId);
        const color = sm?.color || '#3B82F6';
        const r = node.type === 'gateway' ? 18 : node.type === 'router' ? 15 : 12;

        ctx.save();

        // Selection & Range ring
        if (isSel && node.isAlive) {
          ctx.beginPath();
          ctx.arc(node.position.x, node.position.y, r + 8, 0, Math.PI * 2);
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Radio coverage range
          ctx.beginPath();
          ctx.arc(node.position.x, node.position.y, 130, 0, Math.PI * 2);
          ctx.fillStyle = color + '08';
          ctx.fill();
          ctx.strokeStyle = color + '28';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Neomorphic Drop-Shadow Base
        ctx.beginPath();
        ctx.arc(node.position.x + 2, node.position.y + 2, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fill();

        // Node Body
        ctx.beginPath();
        ctx.arc(node.position.x, node.position.y, r, 0, Math.PI * 2);

        if (!node.isAlive) {
          ctx.fillStyle = '#1E293B';
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2;
        } else if (node.type === 'gateway') {
          // Gateway (Dual gold aura)
          const grad = ctx.createRadialGradient(node.position.x, node.position.y, 2, node.position.x, node.position.y, r);
          grad.addColorStop(0, '#FBBF24');
          grad.addColorStop(1, '#D97706');
          ctx.fillStyle = grad;
          ctx.strokeStyle = '#FEF3C7';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#F59E0B';
          ctx.shadowBlur = isSel ? 20 : 10;
        } else if (node.type === 'mobile') {
          // Mobile Unit (Cyan gradient)
          const grad = ctx.createRadialGradient(node.position.x, node.position.y, 2, node.position.x, node.position.y, r);
          grad.addColorStop(0, '#38BDF8');
          grad.addColorStop(1, '#0284C7');
          ctx.fillStyle = grad;
          ctx.strokeStyle = '#E0F2FE';
          ctx.lineWidth = 1.8;
          ctx.shadowColor = '#06B6D4';
          ctx.shadowBlur = isSel ? 16 : 8;
        } else {
          // Standard Router / Sensor
          const grad = ctx.createRadialGradient(node.position.x, node.position.y, 2, node.position.x, node.position.y, r);
          grad.addColorStop(0, color);
          grad.addColorStop(1, '#0F172A');
          ctx.fillStyle = grad;
          ctx.strokeStyle = '#FFFFFF40';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = color;
          ctx.shadowBlur = isSel ? 14 : 6;
        }

        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Glyph Symbol
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${r > 15 ? 12 : 9}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const glyph = node.type === 'gateway' ? '⟡' : node.type === 'router' ? '△' : node.type === 'mobile' ? '✦' : '●';
        ctx.fillText(glyph, node.position.x, node.position.y);

        // Node Label with Neomorphic Backing
        ctx.font = '600 9.5px "Inter", sans-serif';
        const labelText = node.name;
        const lw = ctx.measureText(labelText).width;
        const ly = node.position.y + r + 13;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(node.position.x - lw / 2 - 4, ly - 6, lw + 8, 13);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(node.position.x - lw / 2 - 4, ly - 6, lw + 8, 13);

        ctx.fillStyle = node.isAlive ? '#E2E8F0' : '#64748B';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, node.position.x, ly);

        // Queue Micro-Gauge
        if (node.isAlive && node.queueCapacity > 0) {
          const qf = node.currentQueue.length / node.queueCapacity;
          const gw = 26;
          const gh = 3.5;
          const gx = node.position.x - gw / 2;
          const gy = node.position.y - r - 8;

          ctx.fillStyle = '#0F172A';
          ctx.fillRect(gx - 1, gy - 1, gw + 2, gh + 2);
          ctx.fillStyle = '#334155';
          ctx.fillRect(gx, gy, gw, gh);

          if (qf > 0) {
            ctx.fillStyle = qf > 0.8 ? '#EF4444' : qf > 0.4 ? '#F59E0B' : '#10B981';
            ctx.fillRect(gx, gy, gw * qf, gh);
          }
        }

        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    nodes,
    links,
    submeshes,
    activePackets,
    selectedNodeId,
    selectedLinkId,
    transform,
    selectedBlueprintKey,
    blueprintOpacity,
    showGrid,
    showDimensions,
    showConduits,
    showWaveRings,
    showConduitGlow,
    showHulls
  ]);

  // Mouse Interaction handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const wp = screenToWorld(e.clientX, e.clientY);

    // Click on node?
    for (const node of nodes) {
      const r = node.type === 'gateway' ? 22 : 18;
      if (Math.hypot(node.position.x - wp.x, node.position.y - wp.y) <= r) {
        draggedNodeId.current = node.id;
        onSelectNode(node.id);
        onSelectLink(null);
        return;
      }
    }

    // Click on link?
    for (const link of links) {
      const sn = nodes.find(n => n.id === link.source);
      const dn = nodes.find(n => n.id === link.target);
      if (!sn || !dn) continue;
      const l2 = Math.hypot(sn.position.x - dn.position.x, sn.position.y - dn.position.y) ** 2;
      if (l2 === 0) continue;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((wp.x - sn.position.x) * (dn.position.x - sn.position.x) + (wp.y - sn.position.y) * (dn.position.y - sn.position.y)) / l2
        )
      );
      const px = sn.position.x + t * (dn.position.x - sn.position.x);
      const py = sn.position.y + t * (dn.position.y - sn.position.y);
      if (Math.hypot(wp.x - px, wp.y - py) <= 12) {
        onSelectLink(link.id);
        onSelectNode(null);
        return;
      }
    }

    // Drag canvas
    isDraggingCanvas.current = true;
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    onSelectNode(null);
    onSelectLink(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNodeId.current) {
      const wp = screenToWorld(e.clientX, e.clientY);
      onMoveNode(draggedNodeId.current, Math.round(wp.x), Math.round(wp.y));
    } else if (isDraggingCanvas.current) {
      setTransform(p => ({
        ...p,
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      }));
    }
  };

  const handleMouseUp = () => {
    draggedNodeId.current = null;
    isDraggingCanvas.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;

    setTransform(p => {
      const newScale = Math.min(Math.max(p.scale * zoomFactor, 0.3), 3.5);
      const wx = (mx - p.x) / p.scale;
      const wy = (my - p.y) / p.scale;
      return {
        scale: newScale,
        x: mx - wx * newScale,
        y: my - wy * newScale
      };
    });
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0B0F19]">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-crosshair block"
      />

      {/* Floating Neomorphic Blueprint Controls Toolbar (Top-Right) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#161B26]/90 border border-slate-700/60 shadow-lg backdrop-blur-md">
          <button
            onClick={() => setIsToolbarOpen(!isToolbarOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isToolbarOpen
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-inner'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Toggle Blueprint Floor Plan Settings"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Blueprint HUD</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono">
              {Math.round(blueprintOpacity * 100)}%
            </span>
          </button>

          <button
            onClick={handleFitView}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            title="Fit / Center View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Expanded Blueprint Settings Panel */}
        {isToolbarOpen && (
          <div className="w-72 p-3.5 rounded-2xl bg-[#161B26]/95 border border-slate-700/70 shadow-2xl backdrop-blur-xl flex flex-col gap-3 text-xs text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
              <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Architectural Floor Plan</span>
              </div>
              <span className="text-[10px] text-cyan-400/80 font-mono">2D CAD</span>
            </div>

            {/* Blueprint Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-400">Active Blueprint Scenario</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setSelectedBlueprintKey('campus_academic_wing')}
                  className={`px-2 py-1.5 rounded-lg text-left text-[11px] font-medium transition-all ${
                    selectedBlueprintKey === 'campus_academic_wing'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  MIT AOE Wing
                </button>
                <button
                  onClick={() => setSelectedBlueprintKey('smart_logistics')}
                  className={`px-2 py-1.5 rounded-lg text-left text-[11px] font-medium transition-all ${
                    selectedBlueprintKey === 'smart_logistics'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  Logistics Complex
                </button>
              </div>
            </div>

            {/* Blueprint Opacity Slider (0% - 100%) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Blueprint Opacity</span>
                <span className="text-cyan-400 font-mono font-semibold">
                  {Math.round(blueprintOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={blueprintOpacity}
                onChange={e => setBlueprintOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Layer Toggles */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-700/40">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Visual Layers</span>

              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={e => setShowGrid(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 w-3 h-3"
                  />
                  <span>CAD Grid</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDimensions}
                    onChange={e => setShowDimensions(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 w-3 h-3"
                  />
                  <span>Dimensions</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showConduits}
                    onChange={e => setShowConduits(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 w-3 h-3"
                  />
                  <span>Cable Trays</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWaveRings}
                    onChange={e => setShowWaveRings(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 w-3 h-3"
                  />
                  <span className="flex items-center gap-1">
                    <Radio className="w-3 h-3 text-cyan-400" />
                    RF Waves
                  </span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showConduitGlow}
                    onChange={e => setShowConduitGlow(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 w-3 h-3"
                  />
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Beam Glow
                  </span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showHulls}
                    onChange={e => setShowHulls(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 w-3 h-3"
                  />
                  <span>Domain Hulls</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Canvas Info Pill (Bottom-Left) */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[#161B26]/85 border border-slate-700/50 backdrop-blur-md text-[11px] text-slate-300 font-mono shadow-md pointer-events-none">
        <span className="flex items-center gap-1 text-cyan-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          60 FPS
        </span>
        <span className="text-slate-500">•</span>
        <span>Zoom: {Math.round(transform.scale * 100)}%</span>
        <span className="text-slate-500">•</span>
        <span>Nodes: {nodes.length}</span>
        <span className="text-slate-500">•</span>
        <span>Links: {links.length}</span>
      </div>
    </div>
  );
};
