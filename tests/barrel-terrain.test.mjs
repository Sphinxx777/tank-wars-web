import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Game, tankPixel, tankBarrelPixels } from '../dist/engine.js';
import { updateAIAim } from '../dist/ai-controls.js';
const weapons = JSON.parse(
  fs.readFileSync(new URL('../dist/assets/weapons.json', import.meta.url)),
).weapons;
function buried() {
  const g = new Game(weapons, { sound: false, crumble: 0, wind: 0, walls: 0 }, 42);
  g.start([{ name: 'Buried' }, { name: 'Target' }]);
  g.falling = null;
  g.phase = 'aim';
  g.terrain.data.fill(1);
  g.current.x = 160;
  g.current.y = 150;
  g.current.angle = 0;
  return g;
}
test('buried gun cuts the old and new barrel plus redrawn body, but keeps surrounding earth', () => {
  const g = buried(),
    old = { ...g.current },
    before = g.terrain.version;
  g.setAngle(90);
  for (let y = 139; y <= 153; y++)
    for (let x = 149; x <= 171; x++) {
      const oldBarrel = [...tankBarrelPixels(old)].some(([px, py]) => x === px && y === py);
      assert.equal(g.terrain.solid(x, y), !(oldBarrel || tankPixel(g.current, x, y)), `${x},${y}`);
    }
  assert.ok(g.terrain.version > before);
  assert.equal(g.falling, null);
  assert.equal(g.crumbling, null);
});
test('gradual human rotation excavates a persistent cavity without reaching beyond the barrel', () => {
  const g = buried();
  for (let angle = 1; angle <= 180; angle++) g.setAngle(angle);
  for (const [x, y] of [
    [166, 148],
    [160, 143],
    [154, 148],
  ])
    assert.equal(g.terrain.solid(x, y), false);
  for (const [x, y] of [
    [160, 141],
    [150, 150],
    [170, 150],
    [160, 151],
  ])
    assert.equal(g.terrain.solid(x, y), true);
  const restored = Game.restore(g.serialize(), weapons);
  assert.deepEqual(restored.terrain.data, g.terrain.data);
});
test('direction flip clears two barrel lines without sweeping intermediate angles', () => {
  const g = buried();
  g.setAngle(180, true);
  assert.equal(g.terrain.solid(166, 150), false);
  assert.equal(g.terrain.solid(154, 150), false);
  assert.equal(g.terrain.solid(160, 143), true);
});
test('AI angle and direction commands excavate the same pixels as manual controls', () => {
  for (const [from, to, kind] of [
    [0, 1, 'angle'],
    [0, 180, 'flip'],
  ]) {
    const human = buried(),
      computer = buried();
    for (const g of [human, computer]) g.current.angle = from;
    human.setAngle(to, kind === 'flip');
    computer.aiAim = {
      owner: computer.current.id,
      plan: {
        angle: to,
        power: computer.current.power,
        weapon: computer.current.weapon,
        target: 1,
      },
      direction: 1,
      wait: 0,
    };
    updateAIAim(computer, 0);
    assert.equal(computer.current.angle, to);
    assert.deepEqual(computer.terrain.data, human.terrain.data);
  }
});
test('barrel restoration preserves saved trails and only runs on an accepted aiming command', () => {
  const g = buried();
  g.trailPixels[150 * 320 + 166] = 2;
  g.setPower(250);
  assert.equal(g.terrain.solid(166, 150), true);
  g.phase = 'flight';
  g.setAngle(90);
  assert.equal(g.terrain.solid(166, 150), true);
  g.phase = 'aim';
  g.setAngle(90);
  assert.equal(g.terrain.solid(166, 150), false);
  assert.equal(g.trailPixels[150 * 320 + 166], 2);
});

test('barrel restoration and tank redraw match all 181 original instruction cases', () => {
  const cases = JSON.parse(
    fs.readFileSync(new URL('./fixtures/barrel-terrain-oracle.json', import.meta.url)),
  );
  for (const row of cases) {
    const tank = { x: 100, y: 100, angle: row.angle };
    const actual = [...tankBarrelPixels(tank)]
      .map(([x, y]) => [x - 100, y - 100])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    assert.deepEqual(actual, row.barrel, `restored barrel at ${row.angle}`);
    const bitmap = new Uint8Array(64000).fill(2);
    for (let y = 90; y <= 100; y++)
      for (let x = 90; x <= 110; x++) if (tankPixel(tank, x, y)) bitmap[y * 320 + x] = 20;
    assert.equal(
      createHash('sha256').update(bitmap).digest('hex'),
      row.drawSha256,
      `tank redraw at ${row.angle}`,
    );
  }
});
