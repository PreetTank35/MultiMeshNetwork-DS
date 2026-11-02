/**
 * Mobility Kinematic Subsystem
 * Implements Random Waypoint (RWP) & Linear Trajectory models for mobile nodes
 */

import { MeshNode } from '../../types/simulator';

export function updateMobileNodes(
  nodes: Map<string, MeshNode>,
  deltaSimSeconds: number
): boolean {
  let anyMoved = false;

  for (const node of nodes.values()) {
    if (!node.isAlive || node.type !== 'mobile' || node.mobilityModel === 'static') {
      continue;
    }

    const bounds = node.mobilityBounds || { minX: 100, maxX: 900, minY: 100, maxY: 600 };
    let vx = node.velocity?.vx ?? 0;
    let vy = node.velocity?.vy ?? 0;

    if (node.mobilityModel === 'random_waypoint') {
      // If velocity is zero or randomly with 2% probability, pick a new direction
      if ((vx === 0 && vy === 0) || Math.random() < 0.02) {
        const speed = 25 + Math.random() * 35; // 25-60 pixels/sec (~12-30 m/s)
        const angle = Math.random() * 2 * Math.PI;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
      }
    } else if (node.mobilityModel === 'linear') {
      // Keep constant velocity, bounce at bounds
      if (vx === 0 && vy === 0) {
        vx = 30;
        vy = 0;
      }
    }

    let newX = node.position.x + vx * deltaSimSeconds;
    let newY = node.position.y + vy * deltaSimSeconds;

    // Bounce off boundary edges
    if (newX <= bounds.minX) {
      newX = bounds.minX;
      vx = -vx;
    } else if (newX >= bounds.maxX) {
      newX = bounds.maxX;
      vx = -vx;
    }

    if (newY <= bounds.minY) {
      newY = bounds.minY;
      vy = -vy;
    } else if (newY >= bounds.maxY) {
      newY = bounds.maxY;
      vy = -vy;
    }

    node.position.x = newX;
    node.position.y = newY;
    node.velocity = { vx, vy };
    anyMoved = true;
  }

  return anyMoved;
}
