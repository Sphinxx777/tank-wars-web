# Laser Blaster: original charge, beam, damage and walls

This is a translation of the local Tank Wars 3.2 `BOMB.OVR` laser routine,
file offsets **0x1412b–0x15120**. It supplements the shorter description in
`advanced-weapons.md`. Ordinary projectiles and laser walls are different
routines; applying the ordinary projectile bounce function to a laser changes
its collision positions.

## Evidence and independent checks

`tools/verify-laser-wall-oracle.py` executes the original boundary instructions
at OVR **0x14e06–0x150ae**, together with the original resident Pascal Real48
comparison/addition/subtraction routines. It records **70 cases** in
`tests/fixtures/laser-wall-oracle.json`. Original binaries are local-only and
not distributed; optional Unicorn is needed to regenerate the fixture.
The fixture tests all five wall modes, fractional coordinates either side of
boundaries, and inward/outward corner movement. Its inputs are the beam state
at the end of an iteration, before wall handling. Neither the production JS
nor a reimplementation of its wall rules is used to obtain expected results.

The other findings below are static instruction translations. They do not
establish complete real-time, screen-buffer or random-sequence parity.

## Energy and charging

- Selected power zero returns immediately (**0x14151**).
- Selected power above available ammo is reduced to that ammo count
  (**0x14163–0x1418b**). Ammo then loses exactly selected power
  (**0x1418f–0x141b3**). This routine does **not** raise powers below 100 to 100.
  A separate weapon-availability rule requiring at least 100 stored energy
  should not be confused with the amount consumed by an individual shot.
- Obtain the shooter's current men-dependent palette RGB. Set palette 254 to
  that RGB, draw its barrel in 254 out to eight pixels, and stamp its body in
  its ordinary tank color (**0x141ca–0x142e4**).
- Prepare 100 colors interpolating from that RGB to yellow `(63,63,0)`:
  `R[i]=trunc(R0+(63-R0)*i/100)`, `G[i]=trunc(G0+(63-G0)*i/100)`,
  `B[i]=trunc(B0-B0*i/100)`, i=1..100 (**0x142e9–0x1442d**).
- Twice sweep 1..100 then 100..1. Pass one waits L ms per entry; pass two
  waits `trunc(L/2)` ms. Finish with one sweep 1..100 at `trunc(L/2)` ms.
  L is DS:e8cc, normally 5. These delays run even with sound disabled
  (**0x14432–0x14596**), totaling 1600 ms when L=5.
- The following 201 ms launch-sound sequence, including all of its delays,
  is skipped completely with sound disabled (**0x14598–0x1468c**).
- Fuel is then `10*power`. The 20% chance of one explosion-type self-damage
  occurs **after charging**, before the muzzle calculation
  (**0x146da–0x14709**).
- Muzzle position is seven units along the barrel; velocity has unit length,
  `(cos(theta),-sin(theta))` (**0x1470e–0x14818**).

## One beam iteration, in original order

1. Add vx/vy to the real-valued beam position; subtract 10 fuel
   (**0x148c0–0x1490e**).
2. Change palette 254 to `(I,I,0)` with
   `I=trunc(53*remainingFuel/(10*selectedPower)+10)`
   (**0x14912–0x1494e**). The beam is **yellow**, and all existing beam
   pixels dim together. A red constant-color line is incorrect.
3. Read the screen pixel at truncated x/y (**0x14952–0x1497e**).
4. Process dirt or a living tank pixel as described below.
5. Wait L ms. If sound is enabled, play `100+Random(low16(12*remainingFuel))`
   (**0x14dca–0x14df6**). This is not a delay after drawing the new beam point.
6. Mark the beam finished if fuel <= 0; process its wall behavior
   (**0x14dfb–0x150ae**).
7. Only if not finished, write palette 254 at truncated current x/y
   (**0x150ae–0x150da**). In a tank hit iteration, this is the backed-up
   position; in a warp iteration, it is the wrapped position.
8. Repeat while unfinished. On exit, blacken palette 254, then restore all
   screen pixels carrying that index from the saved background buffer and
   stop sound (**0x150f4–0x15118**).

Beam points remain in the indexed screen buffer until exit; there is no
continuous line connecting a warp destination to its source. Fuel-exhausted
and outward-exiting final positions are not drawn.

## Dirt interaction

If the sampled pixel is dirt index 2, repeat k=1..15:

- Sample each axis independently:
  `px=trunc(x-Random(20)*vx)`, `py=trunc(y-Random(20)*vy)`.
