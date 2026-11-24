/**
 * Procedural 2D Architectural Blueprint Floor Plans
 * High-Fidelity CAD-style Architectural Rendering for Multi-Mesh Simulation
 *
 * Blueprints:
 * 1. MIT AOE Campus Academic Wing
 * 2. Smart Industrial Logistics Facility
 */

export interface BlueprintZone {
  id: string;
  name: string;
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
  areaSqM: number;
  rfEnv: string;
  recommendedProtocol: string;
  fillColor?: string;
  attenuationDb: number;
}

export interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  material: 'concrete' | 'drywall' | 'glass';
}

export interface Doorway {
  x: number;
  y: number;
  radius: number;
  startAngle: number;
  swingAngle: number;
  hingeSide: 'left' | 'right';
}

export interface DimensionMarker {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  offset: number;
  label: string;
}

export interface CableConduit {
  id: string;
  label: string;
  points: Array<{ x: number; y: number }>;
  type: 'fiber' | 'ethernet' | 'power';
}

export interface BlueprintFloorPlan {
  id: string;
  title: string;
  subtitle: string;
  drawingNo: string;
  scaleLabel: string;
  bounds: { x: number; y: number; width: number; height: number };
  zones: BlueprintZone[];
  walls: WallSegment[];
  doors: Doorway[];
  dimensions: DimensionMarker[];
  conduits: CableConduit[];
}

