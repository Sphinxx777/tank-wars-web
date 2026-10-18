import test from 'node:test';
import { deathEffect } from '../dist/death.js';
import { tankPixel } from '../dist/engine.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  Game,
  Terrain,
  Random,
  launch,
  integrate,
  wallBounce,
  blastDamage,
  W,
  H,
  TOP,
  BOTTOM,
  LEFT,
  RIGHT,
} from '../dist/engine.js';
const catalog = JSON.parse(
  fs.readFileSync(new URL('../dist/assets/weapons.json', import.meta.url)),
);
const weapons = catalog.weapons;
function settleIntro(g) {
  for (let i = 0; g.falling && i < 2000; i++) g.update(1 / 60);
  assert.equal(g.falling, null);
  return g;
}
function game(options = {}, seed = 42) {
  const g = new Game(weapons, { crumble: 100, walls: 0, wind: 0, ...options }, seed);
  g.start([
    { name: 'A', ai: -1 },
    { name: 'B', ai: -1 },
  ]);
  return settleIntro(g);
}
function finish(g, limit = 20000) {
  for (let i = 0; i < limit && g.phase === 'flight'; i++) g.update(1 / 60);
  assert.notEqual(g.phase, 'flight', 'shot must terminate');
}
test('binary-derived ballistics: 100 Euler steps match closed discrete form', () => {
  const p = launch(20, 80, 200, 75),
    vx = p.vx,
    vy = p.vy,
    n = 100,
    dt = 0.1,
    wind = 50;
  for (let i = 0; i < n; i++) integrate(p, wind, dt);
  assert.ok(
    Math.abs(p.x - (20 + vx * n * dt + ((wind / 5000) * dt * dt * n * (n - 1)) / 2)) < 1e-9,
  );
  assert.ok(Math.abs(p.y - (80 + vy * n * dt + (0.1 * dt * dt * n * (n - 1)) / 2)) < 1e-9);
});
test('wall modes reflect both velocity components for sticky and accelerate', () => {
  for (const [wall, k] of [
    [1, 0.7071059999998397],
    [2, 1],
    [3, 1.4142100000008213],
  ]) {
    const p = { x: LEFT - 1, y: 60, vx: -4, vy: -2 };
    wallBounce(p, wall);
    assert.equal(p.vx, 4 * k);
    assert.equal(p.vy, -2 * k);
  }
  const p = { x: RIGHT + 1, y: 80, vx: 4, vy: 2 };
  wallBounce(p, 4);
  assert.equal(p.x, RIGHT + 1 - 300);
  assert.equal(p.vx, 4);
});
test('original blast thresholds and weapon radii', () => {
  assert.equal(blastDamage(0, 10), 214);
  assert.equal(blastDamage(10, 10), 8);
  assert.equal(blastDamage(16, 10), 0);
  assert.deepEqual(
    [1, 2, 3, 4, 11].map((i) => weapons[i].radius),
    [10, 15, 30, 60, 2],
  );
});
test('original initial ammunition and power; ammo persists between rounds', () => {
  const g = game({ rounds: 5 });
  for (const p of g.players) {
    assert.equal(p.men, 100);
    assert.equal(p.power, 200);
    assert.equal(p.ammo[0], 100);
    assert.equal(p.ammo[1], 15);
    assert.equal(p.ammo[11], 50);
  }
  g.current.ammo[1]--;
  const id = g.active;
  g.nextRound();
  assert.equal(g.players[id].ammo[1], 14);
});
test('terrain contains holes and crumbles while preserving dirt mass', () => {
  const t = new Terrain();
  for (let y = 100; y <= BOTTOM; y++) for (let x = LEFT; x <= RIGHT; x++) t.set(x, y, 1);
  t.circle(160, 140, 10, 0);
  assert.equal(t.solid(160, 140), false);
  assert.equal(t.solid(160, 100), true);
  const count = t.data.reduce((a, b) => a + b, 0);
  t.crumble();
  assert.equal(
    t.data.reduce((a, b) => a + b, 0),
    count,
  );
  assert.equal(t.solid(160, 140), true);
});
test('fixed seed yields same terrain and randomised position order', () => {
  const a = game({}, 12),
    b = game({}, 12);
  assert.deepEqual(a.terrain.data, b.terrain.data);
  assert.deepEqual(a.players, b.players);
  for (let x = LEFT; x <= RIGHT; x++) assert.ok(a.terrain.surface(x) <= BOTTOM + 1);
});
test('all 18 weapons finish, terrain stays in bounds, turn advances or round ends', () => {
  for (let id = 0; id < 18; id++) {
    const g = game({}, id + 500);
    const p = g.current;
    p.ammo[id] = id === 5 ? 1000 : 1;
    p.weapon = id;
    p.power = 200;
    p.angle = p.x < 160 ? 40 : 140;
    assert.equal(g.fire(), true);
    finish(g);
    assert.equal(g.terrain.data.length, W * H);
    for (const t of g.players) assert.ok(t.men >= 0 && t.men <= 100);
  }
});
test('MIRV produces five falling Mark II children', () => {
  const g = game();
  g.current.weapon = 7;
  g.current.ammo[7] = 1;
  g.current.angle = 90;
  g.current.power = 100;
  g.fire();
  let found = false;
  for (let i = 0; i < 400; i++) {
    g.update(1 / 60);
    if (g.shots.length === 5) {
      found = true;
      assert.ok(g.shots.every((s) => s.weapon === 2));
      break;
    }
  }
  assert.equal(found, true);
  finish(g);
});
test('CRI D visits diagonally connected dirt; ND does not', () => {
  for (const id of [9, 10]) {
    const g = game({ crumble: 0, tanksFall: false });
    g.terrain.data.fill(0);
    g.terrain.set(100, 101, 1);
    g.terrain.set(101, 102, 1);
    g.phase = 'flight';
    g.impact({ x: 100, y: 100, weapon: id, owner: g.active });
    for (let i = 0; i < 10 && g.reaction; i++) g.update(1 / 60);
    assert.equal(g.terrain.solid(101, 102), id === 9);
  }
});
test('repulser deflects without consuming its charge', () => {
  const g = game();
  const p = g.players[1];
  p.defense[2] = 1;
  const s = {
    ...launch(p.x - 15, p.y - 15, 100, 0),
    weapon: 1,
    owner: 0,
    guidance: -1,
    leftOrigin: true,
  };
  const vx = s.vx;
  g.stepShot(s, 0.1);
  assert.ok(s.vx < vx);
  assert.equal(p.defense[2], 1);
});
test('buying uses original prices/quantities, rejects insufficient funds', () => {
  const g = game(),
    p = g.current;
  p.money = 7000;
  const before = p.ammo[2];
  assert.equal(g.buy(p.id, 2), true);
  assert.equal(p.ammo[2], before + 10);
  assert.equal(p.money, 3000);
  assert.equal(g.buy(p.id, 4), false);
  assert.equal(g.buy(p.id, 0), false);
  assert.equal(g.buy(p.id, 1, -1), false);
});
test('save/load retains terrain, round, inventory, seed and active player', () => {
  const g = game();
  const saved = g.serialize(),
    restored = Game.restore(saved, weapons);
  assert.equal(restored.serialize(), saved);
  assert.throws(() => Game.restore('{"version":9}', weapons));
  g.fire();
  assert.throws(() => Game.restore(g.serialize(), weapons));
});
test('shields absorb damage then overflow, fall dampener independent', () => {
  const g = game(),
    p = g.players[1];
  p.defense = [20, 30, 0];
  g.hurt(p, 25, 0);
  assert.equal(p.men, 95);
  assert.equal(p.defense[0], 0);
  g.hurt(p, 20, 0, 'fall');
  assert.equal(p.men, 95);
  assert.equal(p.defense[1], 10);
});
test('full two-computer tournament round reaches score state', () => {
  const g = new Game(weapons, { rounds: 1, walls: 0, wind: 0, crumble: 100 }, 197);
  g.start([
    { name: 'A', ai: 6 },
    { name: 'B', ai: 6 },
  ]);
  for (let i = 0; i < 30000 && g.phase !== 'score'; i++) g.update(1 / 30);
  assert.equal(g.phase, 'score');
  assert.ok(g.players.some((p) => p.wins === 1));
});
test('every AI makes a finite legal shot at low health in all wall modes', () => {
  for (let ai = 0; ai < 7; ai++)
    for (let wall = 0; wall < 5; wall++) {
      const g = game({ walls: wall, wind: 2 }, 100 + ai * 5 + wall),
        p = g.current;
      p.ai = ai;
      p.men = 17;
      g.aimAI(p);
      assert.ok(Number.isFinite(p.angle) && p.angle >= 0 && p.angle <= 180);
      assert.ok(Number.isFinite(p.power) && p.power >= 0 && p.power <= 170);
      assert.ok(p.ammo[p.weapon] > 0);
    }
});
test('Lobber first plans use original 75 degree elevation and two power ranges', () => {
  const g = game(),
    p = g.current;
  p.ai = 1;
  g.aimAI(p);
  assert.ok([75, 105].includes(p.angle));
  assert.ok(p.power >= 100 && p.power <= 199);
  p.lob.push({ x: 150, y: 150, power: p.power });
  g.aimAI(p);
  assert.ok([75, 105].includes(p.angle));
  assert.ok(p.power >= 200 && p.power <= 399);
});
test('all MIRV spread and detonation combinations terminate', () => {
  for (let spread = 0; spread < 5; spread++)
    for (let mode = 0; mode < 3; mode++) {
      const g = game({ mirvSpread: spread, mirvDetonation: mode }),
        p = g.current;
      p.weapon = 7;
      p.ammo[7] = 1;
      p.angle = 90;
      p.power = 100;
      g.fire();
      finish(g);
      assert.equal(p.ammo[7], 0);
    }
});
test('dirt weapons do not apply direct explosive damage', () => {
  for (let id = 13; id <= 17; id++) {
    const g = game({ tanksFall: false, crumble: 0 }),
      p = g.players[1];
    g.phase = 'flight';
    g.impact({ x: p.x, y: p.y, weapon: id, owner: 0 });
    finish(g);
    assert.equal(p.men, 100);
  }
});
test('ten-player team round rewards the full winning team', () => {
  const g = new Game(weapons, { teams: true, rounds: 2 }, 44);
  g.start(Array.from({ length: 10 }, (_, i) => ({ name: String(i), ai: -1, team: i % 2 })));
  settleIntro(g);
  for (const p of g.players)
    if (p.team === 1) {
      p.alive = false;
      p.men = 0;
    }
  g.finishTurn();
  assert.equal(g.phase, 'score');
  assert.ok(g.players.filter((p) => p.team === 0).every((p) => p.score === 2000 && p.wins === 1));
  assert.equal(new Set(g.order).size, 10);
});