- If sound, play `500+Random(500*k)`; no explicit delay.
- Restore that point from the saved background only when within
  x=11..309 and y=31..189, and its current color is neither 254 nor 20..29.

This is **0x14987–0x14aab**. Removing terrain and only later playing a long
precomputed sound sequence changes the visible behavior. Dirt is consumed
while the laser advances, one beam step per L ms.

## Tank interaction

Colors 20..29 identify tank index `color-19` (one based), provided its men
count is positive (**0x14ab0–0x14ad6**). The original checks screen colors,
not distance from a center. The barrel can therefore be hit.

The shooter's hit counter increases once for each distinct other tank hit by
this beam (**0x14ad9–0x14afb**). A ten-entry local array starts false, with
the shooter's own entry already true at routine entry. Team membership is not
checked here. Fuel loses an additional 10 (**0x14aff–0x14b05**).

If the victim's explosion shield reserve is **zero**, produce 15 particles
(**0x14b08–0x14d53**):

- For each k, sample `px=trunc(x-Random(40)+20)` and the same formula for y.
- Resample both coordinates if the existing pixel belongs to another tank
  (20..29 except this target's color) or is beam color 254.
- Optional sound `500+Random(500*k)`, then wait L ms.
- If within x=11..309,y=31..189, write the target tank's color at that point.
  Particles accumulate across all 15 iterations.
- After the fifteenth, loop through those same 15 positions, optionally
  emitting the same noise formula, and restore them from background.
  This removal loop has no explicit delay.

Then apply **3 damage through explosion shield type 0**, whether shielded or
not (**0x14d61–0x14d77**). The unshielded particles are tested before applying
this damage, so a shield depleted by the current iteration prevents that
iteration's particle effect. The next iteration can produce it.

Finally subtract vx/vy from position (**0x14d7c–0x14dc6**), pinning the beam
to the surface for its next advance. An unshielded contact adds 15*L ms to
the normal L ms step; at defaults this is 80 ms per hit, versus 5 ms for an
ordinary or shielded step. No 10-points-per-man scoring call occurs in this
loop; the distinct-target hit count and later kill accounting still apply.

## Laser-specific boundary rules

These tests compare **real positions**, not truncated coordinates.

Solid wall modes 1, 2 and 3 all use the same pure reflection, no damping or
acceleration (**0x14e06–0x14f4c**):

```js
if (x <= 11 && vx < 0) vx = -vx;
if (x >= 309 && vx > 0) vx = -vx;
if (y <= 31 && vy < 0) vy = -vy;
if (y >= 189 && vy > 0) vy = -vy;
```

Position is not clamped or reflected back inside during this step.

Warp mode uses sequential x checks (**0x14f4f–0x14fd0**):

```js
if (x <= 10) x += 300;
if (x >= 310) x -= 300;
```

Thus exactly x=10 is first changed to 310, then changed back to 10. This
quirk is present in the original instructions and the captured fixture.
Warp mode terminates at outward top/bottom y=31/189 boundaries.

Open mode terminates at any outward x=11/309 or y=31/189 boundary
(**0x14fd2–0x150ae**). These outward checks use velocity sign as above;
being on a boundary while moving inward does not end the beam.

## Runtime trigonometry and barrel endpoints

`tools/verify-laser-geometry-oracle.py` runs the original degree conversion
`dbd:d9` followed by original `12ce:12ee` (cosine) and `12ce:1301` (sine).
The 181 integer-degree results are in
`tests/fixtures/runtime-trig-oracle.json`. These are distinct from the AI
lookup table: for example, runtime sin(30°) is exactly 0.5, whereas the AI
lookup is slightly below 0.5.

Runtime cos(0°) is **0.999999999994543**. Executing the original Real multiply
and truncation routines gives `8*cos(0)=7.999999999956344`, truncated to **7**.
JavaScript `Math.cos(0)=1` incorrectly makes the horizontal barrel one pixel
longer. Mixing the AI lookup in laser movement with `Math.cos` in rendering
and collision creates a spurious self-hit on that extra pixel.

Original muzzle/first-step instructions at x=50,y=100,angle=0 give muzzle
x=56.99999999994179 and first-step x=57.99999999994179. Both are truncated
for screen access, so the first beam pixel is x=57, which is the original
charged barrel endpoint. Original cos(180°) is slightly asymmetric at
-0.9999999999936335. At 90° the original muzzle y and first-step y round to
93 and 92 exactly; native JS arithmetic can still differ because Real48
rounds every intermediate operation.