// ============================================================================
// BLUEPRINT 1: MIT AOE Campus Academic Wing
// ============================================================================
export const CAMPUS_ACADEMIC_BLUEPRINT: BlueprintFloorPlan = {
  id: 'campus_academic_wing',
  title: 'MIT AOE CAMPUS ACADEMIC WING',
  subtitle: 'DEPARTMENT OF ELECTRICAL ENGINEERING & COMPUTER SCIENCE — LEVEL 2',
  drawingNo: 'MIT-AOE-E-204',
  scaleLabel: '1:50 (1m = 20px)',
  bounds: { x: 40, y: 50, width: 940, height: 560 },
  zones: [
    {
      id: 'zone_server_noc',
      name: 'SERVER ROOM / NOC',
      code: 'NOC-201',
      x: 70,
      y: 80,
      width: 220,
      height: 200,
      areaSqM: 110,
      rfEnv: 'Heavy RF Attenuation / Faradized Racks',
      recommendedProtocol: '5.2 GHz HWMP / Wired Backhaul',
      fillColor: 'rgba(30, 58, 138, 0.12)',
      attenuationDb: -14
    },
    {
      id: 'zone_dc_lab',
      name: 'DATA COMMUNICATION LAB',
      code: 'LAB-202',
      x: 70,
      y: 330,
      width: 220,
      height: 250,
      areaSqM: 138,
      rfEnv: 'Multipath Dense / Bench Rigs',
      recommendedProtocol: '5.2 GHz Wi-Fi 6 (HWMP)',
      fillColor: 'rgba(2, 132, 199, 0.08)',
      attenuationDb: -6
    },
    {
      id: 'zone_iot_lab',
      name: 'EMBEDDED & IoT LAB',
      code: 'LAB-203',
      x: 330,
      y: 80,
      width: 230,
      height: 200,
      areaSqM: 115,
      rfEnv: 'Heterogeneous Sensor Density',
      recommendedProtocol: '2.4 GHz Thread/RPL + Wi-Fi',
      fillColor: 'rgba(16, 185, 129, 0.08)',
      attenuationDb: -4
    },
    {
      id: 'zone_classrooms',
      name: 'ACADEMIC CLASSROOMS & FACULTY',
      code: 'CLS-204',
      x: 330,
      y: 330,
      width: 230,
      height: 250,
      areaSqM: 144,
      rfEnv: 'Moderate Partitioned Offices',
      recommendedProtocol: '5.2 GHz Wi-Fi 6',
      fillColor: 'rgba(59, 130, 246, 0.08)',
      attenuationDb: -5
    },
    {
      id: 'zone_quad',
      name: 'CENTRAL OPEN COURTYARD / QUAD',
      code: 'QUAD-EXT',
      x: 600,
      y: 80,
      width: 350,
      height: 230,
      areaSqM: 201,
      rfEnv: 'Free-Space Line-of-Sight',
      recommendedProtocol: '2.4 GHz 802.15.4 / RPL Outdoor',
      fillColor: 'rgba(5, 150, 105, 0.09)',
      attenuationDb: -1
    },
    {
      id: 'zone_env_station',
      name: 'ENVIRONMENTAL MONITORING STATION',
      code: 'ENV-206',
      x: 600,
      y: 350,
      width: 350,
      height: 230,
      areaSqM: 201,
      rfEnv: 'Outdoor Weather Mast & Cistern',
      recommendedProtocol: '2.4 GHz Ultra-Low Power RPL',
      fillColor: 'rgba(13, 148, 136, 0.09)',
      attenuationDb: -2
    }
  ],
  walls: [
    // Outer perimeter envelope (double stroke thickness 8px)
    { x1: 60, y1: 70, x2: 960, y2: 70, thickness: 8, material: 'concrete' },
    { x1: 960, y1: 70, x2: 960, y2: 590, thickness: 8, material: 'concrete' },
    { x1: 960, y1: 590, x2: 60, y2: 590, thickness: 8, material: 'concrete' },
    { x1: 60, y1: 590, x2: 60, y2: 70, thickness: 8, material: 'concrete' },

    // Primary interior corridor divider (East-West spine)
    { x1: 60, y1: 300, x2: 240, y2: 300, thickness: 6, material: 'drywall' },
    { x1: 270, y1: 300, x2: 560, y2: 300, thickness: 6, material: 'drywall' },

    // North-South dividers
    { x1: 310, y1: 70, x2: 310, y2: 260, thickness: 6, material: 'concrete' },
    { x1: 310, y1: 340, x2: 310, y2: 590, thickness: 6, material: 'drywall' },

    // Courtyard dividing wall (heavy acoustic glass curtain wall)
    { x1: 580, y1: 70, x2: 580, y2: 270, thickness: 5, material: 'glass' },
    { x1: 580, y1: 310, x2: 580, y2: 590, thickness: 5, material: 'glass' },

    // Quad / Env Station divider
    { x1: 600, y1: 330, x2: 960, y2: 330, thickness: 5, material: 'drywall' }
  ],
  doors: [
    // NOC access door
    { x: 250, y: 300, radius: 26, startAngle: 0, swingAngle: Math.PI / 2, hingeSide: 'left' },
    // IoT lab door
    { x: 310, y: 280, radius: 26, startAngle: -Math.PI / 2, swingAngle: -Math.PI / 2, hingeSide: 'left' },
    // Classrooms door
    { x: 310, y: 320, radius: 26, startAngle: Math.PI / 2, swingAngle: Math.PI / 2, hingeSide: 'right' },
    // Courtyard Glass Sliding Gateway
    { x: 580, y: 290, radius: 30, startAngle: 0, swingAngle: Math.PI / 2, hingeSide: 'left' }
  ],
  dimensions: [
    // Top span
    { x1: 60, y1: 70, x2: 580, y2: 70, offset: -24, label: '26.0 m [ACADEMIC WING]' },
    { x1: 580, y1: 70, x2: 960, y2: 70, offset: -24, label: '19.0 m [OPEN QUAD]' },
    // Left span
    { x1: 60, y1: 70, x2: 60, y2: 300, offset: -24, label: '11.5 m' },
    { x1: 60, y1: 300, x2: 60, y2: 590, offset: -24, label: '14.5 m' },
    // Overall width
    { x1: 60, y1: 590, x2: 960, y2: 590, offset: 24, label: '45.0 m [TOTAL BUILDING SPAN]' }
  ],
  conduits: [
    // Server Room to Gateway Hub backbone
    {
      id: 'c1',
      label: 'BACKBONE CONDUIT 10G-FIBER',
      type: 'fiber',
      points: [
        { x: 170, y: 180 },
        { x: 260, y: 180 },
        { x: 260, y: 300 },
        { x: 420, y: 300 },
        { x: 550, y: 300 }
      ]
    },
    // Gateway Hub to Labs
    {
      id: 'c2',
      label: 'CAT6A TRACER - DATA LAB',
      type: 'ethernet',
      points: [
        { x: 170, y: 450 },
        { x: 260, y: 450 },
        { x: 260, y: 300 }
      ]
    },
    // Gateway to IoT Environmental Station
    {
      id: 'c3',
      label: 'CONDUIT RUN - OUTDOOR SENSOR TRACE',
      type: 'ethernet',
      points: [
        { x: 550, y: 300 },
        { x: 640, y: 300 },
        { x: 720, y: 340 },
        { x: 720, y: 460 }
      ]
    }
  ]
};

