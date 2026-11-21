// Neon Bay — tuning and palette in one place. The view is a fixed 1280x720 logical area;
// the renderer scales it to the window and moves a camera over a much larger city, so no
// rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The city grid: square cells, a road band along each cell's top and left edge. */
export const CITY = {
  cols: 11,
  rows: 8,
  pitch: 280,
  road: 96,
};

/** World size in pixels, derived from the grid. */
export const WORLD = { width: CITY.cols * CITY.pitch, height: CITY.rows * CITY.pitch };

export const PLAYER = {
  radius: 13,
  walkSpeed: 178,
  runSpeed: 252,
  maxHealth: 100,
  enterRange: 40,
  regenPerSecond: 2.2,
};

export const CAR = {
  radius: 17,
  length: 44,
  width: 22,
  accel: 300,
  brake: 460,
  reverseAccel: 170,
  maxSpeed: 430,
  maxReverse: 130,
  grip: 5.2,
  turnRate: 2.6,
};

export const TRAFFIC = { count: 13, speed: 148, parkedPerLot: 2 };

export const POLICE = {
  maxSpeed: 462,
  accel: 330,
  spawnDistance: 620,
  bustSeconds: 1.7,
  ramDamage: 7,
  ramCooldown: 0.8,
};

export const PED = { count: 22, speed: 62, fleeSpeed: 168, radius: 10 };

export const CASH = { count: 9, value: 50, radius: 26 };

export const MISSION = { reward: 200, seconds: 50, minDistance: 760, radius: 64 };

/** Wanted pressure: crime points build up, stars are points/25, points cool off when unseen. */
export const WANTED = {
  perStar: 25,
  maxStars: 5,
  decaySeen: 0.35,
  decayHidden: 2.6,
  sightRange: 560,
  crime: { carjack: 30, hitPed: 25, hitCar: 12, hitPolice: 22, stealParked: 6 },
};

export const SCORE = { cashPickup: 25, delivery: 300, secondSurvived: 2, nearMiss: 5 };

export const PALETTE = {
  backdrop: '#0b0e1a',
  grass: '#2e7d4f',
  grassDark: '#256b42',
  sidewalk: '#9aa0ad',
  sidewalkEdge: '#7d838f',
  road: '#33363f',
  roadEdge: '#23252c',
  lane: '#e8c85a',
  crosswalk: '#cfd3da',
  water: '#14486e',
  sand: '#d9c07a',
  roofEdge: '#14161d',
  player: '#ffd23e',
  playerSkin: '#f2c09a',
  pedShirt: ['#e5534b', '#4fc3f7', '#7ee08a', '#f2f2f2', '#c792ea', '#ffb86b'],
  carBody: ['#d64545', '#3f7fd1', '#e8e8ec', '#39b56a', '#e8a13a', '#8d6fd1', '#2fb3a6', '#d16bb0'],
  policeBody: '#eef1f5',
  policeTrim: '#1d2735',
  cash: '#57e389',
  cashDark: '#1f9d55',
  beacon: '#ffd23e',
  health: '#57e389',
  healthLow: '#e5534b',
  panel: 'rgba(16,19,30,0.88)',
  panelEdge: '#ffd23e',
  text: '#eef1f5',
  muted: '#9aa3b5',
  star: '#ffd23e',
  starOff: '#4a5064',
  minimapBg: 'rgba(10,12,22,0.78)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-bay.best';
