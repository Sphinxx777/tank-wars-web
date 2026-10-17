# Original BGI line raster and stroke direction

The remaining shop differences were **not** caused by font payloads or by a need to hard-code title pixels. Two details resolve them universally:

1. The original VGA256 BGI driver uses an integer half-major-axis accumulator and preserves the supplied endpoint order.
2. The BGI stroke-font renderer calls the line routine **from the new glyph point to the preceding glyph point**, opposite to the common previous→new implementation.

Applying both gives **64000/64000 exact RGB pixels** for the full production shop compared with `screenshots/shop-reference.rgb`. This includes the player title, weapon names, quantities, costs, frames and background. This is one complete original reference state; the algorithm itself was decoded from the executable and contains no name-specific, glyph-specific or coordinate-specific exceptions.

## Exact line algorithm

See `bgi-line.mjs` for a small directly reusable implementation. Inputs are integer screen coordinates and an emit callback. Inclusive endpoints, all octants, no endpoint sorting:

```js
const dx = Math.abs(x1-x0), dy = Math.abs(y1-y0);
const horizontal = dx > dy;
const major = horizontal ? dx : dy;
const minor = horizontal ? dy : dx;
let error = Math.floor(major / 2);
plot(x0, y0);
for (let i=0; i<major; i++) {
  stepAlongMajorAxis();
  error += minor;
  if (error >= major) {
    stepAlongMinorAxis();
    error -= major;
  }
  plot(x0, y0);
}
```

The signs come from the original endpoints. Reversing a segment can change its tie pixels, which is why the font's call direction matters. The major-axis test is strict `dx > dy`; equality uses the vertical branch (the resulting45° pixels are the same).

**Source:** BOMB.EXE file offsets `0x82bc..0x8442` (SHA-256 `659ace6b9a97c30191a8f65cf25f22322c087166909e9fa1d522e529adbafd9d`).

- `0x82c2..0x830f`: dx/dy magnitudes and signed steps.
- `0x8310..0x8340`: first endpoint.
- `0x8343..0x834a`: choose major axis.
- `0x834c..0x8351`: initial `dx >> 1` accumulator for the horizontal branch.
- `0x835c..0x837b`: major step, add minor, compare with major using `jl` (therefore the opposite branch is `>=`), minor step, subtract major.
- `0x83ba..0x8442`: corresponding vertical branch.

## Exact stroke direction

BOMB.EXE `0x1330a..0x13319`:

```asm
call 0x13394           ; ax,bx = newly decoded and scaled glyph point
mov cx,ax
mov dx,bx
xchg [0x1602],cx       ; cx receives previous x; state receives new x
xchg [0x1604],dx       ; dx receives previous y; state receives new y
call 0x134b1           ; line from ax,bx (NEW) to cx,dx (OLD)
```

`0x134b1..0x134f2` transforms the glyph coordinate system into screen coordinates, applies clipping, and invokes driver line operation `si=0xc`. It does not sort the endpoints for the unclipped shop glyphs.

In the JavaScript font renderer, retain the current extraction and position calculations but change:

```js
this.line(px, py, nx, ny, color);
```

to:

```js
this.line(nx, ny, px, py, color);
```

This applies to the original stroke fonts, including Tiny/Litt/Euro. It should not globally reverse application-authored ordinary lines. The existing `bgiText` supplies exact integer glyph coordinates; the older generic `text` uses floating scales, whose coordinate conversion is outside this small raster correction.

## Verification

```sh
node tools/verify-bgi-raster.mjs
```

The script renders the production shop using its actual fonts/layout with only the decoded line and stroke-direction changes. It compares all64000 RGB pixels to the original and asserts zero differences. No browser or DOS state is changed.

`tools/compare-bgi-line.mjs` retains the bounded diagnostic experiment: original direction gives47 differences; sorting endpoints in various ways gives19–29; reversing each segment with the decoded accumulator gives0. The zero-difference result is explained by the disassembly above, not merely selected by visual fitting.