// ============================================================================
// BLUEPRINT 2: Smart Industrial Logistics Facility
// ============================================================================
export const LOGISTICS_FACILITY_BLUEPRINT: BlueprintFloorPlan = {
  id: 'smart_logistics',
  title: 'SMART INDUSTRIAL LOGISTICS FACILITY',
  subtitle: 'AUTOMATED DISTRIBUTION & AGV TRANSIT COMPLEX — SECTOR 7',
  drawingNo: 'LOG-IND-A-402',
  scaleLabel: '1:75 (1m = 15px)',
  bounds: { x: 40, y: 50, width: 940, height: 560 },
  zones: [
    {
      id: 'zone_dispatch_noc',
      name: 'DISPATCH CONTROL CENTER',
      code: 'CTRL-101',
      x: 70,
      y: 80,
      width: 240,
      height: 200,
      areaSqM: 160,
      rfEnv: 'Acoustic Glass / Supervisory Console',
      recommendedProtocol: '5.2 GHz Wi-Fi 6 (TSN)',
      fillColor: 'rgba(30, 58, 138, 0.12)',
      attenuationDb: -5
    },
    {
      id: 'zone_high_bay',
      name: 'HIGH-BAY STORAGE RACKS',
      code: 'RACK-BAY-A',
      x: 350,
      y: 80,
      width: 330,
      height: 250,
      areaSqM: 275,
      rfEnv: 'Steel Shelving / High Attenuation Multipath',
      recommendedProtocol: '868/915 MHz Long-Range RPL',
      fillColor: 'rgba(217, 119, 6, 0.08)',
      attenuationDb: -16
    },
    {
      id: 'zone_agv_corridor',
      name: 'AGV TRANSIT CORRIDOR',
      code: 'AGV-CORR-01',
      x: 70,
      y: 310,
      width: 610,
      height: 120,
      areaSqM: 244,
      rfEnv: 'Line-of-Sight Guideway with Moving Fleet',
      recommendedProtocol: '5.2 GHz Fast-Roaming HWMP',
      fillColor: 'rgba(6, 182, 212, 0.09)',
      attenuationDb: -2
    },
    {
      id: 'zone_sorting_bay',
      name: 'AUTOMATED SORTING BAY',
      code: 'SORT-BAY-02',
      x: 70,
      y: 450,
      width: 610,
      height: 130,
      areaSqM: 264,
      rfEnv: 'Conveyor Motors / High RF Noise Floor',
      recommendedProtocol: '2.4 GHz Industrial Mesh',
      fillColor: 'rgba(99, 102, 241, 0.08)',
      attenuationDb: -8
    },
    {
      id: 'zone_loading_dock',
      name: 'DISPATCH LOADING DOCKS & FLEET GATES',
      code: 'DOCK-1-6',
      x: 720,
      y: 80,
      width: 230,
      height: 500,
      areaSqM: 383,
      rfEnv: 'Exterior Semi-Enclosed Overhead Doors',
      recommendedProtocol: '2.4 GHz + 915 MHz Multi-Band Gateway',
      fillColor: 'rgba(16, 185, 129, 0.08)',
      attenuationDb: -4
    }
  ],
  walls: [
    // Outer perimeter
    { x1: 60, y1: 70, x2: 960, y2: 70, thickness: 8, material: 'concrete' },
    { x1: 960, y1: 70, x2: 960, y2: 590, thickness: 8, material: 'concrete' },
    { x1: 960, y1: 590, x2: 60, y2: 590, thickness: 8, material: 'concrete' },
    { x1: 60, y1: 590, x2: 60, y2: 70, thickness: 8, material: 'concrete' },

    // Control room partition
    { x1: 60, y1: 290, x2: 320, y2: 290, thickness: 6, material: 'glass' },
    { x1: 320, y1: 70, x2: 320, y2: 290, thickness: 6, material: 'glass' },

    // High Bay divider
    { x1: 700, y1: 70, x2: 700, y2: 590, thickness: 8, material: 'concrete' },

    // AGV and Sorting bay divider
    { x1: 60, y1: 440, x2: 700, y2: 440, thickness: 4, material: 'drywall' }
  ],
  doors: [
    { x: 320, y: 220, radius: 26, startAngle: 0, swingAngle: Math.PI / 2, hingeSide: 'left' },
    { x: 700, y: 350, radius: 36, startAngle: Math.PI, swingAngle: Math.PI / 2, hingeSide: 'right' }
  ],
  dimensions: [
    { x1: 60, y1: 70, x2: 700, y2: 70, offset: -24, label: '38.0 m [INTERNAL LOGISTICS WING]' },
    { x1: 700, y1: 70, x2: 960, y2: 70, offset: -24, label: '15.5 m [DOCK BAYS]' },
    { x1: 60, y1: 590, x2: 960, y2: 590, offset: 24, label: '53.5 m [TOTAL FACILITY SPAN]' }
  ],
  conduits: [
    {
      id: 'lc1',
      label: 'HEAVY INDUSTRIAL FEEDER CONDUIT',
      type: 'fiber',
      points: [
        { x: 180, y: 180 },
        { x: 320, y: 180 },
        { x: 500, y: 180 },
        { x: 700, y: 180 },
        { x: 830, y: 180 }
      ]
    },
    {
      id: 'lc2',
      label: 'AGV TELEMETRY BUS',
      type: 'ethernet',
      points: [
        { x: 180, y: 370 },
        { x: 500, y: 370 },
        { x: 830, y: 370 }
      ]
    }
  ]
};

