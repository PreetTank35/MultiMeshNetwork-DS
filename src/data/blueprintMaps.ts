/**
 * Clean 2D Architectural Campus & Facility Sketches
 * Minimalist vector floor plans designed for high legibility beneath network nodes.
 * Zero visual clutter, zero bright blue lines or stray diagonal hatching.
 */

export interface BlueprintZone {
  id: string;
  name: string;
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'noc' | 'lab' | 'classroom' | 'courtyard' | 'env' | 'warehouse' | 'corridor' | 'dock';
}

export interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  material: 'exterior' | 'interior' | 'glass';
}

export interface Doorway {
  x: number;
  y: number;
  radius: number;
  startAngle: number;
  swingAngle: number;
}

export interface BlueprintFloorPlan {
  id: string;
  title: string;
  subtitle: string;
  bounds: { x: number; y: number; width: number; height: number };
  zones: BlueprintZone[];
  walls: WallSegment[];
  doors: Doorway[];
}

// ============================================================================
// BLUEPRINT 1: MIT AOE Campus Academic Wing
// ============================================================================
export const CAMPUS_ACADEMIC_BLUEPRINT: BlueprintFloorPlan = {
  id: 'campus_academic_wing',
  title: 'MIT AOE Campus — Academic Wing & Courtyard',
  subtitle: 'Clean Architectural Floor Sketch',
  bounds: { x: 60, y: 70, width: 900, height: 520 },
  zones: [
    {
      id: 'zone_server_noc',
      name: 'Server Room / NOC',
      code: 'NOC-201',
      x: 60,
      y: 70,
      width: 250,
      height: 230,
      kind: 'noc',
    },
    {
      id: 'zone_dc_lab',
      name: 'Data Comm Lab',
      code: 'LAB-202',
      x: 60,
      y: 300,
      width: 250,
      height: 290,
      kind: 'lab',
    },
    {
      id: 'zone_iot_lab',
      name: 'Embedded & IoT Lab',
      code: 'LAB-203',
      x: 310,
      y: 70,
      width: 270,
      height: 230,
      kind: 'lab',
    },
    {
      id: 'zone_classrooms',
      name: 'Academic Classrooms',
      code: 'CLS-204',
      x: 310,
      y: 300,
      width: 270,
      height: 290,
      kind: 'classroom',
    },
    {
      id: 'zone_quad',
      name: 'Central Open Courtyard',
      code: 'QUAD',
      x: 580,
      y: 70,
      width: 380,
      height: 260,
      kind: 'courtyard',
    },
    {
      id: 'zone_env_station',
      name: 'Environmental Station',
      code: 'ENV-206',
      x: 580,
      y: 330,
      width: 380,
      height: 260,
      kind: 'env',
    },
  ],
  walls: [
    // Outer Campus Perimeter Walls (clean crisp frame)
    { x1: 60, y1: 70, x2: 960, y2: 70, thickness: 5, material: 'exterior' },
    { x1: 960, y1: 70, x2: 960, y2: 590, thickness: 5, material: 'exterior' },
    { x1: 960, y1: 590, x2: 60, y2: 590, thickness: 5, material: 'exterior' },
    { x1: 60, y1: 590, x2: 60, y2: 70, thickness: 5, material: 'exterior' },

    // East-West Wing Partition (with doorway gap 235..275)
    { x1: 60, y1: 300, x2: 235, y2: 300, thickness: 2.5, material: 'interior' },
    { x1: 275, y1: 300, x2: 580, y2: 300, thickness: 2.5, material: 'interior' },

    // North-South Interior Partition (with doorway gap 260..340)
    { x1: 310, y1: 70, x2: 310, y2: 260, thickness: 2.5, material: 'interior' },
    { x1: 310, y1: 340, x2: 310, y2: 590, thickness: 2.5, material: 'interior' },

    // Building-to-Courtyard Glass Curtain Divider (with sliding archway 265..315)
    { x1: 580, y1: 70, x2: 580, y2: 265, thickness: 3, material: 'glass' },
    { x1: 580, y1: 315, x2: 580, y2: 590, thickness: 3, material: 'glass' },

    // Subtle Outdoor Quad / Env Path Divider
    { x1: 580, y1: 330, x2: 960, y2: 330, thickness: 1.5, material: 'interior' },
  ],
  doors: [
    { x: 235, y: 300, radius: 24, startAngle: 0, swingAngle: Math.PI / 2 },
    { x: 310, y: 260, radius: 22, startAngle: Math.PI / 2, swingAngle: -Math.PI / 2 },
    { x: 310, y: 340, radius: 22, startAngle: -Math.PI / 2, swingAngle: Math.PI / 2 },
    { x: 580, y: 265, radius: 26, startAngle: 0, swingAngle: Math.PI / 2 },
  ],
};

