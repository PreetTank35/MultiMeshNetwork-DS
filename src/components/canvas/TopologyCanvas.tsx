/**
 * High-Performance HTML5 Topology Canvas
 * 60 FPS interactive rendering with convex hull domain grouping,
 * particle packet animation, pan/zoom, and drag-and-drop node repositioning
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MeshNode, NetworkLink, Packet, SubMeshDomain } from '../../types/simulator';

interface TopologyCanvasProps {
  nodes: MeshNode[];
  links: NetworkLink[];
  submeshes: SubMeshDomain[];
  activePackets: Packet[];
  selectedNodeId: string | null;
  selectedLinkId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onSelectLink: (linkId: string | null) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  nodes,
  links,
  submeshes,
  activePackets,
  selectedNodeId,
  selectedLinkId,
  onSelectNode,
  onSelectLink,
  onMoveNode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pan and Zoom viewport state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isDraggingCanvas = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const draggedNodeId = useRef<string | null>(null);

  // Convex Hull computation for visual submesh perimeters
  const getConvexHull = (points: Array<{ x: number; y: number }>) => {
    if (points.length < 3) return points;
    const sorted = [...points].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);

    const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

    const lower: Array<{ x: number; y: number }> = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }

    const upper: Array<{ x: number; y: number }> = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }

    upper.pop();
    lower.pop();
    return lower.concat(upper);
  };

  // Convert screen coordinates to canvas world coordinates
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - transform.x) / transform.scale;
    const y = (clientY - rect.top - transform.y) / transform.scale;
    return { x, y };
  }, [transform]);

  // Main 60 FPS Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      // Resize canvas to match display size
      if (canvas.width !== canvas.parentElement?.clientWidth || canvas.height !== canvas.parentElement?.clientHeight) {
        canvas.width = canvas.parentElement?.clientWidth || 1000;
        canvas.height = canvas.parentElement?.clientHeight || 700;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Apply Pan & Zoom transformation
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      // Draw Background Grid
      const gridSize = 40;
      const startX = -transform.x / transform.scale;
      const startY = -transform.y / transform.scale;
      const endX = startX + canvas.width / transform.scale;
      const endY = startY + canvas.height / transform.scale;

      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1 / transform.scale;
      ctx.beginPath();
      for (let x = Math.floor(startX / gridSize) * gridSize; x <= endX; x += gridSize) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
      }
      for (let y = Math.floor(startY / gridSize) * gridSize; y <= endY; y += gridSize) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
      }
      ctx.stroke();

      // 1. Draw Sub-Mesh Convex Hulls (Perimeter Grouping)
      for (const submesh of submeshes) {
        const submeshNodes = nodes.filter(n => n.submeshId === submesh.id);
        if (submeshNodes.length === 0) continue;

        const points = submeshNodes.map(n => n.position);
        const hull = getConvexHull(points);

        if (hull.length >= 2) {
          ctx.save();
          ctx.beginPath();
          ctx.lineJoin = 'round';
          ctx.lineWidth = 45;
          ctx.strokeStyle = `${submesh.color}15`; // Transparent border
          ctx.fillStyle = `${submesh.color}08`; // Subtle domain fill

          ctx.moveTo(hull[0].x, hull[0].y);
          for (let i = 1; i < hull.length; i++) {
            ctx.lineTo(hull[i].x, hull[i].y);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.fill();

          // Sub-mesh domain badge
          const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
          const minY = Math.min(...points.map(p => p.y)) - 35;

          ctx.fillStyle = submesh.color;
          ctx.font = 'bold 12px "JetBrains Mono", monospace';
          ctx.fillText(`[${submesh.protocol}] ${submesh.name} (${submesh.frequencyBand})`, avgX - 60, minY);
          ctx.restore();
        }
      }

      // 2. Draw Links & Edges
      for (const link of links) {
        const srcNode = nodes.find(n => n.id === link.source);
        const dstNode = nodes.find(n => n.id === link.target);
        if (!srcNode || !dstNode) continue;

        const isSelected = selectedLinkId === link.id;
        const isInterDomain = srcNode.submeshId !== dstNode.submeshId;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(srcNode.position.x, srcNode.position.y);
        ctx.lineTo(dstNode.position.x, dstNode.position.y);

        if (link.isSevered) {
          // Severed link: Red dashed line with X mark
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.stroke();

          // Draw failure 'X' marker in center
          const midX = (srcNode.position.x + dstNode.position.x) / 2;
          const midY = (srcNode.position.y + dstNode.position.y) / 2;
          ctx.fillStyle = '#EF4444';
          ctx.font = 'bold 14px sans-serif';
          ctx.fillText('✕', midX - 5, midY + 5);
        } else if (link.isJammed) {
          // Jammed channel: Amber/Orange zigzag
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 3;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
        } else {
          // Normal active link
          if (isSelected) {
            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = 3;
          } else if (isInterDomain) {
            ctx.strokeStyle = '#F59E0B'; // Amber for boundary gateway bridge
            ctx.lineWidth = 2.5;
          } else {
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.5;
          }
          ctx.stroke();
        }

        // Display Link Metrics (Distance & Loss Rate) if selected or on hover
        if (isSelected) {
          const midX = (srcNode.position.x + dstNode.position.x) / 2;
          const midY = (srcNode.position.y + dstNode.position.y) / 2;
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(midX - 45, midY - 14, 90, 20);
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1;
          ctx.strokeRect(midX - 45, midY - 14, 90, 20);

          ctx.fillStyle = '#38BDF8';
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.fillText(`${link.distanceMeters.toFixed(1)}m | ${(link.lossRate * 100).toFixed(0)}% drop`, midX - 40, midY);
        }

        ctx.restore();
      }

      // 3. Draw Active Packet Particle Flows
      const now = performance.now();
      for (const packet of activePackets) {
        const srcNode = nodes.find(n => n.id === packet.currentHop);
        const dstNode = nodes.find(n => n.id === packet.nextHop);

        if (srcNode && dstNode) {
          // Smooth sinusoidal interpolation across hop
          const t = ((now / 800) % 1);
          const px = srcNode.position.x + (dstNode.position.x - srcNode.position.x) * t;
          const py = srcNode.position.y + (dstNode.position.y - srcNode.position.y) * t;

          ctx.save();
          // Glowing packet halo
          const gradient = ctx.createRadialGradient(px, py, 2, px, py, 14);
          gradient.addColorStop(0, packet.color || '#38BDF8');
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(px, py, 14, 0, Math.PI * 2);
          ctx.fill();

          // Packet core
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(px, py, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Protocol label tag
          ctx.fillStyle = '#E2E8F0';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.fillText(packet.id, px + 8, py - 6);
          ctx.restore();
        }
      }

      // 4. Draw Nodes
      for (const node of nodes) {
        const isSelected = selectedNodeId === node.id;
        const submesh = submeshes.find(s => s.id === node.submeshId);
        const color = submesh?.color || '#3B82F6';

        ctx.save();

        // Node Range / Radio Coverage Circle (if selected)
        if (isSelected && node.isAlive) {
          ctx.beginPath();
          ctx.arc(node.position.x, node.position.y, 140, 0, Math.PI * 2);
          ctx.fillStyle = `${color}08`;
          ctx.fill();
          ctx.strokeStyle = `${color}40`;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
        }

        // Selection Ring
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.position.x, node.position.y, 24, 0, Math.PI * 2);
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        // Node Base Disc
        ctx.beginPath();
        const radius = node.type === 'gateway' ? 20 : node.type === 'router' ? 17 : 14;
        ctx.arc(node.position.x, node.position.y, radius, 0, Math.PI * 2);

        if (!node.isAlive) {
          ctx.fillStyle = '#334155'; // Dark grey for offline/dead node
        } else if (node.type === 'gateway') {
          ctx.fillStyle = '#F59E0B'; // Amber Gold Gateway
        } else {
          ctx.fillStyle = color;
        }
        ctx.fill();
        ctx.strokeStyle = node.isAlive ? '#FFFFFF' : '#EF4444';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Node Symbol / Icon Character
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const glyph = node.type === 'gateway' ? '⛯' : node.type === 'router' ? '▲' : node.type === 'mobile' ? '✈' : '●';
        ctx.fillText(glyph, node.position.x, node.position.y);

        // Node Label
        ctx.font = '600 11px Inter, sans-serif';
        ctx.fillStyle = node.isAlive ? '#F8FAFC' : '#94A3B8';
        ctx.fillText(node.name, node.position.x, node.position.y + radius + 14);

        // Queue occupancy / status badge
        if (node.currentQueue.length > 0 && node.isAlive) {
          ctx.beginPath();
          ctx.arc(node.position.x + radius - 2, node.position.y - radius + 2, 7, 0, Math.PI * 2);
          ctx.fillStyle = '#EF4444';
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText(node.currentQueue.length.toString(), node.position.x + radius - 2, node.position.y - radius + 2);
        }

        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [nodes, links, submeshes, activePackets, selectedNodeId, selectedLinkId, transform]);

  // Pointer Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);

    // Check if clicked on a node
    for (const node of nodes) {
      const radius = node.type === 'gateway' ? 22 : 18;
      const dist = Math.hypot(node.position.x - worldPos.x, node.position.y - worldPos.y);
      if (dist <= radius) {
        draggedNodeId.current = node.id;
        onSelectNode(node.id);
        onSelectLink(null);
        return;
      }
    }

    // Check if clicked on a link
    for (const link of links) {
      const srcNode = nodes.find(n => n.id === link.source);
      const dstNode = nodes.find(n => n.id === link.target);
      if (!srcNode || !dstNode) continue;

      // Distance from point to line segment
      const l2 = Math.hypot(srcNode.position.x - dstNode.position.x, srcNode.position.y - dstNode.position.y) ** 2;
      if (l2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((worldPos.x - srcNode.position.x) * (dstNode.position.x - srcNode.position.x) + (worldPos.y - srcNode.position.y) * (dstNode.position.y - srcNode.position.y)) / l2));
      const projX = srcNode.position.x + t * (dstNode.position.x - srcNode.position.x);
      const projY = srcNode.position.y + t * (dstNode.position.y - srcNode.position.y);
      const distToLine = Math.hypot(worldPos.x - projX, worldPos.y - projY);

      if (distToLine <= 8) {
        onSelectLink(link.id);
        onSelectNode(null);
        return;
      }
    }

    // Clicked on empty canvas: Start panning
    isDraggingCanvas.current = true;
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    onSelectNode(null);
    onSelectLink(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNodeId.current) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      onMoveNode(draggedNodeId.current, Math.round(worldPos.x), Math.round(worldPos.y));
    } else if (isDraggingCanvas.current) {
      setTransform(prev => ({
        ...prev,
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
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setTransform(prev => {
      const newScale = Math.min(Math.max(prev.scale * zoomFactor, 0.4), 3.0);
      return { ...prev, scale: newScale };
    });
  };

  return (
    <div className="relative w-full h-full bg-[#0F172A] overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-crosshair block"
      />

      {/* Floating Canvas View Controls */}
      <div className="absolute top-4 right-4 flex items-center space-x-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 shadow-lg text-xs font-mono">
        <span className="text-slate-400">Zoom:</span>
        <span className="text-sky-400 font-semibold">{Math.round(transform.scale * 100)}%</span>
        <button
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          className="ml-2 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors"
        >
          Reset View
        </button>
      </div>
    </div>
  );
};
