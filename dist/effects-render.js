// Original 16-bit ellipse and blast palette algorithms. File offsets and tests:
// research/explosion-visuals.md. All coordinates are logical 320x200 pixels.
export const EXPLOSION_DELAY_MS = 8;
export const EXPLOSION_PALETTE_BASE = 130;

// EXE 0xe671..0xe85c (cc8:351). This is the game's four-way midpoint
// ellipse, not a Canvas arc or the usual eight-way midpoint circle.
export function bgiEllipse(cx, cy, rx, ry, plot) {
  cx = Math.trunc(cx);
  cy = Math.trunc(cy);
  rx = Math.trunc(rx);
  ry = Math.trunc(ry);
  if (rx < 0 || ry < 0) return;
  const a = rx * rx,
    b = ry * ry;
  let dx = 0,
    dy = 2 * a * ry,
    error = Math.floor(a / 4) + b - a * ry;
  let x = 0,
    y = ry,
    stepX = 0,
    stepY = 0,
    remaining = ry;
  const write = () => {
    x += stepX;
    y -= stepY;
    plot(cx + x, cy + y);
    plot(cx + x, cy - y);
    plot(cx - x, cy + y);
    plot(cx - x, cy - y);
  };
  while (dx < dy) {
    write();
    stepX = 1;
    stepY = 0;
    if (error >= 0) {
      stepY = 1;
      remaining--;
      dy -= 2 * a;
      error -= dy;
    }
    dx += 2 * b;
    error += dx + b;
  }
  error += Math.floor((Math.floor((a - b) / 2) + (a - b) - dx - dy) / 2);
  do {
    write();
    stepX = 0;
    stepY = 1;
    if (error < 0) {
      stepX = 1;
      dx += 2 * b;
      error += dx;
    }
    dy -= 2 * a;
    error -= dy - a;
    remaining--;
  } while (remaining >= 0);
}

const blastMaps = new Map();
// Raster order matters: the last outer circle overwrites intersecting inner
// circles. The companion centers in the original are +1, -1, then 0.
export function blastRaster(radius) {
  radius = Math.max(0, Math.trunc(radius));
  if (blastMaps.has(radius)) return blastMaps.get(radius);
  const width = 2 * radius + 3,
    height = 2 * radius + 1,
    indices = new Int16Array(width * height).fill(-1);
  for (let r = 0; r <= radius; r++)
    for (const dx of [1, -1, 0])
      bgiEllipse(dx, 0, r, r, (x, y) => {
        indices[(y + radius) * width + x + radius + 1] = r;
      });
  const result = { radius, width, height, left: -radius - 1, top: -radius, indices };
  blastMaps.set(radius, result);
  return result;
}

// The game's configured waits exist even with sound disabled. Tight-loop CPU
// overhead is optional; using the audio writer estimate keeps both timelines
// aligned without pretending that busy-loop duration came from the binary.
export function blastTimeline(radius, delayMs = EXPLOSION_DELAY_MS, cpuWriteMs = 0) {
  radius = Math.trunc(radius);
  const frames = [];
  let ms = (radius + 1) * cpuWriteMs;
  for (let phase = 0; phase < 3; phase++)
    for (let step = 0; step <= radius; step++) {
      ms += (phase === 1 ? step + 1 : radius - step + 1) * cpuWriteMs;
      frames.push({ phase, step, at: ms / 1000 });
      ms += delayMs;
    }
  return { frames, expansionSeconds: ((radius + 1) * cpuWriteMs) / 1000, duration: ms / 1000 };
}

// DAC values, not 8-bit RGB. Initially green and blue are zero and only red
// is updated, including in all three subsequent palette cycles.
export function blastPalette(radius, phase = -1, step = 0) {
  radius = Math.trunc(radius);
  const unit = radius > 0 ? Math.trunc(63 / radius) : 0,
    palette = new Uint8Array(radius + 1);
  for (let j = 0; j <= radius; j++) {
    const level =
      phase < 0
        ? radius - j
        : phase === 0
          ? radius - Math.max(0, j - step)
          : phase === 1
            ? radius - Math.max(0, step - j)
            : Math.max(0, j - step);
    palette[j] = level * unit;
  }
  return palette;
}
export function blastState(effect) {
  const radius = Math.trunc(effect.max),
    timeline = (effect.visualTimeline ??= blastTimeline(
      radius,
      effect.delayMs ?? EXPLOSION_DELAY_MS,
      effect.cpuWriteMs ?? 0,
    ));
  const age = effect.age ?? 0;
  let phase = -1,
    step = 0;
  for (const f of timeline.frames) {
    if (f.at > age) break;
    phase = f.phase;
    step = f.step;
  }
  const expansion = timeline.expansionSeconds;
  return {
    phase,
    step,
    palette: blastPalette(radius, phase, step),
    radius:
      expansion > 0 && age < expansion
        ? Math.min(radius, Math.floor((age / expansion) * (radius + 1)))
        : radius,
    done: age >= timeline.duration,
  };
}
export function drawBlast(renderer, effect) {
  const state = blastState(effect),
    map = blastRaster(state.radius),
    cx = Math.trunc(effect.x),
    cy = Math.trunc(effect.y);
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      const index = map.indices[y * map.width + x];
      if (index < 0) continue;
      const red = Math.round((state.palette[index] * 255) / 63);
      renderer.rect(cx + map.left + x, cy + map.top + y, 1, 1, `rgb(${red},0,0)`);
    }
}

// Sonic uses a five-pixel cross, not an expanding ring. A frame supplied by
// sonicSound's optional capture contains the original interleaved RNG draws.
export function sonicFrame(effect) {
  return effect.visualFrames?.[
    Math.min(199, Math.floor(((effect.age ?? 0) * 1000) / (effect.delayMs ?? 8)))
  ];
}
export function drawSonic(renderer, effect) {
  const frame = sonicFrame(effect);
  if (!frame) return;
  const color = `rgb(${Math.round((frame.red * 255) / 63)},0,0)`,
    x = Math.trunc(effect.x),
    y = Math.trunc(effect.y);
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ])
    renderer.rect(x + dx, y + dy, 1, 1, color);
}
