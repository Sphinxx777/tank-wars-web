import { SoundSequence, CPU_WRITE_MS } from './sound.js';

// The original fast VGA sweeps have no Delay. This is explicit browser pacing.
export const LIGHTNING_SWEEP_SECONDS = 1 / 60;

// Pascal Real has a 40-bit significand. Round each original arithmetic operation,
// rather than rounding the final coordinate; the independent oracle exposes this.
export function real40(value) {
  if (value === 0) return 0;
  const step = 2 ** (Math.floor(Math.log2(Math.abs(value))) - 39);
  return Math.sign(value) * Math.floor(Math.abs(value) / step + 0.5) * step;
}
export function lightningPoint(start, end, y, walk, initial = false) {
  const slope = real40((end - start) / 189);
  const term = initial
    ? real40(((((y - 189) * walk) << 16) >> 16) / 189)
    : real40(real40((y - 189) / 189) * walk);
  return start + Math.trunc(real40(real40(y * slope) + term));
}
export function lightningDue(cycles, deathThisPass, rng) {
  return !deathThisPass && cycles > 10 && cycles > rng.int(100);
}

export function* lightningEffect(game, tankPixel, endpoints = null) {
  const start = endpoints?.xStart ?? 10 + game.rng.int(300);
  const end = endpoints?.xEnd ?? 10 + game.rng.int(300);
  let walk = 0;
  let path = Array.from({ length: 159 }, (_, index) => {
    walk += game.rng.int(7) - 3;
    return lightningPoint(start, end, index + 31, walk, true);
  });
  const passes = 1 + game.rng.int(8);
  for (let pass = 0; pass < passes; pass++) {
    walk = 0;
    const nextPath = [];
    for (let index = 0; index < path.length; index++) {
      const x = path[index],
        y = index + 31;
      const target = game.players.find((player) => player.alive && tankPixel(player, x, y));
      if (target) game.hurt(target, 3, game.active, 'lightning', true);
      walk += game.rng.int(7) - 3;
      nextPath.push(lightningPoint(start, end, y, walk));
    }
    game.lightningVisual = path;
    yield LIGHTNING_SWEEP_SECONDS;
    const tones = new SoundSequence();
    for (let index = 0; index < path.length; index++) {
      for (const dx of [0, 1, -1]) game.terrain.set(path[index] + dx, index + 31, 0);
      if (game.options.sound) tones.tone(600 + game.rng.int(600), CPU_WRITE_MS);
    }
    game.terrain.version++;
    game.lightningVisual = null;
    game.audio(tones.stop());
    path = nextPath;
    yield LIGHTNING_SWEEP_SECONDS;
  }
  for (const player of game.players)
    if (player.alive && player.men === 0) game.recordDeath(player, game.active);
  const weapon = Math.trunc(passes / 3) || 11;
  // Dummy player zero owns the original blast: no per-man score is awarded.
  // Later kills still belong to the current shooter, as for the bolt itself.
  game.explode(end, 189, game.weapons[weapon].radius, game.active, 'lightning');
  game.terrainResolved = false;
}