test('all seven binary-derived death effects terminate and keep terrain bounded', () => {
  for (let mode = 0; mode < 7; mode++) {
    const g = game({ crumble: 0, tanksFall: false }, 4242 + mode),
      p = g.players[1];
    p.alive = false;
    p.men = 0;
    g.phase = 'flight';
    g.deathAnimation = deathEffect(g, { ...p, owner: 0 }, tankPixel, mode);
    finish(g);
    assert.equal(g.terrain.data.length, W * H);
    assert.equal(g.deathAnimation, null);
  }
});
test('death fade does not apply bomb damage or a circular crater', () => {
  const g = game({ crumble: 0, tanksFall: false }),
    p = g.players[1];
  p.alive = false;
  p.men = 0;
  g.phase = 'flight';
  const before = g.terrain.data.slice(),
    other = g.players[0].men;
  g.deathAnimation = deathEffect(g, { ...p, owner: 0 }, tankPixel, 5);
  finish(g);
  assert.deepEqual(g.terrain.data, before);
  assert.equal(g.players[0].men, other);
});
test('death particle damage uses shield without damage-score bonus', () => {
  const g = game(),
    victim = g.players[1],
    attacker = g.players[0];
  victim.defense[0] = 5;
  g.hurt(victim, 12, attacker.id, 'death');
  assert.equal(victim.men, 93);
  assert.equal(victim.defense[0], 0);
  assert.equal(attacker.score, 0);
});

