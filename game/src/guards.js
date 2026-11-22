// The guards: patrol loops, suspicion, and the calm -> suspicious -> alarmed
// (chase) -> search -> return state machine. A guard only chases what it has
// actually seen; a loud noise sends it to investigate instead. Guards walk
// breadth-first routes between waypoints, so a patrol leg never pushes
// against a wall: the route goes around the crates and pillars.
import { TILE, GUARD_PATROLS, GUARD_RADIUS, GUARD_SPEED_PATROL, GUARD_SPEED_CHASE, GUARD_SPEED_SEARCH, GUARD_SPEED_RETURN, GUARD_SUSPICION_DRAIN, GUARD_CATCH_DIST } from './config.js';
import { guardDetectionRate } from './vision.js';
import { moveCircle, findPath, tileAt } from './level.js';

export const GUARD_CALM = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_CHASE = 'chase';
export const GUARD_SEARCH = 'search';
export const GUARD_RETURN = 'return';

/** Build the four guards from the patrol loops in config.js. */
export function createGuards() {
  return GUARD_PATROLS.map((waypoints, index) => {
    const start = waypoints[0];
    const next = waypoints[1];
    return {
      id: index,
      x: start[0] * TILE + TILE / 2,
      y: start[1] * TILE + TILE / 2,
      angle: Math.atan2(next[1] - start[1], next[0] - start[0]),
      waypointIndex: 1,
      waypoints,
      route: [],
      routeIndex: 0,
      routeTarget: null,
      repathTimer: 0,
      state: GUARD_CALM,
      suspicion: 0,
      lastSeen: null,
      investigate: null,
      pauseTimer: 0,
      searchTimer: 0,
    };
  });
}

/** Plan a breadth-first route from the guard's tile to (col, row). */
export function setGuardRoute(level, guard, col, row) {
  const pt = tileAt(level, guard.x, guard.y);
  const path = findPath(level, pt.col, pt.row, col, row);
  guard.route = path ? path.slice(1) : [];
  guard.routeIndex = 0;
  guard.routeTarget = { col, row };
}

/** True when the guard stands on the tile (col, row). */
export function guardOnTile(level, guard, col, row) {
  const pt = tileAt(level, guard.x, guard.y);
  return pt.col === col && pt.row === row;
}

function moveToward(level, guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  const moved = moveCircle(level, guard.x, guard.y, GUARD_RADIUS, nx - guard.x, ny - guard.y);
  guard.x = moved.x;
  guard.y = moved.y;
  guard.angle = Math.atan2(dy, dx);
  return dist <= step + 1;
}

/** Walk the planned route one frame; true when the route is finished. */
function followRoute(level, guard, speed, dt) {
  if (!guard.route || guard.routeIndex >= guard.route.length) return true;
  const wp = guard.route[guard.routeIndex];
  if (moveToward(level, guard, wp.x, wp.y, speed, dt)) guard.routeIndex += 1;
  return guard.routeIndex >= guard.route.length;
}

function turnToward(guard, targetAngle, turnSpeed, dt) {
  let diff = targetAngle - guard.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = turnSpeed * dt;
  guard.angle += Math.max(-step, Math.min(step, diff));
}

/**
 * Step every guard one frame. Returns 'caught' when a chasing guard reaches
 * the thief, otherwise null. `events` collects {type:'spotted'} / {type:'suspicious'}
 * so the main loop can play sounds and flash the banner.
 */
