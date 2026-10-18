import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game, tankPixel } from '../dist/engine.js';
import { runtimeCos, runtimeSin } from '../dist/runtime-trig.js';
import { Renderer } from '../dist/render.js';
import { TRAIL_COLORS } from '../dist/palette.js';
const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
function scene() {
  const g = new Game(
    read('../dist/assets/weapons.json').weapons,
    { sound: false, wind: 0, walls: 0 },
    12,
  );
  g.start([{ name: 'A' }, { name: 'B' }]);
  g.falling = null;
  g.terrain.data.fill(0);
  g.players.forEach((p, i) => {
    p.x = 50 + i * 50;
    p.y = 100;
    p.angle = 90;
  });
  g.wind = 0;
  return g;
}
function shot(overrides = {}) {
  return {
    x: 80,
    y: 80,
    vx: 0,
    vy: 0,
    age: 0,
    weapon: 1,
    owner: 0,
    power: 1000,
    guidance: 0,
    trail: [],
    ...overrides,
  };
}
test('runtime trigonometry matches 181 executions of original degree conversion and trig', () => {
  for (const row of read('./fixtures/runtime-trig-oracle.json')) {
    assert.equal(runtimeCos(row.angle), row.cos);
    assert.equal(runtimeSin(row.angle), row.sin);
  }
  const tank = { x: 50, y: 100, angle: 0 };
  assert.equal(tankPixel(tank, 57, 100), true);
  assert.equal(tankPixel(tank, 58, 100), false);
  assert.equal(runtimeSin(30), 0.5);
});
test('guidance caches collision pixel before its half-pixel correction', () => {
  const g = scene();
  const s = shot({ x: 100, y: 90.75, guidance: 2, target: 1 });
  g.terrain.set(100, 92, 1);
  assert.equal(g.stepShot(s, 0.1), null);
  assert.equal(s.pixelY, 90);
  assert.equal(s.y, 91.25);
  assert.equal(s.color, '#ff0000');
});
test('high-power dirt sample preserves an earlier tank hit in the five-pixel cross', () => {
  const g = scene();
  g.terrain.set(106, 100, 1);
  const s = shot({ x: 105, y: 100 });
  assert.equal(g.stepShot(s, 0.1), 'hit');
  assert.equal(s.collisionColor, 2);
});
test('accelerating shots impact at speed over 30 and dirt weapons bounce blue', () => {
  const g = scene();
  assert.equal(g.stepShot(shot({ vx: 30.1 }), 0.1), 'hit');
  const s = shot({ x: 105, y: 100, weapon: 13, vy: 1 });
  assert.equal(g.stepShot(s, 0.1), null);
  assert.ok(s.vy < 0);
  assert.equal(s.color, '#0000ff');
});
test('ordinary flight and trail sampling are independent of browser refresh rate', () => {
  const results = [30, 60, 144].map((rate) => {
    const g = scene();
    g.shots = [shot({ vx: 0.1 })];
    for (let frame = 0; frame < rate / 6; frame++) g.updateProjectiles(1 / rate);
    const s = g.shots[0];
    return { x: s.x, y: s.y, trail: s.trail };
  });
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[0], results[2]);
  assert.equal(results[0].trail.length, 100);
});
test('renderer paints the cached five-pixel cross, dim trail and four border markers', () => {
  const g = scene();
  g.shots = [
    shot({ x: 80, y: 80.75, pixelX: 80, pixelY: 80, color: '#ff0000', trail: [[79, 80]] }),
  ];
  g.recordTrail(g.shots[0], 79, 80);
  const pixels = [];
  const renderer = {
    paintBackground() {},
    tank() {},
    battleHUD() {},
    rect(...args) {
      pixels.push(args);
    },
    ctx: { fillRect() {}, save() {}, beginPath() {}, rect() {}, clip() {}, restore() {} },
  };
  Renderer.prototype.battle.call(renderer, { game: g });
  assert.deepEqual(
    pixels.filter((p) => p[4] === '#ff0000').map((p) => p.slice(0, 2)),
    [
      [80, 80],
      [79, 80],
      [81, 80],
      [80, 79],
      [80, 81],
    ],
  );
  assert.deepEqual(
    pixels.filter((p) => p[4] === '#ff55ff').map((p) => p.slice(0, 2)),
    [
      [80, 29],
      [80, 191],
      [9, 80],
      [311, 80],
    ],
  );
  assert.ok(pixels.some((p) => p[0] === 79 && p[1] === 80 && p[4] === TRAIL_COLORS[0]));
});

test('new dirt covers saved trails; clearing terrain reveals them even with Trail disabled', () => {
  const g = scene();
  g.recordTrail(shot(), 120, 80);
  g.options.trail = false;
  const paints = [];
  const renderer = {
    paintBackground() {},
    tank() {},
    battleHUD() {},
    rect(x, y, w, h, color) {
      paints.push({ x, y, w, h, color });
    },
    ctx: {
      fillRect(x, y, w, h) {
        paints.push({ x, y, w, h, color: this.fillStyle });
      },
      save() {},
      beginPath() {},
      rect() {},
      clip() {},
      restore() {},
    },
  };
  const colorAt = () =>
    paints.filter((p) => p.x <= 120 && p.x + p.w > 120 && p.y <= 80 && p.y + p.h > 80).at(-1)
      ?.color;
  g.terrain.set(120, 80, 1);
  Renderer.prototype.battle.call(renderer, { game: g });
  assert.equal(colorAt(), '#00aa00');
  paints.length = 0;
  g.terrain.set(120, 80, 0);
  Renderer.prototype.battle.call(renderer, { game: g });
  assert.equal(colorAt(), TRAIL_COLORS[0]);
});
