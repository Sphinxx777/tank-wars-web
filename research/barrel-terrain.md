# Buried tanks: barrel rotation removes earth

The tank controls write directly into the VGA framebuffer, rather than drawing
an independent sprite above an intact earth layer. Consequently rotating a
buried gun permanently clears the old barrel path; drawing its new position
also replaces any earth under the new barrel and the body pixels.

## Original control paths

- **Angle commands 1/2:** OVR `0x1b177–0x1b239` calculates the **old** barrel
  endpoints and calls `cc8:ac0` (EXE `0xede0`) to restore that one-pixel line
  from the saved background buffer at `DS:e5c0/e5c2`. It then changes the local
  angle by one degree times the direction (`0x1b23e–0x1b296`), folds local
  angles outside 0..90 and changes direction (`0x1b2af–0x1b3bb`), and invokes
  full tank redraw at `0x1b3be`.
- **Reverse command 6:** OVR `0x1b67f–0x1b741` restores the same old line,
  negates the stored direction at `0x1b746–0x1b75e`, then invokes full tank
  redraw at `0x1b765`. Even a vertical gun is erased/redrawn when reversed.
- **Redraw:** EXE `0x616a–0x6284` writes the 33 body pixels, then the new
  barrel in the tank's palette color. These writes overwrite earth. The
  angle/reverse handlers do not restore the old body first: that is a distinct
  helper at EXE `0x6287–0x6376` used for complete tank erasure.
- There is no preliminary “fully buried” condition. These same writes occur
  whether the tank is buried, partly covered, or standing in open air.
- The command handlers restore and redraw even when the resulting raster is
  identical. They do not carve an entire arc between widely separated angles;
  each individual input restores its own old line and draws its new line.
- Computer commands enter these same control handlers. See
  [AI controls](ai-controls.md), especially command selection EXE
  `0x2b00–0x2e19` and the shared OVR input loop.

The saved background contains sky/background and committed projectile traces;
restoring it reveals those values instead of painting a uniform black pixel.
Earth and the tank are transient foreground writes in the DOS framebuffer.
Neither restoration nor redraw writes a new background pixel, so existing
trace ownership must survive these operations in the native representation.

## Geometry details

The DOS player stores a local angle `a` in 0..90 and a separate direction `d`
in {-1,+1}. The barrel endpoints are:

```
(x, y)
(x + trunc(8 * runtimeCos(a)) * d, y - trunc(8 * runtimeSin(a)))
```

Runtime sine/cosine are the original Real48 procedures, not the AI's lookup
table. In particular, a horizontal barrel extends seven integer pixels because
runtime cos(0) is slightly less than one. Computing cosine using a combined
left-facing angle can also produce a different integer endpoint: full-angle
120 degrees is not interchangeable with local60, direction−1 after Real48
rounding. Original local60 gives x offset−3.

The line routines include both endpoints and normalize the endpoints so drawing
starts from the smaller x coordinate before applying their Bresenham error
steps. This matters for left-facing tie cases. A symmetric-looking algorithm
which always starts at the tank center differs at angles such as119 and129.

No extra circular excavation, thickness, radius10 muzzle clearance, surrounding
body rectangle, or terrain collapse is present in the control handlers. Only
old barrel, body shape, and new barrel pixels are overwritten. Later ordinary
shot/settlement logic handles any subsequent earth motion.

## Executed original-code oracle

`tools/verify-barrel-terrain-oracle.py` executes the old-barrel restoration
fragment and original redraw for all181 combined integer angles, with tank
bottom-center at100,100. The test VGA framebuffer initially contains only earth
palette2; the saved background contains palette99. Captured fixture
`tests/fixtures/barrel-terrain-oracle.json` contains:

- `barrel`: relative coordinates restored to99 by the original old-line routine,
  in framebuffer scan order;
- `drawnPixels`: count of original body+barrel pixels written as tank palette20;
- `drawSha256`: hash of the entire320×200 byte framebuffer after drawing that
  tank over fresh all-earth palette2.

All endpoint arithmetic, Real48 trigonometry, body writes, and line rasterization
execute original instructions. The unrelated object-preparation overlay stub
at `b20:2a` is skipped so the resident redraw can run without the DOS overlay
manager. The fixture contains observations, not copied executable code.

Run locally with the ignored DOS binaries and Unicorn installed:

```sh
PYTHONPATH=/tmp/tankwars-research-pylib python3 tools/verify-barrel-terrain-oracle.py
```