// ============================================================================
// BLUEPRINT 2: Smart Industrial Logistics Facility
// ============================================================================
export const LOGISTICS_FACILITY_BLUEPRINT: BlueprintFloorPlan = {
  id: 'smart_logistics',
  title: 'Smart Industrial Logistics Facility',
  subtitle: 'Automated Warehouse & AGV Floor Plan',
  bounds: { x: 60, y: 70, width: 900, height: 520 },
  zones: [
    {
      id: 'zone_dispatch_noc',
      name: 'Dispatch Control Center',
      code: 'CTRL-101',
      x: 60,
      y: 70,
      width: 260,
      height: 220,
      kind: 'noc',
    },
    {
      id: 'zone_high_bay',
      name: 'High-Bay Storage Racks',
      code: 'RACK-BAY',
      x: 320,
      y: 70,
      width: 380,
      height: 220,
      kind: 'warehouse',
    },
    {
      id: 'zone_agv_corridor',
      name: 'AGV Transit Corridor',
      code: 'AGV-LANE',
      x: 60,
      y: 290,
      width: 640,
      height: 150,
      kind: 'corridor',
    },
    {
      id: 'zone_sorting_bay',
      name: 'Automated Sorting Bay',
      code: 'SORT-BAY',
      x: 60,
      y: 440,
      width: 640,
      height: 150,
      kind: 'lab',
    },
    {
      id: 'zone_loading_dock',
      name: 'Loading Docks & Gates',
      code: 'DOCK-1-6',
      x: 700,
      y: 70,
      width: 260,
      height: 520,
      kind: 'dock',
    },
  ],
  walls: [
    { x1: 60, y1: 70, x2: 960, y2: 70, thickness: 5, material: 'exterior' },
    { x1: 960, y1: 70, x2: 960, y2: 590, thickness: 5, material: 'exterior' },
    { x1: 960, y1: 590, x2: 60, y2: 590, thickness: 5, material: 'exterior' },
    { x1: 60, y1: 590, x2: 60, y2: 70, thickness: 5, material: 'exterior' },

    // Control Room glass wall
    { x1: 60, y1: 290, x2: 320, y2: 290, thickness: 2.5, material: 'glass' },
    { x1: 320, y1: 70, x2: 320, y2: 250, thickness: 2.5, material: 'glass' },

    // Warehouse to Loading Dock divider (with wide freight opening 330..400)
    { x1: 700, y1: 70, x2: 700, y2: 330, thickness: 3.5, material: 'interior' },
    { x1: 700, y1: 400, x2: 700, y2: 590, thickness: 3.5, material: 'interior' },

    // Sorting Bay divider
    { x1: 60, y1: 440, x2: 700, y2: 440, thickness: 2, material: 'interior' },
  ],
  doors: [
    { x: 320, y: 250, radius: 22, startAngle: 0, swingAngle: Math.PI / 2 },
  ],
};

export const BLUEPRINT_PRESETS: Record<string, BlueprintFloorPlan> = {
  campus_academic_wing: CAMPUS_ACADEMIC_BLUEPRINT,
  smart_logistics: LOGISTICS_FACILITY_BLUEPRINT,
};

// ============================================================================
// CLEAN ARCHITECTURAL SKETCH RENDERER (LIGHT & DARK NEOMORPHIC ADAPTIVE)
// ============================================================================

