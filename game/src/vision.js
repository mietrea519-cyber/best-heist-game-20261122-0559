// Sight lines and vision cones: who can see the thief, and how fast they notice.
// A cone only counts when the thief is inside its range and field of view AND a
// sampled line of sight is not cut by a wall or a crate.
import { TILE, GUARD_RANGE, GUARD_FOV, CAMERA_RANGE, CAMERA_FOV } from './config.js';
import { blocksSightTile, isPlantTile, isShadowTile, tileAt } from './level.js';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when no wall or crate stands between (x0,y0) and (x1,y1). */
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 7));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const tile = tileAt(level, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    if (blocksSightTile(level, tile.col, tile.row)) return false;
  }
  return true;
}

/** True when (tx,ty) lies inside the cone at (ox,oy) facing `angle`. */
export function inVisionCone(ox, oy, angle, range, fov, tx, ty) {
  const dx = tx - ox;
  const dy = ty - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 24) return true;
  return Math.abs(angleDiff(Math.atan2(dy, dx), angle)) <= fov / 2;
}

/**
 * How fast a guard's suspicion of the thief grows, per second, right now:
 * 0 when the thief is out of the cone, behind cover, or hidden in a plant.
 * Sneaking and shadow patches slow it; running makes the thief obvious.
 */
export function guardDetectionRate(level, guard, player) {
  if (!inVisionCone(guard.x, guard.y, guard.angle, GUARD_RANGE, GUARD_FOV, player.x, player.y)) return 0;
  if (!hasLineOfSight(level, guard.x, guard.y, player.x, player.y)) return 0;
  const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
  const tile = tileAt(level, player.x, player.y);
  if (isPlantTile(level, tile.col, tile.row) && dist > 55) return 0;
  let rate = 55;
  if (dist < 80) rate = 110;
  else if (dist > 170) rate = 38;
  if (player.sneaking) rate *= 0.35;
  if (player.running) rate *= 1.5;
  if (isShadowTile(level, tile.col, tile.row)) rate *= 0.5;
  return rate;
}

/** True when a sweeping camera has the thief in its cone with a clear line. */
export function cameraSeesPlayer(level, camera, player) {
  if (!inVisionCone(camera.x, camera.y, camera.angle, CAMERA_RANGE, CAMERA_FOV, player.x, player.y)) return false;
  if (!hasLineOfSight(level, camera.x, camera.y, player.x, player.y)) return false;
  const dist = Math.hypot(player.x - camera.x, player.y - camera.y);
  const tile = tileAt(level, player.x, player.y);
  if (isPlantTile(level, tile.col, tile.row) && dist > 55) return false;
  return true;
}

/** True when any guard's or camera's cone covers a tile centre (autopilot danger check). */
export function tileIsWatched(level, guards, cameras, col, row) {
  const x = col * TILE + TILE / 2;
  const y = row * TILE + TILE / 2;
  for (const g of guards) {
    if (inVisionCone(g.x, g.y, g.angle, GUARD_RANGE, GUARD_FOV, x, y)
      && hasLineOfSight(level, g.x, g.y, x, y)) return true;
  }
  for (const c of cameras) {
    if (inVisionCone(c.x, c.y, c.angle, CAMERA_RANGE, CAMERA_FOV, x, y)
      && hasLineOfSight(level, c.x, c.y, x, y)) return true;
  }
  return false;
}
