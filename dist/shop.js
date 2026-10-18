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
