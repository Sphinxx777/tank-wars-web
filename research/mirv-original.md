# MIRV flight and detonation — original instruction audit

Original Tank Wars 3.2, local `BOMB.OVR`, inspected 2026-10-19. Addresses are
hexadecimal **file offsets**. `tools/verify-mirv-oracle.py` independently executes
selected original machine-code slices, including the original Pascal Real runtime;
it emits `tests/fixtures/mirv-oracle.json`. No game binaries are distributed.

The fixture contains 106 cases: 12 integration cases, five spread modes, 30
adaptive-subdivision cases, nine collision cases, and 50 wall cases. Pixel input
and Random results are injected at I/O calls; the arithmetic, branch conditions,
loop order, and state writes execute original instructions. This is slice-level
evidence, not a complete DOS gameplay recording.

## Separate flight loop

MIRV uses OVR `0x128xx–0x14128`, distinct from ordinary projectiles. It stores a
parent at index 0 and five children at indices 1..5. Both phases use the following
per-active-projectile update (`0x12c52–0x12e08`):

```
x += vx / S
y += vy / S
vy += 0.1 / S
vx += (wind / 5000) / S
pixelX = trunc(x)
pixelY = trunc(y)
```

Each primitive is rounded by the original 40-significant-bit Pascal Real
arithmetic. The cached pixel coordinates are then used for repulsion, collision,
rendering, and boundary classification. Repulsion follows integration, and its
angle lookup/force match the ordinary-projectile routine. Guidance is disabled
on firing (`0x12927`), not merely hidden in the UI.

A sweep advances **each active projectile once**, in stable ascending child
index order. It does not advance child 1 a full physics unit before child 2.
Initially `S=configuredSubdivisions`, normally 10. After each complete child
sweep, set `S=max(1,ceil(configuredSubdivisions/aliveChildren))`
(`0x13c3d–0x13c74`). The **first** child sweep retains the parent's S; recalculation
happens afterward. For configured10, S is 2,3,4,5,10 for 5,4,3,2,1 active children.
Changing S changes both trajectory step size and repulsion force.

A shared substep counter increments once per sweep. When it becomes **greater
than S**, it resets to zero and increments a long-word outer counter
(`0x12c09–0x12c20`). This means S+1 sweeps per group, and a change in S does not
reset the counter. Its initial value is left at playerCount by the player scan
(`0x12b98–0x12be7`). More than1000 groups stops the active projectiles. It is not
a wall-clock timeout. There is no explicit DOS Delay in the flight loop;
browser pacing is necessarily a chosen presentation clock, not recovered DOS CPU
execution speed.

## Parent termination and split

The parent is marked stopped when its **post-repulsion, post-wall** vy is strictly
positive (`0x138d7–0x13907`). It also stops for collision, velocity cutoff, bounds,
and timeout. **Every parent stop leads to splitting**, even terrain/tank impact
before the apex. The parent does not call the blast dispatcher.

Children inherit all four real coordinates/velocities (`0x13cb4–0x13d3a`), then
receive these velocity offsets; they do not receive a positional fan:

| Mode | Child 1..5 offsets `(vx,vy)` |
|---|---|
| Random | Each axis independently `Random()*6-3` |
| Horizontal | `(-3.5,0),(-1.75,0),(0,0),(1.75,0),(3.5,0)` |
| Vertical | `(0,-3.5),(0,-1.75),(0,0),(0,1.75),(0,3.5)` |
| +4 Way | `(1.75,0),(-1.75,0),(0,-1.75),(0,1.75),(0,0)` |
| X4 Way | `(1.75,1.75),(-1.75,-1.75),(1.75,-1.75),(-1.75,1.75),(0,0)` |

Random evaluation order is `Random()*6`, add inherited velocity, then subtract3
(the rounding order can differ from adding an already computed offset). Child
previous-pixel slots inherit the parent's old display center. Stop flags and
collision color slots start clear. Shooter-repulser exclusion uses **one shared
left-origin flag**, so one child leaving the 40x40 origin box enables shooter
repulsion for all subsequent children.

## Collision differs from ordinary bombs

Inside `x>11 && x<309 && y>33 && y<187`, the five-pixel cross is sampled in this
order: left, above, center, below, right (`0x1330d–0x13414`).

- **Any dirt pixel2 stops MIRV**, regardless of selected power, MEN threshold, or
  subdivision index. The ordinary high-power penetration rule must not be reused.
- Tank palette20..29 stops MIRV only if that tank has MEN>0. Its palette value is
  still recorded when MEN is zero.
