// The thief: WASD / arrow movement, sneak and run stances, loot pickups and
// the noise running makes. Picking up the diamond unlocks the exit door.
import { TILE, PLAYER_RADIUS, PLAYER_SPEED_WALK, PLAYER_SPEED_SNEAK, PLAYER_SPEED_RUN, NOISE_RADIUS_RUN, NOISE_RADIUS_PICKUP, SCORE_GOLD, SCORE_DIAMOND } from './config.js';
import { moveCircle, tileAt, isShadowTile, isPlantTile } from './level.js';
import { alertGuardsToNoise } from './guards.js';

/** Fresh thief at the spawn tile, facing north into the vault. */
export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    angle: -Math.PI / 2,
    sneaking: false,
    running: false,
    moving: false,
    hidden: false,
    inShadow: false,
    noisePulse: 0,
    stepTimer: 0,
  };
}

/**
 * Step the thief one frame from the input state. Returns pickup events
 * ({type:'gold'|'diamond'}) for the main loop to score and sound.
 */
export function updatePlayer(level, player, guards, input, dt) {
  let dx = 0;
  let dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  const len = Math.hypot(dx, dy);
  player.moving = len > 0;
  player.sneaking = Boolean(input.sneak) && !input.run;
  player.running = Boolean(input.run) && len > 0;
  const speed = player.sneaking ? PLAYER_SPEED_SNEAK : player.running ? PLAYER_SPEED_RUN : PLAYER_SPEED_WALK;
  if (len > 0) {
    dx /= len;
    dy /= len;
    const moved = moveCircle(level, player.x, player.y, PLAYER_RADIUS, dx * speed * dt, dy * speed * dt);
    player.x = moved.x;
    player.y = moved.y;
    player.angle = Math.atan2(dy, dx);
  }
  if (player.running) {
    player.noisePulse += dt;
    if (player.noisePulse > 0.55) {
      player.noisePulse = 0;
      alertGuardsToNoise(level, guards, player.x, player.y, NOISE_RADIUS_RUN);
    }
  } else {
    player.noisePulse = 0;
  }
  const tile = tileAt(level, player.x, player.y);
  player.inShadow = isShadowTile(level, tile.col, tile.row);
  player.hidden = isPlantTile(level, tile.col, tile.row);

  const events = [];
  for (const bar of level.gold) {
    if (!bar.taken && Math.hypot(bar.x - player.x, bar.y - player.y) < TILE * 0.75) {
      bar.taken = true;
      events.push({ type: 'gold', x: bar.x, y: bar.y });
      alertGuardsToNoise(level, guards, bar.x, bar.y, NOISE_RADIUS_PICKUP);
    }
  }
  if (level.diamond && !level.diamond.taken
    && Math.hypot(level.diamond.x - player.x, level.diamond.y - player.y) < TILE * 0.8) {
    level.diamond.taken = true;
    events.push({ type: 'diamond', x: level.diamond.x, y: level.diamond.y });
  }
  return events;
}

/** True when the thief stands on the exit tile with the diamond already taken. */
export function playerAtExit(level, player) {
  if (!level.diamond.taken) return false;
  return Math.hypot(level.exit.x - player.x, level.exit.y - player.y) < TILE * 0.8;
}

export function scoreForPickup(type) {
  return type === 'diamond' ? SCORE_DIAMOND : SCORE_GOLD;
}
