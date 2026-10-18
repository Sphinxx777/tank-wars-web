import { SoundSequence } from './sound.js';
import { sinDeg, cosDeg } from './trig.js';

export const MIRV_SUBSTEP_SECONDS = 1 / 600;
export const mirvSubdivisions = (alive, configured = 10) =>
  Math.max(1, Math.ceil(configured / Math.max(1, alive)));

export function integrateMirv(shot, wind, subdivisions) {
  shot.x += shot.vx / subdivisions;
  shot.y += shot.vy / subdivisions;
  shot.vy += 0.1 / subdivisions;
  shot.vx += wind / 5000 / subdivisions;
  shot.pixelX = Math.trunc(shot.x);
  shot.pixelY = Math.trunc(shot.y);
}
export function mirvSpread(mode, index, rng) {
  if (mode === 0) return [rng.next() * 6 - 3, rng.next() * 6 - 3];
  if (mode === 1) return [(index - 2) * 1.75, 0];
  if (mode === 2) return [0, (index - 2) * 1.75];
  return (
    mode === 3
      ? [
          [1.75, 0],
          [-1.75, 0],
          [0, -1.75],
          [0, 1.75],
          [0, 0],
        ]
      : [
          [1.75, 1.75],
          [-1.75, -1.75],
          [1.75, -1.75],
          [-1.75, 1.75],
          [0, 0],
        ]
  )[index];
}
export function mirvWall(shot, wall, wind = 0) {
  const x = shot.pixelX,
    y = shot.pixelY;
  let stopped = false;
  if (wall >= 1 && wall <= 3) {
    const factor = wall === 1 ? 0.7071059999998397 : wall === 3 ? 1.4142100000008213 : 1;
    if ((x <= 10 && shot.vx < 0) || (x >= 310 && shot.vx > 0)) {
      shot.vx *= -factor;
      shot.vy *= factor;
    }
    if (y <= 30 && shot.vy < 0) {
      shot.vy *= -factor;
      shot.vx *= factor;
    }
    if (y >= 188 && shot.vy > 0) {
      shot.vy *= -factor;
      shot.vx *= factor;
      stopped = Math.abs(shot.vx) < 0.1 && Math.abs(shot.vy) < 0.1;
    }
  } else if (wall === 4) {
    if (x <= 10) shot.x += 300;
    else if (x >= 310) shot.x -= 300;
  }
  if (wall === 0 && ((x > 310 && shot.vx > 1 && wind > 0) || (x < 10 && shot.vx < 1 && wind < 0)))
    shot.y = 400;
  return stopped;
}
export function mirvCollision(game, shot, tankPixel) {
  let color = 0,
    stopped = false;
  const x = shot.pixelX,
    y = shot.pixelY;
  if (x > 11 && x < 309 && y > 33 && y < 187)
    for (const [dx, dy] of [
      [-1, 0],
      [0, -1],
      [0, 0],
      [0, 1],
      [1, 0],
    ]) {
      const tank = game.players.find((p) => p.alive && tankPixel(p, x + dx, y + dy));
      if (tank) {
        color = 20 + tank.id;
        if (tank.men > 0) stopped = true;
      } else if (game.terrain.solid(x + dx, y + dy)) {
        color = 2;
        stopped = true;
      }
    }
  return { color, stopped };
}
function step(game, shot, subdivisions, tankPixel, groups, shared) {
  const previous = [shot.pixelX ?? Math.trunc(shot.x), shot.pixelY ?? Math.trunc(shot.y)];
  integrateMirv(shot, game.wind, subdivisions);
  for (const tank of game.players) {
    const dx = tank.x - shot.pixelX,
      dy = shot.pixelY - tank.y,
      distance = dx * dx + dy * dy;
    if (tank.id === shot.owner && !shared.leftOrigin) {
      if (Math.abs(dx) > 40 || Math.abs(dy) > 40) shared.leftOrigin = true;
      else continue;
    }
    if (tank.alive && tank.defense[2] > 0 && distance > 0 && distance <= 1600) {
      const angle =
        dx === 0
          ? dy > 0
            ? 90
            : 270
          : Math.trunc((Math.atan(dy / dx) * 180) / Math.PI) + (dx < 0 ? 180 : 0);
      const force = -600 / distance / subdivisions;
      shot.vx += cosDeg(angle) * force;
      shot.vy -= sinDeg(angle) * force;
    }
  }
  game.restoreProjectile(shot, ...previous);
  const collision = mirvCollision(game, shot, tankPixel);
  shot.collisionColor = collision.color;
  const wallStop = mirvWall(shot, game.wall, game.wind);

  return (
    collision.stopped ||
    wallStop ||
    groups > 1000 ||
    Math.abs(shot.vx) > 30 ||
    Math.abs(shot.vy) > 30 ||
    ((game.wall === 0 || game.wall === 4) && (shot.pixelY >= 190 || shot.pixelY < -5000))
  );
}
function* detonate(game, shot) {
  game.explode(shot.pixelX, shot.pixelY, game.weapons[7].radius, shot.owner, 'blast', true);
  while (game.explosions.length) {
    yield 0.001;
    game.updateExplosions(0.001);
  }
  if (shot.collisionColor >= 20 && shot.collisionColor <= 29)
    game.hurt(game.players[shot.collisionColor - 20], 200, shot.owner);
}

// OVR 0x120e0..0x14122: MIRV has its own flight loop and blocking impacts.
export function* mirvEffect(game, parent, tankPixel) {
  let active = [parent],
    children = null,
    subdivisions = 10;
  let counter = game.players.length,
    groups = 0;
  const shared = { leftOrigin: !!parent.leftOrigin };
  while (active.length) {
    if (++counter > subdivisions) {
      counter = 0;
      groups++;
    }
    const parentSweep = !children;
    for (const shot of [...active]) {
      const stopped = step(game, shot, subdivisions, tankPixel, groups, shared);
      if (game.options.flySound) {
        const tones = new SoundSequence();
        if (stopped) tones.stop();
        else tones.tone(600 - 2 * shot.pixelY);
        game.audio(tones);
      }
      if (stopped && shot.pixelY < -5000 && game.options.sound) {
        const tones = new SoundSequence();
        for (const [hz, ms] of [
          [1525, 15],
          [4674, 5],
          [222, 10],
          [121, 14],
        ])
          tones.tone(hz, ms);
        game.audio(tones.stop());
      }
      if (!children && (stopped || shot.vy > 0)) {
        children = Array.from({ length: 5 }, (_, i) => {
          const [dx, dy] = mirvSpread(game.options.mirvSpread, i, game.rng);
          return {
            ...parent,
            vx: parent.vx + dx,
            vy: parent.vy + dy,
            weapon: 7,
            mirvChild: true,
            guidance: 0,
            trail: [],
            collisionColor: 0,
          };
        });
        active = children.slice();
        game.shots = active;
        // The first child sweep still uses the parent's subdivision count.
        yield MIRV_SUBSTEP_SECONDS;
        break;
      }
      if (stopped) {
        active = active.filter((item) => item !== shot);
        game.shots = active;
        if (game.options.mirvDetonation === 0) yield* detonate(game, shot);
      }
      yield MIRV_SUBSTEP_SECONDS;
    }
    if (!parentSweep) subdivisions = mirvSubdivisions(active.length);
  }
  if (children && game.options.mirvDetonation === 1)
    for (const shot of children) yield* detonate(game, shot);
  game.shots = [];
  if (game.options.flySound) game.audio(new SoundSequence().stop());
  game.terrainResolved = false;
}
