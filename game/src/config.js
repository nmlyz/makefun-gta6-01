// Neon Bay — all tuning numbers and colours in one place.
export const CFG = {
  viewW: 1280, viewH: 720,
  worldW: 3600, worldH: 2800,
  roadGap: 420, roadW: 96,
  playerSpeed: 230, playerRadius: 13,
  playerHealth: 100,
  carAccel: 420, carMaxSpeed: 430, carReverse: 160, carTurn: 2.9, carBrake: 520,
  trafficCount: 16, pedCount: 26, policeMax: 5,
  wantedDecayMs: 9000, wantedGainHit: 1,
  cashPickupValue: 50, healthPickupValue: 30,
  taxiFare: 120, courierPay: 90, getawayPay: 250,
  missionTimeLimit: 150,
  palette: {
    bg: '#0a0e1e', asphalt: '#171a26', asphalt2: '#1d2133',
    roadLine: '#e8c33a', sidewalk: '#232838', curb: '#3a415c',
    grass: '#0f2a1e', water: '#0a2a44',
    neonPink: '#ff2e88', neonCyan: '#22e6ff', neonYellow: '#ffd23e',
    neonGreen: '#39ff88', neonPurple: '#b45cff', neonOrange: '#ff7a2e',
    hudBg: 'rgba(8,10,24,0.78)', hudText: '#eaf6ff', hudDim: '#9fb4d8',
    star: '#ffd23e', health: '#39ff88', danger: '#ff3b5c'
  },
  buildingColors: ['#1c2140', '#241a3d', '#14283d', '#2b1d33', '#1a2f2a', '#2e2138'],
  carColors: ['#ff2e88', '#22e6ff', '#ffd23e', '#39ff88', '#b45cff', '#ff7a2e', '#e8e8f0', '#3aa0ff'],
  missionTypes: ['taxi', 'courier', 'getaway']
};
export const MISSION_DEFS = {
  taxi: { name: 'TAXI FARE', desc: 'Pick up the passenger, then drive them to the pink marker.', pay: 120 },
  courier: { name: 'COURIER RUN', desc: 'Collect all 3 packages, then reach the pink marker.', pay: 90 },
  getaway: { name: 'GETAWAY', desc: 'Reach the pink marker with the cops on your tail. Do not get busted!', pay: 250 }
};
