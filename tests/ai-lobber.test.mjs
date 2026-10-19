import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planLobber, recordLobberShot } from '../dist/ai-lobber.js';
const cases = JSON.parse(readFileSync(new URL('./fixtures/lobber-oracle.json', import.meta.url)));

test('Lobber matches original-code targeting, learning, overflow and fallback cases', () => {
  for (const [index, example] of cases.entries()) {
    const calls = [];
    const players = example.players.map((p, i) => ({
      alive: true,
      team: i + 1,
      y: 150,
      ...p,
      id: i,
    }));
    const player = players[example.own];
    Object.assign(player, {
      angle: 75,
      power: 400,
      ammo: example.ammo || Array(18).fill(100),
      lob: structuredClone(example.history),
      lobAim: { elevation: example.elevation ?? 75, direction: example.direction ?? 1 },
    });
    const game = {
      players,
      order: players.map((p) => p.id),
      rng: {
        next() {
          calls.push('real');
          return example.random ?? 0.75;
        },
        int(limit) {
          calls.push(limit);
          return (example.randomInt ?? 17) % limit;
        },
      },
    };
    const plan = planLobber(game, player);
    assert.deepEqual(
      {
        target: plan.target,
        ...player.lobAim,
        power: plan.power,
        weapon: plan.weapon,
        historyLength: player.lob.length,
        randomCalls: calls,
      },
      example.expected,
      `oracle case ${index}`,
    );
  }
});

test('Lobber records integer DOS history with positive x saturation', () => {
  const p = { angle: 105, power: 410, lob: [] };
  recordLobberShot(p, { x: 123.9, y: -15.9 });
  recordLobberShot(p, { x: 40000, y: 32768.5, power: 300 });
  recordLobberShot(p, { x: -32769, y: 0 });
  assert.deepEqual(p.lob, [
    { x: 123, y: -15, power: 410, angle: 75, direction: -1 },
    { x: 32767, y: -32768, power: 300, angle: 75, direction: -1 },
    { x: 32767, y: 0, power: 410, angle: 75, direction: -1 },
  ]);
});

test('history writer matches original Real48 truncation and signed-word stores', () => {
  const records = JSON.parse(
    readFileSync(new URL('./fixtures/lobber-history-oracle.json', import.meta.url)),
  );
  for (const example of records) {
    const player = {
      angle: example.direction > 0 ? example.elevation : 180 - example.elevation,
      power: example.power,
      lob: [],
    };
    recordLobberShot(player, example);
    assert.deepEqual(player.lob[0], example.expected);
  }
});

test('new Lobber object starts facing right independently of the drawn barrel', () => {
  const players = [
    { id: 0, x: 40, alive: true, team: 0 },
    {
      id: 1,
      x: 150,
      alive: true,
      team: 1,
      angle: 105,
      power: 200,
      lob: [],
      ammo: Array(18).fill(100),
    },
    { id: 2, x: 270, alive: true, team: 2 },
  ];
  const game = { players, order: [0, 1, 2], rng: { next: () => 0.75, int: () => 17 } };
  assert.equal(planLobber(game, players[1]).target, 2);
  players[1].lobAim.direction = -1;
  players[1].lob = []; // Round setup clears history while keeping the AI object.
  assert.equal(planLobber(game, players[1]).target, 0);
});

test('Lobber uses original player order for traversal, ties and aiming direction', () => {
  const players = [
    { id: 0, x: 100, alive: true, team: 0 },
    { id: 1, x: 200, alive: true, team: 1 },
    {
      id: 2,
      x: 30,
      alive: true,
      team: 2,
      angle: 90,
      power: 200,
      ammo: Array(18).fill(100),
      lob: [
        { x: 149.9, power: 150 },
        { x: 150.8, power: 200 },
      ],
    },
  ];
  const game = { players, order: [2, 1, 0], rng: { next: () => 0.75, int: () => 17 } };
  assert.equal(planLobber(game, players[2]).target, 1);
  assert.equal(players[2].lob[0].x, 149);
  assert.equal(players[2].lob[1].x, 150);
});
