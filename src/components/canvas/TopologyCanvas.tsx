/**
 * High-Performance Full-Screen Topology Canvas
 * Features: radio wave propagation rings, glowing link beams, queue micro-gauges,
 * animated packet particles with trails, gateway translation tooltips,
 * drop burst effects, ACK return particles, and convex-hull domain perimeters.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MeshNode, NetworkLink, Packet, SubMeshDomain } from '../../types/simulator';

interface WaveEffect { x: number; y: number; startTime: number; maxRadius: number; color: string }
interface DropBurst { x: number; y: number; startTime: number; reason: string }
interface AckParticle { sx: number; sy: number; dx: number; dy: number; startTime: number; color: string }

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
}

export const TopologyCanvas: React.FC<Props> = ({ nodes, links, submeshes, activePackets, selectedNodeId, selectedLinkId, onSelectNode, onSelectLink, onMoveNode }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isDraggingCanvas = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const draggedNodeId = useRef<string | null>(null);
  const waveEffects = useRef<WaveEffect[]>([]);
  const dropBursts = useRef<DropBurst[]>([]);
  const ackParticles = useRef<AckParticle[]>([]);
  const prevPacketHops = useRef<Map<string, number>>(new Map());

  // Convex Hull
  const getConvexHull = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length < 3) return pts;
    const sorted = [...pts].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
    const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower: typeof pts = [];
    for (const p of sorted) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    const upper: typeof pts = [];
    for (let i = sorted.length - 1; i >= 0; i--) { const p = sorted[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  };

  const screenToWorld = useCallback((cx: number, cy: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const r = canvasRef.current.getBoundingClientRect();
    return { x: (cx - r.left - transform.x) / transform.scale, y: (cy - r.top - transform.y) / transform.scale };
  }, [transform]);

  // Detect new hops to trigger wave effects
  useEffect(() => {
    for (const pkt of activePackets) {
      const prevHops = prevPacketHops.current.get(pkt.id) ?? 0;
      if (pkt.hops > prevHops && pkt.state === 'transmitting') {
        const hopNode = nodes.find(n => n.id === pkt.currentHop);
        const sm = hopNode ? submeshes.find(s => s.id === hopNode.submeshId) : null;
        if (hopNode) {
          waveEffects.current.push({ x: hopNode.position.x, y: hopNode.position.y, startTime: performance.now(), maxRadius: 100, color: sm?.color || '#3B82F6' });
        }
      }
      prevPacketHops.current.set(pkt.id, pkt.hops);

      // Detect delivered → ACK
      if (pkt.state === 'received' && prevHops !== -1) {
        const srcN = nodes.find(n => n.id === pkt.src);
        const dstN = nodes.find(n => n.id === pkt.dst);
        if (srcN && dstN) {
          ackParticles.current.push({ sx: dstN.position.x, sy: dstN.position.y, dx: srcN.position.x, dy: srcN.position.y, startTime: performance.now(), color: '#10B981' });
        }
        prevPacketHops.current.set(pkt.id, -1); // Mark as handled
      }

      // Detect drop → burst
      if (pkt.state === 'dropped' && prevHops >= 0) {
        const dropNode = nodes.find(n => n.id === pkt.currentHop);
        if (dropNode) {
          dropBursts.current.push({ x: dropNode.position.x, y: dropNode.position.y, startTime: performance.now(), reason: pkt.dropReason || 'RF Drop' });
        }
        prevPacketHops.current.set(pkt.id, -1);
      }
    }
  }, [activePackets, nodes, submeshes]);

  // 60 FPS Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId: number;

    // Build active link set for glow
    const getActiveLinks = () => {
      const s = new Set<string>();
      for (const p of activePackets) if (p.currentHop && p.nextHop && p.state === 'transmitting') { s.add(`${p.currentHop}|${p.nextHop}`); s.add(`${p.nextHop}|${p.currentHop}`); }
      return s;
    };

    const render = () => {
      const parent = canvas.parentElement;
      if (parent && (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight)) {
        canvas.width = parent.clientWidth; canvas.height = parent.clientHeight;
      }
      const now = performance.now();
      const activeLinkSet = getActiveLinks();

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      // Grid
      const gridSize = 50;
      const sx = -transform.x / transform.scale, sy = -transform.y / transform.scale;
      const ex = sx + canvas.width / transform.scale, ey = sy + canvas.height / transform.scale;
      ctx.strokeStyle = '#141D2E'; ctx.lineWidth = 1 / transform.scale;
      ctx.beginPath();
      for (let x = Math.floor(sx / gridSize) * gridSize; x <= ex; x += gridSize) { ctx.moveTo(x, sy); ctx.lineTo(x, ey); }
      for (let y = Math.floor(sy / gridSize) * gridSize; y <= ey; y += gridSize) { ctx.moveTo(sx, y); ctx.lineTo(ex, y); }
      ctx.stroke();

      // Convex Hull Domains
      for (const sm of submeshes) {
        const smNodes = nodes.filter(n => n.submeshId === sm.id);
        if (smNodes.length < 2) continue;
        const pts = smNodes.map(n => n.position);
        const hull = getConvexHull(pts);
        if (hull.length < 2) continue;

        ctx.save(); ctx.beginPath(); ctx.lineJoin = 'round';
        ctx.moveTo(hull[0].x, hull[0].y);
        for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y);
        ctx.closePath();
        ctx.lineWidth = 50; ctx.strokeStyle = sm.color + '08'; ctx.stroke();
        ctx.fillStyle = sm.color + '06'; ctx.fill();

        const avgX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const minY = Math.min(...pts.map(p => p.y)) - 40;
        ctx.fillStyle = sm.color + '90'; ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center'; ctx.fillText(`${sm.protocol} • ${sm.name} (${sm.frequencyBand})`, avgX, minY);
        ctx.restore();
      }

      // Links
      for (const link of links) {
        const sn = nodes.find(n => n.id === link.source), dn = nodes.find(n => n.id === link.target);
        if (!sn || !dn) continue;
        const isActive = activeLinkSet.has(`${link.source}|${link.target}`);
        const isInterDomain = sn.submeshId !== dn.submeshId;

        ctx.save(); ctx.beginPath();
        ctx.moveTo(sn.position.x, sn.position.y);
        ctx.lineTo(dn.position.x, dn.position.y);

        if (link.isSevered) {
          ctx.strokeStyle = '#EF444480'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.stroke();
          const mx = (sn.position.x + dn.position.x) / 2, my = (sn.position.y + dn.position.y) / 2;
          ctx.fillStyle = '#EF4444'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✕', mx, my + 4);
        } else if (link.isJammed) {
          ctx.strokeStyle = '#F59E0B60'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.stroke();
        } else if (isActive) {
          // Glowing active beam
          const smSrc = submeshes.find(s => s.id === sn.submeshId);
          const beamColor = isInterDomain ? '#F59E0B' : (smSrc?.color || '#3B82F6');
          ctx.strokeStyle = beamColor + 'CC'; ctx.lineWidth = 3; ctx.shadowColor = beamColor; ctx.shadowBlur = 12; ctx.stroke();
          ctx.shadowBlur = 0;
          // Traveling light pulse
          const t = ((now / 600) % 1);
          const px = sn.position.x + (dn.position.x - sn.position.x) * t;
          const py = sn.position.y + (dn.position.y - sn.position.y) * t;
          const g = ctx.createRadialGradient(px, py, 0, px, py, 10);
          g.addColorStop(0, beamColor); g.addColorStop(1, 'transparent');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.strokeStyle = isInterDomain ? '#F59E0B30' : '#1E293B'; ctx.lineWidth = isInterDomain ? 2 : 1; ctx.stroke();
        }

        // Selected link highlight
        if (selectedLinkId === link.id) {
          ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 2.5; ctx.setLineDash([]); ctx.beginPath();
          ctx.moveTo(sn.position.x, sn.position.y); ctx.lineTo(dn.position.x, dn.position.y); ctx.stroke();
        }

        ctx.restore();
      }

      // Radio Wave Propagation Rings
      waveEffects.current = waveEffects.current.filter(w => now - w.startTime < 1000);
      for (const w of waveEffects.current) {
        const elapsed = (now - w.startTime) / 1000;
        const radius = elapsed * w.maxRadius;
        const alpha = Math.max(0, 0.3 * (1 - elapsed));
        ctx.save(); ctx.beginPath(); ctx.arc(w.x, w.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = w.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      }

      // Drop Bursts
      dropBursts.current = dropBursts.current.filter(d => now - d.startTime < 1200);
      for (const d of dropBursts.current) {
        const elapsed = (now - d.startTime) / 1200;
        const radius = 6 + elapsed * 25;
        const alpha = Math.max(0, 1 - elapsed);
        ctx.save(); ctx.beginPath(); ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239,68,68,${alpha * 0.3})`; ctx.fill();
        ctx.strokeStyle = `rgba(239,68,68,${alpha})`; ctx.lineWidth = 2; ctx.stroke();
        if (elapsed < 0.6) {
          ctx.fillStyle = `rgba(239,68,68,${alpha})`; ctx.font = 'bold 9px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
          ctx.fillText('DROP', d.x, d.y - radius - 4);
        }
        ctx.restore();
      }

      // ACK Return Particles
      ackParticles.current = ackParticles.current.filter(a => now - a.startTime < 1500);
      for (const a of ackParticles.current) {
        const t = Math.min((now - a.startTime) / 1500, 1);
        const ax = a.sx + (a.dx - a.sx) * t, ay = a.sy + (a.dy - a.sy) * t;
        ctx.save();
        const g = ctx.createRadialGradient(ax, ay, 0, ax, ay, 6);
        g.addColorStop(0, '#10B981'); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ax, ay, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#10B981'; ctx.beginPath(); ctx.arc(ax, ay, 2, 0, Math.PI * 2); ctx.fill();
        if (t < 0.3) { ctx.fillStyle = '#10B98180'; ctx.font = '8px "JetBrains Mono"'; ctx.textAlign = 'center'; ctx.fillText('ACK', ax, ay - 8); }
        ctx.restore();
      }

      // Packet Particles with Trails
      for (const pkt of activePackets) {
        if (pkt.state !== 'transmitting') continue;
        const sn = nodes.find(n => n.id === pkt.pathTraversed[pkt.pathTraversed.length - 2]);
        const dn = nodes.find(n => n.id === pkt.currentHop);
        if (!sn || !dn) continue;

        const t = ((now / 700) % 1);
        const px = sn.position.x + (dn.position.x - sn.position.x) * t;
        const py = sn.position.y + (dn.position.y - sn.position.y) * t;
        const color = pkt.color || '#38BDF8';

        // Trail
        for (let i = 1; i <= 4; i++) {
          const tt = Math.max(0, t - i * 0.06);
          const tx = sn.position.x + (dn.position.x - sn.position.x) * tt;
          const ty = sn.position.y + (dn.position.y - sn.position.y) * tt;
          ctx.save(); ctx.globalAlpha = 0.15 * (1 - i / 5);
          ctx.fillStyle = color; ctx.beginPath(); ctx.arc(tx, ty, 4 - i * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }

        // Core glow
        ctx.save();
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 14);
        glow.addColorStop(0, color + 'AA'); glow.addColorStop(0.5, color + '30'); glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#E2E8F0'; ctx.font = '600 8px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
        ctx.fillText(pkt.id, px + 10, py - 4);
        ctx.restore();
      }

      // Nodes
      for (const node of nodes) {
        const isSel = selectedNodeId === node.id;
        const sm = submeshes.find(s => s.id === node.submeshId);
        const color = sm?.color || '#3B82F6';
        const r = node.type === 'gateway' ? 18 : node.type === 'router' ? 15 : 12;

        ctx.save();

        // Selection ring
        if (isSel && node.isAlive) {
          ctx.beginPath(); ctx.arc(node.position.x, node.position.y, r + 8, 0, Math.PI * 2);
          ctx.strokeStyle = '#FFFFFF40'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);

          // Radio range circle
          ctx.beginPath(); ctx.arc(node.position.x, node.position.y, 120, 0, Math.PI * 2);
          ctx.fillStyle = color + '06'; ctx.fill(); ctx.strokeStyle = color + '15'; ctx.lineWidth = 1; ctx.stroke();
        }

        // Node body
        ctx.beginPath(); ctx.arc(node.position.x, node.position.y, r, 0, Math.PI * 2);
        if (!node.isAlive) {
          ctx.fillStyle = '#1E293B'; ctx.strokeStyle = '#EF444480';
        } else if (node.type === 'gateway') {
          ctx.fillStyle = '#F59E0B'; ctx.strokeStyle = '#FFFFFF50';
          ctx.shadowColor = '#F59E0B'; ctx.shadowBlur = isSel ? 16 : 8;
        } else {
          ctx.fillStyle = color; ctx.strokeStyle = '#FFFFFF30';
          ctx.shadowColor = color; ctx.shadowBlur = isSel ? 12 : 4;
        }
        ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke(); ctx.shadowBlur = 0;

        // Symbol
        ctx.fillStyle = '#FFFFFF'; ctx.font = `bold ${r > 15 ? 11 : 9}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const glyph = node.type === 'gateway' ? '⟡' : node.type === 'router' ? '△' : node.type === 'mobile' ? '✦' : '●';
        ctx.fillText(glyph, node.position.x, node.position.y);

        // Label
        ctx.font = '500 10px Inter, sans-serif'; ctx.fillStyle = node.isAlive ? '#CBD5E1' : '#475569';
        ctx.fillText(node.name, node.position.x, node.position.y + r + 13);

        // Queue Gauge (mini-bar above node)
        if (node.isAlive && node.queueCapacity > 0) {
          const qf = node.currentQueue.length / node.queueCapacity;
          const gw = 24, gh = 3, gx = node.position.x - gw / 2, gy = node.position.y - r - 7;
          ctx.fillStyle = '#0F172A80'; ctx.fillRect(gx - 1, gy - 1, gw + 2, gh + 2);
          ctx.fillStyle = '#1E293B'; ctx.fillRect(gx, gy, gw, gh);
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
  }, [nodes, links, submeshes, activePackets, selectedNodeId, selectedLinkId, transform]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const wp = screenToWorld(e.clientX, e.clientY);
    for (const node of nodes) {
      const r = node.type === 'gateway' ? 20 : 17;
      if (Math.hypot(node.position.x - wp.x, node.position.y - wp.y) <= r) {
        draggedNodeId.current = node.id; onSelectNode(node.id); onSelectLink(null); return;
      }
    }
    for (const link of links) {
      const sn = nodes.find(n => n.id === link.source), dn = nodes.find(n => n.id === link.target);
      if (!sn || !dn) continue;
      const l2 = Math.hypot(sn.position.x - dn.position.x, sn.position.y - dn.position.y) ** 2;
      if (l2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((wp.x - sn.position.x) * (dn.position.x - sn.position.x) + (wp.y - sn.position.y) * (dn.position.y - sn.position.y)) / l2));
      const px = sn.position.x + t * (dn.position.x - sn.position.x), py = sn.position.y + t * (dn.position.y - sn.position.y);
      if (Math.hypot(wp.x - px, wp.y - py) <= 10) { onSelectLink(link.id); onSelectNode(null); return; }
    }
    isDraggingCanvas.current = true; dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    onSelectNode(null); onSelectLink(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNodeId.current) { const wp = screenToWorld(e.clientX, e.clientY); onMoveNode(draggedNodeId.current, Math.round(wp.x), Math.round(wp.y)); }
    else if (isDraggingCanvas.current) setTransform(p => ({ ...p, x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }));
  };

  const handleMouseUp = () => { draggedNodeId.current = null; isDraggingCanvas.current = false; };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setTransform(p => ({ ...p, scale: Math.min(Math.max(p.scale * (e.deltaY < 0 ? 1.08 : 0.92), 0.3), 4.0) }));
  };

  return (
    <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}
      className="w-full h-full cursor-crosshair block bg-canvas-deep" />
  );
};
