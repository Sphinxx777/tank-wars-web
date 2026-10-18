// OVR 0x11229 and 0x1130f: S comes from the DOS configuration (default 10).
// Its counter includes BOTH 0 and S; it is not a modulo-S integration index.
export const SHOT_SUBDIVISIONS = 10;
export function advanceShotCounter(shot, playerCount) {
  shot.subdivisions ??= SHOT_SUBDIVISIONS;
  shot.substep ??= playerCount;
  shot.groups ??= 0;
  shot.collisionColor ??= 0;
  if (++shot.substep > shot.subdivisions) {
    shot.substep = 0;
    shot.groups++;
  }
}

// OVR 0x11a05..0x11b60: read the cross in order. Only dirt and tank
// colors replace the last classified color; that color controls direct damage.
export function ordinaryCollision(game, shot, tankPixel) {
  const x = shot.pixelX,
    y = shot.pixelY;
  let stopped = false;
  for (const [dx, dy] of [
    [-1, 0],
    [0, -1],
    [0, 0],
    [0, 1],
    [1, 0],
  ]) {
    const tank = game.players.find((p) => p.alive && tankPixel(p, x + dx, y + dy));
    if (tank) {
      shot.collisionColor = 20 + tank.id;
      if (shot.weapon >= 12 && shot.weapon <= 16) {
        stopped = false;
        shot.guidance = 0;
        shot.vy *= -1.2;
        shot.color = '#0000ff';
      } else stopped = true;
    } else if (game.terrain.solid(x + dx, y + dy)) {
      shot.collisionColor = 2;
      const shooter = game.players[shot.owner];
      const threshold = shot.threshold ?? 3 * (shooter?.men ?? 100) + 643;
      const power = shot.power ?? shooter?.power ?? 0;
      if (power === threshold) stopped = false;
      else if (power < threshold || shot.substep === shot.subdivisions) stopped = true;
    }
  }
  return stopped;
}

// This shortcut is outside the collision rectangle. The asymmetric left vx<+1
// comparison is in the original. It moves real Y, leaving this step's pixel Y.
export function ordinaryOpenWall(shot, wind) {
  if (
    !shot.guidance &&
    ((shot.pixelX > 310 && shot.vx > 1 && wind > 0) ||
      (shot.pixelX < 10 && shot.vx < 1 && wind < 0))
  )
    shot.y = 300;
}
export function ordinaryFlightEnd(shot, wall, collision) {
  let event = collision || shot.stopped || shot.groups > 1000 ? 'hit' : null;
  if (wall === 0 || wall === 4) {
    if (shot.pixelY < -5000) event = 'gone';
    else if (shot.pixelY >= 190) event = 'hit';
  }
  // The speed cutoff follows the high exit and enables impact again.
  if (Math.abs(shot.vx) > 30 || Math.abs(shot.vy) > 30) event = 'hit';
  return event;
}