export const BLUEPRINT_PRESETS: Record<string, BlueprintFloorPlan> = {
  campus_academic_wing: CAMPUS_ACADEMIC_BLUEPRINT,
  smart_logistics: LOGISTICS_FACILITY_BLUEPRINT
};

// ============================================================================
// PROCEDURAL CANVAS DRAWING ENGINE
// ============================================================================

/**
 * Draws the high-fidelity architectural blueprint onto the canvas.
 * Called before nodes and links so network infrastructure sits cleanly on the CAD floor plan.
 */
export function drawBlueprintFloorPlan(
  ctx: CanvasRenderingContext2D,
  blueprint: BlueprintFloorPlan,
  opacity: number,
  options?: { showGrid?: boolean; showDimensions?: boolean; showConduits?: boolean }
): void {
  if (opacity <= 0) return;

  const showGrid = options?.showGrid ?? true;
  const showDimensions = options?.showDimensions ?? true;
  const showConduits = options?.showConduits ?? true;

  ctx.save();
  ctx.globalAlpha = opacity;

  // 1. Technical Blueprint Grid
  if (showGrid) {
    drawBlueprintGrid(ctx, blueprint.bounds);
  }

  // 2. Zone Background Fills & Watermark Labels
  for (const zone of blueprint.zones) {
    drawZone(ctx, zone);
  }

  // 3. Cable Trays & High-Capacity Conduits
  if (showConduits && blueprint.conduits) {
    for (const c of blueprint.conduits) {
      drawConduit(ctx, c);
    }
  }

  // 4. Architectural Double-Stroke Walls & Hatching
  for (const wall of blueprint.walls) {
    drawArchitecturalWall(ctx, wall);
  }

  // 5. Door Swings
  for (const door of blueprint.doors) {
    drawDoorSwing(ctx, door);
  }

  // 6. Dimension Lines & CAD Ticks
  if (showDimensions && blueprint.dimensions) {
    for (const dim of blueprint.dimensions) {
      drawDimensionMarker(ctx, dim);
    }
  }

  // 7. Blueprint Title Block & Metadata
  drawArchitecturalTitleBlock(ctx, blueprint);

  ctx.restore();
}

