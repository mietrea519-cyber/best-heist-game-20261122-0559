// Vaultbreak: the game object, its state machine and the browser loop.
// Screens: title -> play -> paused / caught / win. The loop steps the real
// rules every frame; ?shot=<name> stages a screenshot scene instead, and
// ?autopilot=1 plays the whole heist hands-free for the play-test.
import { TILE, ALARM_DECAY, ALARM_FULL, ALARM_LOCKDOWN_SECONDS, CAMERA_ALARM_RATE, SCORE_GOLD, SCORE_DIAMOND, SCORE_GHOST_BONUS, TIME_BONUS_PAR_SECONDS, TIME_BONUS_RATE, VIEW_W, VIEW_H } from './config.js';
import { parseLevel } from './level.js';
import { createGuards, updateGuards } from './guards.js';
import { createCameras, updateCameras } from './cameras.js';
import { createPlayer, updatePlayer, playerAtExit, scoreForPickup } from './player.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { drawGame, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_CAUGHT, SCREEN_WIN } from './render.js';
import { stageShot, runAutopilot, autopilotInput } from './shots.js';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** A fresh game: new level, thief, guards and cameras, zeroed score and alarm. */
export function createGame() {
  const game = {
    screen: SCREEN_TITLE,
    level: parseLevel(),
    player: null,
    guards: [],
    cameras: [],
    time: 0,
    alarm: 0,
    maxAlarm: 0,
    alarmPeaks: 0,
    score: 0,
    best: 0,
    banner: null,
    bannerTimer: 0,
    bannerColor: '#ef4444',
    caughtReason: '',
    winLines: [],
    lockdownTimer: 0,
    audio: null,
  };
  game.player = createPlayer(game.level.spawn);
  game.guards = createGuards();
  game.cameras = createCameras();

  game.reset = function reset() {
    game.level = parseLevel();
    game.player = createPlayer(game.level.spawn);
    game.guards = createGuards();
    game.cameras = createCameras();
    game.time = 0;
    game.alarm = 0;
    game.maxAlarm = 0;
    game.alarmPeaks = 0;
    game.score = 0;
    game.banner = null;
    game.bannerTimer = 0;
    game.caughtReason = '';
    game.winLines = [];
    game.lockdownTimer = 0;
    game.screen = SCREEN_TITLE;
  };

  game.showBanner = function showBanner(text, color) {
    game.banner = text;
    game.bannerColor = color || '#ef4444';
    game.bannerTimer = 2.2;
  };

  game.finishWin = function finishWin() {
    const goldTaken = game.level.gold.filter((g) => g.taken).length;
    const timeBonus = Math.max(0, Math.round((TIME_BONUS_PAR_SECONDS - game.time) * TIME_BONUS_RATE));
    const ghost = game.alarmPeaks === 0 ? SCORE_GHOST_BONUS : 0;
    game.score += timeBonus + ghost;
    game.winLines = [
      `Diamond secured  +${SCORE_DIAMOND}`,
      `Gold bars  ${goldTaken} × ${SCORE_GOLD}  +${goldTaken * SCORE_GOLD}`,
      `Getaway time  ${formatTime(game.time)}  —  time bonus  +${timeBonus}`,
      ghost > 0 ? `Never spotted — ghost bonus  +${ghost}` : `Spotted ${game.alarmPeaks}× — no ghost bonus`,
    ];
    game.screen = SCREEN_WIN;
    if (game.score > game.best) game.best = game.score;
    if (game.audio) game.audio.win();
  };

  game.caught = function caught(reason) {
    game.caughtReason = reason;
    game.screen = SCREEN_CAUGHT;
    if (game.audio) game.audio.caught();
  };

  /** Step the live rules one frame. Only runs while the screen is play. */
  game.step = function step(dt, input) {
    if (game.screen !== SCREEN_PLAY) return;
    game.time += dt;
    if (game.bannerTimer > 0) game.bannerTimer -= dt;

    const pickups = updatePlayer(game.level, game.player, game.guards, input, dt);
    for (const event of pickups) {
      game.score += scoreForPickup(event.type);
      if (game.audio) {
        if (event.type === 'diamond') {
          game.audio.diamond();
          game.showBanner('DIAMOND SECURED — GET TO THE EXIT!', '#4ade80');
          game.audio.unlock();
        } else {
          game.audio.pickup();
        }
      } else if (event.type === 'diamond') {
        game.showBanner('DIAMOND SECURED — GET TO THE EXIT!', '#4ade80');
      }
    }

    const guardEvents = [];
    const result = updateGuards(game.level, game.guards, game.player, dt, guardEvents);
    for (const event of guardEvents) {
      if (event.type === 'spotted') {
        game.showBanner('SPOTTED!', '#ef4444');
        if (game.audio) game.audio.spotted();
      }
    }
    if (result === 'caught') {
      game.caught('A guard caught you in the vault.');
      return;
    }

    const cameraSees = updateCameras(game.level, game.cameras, game.player, dt, game.time);
    const anyChase = game.guards.some((g) => g.state === 'chase');
    const prevAlarm = game.alarm;
    let alarmIn = 0;
    if (cameraSees) alarmIn += CAMERA_ALARM_RATE;
    if (anyChase) alarmIn += 12;
    if (alarmIn > 0) game.alarm = Math.min(ALARM_FULL, game.alarm + alarmIn * dt);
    else game.alarm = Math.max(0, game.alarm - ALARM_DECAY * dt);
    if (game.alarm > game.maxAlarm) game.maxAlarm = game.alarm;
    if (prevAlarm < 90 && game.alarm >= 90) game.alarmPeaks += 1;

    if (game.alarm >= ALARM_FULL && game.lockdownTimer <= 0) {
      game.lockdownTimer = ALARM_LOCKDOWN_SECONDS;
      game.showBanner('LOCKDOWN! EVERY GUARD IS COMING!', '#ef4444');
      if (game.audio) game.audio.spotted();
      for (const guard of game.guards) {
        guard.state = 'chase';
        guard.suspicion = 100;
        guard.lastSeen = { x: game.player.x, y: game.player.y };
      }
      game.alarm = 70;
    }
    if (game.lockdownTimer > 0) game.lockdownTimer -= dt;
    if (game.audio) game.audio.alarmPulse(game.alarm, dt);

    if (playerAtExit(game.level, game.player)) {
      game.finishWin();
    }
  };

  /**
   * Step the vault without the thief: guards patrol, cameras sweep. Used
   * behind the title screen and by the staged screenshot scenes.
   */
  game.stepAmbient = function stepAmbient(dt) {
    game.time += dt;
    const ghost = { x: -9999, y: -9999, sneaking: false, running: false };
    updateGuards(game.level, game.guards, ghost, dt, []);
    updateCameras(game.level, game.cameras, ghost, dt, game.time);
  };

  return game;
}