export function drawBlueprintFloorPlan(
  ctx: CanvasRenderingContext2D,
  blueprint: BlueprintFloorPlan,
  opacity: number,
  options?: { showGrid?: boolean; isDark?: boolean }
): void {
  if (opacity <= 0) return;

  const isDark = options?.isDark ?? false;
  const showGrid = options?.showGrid ?? true;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Palette tuned for clean drafting legibility without overpowering nodes
  const wallOuterColor = isDark ? 'rgba(148, 163, 184, 0.42)' : 'rgba(71, 85, 105, 0.50)';
  const wallInnerColor = isDark ? 'rgba(148, 163, 184, 0.28)' : 'rgba(100, 116, 139, 0.36)';
  const glassColor = isDark ? 'rgba(148, 163, 184, 0.32)' : 'rgba(51, 65, 85, 0.30)';
  const labelColor = isDark ? 'rgba(203, 213, 225, 0.72)' : 'rgba(51, 65, 85, 0.78)';
  const codeColor = isDark ? 'rgba(148, 163, 184, 0.55)' : 'rgba(100, 116, 139, 0.72)';
  const propStroke = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(100, 116, 139, 0.16)';
  const propFill = isDark ? 'rgba(148, 163, 184, 0.05)' : 'rgba(148, 163, 184, 0.09)';

  // 1. Subtle architectural paper background plate
  const { x, y, width, height } = blueprint.bounds;
  ctx.fillStyle = isDark ? 'rgba(22, 28, 40, 0.55)' : 'rgba(248, 250, 252, 0.55)';
  roundRect(ctx, x, y, width, height, 10);
  ctx.fill();

  // Optional subtle drafting dots/grid inside footprint
  if (showGrid) {
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, x, y, width, height, 10);
    ctx.clip();

    ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.045)' : 'rgba(100, 116, 139, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = x; gx <= x + width; gx += 40) {
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + height);
    }
    for (let gy = y; gy <= y + height; gy += 40) {
      ctx.moveTo(x, gy);
      ctx.lineTo(x + width, gy);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 2. Soft Zone Fills + Minimal Corner Furniture/Scenery + Clean Corner Labels
  for (const zone of blueprint.zones) {
    drawCleanZone(ctx, zone, isDark, labelColor, codeColor, propStroke, propFill);
  }

  // 3. Clean Architectural Walls (no hatching!)
  for (const wall of blueprint.walls) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(wall.x1, wall.y1);
    ctx.lineTo(wall.x2, wall.y2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (wall.material === 'exterior') {
      ctx.strokeStyle = wallOuterColor;
      ctx.lineWidth = wall.thickness;
      ctx.stroke();
    } else if (wall.material === 'glass') {
      ctx.strokeStyle = glassColor;
      ctx.lineWidth = wall.thickness;
      ctx.setLineDash([8, 5]);
      ctx.stroke();
    } else {
      ctx.strokeStyle = wallInnerColor;
      ctx.lineWidth = wall.thickness;
      ctx.stroke();
    }
    ctx.restore();
  }

  // 4. Subtle Door Swing Arcs
  for (const door of blueprint.doors) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(door.x, door.y, door.radius, door.startAngle, door.startAngle + door.swingAngle, door.swingAngle < 0);
    ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(100, 116, 139, 0.30)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();

    const endA = door.startAngle + door.swingAngle;
    ctx.beginPath();
    ctx.moveTo(door.x, door.y);
    ctx.lineTo(door.x + Math.cos(endA) * door.radius, door.y + Math.sin(endA) * door.radius);
    ctx.setLineDash([]);
    ctx.strokeStyle = wallInnerColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // 5. Minimal Architectural Caption Below Border
  ctx.save();
  ctx.fillStyle = codeColor;
  ctx.font = '600 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(blueprint.title.toUpperCase(), x + width - 6, y + height + 16);
  ctx.restore();

  ctx.restore();
}

