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
export function tankColor(id, men = 100) {
  const value = Math.max(0, Math.trunc((63 * men) / 100));
  return (
    '#' +
    DIVISORS[id]
      .map((d) =>
        Math.round((Math.trunc(value / d) * 255) / 63)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export const PLAYER_COLORS = DIVISORS.map((_, i) => tankColor(i));
export const SCREEN_COLOR = '#392428';
