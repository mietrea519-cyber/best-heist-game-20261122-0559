[![best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/competitions/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/mietrea519-cyber/best-heist-game-20261122-0559/rank.svg)](https://make.fun/competitions/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/mietrea519-cyber/best-heist-game-20261122-0559/reward.svg)](https://make.fun/competitions/best-heist-game-20261122-0559)

# Vaultbreak

A top-down heist game in a vault at night. You are the thief: slip past four
patrolling guards and three sweeping security cameras, steal the diamond,
grab the gold bars on the way, and reach the exit before the alarm meter
fills. One screen is the whole vault, so every guard cone, camera sweep,
loot target and the alarm are always in view.

The vault rewards patience. Guards patrol fixed routes with visible vision
cones and a suspicion meter — a "?" means one is getting curious, a "!"
means it is chasing you. Cameras sweep their yellow cones across the floor
and feed the alarm directly. Shadow patches slow detection, plants hide you
completely, and crates block sight, so every room has more than one route.
Running is fast but loud: guards hear it and come to look. Get caught and
the run ends; get out with the diamond and the getaway pays a time bonus —
plus a ghost bonus if nobody ever spotted you.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrow keys | Move the thief |
| Shift | Sneak — slow, quiet, hard to spot |
| R (hold) | Run — fast, but guards hear you |
| Esc / P | Pause |
| Space / click | Start, restart, resume |
| M | Mute |

## How to run

No build step, no network, no libraries — plain HTML5 canvas 2D with
WebAudio synth sounds, all art drawn in code.

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` directly in desktop Chrome.

## Files

- `game/src/config.js` — canvas size, speeds, sight ranges, the vault map, patrols and cameras
- `game/src/level.js` — map parsing, tile queries, collision and BFS pathfinding
- `game/src/vision.js` — line of sight, vision cones and detection rates
- `game/src/guards.js` — guard patrols and the calm → suspicious → chase → search → return AI
- `game/src/cameras.js` — sweeping security cameras
- `game/src/player.js` — the thief: movement, sneak/run, loot pickups and noise
- `game/src/render.js` — all drawing: the vault, cones, HUD with alarm meter, and the screens
- `game/src/audio.js` — synthesised WebAudio effects (pickup, spotted, alarm, win)
- `game/src/input.js` — keyboard and mouse input
- `game/src/shots.js` — staged screenshot scenes and the autopilot that plays the heist
- `game/src/main.js` — the game object, state machine and browser loop

Screenshots are staged scenes of the real game (`?shot=title|play|alarm|win`);
`?autopilot=1` plays the whole heist hands-free and reports the result in
`window.__autopilotResult`.