- Scanning continues after a hit. The collision-color slot is overwritten by
  each dirt/tank sample, and retains the last such value. Other colors leave it
  unchanged. This is relevant to direct damage: tank-left/dirt-right ends with
  color2, whereas dirt-left/tank-right ends with the tank color.
- Collision only sets the stopped flag; it never clears a previous stop.

The common radius15 blast branch for weapon7 (`0x190e1–0x190f1`) applies the
additional direct-hit damage200 only if the passed collision color is20..29
(`0x194ba–0x19528`). Thus retaining an arbitrary earlier `hitTank` can change
MIRV damage even when the final endpoint and blast radius look identical.

## Walls, bounds, and stop conditions

Outside the collision rectangle, integer boundary comparisons are x<=10,
x>=310, y<=30, y>=188. Solid-wall reflection requires outward velocity and uses
the configured standard factor on both velocity components
(`0x13417–0x13787`). At the floor it stops only when **both** abs(vx)<0.1 and
abs(vy)<0.1 after reflection. Stopping on vertical speed alone is incorrect.

Warping adds/subtracts300 from real x while keeping cached pixel x unchanged
until the next step (`0x1378a–0x1381b`). Open walls have these asymmetric shortcuts
(`0x1381e–0x138d7`):

```
if pixelX > 310 && vx > 1 && wind > 0: realY = 400
if pixelX < 10  && vx < 1 && wind < 0: realY = 400
```

The left comparison really is **vx<+1**, not vx<-1. The assignment is not an
immediate stop and does not refresh cached y. The next step normally stops below
the field. Generic early-removal at x<-1500/x>1800 is absent.

Additional stops:

- abs(vx)>30 or abs(vy)>30 (`0x1390c–0x1396e`).
- With no solid walls (including warp), cached y<-5000 or y>=190
  (`0x1396e–0x139f8`). The high exit optionally plays the four-tone sound.
- Outer groups>1000 (`0x139f8–0x13a12`).

All child stop reasons still participate in the selected detonation mode.

## Detonation is blocking, not overlapping

**Impact:** as soon as a child stops, call the complete explosion routine, then
redraw all tanks before advancing the next child (`0x13b3f–0x13bde`). Other children
freeze while that explosion animates. Later children in the same sweep see the
changed terrain and damaged tanks. The child receives exactly one explosion.

**Simultanious:** wait until every child stops; then call complete explosions
**sequentially in child order1..5**, redrawing tanks between calls
(`0x14096–0x14117`). The option's historical name does not mean five concurrent
browser effects. All stored endpoints are passed, even endpoints outside the
playfield.

**None:** no child explosion calls. The parent still splits and children still
fly, stop, and leave trails.

Settling and death processing belong to the outer turn loop. The MIRV routine
redraws tanks between child explosions but does not run ground collapse or falling
tanks there. The common explosion's MIRV timing is shorter than ordinary bombs.

## Display and persistent trails

Before collision, erase the old five-pixel projectile from its restoration
buffer and, when trails are enabled, write its previous **center** to both VGA
and the background/restoration buffer (`0x131cf–0x13247`). A trail can remain
visible after subsequent turns and later restore operations; resetting trails
on each shot is incorrect. Palette is `100-oneBasedShooter`, with RGB components
32 divided by the tank color divisors, as for ordinary projectiles.

Draw the new five-pixel white cross only for active, visible projectiles
(`0x13a12–0x13a66`). A stopped projectile's cross is restored, not held as a dot at
its endpoint (`0x13aee–0x13b3a`). The previous center trail remains. Magenta border
position markers are updated per projectile and erased from the previous center.

For full framebuffer equivalence, overlapping projectile/trail/background writes
must retain their original ordering. A separate canvas decoration layer can
reproduce appearance while still differ in rare overlap collision cases.

## Scope and remaining caution

The generated fixtures validate the recovered formulas and discrete decisions
independently of browser code. They do not validate a whole random battle,
initial runtime trigonometry, all repulser interactions, sound pacing, or original
CPU-dependent flight speed. Any implementation using ordinary JavaScript double
arithmetic should retain a documented tolerance for Pascal Real differences at
pixel boundaries; small single-step errors can accumulate over long flights.

## Browser implementation

`dist/mirv.js` now uses this separate parent/child loop, a shared origin-departure
flag, cached pixel coordinates, dynamic subdivision count, and blocking blasts.
The browser schedules each child integration at 1/600 second; this is presentation
pacing, not a recovered DOS Delay. Tests compare single-step Pascal Real results
within 1e-8 and discrete decisions exactly, and check identical final outcomes at
30, 60 and 144 Hz. Layered terrain/tank drawing still cannot model every overlapping
VGA write, and accumulated floating-point boundary differences remain possible.