// ---- browser boot: canvas, loop, menus, screenshot hooks ----
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const game = createGame();
try {
  const saved = Number(window.localStorage.getItem('vaultbreak-best'));
  if (Number.isFinite(saved) && saved > 0) game.best = saved;
} catch (err) { /* private mode: best score just does not persist */ }
const input = createInput(canvas);
const audio = createAudio();
game.audio = audio;
window.__game = game;
window.__autopilotInput = autopilotInput;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const autopilotMode = params.get('autopilot') === '1';

function saveBest() {
  try {
    window.localStorage.setItem('vaultbreak-best', String(game.best));
  } catch (err) { /* ignore */ }
}

function startGame() {
  audio.ensure();
  audio.click();
  game.reset();
  game.screen = SCREEN_PLAY;
}

function draw() {
  drawGame(ctx, game);
}

if (shotName) {
  stageShot(shotName, game);
  draw();
  window.__shotReady = true;
} else if (autopilotMode) {
  const result = runAutopilot(game, 300);
  window.__autopilotResult = result;
  saveBest();
  draw();
  window.__shotReady = true;
} else {
  let last = performance.now();
  let wasMuted = input.muted;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (input.muted !== wasMuted) {
      wasMuted = input.muted;
      if (audio.master) audio.master.gain.value = input.muted ? 0 : 0.22;
    }
    if (input.isPausePressed()) {
      input.consumePause();
      if (game.screen === SCREEN_PLAY) {
        game.screen = SCREEN_PAUSED;
      } else if (game.screen === SCREEN_PAUSED) {
        game.screen = SCREEN_PLAY;
      }
    }
    const clicks = input.drainClicks();
    if (clicks.length > 0) {
      audio.ensure();
      if (game.screen === SCREEN_TITLE || game.screen === SCREEN_CAUGHT || game.screen === SCREEN_WIN) {
        startGame();
      } else if (game.screen === SCREEN_PAUSED) {
        game.screen = SCREEN_PLAY;
      }
    }
    if (game.screen === SCREEN_PLAY) {
      game.step(dt, input);
      if (game.screen === SCREEN_WIN || game.screen === SCREEN_CAUGHT) saveBest();
    }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
