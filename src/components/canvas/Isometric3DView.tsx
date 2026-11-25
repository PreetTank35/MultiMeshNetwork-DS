import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MeshNode, NetworkLink, Packet, SubMeshDomain } from '../../types/simulator';

interface Props {
  nodes: MeshNode[];
  links: NetworkLink[];
  submeshes: SubMeshDomain[];
  activePackets: Packet[];
  isDarkTheme?: boolean;
}

export const Isometric3DView: React.FC<Props> = ({ nodes, links, submeshes, activePackets, isDarkTheme = false }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    const bgHex = isDarkTheme ? 0x1f2534 : 0xe0e6f0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.00075);

    const d = 350, aspect = w / h;
    const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 2000);
    camera.position.set(400, 450, 400);
    camera.lookAt(450, 0, 300);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, isDarkTheme ? 0.65 : 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, isDarkTheme ? 1.0 : 0.7);
    dl.position.set(300, 600, 300);
    dl.castShadow = true;
    dl.shadow.mapSize.width = 1024;
    dl.shadow.mapSize.height = 1024;
    scene.add(dl);

    const grid = new THREE.GridHelper(1200, 36, isDarkTheme ? 0x334155 : 0x94a3b8, isDarkTheme ? 0x262f42 : 0xcbd5e1);
    grid.position.set(450, -2, 300);
    scene.add(grid);

    for (const node of nodes) {
      const sm = submeshes.find(s => s.id === node.submeshId);
      const hex = node.type === 'gateway' ? 0xd97706 : parseInt((sm?.color || '#2563EB').replace('#', ''), 16);
      const isGw = node.type === 'gateway';
      const r = isGw ? 12 : 8, ht = isGw ? 30 : 18;

      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r + 2, ht, 20),
        new THREE.MeshStandardMaterial({
          color: node.isAlive ? hex : 0x64748b,
          metalness: 0.35,
          roughness: 0.4,
          emissive: node.isAlive ? hex : 0x000000,
          emissiveIntensity: 0.15,
        })
      );
      cyl.position.set(node.position.x, ht / 2, node.position.y);
      cyl.castShadow = true;
      cyl.receiveShadow = true;
      scene.add(cyl);

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(isGw ? 6 : 4, 16, 16),
        new THREE.MeshBasicMaterial({ color: node.isAlive ? 0xffffff : 0xdc2626 })
      );
      sphere.position.set(node.position.x, ht + 4, node.position.y);
      scene.add(sphere);
    }

    for (const link of links) {
      const sn = nodes.find(n => n.id === link.source), dn = nodes.find(n => n.id === link.target);
      if (!sn || !dn) continue;
      const isInter = sn.submeshId !== dn.submeshId;
      const pts = [new THREE.Vector3(sn.position.x, 8, sn.position.y), new THREE.Vector3(dn.position.x, 8, dn.position.y)];
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({
          color: link.isSevered ? 0xdc2626 : isInter ? 0xd97706 : (isDarkTheme ? 0x475569 : 0x94a3b8),
          transparent: true,
          opacity: link.isSevered ? 0.35 : 0.7,
        })
      );
      scene.add(line);
    }

    const pktGroup = new THREE.Group();
    scene.add(pktGroup);

    let mouseDown = false, prev = { x: 0, y: 0 }, theta = Math.PI / 4, phi = Math.PI / 5.5;
    const radius = 650;
    const onMD = (e: MouseEvent) => { mouseDown = true; prev = { x: e.clientX, y: e.clientY }; };
    const onMM = (e: MouseEvent) => {
      if (!mouseDown) return;
      theta -= (e.clientX - prev.x) * 0.004;
      phi = Math.max(0.1, Math.min(Math.PI / 2.2, phi + (e.clientY - prev.y) * 0.004));
      prev = { x: e.clientX, y: e.clientY };
      camera.position.set(450 + radius * Math.cos(phi) * Math.sin(theta), radius * Math.sin(phi), 300 + radius * Math.cos(phi) * Math.cos(theta));
      camera.lookAt(450, 0, 300);
    };
    const onMU = () => { mouseDown = false; };
    el.addEventListener('mousedown', onMD);
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);

    let reqId: number;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      while (pktGroup.children.length) pktGroup.remove(pktGroup.children[0]);

      const t = performance.now() / 1000;
      for (const pkt of activePackets) {
        if (pkt.state !== 'transmitting') continue;
        const sn = nodes.find(n => n.id === pkt.pathTraversed[pkt.pathTraversed.length - 2]);
        const dn = nodes.find(n => n.id === pkt.currentHop);
        if (!sn || !dn) continue;
        const prog = (t * 1.5) % 1;
        const px = sn.position.x + (dn.position.x - sn.position.x) * prog;
        const pz = sn.position.y + (dn.position.y - sn.position.y) * prog;
        const py = 12 + 4 * 60 * prog * (1 - prog);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(4.5, 12, 12), new THREE.MeshBasicMaterial({ color: 0x0891b2 }));
        ball.position.set(px, py, pz);
        pktGroup.add(ball);
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(reqId);
      el.removeEventListener('mousedown', onMD);
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('mouseup', onMU);
      renderer.domElement.parentNode?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [nodes, links, submeshes, activePackets, isDarkTheme]);

  return (
    <div className="w-full h-full relative neu-base">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute top-3 right-28 neu-convex-sm rounded-xl px-3 py-1.5 text-[10px] font-mono text-neu-muted pointer-events-none">
        <span className="text-amber-600 dark:text-amber-400 font-bold">3D Isometric</span> — Drag to orbit • Parabolic packet hops
      </div>
    </div>
  );
};
