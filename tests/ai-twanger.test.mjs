import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planTwanger } from '../dist/ai-twanger.js';
const fixtures = JSON.parse(
  readFileSync(new URL('./fixtures/twanger-oracle.json', import.meta.url)),
);

test('Twanger decisions match original solid-wall planner', () => {
  for (const [index, fixture] of fixtures.entries()) {
    const players = fixture.players.map((p, id) => ({
      id,
      team: id + 1,
      alive: true,
      ammo: Array(18).fill(1000),
      ...p,
    }));
    const player = players[fixture.own];
    const before = JSON.stringify(players);
    const randomCalls = [];
    const game = {
      players,
      order: players.map((p) => p.id),
      enemies: (p) => players.filter((t) => t !== p && t.alive && t.team !== p.team),
      terrain: {
        solid: (x, y) =>
          fixture.dirt.some(([x1, y1, x2, y2]) => x >= x1 && x <= x2 && y >= y1 && y <= y2),
      },
      rng: {
        int: (limit) => {
          randomCalls.push(limit);
          assert.equal(limit, 51);
          return fixture.random ?? 25;
        },
      },
      weapons: Array.from({ length: 18 }, (_, id) => ({ radius: [0, 10, 15, 30, 60][id] || 0 })),
    };
    const plan = planTwanger(game, player, (tank, x, y) =>
      fixture.pixels?.some(([px, py]) => px === x && py === y),
    );
    assert.equal(JSON.stringify(players), before, `case ${index} planner does not mutate players`);
    assert.deepEqual(randomCalls, fixture.expected.random);
    for (const key of ['target', 'angle', 'power', 'weapon'])
      assert.equal(plan[key], fixture.expected[key], `case ${index} ${key}`);
    assert.equal(
      createHash('sha256').update(JSON.stringify(plan.debug.samples)).digest('hex'),
      fixture.expected.samplesSha256,
      `case ${index} ray samples`,
    );
    for (const key of ['scores', 'ranking', 'weaponScore'])
      assert.deepEqual(plan.debug[key], fixture.expected[key], `case ${index} ${key}`);
  }
});
