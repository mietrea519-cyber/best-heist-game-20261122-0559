// The vault floor: parsing the map, tile queries, collision and pathfinding.
// Everything here is pure grid logic with no canvas or audio, so the play-test
// harness can import it in Node and prove the level is winnable.
import { TILE, COLS, ROWS, MAP } from './config.js';

/** Parse MAP into the level's lookup tables: solids, sight blockers, cover. */
export function parseLevel() {
  const solid = [];
  const blocksSight = [];
  const shadow = [];
  const plant = [];
  const gold = [];
  let diamond = null;
  let exit = null;
  let spawn = null;
  for (let row = 0; row < ROWS; row += 1) {
    solid.push([]);
    blocksSight.push([]);
    shadow.push([]);
    plant.push([]);
    for (let col = 0; col < COLS; col += 1) {
      const ch = MAP[row][col];
      const isWall = ch === '#';
      const isCrate = ch === 'C';
      solid[row].push(isWall || isCrate);
      blocksSight[row].push(isWall || isCrate);
      shadow[row].push(ch === 's');
      plant[row].push(ch === 'p');
      if (ch === 'g') gold.push({ col, row, x: col * TILE + TILE / 2, y: row * TILE + TILE / 2, taken: false });
      if (ch === 'D') diamond = { col, row, x: col * TILE + TILE / 2, y: row * TILE + TILE / 2, taken: false };
      if (ch === 'E') exit = { col, row, x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
      if (ch === 'S') spawn = { col, row, x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
    }
  }
  return { map: MAP, solid, blocksSight, shadow, plant, gold, diamond, exit, spawn };
}

/** Tile column/row for a pixel position, clamped inside the grid. */
export function tileAt(level, x, y) {
  const col = Math.max(0, Math.min(COLS - 1, Math.floor(x / TILE)));
  const row = Math.max(0, Math.min(ROWS - 1, Math.floor(y / TILE)));
  return { col, row };
}

export function isSolidTile(level, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
  return level.solid[row][col];
}

export function blocksSightTile(level, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
  return level.blocksSight[row][col];
}

export function isShadowTile(level, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  return level.shadow[row][col];
}

export function isPlantTile(level, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  return level.plant[row][col];
}

/**
 * Move a circle (x, y, radius) by (dx, dy) against solid tiles. The circle is
 * pushed out of any tile it overlaps, so it slides along walls and around
 * corners instead of wedging on a tile edge.
 */
export function moveCircle(level, x, y, radius, dx, dy) {
  let nx = x + dx;
  let ny = y + dy;
  for (let pass = 0; pass < 3; pass += 1) {
    let pushed = false;
    const minCol = Math.floor((nx - radius) / TILE);
    const maxCol = Math.floor((nx + radius) / TILE);
    const minRow = Math.floor((ny - radius) / TILE);
    const maxRow = Math.floor((ny + radius) / TILE);
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        if (!isSolidTile(level, col, row)) continue;
        const cx = Math.max(col * TILE, Math.min(nx, col * TILE + TILE));
        const cy = Math.max(row * TILE, Math.min(ny, row * TILE + TILE));
        let ddx = nx - cx;
        let ddy = ny - cy;
        let dist = Math.hypot(ddx, ddy);
        if (dist >= radius) continue;
        if (dist < 0.001) {
          ddx = 0;
          ddy = -1;
          dist = 1;
        }
        const push = radius - dist;
        nx += (ddx / dist) * push;
        ny += (ddy / dist) * push;
        pushed = true;
      }
    }
    if (!pushed) break;
  }
  return { x: nx, y: ny };
}

export function circleHitsSolid(level, x, y, radius) {
  const minCol = Math.floor((x - radius) / TILE);
  const maxCol = Math.floor((x + radius) / TILE);
  const minRow = Math.floor((y - radius) / TILE);
  const maxRow = Math.floor((y + radius) / TILE);
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (!isSolidTile(level, col, row)) continue;
      const cx = Math.max(col * TILE, Math.min(x, col * TILE + TILE));
      const cy = Math.max(row * TILE, Math.min(y, row * TILE + TILE));
      const ddx = x - cx;
      const ddy = y - cy;
      if (ddx * ddx + ddy * ddy < radius * radius) return true;
    }
  }
  return false;
}

/**
 * Breadth-first path over open tiles from (startCol, startRow) to
 * (goalCol, goalRow). Returns tile centres as pixel waypoints, or null when
 * no route exists. Used by the autopilot and the Node play-test.
 */
export function findPath(level, startCol, startRow, goalCol, goalRow) {
  if (isSolidTile(level, goalCol, goalRow) || isSolidTile(level, startCol, startRow)) return null;
  const key = (c, r) => r * COLS + c;
  const prev = new Map();
  const queue = [{ col: startCol, row: startRow }];
  prev.set(key(startCol, startRow), null);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.col === goalCol && cur.row === goalRow) {
      const tiles = [];
      let node = cur;
      while (node !== null) {
        tiles.push(node);
        node = prev.get(key(node.col, node.row));
      }
      tiles.reverse();
      return tiles.map((t) => ({ x: t.col * TILE + TILE / 2, y: t.row * TILE + TILE / 2, col: t.col, row: t.row }));
    }
    for (const [dc, dr] of dirs) {
      const nc = cur.col + dc;
      const nr = cur.row + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      if (isSolidTile(level, nc, nr)) continue;
      if (prev.has(key(nc, nr))) continue;
      prev.set(key(nc, nr), cur);
      queue.push({ col: nc, row: nr });
    }
  }
  return null;
}

/** True when every gold bar, the diamond and the exit are reachable from spawn. */
export function checkLevelWinnable(level) {
  const spawn = level.spawn;
  const problems = [];
  const targets = [
    { name: 'diamond', at: level.diamond },
    { name: 'exit', at: level.exit },
    ...level.gold.map((g, i) => ({ name: `gold ${i + 1}`, at: g })),
  ];
  for (const t of targets) {
    const path = findPath(level, spawn.col, spawn.row, t.at.col, t.at.row);
    if (path === null) problems.push(`no path from spawn to ${t.name}`);
  }
  return { winnable: problems.length === 0, problems };
}
