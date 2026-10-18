# Ordinary projectile audit

Read-only inspection of the original Tank Wars 3.2 executable and overlay,
2026-10-18. All addresses below are hexadecimal file offsets. Findings compare
the implementation at the beginning of this audit; subsequent fixes may already
address them. No whole-game equivalence is implied.

## Confirmed corrections

1. **Repulsion precedes guidance.** OVR `0x1148d–0x11731` applies all repulsers,
   then `0x1173c–0x11908` applies guidance. A vertically guided projectile aligned
   within two pixels of its target must leave the step with `vx=0`, even inside a
   repulser field. Horizontal guidance similarly zeros `vy` after repulsion.
   The initial JavaScript implementation reversed these stages.
2. **Repulser angle is quantized before lookup.** At `0x11640–0x1169b`, use
   `trunc(atan(dy/dx)*180/pi)`, adding 180 when `dx<0`; if `dx==0`, use 90 when
   `dy>0`, otherwise 270. Calls at `0x1169e` and `0x116d0` are the original
   integer-degree cosine and sine lookup helpers. `trunc(atan2(...))` differs by
   one degree for some negative-x vectors: `dx=-10,dy=3` gives 164, whereas the
   atan2 expression gives 163. Use the extracted `cosDeg` and `sinDeg` values.
3. **Cache integer position before guidance.** `0x1141e–0x11441` truncates x/y
   immediately after integration. Repulsion, guidance comparisons, collision,
   and projectile display use those cached values. Vertical guidance changes
   real y by half a pixel without refreshing the cached collision center.
4. **Wall checks follow collision classification.** The five-pixel scan runs
   only when cached x>11, x<309, y>33, y<187 and the shot is not already stopped
   (`0x11a05–0x11a32`). After this scan, `0x11b60` skips wall handling. Outside
   that rectangle, the branch enters walls at `0x11b63`. Applying walls first
   can change guidance/reflection ordering and warp a projectile before the
   original would sample its position.
5. **Dirt does not always overwrite the stop flag.** `0x11a97–0x11abf` sets it
   when power<threshold or the subdivision index equals subdivision count;
   only power==threshold explicitly clears it. With high power on an
   intermediate step, dirt leaves a prior tank collision intact. A useful
   regression puts the target at (100,100), the projectile at (105,100), and
   dirt at (106,100): the cross hits the tank's rightmost tread first, then dirt.
   At power1000, men100, the hit must not disappear.
6. **Velocity cutoff is 30, not 500.** `0x11f94–0x11fd3` compares abs(vx) and
   abs(vy) against Pascal Real `(0x85,0,0x7000)`, which decodes to 30. Exceeding
   either sets both finished and impact-enabled flags. The impact dispatcher
   still executes at `0x12048–0x1206e`. This matters for accelerating walls.

## Projectile and trail pixels

The ordinary projectile is a **five-pixel cross**, palette19, not one white
pixel. Resident EXE `0x5d73–0x5dbc` writes center, above, below, left and right.
OVR `0x11f14–0x11f1a` calls that routine for a visible projectile. Palette19 is
initialized white at `0x11296–0x112a6`, becomes red after guidance actually
adjusts a shot (`0x118f0–0x11904`), and becomes blue after a Sonic/dirt projectile
bounces off tank pixels (`0x11b3a–0x11b48`).

Independent execution of the original resident routine with Unicorn, an empty
VGA buffer, and arguments x=80,y=80 produced exactly these nonzero pixels:

```text
(80,79)=19
(79,80)=19
(80,80)=19
(81,80)=19
(80,81)=19
```

Trails use palette `100-oneBasedPlayerIndex`, initialized to VGA RGB
`[32/redDivisor,32/greenDivisor,32/blueDivisor]` with integer division
(`0x11246–0x1128a`). Thus player1's trail is VGA(32,0,0), approximately CSS
`#820000`, rather than the full-bright tank color. Every old integer center is
written when trails are enabled (`0x1196d–0x11982`), not every third browser
simulation iteration. Resident helper `0x5f1d–0x5f41` writes that pixel both to
VGA and to the restoration buffer.

The visible projectile also has four magenta border position markers:
(x,29), (x,191) when x is 9..311; (9,y), (311,y) when y is 29..191.
See `0x11f1f–0x11f70`. Their previous positions are erased at
`0x11987–0x119f4`. These show where an offscreen projectile is traveling.

## Further cautions, not a completed translation

- The original subdivision counter increments and resets to **zero only when
  greater than S**, not when equal (`0x1130f–0x11325`). Its entry value is left
  by the preceding player/repulser scan. This deserves an isolated original
  routine execution before changing high-power dirt penetration cadence.
- The original timeout is a long-word outer counter greater than1000
  (`0x11e62–0x11e76`), not directly a wall-clock duration. Timeout enables an
  impact. High exit y<-5000 instead disables the impact (`0x11e82–0x11ee2`).
- No-wall early exit has strict directional velocity and wind tests and
  excludes guided shots (`0x11dc9–0x11e62`). It is not equivalent to discarding
  every outward-moving shot with zero wind. These endpoints feed Lobber history.
- MIRV uses a separate routine, including adaptive child subdivisions; do not
  assume every ordinary-shot rendering or termination branch applies to it.
- Trail colors are background palette indices. Their writes to the restoration
  buffer can affect later framebuffer reads. A separate decorative trail layer
  alone does not prove identical collision behavior.

## Implemented in this pass

The native engine now uses repulsion before guidance, cached pre-guidance pixel
coordinates, the strict collision rectangle, preserved tank hits when a later
high-power dirt sample does nothing, and the speed-30 impact cutoff. Rendering
uses the five-pixel cross, conditional red/blue colors, dim trails at every old
integer center, and border markers. Flight substeps accumulate elapsed time so
30, 60 and 144 Hz presentation produces the same simulation steps. Gun geometry
and launch trigonometry use the separately executed Pascal runtime table (see
`laser-original.md`), while repulsion retains the original AI table. The cautions
above remain open and are listed on the public accuracy page.
