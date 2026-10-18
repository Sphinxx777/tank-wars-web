import { bgiEllipse } from './effects-render.js';

// Tank Wars 3.2: OVR 0x1c0c0..0x1c937; resident palette EXE 0x59bc.
// Generate once per round. Rendering never consumes gameplay random numbers.
export const BIOS_TICK_HZ = 1193182 / 65536;
export const VGA_BACKGROUND_RGB = [57, 36, 40];
const W = 320,
  H = 200,
  LEFT = 11,
  RIGHT = 309,
  TOP = 31,
  BOTTOM = 189;
const rgb8 = (rgb) => rgb.map((v) => Math.round((v * 255) / 63));

// cc8:9e4, EXE 0xed04: normalize left-to-right, inclusive endpoints.
function line(pixels, x0, y0, x1, y1, color) {
  if (x0 > x1) {
    [x0, x1] = [x1, x0];
    [y0, y1] = [y1, y0];
  }
  const dx = x1 - x0,
    dy = Math.abs(y1 - y0),
    sy = y1 >= y0 ? 1 : -1;
  const major = Math.max(dx, dy),
    minor = Math.min(dx, dy);
  let e = major >> 1;
  for (let n = 0; n <= major; n++) {
    if (x0 >= 0 && x0 < W && y0 >= 0 && y0 < H) pixels[y0 * W + x0] = color;
    if (dx >= dy) x0++;
    else y0 += sy;
    e += minor;
    if (e >= major) {
      if (dx >= dy) y0 += sy;
      else x0++;
      e -= major;
    }
  }
}
function rectangle(p, x0, y0, x1, y1, c) {
  line(p, x0, y0, x1, y0, c);
  line(p, x0, y1, x1, y1, c);
  line(p, x0, y0, x0, y1, c);
  line(p, x1, y0, x1, y1, c);
}
function randomPalette(rng) {
  const anchors = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => rng.int(64)));
  return Array.from({ length: 30 }, (_, i) => {
    const a = Math.floor(i / 10),
      k = i % 10;
    return rgb8(anchors[a].map((v, c) => Math.trunc(v + (k * (anchors[(a + 1) % 3][c] - v)) / 10)));
  });
}
function model(kind, palette, cycle = true) {
  return {
    kind,
    pixels: new Uint8Array(W * H),
    palette,
    cycle,
    direction: 1,
    base: VGA_BACKGROUND_RGB,
  };
}

