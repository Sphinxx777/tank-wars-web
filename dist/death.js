import { bgiEllipse } from './effects-render.js';
import { SoundSequence, CPU_WRITE_MS } from './sound.js';
// OVR death effects, translated in research/death-effects.md.
// Explicit palette delays are yielded independently of sound and display refresh.
export function* deathEffect(g, dead, tankPixel, forcedMode) {
  const R = (n) => g.rng.int(n),
    U = () => g.rng.next(),
    sound = g.options.sound,
    flash = () => R(65535);
  let tones = new SoundSequence();
  const tone = (f, ms = CPU_WRITE_MS) => {
      if (sound) tones.tone(f, ms);
    },
    stop = () => tones.stop(),
    flush = () => {
      if (tones.events.length) g.audio(tones);
      tones = new SoundSequence();
    };
  const mode = forcedMode ?? R(7),
    pixels = new Map(),
    key = (x, y) => y * 320 + x,
    inside = (x, y) => x >= 11 && x <= 309 && y >= 31 && y <= 189;
  const read = (x, y) => {
    if (pixels.has(key(x, y))) return pixels.get(key(x, y));
    const t = g.players.find((p) => (p.alive || p.id === dead.id) && tankPixel(p, x, y));
    return t
      ? 20 + t.id
      : g.terrain.solid(x, y)
        ? 2
        : x === 10 || x === 310 || y === 30 || y === 190
          ? 13
          : 0;
  };
  const put = (x, y, color) => {
    if (inside(x, y)) {
      pixels.set(key(x, y), color);
      g.terrain.set(x, y, color === 2 ? 1 : 0);
    }
  };
  const contact = (x, y, min, range) => {
    const c = read(x, y);
    if (c >= 20 && c <= 29) g.hurt(g.players[c - 20], min + R(range), dead.owner, 'death');
  };
  const clearDisk = (x, y, r) => {
    for (let yy = Math.max(31, y - r); yy <= Math.min(189, y + r); yy++)
      for (let xx = Math.max(11, x - r); xx <= Math.min(309, x + r); xx++)
        if ((xx - x) ** 2 + (yy - y) ** 2 <= r * r) put(xx, yy, 0);
    g.terrain.version++;
  };
  const deathPalette = {};
  for (let channel = 0; channel < 3; channel++)
    for (let i = 0; i < 5; i++) {
      const rgb = [0, 0, 0];
      rgb[channel] = Math.round((Math.trunc((1 - i / 4) * 63) * 255) / 63);
      deathPalette[130 + channel * 10 + i] = `rgb(${rgb.join(',')})`;
    }
  const ring = (x, y, r, c, double = true) => {
    bgiEllipse(x, y, r, r, (xx, yy) => put(xx, yy, c));
    if (double) bgiEllipse(x + 1, y, r, r, (xx, yy) => put(xx, yy, c));
  };
  const show = () => {
    g.deathVisual = {
      palette: deathPalette,
      color: dead.color,
      points: [...pixels]
        .filter(([, c]) => c !== 0 && c !== 2)
        .map(([k, c]) => [k % 320, Math.floor(k / 320), c])
        .slice(-5000),
    };
  };
  const fold = (p) => {
    if (p.x > 309) p.x = 618 - p.x;
    if (p.y > 189) p.y = 378 - p.y;
    if (p.y < 31) p.y = 62 - p.y;
    if (p.x < 11) p.x = 22 - p.x;
    return p;
  };
  const eraseBody = () => {
    for (let y = dead.y - 9; y <= dead.y + 1; y++)
      for (let x = dead.x - 9; x <= dead.x + 9; x++) if (tankPixel(dead, x, y)) put(x, y, 0);
    g.terrain.version++;
  };
  function* intensitySweep(passes, delay, last) {
    const seconds = (delay || CPU_WRITE_MS) / 1000;
    for (let pass = 0; pass < passes; pass++)
      for (let level = 0; level <= 100; level++) {
        g.deathVisual = { tank: dead, level };
        tone(2000 + 100 * level, delay || CPU_WRITE_MS);
        flush();
        yield seconds;
      }
    for (let level = 100; level >= last; level--) {
      g.deathVisual = { tank: dead, level };
      tone(2000 + 100 * level, delay || CPU_WRITE_MS);
      flush();
      yield seconds;
    }
    stop();
    flush();
  }
  if (mode === 6) {
    const delay = R(2) === 1 ? 0 : 8;
    yield* intensitySweep(3, delay, 1);
    g.deathVisual = null;
    const q = R(10),
      max = q < 2 ? 1 : q < 5 ? 2 : q < 8 ? 3 : 4;
    for (let i = 1; i <= max; i++) {
      g.explode(dead.x, dead.y, g.weapons[i].radius, dead.owner, 'death');
      flush();
      yield;
    }
    eraseBody();
    return;
  }
  if (mode === 5) {
    yield* intensitySweep(1, 8, 0);
    eraseBody();
    g.deathVisual = null;
    return;
  }
  if (mode === 4) {
    const waves = 30 + R(30);
    for (let wave = 1; wave <= waves; wave++) {
      const count = R(400);
      for (let k = 0; k < count; k++) {
        const h = R(10 * wave),
          dx = Math.trunc(R(h + 10) - h / 2 - 5),
          p = { x: dead.x + dx, y: dead.y - h };
        while (!inside(p.x, p.y)) fold(p);
        put(p.x, p.y, 2);
        if (sound) tone(100 * wave + R(1000));
      }
      g.terrain.version++;
      flush();
      yield;
    }
  }
  if (mode === 1 || mode === 3) {
    const bursts = 5 + R(5);
    for (let b = 0; b < bursts; b++) {
      const count = 2 + R(390),
        direction = 1 + R(8),
        layers = [];
      for (let layer = 1; layer <= 5; layer++) {
        const points = [];
        for (let k = 0; k < count; k++) {
          const h = R(10 * layer),
            q = Math.trunc(R(h + 10) - h / 2 - 5);
          const [dx, dy] = [
            [q, -h],
            [q, h],
            [h, -q],
            [-h, -q],
            [q + h, -h],
            [q - h, -h],
            [q + h, h],
            [q - h, h],
          ][direction - 1];
          points.push(fold({ x: dead.x + dx, y: dead.y + dy }));
        }
        layers.push(points);
      }
      for (let layer = 0; layer < 5; layer++) {
        for (let k = 0; k < count; k++) {
          if (sound) {
            tone(100 + R(500 * (layer + 1)));
            stop();
          }
          const p = layers[layer][k];
          contact(p.x, p.y, 1, 3);
          if (mode === 1) {
            put(p.x, p.y, 1 + R(14));
            if (layer > 0) {
              const old = layers[layer - 1][k];
              put(old.x, old.y, 0);
            }
          } else {
            const color = 201 + R(14);
            put(p.x, p.y, color === 202 ? 2 : color);
          }
        }
        g.terrain.version++;
        show();
        flush();
        yield;
      }
      if (mode === 1) for (const p of layers[4]) put(p.x, p.y, 0);
    }
  }
  if (mode === 0 || mode === 2) {
    for (let i = 0; i < 104; i++) {
      if (sound) tone(R(500));
      flash();
    }
    stop();
    flush();
    yield;
    const make = () => {
      if (sound) tone(R(500));
      return { x: dead.x - 11, y: dead.y - 31, vx: 0.5 - U(), vy: 0.1 - U(), stopped: false };
    };
    const step = (p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.006999999999997897;
      p.vx += g.wind / 5000;
      const x = Math.trunc(p.x),
        y = Math.trunc(p.y),
        c = read(x + 11, y + 31);
      if (c === 2 || c === 13) p.stopped = true;
      contact(x + 11, y + 31, mode === 0 ? 5 : 10, 10);
      if (x > (mode === 0 ? 320 : 298) || x < 0 || y > (mode === 0 ? 200 : 158) || y < 0)
        p.stopped = true;
      tone(1500 + 5 * (dead.y - 31 - y));
      if (mode === 0) flash();
      put(x + 11, y + 31, 20 + dead.id);
    };
    function* landing(p) {
      const base = 130 + 10 * R(3),
        q = R(10),
        scale = q < 3 ? 1 : q < 6 ? 2 : q < 8 ? 3 : q === 8 ? 4 : 5,
        r = 4 * scale,
        x = Math.trunc(p.x) + 11,
        y = Math.trunc(p.y) + 31;
      if (mode === 0) stop();
      for (let radius = 0; radius <= r; radius++) {
        ring(x, y, radius, base + Math.trunc(radius / scale));
        if (sound) tone(R(2500), 8);
        flash();
        show();
        flush();
        yield 0.008;
      }
      for (let radius = r; radius >= 0; radius--) {
        ring(x, y, radius, 0);
        if (sound) tone(R(2500), 8);
        flash();
        show();
        flush();
        yield 0.008;
      }
      g.terrain.version++;
    }
    if (mode === 0) {
      for (let i = 0; i < 11; i++) {
        const p = make();
        let steps = 0;
        do {
          step(p);
          if (++steps % 8 === 0) {
            show();
            flush();
            yield;
          }
        } while (!p.stopped);
        yield* landing(p);
      }
    } else {
      const particles = Array.from({ length: 11 }, make);
      let active;
      do {
        active = false;
        flash();
        for (const p of particles)
          if (!p.stopped) {
            active = true;
            step(p);
          }
        show();
        flush();
        yield;
      } while (active);
      for (const p of particles) yield* landing(p);
    }
    for (let pair = 0; pair < 15; pair++) {
      const radius = 2 * pair + 1,
        color = 130 + 10 * (pair % 3) + Math.floor(pair / 3);
      for (let half = 0; half < 2; half++) {
        ring(dead.x, dead.y, radius + half, color, mode === 0);
        for (let i = 0; i < 5; i++) {
          if (sound) tone(R(1300 - 40 * radius), half === 1 && i === 4 ? 8 : CPU_WRITE_MS);
          flash();
        }
      }
      show();
      flush();
      yield 0.008;
    }
    let counter = 16;
    for (let a = 4; a >= 0; a--)
      for (let b = 4 - a; b >= 0; b--) {
        counter--;
        if (sound) tone(R(mode === 0 ? 600 + 100 * b : 200));
        R(63);
        R(63);
        R(63);
        stop();
        for (let ch = 0; ch < 3; ch++) {
          const rgb = [0, 0, 0];
          rgb[ch] = Math.round((Math.trunc((63 * b) / 4) * 255) / 63);
          deathPalette[130 + 10 * ch + a] = `rgb(${rgb.join(',')})`;
        }
      }
    clearDisk(dead.x, dead.y, 30);
    clearDisk(dead.x + 1, dead.y, 30);
  }
  for (const [k, c] of pixels) if (c !== 2) g.terrain.set(k % 320, Math.floor(k / 320), 0);
  stop();
  flush();
  eraseBody();
  g.deathVisual = null;
}
