// All drawing: the vault floor, vision cones, the thief, the guards and the
// cameras, the HUD with its alarm meter, and the title / pause / caught / win
// screens. Everything is drawn in code; there are no image assets.
import { TILE, COLS, ROWS, VIEW_W, VIEW_H, HUD_H, GUARD_RANGE, GUARD_FOV, CAMERA_RANGE, CAMERA_FOV, ALARM_FULL } from './config.js';
import { tileAt } from './level.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function conePath(ctx, x, y, angle, range, fov) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - fov / 2, angle + fov / 2);
  ctx.closePath();
}

function drawFloor(ctx, level, time) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const x = col * TILE;
      const y = row * TILE;
      const ch = level.map[row][col];
      if (ch === '#') {
        ctx.fillStyle = '#2b3247';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#3a435f';
        ctx.fillRect(x, y, TILE, 6);
        ctx.fillStyle = '#c9a227';
        ctx.fillRect(x, y + TILE - 2, TILE, 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        continue;
      }
      ctx.fillStyle = (col + row) % 2 === 0 ? '#1b2334' : '#171e2d';
      ctx.fillRect(x, y, TILE, TILE);
      if (ch === 'C') {
        ctx.fillStyle = '#6b4a22';
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = '#8a5f2c';
        ctx.fillRect(x + 3, y + 3, TILE - 6, 7);
        ctx.strokeStyle = '#4a3013';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 3);
        ctx.lineTo(x + TILE - 3, y + TILE - 3);
        ctx.moveTo(x + TILE - 3, y + 3);
        ctx.lineTo(x + 3, y + TILE - 3);
        ctx.stroke();
      } else if (ch === 's') {
        ctx.fillStyle = 'rgba(4,8,20,0.55)';
        ctx.beginPath();
        ctx.ellipse(x + TILE / 2, y + TILE / 2, TILE / 2 - 2, TILE / 2 - 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,160,255,0.35)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.ellipse(x + TILE / 2, y + TILE / 2, TILE / 2 - 2, TILE / 2 - 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (ch === 'p') {
        ctx.fillStyle = '#1e4d2a';
        ctx.beginPath();
        ctx.arc(x + 12, y + 14, 11, 0, Math.PI * 2);
        ctx.arc(x + 27, y + 12, 10, 0, Math.PI * 2);
        ctx.arc(x + 20, y + 27, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2f7a3e';
        ctx.beginPath();
        ctx.arc(x + 12, y + 12, 5, 0, Math.PI * 2);
        ctx.arc(x + 27, y + 10, 4, 0, Math.PI * 2);
        ctx.arc(x + 20, y + 25, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Gold trim around the diamond vault.
  const d = level.diamond;
  if (d) {
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 3;
    ctx.strokeRect(d.x - TILE / 2 + 2, d.y - TILE / 2 + 2, TILE - 4, TILE - 4);
  }
}

function drawGoldAndDiamond(ctx, level, time) {
  for (const bar of level.gold) {
    if (bar.taken) continue;
    const bob = Math.sin(time * 2 + bar.x) * 2;
    ctx.save();
    ctx.translate(bar.x, bar.y + bob);
    ctx.fillStyle = '#8a6d1a';
    ctx.fillRect(-11, -4, 22, 10);
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(-11, -6, 22, 8);
    ctx.fillStyle = '#fff3a0';
    ctx.fillRect(-9, -6, 7, 3);
    ctx.restore();
  }
  const d = level.diamond;
  if (d && !d.taken) {
    const pulse = 0.6 + Math.sin(time * 3) * 0.25;
    const glow = ctx.createRadialGradient(d.x, d.y, 4, d.x, d.y, 46);
    glow.addColorStop(0, `rgba(80,220,255,${0.5 * pulse})`);
    glow.addColorStop(1, 'rgba(80,220,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(d.x, d.y - 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#7ee7ff';
    ctx.fillRect(-11, -11, 22, 22);
    ctx.fillStyle = '#d9f7ff';
    ctx.fillRect(-11, -11, 22, 9);
    ctx.strokeStyle = '#0e7490';
    ctx.lineWidth = 2;
    ctx.strokeRect(-11, -11, 22, 22);
    ctx.restore();
    ctx.fillStyle = '#bfefff';
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('DIAMOND', d.x, d.y + 30);
  }
}

function drawExit(ctx, level, time) {
  const e = level.exit;
  const open = level.diamond.taken;
  ctx.fillStyle = open ? '#14532d' : '#3f1d1d';
  ctx.fillRect(e.x - 18, e.y - 18, 36, 36);
  ctx.strokeStyle = open ? '#4ade80' : '#ef4444';
  ctx.lineWidth = 3;
  ctx.strokeRect(e.x - 18, e.y - 18, 36, 36);
  if (open) {
    ctx.fillStyle = `rgba(74,222,128,${0.5 + Math.sin(time * 4) * 0.2})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 24, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = open ? '#bbf7d0' : '#fca5a5';
  ctx.font = `bold 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT OPEN' : 'EXIT LOCKED', e.x, e.y + 32);
}

function drawCones(ctx, guards, cameras) {
  for (const cam of cameras) {
    ctx.fillStyle = cam.seeingPlayer ? 'rgba(250,204,21,0.4)' : 'rgba(250,204,21,0.16)';
    conePath(ctx, cam.x, cam.y, cam.angle, CAMERA_RANGE, CAMERA_FOV);
    ctx.fill();
    ctx.strokeStyle = 'rgba(250,204,21,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (const guard of guards) {
    const alarmed = guard.state === 'chase';
    const suspicious = guard.state === 'suspicious';
    ctx.fillStyle = alarmed ? 'rgba(239,68,68,0.38)' : suspicious ? 'rgba(249,115,22,0.3)' : 'rgba(249,115,22,0.16)';
    conePath(ctx, guard.x, guard.y, guard.angle, GUARD_RANGE, GUARD_FOV);
    ctx.fill();
    ctx.strokeStyle = alarmed ? 'rgba(239,68,68,0.7)' : 'rgba(249,115,22,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawCameras(ctx, cameras) {
  for (const cam of cameras) {
    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.rotate(cam.angle);
    ctx.fillStyle = '#334155';
    ctx.fillRect(-4, -7, 18, 14);
    ctx.fillStyle = cam.seeingPlayer ? '#ef4444' : '#facc15';
    ctx.beginPath();
    ctx.arc(14, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGuards(ctx, guards, time) {
  for (const guard of guards) {
    const alarmed = guard.state === 'chase';
    ctx.save();
    ctx.translate(guard.x, guard.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 9, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = alarmed ? '#7f1d1d' : '#1e3a5f';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.rotate(guard.angle);
    ctx.fillStyle = '#dbeafe';
    ctx.beginPath();
    ctx.arc(8, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.fillRect(12, -2, 7, 4);
    ctx.restore();
    if (guard.state === 'suspicious' || guard.state === 'chase') {
      ctx.fillStyle = alarmed ? '#ef4444' : '#f59e0b';
      ctx.font = `bold 22px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(alarmed ? '!' : '?', guard.x, guard.y - 22);
    }
    if (guard.suspicion > 5 && guard.state !== 'chase') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(guard.x - 16, guard.y - 34, 32, 5);
      ctx.fillStyle = guard.suspicion > 40 ? '#f59e0b' : '#facc15';
      ctx.fillRect(guard.x - 16, guard.y - 34, 32 * (guard.suspicion / 100), 5);
    }
  }
}

function drawPlayer(ctx, player, time) {
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.running) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    const back = player.angle + Math.PI;
    ctx.beginPath();
    ctx.moveTo(Math.cos(back) * 18, Math.sin(back) * 18);
    ctx.lineTo(Math.cos(back) * 30, Math.sin(back) * 30);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 9, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(player.angle);
  const r = player.sneaking ? 11 : 13;
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = player.hidden ? '#4ade80' : '#e5e7eb';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(5, -4, 2.5, 0, Math.PI * 2);
  ctx.arc(5, 4, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(9, -2, 6, 4);
  ctx.restore();
  if (player.sneaking) {
    ctx.fillStyle = '#93c5fd';
    ctx.font = `bold 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('SNEAKING', player.x, player.y - 20);
  }
  if (player.hidden) {
    ctx.fillStyle = '#4ade80';
    ctx.font = `bold 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('HIDDEN', player.x, player.y - 20);
  }
}

/** The HUD bar: loot, gold, score, time and the alarm meter. */
export function drawHUD(ctx, game) {
  ctx.fillStyle = 'rgba(8,12,22,0.92)';
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillText('VAULTBREAK', 16, HUD_H / 2);
  ctx.font = `14px ${FONT}`;
  ctx.fillStyle = '#cbd5e1';
  const goldTaken = game.level.gold.filter((g) => g.taken).length;
  ctx.fillText(`◆ DIAMOND ${game.level.diamond.taken ? '✓' : '…'}    GOLD ${goldTaken}/6    SCORE ${game.score}`, 190, HUD_H / 2);
  ctx.textAlign = 'right';
  ctx.fillText(`TIME ${formatTime(game.time)}`, 880, HUD_H / 2);
  // Alarm meter.
  const ax = 920;
  const aw = 300;
  ctx.textAlign = 'left';
  ctx.fillStyle = game.alarm > 75 ? '#ef4444' : '#f8fafc';
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText('ALARM', ax, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(ax + 62, 10, aw - 62, 16);
  const frac = Math.max(0, Math.min(1, game.alarm / ALARM_FULL));
  const grad = ctx.createLinearGradient(ax + 62, 0, ax + aw, 0);
  grad.addColorStop(0, '#facc15');
  grad.addColorStop(0.6, '#f97316');
  grad.addColorStop(1, '#ef4444');
  ctx.fillStyle = grad;
  ctx.fillRect(ax + 62, 10, (aw - 62) * frac, 16);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(ax + 62, 10, aw - 62, 16);
  ctx.fillStyle = '#f8fafc';
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText(`${Math.round(game.alarm)}%`, ax + 62, 40);
  // Hints along the bottom wall row, clear of the playfield.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#94a3b8';
  ctx.font = `12px ${FONT}`;
  ctx.fillText(game.level.diamond.taken ? 'Diamond taken — reach the EXIT!' : 'Steal the DIAMOND, then reach the EXIT', VIEW_W - 16, VIEW_H - 12);
  ctx.textAlign = 'left';
  ctx.fillText('WASD move · SHIFT sneak · R run (loud) · ESC pause', 16, VIEW_H - 12);
  ctx.textBaseline = 'alphabetic';
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function drawBanner(ctx, game) {
  if (!game.banner || game.bannerTimer <= 0) return;
  const alpha = Math.min(1, game.bannerTimer);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = game.bannerColor || '#ef4444';
  ctx.font = `bold 34px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(game.banner, VIEW_W / 2, 150);
  ctx.restore();
}

function dim(ctx, alpha) {
  ctx.fillStyle = `rgba(4,8,18,${alpha})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,12,22,0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

/** Draw the whole game for the current screen. */
export function drawGame(ctx, game) {
  const { level, player, guards, cameras, time } = game;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawFloor(ctx, level, time);
  drawExit(ctx, level, time);
  drawCones(ctx, guards, cameras);
  drawGoldAndDiamond(ctx, level, time);
  drawCameras(ctx, cameras);
  drawGuards(ctx, guards, time);
  drawPlayer(ctx, player, time);
  drawHUD(ctx, game);
  drawBanner(ctx, game);

  if (game.screen === SCREEN_TITLE) {
    dim(ctx, 0.72);
    panel(ctx, 290, 130, 700, 460);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = `bold 64px ${FONT}`;
    ctx.fillText('VAULTBREAK', VIEW_W / 2, 210);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `20px ${FONT}`;
    ctx.fillText('One vault. One diamond. Four guards, three cameras,', VIEW_W / 2, 258);
    ctx.fillText('and an alarm that never forgets.', VIEW_W / 2, 286);
    ctx.fillStyle = '#93c5fd';
    ctx.font = `17px ${FONT}`;
    ctx.fillText('WASD / arrows — move      SHIFT — sneak (hard to spot)', VIEW_W / 2, 336);
    ctx.fillText('R — run (fast, but loud)      ESC / P — pause      M — mute', VIEW_W / 2, 364);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `16px ${FONT}`;
    ctx.fillText('Shadow patches slow detection. Plants hide you. Crates block sight.', VIEW_W / 2, 404);
    ctx.fillText('Grab gold on the way — the diamond unlocks the exit door.', VIEW_W / 2, 430);
    ctx.fillStyle = '#4ade80';
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText('Click or press SPACE to start the heist', VIEW_W / 2, 500);
    if (game.best > 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = `15px ${FONT}`;
      ctx.fillText(`Best getaway so far: ${game.best} points`, VIEW_W / 2, 540);
    }
    ctx.fillStyle = '#64748b';
    ctx.font = `13px ${FONT}`;
    ctx.fillText('Tip: watch the cones before you move — a guard that sees you fills the ALARM meter.', VIEW_W / 2, 566);
  }

  if (game.screen === SCREEN_PAUSED) {
    dim(ctx, 0.6);
    panel(ctx, 440, 260, 400, 180);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8fafc';
    ctx.font = `bold 40px ${FONT}`;
    ctx.fillText('PAUSED', VIEW_W / 2, 330);
    ctx.font = `17px ${FONT}`;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Press ESC / P or click to keep going', VIEW_W / 2, 380);
  }

  if (game.screen === SCREEN_CAUGHT) {
    dim(ctx, 0.66);
    panel(ctx, 330, 180, 620, 330);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ef4444';
    ctx.font = `bold 56px ${FONT}`;
    ctx.fillText('CAUGHT!', VIEW_W / 2, 260);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `19px ${FONT}`;
    ctx.fillText(game.caughtReason || 'A guard got you.', VIEW_W / 2, 305);
    ctx.fillText(`Score ${game.score}  ·  Gold ${game.level.gold.filter((g) => g.taken).length}/6  ·  Time ${formatTime(game.time)}`, VIEW_W / 2, 340);
    ctx.fillStyle = '#94a3b8';
    ctx.font = `16px ${FONT}`;
    ctx.fillText('The vault keeps its diamond… this time.', VIEW_W / 2, 380);
    ctx.fillStyle = '#4ade80';
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText('Click or press SPACE to try again', VIEW_W / 2, 450);
  }

  if (game.screen === SCREEN_WIN) {
    dim(ctx, 0.6);
    panel(ctx, 300, 130, 680, 440);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4ade80';
    ctx.font = `bold 52px ${FONT}`;
    ctx.fillText('CLEAN GETAWAY!', VIEW_W / 2, 205);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `19px ${FONT}`;
    const lines = game.winLines || [];
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 255 + i * 30));
    ctx.fillStyle = '#ffd94a';
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillText(`FINAL SCORE  ${game.score}`, VIEW_W / 2, 255 + lines.length * 30 + 18);
    ctx.fillStyle = '#4ade80';
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText('Click or press SPACE to run it again', VIEW_W / 2, 520);
  }
}
