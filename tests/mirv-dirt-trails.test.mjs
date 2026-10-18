import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Game, Terrain, tankPixel } from '../dist/engine.js';
import { bgiCircle, dirtEffect } from '../dist/dirt.js';
import {
  integrateMirv,
  mirvSpread,
  mirvSubdivisions,
  mirvWall,
  mirvCollision,
  mirvEffect,
} from '../dist/mirv.js';
const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const dirt = read('./fixtures/dirt-oracle.json'),
  mirv = read('./fixtures/mirv-oracle.json');
const weapons = read('../dist/assets/weapons.json').weapons;
const hash = (data) => createHash('sha256').update(data).digest('hex');
function scene(options = {}) {
  const g = new Game(weapons, { sound: false, wind: 0, crumble: 0, ...options }, 42);
  g.start([{ name: 'A' }, { name: 'B' }]);
  g.falling = null;
  g.wind = 0;
  g.wall = 0;
  g.terrain.data.fill(0);
  g.players.forEach((p, i) => {
    p.x = 40 + i * 240;
    p.y = 170;
  });
  return g;
}
const shot = (extra) => ({ x: 160, y: 80, vx: 0, vy: 0, owner: 0, weapon: 7, trail: [], ...extra });
const drain = (iterator) => {
  for (const delay of iterator) assert.ok(delay > 0);
};

