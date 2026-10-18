import fs from 'node:fs';
import { Renderer } from '../dist/render.js';
export function renderHUD() {
  const pixels = Buffer.alloc(320 * 200 * 3),
    r = Object.create(Renderer.prototype);
  r.fonts = {};
  r.bitmap = fs.readFileSync(new URL('../dist/assets/font8.bin', import.meta.url));
  r.hits = [];
  r.ctx = {
    fillStyle: '#000',
    fillRect(x, y, w, h) {
      let c = this.fillStyle.slice(1);
      if (c.length === 3) c = [...c].map((x) => x + x).join('');
      const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++)
          if (xx >= 0 && xx < 320 && yy >= 0 && yy < 200)
            for (let k = 0; k < 3; k++) pixels[(yy * 320 + xx) * 3 + k] = rgb[k];
    },
  };
  const p = {
    id: 1,
    name: 'Player 2',
    angle: 75,
    power: 200,
    men: 100,
    ammo: Array(18).fill(0),
    guidance: [0, 0],
    weapon: 1,
    armed: 0,
  };
  p.ammo[0] = 100;
  p.ammo[1] = 30;
  p.ammo[11] = 100;
  r.battleHUD({
    game: {
      current: p,
      wind: -41,
      players: [p],
      weapons: JSON.parse(fs.readFileSync(new URL('../dist/assets/weapons.json', import.meta.url)))
        .weapons,
    },
  });
  return pixels.subarray(0, 320 * 28 * 3);
}
