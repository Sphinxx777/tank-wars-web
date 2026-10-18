# Dirt weapons: original raster, particle order, and collapse

Original-instruction research, 2026-10-19, using the local Tank Wars 3.2
`BOMB.EXE` and `BOMB.OVR`. All addresses below are hexadecimal file offsets.
The browser implementation is not used to create the expected results.

## Dirt Clod, Dirt Ball, Dirt Bomb, and Mountain Mover (13–16)

OVR `0x19f02..0x1a0a4` assigns radii 10, 15, 30, and 60. The viewport is
inclusive `(11,31)..(309,189)`. Impact coordinates are converted to that viewport.
For every radius from zero through the selected radius, inclusive, the game draws
three outlines centered at `x+1`, `x-1`, and `x`, in that order, in earth color 2.
These are Borland Graph **Circle** calls (`e26:11ea`), not the game's custom
ellipse used for blast palette rings. There is no local random call, damage
call, speaker call, or fixed Delay in this branch. The expanding appearance is
successive outline writes, with a duration determined by the DOS CPU/driver.
A browser presentation delay, if used, is an explicit adaptation, not a recovered
millisecond constant.

### Exact generic BGI Circle

The public Circle wrapper is EXE `0x10aea`. It supplies start/end angles 0/360
and equal axes after aspect correction; the game configures aspect 1:1. The VGA256
ellipse stub falls through the runtime adapter beginning at EXE `0x11b23`.
The unfilled-circle fallback entry is `0x12346`, its outline preparation is
`0x124a9`, and the generic integer ellipse core is `0x12913..0x12a4e`.
The final four-point path calls `0x12b8a`. The oracle runs the complete fallback
entry, including arc endpoint setup and the original integer arithmetic, and
captures only the final pixel callback. It avoids OS/video initialization; line
width is one and color conversion is bypassed. The original driver mode data at
EXE `0x8013` gives maxY 199 and physical-height value 7000; initialization
`0x11da0..0x11db0` therefore selects the non-polyline branch with metric
`floor(199*1000/7000)+1 = 29`, below the branch threshold 180. Viewport clipping of captured
coordinates is applied separately when hashing complete dirt disks.

This raster differs from both a mathematical disk and the custom blast ellipse.
In particular, radius zero is promoted to one by the generic ellipse, and radius
four includes diagonal pixels at `(±3,±3)`. These are not errors in the fixture.

For equal nonnegative integer axes up to the largest dirt radius, the original
32-bit arithmetic simplifies exactly to:

```js
r = Math.max(1, r);
let x = 0, y = r, dx = 0, dy = 200 * r, error = 0;
// plot emits (+x,+y), (-x,+y), (+x,-y), (-x,-y), including duplicates.
while (dx < dy) {
  plot(x, y);
  const nx = dx + 100, ny = dy - 100;
  if (2 * error + 2 * nx >= ny) {
    y--; error -= ny; dy = ny - 100;
  }
  x++; error += nx; dx = nx + 100;
}
do {
  plot(x, y);
  const nx = dx + 100, ny = dy - 100;
  if (Math.floor(nx / 2) + error <= ny) {
    x++; error += nx; dx = nx + 100;
  }
  y--; error -= ny; dy = ny - 100;
} while (y >= 0);
```

Independent checks: `tools/verify-dirt-oracle.py` executes the original machine
instructions and writes `tests/fixtures/dirt-oracle.json`. Its 61 circle hashes
cover every radius 0–60. Its 12 complete dirt-disk hashes cover every weapon
radius, a central impact, and impacts clipped at each opposite playfield corner.
The simplified formula above matches all 61 circle hashes. Hashes are SHA-256
of a full 320×200 byte framebuffer, with earth encoded as 2 and everything else
as 0. No executable bytes are placed in the fixture.

## Explosive Dirt (17)

OVR `0x1a0c3..0x1a3eb` performs this sequence:

1. Draw `N = 300 + R(100)` and `L = 3 + R(8)` once. One shared N is used for
   all layers.
2. Prepare **all** `N * L` points before drawing the first one. Layer order is
   1 through L; point order is 1 through N. For each point:
   `h = R(20 * layer)`, then `offset = trunc(R(h + 1) - h / 2)`.
   The absolute point is `(11 + trunc(impactX - 11) + offset,
   31 + trunc(impactY - 31) - h + 2)`. Normal in-field impacts simplify to
   `trunc(impactX) + offset, trunc(impactY) - h + 2`.
3. Draw the prepared points in that same layer/point order in earth color 2.
   The viewport clips writes, but there is no occupancy test: previously drawn
   dirt, background, and tank-colored pixels can all be overwritten. There is
   no direct hit or radial damage call.
4. Immediately after **each** attempted point write, if sound is on, play
   `100 * layer + R(200)`. Out-of-viewport points still consume this sound RNG.
   There is no Delay in preparation or drawing. Positions therefore agree
   between sound on and off for the same incoming RNG state; later RNG differs.
5. Call NoSound unconditionally, restore the full viewport, and draw one
   floating Random value. Call the full crumble routine immediately when
   `Random() * 100 < 2 * crumbleSetting`. This is a strict comparison.

The fixture executes all original Pascal Real operations, loop instructions,
and comparisons for four runs. Graphics, sound, and Random are intercepted.
Its synthetic integer random function is explicitly
`(zeroBasedCallIndex * 13 + randomSalt) % limit`; the final floating roll is
supplied separately. Captured fields include every prepared/drawn point, the
integer RNG count, sound count and ordered frequency hash, stop/collapse point
counts, and clipped framebuffer hash. This verifies 8,779 point coordinates,
including a sound-on/off pair and the equality case at setting 25 / roll 0.5.
At setting zero / roll zero, the strict comparison also declines to crumble.

## Relationship to ordinary settlement

The Explosive Dirt branch's immediate collapse is additional to the ordinary
post-shot settlement pass. The latter is OVR `0x1ad57`, with its own floating
Random gate and `Random()*100 <= crumbleSetting` condition, followed by the
resident crumble routine EXE `0x5e46`. Ordinary dirt 13–16 does not have the extra
Explosive Dirt gate. No direct sound occurs in the crumble routine.

A single boolean `forceCrumble` merged with the ordinary settlement gate can
reproduce much of the visible result, but it suppresses the second gate's random
consumption when true and moves the first collapse to a later phase. For exact
ordering, preserve the immediate branch collapse and subsequent ordinary gate as
separate operations. Existing `research/advanced-weapons.md` and
`tools/verify-crumble-oracle.py` document and execute the actual crumble sweep
mechanics; this research does not replace them.

The historical wall-clock duration of delayless pixel loops cannot be inferred
from the binary alone. The oracle establishes exact write order, coordinates,
random consumption, sounds, and explicit absence of Delay; it does not measure a
particular DOS machine's speed.

## Browser implementation

`dist/dirt.js` draws each triple-circle radius at 1/240 second and deposits
Explosive Dirt in ordered batches of 64 points at 1/120 second. These presentation
rates expose the original write order without claiming a particular DOS CPU speed.
Coordinates are all prepared before sound RNG, and the immediate crumble generator
finishes before ordinary post-shot settlement. The tests compare every fixture
coordinate and hash, sound order, RNG consumption, strict gate boundaries and
refresh-rate independence. Sound register-write spacing remains an approximation.
