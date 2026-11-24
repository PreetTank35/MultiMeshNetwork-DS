/**
 * Default Benchmark Topologies & Academic Scenarios
 * Prepared for MIT AOE Project Evaluation & Demonstrations
 */

import { MeshNode, NetworkLink, SubMeshDomain, TopologyExportJSON } from '../types/simulator';

// Scenario 1: Smart Campus Heterogeneous Multi-Mesh
export function getSmartCampusTopology(): TopologyExportJSON {
  const submeshes: SubMeshDomain[] = [
    {
      id: 'mesh_wifi',
      name: 'Campus Enterprise Wi-Fi 6',
      protocol: 'HWMP',
      frequencyBand: '5.2GHz',
      channelWidthMhz: 40,
      channelNumber: 36,
      color: '#3B82F6', // Electric Blue
      description: 'High-speed 802.11s backhaul connecting faculty labs and computer centers'
    },
    {
      id: 'mesh_iot',
      name: 'Environmental IoT Thread/RPL',
      protocol: 'RPL',
      frequencyBand: '2.4GHz',
      channelWidthMhz: 20,
      channelNumber: 15,
      color: '#10B981', // Emerald Green
      description: 'Ultra-low-power 802.15.4 sensor mesh collecting air quality, solar, and temperature telemetry'
    }
  ];

  const nodes: MeshNode[] = [
    // Wi-Fi 6 Sub-Mesh Nodes (Left/Center)
    {
      id: 'node_wf_server',
      name: 'Campus Main Server',
      submeshId: 'mesh_wifi',
      type: 'router',
      position: { x: 180, y: 160 },
      mobilityModel: 'static',
      txPowerDbm: 23,
      queueCapacity: 128,
      currentQueue: [],
      isAlive: true,
      interfaces: [
        { id: 'if_wf_srv', type: 'wifi', mac: '00:1A:2B:AA:01:01', channel: 36, frequencyBand: '5.2GHz', txPowerDbm: 23, bandwidthMbps: 150 }
      ],
      routingTable: {}
    },
    {
      id: 'node_wf_lab_a',
      name: 'IT Lab Router A',
      submeshId: 'mesh_wifi',
      type: 'router',
      position: { x: 300, y: 240 },
      mobilityModel: 'static',
      txPowerDbm: 20,
      queueCapacity: 64,
      currentQueue: [],
      isAlive: true,
      interfaces: [
        { id: 'if_wf_laba', type: 'wifi', mac: '00:1A:2B:AA:02:01', channel: 36, frequencyBand: '5.2GHz', txPowerDbm: 20, bandwidthMbps: 100 }
      ],
      routingTable: {}
    },
    {
      id: 'node_wf_lab_b',
      name: 'Data Comm Lab Router B',
      submeshId: 'mesh_wifi',
      type: 'router',
      position: { x: 220, y: 380 },
      mobilityModel: 'static',
      txPowerDbm: 20,
      queueCapacity: 64,
      currentQueue: [],
      isAlive: true,
      interfaces: [
        { id: 'if_wf_labb', type: 'wifi', mac: '00:1A:2B:AA:03:01', channel: 36, frequencyBand: '5.2GHz', txPowerDbm: 20, bandwidthMbps: 100 }
      ],
      routingTable: {}
    },
    {
      id: 'node_wf_admin',
      name: 'Library Admin Router',
      submeshId: 'mesh_wifi',
      type: 'router',
      position: { x: 380, y: 380 },
      mobilityModel: 'static',
      txPowerDbm: 20,
      queueCapacity: 64,
      currentQueue: [],
      isAlive: true,
      interfaces: [
        { id: 'if_wf_adm', type: 'wifi', mac: '00:1A:2B:AA:04:01', channel: 36, frequencyBand: '5.2GHz', txPowerDbm: 20, bandwidthMbps: 100 }
      ],
      routingTable: {}
    },

    // MRMC Boundary Gateways (Center Spine)
    {
      id: 'node_gw_primary',
      name: 'Primary Border Gateway A',
      submeshId: 'mesh_wifi',
      type: 'gateway',
      position: { x: 500, y: 220 },
      mobilityModel: 'static',
      txPowerDbm: 24,
      queueCapacity: 128,
      currentQueue: [],
      isAlive: true,
      rplRank: 1, // DODAG Root
      interfaces: [
        { id: 'if_gw1_wifi', type: 'wifi', mac: '00:1A:2B:GW:01:01', channel: 36, frequencyBand: '5.2GHz', txPowerDbm: 24, bandwidthMbps: 150 },
        { id: 'if_gw1_zigbee', type: 'zigbee', mac: '00:1A:2B:GW:01:02', channel: 15, frequencyBand: '2.4GHz', txPowerDbm: 18, bandwidthMbps: 2.5 }
      ],
      routingTable: {}
    },
    {
      id: 'node_gw_backup',
      name: 'Backup Border Gateway B',
      submeshId: 'mesh_wifi',
      type: 'gateway',
      position: { x: 500, y: 440 },
      mobilityModel: 'static',
      txPowerDbm: 24,
      queueCapacity: 128,
      currentQueue: [],
      isAlive: true,
      rplRank: 2,
      interfaces: [
        { id: 'if_gw2_wifi', type: 'wifi', mac: '00:1A:2B:GW:02:01', channel: 36, frequencyBand: '5.2GHz', txPowerDbm: 24, bandwidthMbps: 150 },
        { id: 'if_gw2_zigbee', type: 'zigbee', mac: '00:1A:2B:GW:02:02', channel: 15, frequencyBand: '2.4GHz', txPowerDbm: 18, bandwidthMbps: 2.5 }
      ],
      routingTable: {}
    },

    // IoT Sensor Sub-Mesh Nodes (Right)
    {
      id: 'node_iot_repeater',
      name: 'IoT Mesh Repeater 1',
      submeshId: 'mesh_iot',
      type: 'router',
      position: { x: 650, y: 240 },
      mobilityModel: 'static',
      txPowerDbm: 14,
      queueCapacity: 32,
      currentQueue: [],
      isAlive: true,
      rplRank: 3,
      interfaces: [
        { id: 'if_iot_rep1', type: 'zigbee', mac: '00:1A:2B:CC:01:01', channel: 15, frequencyBand: '2.4GHz', txPowerDbm: 14, bandwidthMbps: 2.5 }
      ],
      routingTable: {}
    },
    {
      id: 'node_iot_solar',
      name: 'Solar Plant Monitor',
      submeshId: 'mesh_iot',
      type: 'sensor',
      position: { x: 790, y: 160 },
      mobilityModel: 'static',
      txPowerDbm: 10,
      queueCapacity: 16,
      currentQueue: [],
      isAlive: true,
      rplRank: 4,
      interfaces: [
        { id: 'if_iot_sol', type: 'zigbee', mac: '00:1A:2B:CC:02:01', channel: 15, frequencyBand: '2.4GHz', txPowerDbm: 10, bandwidthMbps: 0.25 }
      ],
      routingTable: {}
    },
    {
      id: 'node_iot_aqi',
      name: 'Campus AQI / Weather Sensor',
      submeshId: 'mesh_iot',
      type: 'sensor',
      position: { x: 810, y: 300 },
      mobilityModel: 'static',
      txPowerDbm: 10,
      queueCapacity: 16,
      currentQueue: [],
      isAlive: true,
      rplRank: 4,
      interfaces: [
        { id: 'if_iot_aqi', type: 'zigbee', mac: '00:1A:2B:CC:03:01', channel: 15, frequencyBand: '2.4GHz', txPowerDbm: 10, bandwidthMbps: 0.25 }
      ],
      routingTable: {}
    },
    {
      id: 'node_iot_water',
      name: 'Water Reservoir Sensor',
      submeshId: 'mesh_iot',
      type: 'sensor',
      position: { x: 670, y: 440 },
      mobilityModel: 'static',
      txPowerDbm: 10,
      queueCapacity: 16,
      currentQueue: [],
      isAlive: true,
      rplRank: 3,
      interfaces: [
        { id: 'if_iot_wat', type: 'zigbee', mac: '00:1A:2B:CC:04:01', channel: 15, frequencyBand: '2.4GHz', txPowerDbm: 10, bandwidthMbps: 0.25 }
      ],
      routingTable: {}
    },
    {
      id: 'node_mobile_robot',
      name: 'Mobile Inspection Rover',
      submeshId: 'mesh_wifi',
      type: 'mobile',
      position: { x: 380, y: 220 },
      velocity: { vx: 20, vy: 15 },
      mobilityModel: 'random_waypoint',
      mobilityBounds: { minX: 200, maxX: 750, minY: 150, maxY: 500 },
      txPowerDbm: 18,
      queueCapacity: 32,
      currentQueue: [],
      isAlive: true,
      interfaces: [
        { id: 'if_mob_wf', type: 'wifi', mac: '00:1A:2B:MB:01:01', channel: 36, frequencyBand: '5.2GHz', txPowerDbm: 18, bandwidthMbps: 54 }
      ],
      routingTable: {}
    }
  ];

  const links: NetworkLink[] = [
    // Wi-Fi Submesh Links
    { id: 'l_srv_laba', source: 'node_wf_server', target: 'node_wf_lab_a', bandwidthMbps: 150, lossRate: 0.01, distanceMeters: 18, snrDb: 28, per: 0.01, isSevered: false, isJammed: false, currentLoad: 0, traversalCount: 0 },
    { id: 'l_srv_labb', source: 'node_wf_server', target: 'node_wf_lab_b', bandwidthMbps: 100, lossRate: 0.02, distanceMeters: 25, snrDb: 24, per: 0.02, isSevered: false, isJammed: false, currentLoad: 0, traversalCount: 0 },
    { id: 'l_laba_labb', source: 'node_wf_lab_a', target: 'node_wf_lab_b', bandwidthMbps: 100, lossRate: 0.01, distanceMeters: 16, snrDb: 29, per: 0.01, isSevered: false, isJammed: false, currentLoad: 0, traversalCount: 0 },
    { id: 'l_laba_adm', source: 'node_wf_lab_a', target: 'node_wf_admin', bandwidthMbps: 100, lossRate: 0.02, distanceMeters: 20, snrDb: 26, per: 0.02, isSevered: false, isJammed: false, currentLoad: 0, traversalCount: 0 },
    { id: 'l_labb_adm', source: 'node_wf_lab_b', target: 'node_wf_admin', bandwidthMbps: 100, lossRate: 0.01, distanceMeters: 17, snrDb: 28, per: 0.01, isSevered: false, isJammed: false, currentLoad: 0, traversalCount: 0 },
    { id: 'l_laba_gw1', source: 'node_wf_lab_a', target: 'node_gw_primary', bandwidthMbps: 150, lossRate: 0.01, distanceMeters: 21, snrDb: 27, per: 0.01, isSevered: false, isJammed: false, currentLoad: 0, traversalCount: 0 },
    { id: 'l_adm_gw2', source: 'node_wf_admin', target: 'node_gw_backup', bandwidthMbps: 150, lossRate: 0.01, distanceMeters: 15, snrDb: 30, per: 0.01, isSevered: false, isJammed: false, currentLoad: 0, traversalCount: 0 },
    { id: 'l_gw1_gw2', source: 'node_gw_primary', target: 'node_gw_backup', bandwidthMbps: 300, lossRate: 0.005, distanceMeters: 22, snrDb: 32, per: 0.005, isSevered: false, isJammed: false, currentLoad: 0, traversalCount: 0 },

    // Inter-Mesh Gateway Bridge Links to IoT
    { id: 'l_gw1_iotrep', source: 'node_gw_primary', target: 'node_iot_repeater', bandwidthMbps: 2.5, lossRate: 0.02, distanceMeters: 16, snrDb: 22, per: 0.02, isSevered: false, isJammed: false, currentLoad: 0, traversalCount: 0 },
    { id: 'l_gw2_iotwat', source: 'node_gw_backup', target: 'node_iot_water', bandwidthMbps: 2.5, lossRate: 0.02, distanceMeters: 18, snrDb: 21, per: 0.02, isSevered: false, isJammed: false, currentLoad: 0, traversalCount: 0 },

    // IoT Submesh Links
    { id: 'l_rep_sol', source: 'node_iot_repeater', target: 'node_iot_solar', bandwidthMbps: 0.25, lossRate: 0.03, distanceMeters: 15, snrDb: 19, per: 0.03, isSevered: false, isJammed: false, currentLoad: 0, traversalCount: 0 },
    { id: 'l_rep_aqi', source: 'node_iot_repeater', target: 'node_iot_aqi', bandwidthMbps: 0.25, lossRate: 0.02, distanceMeters: 17, snrDb: 20, per: 0.02, isSevered: false, isJammed: false, currentLoad: 0, traversalCount: 0 },
    { id: 'l_rep_wat', source: 'node_iot_repeater', target: 'node_iot_water', bandwidthMbps: 0.25, lossRate: 0.03, distanceMeters: 21, snrDb: 18, per: 0.03, isSevered: false, isJammed: false, currentLoad: 0, traversalCount: 0 },
    { id: 'l_sol_aqi', source: 'node_iot_solar', target: 'node_iot_aqi', bandwidthMbps: 0.25, lossRate: 0.04, distanceMeters: 14, snrDb: 17, per: 0.04, isSevered: false, isJammed: false, currentLoad: 0, traversalCount: 0 },

    // Mobile Node dynamic link to lab A
    { id: 'l_mob_laba', source: 'node_mobile_robot', target: 'node_wf_lab_a', bandwidthMbps: 54, lossRate: 0.03, distanceMeters: 12, snrDb: 24, per: 0.03, isSevered: false, isJammed: false, currentLoad: 0, traversalCount: 0 }
  ];

  return {
    simulatorConfig: {
      tickRateMs: 50,
      simSpeedMultiplier: 1.0,
      pathLossModel: 'LogDistance',
      pathLossExponent: 3.2,
      shadowingStdDevDb: 3.5,
      referenceDistanceMeters: 1.0,
      noiseFloorDbm: -95,
      carrierFreqGhz: 2.4
    },
    submeshes,
    nodes,
    links,
    meta: {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      scenarioTitle: 'Smart Campus Heterogeneous Multi-Mesh Topology',
      authors: ['Preet Tank', 'Tejas Waghmode', 'Vansh Thakre']
    }
  };
}

