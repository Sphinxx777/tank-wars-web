# Lobber: target choice, learning and shared shot history

Audited against the local Tank Wars 3.2 `BOMB.EXE` and `BOMB.OVR`, 2026-10-19.
Addresses below are hexadecimal file offsets. The executable is local only and
is not redistributed. `tools/verify-lobber-oracle.py` executes the complete
resident planner **EXE 0x3026–0x3797**, ending before the already independently
verified common control dispatcher. Graphics calls are replaced by no-op I/O
hooks and Random results are supplied explicitly. Targeting branches, loops,
Pascal Real arithmetic and integer conversions execute the original machine
instructions. The fixture contains **359 plans**, plus **14 original history
writes** from OVR **0x15710–0x15850**.

Regenerate from the repository root with Unicorn installed:

```sh
PYTHONPATH=/tmp/tankwars-research-pylib python3 tools/verify-lobber-oracle.py
```

## Persistent AI state and player indexing

The base constructor initializes desired elevation and direction to zero
(**EXE 0x2970–0x297e**). Lobber normalizes a direction whose absolute value is
not one to +1 (**0x305a–0x3074**). It does not read the tank's current visible
barrel to choose its initial traversal direction. The AI object is constructed
at new-game setup (**OVR 0x688–0x7de**); round placement resets the shot counter
(**0x1d1bd**) without constructing another object. Desired direction therefore
survives into the next round, even though shot history starts anew.

Original player indices refer to the ordered player records, not the browser's
stable identity IDs. Target traversal, tie-breaking, direction and crossing
checks must use `game.order`. Persistent `player.lobAim` stores the desired
`elevation` and `direction`; ordinary saves already serialize player fields.
Old browser histories are normalized to signed integer coordinates when used.

## Target selection and direction changes

At the beginning of a new plan, set target to self, weapon to **1**, and nearest
impact distance to 32767 (**0x3039–0x3055**). Let n be the current shot number:

- n = 1: roll Random once. If it is **<= 0.5**, negate the traversal direction.
- n < 3: walk cyclically through ordered players in that direction until an
  alive, non-self, different-team target is found (**0x30c2–0x3147**).
- n >= 3: scan ordered players and take a valid enemy whose x is nearest the
  latest historical impact x. Strict improvement means ties keep the first.
  Subtraction and absolute value execute as signed 16-bit operations before
  sign extension; even the -32768 absolute-value overflow is preserved.

The direction is then determined by target **index**, not x difference. If it
crosses from the previous desired direction, reset n to 1 before computing the
shot (**0x3260–0x32ca**). Resetting history means discarding the previous entries
for learning; the new shot overwrites history slot 1 in DOS.

## Power, elevation, ammunition and Real48 rounding

For n = 1, choose elevation 75 and power `100 + Random(100)`.
For n = 2, choose elevation 75 and power `200 + Random(200)`.
Both retain the initial desired weapon **1**, with unavailable ammunition later
handled by the common control dispatcher. Choosing the strongest stockpiled
weapon during these learning shots was incorrect.

For n >= 3, elevation is **retained** from the AI object, rather than assigned
again. The nested pair loops overwrite the same locals without accumulation;
only the final pair (the two most recent historical shots) contributes:

```text
dx = signed16(later.x - earlier.x); if zero, replace with 1
dp = signed16(later.power - earlier.power); if zero, replace with 1
error = signed16(target.x - earlier.x)
ratio = Real40(dp / dx)
correction = trunc(Real40(error * ratio)) rem 32767
power = signed16(earlier.power + correction)
if power < 0: power = signed16(-2 * power)
```

This is the Pascal software Real48 format, with a 40-bit significand. Rounding
only at the end is insufficient. For example, history `(x=50,p=150)` followed
by `(x=53,p=157)` against target x=260 produces proposed power **639**, not 640.
The fixture checks this case and many small-denominator ratios. Negative
remainder follows the dividend, as in JavaScript `%`; negative doubling wraps
again to a signed word, rather than producing an unrestricted positive integer.
The common dispatcher subsequently clamps power to the men-dependent cap and
zero; the standalone planner deliberately returns the original unbounded word.

Desired weapon starts at 1, becomes 2 if `abs(error)>5`, 3 if `>15`, and 4 if
`>30`. If the desired weapon is unavailable, follow
`4 → 3 → 2 → 1 → 11 → 0` (**0x3709–0x377e**). The browser's guaranteed free
Lead Ball lets this end at 0 rather than reproduce the DOS infinite loop that
would occur with every ammunition count, including 0, artificially empty.

## Common history recording, including MIRV's stale-position quirk

The player's shot counter increments once at **OVR 0x154af**, before controls
and weapon dispatch. The shared history writer is after all three dispatches:
ordinary at **0x1568d**, laser at **0x156ad**, MIRV at **0x156cd**. It runs once
per fired weapon before the death pass (**0x1587b**), not once per child shell.

The history record is ten bytes, player stride 0x7da. Its fields are elevation
(DS:4a80), power (+2), direction (+4), impact x (+6), impact y (+8), indexed from
slot 1. It takes current player elevation/power/direction. Impact coordinates
come from the shared Real globals DS:4796/479c: x greater than 32767 saturates to
32767; otherwise truncation is followed by a signed-word store. Negative x is
not saturated. y is always truncated and stored as a signed word. No ordinary
shot-only predicate or history-count cap exists in this common writer.

Ordinary projectiles and laser update these shared globals with absolute screen
coordinates. A laser's terminal position includes its collision back-up or warp
handling. **MIRV uses stack arrays and does not update these globals**, including
when it calls the explosion dispatcher. Its history therefore inherits the
previous shared position rather than using the parent or final child endpoint.
This is a confirmed original quirk, not an intended ballistic estimate.

The mode-0 death-particle routine also updates these globals
(**0x16396/0x163b3, 0x16425/0x1644c**). It first subtracts viewport origin
(11,31) from the dead tank's position (**0x16335, 0x16352**), so these particular
shared coordinates are **local to the viewport**. This may affect a later MIRV
history entry. The globals are in the Pascal uninitialized-data area; no
explicit round reset was found. The browser keeps the shared position across
rounds and stores it in saves. Whole-session DOS-memory and all death-particle
arithmetic parity remain separate from the independently checked Lobber planner.

## Presentation and limits

The history branch temporarily saves the framebuffer, draws a target marker and
crosses on earlier history entries, computes its plan, and restores the image.
These calls have no explicit delay and do not feed collision or power arithmetic;
this audit's oracle hooks them as graphics I/O. Browser visible control changes
continue through the original command selector, independently verified in
`ai-controls.md`. CPU-dependent flashes are not evidence of exact wall-clock
parity. The checked decisions do not establish every long-running Pascal Real
trajectory rounding detail or every framebuffer-overlap effect elsewhere.
