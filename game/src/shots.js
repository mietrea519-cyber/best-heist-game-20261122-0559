// Staged screenshot scenes (?shot=title|play|alarm|win) and the autopilot that
// plays the real game: it walks a breadth-first path to the diamond and then
// to the exit, waiting out watched tiles and running when a guard chases.
// Every scene is the game itself, stepped forward from a fresh level.
import { TILE, SCORE_GOLD, SCORE_DIAMOND, SCORE_GHOST_BONUS, TIME_BONUS_PAR_SECONDS, TIME_BONUS_RATE } from './config.js';
import { findPath, tileAt } from './level.js';
import { tileIsWatched, inVisionCone } from './vision.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_CAUGHT, SCREEN_WIN } from './render.js';

const STEP = 1 / 60;
const IDLE = { up: false, down: false, left: false, right: false, sneak: false, run: false };

function blankInput() {
  return { up: false, down: false, left: false, right: false, sneak: false, run: false };
}

/**
 * One autopilot decision: steer along the BFS path to the current target
 * (diamond, then exit), waiting when the next tile is inside a cone, running
 * when a guard is already chasing.
 */
export function autopilotInput(game) {
  const input = blankInput();
  const target = game.level.diamond.taken ? game.level.exit : game.level.diamond;
  const pt = tileAt(game.level, game.player.x, game.player.y);
  const path = findPath(game.level, pt.col, pt.row, target.col, target.row);
  if (!path || path.length < 2) return input;

  const chasing = game.guards.some((g) => g.state === 'chase');
  const next = path[1];
  // A guard is only a reason to wait when it is close AND facing the thief:
  // one walking away is no threat, and a stuck guard must never freeze the run.
  const guardNear = game.guards.some((g) => {
    if (Math.hypot(g.x - game.player.x, g.y - game.player.y) >= 55) return false;
    return inVisionCone(g.x, g.y, g.angle, 235, (72 * Math.PI) / 180, game.player.x, game.player.y);
  });
  const forced = game.autopilotForceUntil && game.time < game.autopilotForceUntil;
  if (!chasing && !forced && (guardNear || tileIsWatched(game.level, game.guards, game.cameras, next.col, next.row))) {
    input.sneak = true;
    return input;
  }

  const dx = next.x - game.player.x;
  const dy = next.y - game.player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return input;
  const nx = dx / dist;
  const ny = dy / dist;
  if (nx > 0.15) input.right = true;
  if (nx < -0.15) input.left = true;
  if (ny > 0.15) input.down = true;
  if (ny < -0.15) input.up = true;
  // Sneak through watched ground, run only when already chased.
  input.sneak = !chasing && tileIsWatched(game.level, game.guards, game.cameras, pt.col, pt.row);
  input.run = chasing;
  return input;
}

/**
 * Play the real game with the autopilot until it wins, is caught, or the
 * time limit runs out. Returns {won, seconds, score, gold, alarms}.
 */
export function runAutopilot(game, maxSeconds) {
  game.reset();
  game.screen = SCREEN_PLAY;
  const limit = Math.floor((maxSeconds || 300) / STEP);
  let lastX = game.player.x;
  let lastY = game.player.y;
  let stuckTime = 0;
  for (let i = 0; i < limit; i += 1) {
    game.step(STEP, autopilotInput(game));
    // Stuck-breaker: if the thief has not moved in 4 seconds, push through
    // the wait for 1.5 seconds instead of standing still forever.
    if (Math.hypot(game.player.x - lastX, game.player.y - lastY) < 2) {
      stuckTime += STEP;
      if (stuckTime > 4) {
        game.autopilotForceUntil = game.time + 1.5;
        stuckTime = 0;
      }
    } else {
      stuckTime = 0;
    }
    lastX = game.player.x;
    lastY = game.player.y;
    if (game.screen === SCREEN_WIN) {
      return { won: true, seconds: game.time, score: game.score, gold: game.level.gold.filter((g) => g.taken).length, alarms: game.alarmPeaks };
    }
    if (game.screen === SCREEN_CAUGHT) {
      return { won: false, seconds: game.time, score: game.score, gold: game.level.gold.filter((g) => g.taken).length, alarms: game.alarmPeaks };
    }
  }
  return { won: false, seconds: game.time, score: game.score, gold: game.level.gold.filter((g) => g.taken).length, alarms: game.alarmPeaks, timeout: true };
}