function drawCleanZone(
  ctx: CanvasRenderingContext2D,
  zone: BlueprintZone,
  isDark: boolean,
  labelColor: string,
  codeColor: string,
  propStroke: string,
  propFill: string
): void {
  ctx.save();

  // Gentle pastel floor shading by zone kind
  let tint = 'transparent';
  if (zone.kind === 'courtyard' || zone.kind === 'env') {
    tint = isDark ? 'rgba(16, 185, 129, 0.045)' : 'rgba(16, 185, 129, 0.075)';
  } else if (zone.kind === 'noc') {
    tint = isDark ? 'rgba(37, 99, 235, 0.05)' : 'rgba(37, 99, 235, 0.045)';
  } else if (zone.kind === 'warehouse' || zone.kind === 'dock') {
    tint = isDark ? 'rgba(217, 119, 6, 0.04)' : 'rgba(245, 158, 11, 0.045)';
  } else if (zone.kind === 'corridor') {
    tint = isDark ? 'rgba(148, 163, 184, 0.03)' : 'rgba(226, 232, 240, 0.45)';
  }

  if (tint !== 'transparent') {
    ctx.fillStyle = tint;
    ctx.fillRect(zone.x + 2, zone.y + 2, zone.width - 4, zone.height - 4);
  }

  // Subtle architectural scenery outlines tucked cleanly in corners
  ctx.strokeStyle = propStroke;
  ctx.fillStyle = propFill;
  ctx.lineWidth = 1;

  if (zone.kind === 'noc') {
    // 3 tidy server rack icons in top-right corner
    for (let i = 0; i < 3; i++) {
      const rx = zone.x + zone.width - 68 + i * 18;
      const ry = zone.y + 14;
      ctx.fillRect(rx, ry, 13, 28);
      ctx.strokeRect(rx, ry, 13, 28);
    }
  } else if (zone.kind === 'lab') {
    // Clean lab bench outlines along bottom-left corner
    ctx.fillRect(zone.x + 14, zone.y + zone.height - 34, 72, 18);
    ctx.strokeRect(zone.x + 14, zone.y + zone.height - 34, 72, 18);
    ctx.fillRect(zone.x + 96, zone.y + zone.height - 34, 72, 18);
    ctx.strokeRect(zone.x + 96, zone.y + zone.height - 34, 72, 18);
  } else if (zone.kind === 'classroom') {
    // Minimalist desk rows in bottom corner
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const dx = zone.x + 16 + c * 32;
        const dy = zone.y + zone.height - 46 + r * 18;
        ctx.strokeRect(dx, dy, 22, 10);
      }
    }
  } else if (zone.kind === 'courtyard') {
    // Landscaped botanical courtyard tree canopies & garden walkway
    const trees = [
      { cx: zone.x + zone.width - 36, cy: zone.y + 42, r: 16 },
      { cx: zone.x + zone.width - 64, cy: zone.y + zone.height - 32, r: 13 },
      { cx: zone.x + 42, cy: zone.y + zone.height - 36, r: 12 },
    ];
    for (const t of trees) {
      ctx.beginPath();
      ctx.arc(t.cx, t.cy, t.r, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? 'rgba(16, 185, 129, 0.09)' : 'rgba(16, 185, 129, 0.14)';
      ctx.fill();
      ctx.strokeStyle = isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(5, 150, 105, 0.25)';
      ctx.stroke();
    }
  } else if (zone.kind === 'warehouse') {
    // Clean storage rack aisles
    for (let i = 0; i < 3; i++) {
      const rx = zone.x + 36 + i * 110;
      const ry = zone.y + 48;
      ctx.fillRect(rx, ry, 74, 22);
      ctx.strokeRect(rx, ry, 74, 22);
    }
  } else if (zone.kind === 'corridor') {
    // Subtle AGV track line
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(zone.x + 24, zone.y + zone.height / 2);
    ctx.lineTo(zone.x + zone.width - 24, zone.y + zone.height / 2);
    ctx.stroke();
    ctx.restore();
  }

  // Single crisp corner room label
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = codeColor;
  ctx.font = '700 9px "JetBrains Mono", monospace';
  ctx.fillText(zone.code, zone.x + 12, zone.y + 11);

  ctx.fillStyle = labelColor;
  ctx.font = '600 11px "Inter", sans-serif';
  ctx.fillText(zone.name, zone.x + 12, zone.y + 24);

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
