import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game, Terrain, BOTTOM, CRUMBLE_STEP_SECONDS } from '../dist/engine.js';

const { weapons } = JSON.parse(
  fs.readFileSync(new URL('../dist/assets/weapons.json', import.meta.url)),
);
function battle(options = {}) {
  const game = new Game(weapons, { sound: false, wind: 0, crumble: 100, ...options }, 214);
  game.start([{ name: 'A' }, { name: 'B' }]);
  while (game.falling) game.update(1 / 60);
  game.terrain.data.fill(0);
  game.players.forEach((player, index) => {
    player.x = 40 + index * 240;
    player.y = BOTTOM;
  });
  game.phase = 'flight';
  return game;
}

test('collapse exposes each descending pixel pass and conserves dirt', () => {
  const terrain = new Terrain();
  terrain.set(100, 100, 1);
  terrain.set(100, 101, 1);
  terrain.set(100, 106, 1);
  for (let y = 110; y <= BOTTOM; y++) terrain.set(100, y, 1);
  const count = terrain.data.reduce((sum, pixel) => sum + pixel, 0);
  const passes = terrain.crumbleFrames();
  assert.equal(passes.next().done, false);
  assert.equal(terrain.solid(100, 100), false);
  assert.equal(terrain.solid(100, 101), true);
  assert.equal(terrain.solid(100, 102), true);
  assert.equal(terrain.solid(100, 107), true);
  for (const _ of passes)
    assert.equal(
      terrain.data.reduce((sum, pixel) => sum + pixel, 0),
      count,
    );
  for (let y = 107; y <= BOTTOM; y++) assert.ok(terrain.solid(100, y));
});

test('dirt stops on the tank barrel instead of falling through it', () => {
  const terrain = new Terrain();
  terrain.set(100, 80, 1);
  terrain.crumble([{ x: 100, y: 100, angle: 90, alive: true }]);
  assert.ok(terrain.solid(100, 91));
  assert.equal(
    terrain.data.reduce((sum, value) => sum + value, 0),
    1,
  );
});

test('game blocks shots and turn advance until visible collapse completes at any refresh rate', () => {
  const snapshots = [];
  for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
    const game = battle({ tanksFall: false });
    game.terrain.set(160, 60, 1);
    const owner = game.active;
    game.update(dt);
    assert.ok(game.crumbling);
    game.update(CRUMBLE_STEP_SECONDS);
    assert.ok(game.terrain.solid(160, 61));
    assert.equal(game.fire(), false);
    assert.equal(game.active, owner);
    let elapsed = CRUMBLE_STEP_SECONDS;
    while (game.phase === 'flight' && elapsed < 3) {
      game.update(dt);
      elapsed += dt;
    }
    assert.equal(game.phase, 'aim');
    assert.ok(game.terrain.solid(160, BOTTOM));
    assert.notEqual(game.active, owner);
    snapshots.push({ pixels: game.terrain.data, rng: game.rng.state });
  }
  assert.deepEqual(snapshots[0], snapshots[1]);
  assert.deepEqual(snapshots[1], snapshots[2]);
});

test('round placement preserves a steep natural slope without building pedestals', () => {
  const game = new Game(weapons, { players: 5, sound: false, wind: 0 }, 47);
  let original;
  game.terrain.generate = function () {
    this.data.fill(0);
    for (let x = 11; x <= 309; x++)
      for (let y = 50 + Math.floor(x / 3); y <= BOTTOM; y++) this.set(x, y, 1);
    original = this.data.slice();
  };
  game.start(Array.from({ length: 5 }, (_, index) => ({ name: String(index) })));
  while (game.falling) game.update(1 / 60);
  assert.deepEqual(game.terrain.data, original, 'landing must not add a single dirt pixel');
  const ordered = [...game.players].sort((a, b) => a.x - b.x);
  assert.deepEqual(
    ordered.map((player) => player.angle),
    [75, 90, 90, 90, 105],
  );
  for (const player of ordered) assert.equal(player.y, game.terrain.surface(player.x - 4) - 1);
});

test('an unsupported tank slides off an outer edge and clears its old body footprint', () => {
  const game = battle({ crumble: 0 });
  const player = game.current;
  player.x = 100;
  player.y = 80;
  player.defense[1] = 1000;
  for (let x = 11; x <= 309; x++) for (let y = 100; y <= BOTTOM; y++) game.terrain.set(x, y, 1);
  game.terrain.set(104, 82, 1);
  game.terrain.set(100, 78, 1);
  game.beginFalling();
  game.update(0.005);
  assert.equal(player.y, 81);
  assert.equal(player.x, 99);
  assert.equal(game.terrain.solid(100, 78), false);
  while (game.falling) game.update(1 / 60);
  assert.equal(player.y, 99);
  assert.equal(player.men, 100);
  assert.ok(player.defense[1] < 1000);
});

test('successive dirt frames match independent original-machine-code fixtures', () => {
  const oracle = JSON.parse(
    fs.readFileSync(new URL('./fixtures/crumble-oracle.json', import.meta.url)),
  );
  for (const fixture of oracle.fixtures.filter((scene) => scene.blockers.length === 0)) {
    const terrain = new Terrain();
    fixture.dirt.forEach(([x, y]) => terrain.set(x, y, 1));
    const actual = [];
    for (const _ of terrain.crumbleFrames()) {
      const pixels = [];
      for (let y = 31; y <= BOTTOM; y++)
        for (let x = 11; x <= 309; x++) if (terrain.solid(x, y)) pixels.push([x, y]);
      actual.push(pixels);
    }
    assert.deepEqual(actual, fixture.sweeps, fixture.name);
  }
});