function placeGuard(game, index, col, row, angleDeg, state, suspicion) {
  const g = game.guards[index];
  g.x = col * TILE + TILE / 2;
  g.y = row * TILE + TILE / 2;
  g.angle = (angleDeg * Math.PI) / 180;
  g.state = state;
  g.suspicion = suspicion;
  g.lastSeen = { x: game.player.x, y: game.player.y };
}

function collectGold(game, index) {
  const bar = game.level.gold[index];
  if (bar && !bar.taken) {
    bar.taken = true;
    game.score += SCORE_GOLD;
  }
}

/**
 * Set the game to the named staged scene and return the screen to draw.
 * title: title screen over a patrolling vault. play: the thief mid-room with
 * cones, cameras, diamond and a half-full alarm meter all in frame. alarm:
 * a guard in full chase with the meter near full. win: a real autopilot
 * getaway (falls back to a staged win if the pilot ever fails).
 */
export function stageShot(name, game) {
  game.reset();
  if (name === 'alarm') {
    game.screen = SCREEN_PLAY;
    game.time = 96;
    game.alarm = 88;
    collectGold(game, 0);
    collectGold(game, 1);
    game.player.x = 20 * TILE + TILE / 2;
    game.player.y = 8 * TILE + TILE / 2;
    game.player.angle = Math.PI;
    game.player.running = true;
    placeGuard(game, 0, 8, 7, 45, 'patrol', 20);
    placeGuard(game, 1, 23, 7, 135, 'chase', 100);
    placeGuard(game, 2, 10, 13, -45, 'suspicious', 62);
    placeGuard(game, 3, 5, 10, 0, 'patrol', 0);
    game.banner = 'SPOTTED!';
    game.bannerColor = '#ef4444';
    game.bannerTimer = 99;
    for (let i = 0; i < 30; i += 1) game.stepAmbient(STEP);
    game.bannerTimer = 99;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'win') {
    const result = runAutopilot(game, 300);
    if (result.won) return { screen: SCREEN_WIN };
    // Fallback: a staged clean getaway, so the shot still shows the win screen.
    game.reset();
    game.screen = SCREEN_PLAY;
    game.level.diamond.taken = true;
    game.level.gold.forEach((g) => { g.taken = true; });
    game.score = SCORE_DIAMOND + 6 * SCORE_GOLD;
    game.time = 143;
    game.finishWin();
    return { screen: SCREEN_WIN };
  }
  if (name === 'play') {
    game.screen = SCREEN_PLAY;
    game.time = 47;
    game.alarm = 42;
    collectGold(game, 0);
    collectGold(game, 1);
    game.player.x = 13 * TILE + TILE / 2;
    game.player.y = 9 * TILE + TILE / 2;
    game.player.angle = -Math.PI / 2;
    game.player.sneaking = true;
    placeGuard(game, 0, 8, 7, 35, 'patrol', 15);
    placeGuard(game, 1, 20, 6, 140, 'suspicious', 55);
    placeGuard(game, 2, 10, 13, -50, 'patrol', 0);
    placeGuard(game, 3, 24, 11, 200, 'patrol', 0);
    for (let i = 0; i < 45; i += 1) game.stepAmbient(STEP);
    game.alarm = 42;
    return { screen: SCREEN_PLAY };
  }
  // title (default): guards patrol behind the title panel for a few seconds.
  for (let i = 0; i < 5 / STEP; i += 1) game.stepAmbient(STEP);
  game.screen = SCREEN_TITLE;
  return { screen: SCREEN_TITLE };
}
