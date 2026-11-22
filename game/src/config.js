// Vaultbreak tuning: canvas size, movement speeds, sight ranges and the vault floor.
// One screen is the whole level: 32 x 18 tiles of 40 px, so every screenshot shows
// the thief, the guards, the cameras, the diamond and the alarm meter in one frame.
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 52;

export const PLAYER_RADIUS = 13;
export const PLAYER_SPEED_WALK = 155;
export const PLAYER_SPEED_SNEAK = 82;
export const PLAYER_SPEED_RUN = 238;
export const NOISE_RADIUS_RUN = 150;
export const NOISE_RADIUS_PICKUP = 70;

export const GUARD_RADIUS = 14;
export const GUARD_SPEED_PATROL = 56;
export const GUARD_SPEED_CHASE = 134;
export const GUARD_SPEED_SEARCH = 84;
export const GUARD_SPEED_RETURN = 70;
export const GUARD_RANGE = 235;
export const GUARD_FOV = (72 * Math.PI) / 180;
export const GUARD_CATCH_DIST = 26;
export const GUARD_SUSPICION_RATE = 55;
export const GUARD_SUSPICION_DRAIN = 26;

export const CAMERA_RANGE = 215;
export const CAMERA_FOV = (56 * Math.PI) / 180;
export const CAMERA_ALARM_RATE = 30;

export const ALARM_DECAY = 4.5;
export const ALARM_FULL = 100;
export const ALARM_LOCKDOWN_SECONDS = 6;

export const SCORE_GOLD = 100;
export const SCORE_DIAMOND = 500;
export const SCORE_GHOST_BONUS = 300;
export const TIME_BONUS_PAR_SECONDS = 300;
export const TIME_BONUS_RATE = 5;

// Map legend: # wall, . floor, C crate (blocks sight + movement), s shadow patch
// (slows detection), p plant (hides the thief), g gold bar, D diamond vault,
// E exit door, S thief spawn. Every row is exactly 32 characters.
export const MAP = [
  '################################',
  '#..g...........s.......g.......#',
  '#............................D.#',
  '#...CC......#..........#...s...#',
  '#...CC......#....p.....#.......#',
  '#...........#..........#...CC..#',
  '#..p....s...#....CC....#...CC..#',
  '#...........#....CC....#.......#',
  '#....###..........#............#',
  '#....#.......p......g..###.....#',
  '#....#....CC.....s.....#.......#',
  '#....#....CC...........#...g...#',
  '#..s......#......###...#.......#',
  '#.........#......#.............#',
  '#..g......#..CC..#..s....CC....#',
  '#.........#..CC..#.......CC....#',
  '#.E...........sS.....p.....g...#',
  '################################',
];

// Guard patrol loops, as tile coordinates. Every waypoint must sit on open floor.
export const GUARD_PATROLS = [
  [[4, 7], [13, 7], [13, 10], [4, 10]],
  [[24, 4], [28, 4], [28, 10], [24, 10]],
  [[9, 13], [15, 13], [15, 15], [9, 15]],
  [[2, 8], [2, 12], [8, 12], [8, 8]],
];

// Security cameras, mounted on the walls. angle is the resting direction in
// radians (0 = east, PI/2 = south); the lens sweeps +/- sweep radians.
export const CAMERA_DEFS = [
  { x: 16 * TILE + 20, y: 14, angle: Math.PI / 2, sweep: 0.95, speed: 0.5 },
  { x: VIEW_W - 16, y: 8 * TILE + 20, angle: Math.PI, sweep: 0.85, speed: 0.62 },
  { x: 16, y: 14 * TILE + 20, angle: 0, sweep: 0.85, speed: 0.55 },
];

export const SPAWN_TILE = { col: 15, row: 16 };
export const EXIT_TILE = { col: 2, row: 16 };
export const DIAMOND_TILE = { col: 29, row: 2 };