/**
 * Draws CAD blueprint grid lines with coordinates
 */
function drawBlueprintGrid(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number }
): void {
  const step = 20;
  const majorStep = 100;
  const startX = Math.floor(bounds.x / step) * step;
  const endX = bounds.x + bounds.width + 40;
  const startY = Math.floor(bounds.y / step) * step;
  const endY = bounds.y + bounds.height + 40;

  ctx.save();

  // Minor grid
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
  ctx.lineWidth = 0.8;
  for (let x = startX; x <= endX; x += step) {
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
  }
  for (let y = startY; y <= endY; y += step) {
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
  }
  ctx.stroke();

  // Major grid
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.09)';
  ctx.lineWidth = 1.2;
  for (let x = startX; x <= endX; x += majorStep) {
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
  }
  for (let y = startY; y <= endY; y += majorStep) {
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
  }
  ctx.stroke();

  // Crosshairs at major intersections
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.lineWidth = 1;
  const crossSize = 4;
  for (let x = startX; x <= endX; x += majorStep) {
    for (let y = startY; y <= endY; y += majorStep) {
      ctx.beginPath();
      ctx.moveTo(x - crossSize, y);
      ctx.lineTo(x + crossSize, y);
      ctx.moveTo(x, y - crossSize);
      ctx.lineTo(x, y + crossSize);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Draws architectural zone tinted area, zone badge, room label and RF characteristics
 */
function drawZone(ctx: CanvasRenderingContext2D, zone: BlueprintZone): void {
  ctx.save();

  // Zone Tint
  ctx.fillStyle = zone.fillColor || 'rgba(56, 189, 248, 0.05)';
  ctx.fillRect(zone.x, zone.y, zone.width, zone.height);

  // Subtle interior dotted boundary
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(zone.x + 2, zone.y + 2, zone.width - 4, zone.height - 4);
  ctx.setLineDash([]);

  // Zone ID Badge (pill) in top-left corner
  const badgeX = zone.x + 12;
  const badgeY = zone.y + 12;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, badgeX, badgeY, 68, 18, 3);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38BDF8';
  ctx.font = '700 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(zone.code, badgeX + 34, badgeY + 9);

  // Attenuation tag
  const attX = zone.x + zone.width - 12;
  ctx.fillStyle = zone.attenuationDb <= -10 ? '#F87171' : '#FBBF24';
  ctx.font = '600 8.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${zone.attenuationDb} dB RF Loss`, attX, badgeY + 9);

  // Room Name
  ctx.fillStyle = '#F1F5F9';
  ctx.font = '700 11.5px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(zone.name, zone.x + 12, zone.y + 44);

  // Technical Subtitle & Area
  ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
  ctx.font = '500 9px "JetBrains Mono", monospace';
  ctx.fillText(`Area: ${zone.areaSqM} m² • ${zone.rfEnv}`, zone.x + 12, zone.y + 58);

  // Recommended Protocol Tag (lower area)
  ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
  ctx.font = '600 8.5px "JetBrains Mono", monospace';
  ctx.fillText(`[Protocol: ${zone.recommendedProtocol}]`, zone.x + 12, zone.y + zone.height - 12);

  ctx.restore();
}

/**
 * Draws architectural double-stroke walls with core fill and hatching
 */
function drawArchitecturalWall(ctx: CanvasRenderingContext2D, wall: WallSegment): void {
  ctx.save();

  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;

  const nx = (-dy / len) * (wall.thickness / 2);
  const ny = (dx / len) * (wall.thickness / 2);

  // Four corners of the wall rectangle
  const p1x = wall.x1 + nx, p1y = wall.y1 + ny;
  const p2x = wall.x2 + nx, p2y = wall.y2 + ny;
  const p3x = wall.x2 - nx, p3y = wall.y2 - ny;
  const p4x = wall.x1 - nx, p4y = wall.y1 - ny;

  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.lineTo(p3x, p3y);
  ctx.lineTo(p4x, p4y);
  ctx.closePath();

  if (wall.material === 'glass') {
    // Glass Curtain Wall (Cyan translucent tint with center divider)
    ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Center divider line
    ctx.beginPath();
    ctx.moveTo(wall.x1, wall.y1);
    ctx.lineTo(wall.x2, wall.y2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([8, 4]);
    ctx.stroke();
  } else if (wall.material === 'concrete') {
    // Heavy concrete wall: solid dark slate core with crisp blueprint borders
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.fill();

    // 45 degree hatching inside
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 1;
    const diagStep = 8;
    const minX = Math.min(wall.x1, wall.x2) - 20;
    const maxX = Math.max(wall.x1, wall.x2) + 20;
    const minY = Math.min(wall.y1, wall.y2) - 20;
    const maxY = Math.max(wall.y1, wall.y2) + 20;

    ctx.beginPath();
    for (let x = minX - (maxY - minY); x < maxX; x += diagStep) {
      ctx.moveTo(x, minY);
      ctx.lineTo(x + (maxY - minY), maxY);
    }
    ctx.stroke();
    ctx.restore();

    // Double-stroke outer borders
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // Standard drywall partition
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws standard CAD door swing with door leaf and quarter arc
 */
function drawDoorSwing(ctx: CanvasRenderingContext2D, door: Doorway): void {
  ctx.save();

  // Swing Arc
  ctx.beginPath();
  ctx.arc(door.x, door.y, door.radius, door.startAngle, door.startAngle + door.swingAngle, door.swingAngle < 0);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.stroke();

  // Door Leaf (opened panel)
  const endAngle = door.startAngle + door.swingAngle;
  const leafX = door.x + Math.cos(endAngle) * door.radius;
  const leafY = door.y + Math.sin(endAngle) * door.radius;

  ctx.beginPath();
  ctx.moveTo(door.x, door.y);
  ctx.lineTo(leafX, leafY);
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([]);
  ctx.stroke();

  // Hinge point
  ctx.beginPath();
  ctx.arc(door.x, door.y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#38BDF8';
  ctx.fill();

  ctx.restore();
}

/**
 * Draws architectural dimension markers with extension lines and CAD ticks
 */
function drawDimensionMarker(ctx: CanvasRenderingContext2D, dim: DimensionMarker): void {
  ctx.save();

  const dx = dim.x2 - dim.x1;
  const dy = dim.y2 - dim.y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;

  const nx = -dy / len;
  const ny = dx / len;

  // Offset points
  const ox1 = dim.x1 + nx * dim.offset;
  const oy1 = dim.y1 + ny * dim.offset;
  const ox2 = dim.x2 + nx * dim.offset;
  const oy2 = dim.y2 + ny * dim.offset;

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
  ctx.lineWidth = 1;

  // Extension witness lines
  ctx.beginPath();
  ctx.moveTo(dim.x1 + nx * (dim.offset > 0 ? 4 : -4), dim.y1 + ny * (dim.offset > 0 ? 4 : -4));
  ctx.lineTo(ox1 + nx * (dim.offset > 0 ? 6 : -6), oy1 + ny * (dim.offset > 0 ? 6 : -6));
  ctx.moveTo(dim.x2 + nx * (dim.offset > 0 ? 4 : -4), dim.y2 + ny * (dim.offset > 0 ? 4 : -4));
  ctx.lineTo(ox2 + nx * (dim.offset > 0 ? 6 : -6), oy2 + ny * (dim.offset > 0 ? 6 : -6));
  ctx.stroke();

  // Main dimension line
  ctx.beginPath();
  ctx.moveTo(ox1, oy1);
  ctx.lineTo(ox2, oy2);
  ctx.stroke();

  // 45 degree architectural tick marks at ends
  const tick = 5;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ox1 - tick, oy1 - tick);
  ctx.lineTo(ox1 + tick, oy1 + tick);
  ctx.moveTo(ox2 - tick, oy2 - tick);
  ctx.lineTo(ox2 + tick, oy2 + tick);
  ctx.stroke();

  // Dimension Text label
  const mx = (ox1 + ox2) / 2;
  const my = (oy1 + oy2) / 2;

  ctx.font = '600 8.5px "JetBrains Mono", monospace';
  const textWidth = ctx.measureText(dim.label).width;

  // Background blackout pill so text is legible
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(mx - textWidth / 2 - 4, my - 6, textWidth + 8, 12);

  ctx.fillStyle = '#38BDF8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(dim.label, mx, my);

  ctx.restore();
}

/**
 * Draws technical cable conduit / tray routes embedded in the floor plan
 */
function drawConduit(ctx: CanvasRenderingContext2D, conduit: CableConduit): void {
  if (conduit.points.length < 2) return;
  ctx.save();

  const color = conduit.type === 'fiber' ? '#06B6D4' : '#10B981';

  // Conduit line
  ctx.beginPath();
  ctx.moveTo(conduit.points[0].x, conduit.points[0].y);
  for (let i = 1; i < conduit.points.length; i++) {
    ctx.lineTo(conduit.points[i].x, conduit.points[i].y);
  }
  ctx.strokeStyle = color + '40';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 3]);
  ctx.stroke();

  // Junction box nodes (small squares)
  for (const pt of conduit.points) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.fillRect(pt.x - 3.5, pt.y - 3.5, 7, 7);
    ctx.strokeRect(pt.x - 3.5, pt.y - 3.5, 7, 7);
  }

  // Label along first segment
  const p1 = conduit.points[0];
  const p2 = conduit.points[1];
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2 - 6;
  ctx.fillStyle = color + '90';
  ctx.font = '600 7.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`⌁ ${conduit.label}`, mx, my);

  ctx.restore();
}

/**
 * Draws authentic CAD architectural title block in corner
 */
function drawArchitecturalTitleBlock(
  ctx: CanvasRenderingContext2D,
  blueprint: BlueprintFloorPlan
): void {
  ctx.save();

  const boxW = 280;
  const boxH = 68;
  const boxX = blueprint.bounds.x + blueprint.bounds.width - boxW;
  const boxY = blueprint.bounds.y + blueprint.bounds.height - boxH;

  // Title Box Panel
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // Internal grid lines in title block
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
  ctx.beginPath();
  ctx.moveTo(boxX, boxY + 22);
  ctx.lineTo(boxX + boxW, boxY + 22);
  ctx.moveTo(boxX, boxY + 44);
  ctx.lineTo(boxX + boxW, boxY + 44);
  ctx.moveTo(boxX + 170, boxY + 44);
  ctx.lineTo(boxX + 170, boxY + boxH);
  ctx.stroke();

  // Content
  ctx.fillStyle = '#38BDF8';
  ctx.font = '700 9.5px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(blueprint.title, boxX + 8, boxY + 15);

  ctx.fillStyle = 'rgba(203, 213, 225, 0.8)';
  ctx.font = '500 7.5px "JetBrains Mono", monospace';
  ctx.fillText(blueprint.subtitle, boxX + 8, boxY + 36);

  ctx.fillStyle = '#94A3B8';
  ctx.fillText(`DWG: ${blueprint.drawingNo}`, boxX + 8, boxY + 58);
  ctx.fillText(`SCALE: ${blueprint.scaleLabel}`, boxX + 176, boxY + 58);

  // North Arrow indicator
  const northX = blueprint.bounds.x + 30;
  const northY = blueprint.bounds.y + blueprint.bounds.height - 25;
  ctx.fillStyle = '#38BDF8';
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 1.2;

  // Compass circle
  ctx.beginPath();
  ctx.arc(northX, northY, 12, 0, Math.PI * 2);
  ctx.stroke();

  // North arrow
  ctx.beginPath();
  ctx.moveTo(northX, northY - 10);
  ctx.lineTo(northX + 3.5, northY + 4);
  ctx.lineTo(northX, northY + 1);
  ctx.lineTo(northX - 3.5, northY + 4);
  ctx.closePath();
  ctx.fill();

  ctx.font = '700 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', northX, northY - 13);

  ctx.restore();
}

/**
 * Utility helper to draw rounded rectangle
 */
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
