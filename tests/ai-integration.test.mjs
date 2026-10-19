import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game, tankPixel } from '../dist/engine.js';
import { planTwanger } from '../dist/ai-twanger.js';
import { planLobber } from '../dist/ai-lobber.js';
import { deathEffect } from '../dist/death.js';
const { weapons } = JSON.parse(
  readFileSync(new URL('../dist/assets/weapons.json', import.meta.url)),
);

function scene(ai = -1, wall = 0) {
  const game = new Game(
    weapons,
    { sound: false, wind: 0, walls: wall, crumble: 0, background: 0 },
    47,
  );
  game.start([
    { name: 'Computer', ai },
    { name: 'Human', ai: -1 },
  ]);
  while (game.falling) game.update(1 / 60);
  game.terrain.data.fill(0);
  for (let x = 11; x <= 309; x++) for (let y = 161; y <= 189; y++) game.terrain.set(x, y, 1);
  game.players.forEach((p, i) => {
    Object.assign(p, { x: i ? 270 : 40, y: 160, angle: 45, power: 200, weapon: 1, lob: [] });
    p.ammo.fill(20);
    p.ammo[5] = 1000;
  });
  game.order = [0, 1];
  game.active = 0;
  game.phase = 'aim';
  game.aiTimer = 0;
  return game;
}
function finishAim(game, rate) {
  for (let i = 0; game.phase === 'aim' && i < rate * 20; i++) game.update(1 / rate);
  assert.equal(game.phase, 'flight');
  assert.equal(game.current.shots, 1);
}
function finishHistory(game) {
  for (let i = 0; game.pendingShotHistory && i < 20000; i++) game.update(1 / 60);
  assert.equal(game.pendingShotHistory, null, 'history must be committed after weapon dispatch');
}

test('Twanger and Lobber execute one DOS plan through gradual controls, including save/resume', () => {
  for (const ai of [1, 4, 5]) {
    const outcomes = [];
    for (const rate of [30, 60, 144]) {
      const game = scene(ai, ai === 5 ? 2 : 0);
      const oracle = Game.restore(game.serialize(), weapons);
      const plan =
        ai === 5
          ? planTwanger(oracle, oracle.current, tankPixel)
          : planLobber(oracle, oracle.current);
      game.update(0.001);
      assert.ok(game.aiAim);
      assert.equal(game.current.shots, 0);
      assert.equal(game.current.angle, 45);
      const restored = Game.restore(game.serialize(), weapons);
      finishAim(game, rate);
      finishAim(restored, rate);
      assert.deepEqual(restored.current, game.current);
      const player = game.current;
      assert.equal(player.angle, plan.angle);
      assert.equal(player.power, plan.power);
      assert.equal(player.weapon, plan.weapon);
      assert.equal(player.target, plan.target);
      outcomes.push({
        angle: player.angle,
        power: player.power,
        ammo: player.ammo,
        rng: game.rng.state,
      });
    }
    outcomes.forEach((outcome) => assert.deepEqual(outcome, outcomes[0]));
  }
});

test('non-rebounding Twanger retains the Rifleman dispatcher', () => {
  for (const wall of [0, 4]) {
    const twanger = scene(5, wall);
    const rifleman = Game.restore(twanger.serialize(), weapons);
    rifleman.current.ai = 2;
    twanger.aimAI(twanger.current);
    rifleman.aimAI(rifleman.current);
    for (const key of ['angle', 'power', 'weapon', 'target'])
      assert.equal(twanger.current[key], rifleman.current[key]);
    assert.equal(twanger.rng.state, rifleman.rng.state);
  }
});

test('each ordinary shot and laser writes one integer history entry; MIRV retains shared DOS coordinates', () => {
  for (const weapon of [1, 5, 7, 13]) {
    const game = scene();
    const player = game.current;
    Object.assign(player, { angle: 75, power: 200, weapon });
    game.sharedProjectilePosition = { x: 123.75, y: -15.9 };
    assert.ok(game.fire());
    assert.equal(player.lob.length, 0);
    finishHistory(game);
    assert.equal(player.lob.length, 1, `weapon ${weapon}`);
    assert.equal(player.lob[0].power, 200);
    assert.equal(player.lob[0].x, Math.trunc(game.sharedProjectilePosition.x));
    assert.equal(player.lob[0].y, Math.trunc(game.sharedProjectilePosition.y));
    if (weapon === 7) {
      assert.equal(player.lob[0].x, 123);
      assert.equal(player.lob[0].y, -15);
    } else assert.notEqual(player.lob[0].x, 123);
  }
});

test('history commits before death animations can overwrite the shared coordinates', () => {
  const game = scene();
  game.phase = 'flight';
  game.pendingShotHistory = { owner: 0, power: 250 };
  game.sharedProjectilePosition = { x: 200.9, y: 159.9 };
  game.deathQueue.push({ ...game.players[1], owner: 0 });
  game.settleTurn();
  assert.equal(game.players[0].lob.length, 1);
  assert.equal(game.players[0].lob[0].x, 200);
  game.settleTurn();
  assert.equal(game.players[0].lob.length, 1);
});

test('round setup clears landing history but retains the Lobber object direction and shared position', () => {
  const game = scene(1);
  game.current.lobAim = { elevation: 75, direction: -1 };
  game.current.lob.push({ x: 50, y: 160, power: 200 });
  game.sharedProjectilePosition = { x: -4.25, y: 70.5 };
  game.nextRound();
  for (const player of game.players) assert.equal(player.lob.length, 0);
  assert.deepEqual(game.players[0].lobAim, { elevation: 75, direction: -1 });
  assert.deepEqual(game.sharedProjectilePosition, { x: -4.25, y: 70.5 });
  while (game.falling) game.update(1 / 60);
  const restored = Game.restore(game.serialize(), weapons);
  assert.deepEqual(restored.sharedProjectilePosition, game.sharedProjectilePosition);
  assert.deepEqual(restored.players[0].lobAim, game.players[0].lobAim);
});

test('death mode 0 reuses local viewport coordinates; mode 2 leaves the shared coordinates intact', () => {
  for (const mode of [0, 2]) {
    const game = scene();
    game.sharedProjectilePosition = { x: 700, y: 700 };
    const effect = deathEffect(game, { ...game.players[0], owner: 0 }, tankPixel, mode);
    effect.next(); // initial flash
    effect.next(); // first particles
    if (mode === 0) {
      assert.ok(Math.abs(game.sharedProjectilePosition.x - (40 - 11)) < 5);
      assert.ok(Math.abs(game.sharedProjectilePosition.y - (160 - 31)) < 10);
    } else assert.deepEqual(game.sharedProjectilePosition, { x: 700, y: 700 });
  }
});
