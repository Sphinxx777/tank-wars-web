// Original title palette: BOMB.OVR 0x99..0x109 and 0x480..0x4b6.
export const TITLE_STEP_SECONDS = 0.06;
export const TITLE_COLORS = 20;
export function titleFrame(source, phase, out = new Uint8ClampedArray(320 * 200 * 4)) {
  for (let i = 0; i < 64000; i++) {
    const k = source[i],
      j = i * 4;
    if (k >= 135 && k <= 154) {
      // Turbo Pascal Trunc(6.3 * (i mod 20)); VGA DAC keeps six bits.
      const red = Math.trunc(6.3 * ((k - 135 + phase + 1) % TITLE_COLORS)) & 63;
      out[j] = Math.round((red * 255) / 63);
      out[j + 1] = out[j + 2] = 0;
    } else
      for (let c = 0; c < 3; c++) out[j + c] = Math.round((source[64000 + k * 3 + c] * 255) / 63);
    out[j + 3] = 255;
  }
  return out;
}