test('MIRV integration, spreads, subdivision schedule and walls match 97 original-code cases', () => {
  for (const row of mirv.integration) {
    const s = { ...row };
    integrateMirv(s, row.wind, row.subdivisions);
    for (const [key, value] of Object.entries(row.expected))
      assert.ok(Math.abs(s[key] - value) < 1e-8, `${key}: ${s[key]} vs ${value}`);
  }
  for (const row of mirv.spreads) {
    let call = 0;
    const actual = row.expected.map((_, index) => {
      const [vx, vy] = mirvSpread(row.mode, index, { next: () => row.random[call++] });
      return { ...row.source, vx: row.source.vx + vx, vy: row.source.vy + vy };
    });
    assert.deepEqual(actual, row.expected);
  }
  for (const row of mirv.subdivisions)
    assert.equal(mirvSubdivisions(row.alive, row.configured), row.expected);
  for (const row of mirv.walls) {
    const s = { ...row, pixelX: Math.trunc(row.x), pixelY: Math.trunc(row.y) };
    const stopped = mirvWall(s, row.wall, row.wind);
    assert.equal(stopped, row.expected.stopped);
    for (const key of ['x', 'y', 'vx', 'vy'])
      assert.ok(Math.abs(s[key] - row.expected[key]) < 1e-8);
  }
});
test('MIRV five-pixel collision order matches nine original-code cases, including zero MEN', () => {
  for (const row of mirv.collisions) {
    const colorAt = (x, y) => row.pixels.find((p) => p[0] === x && p[1] === y)?.[2] ?? 0;
    const g = {
      players: [{ id: 0, alive: true, men: row.men ?? 100 }],
      terrain: { solid: (x, y) => colorAt(x, y) === 2 },
    };
    const result = mirvCollision(
      g,
      { pixelX: row.x, pixelY: row.y },
      (_, x, y) => colorAt(x, y) === 20,
    );
    assert.deepEqual(result, { color: row.expected.color, stopped: row.expected.stopped });
  }
});
test('BGI Circle matches all 61 original framebuffer hashes', () => {
  for (const row of dirt.circles) {
    const pixels = new Uint8Array(64000);
    bgiCircle(160, 100, row.radius, (x, y) => {
      pixels[y * 320 + x] = 2;
    });
    assert.equal(hash(pixels), row.sha256, `radius ${row.radius}`);
  }
});
test('all four dirt balls match 12 original full and clipped disk hashes', () => {
  for (const row of dirt.disks) {
    const g = scene();
    drain(
      dirtEffect(
        g,
        shot({
          x: row.x,
          y: row.y,
          weapon: weapons.findIndex((w, i) => i >= 13 && i <= 16 && w.radius === row.radius),
        }),
      ),
    );
    assert.equal(hash(g.terrain.data.map((v) => v * 2)), row.sha256);
    assert.equal(g.explosions.length, 0);
  }
});
test('Explosive Dirt matches 8779 coordinates, sound order, RNG consumption and strict crumble gate', () => {
  for (const row of dirt.explosive) {
    const g = scene({ sound: row.sound, crumble: row.crumble });
    let calls = 0,
      rolls = 0;
    const points = [],
      tones = [],
      stops = [],
      crumbles = [];
    g.rng = {
      int: (n) => (calls++ * 13 + row.randomSalt) % n,
      next: () => {
        rolls++;
        return row.roll;
      },
    };
    const set = g.terrain.set.bind(g.terrain);
    g.terrain.set = (x, y, v) => {
      points.push([x, y]);
      set(x, y, v);
    };
    g.terrain.crumbleFrames = function* () {
      crumbles.push(points.length);
    };
    g.audio = (sequence) =>
      sequence.events.forEach(([, hz]) =>
        hz === null ? stops.push(points.length) : tones.push(hz),
      );
    drain(dirtEffect(g, shot({ weapon: 17, x: row.x, y: row.y })));
    assert.deepEqual(points, row.points);
    assert.equal(calls, row.randomCalls);
    assert.equal(rolls, 1);
    assert.deepEqual(stops, row.stopAtPoint);
    assert.deepEqual(crumbles, row.crumbleAtPoint);
    const bytes = Buffer.alloc(tones.length * 2);
    tones.forEach((hz, i) => bytes.writeUInt16LE(hz, i * 2));
    assert.equal(hash(bytes), row.tonesSha256);
    assert.equal(hash(g.terrain.data.map((v) => v * 2)), row.raster.sha256);
  }
});
test('dirt draws over multiple updates and blocks settlement until its final frame', () => {
  const g = scene();
  g.phase = 'flight';
  g.impact(shot({ weapon: 16 }));
  g.update(1 / 1000);
  const early = g.terrain.data.reduce((a, b) => a + b, 0);
  assert.ok(early > 0 && early < 20);
  assert.equal(g.phase, 'flight');
  for (let i = 0; i < 40 && g.effectAnimation; i++) g.update(1 / 60);
  assert.equal(g.effectAnimation, null);
  assert.ok(g.terrain.data.reduce((a, b) => a + b, 0) > 10000);
});
test('MIRV parent also splits on terrain, and first child sweep retains ten subdivisions', () => {
  const g = scene({ visible: false, trail: false, mirvSpread: 1, mirvDetonation: 2 });
  g.terrain.set(160, 80, 1);
  const parent = shot({ vy: -1 });
  g.shots = [parent];
  const effect = mirvEffect(g, parent, tankPixel);
  effect.next();
  assert.equal(g.shots.length, 5);
  assert.equal(g.explosions.length, 0);
  const child = g.shots[0],
    x = child.x,
    vx = child.vx;
  effect.next();
  assert.equal(child.x, x + vx / 10);
});
test('MIRV Impact freezes remaining children during each blocking blast; delayed mode waits for all', () => {
  for (const mode of [0, 1, 2]) {
    const g = scene({ mirvSpread: 1, mirvDetonation: mode, visible: false });
    for (let x = 11; x <= 309; x++) for (let y = 95; y <= 189; y++) g.terrain.set(x, y, 1);
    const parent = shot();
    g.shots = [parent];
    const effect = mirvEffect(g, parent, tankPixel);
    let blasts = 0,
      damage = 0,
      firstPending;
    const explode = g.explode.bind(g);
    g.explode = (...args) => {
      assert.equal(g.explosions.length, 0);
      firstPending ??= g.shots.length;
      blasts++;
      explode(...args);
    };
    const hurt = g.hurt.bind(g);
    g.hurt = (...args) => {
      assert.equal(g.explosions.length, 0);
      damage++;
      hurt(...args);
    };
    let steps = 0;
    while (++steps < 50000) {
      const before = g.explosions.length ? g.shots.map((s) => [s.x, s.y]) : null;
      const result = effect.next();
      if (before)
        assert.deepEqual(
          g.shots.map((s) => [s.x, s.y]),
          before,
        );
      if (result.done) break;
    }
    assert.ok(steps < 50000);
    assert.equal(blasts, mode === 2 ? 0 : 5);
    if (mode === 0) assert.equal(firstPending, 4);
    if (mode === 1) assert.equal(firstPending, 0);
  }
});
test('MIRV and dirt final state is independent of 30/60/144 Hz rendering', () => {
  for (const weapon of [7, 13, 16, 17]) {
    const results = [30, 60, 144].map((rate) => {
      const g = scene({ mirvSpread: 3, mirvDetonation: 0 });
      g.phase = 'flight';
      const s = shot({ weapon });
      g.effectAnimation = weapon === 7 ? mirvEffect(g, s, tankPixel) : dirtEffect(g, s);
      g.effectWait = 0;
      let frames = 0;
      while (g.effectAnimation && frames++ < 10000) g.update(1 / rate);
      assert.ok(frames < 10000);
      return [hash(g.terrain.data), hash(g.trailPixels), g.rng.state, g.players.map((p) => p.men)];
    });
    assert.deepEqual(results[0], results[1]);
    assert.deepEqual(results[0], results[2]);
  }
});
test('trails persist across firing, toggles and save/restore; background replacement clears them', () => {
  const g = scene(),
    s = shot();
  g.recordTrail(s, 120, 80);
  g.current.weapon = 1;
  g.current.ammo[1] = 10;
  g.phase = 'aim';
  g.fire();
  assert.equal(g.trailPixels[80 * 320 + 120], 1);
  g.options.trail = false;
  g.recordTrail(s, 121, 80);
  assert.equal(g.trailPixels[80 * 320 + 121], 0);
  g.phase = 'aim';
  const restored = Game.restore(g.serialize(), weapons);
  assert.equal(restored.trailPixels[80 * 320 + 120], 1);
  g.setBackground(0);
  assert.ok(g.trailPixels.every((v) => v === 0));
});
test('projectile restoration clears its old cross before collision even without trails', () => {
  const g = scene({ trail: false, visible: true });
  for (const [x, y] of [
    [159, 80],
    [160, 79],
    [160, 80],
    [160, 81],
    [161, 80],
  ])
    g.terrain.set(x, y, 1);
  const s = shot({ weapon: 1, power: 200, previousPixel: [160, 80] });
  assert.equal(g.stepShot(s, 0.1), null);
  assert.equal(g.terrain.solid(160, 80), false);
  assert.ok(g.trailPixels.every((v) => v === 0));
});

test('Explosive Dirt immediate collapse does not consume or suppress the later settlement gate', () => {
  const g = scene({ crumble: 25 });
  let rolls = 0,
    collapses = 0;
  g.rng = {
    int: () => 0,
    next: () => {
      rolls++;
      return rolls === 1 ? 0.1 : 0.9;
    },
  };
  g.terrain.crumbleFrames = function* () {
    collapses++;
  };
  drain(dirtEffect(g, shot({ weapon: 17 })));
  assert.equal(rolls, 1);
  assert.equal(collapses, 1);
  g.resolveTerrain();
  assert.equal(rolls, 2);
  assert.equal(collapses, 1);
});