export function updateGuards(level, guards, player, dt, events) {
  for (const guard of guards) {
    const rate = guardDetectionRate(level, guard, player);
    const sees = rate > 0;
    if (sees) {
      guard.suspicion = Math.min(100, guard.suspicion + rate * dt);
      guard.lastSeen = { x: player.x, y: player.y };
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - GUARD_SUSPICION_DRAIN * dt);
    }

    if (guard.state === GUARD_CALM || guard.state === GUARD_RETURN) {
      if (guard.suspicion >= 100) {
        guard.state = GUARD_CHASE;
        guard.repathTimer = 0;
        events.push({ type: 'spotted', guard });
      } else if (guard.suspicion >= 40) {
        if (guard.state !== GUARD_SUSPICIOUS) events.push({ type: 'suspicious', guard });
        guard.state = GUARD_SUSPICIOUS;
      }
    }

    if (guard.state === GUARD_CALM) {
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        turnToward(guard, guard.angle + 1.4 * dt, 1.4, dt);
        continue;
      }
      if (!guard.route || guard.routeIndex >= guard.route.length) {
        const wp = guard.waypoints[guard.waypointIndex];
        if (guardOnTile(level, guard, wp[0], wp[1])) {
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
          guard.pauseTimer = 0.9;
          continue;
        }
        setGuardRoute(level, guard, wp[0], wp[1]);
        if (guard.route.length === 0) {
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
          continue;
        }
      }
      followRoute(level, guard, GUARD_SPEED_PATROL, dt);
      continue;
    }

    if (guard.state === GUARD_SUSPICIOUS) {
      if (guard.suspicion >= 100) {
        guard.state = GUARD_CHASE;
        guard.repathTimer = 0;
        events.push({ type: 'spotted', guard });
        continue;
      }
      if (guard.suspicion <= 5) {
        guard.state = GUARD_CALM;
        guard.route = [];
        guard.routeIndex = 0;
        continue;
      }
      if (guard.lastSeen) turnToward(guard, Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x), 3.2, dt);
      continue;
    }

    if (guard.state === GUARD_CHASE) {
      const target = sees ? { x: player.x, y: player.y } : guard.lastSeen;
      if (!target) {
        guard.state = GUARD_SEARCH;
        guard.searchTimer = 3;
        continue;
      }
      guard.repathTimer -= dt;
      if (guard.repathTimer <= 0) {
        guard.repathTimer = 0.4;
        const tile = tileAt(level, target.x, target.y);
        setGuardRoute(level, guard, tile.col, tile.row);
      }
      const targetDist = Math.hypot(target.x - guard.x, target.y - guard.y);
      // Close in directly for the last stretch: a route to the thief's own
      // tile ends at its centre, which can leave the guard standing short.
      if (targetDist < 70) moveToward(level, guard, target.x, target.y, GUARD_SPEED_CHASE, dt);
      else followRoute(level, guard, GUARD_SPEED_CHASE, dt);
      if (!sees && guard.lastSeen && Math.hypot(guard.x - guard.lastSeen.x, guard.y - guard.lastSeen.y) < 18) {
        guard.state = GUARD_SEARCH;
        guard.searchTimer = 3;
      }
      const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
      if (dist < GUARD_CATCH_DIST) return 'caught';
      continue;
    }

    if (guard.state === GUARD_SEARCH) {
      guard.searchTimer -= dt;
      turnToward(guard, guard.angle + 2.2 * dt, 2.2, dt);
      if (guard.suspicion >= 100) {
        guard.state = GUARD_CHASE;
        guard.repathTimer = 0;
        continue;
      }
      if (guard.searchTimer <= 0) {
        guard.state = GUARD_RETURN;
        guard.investigate = null;
      }
      continue;
    }

    if (guard.state === GUARD_RETURN) {
      if (guard.investigate) {
        if (!guard.route || guard.routeIndex >= guard.route.length) {
          if (guardOnTile(level, guard, guard.investigate.col, guard.investigate.row)) {
            guard.investigate = null;
            guard.state = GUARD_SEARCH;
            guard.searchTimer = 2.5;
            continue;
          }
          setGuardRoute(level, guard, guard.investigate.col, guard.investigate.row);
        }
        followRoute(level, guard, GUARD_SPEED_SEARCH, dt);
        continue;
      }
      if (!guard.route || guard.routeIndex >= guard.route.length) {
        let best = null;
        let bestDist = Infinity;
        for (const wp of guard.waypoints) {
          const wx = wp[0] * TILE + TILE / 2;
          const wy = wp[1] * TILE + TILE / 2;
          const d = Math.hypot(wx - guard.x, wy - guard.y);
          if (d < bestDist) {
            bestDist = d;
            best = wp;
          }
        }
        if (guardOnTile(level, guard, best[0], best[1])) {
          guard.waypointIndex = (guard.waypoints.indexOf(best) + 1) % guard.waypoints.length;
          guard.state = GUARD_CALM;
          continue;
        }
        setGuardRoute(level, guard, best[0], best[1]);
      }
      followRoute(level, guard, GUARD_SPEED_RETURN, dt);
    }
  }
  return null;
}

/** A loud noise (running, a dropped bar) pulls calm guards over to look. */
export function alertGuardsToNoise(level, guards, x, y, radius) {
  const tile = tileAt(level, x, y);
  for (const guard of guards) {
    if (guard.state !== GUARD_CALM) continue;
    if (Math.hypot(guard.x - x, guard.y - y) > radius) continue;
    guard.investigate = { x, y, col: tile.col, row: tile.row };
    guard.route = [];
    guard.routeIndex = 0;
    guard.state = GUARD_RETURN;
    guard.suspicion = Math.max(guard.suspicion, 30);
  }
}
