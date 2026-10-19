import { runtimeCos, runtimeSin } from './runtime-trig.js';
import { tankRGB } from './palette.js';
import { SoundSequence, CPU_WRITE_MS, laserCharge } from './sound.js';

export const LASER_STEP_SECONDS = 0.005;

// OVR 0x14e06..0x150ae: laser walls use real coordinates and reflect sign only.
export function laserWall(beam, wall) {
  if (wall >= 1 && wall <= 3) {
    if ((beam.x <= 11 && beam.vx < 0) || (beam.x >= 309 && beam.vx > 0)) beam.vx = -beam.vx;
    if ((beam.y <= 31 && beam.vy < 0) || (beam.y >= 189 && beam.vy > 0)) beam.vy = -beam.vy;
    return false;
  }
  if (wall === 4) {
    if (beam.x <= 10) beam.x += 300;
    if (beam.x >= 310) beam.x -= 300;
  } else if ((beam.x <= 11 && beam.vx < 0) || (beam.x >= 309 && beam.vx > 0)) return true;
  return (beam.y <= 31 && beam.vy < 0) || (beam.y >= 189 && beam.vy > 0);
}

export function laserIntensity(remaining, initial) {
  return Math.trunc(10 + (53 * remaining) / initial);
}

// Explicit DOS Delay calls are yielded independently of browser refresh and sound.
export function* laserEffect(game, shot, energy, tankPixel, tankBodyPixel) {
  const tank = game.players[shot.owner];
  // The laser and barrel call the Pascal runtime trigonometry, not the AI table.
  const cosine = runtimeCos(tank.angle);
  const sine = runtimeSin(tank.angle);
  const visual = {
    owner: tank.id,
    charging: true,
    rgb: tankRGB(tank.id, tank.men),
    path: new Map(),
    particles: [],
  };
  const barrelEnd = [tank.x + Math.trunc(8 * cosine), tank.y - Math.trunc(8 * sine)];
  let bx = tank.x,
    by = tank.y;
  const dx = Math.abs(barrelEnd[0] - bx),
    dy = Math.abs(barrelEnd[1] - by);
  const horizontal = dx > dy,
    major = Math.max(dx, dy),
    minor = Math.min(dx, dy);
  const sx = barrelEnd[0] > bx ? 1 : -1,
    sy = barrelEnd[1] > by ? 1 : -1;
  let error = major >> 1;
  for (let pixel = 0; pixel <= major; pixel++) {
    if (!tankBodyPixel(tank, bx, by)) visual.path.set(by * 320 + bx, [bx, by]);
    if (horizontal) bx += sx;
    else by += sy;
    error += minor;
    if (error >= major) {
      if (horizontal) by += sy;
      else bx += sx;
      error -= major;
    }
  }
  game.laserVisual = visual;
  const start = [...visual.rgb];
  const chargeColor = (step) =>
    start.map((value, channel) =>
      Math.trunc(value + (((channel === 2 ? 0 : 63) - value) * step) / 100),
    );
  if (game.options.sound) {
    game.audio(laserCharge());
    yield (100 * CPU_WRITE_MS) / 1000;
  }
  for (let pass = 1; pass <= 2; pass++) {
    for (let step = 1; step <= 100; step++) {
      visual.rgb = chargeColor(step);
      yield Math.trunc(5 / pass) / 1000;
    }
    for (let step = 100; step >= 1; step--) {
      visual.rgb = chargeColor(step);
      yield Math.trunc(5 / pass) / 1000;
    }
  }
  for (let step = 1; step <= 100; step++) {
    visual.rgb = chargeColor(step);
    yield 0.002;
  }
  if (game.options.sound) yield 0.201;
  visual.charging = false;
  if (game.rng.next() < 0.2) game.hurt(tank, 1, shot.owner, 'laser', true);
  const hitPlayers = new Set([tank.id]);
  const beam = {
    x: tank.x + 7 * cosine,
    y: tank.y - 7 * sine,
    vx: cosine,
    vy: -sine,
  };
  const initial = 10 * energy;
  let remaining = initial;
  const inside = (x, y) => x >= 11 && x <= 309 && y >= 31 && y <= 189;
  const key = (x, y) => y * 320 + x;
  const read = (x, y) => {
    if (visual.path.has(key(x, y))) return 254;
    const player = game.players.find((player) => player.alive && tankPixel(player, x, y));
    return player ? 20 + player.id : game.terrain.solid(x, y) ? 2 : 0;
  };
  while (remaining > 0) {
    beam.x += beam.vx;
    beam.y += beam.vy;
    remaining -= 10;
    const intensity = laserIntensity(remaining, initial);
    visual.rgb = [intensity, intensity, 0];
    const collision = read(Math.trunc(beam.x), Math.trunc(beam.y));
    if (collision === 2) {
      const tones = new SoundSequence();
      for (let particle = 1; particle <= 15; particle++) {
        const x = Math.trunc(beam.x - game.rng.int(20) * beam.vx);
        const y = Math.trunc(beam.y - game.rng.int(20) * beam.vy);
        const color = read(x, y);
        if (inside(x, y) && !(color >= 20 && color <= 29) && color !== 254)
          game.terrain.set(x, y, 0);
        if (game.options.sound)
          tones.tone(500 + game.rng.int((500 * particle) & 65535), CPU_WRITE_MS);
      }
      game.terrain.version++;
      if (game.options.sound) game.audio(tones);
    } else if (collision >= 20 && collision <= 29 && game.players[collision - 20].men > 0) {
      const target = game.players[collision - 20];
      if (!hitPlayers.has(target.id)) {
        hitPlayers.add(target.id);
        tank.hits++;
      }
      remaining -= 10;
      if (target.defense[0] <= 0) {
        for (let particle = 0; particle < 15; particle++) {
          let x, y, color;
          do {
            x = Math.trunc(beam.x - game.rng.int(40) + 20);
            y = Math.trunc(beam.y - game.rng.int(40) + 20);
            color = read(x, y);
          } while ((color >= 20 && color <= 29 && color !== collision) || color === 254);
          if (game.options.sound)
            game.audio(new SoundSequence().tone(500 + game.rng.int(500 * (particle + 1))));
          yield LASER_STEP_SECONDS;
          visual.particles.push([x, y, target.id]);
        }
        const removalSound = new SoundSequence();
        visual.particles.forEach(([x, y], index) => {
          if (game.options.sound)
            removalSound.tone(500 + game.rng.int(500 * (index + 1)), CPU_WRITE_MS);
          if (inside(x, y)) game.terrain.set(x, y, 0);
        });
        if (game.options.sound) game.audio(removalSound);
        game.terrain.version++;
        visual.particles = [];
      }
      game.hurt(target, 3, shot.owner, 'laser', true);
      beam.x -= beam.vx;
      beam.y -= beam.vy;
    }
    yield LASER_STEP_SECONDS;
    if (game.options.sound)
      game.audio(new SoundSequence().tone(100 + game.rng.int((12 * remaining) & 65535)));
    const done = laserWall(beam, game.wall) || remaining <= 0;
    if (done) break;
    const x = Math.trunc(beam.x),
      y = Math.trunc(beam.y);
    if (inside(x, y)) visual.path.set(key(x, y), [x, y]);
  }
  // Laser shares the DOS projectile coordinates used by the Lobber history writer.
  game.sharedProjectilePosition = { x: beam.x, y: beam.y };
  for (const [x, y] of visual.path.values()) game.terrain.set(x, y, 0);
  game.terrain.version++;
  game.audio(new SoundSequence().stop());
  game.laserVisual = null;
  for (const player of game.players)
    if (player.alive && player.men === 0) game.recordDeath(player, shot.owner);
}
