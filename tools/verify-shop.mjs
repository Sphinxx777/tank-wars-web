// Render production shop into a native pixel buffer for DOS screenshot comparison.
import fs from 'node:fs';
import { Renderer } from '../dist/render.js';
import { shopItems, shopStock, visibleShopItems, cartCost } from '../dist/shop.js';
export function renderShopFixture() {
  const catalog = JSON.parse(
      fs.readFileSync(new URL('../dist/assets/weapons.json', import.meta.url)),
    ),
    fonts = {};
  for (const font of ['tiny', 'litt', 'euro'])
    fonts[font] = JSON.parse(
      fs.readFileSync(new URL('../dist/assets/' + font + '-font.json', import.meta.url)),
    );
  const pixels = Buffer.alloc(320 * 200 * 3),
    r = Object.create(Renderer.prototype);
  r.fonts = fonts;
  r.hits = [];
  r.time = 0;
  r.ctx = {
    fillStyle: '#000',
    fillRect(x, y, w, h) {
      let c = this.fillStyle;
      if (c.startsWith('rgb')) c = c.match(/\d+/g).map(Number);
      else {
        c = c.slice(1);
        if (c.length === 3) c = [...c].map((x) => x + x).join('');
        c = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
      }
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++)
          if (xx >= 0 && xx < 320 && yy >= 0 && yy < 200)
            for (let k = 0; k < 3; k++) pixels[(yy * 320 + xx) * 3 + k] = c[k];
    },
  };
  const player = {
      name: 'Player 1',
      color: '#ff0000',
      money: 200000,
      ammo: Array(18).fill(100),
      guidance: [5, 5],
      defense: [1000, 100, 1],
    },
    items = shopItems(catalog),
    app = {
      options: { paletteSpeed: 3 },
      game: { players: [player] },
      shopPlayer: 0,
      cart: [],
      shopItems: items,
      shopSelection: 0,
      shopStock: (it) => shopStock(player, it),
      shopVisible: () => visibleShopItems(player, items),
      cartCost() {
        return cartCost(this.cart, items);
      },
    };
  r.shop(app);
  return pixels;
}
if (process.argv[1]?.endsWith('/verify-shop.mjs')) {
  const pixels = renderShopFixture();
  fs.mkdirSync(new URL('../research/screenshots/', import.meta.url), { recursive: true });
  fs.writeFileSync(
    new URL('../research/screenshots/web-shop-native.ppm', import.meta.url),
    Buffer.concat([Buffer.from('P6\n320 200\n255\n'), pixels]),
  );
  console.log('Rendered production shop: 320×200');
}