// Scenario 2: Monolithic Single-Mesh Capacity Breakdown (Gupta-Kumar demonstration)
export function getMonolithicMeshTopology(): TopologyExportJSON {
  const submeshes: SubMeshDomain[] = [
    {
      id: 'mesh_single',
      name: 'Monolithic Single-Domain Mesh',
      protocol: 'AODV',
      frequencyBand: '2.4GHz',
      channelWidthMhz: 20,
      channelNumber: 6,
      color: '#EF4444',
      description: 'Demonstrates capacity collapse O(1 / sqrt(N)) and broadcast storm contention'
    }
  ];

  const nodes: MeshNode[] = [];
  const links: NetworkLink[] = [];

  // Generate a 4x4 grid of nodes sharing ONE channel
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const id = `node_flat_${row}_${col}`;
      nodes.push({
        id,
        name: `Node [${row},${col}]`,
        submeshId: 'mesh_single',
        type: (row === 0 && col === 0) ? 'router' : (row === 3 && col === 3) ? 'router' : 'sensor',
        position: { x: 200 + col * 170, y: 150 + row * 110 },
        mobilityModel: 'static',
        txPowerDbm: 18,
        queueCapacity: 16,
        currentQueue: [],
        isAlive: true,
        interfaces: [
          { id: `if_${id}`, type: 'wifi', mac: `00:1A:2B:FF:${row}${col}:01`, channel: 6, frequencyBand: '2.4GHz', txPowerDbm: 18, bandwidthMbps: 20 }
        ],
        routingTable: {}
      });
    }
  }

  // Connect adjacent nodes
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const curr = `node_flat_${r}_${c}`;
      if (c < 3) {
        const right = `node_flat_${r}_${c + 1}`;
        links.push({
          id: `l_${curr}_${right}`,
          source: curr,
          target: right,
          bandwidthMbps: 12,
          lossRate: 0.08, // High contention loss
          distanceMeters: 20,
          snrDb: 15,
          per: 0.08,
          isSevered: false,
          isJammed: false,
          currentLoad: 0,
          traversalCount: 0
        });
      }
      if (r < 3) {
        const down = `node_flat_${r + 1}_${c}`;
        links.push({
          id: `l_${curr}_${down}`,
          source: curr,
          target: down,
          bandwidthMbps: 12,
          lossRate: 0.08,
          distanceMeters: 20,
          snrDb: 15,
          per: 0.08,
          isSevered: false,
          isJammed: false,
          currentLoad: 0,
          traversalCount: 0
        });
      }
    }
  }

  return {
    simulatorConfig: {
      tickRateMs: 50,
      simSpeedMultiplier: 1.0,
      pathLossModel: 'LogDistance',
      pathLossExponent: 3.5,
      shadowingStdDevDb: 4.0,
      referenceDistanceMeters: 1.0,
      noiseFloorDbm: -90,
      carrierFreqGhz: 2.4
    },
    submeshes,
    nodes,
    links,
    meta: {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      scenarioTitle: 'Monolithic Mesh Scaling Failure Benchmark',
      authors: ['Preet Tank', 'Tejas Waghmode', 'Vansh Thakre']
    }
  };
}

