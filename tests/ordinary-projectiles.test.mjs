import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Game, integrate, wallBounce } from '../dist/engine.js';
import {
  advanceShotCounter,
  ordinaryCollision,
  ordinaryOpenWall,
  ordinaryFlightEnd,
} from '../dist/projectile.js';
const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const oracle = read('./fixtures/ordinary-oracle.json');
const crossOracle = read('./fixtures/projectile-collision-oracle.json');
const weapons = read('../dist/assets/weapons.json').weapons;
function scene(count = 2, options = {}) {
  const g = new Game(weapons, { sound: false, wind: 0, walls: 0, crumble: 0, ...options }, 42);
  g.start(Array.from({ length: count }, (_, i) => ({ name: `Player ${i}` })));
  g.falling = null;
  g.phase = 'flight';
  g.terrain.data.fill(0);
  g.wind = 0;
  g.wall = 0;
  g.players.forEach((p, i) => {
    p.x = 20 + i * 25;
    p.y = 170;
  });
  return g;
}
const shot = (extra) => ({
  x: 160,
  y: 80,
  vx: 0,
  vy: 0,
  age: 0,
  owner: 0,
  weapon: 1,
  power: 1000,
  threshold: 943,
  guidance: 0,
  trail: [],
  collisionColor: 0,
  ...extra,
});
const close = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} vs ${expected}`);

test('ordinary counter starts at player count and matches 25 original sequences', () => {
  for (const row of oracle.counters) {
    const s = { subdivisions: row.subdivisions };
    for (const expected of row.expected.steps) {
      advanceShotCounter(s, row.players);
      assert.deepEqual({ substep: s.substep, groups: s.groups }, expected);
    }
  }
});
test('ordinary integration matches 15 original Pascal Real cases', () => {
  for (const row of oracle.integration) {
    const s = { ...row, age: 0 };
    integrate(s, row.wind, 1 / row.subdivisions);
    for (const key of ['x', 'y', 'vx', 'vy']) close(s[key], row.expected[key], key);
    assert.equal(Math.trunc(s.x) || 0, row.expected.pixelX);
    assert.equal(Math.trunc(s.y) || 0, row.expected.pixelY);
  }
});
test('ordinary collision matches 262 original cross scans including power thresholds and repeated bounces', () => {
  for (const [rows, defaultVy] of [
    [oracle.collisions, 2],
    [crossOracle, 2.5],
  ])
    for (const row of rows) {
      const colorAt = (x, y) => row.pixels.find((p) => p[0] === x && p[1] === y)?.[2] ?? 0;
      const g = {
        players: Array.from({ length: 10 }, (_, id) => ({ id, alive: true, men: 100 })),
        terrain: { solid: (x, y) => colorAt(x, y) === 2 },
      };
      const s = shot({
        pixelX: row.x ?? 100,
        pixelY: row.y ?? 100,
        weapon: row.weapon ?? 1,
        power: row.power,
        threshold: row.threshold ?? 943,
        substep: row.substep,
        subdivisions: row.subdivisions ?? 10,
        vy: row.vy ?? defaultVy,
        guidance: row.guidance ?? 3,
        collisionColor: row.previousColor ?? row.priorColor ?? 0,
      });
      const inside = s.pixelX > 11 && s.pixelX < 309 && s.pixelY > 33 && s.pixelY < 187;
      const stopped = inside
        ? ordinaryCollision(g, s, (p, x, y) => colorAt(x, y) === 20 + p.id)
        : false;
      assert.equal(stopped, row.expected.stopped, JSON.stringify(row));
      assert.equal(s.collisionColor, row.expected.color, JSON.stringify(row));
      close(s.vy, row.expected.vy, 'bounce vy');
      assert.equal(s.guidance, row.expected.guidance);
      assert.equal(s.color === '#0000ff', row.expected.palettes.length > 0);
    }
});
test('ordinary boundary handling matches 102 original wall, exit and timeout cases', () => {
  for (const row of oracle.boundaries) {
    const s = shot({ ...row, pixelX: Math.trunc(row.x), pixelY: Math.trunc(row.y) });
    wallBounce(s, row.wall);
    if (row.wall === 0) ordinaryOpenWall(s, row.wind);
    const event = ordinaryFlightEnd(s, row.wall, false);
    for (const key of ['x', 'y', 'vx', 'vy']) close(s[key], row.expected[key], JSON.stringify(row));
    assert.equal(s.pixelX, row.expected.pixelX);
    assert.equal(s.pixelY, row.expected.pixelY);
    assert.equal(
      event,
      row.expected.stopped ? (row.expected.impact ? 'hit' : 'gone') : null,
      JSON.stringify(row),
    );
  }
});
test('powerful soil impacts use initial roster size, including ten-player wrap to zero', () => {
  for (const [players, power, expected] of [
    [2, 942, 1],
    [2, 944, 8],
    [3, 944, 7],
    [9, 1000, 1],
    [10, 1000, 11],
  ]) {
    const g = scene(players, { visible: false, trail: false });
    g.terrain.data.fill(1);
    const s = shot({ power });
    let steps = 0,
      event;
    do {
      event = g.stepShot(s, 0.1);
      steps++;
    } while (!event && steps < 30);
    assert.equal(steps, expected);
    assert.equal(event, 'hit');
  }
  const g = scene(2, { visible: false, trail: false });
  g.terrain.data.fill(1);
  const s = shot({ power: 943 });
  for (let n = 0; n < 25; n++) assert.equal(g.stepShot(s, 0.1), null);
});
test('threshold is captured before firing self-damage, not recomputed during flight', () => {
  const g = scene();
  g.phase = 'aim';
  const p = g.current;
  p.men = 100;
  p.power = 944;
  p.weapon = 1;
  p.ammo[1] = 10;
  g.rng.next = () => 0;
  g.fire();
  assert.equal(p.men, 99);
  assert.equal(g.shots[0].threshold, 943);
  assert.equal(g.shots[0].substep, g.players.length);
});
test('last classified dirt suppresses direct damage even when the shot center overlaps a tank', () => {
  const g = scene(),
    p = g.players[1];
  const calls = [];
  g.hurt = (target, n) => calls.push([target.id, n]);
  g.impact(shot({ x: p.x, y: p.y, collisionColor: 2 }));
  assert.equal(calls.length, 0);
  g.updateExplosions(10);
  assert.equal(calls.filter(([, n]) => n === 200).length, 0);
});
test('direct explosive damage follows the complete blast and radial damage', () => {
  const g = scene(),
    p = g.players[1];
  p.defense[0] = 1000;
  const calls = [],
    hurt = g.hurt.bind(g);
  g.hurt = (target, n, ...args) => {
    calls.push([target.id, n]);
    hurt(target, n, ...args);
  };
  g.impact(shot({ x: p.x, y: p.y, collisionColor: 21 }));
  assert.equal(calls.length, 0);
  const duration = g.explosions[0].duration;
  g.updateExplosions(duration / 2);
  assert.equal(calls.length, 0);
  g.updateExplosions(duration);
  assert.deepEqual(calls.at(-1), [1, 200]);
  assert.ok(calls.some(([id, n]) => id === 1 && n > 200));
});
test('lead and chain-reaction impacts use classified color, never center fallback', () => {
  for (const weapon of [0, 6, 8, 9, 10])
    for (const color of [0, 2, 21]) {
      const g = scene(),
        p = g.players[1],
        calls = [];
      g.hurt = (target, n) => calls.push([target.id, n]);
      g.impact(shot({ x: p.x, y: p.y, weapon, collisionColor: color }));
      assert.equal(calls.length, color === 21 ? 1 : 0);
      assert.equal(!!g.reaction, weapon !== 0 && color === 2);
      if (weapon === 0 && color === 21) assert.deepEqual(calls, [[1, 5]]);
    }
});
test('high-power impacts and trail destruction agree at 30, 60 and 144 Hz', () => {
  const results = [30, 60, 144].map((rate) => {
    const g = scene();
    for (let x = 150; x < 175; x++) for (let y = 60; y < 130; y++) g.terrain.set(x, y, 1);
    g.shots = [shot({ x: 140, vx: 20, vy: 0 })];
    let frames = 0;
    while (g.shots.length && frames++ < rate * 10) g.updateProjectiles(1 / rate);
    assert.equal(g.shots.length, 0);
    return {
      endpoint: g.players[0].lob.at(-1),
      trails: createHash('sha256').update(g.trailPixels).digest('hex'),
      explosions: g.explosions.map((e) => [e.x, e.y, e.max]),
    };
  });
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[0], results[2]);
});

test('original damage helper keeps power920 after MEN92 becomes91; threshold919 still permits penetration', () => {
  const g = scene(2, { visible: false, trail: false });
  g.phase = 'aim';
  const p = g.current;
  p.men = 92;
  p.power = 920;
  p.weapon = 1;
  p.ammo[1] = 1;
  g.rng.next = () => 0;
  g.fire();
  const s = g.shots[0];
  assert.equal(p.men, 91);
  assert.equal(p.power, 920);
  assert.equal(s.threshold, 919);
  assert.equal(s.power, 920);
  g.terrain.data.fill(1);
  s.x = 160;
  s.y = 80;
  s.vx = 0;
  s.vy = 0;
  assert.equal(g.stepShot(s, 0.1), null);
  assert.equal(s.substep, 3);
  g.phase = 'aim';
  g.setPower(920);
  assert.equal(p.power, 910);
});
