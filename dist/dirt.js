import { SoundSequence, CPU_WRITE_MS } from './sound.js';

// Generic Borland Graph Circle, distinct from the custom explosion ellipse.
// EXE 0x12913..0x12a4e; see research/dirt-original.md.
export function bgiCircle(cx, cy, radius, write) {
  const r = Math.max(1, radius);
  let x = 0,
    y = r,
    dx = 0,
    dy = 200 * r,
    error = 0;
  const plot = () => {
    write(cx + x, cy + y);
    write(cx - x, cy + y);
    write(cx + x, cy - y);
    write(cx - x, cy - y);
  };
  while (dx < dy) {
    plot();
    const nx = dx + 100,
      ny = dy - 100;
    if (2 * error + 2 * nx >= ny) {
      y--;
      error -= ny;
      dy = ny - 100;
    }
    x++;
    error += nx;
    dx = nx + 100;
  }
  do {
    plot();
    const nx = dx + 100,
      ny = dy - 100;
    if (Math.floor(nx / 2) + error <= ny) {
      x++;
      error += nx;
      dx = nx + 100;
    }
    y--;
    error -= ny;
    dy = ny - 100;
  } while (y >= 0);
}

export function explosiveDirtPoints(x, y, rng) {
  const count = 300 + rng.int(100),
    layers = 3 + rng.int(8),
    points = [];
  const cx = 11 + Math.trunc(x - 11),
    cy = 31 + Math.trunc(y - 31);
  for (let layer = 1; layer <= layers; layer++) {
    for (let i = 0; i < count; i++) {
      const height = rng.int(20 * layer);
      const offset = Math.trunc(rng.int(height + 1) - height / 2);
      points.push([cx + offset, cy - height + 2, layer]);
    }
  }
  return points;
}

// These DOS drawing loops contain no Delay. Yielding makes their write order
// visible in a browser; the presentation rate is not a recovered CPU speed.
export function* dirtEffect(game, shot) {
  const { x, y, weapon } = shot;
  if (weapon <= 16) {
    const cx = 11 + Math.trunc(x - 11),
      cy = 31 + Math.trunc(y - 31);
    for (let radius = 0; radius <= game.weapons[weapon].radius; radius++) {
      for (const offset of [1, -1, 0])
        bgiCircle(cx + offset, cy, radius, (px, py) => game.terrain.set(px, py, 1));
      game.terrain.version++;
      yield 1 / 240;
    }
    return;
  }
  // All coordinates precede the first sound RNG call, even for clipped writes.
  const points = explosiveDirtPoints(x, y, game.rng);
  for (let first = 0; first < points.length; first += 64) {
    const tones = new SoundSequence();
    for (const [px, py, layer] of points.slice(first, first + 64)) {
      game.terrain.set(px, py, 1);
      if (game.options.sound) tones.tone(100 * layer + game.rng.int(200), CPU_WRITE_MS);
    }
    if (game.options.sound) game.audio(tones);
    game.terrain.version++;
    yield 1 / 120;
  }
  game.audio(new SoundSequence().stop());
  // This extra collapse precedes the independent ordinary settlement gate.
  if (game.rng.next() * 100 < 2 * game.options.crumble)
    for (const moved of game.terrain.crumbleFrames(game.players)) {
      if (moved) yield 1 / 120;
    }
}
