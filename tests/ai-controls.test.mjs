import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../dist/engine.js';
import { aiControl, aiIconColor, updateAIAim } from '../dist/ai-controls.js';
const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const { weapons } = read('../dist/assets/weapons.json');
function scene(sound = false) {
  const g = new Game(weapons, { sound, wind: 0, walls: 0, crumble: 0, background: 0 }, 47);
  g.start([
    { name: 'Rifleman', ai: 2 },
    { name: 'Human', ai: -1 },
  ]);
  while (g.falling) g.update(1 / 60);
  g.terrain.data.fill(0);
  g.players.forEach((p, i) => {
    p.x = i ? 50 : 250;
    p.y = 100;
    p.angle = 45;
    p.power = 200;
    p.weapon = 1;
    p.ammo[2] = 10;
    p.ammo[4] = 5;
  });
  g.order = [1, 0];
  g.active = 0;
  g.phase = 'aim';
  g.aiTimer = 0;
  g.events = [];
  return g;
}
function finishAim(g, rate = 60) {
  for (let i = 0; g.phase === 'aim' && i < rate * 15; i++) g.update(1 / rate);
  assert.equal(g.phase, 'flight');
  assert.equal(g.current.shots, 1);
}
test('AI command priority and accelerated power match 234 original machine-code cases', () => {
  for (const f of read('./fixtures/ai-controls-oracle.json')) {
    const action = aiControl(f.player, f.plan, f.player.angle > 90 ? -1 : 1);
    const kind = {
      1: 'angle',
      2: 'angle',
      3: 'power',
      4: 'power',
      5: 'fire',
      6: 'flip',
      8: 'weapon',
    }[f.command];
    assert.equal(action.kind, kind, JSON.stringify(f));
    if (kind === 'power')
      assert.equal(action.value, f.powerBeforeHandler + (f.command === 4 ? 1 : -1));
    if (kind === 'angle') assert.equal(action.value, f.player.angle + (f.command === 1 ? 1 : -1));
  }
});
test('AI displays weapon, direction, power and one-degree elevation commands before spending ammo', () => {
  const g = scene(),
    p = g.current;
  g.update(0.001);
  assert.equal(p.weapon, 2);
  assert.equal(p.power, 200);
  assert.equal(p.angle, 45);
  assert.equal(p.shots, 0);
  assert.equal(p.ammo[4], 5);
  assert.ok(g.aiWeaponTransition);
  assert.equal(g.aiAim.plan.weapon, 4);
  const stages = new Set();
  let previous = { ...p };
  for (let i = 0; g.phase === 'aim' && i < 1000; i++) {
    g.update(0.01);
    if (p.weapon !== previous.weapon) stages.add('weapon');
    if (p.power !== previous.power) {
      stages.add('power');
      assert.equal(p.angle, 135);
    }
    if (p.angle !== previous.angle) {
      if (Math.abs(p.angle - previous.angle) > 1) stages.add('flip');
      else {
        stages.add('angle');
        assert.equal(p.power, 1000);
      }
    }
    previous = { ...p };
  }
  assert.deepEqual([...stages].sort(), ['angle', 'flip', 'power', 'weapon']);
  assert.equal(p.shots, 1);
  assert.equal(p.ammo[4], 4);
  assert.equal(g.shots[0].weapon, 4);
  assert.equal(g.aiAim, null);
  assert.equal(g.aiWeaponTransition, null);
});
test('one AI plan is computed per turn, independent of refresh rate and sound', () => {
  const snapshots = [];
  for (const sound of [false, true])
    for (const rate of [30, 60, 144]) {
      const g = scene(sound);
      let plans = 0;
      const aim = g.aimAI.bind(g);
      g.aimAI = (p) => {
        plans++;
        aim(p);
      };
      finishAim(g, rate);
      assert.equal(plans, 1);
      snapshots.push({
        rng: g.rng.state,
        angle: g.current.angle,
        power: g.current.power,
        ammo: g.current.ammo,
      });
    }
  snapshots.forEach((s) => assert.deepEqual(s, snapshots[0]));
});
test('vertical gun can flip left without looping at 90 degrees', () => {
  const g = scene();
  g.current.angle = 90;
  g.aiAim = {
    owner: 0,
    plan: { weapon: 1, angle: 120, power: 200, target: 1 },
    direction: 1,
    wait: 0,
  };
  updateAIAim(g, 0.001);
  assert.equal(g.current.angle, 90);
  assert.equal(g.aiAim.direction, -1);
  finishAim(g);
  assert.equal(g.current.angle, 120);
});
test('weapon cycling wraps and skips empty weapons and insufficient laser reserve', () => {
  const g = scene(),
    p = g.current;
  p.weapon = 4;
  p.ammo.fill(0);
  p.ammo[0] = 2;
  p.ammo[5] = 99;
  p.ammo[11] = 5;
  g.aiAim = {
    owner: 0,
    plan: { weapon: 0, angle: 45, power: 200, target: 1 },
    direction: 1,
    wait: 0,
  };
  updateAIAim(g, 0.001);
  assert.equal(p.weapon, 11);
  updateAIAim(g, 0.128);
  assert.equal(p.weapon, 0);
  assert.equal(p.ammo[0], 2);
  assert.equal(p.shots, 0);
});
test('save during aiming resumes the same plan without rerolling or firing early', () => {
  const g = scene();
  g.update(0.2);
  assert.ok(g.aiAim);
  const restored = Game.restore(g.serialize(), weapons);
  assert.deepEqual(restored.aiAim, g.aiAim);
  assert.deepEqual(restored.aiWeaponTransition, g.aiWeaponTransition);
  finishAim(g);
  finishAim(restored);
  assert.equal(restored.rng.state, g.rng.state);
  assert.deepEqual(restored.current, g.current);
});
test('weapon crossfade follows original palette counters from 3 to 63', () => {
  assert.equal(aiIconColor({ from: 1, to: 4, elapsed: 0 }, 1), 'rgb(255,12,12)');
  assert.equal(aiIconColor({ from: 1, to: 4, elapsed: 0 }, 4), 'rgb(255,243,243)');
  assert.equal(aiIconColor({ from: 1, to: 4, elapsed: 0.12 }, 1), 'rgb(255,255,255)');
  assert.equal(aiIconColor({ from: 1, to: 4, elapsed: 0.12 }, 4), 'rgb(255,0,0)');
  assert.equal(aiIconColor({ from: 1, to: 4, elapsed: 0 }, 2), null);
});
