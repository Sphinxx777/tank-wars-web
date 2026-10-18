import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game, Random } from '../dist/engine.js';
import {
  shopItems,
  cartCost,
  computerChoice,
  computerCart,
  chooseShoppingStrategy,
} from '../dist/shop.js';
const catalog = JSON.parse(
  fs.readFileSync(new URL('../dist/assets/weapons.json', import.meta.url)),
);
const oracle = JSON.parse(
  fs.readFileSync(new URL('./fixtures/computer-shop-oracle.json', import.meta.url)),
);
const items = shopItems(catalog);
function player(strategy, money = 10000) {
  return {
    shoppingStrategy: strategy,
    money,
    ammo: Array(18).fill(0),
    guidance: [0, 0],
    defense: [0, 0, 0],
  };
}

test('all 29 computer shop choices match original x86 instruction execution', () => {
  for (const fixture of oracle) {
    const tank = player(fixture.strategy, fixture.money);
    for (const [id, units] of Object.entries(fixture.ammo)) tank.ammo[id] = units;
    const cart = [];
    for (const [id, lots] of Object.entries(fixture.cart || {}))
      cart[items.findIndex((item) => item.kind === 'weapon' && item.index === Number(id))] = lots;
    tank.money += cartCost(cart, items);
    const index = computerChoice(tank, items, cart);
    const actual = index < 0 ? null : { kind: items[index].kind, index: items[index].index };
    assert.deepEqual(actual, fixture.expected, JSON.stringify(fixture));
  }
});

test('shopping profiles obey original constructor restrictions and rejection draws', () => {
  for (let ai = 0; ai < 7; ai++) {
    const rng = new Random(6);
    const values = new Set(Array.from({ length: 100 }, () => chooseShoppingStrategy(ai, rng)));
    assert.deepEqual([...values].sort(), ai === 2 || ai === 5 ? [1, 2, 3, 4] : [1, 2, 4]);
  }
  const rng = new Random(1);
  assert.equal(chooseShoppingStrategy(-1, rng), 0);
  assert.equal(rng.state, 1);
});

test('computer shopping commits original quantities and costs, including dead opponents', () => {
  const game = new Game(catalog.weapons, { sound: false }, 1);
  game.start([{ name: 'Human' }, { name: 'CPU', ai: 2 }]);
  while (game.falling) game.update(1 / 60);
  const tank = game.players[1];
  tank.alive = false;
  tank.shoppingStrategy = 3;
  tank.ammo[1] = 30;
  tank.money = tank.score = 24000;
  game.computerShop(catalog);
  assert.equal(tank.ammo[5], 2000);
  assert.equal(tank.ammo[2], 10);
  assert.equal(tank.money, 0);
  assert.equal(tank.score, 24000);
  const restored = Game.restore(game.serialize(), catalog.weapons);
  assert.equal(restored.players[1].shoppingStrategy, 3);
  game.nextRound();
  assert.equal(tank.shoppingStrategy, 3);
  assert.equal(tank.ammo[5], 2000);
});

test('computer buying toggle preserves cash and inventory when disabled', () => {
  const game = new Game(catalog.weapons, { computerBuy: false }, 1);
  game.start([{ ai: 6 }, { ai: 6 }]);
  game.players.forEach((tank) => {
    tank.money = 50000;
  });
  const before = JSON.stringify(game.players);
  game.computerShop(catalog);
  assert.equal(JSON.stringify(game.players), before);
});

test('rich and low-cash opponents finish instead of looping on rejected reservations', () => {
  const rich = player(2, 1000000);
  rich.ammo[1] = 30;
  const cart = computerCart(rich, items);
  const nuke = items.findIndex((item) => item.kind === 'weapon' && item.index === 4);
  assert.equal(cart[nuke], 9);
  assert.equal(cartCost(cart, items), 90000);
  assert.deepEqual(computerCart(player(2, 1000), items), []);
});