export function createBattleBackground(kind, rng, { mask = 511, direction = 1 } = {}) {
  if (kind === 9) kind = rng.int(9);
  if (kind === 10) {
    if (!(mask & 511)) kind = 0;
    else
      do {
        kind = rng.int(9);
      } while (!(mask & (1 << kind)));
  }
  let palette = [];
  if (kind === 1)
    palette = Array.from({ length: 20 }, (_, i) =>
      rgb8([5 * (i % 10), 5 * (i % 10), i < 10 ? 5 * i : 0]),
    );
  else if (kind === 5) palette = Array.from({ length: 20 }, (_, i) => rgb8([i, 0, 63 - i]));
  else if (kind >= 2 && kind <= 8) palette = randomPalette(rng);
  const bg = model(kind, palette, kind !== 0 && kind !== 5),
    p = bg.pixels;
  if (kind === 1) {
    const count = 250 + rng.int(500);
    bg.stars = [];
    for (let i = 0; i < count; i++) {
      const x = 11 + rng.int(299),
        y = 31 + rng.int(159),
        c = 30 + rng.int(20);
      p[y * W + x] = c;
      bg.stars.push([x, y, c - 30]);
    }
  } else if (kind === 2 || kind === 5) {
    for (let y = 31; y <= 190; y++)
      line(p, 11, y, 310, y, 30 + (kind === 2 ? y % 30 : Math.trunc((y - 30) / 8)));
  } else if (kind === 3) {
    const plot = (c) => (x, y) => {
      if (x >= LEFT && x <= RIGHT && y >= TOP && y <= BOTTOM) p[y * W + x] = c;
    };
    for (let r = 0; r <= 170; r++) {
      const draw = plot(30 + (r % 30));
      bgiEllipse(160, 110, r, r, draw);
      bgiEllipse(161, 110, r, r, draw);
    }
  } else if (kind === 4) {
    let n = 0;
    const ray = (x, y) => line(p, 160, 100, x, y, 30 + 2 * (n++ % 15));
    for (let x = LEFT; x <= RIGHT; x++) ray(x, TOP);
    for (let y = TOP; y <= BOTTOM; y++) ray(RIGHT, y);
    for (let x = RIGHT; x >= LEFT; x--) ray(x, BOTTOM);
    for (let y = BOTTOM; y >= TOP; y--) ray(LEFT, y);
  } else if (kind === 6) {
    // Random calls are column-major; the bitmap itself remains stationary.
    for (let x = LEFT; x <= RIGHT; x++)
      for (let y = TOP; y <= BOTTOM; y++) p[y * W + x] = 30 + rng.int(30);
  } else if (kind === 7) {
    const last = [80, 150, 159][rng.int(3)];
    bg.lastRing = last;
    for (let i = 1; i <= last; i++) rectangle(p, 10 + i, 30 + i, 310 - i, 190 - i, 30 + (i % 30));
  } else if (kind === 8) {
    for (let i = 0; i <= 149; i++) {
      const c = 30 + (i % 30);
      line(p, 160, 110, 160 - i, 31, c);
      line(p, 160, 110, 160 + i, 31, c);
      line(p, 160, 110, 160 - i, 189, c);
      line(p, 160, 110, 160 + i, 189, c);
    }
    for (let i = 0; i <= 79; i++) {
      const c = 30 + ((i + 70) % 30);
      line(p, 160, 110, 11, 110 - i, c);
      line(p, 160, 110, 309, 110 - i, c);
      line(p, 160, 110, 11, 110 + i, c);
      line(p, 160, 110, 309, 110 + i, c);
    }
  }
  // OVR 0x1c9a6: one Random(real) draw toggles the persistent IRQ direction.
  const flip = (rng.next ? rng.next() : rng.int(65536) / 65536) < 0.5;
  bg.direction = flip ? -direction : direction;
  return bg;
}

// Main menu uses mode 0 and a single Random(2) chooses lastRing 100/160.
// Score/shop use mode 1. Keep the chosen ring count when redrawing controls.
export function createMenuBackground(mode = 0, lastRing = 100) {
  const bg = model(
      'menu',
      Array.from({ length: 30 }, (_, i) => rgb8([30 + i, 0, 30 + i])),
    ),
    p = bg.pixels;
  if (mode === 0)
    for (let i = 0; i <= lastRing; i++) rectangle(p, i, i, 319 - i, 199 - i, 30 + (i % 30));
  else for (let y = 0; y < H; y++) line(p, 0, y, 319, y, 30 + (y % 30));
  bg.lastRing = lastRing;
  return bg;
}

export function backgroundPhase(bg, elapsedSeconds, speed = 3, tickHz = BIOS_TICK_HZ) {
  if (!bg.cycle || !bg.palette.length) return 0;
  const delay = bg.kind === 1 ? 3 * (speed + 1) : speed;
  // The first interrupt uploads offset 0; the second uploads offset 1.
  const steps = Math.max(
    0,
    Math.floor((Math.max(0, elapsedSeconds) * tickHz) / Math.max(1, delay)) - 1,
  );
  return (
    (((steps * (bg.direction || 1)) % bg.palette.length) + bg.palette.length) % bg.palette.length
  );
}
export function backgroundFrame(
  bg,
  elapsedSeconds = 0,
  speed = 3,
  out = new Uint8ClampedArray(W * H * 4),
  tickHz = BIOS_TICK_HZ,
) {
  const phase = backgroundPhase(bg, elapsedSeconds, speed, tickHz),
    n = bg.palette.length;
  for (let i = 0; i < W * H; i++) {
    const k = bg.pixels[i],
      c = k >= 30 && k < 30 + n ? bg.palette[(k - 30 + phase) % n] : bg.base,
      j = i * 4;
    out[j] = c[0];
    out[j + 1] = c[1];
    out[j + 2] = c[2];
    out[j + 3] = 255;
  }
  return out;
}
