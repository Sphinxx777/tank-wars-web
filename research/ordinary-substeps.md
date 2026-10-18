# Ordinary projectile subdivisions and termination

The local Tank Wars 3.2 BOMB.EXE/BOMB.OVR are the reference. This audit executes
original 16-bit overlay fragments and the original Pascal Real arithmetic in
Unicorn; it does not infer the rules from a modern physics model. All addresses
below are hexadecimal file offsets in BOMB.OVR.

Reproduce the 263 cases in `tests/fixtures/ordinary-oracle.json` with:

```sh
PYTHONPATH=/tmp/tankwars-research-pylib python3 tools/verify-ordinary-oracle.py
```

The fixture contains 25 counter sequences, 15 integrations, 121 collision scans,
and 102 wall/termination cases. Pixel reads and palette writes are intercepted;
all classification, branch, counter, and Real arithmetic instructions execute
unchanged. Rendering and DOS speaker hardware are outside these slices. Original
binaries are local inputs and are not distributed with these observations.

## The subdivision cycle really contains S + 1 integrations

At `0x112b7–0x11301` a loop visits every configured player, checking whether any
living tank has repulsion. Its index is DS:4740, the same variable used for the
subdivision index. This leaves it equal to the **configured player count**,
including dead players, regardless of whether anybody has repulsion. The outer
long-word group counter is initialized to zero at `0x11303–0x11308`.

At `0x1130f–0x11325`, each iteration increments the index, compares it with S,
and resets it to **zero only when greater than S**. Reset also increments the
outer group counter. S is copied from the configured setting DS:e8ca into
DS:4744 before this loop. S is normally 10.

For two players and S=10, the indices for successive integrations are:

```text
3 4 5 6 7 8 9 10 0 1 2 3 4 5 6 7 8 9 10 0 ...
```

A modulo-10 counter initialized at zero is not equivalent. At high power,
first earth-stop sampling occurs on integration 8 for two players, integration
2 for eight players, and integration 11 for ten players. Subsequent full cycles
contain 11 integrations. Do not initialize the index from alive player count.

## Integration and cached pixel

`0x11329–0x11441` performs these operations in order, with original Pascal
six-byte Real arithmetic at every operation:

```text
x  := x  + vx / S
y  := y  + vy / S
vy := vy + 0.1 / S
vx := vx + (wind / 5000) / S
pixelX := trunc(x)
pixelY := trunc(y)
```

The iteration divisor remains S, even though the counter cycle contains S+1
iterations. Guidance and repulsion happen after these cached coordinates are
created. Warping or guidance may change the real coordinates without updating
these cached pixels. The final impact call at `0x1204f–0x1206e` passes **real x
and y**, not the cached display/collision integers.

The fixture retains original floating results. JavaScript double arithmetic
should match within a small numerical tolerance (1e-8 for these cases); integer
coordinates and branch results must match exactly. This fixture does not prove
all long trajectories bit-identical to Pascal Real.

## High-power penetration and last collision classification

At function entry, `0x10ed8–0x10eed` computes `threshold = 3 * men + 643`. This
happens before the launch's random one-man damage. The collision branch reads
the firing tank's current power; the threshold is not recomputed each substep.

The five-pixel collision scan visits left, above, center, below, right. It runs
only when cached x>11, x<309, y>33, y<187 and the projectile is not already
stopped. At each sampled pixel:

- Earth (palette 2) stores collision color 2. If power<threshold **or** the
  current subdivision index equals S, set stopped=true. Then, independently,
  if power==threshold, set stopped=false.
- Tank color 20..29 stores that color and sets stopped=true. Weapon 12..16 then
  clears the stop, multiplies vy by -1.2, removes guidance, and turns the shot
  blue. This happens for **each tank-colored pixel**, so a cross covering three
  tank pixels performs three bounces.
- Other colors leave both the stop flag and collision color unchanged.

Thus intermediate high-power earth does not clear an earlier tank stop, but
exactly-equal-threshold earth does. The last classified color may be earth even
when an earlier tank pixel caused the stop. A persistent `hitTank` shortcut is
not sufficient for impact damage. The original classifier consumes rendered
palette pixels, without a tank men/liveness test at this point.

DS:47de (the last classified collision color) is initialized once to zero at
`0x10ec2–0x10ec4`; empty pixels and subsequent empty steps do not reset it.

## Wall handling and termination order

Wall handling only runs when the collision-rectangle branch was skipped. Solid
wall types reflect outward velocity at cached x<=10, x>=310, y<=30, y>=188,
multiplying both velocity components by the selected factor. The damping and
accelerating factors are the original Real values approximately 0.707106 and
1.41421. At the floor, the projectile stops after a bounce if **abs(vy)<0.1**,
regardless of vx. This differs from MIRV, which checks both components.

Warp walls change real x by exactly 300 at cached x<=10 or x>=310; the cached
pixel remains unchanged during this iteration. Warp bypasses the open-wall
shortcut described below.

With open walls, an unguided shot is moved to **real y=300** when:

```text
cached x > 310 and vx > 1 and wind > 0
or
cached x < 10 and vx < 1 and wind < 0
```

The positive 1 on the left-hand test is an original asymmetry. Zero wind does
not satisfy either case. The shortcut does not stop the shot immediately:
cached y remains unchanged until the next integration.

The tail then applies these checks in order:

1. `groups > 1000` sets stopped=true and impactEnabled=true.
2. With non-solid walls (open or warp), cached y<-5000 sets stopped=true and
   impactEnabled=false, with the original four-tone exit sound if enabled.
3. With non-solid walls, cached y>=190 sets stopped=true.
4. After the display/bookkeeping branch, abs(vx)>30 or abs(vy)>30 sets
   stopped=true and impactEnabled=true.

The last speed check can therefore re-enable an impact disabled by the
high-altitude exit in the same iteration. There is no arbitrary x cutoff and
no direct age-in-seconds timeout in this routine. The outer group count, not
elapsed browser time, governs timeout.

## Limits

These slices establish exact iteration and branch rules. Browser presentation
pacing remains a chosen cadence because the ordinary flight loop has no fixed
DOS Delay. Full VGA overlap, every cumulative Pascal Real rounding boundary,
and caller behavior outside the captured slices require separate validation.

## Launch damage does not immediately clamp power

The launch calls the ordinary damage helper at `0x11084`, after capturing the
threshold but before creating the launch velocity. The helper at
`0x1f123–0x1f26a` changes shield reserve, MEN and potentially repulser reserve;
its follow-up `0x1f26d` calls `0x1f2cf–0x1f33c` only to update the tank palette
brightness. None of those routines writes the power word at player+0x1b.

An independent execution of this original helper with MEN=92, power=920,
shield=0, repulsers=0 and damage=1 returned MEN=91, power=920, lost=1. Therefore
the launch still has power920 and its previously captured threshold919. The
browser's stored pre-damage shot power preserves this particular flight case;
re-reading an eagerly clamped browser player power910 would introduce a new
collision error. The 10*MEN cap is present in the controls handler at
`0x1b4b1–0x1b500`, not in the raw damage helper.
