// OVR 0x8be7..0xaea2. The DOS shop lists owned OR affordable supplies.
export const shopItems = (catalog) => [
  ...catalog.weapons
    .map((w, index) => ({ ...w, kind: 'weapon', index }))
    .filter((w) => w.quantity > 0 && w.price > 0),
  ...catalog.guidance.map((w, index) => ({ ...w, kind: 'guidance', index })),
  ...catalog.defenses.map((w, index) => ({ ...w, kind: 'defense', index })),
];
export const shopStock = (player, item) =>
  (item.kind === 'weapon'
    ? player.ammo
    : item.kind === 'guidance'
      ? player.guidance
      : player.defense)[item.index];
export const visibleShopItems = (player, items) =>
  items
    .map((item, i) => (shopStock(player, item) > 0 || player.money >= item.price ? i : -1))
    .filter((i) => i >= 0);
export const cartCost = (cart, items) => cart.reduce((sum, n, i) => sum + n * items[i].price, 0);
export function reserve(cart, items, player, i, dir = 1) {
  if (dir < 0) {
    cart[i] = Math.max(0, (cart[i] || 0) - 1);
    return true;
  }
  if ((cart[i] || 0) >= 9 || cartCost(cart, items) + items[i].price > player.money) return false;
  cart[i] = (cart[i] || 0) + 1;
  return true;
}

// AI object +0x0e, EXE 0x29b7: selected once when the opponent is created.
export function chooseShoppingStrategy(ai, rng) {
  if (ai < 0) return 0;
  let strategy;
  do strategy = 1 + rng.int(4);
  while (strategy === 3 && ai !== 2 && ai !== 5);
  return strategy;
}

// OVR 0xa085..0xa4d2. Return one cart item, or -1 for Done.
export function computerChoice(player, items, cart) {
  const available = player.money - cartCost(cart, items);
  const stock = (index) =>
    shopStock(player, items[index]) + (cart[index] || 0) * items[index].quantity;
  const strategy = player.shoppingStrategy;
  let choice = -1;
  if (strategy === 1) {
    for (let weapon = 4; weapon >= 1; weapon--) {
      const index = items.findIndex((item) => item.kind === 'weapon' && item.index === weapon);
      if (index >= 0 && items[index].price <= available && stock(index) < 20) choice = index;
    }
  } else if (strategy === 2 || strategy === 3) {
    for (let weapon = 1; weapon <= (strategy === 3 ? 5 : 4); weapon++) {
      const index = items.findIndex((item) => item.kind === 'weapon' && item.index === weapon);
      if (index >= 0 && items[index].price <= available) choice = index;
    }
  } else if (strategy === 4) {
    for (let defense = 2; defense >= 0; defense--) {
      const index = items.findIndex((item) => item.kind === 'defense' && item.index === defense);
      if (index >= 0 && items[index].price <= available) choice = index;
    }
  }
  if (strategy >= 2 && strategy <= 4) {
    const incinerator = items.findIndex((item) => item.kind === 'weapon' && item.index === 1);
    // The DOS selector omits affordability here. reserve() enforces it below.
    if (incinerator >= 0 && stock(incinerator) < 20) choice = incinerator;
  }
  return choice;
}

export function computerCart(player, items) {
  const cart = [];
  while (true) {
    const choice = computerChoice(player, items, cart);
    // DOS can keep retrying a full nine-lot cart. Commit on no progress so a
    // rich opponent cannot hang the browser; all successful selections match.
    if (choice < 0 || !reserve(cart, items, player, choice)) return cart;
  }
}
