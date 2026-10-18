import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game, tankPixel, tankBodyPixel } from '../dist/engine.js';
import { laserWall, laserEffect, laserIntensity } from '../dist/laser.js';
import { lightningEffect, lightningDue } from '../dist/lightning.js';
const read = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url)));
const weapons = read('../dist/assets/weapons.json').weapons;
function game() {
  const g = new Game(
    weapons,
    { sound: false, wind: 0, walls: 0, crumble: 0, tanksFall: false },
    38,
  );
  g.start([{ name: 'A' }, { name: 'B' }]);
  g.falling = null;
  g.terrain.data.fill(0);
  g.active = 0;
  g.players.forEach((p, i) => {
    p.x = 50 + i * 100;
    p.y = 100;
    p.angle = i ? 180 : 0;
  });
  g.phase = 'flight';
  g.rng.next = () => 1;
  return g;
}
test('laser wall handling equals all 70 original instruction oracle cases', () => {
  for (const fixture of read('./fixtures/laser-wall-oracle.json')) {
    const beam = { x: fixture.x, y: fixture.y, vx: fixture.vx, vy: fixture.vy };
    const done = laserWall(beam, fixture.wall);
    // JS negative zero is not a distinct Pascal Real velocity.
    Object.keys(beam).forEach((key) => {
      if (beam[key] === 0) beam[key] = 0;
    });
    assert.deepEqual({ ...beam, done }, fixture.expected);
  }
});
test('laser keeps charge animation when muted and spends selected energy below 100', () => {
  const g = game();
  g.phase = 'aim';
  const p = g.current;
  p.weapon = 5;
  p.ammo[5] = 1000;
  p.power = 20;
  assert.ok(g.fire());
  assert.equal(p.ammo[5], 980);
  g.update(0);
  g.update(0);
  assert.equal(g.laserVisual.charging, true);
  g.update(1.59);
  assert.equal(g.laserVisual.charging, true);
  assert.equal(g.players[1].men, 100);
  for (let i = 0; g.phase === 'flight' && i < 200; i++) g.update(0.01);
  assert.equal(g.phase, 'aim');
  assert.equal(g.laserVisual, null);
  assert.ok(g.trails.every((trail) => !trail.laser));
  assert.equal(laserIntensity(1000, 1000), 63);
  assert.equal(laserIntensity(0, 1000), 10);
});
test('laser shields absorb damage, count one hit per target and do not award damage score', () => {
  const g = game();
  g.players[1].defense[0] = 1000;
  const frames = laserEffect(g, { owner: 0 }, 200, tankPixel, tankBodyPixel);
  let duration = 0;
  for (const delay of frames) duration += delay;
  assert.ok(g.players[1].defense[0] < 1000);
  assert.equal(g.players[1].men, 100);
  assert.equal(g.players[0].hits, 1);
  assert.equal(g.players[0].score, 0);
  assert.ok(duration > 1.6 && duration < 3);
});
test('unshielded laser hits expose accumulating particles and additional explicit waits', () => {
  const g = game();
  g.players[1].x = 65;
  let duration = 0,
    particles = false;
  for (const delay of laserEffect(g, { owner: 0 }, 20, tankPixel, tankBodyPixel)) {
    duration += delay;
    particles ||= g.laserVisual.particles.length > 0;
  }
  assert.ok(particles);
  assert.ok(duration > 2);
  assert.ok(g.players[1].men < 100);
  assert.equal(g.players[0].hits, 1);
});
test('laser outcome and RNG do not depend on display refresh rate', () => {
  const results = [];
  for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
    const g = game();
    g.players[1].defense[0] = 12;
    g.laser({ owner: 0 }, 200);
    for (let i = 0; g.effectAnimation && i < 10000; i++) g.update(dt);
    assert.equal(g.effectAnimation, null);
    results.push({
      rng: g.rng.state,
      men: g.players[1].men,
      shield: g.players[1].defense[0],
      hits: g.players[0].hits,
      terrain: g.terrain.data,
    });
  }
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[1], results[2]);
});
test('all 3339 lightning coordinates and RNG draws match original machine code', () => {
  for (const fixture of read('./fixtures/lightning-oracle.json').paths) {
    let calls = 0,
      tones = 0,
      stops = 0,
      clears = 0;
    let finalBlast;
    const g = {
      players: [],
      options: { sound: fixture.sound },
      active: 0,
      weapons,
      rng: { int: (limit) => (calls++ * 13 + fixture.randomSalt) % limit },
      terrain: { version: 0, set: () => clears++ },
      audio: (sequence) =>
        sequence.events.forEach(([, tone]) => (tone === null ? stops++ : tones++)),
      explode: (...args) => {
        finalBlast = args;
      },
    };
    const paths = [];
    for (const _ of lightningEffect(g, tankPixel, fixture))
      if (g.lightningVisual) paths.push([...g.lightningVisual]);
    assert.deepEqual(paths, fixture.paths);
    assert.equal(calls, fixture.randomCalls);
    assert.equal(tones, fixture.soundCalls);
    assert.equal(stops, fixture.stopCalls);
    assert.equal(clears, fixture.restoredPixels);
    assert.equal(finalBlast[2], weapons[Math.trunc(fixture.passes / 3) || 11].radius);
  }
});
test('lightning gate matches all original comparisons including skipped RNG calls', () => {
  for (const fixture of read('./fixtures/lightning-oracle.json').triggers) {
    const calls = [];
    const rng = {
      int: (limit) => {
        calls.push(limit);
        return fixture.roll;
      },
    };
    assert.equal(
      lightningDue(fixture.roundCounter, fixture.deathThisPass, rng),
      fixture.strikes > 0,
    );
    assert.deepEqual(calls, fixture.randomLimits);
  }
});
test('lightning is a shielded center hit and a three-pixel terrain cut', () => {
  const g = game();
  g.players[0].x = 70;
  g.players[1].x = 100;
  g.players[1].defense[0] = 100;
  g.rng.int = (limit) => (limit === 7 ? 3 : 0);
  for (let y = 31; y <= 189; y++) for (let x = 99; x <= 101; x++) g.terrain.set(x, y, 1);
  for (const _ of lightningEffect(g, tankPixel, { xStart: 100, xEnd: 100 })) {
  }
  assert.ok(g.players[1].defense[0] < 100);
  assert.equal(g.players[1].men, 100);
  assert.equal(g.players[0].score, 0);
  assert.ok(!g.terrain.solid(99, 140) && !g.terrain.solid(100, 140) && !g.terrain.solid(101, 140));
  assert.equal(g.explosions[0].max, weapons[11].radius);
});
test('lightning counter advances on turn-order wrap and survives a save', () => {
  const g = game();
  g.order = [0, 1];
  g.active = 0;
  g.finishTurn();
  assert.equal(g.roundCycles, 1);
  g.finishTurn();
  assert.equal(g.roundCycles, 2);
  assert.equal(Game.restore(g.serialize(), weapons).roundCycles, 2);
});
