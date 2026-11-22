// The security cameras: wall-mounted lenses that sweep their cones back and
// forth. Being caught in a camera cone feeds the alarm meter directly.
import { CAMERA_DEFS, CAMERA_RANGE } from './config.js';
import { cameraSeesPlayer } from './vision.js';

/** Build the cameras from CAMERA_DEFS, each with its own sweep phase. */
export function createCameras() {
  return CAMERA_DEFS.map((def, index) => ({
    id: index,
    x: def.x,
    y: def.y,
    baseAngle: def.angle,
    angle: def.angle,
    sweep: def.sweep,
    speed: def.speed,
    phase: index * 1.7,
    range: CAMERA_RANGE,
    seeingPlayer: false,
  }));
}

/** Sweep each lens and report whether any camera has the thief in frame. */
export function updateCameras(level, cameras, player, dt, time) {
  let anySeeing = false;
  for (const cam of cameras) {
    cam.angle = cam.baseAngle + Math.sin(time * cam.speed + cam.phase) * cam.sweep;
    cam.seeingPlayer = cameraSeesPlayer(level, cam, player);
    if (cam.seeingPlayer) anySeeing = true;
  }
  return anySeeing;
}
