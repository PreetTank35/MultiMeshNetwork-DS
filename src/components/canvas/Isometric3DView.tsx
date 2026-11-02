/**
 * 3D Isometric Holographic Viewport
 * Built with Three.js WebGL rendering for immersive faculty presentations
 * Visualizes multi-mesh nodes as elevated 3D cylinders with parabolic packet trajectory arcs
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MeshNode, NetworkLink, Packet, SubMeshDomain } from '../../types/simulator';

interface Isometric3DViewProps {
  nodes: MeshNode[];
  links: NetworkLink[];
  submeshes: SubMeshDomain[];
  activePackets: Packet[];
}

export const Isometric3DView: React.FC<Isometric3DViewProps> = ({
  nodes,
  links,
  submeshes,
  activePackets,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Isometric Camera Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.FogExp2(0x0f172a, 0.0012);

    const aspect = width / height;
    const d = 350;
    const camera = new THREE.OrthographicCamera(
      -d * aspect,
      d * aspect,
      d,
      -d,
      1,
      2000
    );

    // Standard Isometric angle: 45° azimuth, 35.264° elevation
    camera.position.set(400, 450, 400);
    camera.lookAt(400, 0, 300);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dirLight.position.set(200, 500, 200);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 4. Ground Grid
    const gridHelper = new THREE.GridHelper(1200, 40, 0x334155, 0x1e293b);
    gridHelper.position.set(450, -5, 300);
    scene.add(gridHelper);

    // 5. Build 3D Node Meshes
    const nodeMeshes = new Map<string, THREE.Group>();

    for (const node of nodes) {
      const group = new THREE.Group();
      const submesh = submeshes.find(s => s.id === node.submeshId);
      const hexColor = node.type === 'gateway' ? 0xf59e0b : parseInt((submesh?.color || '#3B82F6').replace('#', '0x'), 16);

      // Base cylinder
      const geom = new THREE.CylinderGeometry(
        node.type === 'gateway' ? 14 : 10,
        node.type === 'gateway' ? 16 : 12,
        node.type === 'gateway' ? 35 : 22,
        24
      );
      const mat = new THREE.MeshStandardMaterial({
        color: node.isAlive ? hexColor : 0x475569,
        metalness: 0.6,
        roughness: 0.3,
        emissive: node.isAlive ? hexColor : 0x000000,
        emissiveIntensity: 0.25
      });
      const cylinder = new THREE.Mesh(geom, mat);
      cylinder.position.y = (node.type === 'gateway' ? 35 : 22) / 2;
      group.add(cylinder);

      // Top glowing sphere
      const sphereGeom = new THREE.SphereGeometry(node.type === 'gateway' ? 8 : 6, 16, 16);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: node.isAlive ? (node.type === 'gateway' ? 0xfffbeb : 0xffffff) : 0xef4444
      });
      const sphere = new THREE.Mesh(sphereGeom, sphereMat);
      sphere.position.y = (node.type === 'gateway' ? 35 : 22) + 5;
      group.add(sphere);

      // Position in world
      group.position.set(node.position.x, 0, node.position.y);
      scene.add(group);
      nodeMeshes.set(node.id, group);
    }

    // 6. Build 3D Link Lines
    const linkLines: THREE.Line[] = [];
    for (const link of links) {
      const srcNode = nodes.find(n => n.id === link.source);
      const dstNode = nodes.find(n => n.id === link.target);
      if (!srcNode || !dstNode) continue;

      const points = [
        new THREE.Vector3(srcNode.position.x, 10, srcNode.position.y),
        new THREE.Vector3(dstNode.position.x, 10, dstNode.position.y)
      ];

      const geom = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: link.isSevered ? 0xef4444 : (srcNode.submeshId !== dstNode.submeshId ? 0xf59e0b : 0x334155),
        linewidth: 2,
        transparent: true,
        opacity: link.isSevered ? 0.3 : 0.8
      });
      const line = new THREE.Line(geom, mat);
      scene.add(line);
      linkLines.push(line);
    }

    // 7. Dynamic Parabolic 3D Packet Arcs
    const packetMeshGroup = new THREE.Group();
    scene.add(packetMeshGroup);

    // Orbit Drag Controls (Manual)
    let isMouseDown = false;
    let prevMousePos = { x: 0, y: 0 };
    let theta = Math.PI / 4;
    let phi = Math.PI / 6;
    const radius = 650;

    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const dx = e.clientX - prevMousePos.x;
      const dy = e.clientY - prevMousePos.y;
      prevMousePos = { x: e.clientX, y: e.clientY };

      theta -= dx * 0.005;
      phi = Math.max(0.1, Math.min(Math.PI / 2.2, phi + dy * 0.005));

      camera.position.x = 450 + radius * Math.cos(phi) * Math.sin(theta);
      camera.position.y = radius * Math.sin(phi);
      camera.position.z = 300 + radius * Math.cos(phi) * Math.cos(theta);
      camera.lookAt(450, 0, 300);
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Animation Loop
    let reqId: number;
    const animate = () => {
      reqId = requestAnimationFrame(animate);

      // Clear previous packet particles
      while (packetMeshGroup.children.length > 0) {
        packetMeshGroup.remove(packetMeshGroup.children[0]);
      }

      // Render 3D parabolic packet hops
      const timeNow = performance.now() / 1000;
      for (const pkt of activePackets) {
        const src = nodes.find(n => n.id === pkt.currentHop);
        const dst = nodes.find(n => n.id === pkt.nextHop);
        if (src && dst) {
          const t = (timeNow * 1.5) % 1;
          const px = src.position.x + (dst.position.x - src.position.x) * t;
          const pz = src.position.y + (dst.position.y - src.position.y) * t;
          // Parabolic jump arc: y = 4 * h * t * (1 - t)
          const py = 15 + 4 * 70 * t * (1 - t);

          const pktGeom = new THREE.SphereGeometry(5, 12, 12);
          const pktMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
          const pktSphere = new THREE.Mesh(pktGeom, pktMat);
          pktSphere.position.set(px, py, pz);
          packetMeshGroup.add(pktSphere);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(reqId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [nodes, links, submeshes, activePackets]);

  return (
    <div className="relative w-full h-full bg-[#0F172A] overflow-hidden select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 shadow-lg text-xs font-mono text-slate-300">
        <span className="text-amber-400 font-bold">3D Isometric Mode:</span> Drag with mouse to orbit around nodes & 3D parabolic packet arcs.
      </div>
    </div>
  );
};