function fallingGame(options = {}) {
  const g = game({ crumble: 0, sound: false, ...options });
  g.terrain.data.fill(0);
  for (let y = 140; y <= BOTTOM; y++) for (let x = LEFT; x <= RIGHT; x++) g.terrain.set(x, y, 1);
  for (const p of g.players) {
    p.y = 139;
    p.defense[1] = 1000;
  }
  g.current.y = 70;
  g.phase = 'flight';
  return g;
}
test('fall traverses intermediate heights and prevents firing or turn advance until landing', () => {
  const g = fallingGame(),
    p = g.current,
    owner = g.active;
  g.update(1 / 60);
  assert.ok(g.falling);
  assert.equal(p.y, 70);
  assert.equal(g.fire(), false);
  g.update(0.02);
  assert.equal(p.y, 74);
  assert.equal(g.active, owner);
  assert.equal(g.phase, 'flight');
  for (let i = 0; i < 300 && g.falling; i++) g.update(1 / 60);
  assert.equal(p.y, 139);
  assert.equal(g.phase, 'flight');
  g.update(1 / 60);
  assert.equal(g.phase, 'aim');
  assert.notEqual(g.active, owner);
});
test('fall damage and damper consumption stay per-pixel, independent of frame rate', () => {
  for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
    const g = fallingGame(),
      p = g.current;
    g.update(dt);
    const rng = new Random(g.rng.state);
    let damage = 0;
    for (let i = 70; i < 139; i++) damage += rng.int(3) + 1;
    for (let i = 0; i < 1000 && g.falling; i++) g.update(dt);
    assert.equal(p.y, 139);
    assert.equal(p.defense[1], 1000 - damage);
    assert.equal(p.men, 100);
    assert.equal(g.rng.state, rng.state, 'settling must not reroll crumble on every frame');
  }
});
test('fatal fall completes visible descent before death resolution', () => {
  const g = fallingGame(),
    p = g.current;
  p.men = 1;
  p.defense[1] = 0;
  g.update(0.02);
  g.update(0.02);
  assert.equal(p.alive, true);
  assert.ok(p.y > 70 && p.y < 139);
  while (g.falling) g.update(1 / 60);
  assert.equal(p.y, 139);
  assert.equal(p.alive, false);
  assert.equal(g.deathQueue[0].y, 139);
  assert.equal(g.phase, 'flight');
});
test('disabled falling leaves unsupported tanks in place', () => {
  const g = fallingGame({ tanksFall: false }),
    p = g.current;
  g.update(1 / 60);
  assert.ok(!g.falling);
  assert.equal(p.y, 70);
  assert.equal(p.defense[1], 1000);
  assert.equal(g.phase, 'aim');
});
test('initial placement descends from y32 without damage, RNG draws or an extra turn', () => {
  const g = new Game(weapons, { wind: 0, sound: false }, 42);
  g.start([{ name: 'A' }, { name: 'B' }]);
  const owner = g.active,
    seed = g.rng.state,
    targets = g.players.map((p) => [
      p.id,
      Math.max(...Array.from({ length: 9 }, (_, i) => g.terrain.surface(p.x + i - 4))) - 1,
    ]);
  assert.equal(g.phase, 'flight');
  assert.ok(g.players.every((p) => p.y <= 32));
  g.update(0.02);
  assert.ok(g.players.some((p) => p.y > 32));
  settleIntro(g);
  assert.equal(g.phase, 'aim');
  assert.equal(g.active, owner);
  assert.equal(g.turns, 0);
  assert.equal(g.rng.state, seed);
  for (const [id, target] of targets) {
    assert.equal(g.players[id].y, target);
    assert.equal(g.players[id].men, 100);
  }
});

// The manual has a factor-of-ten typo; the executable uses 10 * MEN.
test('human power follows original 1000 ceiling and shrinks with casualties', () => {
  const g = game({ sound: false }),
    p = g.current;
  g.setPower(10000);
  assert.equal(p.power, 1000);
  g.setPower(p.power + 100);
  assert.equal(p.power, 1000);
  g.hurt(p, 83, p.id, 'fall');
  assert.equal(p.men, 17);
  assert.equal(p.power, 170);
  g.setPower(1000);
  assert.equal(p.power, 170);
  g.setPower(-1);
  assert.equal(p.power, 0);
});
test('old saves with excessive power are clamped to the original health limit', () => {
  const g = game();
  g.players[0].power = 10000;
  g.players[1].men = 17;
  g.players[1].power = 900;
  const restored = Game.restore(g.serialize(), weapons);
  assert.deepEqual(
    restored.players.map((p) => p.power),
    [1000, 170],
  );
});
