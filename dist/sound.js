// Reconstructed Sound/NoSound/Delay calls; provenance in research/sound-effects.md.
export const PIT_CLOCK = 1193181;
// Tight DOS loops have no Delay. This is an explicit CPU pacing approximation,
// not a duration from the binary (rendering/port I/O depends on the DOS CPU).
export const CPU_WRITE_MS = 0.035;
export const SHOT_FREQUENCIES = [
  111, 222, 333, 444, 555, 666, 777, 888, 999, 1111, 1333, 1777, 2111,
];
export class SoundSequence {
  constructor() {
    this.events = [];
    this.ms = 0;
  }
  tone(hz, ms = 0) {
    this.events.push([this.ms, Math.trunc(hz) & 65535]);
    this.ms += ms;
    return this;
  }
  wait(ms) {
    this.ms += ms;
    return this;
  }
  stop() {
    this.events.push([this.ms, null]);
    return this;
  }
  append(other) {
    for (const [t, f] of other.events) this.events.push([this.ms + t, f]);
    this.ms += other.ms;
    return this;
  }
}
export function launchSound(laser = false) {
  const s = new SoundSequence(),
    delays = laser
      ? [6, 6, 9, 9, 9, 9, 9, 9, 9, 20, 33, 33, 40]
      : [3, 3, 5, 5, 5, 5, 5, 5, 5, 9, 13, 17, 20];
  SHOT_FREQUENCIES.forEach((f, i) => s.tone(f, delays[i]));
  return s.stop();
}
export function controlSound(kind) {
  const s = new SoundSequence();
  if (kind === 'flip') for (const f of [1750, 2000, 1500, 1250]) s.tone(f, 5);
  else s.tone({ angleUp: 1750, angleDown: 2000, powerDown: 1500, powerUp: 2500 }[kind], 10);
  return s.stop();
}
export function blastSound(radius, rng, delay = 8) {
  const s = new SoundSequence(),
    R = (n) => rng.int(n);
  for (let r = 0; r <= radius; r++) s.tone(500 + R(500), CPU_WRITE_MS);
  for (let phase = 0; phase < 3; phase++)
    for (let i = 0; i <= radius; i++) {
      const count = phase === 1 ? i + 1 : radius - i + 1;
      for (let j = 0; j < count; j++)
        s.tone((phase === 0 ? 250 : 3) + R(phase === 2 ? 250 : 500), CPU_WRITE_MS);
      s.wait(delay);
    }
  return s.stop();
}
export function sonicSound(rng, enabled = true, delay = 8, frames = null) {
  const s = new SoundSequence();
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < 100; i++) {
      const red = rng.int(64),
        ground = pass ? Array.from({ length: 3 }, () => 32 + rng.int(32)) : null;
      frames?.push({ red, ground });
      if (enabled) s.tone(3000 + 500 * pass + rng.int(1000));
      s.wait(delay);
    }
  return s.stop();
}
export function laserCharge(delay = 5) {
  const s = new SoundSequence();
  for (let i = 1; i <= 100; i++) s.tone(50 * i, CPU_WRITE_MS);
  for (let pass = 1; pass <= 2; pass++) {
    for (let i = 1; i <= 100; i++) s.wait(Math.trunc(delay / pass)).tone(50 * i);
    for (let i = 100; i >= 1; i--) s.wait(Math.trunc(delay / pass)).tone(50 * i);
  }
  for (let i = 1; i <= 100; i++) s.tone(50 * i, Math.trunc(delay / 2));
  return s.append(launchSound(true));
}
export function criDirectSound() {
  const s = new SoundSequence();
  for (let f = 1000; f <= 30000; f++) s.tone(f, CPU_WRITE_MS);
  for (let f = 30000; f >= 1000; f--) s.tone(f, CPU_WRITE_MS);
  return s.stop();
}
export function lightningSound(rng, enabled = true) {
  const s = new SoundSequence();
  rng.int(300);
  rng.int(300);
  for (let y = 31; y <= 189; y++) rng.int(7);
  const waves = 1 + rng.int(8);
  for (let pass = 0; pass < waves; pass++) {
    for (let y = 31; y <= 189; y++) rng.int(7);
    for (let y = 31; y <= 189; y++) if (enabled) s.tone(600 + rng.int(600), CPU_WRITE_MS);
    s.stop();
  }
  if (enabled) s.append(blastSound([2, 10, 15][Math.trunc(waves / 3)], rng));
  return s;
}
export function deathSweep(mode, delay = 8) {
  const s = new SoundSequence();
  for (let pass = 0; pass < (mode === 6 ? 3 : 1); pass++)
    for (let i = 0; i <= 100; i++) s.tone(2000 + 100 * i, delay || CPU_WRITE_MS);
  for (let i = 100; i >= (mode === 5 ? 0 : 1); i--) s.tone(2000 + 100 * i, delay || CPU_WRITE_MS);
  return s.stop();
}
// Shared by browser AudioWorklet and offline tests: one PIT voice, including
// 16-bit wrapping, ignored <=18 Hz writes and odd-divisor mode-3 duty cycle.
export class PITVoice {
  constructor(rate = 48000) {
    this.rate = rate;
    this.phase = 0;
    this.divisor = 0;
    this.enabled = false;
  }
  write(hz) {
    if (hz === null) {
      this.enabled = false;
      return;
    }
    hz = Math.trunc(hz) & 65535;
    if (hz <= 18) return;
    const reset = !this.enabled;
    this.divisor = Math.floor(PIT_CLOCK / hz) || 65536;
    this.enabled = true;
    if (reset) this.phase = 0;
    else this.phase %= this.divisor;
  }
  sample() {
    if (!this.enabled) return 0;
    const d = this.divisor,
      step = PIT_CLOCK / this.rate,
      high = Math.ceil(d / 2),
      area = (x) => {
        const n = Math.floor(x / d),
          r = x - n * d;
        return n * (2 * high - d) + (r <= high ? r : 2 * high - r);
      };
    const value = (area(this.phase + step) - area(this.phase)) / step;
    this.phase = (this.phase + step) % d;
    return value * 0.12;
  }
}
export class PCSpeaker {
  constructor() {
    this.context = null;
    this.node = null;
    this.loading = null;
    this.until = 0;
    this.pending = [];
  }
  unlock() {
    if (!this.context) {
      try {
        this.context = new AudioContext();
        this.loading = this.context.audioWorklet
          .addModule(new URL('./speaker-worklet.js', import.meta.url))
          .then(() => {
            this.node = new AudioWorkletNode(this.context, 'tank-wars-pit', {
              numberOfInputs: 0,
              numberOfOutputs: 1,
              outputChannelCount: [1],
            });
            this.node.connect(this.context.destination);
            for (const [s, q] of this.pending) this.play(s, q);
            this.pending = [];
          })
          .catch((e) => {
            console.error('PC Speaker:', e);
            this.pending = [];
          });
      } catch (e) {
        console.error('PC Speaker:', e);
        return;
      }
    }
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
  }
  play(sequence, queue = true) {
    if (!this.context) return;
    if (!this.node) {
      this.pending.push([sequence, queue]);
      return;
    }
    const now = this.context.currentTime + 0.006,
      start = queue ? Math.max(now, this.until) : now;
    this.until = start + sequence.ms / 1000;
    this.node.port.postMessage({
      events: sequence.events.map(([t, f]) => [
        Math.round((start + t / 1000) * this.context.sampleRate),
        f,
      ]),
      replace: !queue,
    });
  }
  stop() {
    this.pending = [];
    this.until = 0;
    this.node?.port.postMessage({ stop: true });
  }
}
