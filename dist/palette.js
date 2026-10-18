// Player RGB divisors: OVR 0x91e..0xa79; intensity helper 0x1f2cf..0x1f339.
const DIVISORS = [
  [1, 32767, 32767],
  [32767, 1, 32767],
  [32767, 32767, 1],
  [1, 1, 32767],
  [32767, 1, 1],
  [1, 32767, 1],
  [1, 1, 1],
  [1, 2, 32767],
  [1, 32767, 2],
  [1, 2, 2],
];
export const EGA = [
  '#000000',
  '#0000aa',
  '#00aa00',
  '#00aaaa',
  '#aa0000',
  '#aa00aa',
  '#aa5500',
  '#aaaaaa',
  '#555555',
  '#5555ff',
  '#55ff55',
  '#55ffff',
  '#ff5555',
  '#ff55ff',
  '#ffff55',
  '#ffffff',
];
export function tankRGB(id, men = 100) {
  const value = Math.max(0, Math.trunc((63 * men) / 100));
  return DIVISORS[id].map((divisor) => Math.trunc(value / divisor));
}
export function dacColor(rgb) {
  return (
    '#' +
    rgb
      .map((value) =>
        Math.round((value * 255) / 63)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function tankColor(id, men = 100) {
  return dacColor(tankRGB(id, men));
}
export const TRAIL_COLORS = DIVISORS.map((values) =>
  dacColor(values.map((divisor) => Math.trunc(32 / divisor))),
);
export const PLAYER_COLORS = DIVISORS.map((_, i) => tankColor(i));
export const SCREEN_COLOR = '#392428';
