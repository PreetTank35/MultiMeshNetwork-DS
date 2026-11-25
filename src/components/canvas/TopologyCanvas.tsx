/**
 * Full-Screen 2D Topology & Architectural Blueprint Canvas
 * - Adaptive Light/Dark Neomorphism drafting surface
 * - Clean architectural floor plans (zero noisy blue lines or diagonal hatching)
 * - Smart safe-area fit-to-screen so left PathPickerHUD never obscures any node
 * - Tactile neomorphic node tokens, radio wave propagation rings, glowing active conduits,
 *   packet comet trails, gateway translation tags, drop shockwaves, and ACK return pulses.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Layers, Maximize2, Radio, Sliders, Zap } from 'lucide-react';
import { MeshNode, NetworkLink, Packet, SubMeshDomain } from '../../types/simulator';
import {
  BLUEPRINT_PRESETS,
  BlueprintFloorPlan,
  CAMPUS_ACADEMIC_BLUEPRINT,
  drawBlueprintFloorPlan,
} from '../../data/blueprintMaps';

interface WaveEffect {
  x: number;
  y: number;
  startTime: number;
  maxRadius: number;
  color: string;
}

interface DropBurst {
  x: number;
  y: number;
  startTime: number;
  reason: string;
  sparks: Array<{ vx: number; vy: number; color: string }>;
}

interface AckParticle {
  waypoints: Array<{ x: number; y: number }>;
  startTime: number;
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
  highlightedRoute?: string[] | null;
  isDarkTheme?: boolean;
  isPresentationMode?: boolean;
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
  activeBlueprintId = 'campus_academic_wing',
  highlightedRoute,
  isDarkTheme = false,
  isPresentationMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initial transform leaves left 320px clear for PathPickerHUD so zero nodes are obscured
  const [transform, setTransform] = useState({ x: 295, y: 40, scale: 0.88 });
  const isDraggingCanvas = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const draggedNodeId = useRef<string | null>(null);

  // Blueprint Controls State
  const [selectedBlueprintKey, setSelectedBlueprintKey] = useState<string>(activeBlueprintId);
  const [blueprintOpacity, setBlueprintOpacity] = useState<number>(0.9);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showWaveRings, setShowWaveRings] = useState<boolean>(true);
  const [showConduitGlow, setShowConduitGlow] = useState<boolean>(true);
  const [showHulls, setShowHulls] = useState<boolean>(true);
  const [isToolbarOpen, setIsToolbarOpen] = useState<boolean>(false);

  // Sync blueprint preset when scenario changes
  useEffect(() => {
    setSelectedBlueprintKey(activeBlueprintId);
  }, [activeBlueprintId]);

  const waveEffects = useRef<WaveEffect[]>([]);
  const dropBursts = useRef<DropBurst[]>([]);
  const ackParticles = useRef<AckParticle[]>([]);
  const prevPacketHops = useRef<Map<string, number>>(new Map());

  const getConvexHull = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length < 3) return pts;
    const sorted = [...pts].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
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

  const screenToWorld = useCallback(
    (cx: number, cy: number) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const r = canvasRef.current.getBoundingClientRect();
      return {
        x: (cx - r.left - transform.x) / transform.scale,
        y: (cy - r.top - transform.y) / transform.scale,
      };
    },
    [transform]
  );

  // Fit blueprint cleanly inside the open safe area to the right of left HUD
  const handleFitView = useCallback(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const cw = parent.clientWidth;
    const ch = parent.clientHeight;
    const leftPadding = isPresentationMode ? 40 : 372;
    const availW = Math.max(cw - leftPadding - 40, 400);
    const availH = Math.max(ch - 170, 320);
    const bpW = 920;
    const bpH = 540;
    const scale = Math.min(availW / bpW, availH / bpH, 1.15);
    const offsetX = leftPadding + (availW - bpW * scale) / 2 - 60 * scale;
    const offsetY = 66 + (availH - bpH * scale) / 2 - 70 * scale;
    setTransform({ x: Math.round(offsetX), y: Math.round(offsetY), scale: Number(scale.toFixed(2)) });
  }, [isPresentationMode]);

  // Auto-fit once on initial mount or when toggling presentation mode
  useEffect(() => {
    const timer = setTimeout(handleFitView, 80);
    return () => clearTimeout(timer);
  }, [handleFitView]);

  // Detect hop, delivery, and drop events (strictly deduplicated)
  useEffect(() => {
    for (const pkt of activePackets) {
      const prevHops = prevPacketHops.current.get(pkt.id) ?? 0;

      if (pkt.state === 'transmitting' && prevHops !== -1) {
        if (pkt.hops > prevHops) {
          const hopNode = nodes.find(n => n.id === pkt.currentHop);
          const sm = hopNode ? submeshes.find(s => s.id === hopNode.submeshId) : null;
          if (hopNode && showWaveRings) {
            waveEffects.current.push({
              x: hopNode.position.x,
              y: hopNode.position.y,
              startTime: performance.now(),
              maxRadius: hopNode.type === 'gateway' ? 115 : 85,
              color: sm?.color || '#2563EB',
            });
          }
          prevPacketHops.current.set(pkt.id, pkt.hops);
        }
      } else if (pkt.state === 'received' && prevHops !== -1) {
        const revWaypoints = [...pkt.pathTraversed]
          .reverse()
          .map(nid => nodes.find(n => n.id === nid)?.position)
          .filter((p): p is { x: number; y: number } => Boolean(p));

        if (revWaypoints.length >= 2) {
          ackParticles.current.push({
            waypoints: revWaypoints,
            startTime: performance.now(),
          });
        }
        prevPacketHops.current.set(pkt.id, -1);
      } else if (pkt.state === 'dropped' && prevHops !== -1) {
        const dropNode = nodes.find(n => n.id === pkt.currentHop);
        if (dropNode) {
          const sparks = Array.from({ length: 10 }, () => {
            const angle = Math.random() * Math.PI * 2;
            const spd = 20 + Math.random() * 40;
            return {
              vx: Math.cos(angle) * spd,
              vy: Math.sin(angle) * spd,
              color: Math.random() > 0.5 ? '#DC2626' : '#D97706',
            };
          });
          dropBursts.current.push({
            x: dropNode.position.x,
            y: dropNode.position.y,
            startTime: performance.now(),
            reason: pkt.dropReason || 'RF Drop',
            sparks,
          });
        }
        prevPacketHops.current.set(pkt.id, -1);
      }
    }
  }, [activePackets, nodes, submeshes, showWaveRings]);

  // 60 FPS Render Loop
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
      if (highlightedRoute && highlightedRoute.length > 1) {
        for (let i = 0; i < highlightedRoute.length - 1; i++) {
          s.add(`${highlightedRoute[i]}|${highlightedRoute[i + 1]}`);
          s.add(`${highlightedRoute[i + 1]}|${highlightedRoute[i]}`);
        }
      }
      return s;
    };

    const render = () => {
      const parent = canvas.parentElement;
      const cw = parent ? parent.clientWidth : canvas.clientWidth;
      const ch = parent ? parent.clientHeight : canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const now = performance.now();
      const activeLinkSet = getActiveLinks();
      const currentBlueprint: BlueprintFloorPlan | null =
        selectedBlueprintKey === 'none' ? null : BLUEPRINT_PRESETS[selectedBlueprintKey] || CAMPUS_ACADEMIC_BLUEPRINT;

      // 1. Soft Neomorphic Canvas Drafting Surface
      ctx.fillStyle = isDarkTheme ? '#1F2534' : '#E0E6F0';
      ctx.fillRect(0, 0, cw, ch);

      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      // 2. Subtle Drafting Dots Background
      if (showGrid) {
        const dotStep = 40;
        const sx = -transform.x / transform.scale - 80;
        const sy = -transform.y / transform.scale - 80;
        const ex = sx + cw / transform.scale + 160;
        const ey = sy + ch / transform.scale + 160;
        ctx.fillStyle = isDarkTheme ? 'rgba(148, 163, 184, 0.14)' : 'rgba(100, 116, 139, 0.22)';
        for (let gx = Math.floor(sx / dotStep) * dotStep; gx <= ex; gx += dotStep) {
          for (let gy = Math.floor(sy / dotStep) * dotStep; gy <= ey; gy += dotStep) {
            ctx.fillRect(gx - 0.75, gy - 0.75, 1.5, 1.5);
          }
        }
      }

      // 3. Clean Architectural Floor Sketch
      if (currentBlueprint && blueprintOpacity > 0) {
        drawBlueprintFloorPlan(ctx, currentBlueprint, blueprintOpacity, {
          showGrid: false,
          isDark: isDarkTheme,
        });
      }

      // 4. Sub-Mesh Domain Soft Perimeter Hulls
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

          ctx.lineWidth = 34;
          ctx.strokeStyle = sm.color + (isDarkTheme ? '12' : '14');
          ctx.stroke();
          ctx.fillStyle = sm.color + (isDarkTheme ? '0A' : '0C');
          ctx.fill();

          const avgX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
          const minY = Math.min(...pts.map(p => p.y)) - 30;
          ctx.fillStyle = sm.color;
          ctx.font = '700 9.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${sm.protocol} • ${sm.name} [${sm.frequencyBand}]`, avgX, minY);
          ctx.restore();
        }
      }

      // 5. Wireless Links & Active Glowing Conduits
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
          ctx.strokeStyle = 'rgba(220, 38, 38, 0.75)';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([5, 5]);
          ctx.stroke();

          const mx = (sn.position.x + dn.position.x) / 2;
          const my = (sn.position.y + dn.position.y) / 2;
          ctx.fillStyle = '#DC2626';
          ctx.font = 'bold 13px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✕', mx, my);
        } else if (link.isJammed) {
          ctx.strokeStyle = 'rgba(217, 119, 6, 0.75)';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
        } else if (isActive && showConduitGlow) {
          const beamColor = isInterDomain ? '#D97706' : '#0891B2';
          ctx.strokeStyle = beamColor + '66';
          ctx.lineWidth = 6.5;
          ctx.shadowColor = beamColor;
          ctx.shadowBlur = 14;
          ctx.stroke();

          ctx.strokeStyle = isDarkTheme ? '#E0F2FE' : '#06B6D4';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.shadowBlur = 0;

          const t = (now / 550) % 1;
          const px = sn.position.x + (dn.position.x - sn.position.x) * t;
          const py = sn.position.y + (dn.position.y - sn.position.y) * t;
          const g = ctx.createRadialGradient(px, py, 0, px, py, 10);
          g.addColorStop(0, '#FFFFFF');
          g.addColorStop(0.35, beamColor);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, 10, 0, Math.PI * 2);
          ctx.fill();
        } else {
          if (isInterDomain) {
            ctx.strokeStyle = isDarkTheme ? 'rgba(245, 158, 11, 0.45)' : 'rgba(217, 119, 6, 0.55)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
          } else {
            ctx.strokeStyle = isDarkTheme ? 'rgba(148, 163, 184, 0.25)' : 'rgba(100, 116, 139, 0.32)';
            ctx.lineWidth = 1.5;
          }
          ctx.stroke();
        }

        if (isSelected) {
          ctx.strokeStyle = '#2563EB';
          ctx.lineWidth = 3;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(sn.position.x, sn.position.y);
          ctx.lineTo(dn.position.x, dn.position.y);
          ctx.stroke();
        }

        ctx.restore();
      }

      // 6. Radio Wave Propagation Rings
      if (showWaveRings) {
        waveEffects.current = waveEffects.current.filter(w => now - w.startTime < 1000);
        for (const w of waveEffects.current) {
          const elapsed = (now - w.startTime) / 1000;
          const radius = elapsed * w.maxRadius;
          const alpha = Math.max(0, 0.45 * (1 - elapsed));

          ctx.save();
          ctx.beginPath();
          ctx.arc(w.x, w.y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = w.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
          ctx.lineWidth = 1.8;
          ctx.stroke();
          ctx.restore();
        }
      }

      // 7. Drop Bursts
      dropBursts.current = dropBursts.current.filter(d => now - d.startTime < 1300);
      for (const d of dropBursts.current) {
        const elapsed = (now - d.startTime) / 1300;
        const radius = 8 + elapsed * 34;
        const alpha = Math.max(0, 1 - elapsed);

        ctx.save();
        ctx.beginPath();
        ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 38, 38, ${alpha * 0.2})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(220, 38, 38, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        for (const sp of d.sparks) {
          ctx.fillStyle = sp.color;
          ctx.beginPath();
          ctx.arc(d.x + sp.vx * elapsed, d.y + sp.vy * elapsed, Math.max(1, 2.5 * (1 - elapsed)), 0, Math.PI * 2);
          ctx.fill();
        }

        if (elapsed < 0.75) {
          ctx.fillStyle = `rgba(220, 38, 38, ${alpha})`;
          ctx.font = '700 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`DROP: ${d.reason}`, d.x, d.y - radius - 6);
        }
        ctx.restore();
      }

      // 8. Smooth Reverse-Hop ACK Return Pulses (Single pulse per delivery)
      ackParticles.current = ackParticles.current.filter(a => now - a.startTime < 1400);
      for (const a of ackParticles.current) {
        const wps = a.waypoints;
        if (wps.length < 2) continue;
        const t = Math.min((now - a.startTime) / 1400, 0.999);
        const segCount = wps.length - 1;
        const scaled = t * segCount;
        const segIdx = Math.min(Math.floor(scaled), segCount - 1);
        const localT = scaled - segIdx;
        const p1 = wps[segIdx];
        const p2 = wps[segIdx + 1];
        const ax = p1.x + (p2.x - p1.x) * localT;
        const ay = p1.y + (p2.y - p1.y) * localT;

        ctx.save();
        const g = ctx.createRadialGradient(ax, ay, 0, ax, ay, 10);
        g.addColorStop(0, '#FFFFFF');
        g.addColorStop(0.35, '#059669');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ax, ay, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#059669';
        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ACK ✓', ax, ay - 12);
        ctx.restore();
      }

      // 9. Packet Particles & Gateway Translation Tag
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

        const t = (now / 600) % 1;
        const px = sn.position.x + (dn.position.x - sn.position.x) * t;
        const py = sn.position.y + (dn.position.y - sn.position.y) * t;
        const color = pkt.color || '#2563EB';
        const isGatewayHop = sn.type === 'gateway' || dn.type === 'gateway';

        ctx.save();
        for (let i = 1; i <= 5; i++) {
          const tt = Math.max(0, t - i * 0.05);
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.25 * (1 - i / 6);
          ctx.beginPath();
          ctx.arc(sn.position.x + (dn.position.x - sn.position.x) * tt, sn.position.y + (dn.position.y - sn.position.y) * tt, Math.max(1.5, 4.5 - i * 0.6), 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = 1;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 13);
        glow.addColorStop(0, '#FFFFFF');
        glow.addColorStop(0.35, color);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, 13, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isDarkTheme ? '#E2E8F0' : '#1E293B';
        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(pkt.id, px + 9, py - 4);

        if (isGatewayHop) {
          const tagW = 112;
          const tagH = 18;
          const tagX = px - tagW / 2;
          const tagY = py - 26;
          ctx.fillStyle = isDarkTheme ? '#1F2534' : '#EDF1F8';
          ctx.strokeStyle = '#D97706';
          ctx.lineWidth = 1.2;
          ctx.fillRect(tagX, tagY, tagW, tagH);
          ctx.strokeRect(tagX, tagY, tagW, tagH);

          ctx.fillStyle = '#D97706';
          ctx.font = '700 8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⟡ GW: HWMP ➔ RPL', tagX + tagW / 2, tagY + tagH / 2);
        }
        ctx.restore();
      }

      // 10. Tactile Neomorphic Nodes
      for (const node of nodes) {
        const isSel = selectedNodeId === node.id;
        const sm = submeshes.find(s => s.id === node.submeshId);
        const accentColor = sm?.color || '#2563EB';
        const r = node.type === 'gateway' ? 18 : node.type === 'router' ? 15 : 13;

        ctx.save();

        if (isSel && node.isAlive) {
          ctx.beginPath();
          ctx.arc(node.position.x, node.position.y, r + 7, 0, Math.PI * 2);
          ctx.strokeStyle = accentColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.beginPath();
          ctx.arc(node.position.x, node.position.y, 125, 0, Math.PI * 2);
          ctx.fillStyle = accentColor + '0A';
          ctx.fill();
          ctx.strokeStyle = accentColor + '28';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Tactile dual-shadow neomorphic disc
        ctx.shadowColor = isDarkTheme ? 'rgba(10, 13, 20, 0.7)' : 'rgba(148, 163, 184, 0.65)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;

        ctx.beginPath();
        ctx.arc(node.position.x, node.position.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isDarkTheme ? '#283042' : '#EBF0F7';
        ctx.fill();

        // Top-left soft highlight rim
        ctx.shadowColor = isDarkTheme ? 'rgba(55, 65, 88, 0.6)' : 'rgba(255, 255, 255, 0.95)';
        ctx.shadowOffsetX = -3;
        ctx.shadowOffsetY = -3;
        ctx.shadowBlur = 6;
        ctx.strokeStyle = !node.isAlive
          ? '#DC2626'
          : node.type === 'gateway'
          ? '#D97706'
          : accentColor;
        ctx.lineWidth = node.type === 'gateway' ? 3 : 2.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Colored Inner Core
        const coreR = r - 5;
        ctx.beginPath();
        ctx.arc(node.position.x, node.position.y, coreR, 0, Math.PI * 2);
        ctx.fillStyle = !node.isAlive
          ? '#64748B'
          : node.type === 'gateway'
          ? '#D97706'
          : node.type === 'mobile'
          ? '#0891B2'
          : accentColor;
        ctx.fill();

        // Glyph
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${r > 15 ? 10 : 8.5}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const glyph = node.type === 'gateway' ? '⟡' : node.type === 'router' ? '△' : node.type === 'mobile' ? '✦' : '●';
        ctx.fillText(glyph, node.position.x, node.position.y + 0.5);

        // Clean Neomorphic Label Pill
        ctx.font = '600 9.5px "Inter", sans-serif';
        const labelText = node.name;
        const lw = ctx.measureText(labelText).width;
        const ly = node.position.y + r + 13;

        ctx.fillStyle = isDarkTheme ? 'rgba(30, 36, 50, 0.92)' : 'rgba(241, 245, 250, 0.94)';
        ctx.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.35)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.roundRect(node.position.x - lw / 2 - 5, ly - 7, lw + 10, 14, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = node.isAlive ? (isDarkTheme ? '#F1F5F9' : '#1E293B') : '#94A3B8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, node.position.x, ly);

        // Queue Micro-Gauge
        if (node.isAlive && node.queueCapacity > 0) {
          const qf = node.currentQueue.length / node.queueCapacity;
          const gw = 24;
          const gh = 3;
          const gx = node.position.x - gw / 2;
          const gy = node.position.y - r - 8;
          ctx.fillStyle = isDarkTheme ? '#181D29' : '#CBD5E1';
          ctx.fillRect(gx, gy, gw, gh);
          if (qf > 0) {
            ctx.fillStyle = qf > 0.8 ? '#DC2626' : qf > 0.4 ? '#D97706' : '#059669';
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
    showWaveRings,
    showConduitGlow,
    showHulls,
    highlightedRoute,
    isDarkTheme,
  ]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const wp = screenToWorld(e.clientX, e.clientY);
    for (const node of nodes) {
      const r = node.type === 'gateway' ? 22 : 18;
      if (Math.hypot(node.position.x - wp.x, node.position.y - wp.y) <= r) {
        draggedNodeId.current = node.id;
        onSelectNode(node.id);
        onSelectLink(null);
        return;
      }
    }
    for (const link of links) {
      const sn = nodes.find(n => n.id === link.source);
      const dn = nodes.find(n => n.id === link.target);
      if (!sn || !dn) continue;
      const l2 = Math.hypot(sn.position.x - dn.position.x, sn.position.y - dn.position.y) ** 2;
      if (l2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((wp.x - sn.position.x) * (dn.position.x - sn.position.x) + (wp.y - sn.position.y) * (dn.position.y - sn.position.y)) / l2));
      const px = sn.position.x + t * (dn.position.x - sn.position.x);
      const py = sn.position.y + t * (dn.position.y - sn.position.y);
      if (Math.hypot(wp.x - px, wp.y - py) <= 12) {
        onSelectLink(link.id);
        onSelectNode(null);
        return;
      }
    }
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
      setTransform(p => ({ ...p, x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }));
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
      return { scale: newScale, x: mx - wx * newScale, y: my - wy * newScale };
    });
  };

  return (
    <div className="relative w-full h-full overflow-hidden neu-base">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-crosshair block"
      />

      {/* Top-Right Static Blueprint Controls Pill — Larger & Crisp */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2.5">
        <div className="flex items-center gap-2 p-2 rounded-2xl neu-convex">
          <button
            onClick={() => setIsToolbarOpen(!isToolbarOpen)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all ${
              isToolbarOpen ? 'neu-pressed text-sky-600 dark:text-cyan-400' : 'neu-button-sm text-neu-text'
            }`}
            title="Floor Plan & Visual Layer Settings"
          >
            <Sliders className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
            <span>Blueprint</span>
            <span className="text-[11px] px-2 py-0.5 rounded-md neu-pressed-sm text-sky-600 dark:text-cyan-400 font-mono font-bold">
              {Math.round(blueprintOpacity * 100)}%
            </span>
          </button>

          <button
            onClick={handleFitView}
            className="p-2 rounded-xl neu-button-sm text-neu-muted hover:text-neu-text"
            title="Fit Campus to View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {isToolbarOpen && (
          <div className="w-80 p-4 rounded-2xl neu-convex flex flex-col gap-3.5 text-xs text-neu-text animate-fade-up">
            <div className="flex items-center justify-between pb-2.5 border-b border-neu-border">
              <div className="flex items-center gap-2 font-bold text-[13px]">
                <Layers className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                <span>2D Floor Plan Sketch</span>
              </div>
              <span className="text-[11px] text-neu-muted font-mono font-bold">CAD</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neu-muted">Map Preset</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'campus_academic_wing', label: 'Campus' },
                  { key: 'smart_logistics', label: 'Logistics' },
                  { key: 'none', label: 'Blank' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setSelectedBlueprintKey(opt.key)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      selectedBlueprintKey === opt.key
                        ? 'neu-pressed text-sky-600 dark:text-cyan-300'
                        : 'neu-button-sm text-neu-muted hover:text-neu-text'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neu-muted font-semibold">Sketch Opacity</span>
                <span className="text-sky-600 dark:text-cyan-400 font-mono font-bold">
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
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-neu-border">
              <span className="text-[11px] uppercase font-bold tracking-wider text-neu-muted">Overlays</span>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="accent-sky-600 w-3.5 h-3.5" />
                  <span>Dot Grid</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showHulls} onChange={e => setShowHulls(e.target.checked)} className="accent-sky-600 w-3.5 h-3.5" />
                  <span>Sub-Mesh Hulls</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showWaveRings} onChange={e => setShowWaveRings(e.target.checked)} className="accent-sky-600 w-3.5 h-3.5" />
                  <span className="flex items-center gap-1"><Radio className="w-3.5 h-3.5 text-sky-500" />RF Waves</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showConduitGlow} onChange={e => setShowConduitGlow(e.target.checked)} className="accent-sky-600 w-3.5 h-3.5" />
                  <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-500" />Beam Glow</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom-Left Static Status Pill — Larger & Readable */}
      <div className="absolute bottom-5 left-4 z-10 flex items-center gap-3 px-4 py-2 rounded-2xl neu-convex-sm text-xs text-neu-muted font-mono pointer-events-none">
        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          60 FPS
        </span>
        <span>•</span>
        <span className="font-semibold text-neu-text">{Math.round(transform.scale * 100)}%</span>
        <span>•</span>
        <span><strong className="text-neu-text">{nodes.length}</strong> Nodes</span>
        <span>•</span>
        <span><strong className="text-neu-text">{links.length}</strong> Links</span>
      </div>
    </div>
  );
};
