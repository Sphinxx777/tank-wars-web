# Anti-stalemate lightning in Tank Wars 3.2

These findings use the local BOMB.EXE with SHA-256
`659ace6b9a97c30191a8f65cf25f22322c087166909e9fa1d522e529adbafd9d`
and its accompanying BOMB.OVR. All offsets below are file offsets. The original
binaries are not distributed with the repository.

## Trigger and turn counter

The original does not strike a randomly selected tank every fourth shot after
shot 80. Its turn loop maintains DS:47ea:

- Set to 1 at OVR **0x1546f**, once after selecting the round's starting player.
- Increment at **0x15486** whenever the sequential player index wraps from the
  last player to player 1. Dead players are skipped, but still participate in
  this index-wrap bookkeeping. A starting player at the end can cause the first
  turn-selection wrap immediately.
- There are no other writes to this variable in BOMB.OVR. Deaths do not reset it.

After processing the complete pass over newly dead players, **0x15a71–0x15aa4**
checks:

```js
if (!deathThisPass && roundCounter > 10) {
  if (roundCounter > randomInt(100)) {
    lightning();
    repeatDeathPass = true;
  }
}
```

The comparison is strictly greater. At 11 the rolls 0 through 10 strike; 11
through 99 do not. No random roll is consumed for counters 1 through 10, or when
this death pass has found a death. DS:480f is reset at **0x1585c** at the beginning
of each death pass, not once per shot. A lightning strike sets it again, causing
another death pass and potentially another lightning roll before the next
player gets a turn (**0x15aa9–0x15ab0**). Team-win detection follows this loop.
There is no explicit counter reset or maximum-chain guard in these instructions.

## Path and palette

Lightning branch: OVR **0x1a3f1–0x1a7b1**, entered when the routine argument is 0.
It initializes palette 200 to VGA RGB6 `(63,63,63)` and 201 to `(0,0,50)`.
Each bolt is three pixels wide: white center and dark-blue neighbors, with no
line joining successive rows. Each row is plotted independently.

Choose `xStart=10+Random(300)` and `xEnd=10+Random(300)`. Both are 10 through 309.
Generate an initial path for every y from 31 through 189 inclusive. Only after
that initial 159-call generation choose `passes=1+Random(8)`.

The walk starts at zero for every path, and adds `Random(7)-3` at every row.
The mathematical shape is:

```js
xStart + trunc(y * (xEnd - xStart) / 189 + (y - 189) * walk / 189)
```

However, using a single JavaScript expression does not reproduce all pixels.
The game uses Turbo Pascal's six-byte Real (40-bit significand), and its initial
path and later paths use slightly different sequences of operations. To match
the original path oracle, round each primitive operation to that precision:

```js
function real40(value) {
  if (value === 0) return 0;
  const step = 2 ** (Math.floor(Math.log2(Math.abs(value))) - 39);
  return Math.sign(value) * Math.floor(Math.abs(value) / step + 0.5) * step;
}
const slope = real40((xEnd - xStart) / 189);
// For each y after updating walk:
const term = initial
  ? real40(signed16((y - 189) * walk) / 189)
  : real40(real40((y - 189) / 189) * walk);
const x = xStart + Math.trunc(real40(real40(y * slope) + term));
```

The initial multiplication at **0x1a4ba** keeps the low 16 bits and sign-extends
before converting to Real. Later passes convert before multiplication. The
normal bounded random walk rarely reaches an overflow; preserving this detail
also covers adversarial deterministic input sequences. This helper describes
the arithmetic required here, not a general emulator of every Pascal numeric
edge case or exponent overflow.

For each pass, the original first walks all 159 rows, drawing the CURRENT path
and simultaneously preparing the NEXT path in a second buffer. The next path
is generated even after the final displayed pass, consuming those random calls.
It then walks all 159 rows again to erase the current path. Buffers switch only
after the erase sweep.

## Damage and terrain removal

For each displayed row:

1. Read the current framebuffer color at the center pixel `(x,y)`.
2. If it is 20 through 29, apply 3 damage through defense type 0 (energy shield)
   to the corresponding player, then immediately redraw that player's tank.
3. Write center palette 200, then right neighbor 201, then left neighbor 201.
4. Consume one Random(7) and calculate the next path's coordinate for this row.

Only the center pixel is tested for damage. Side pixels do not hit tanks.
The common damage helper at **0x1a58c–0x1a5a6** can absorb damage with an energy
shield; “raw 3” does not mean bypassing shields. There is no per-man hit-score
award in this loop. Subsequent normal death processing still uses the current
shooter for kill accounting.

During the erase sweep the three pixels are restored from the original
sky/background buffer DS:e5c0, not from a snapshot of their contents immediately
before the bolt. Thus the bolt removes terrain along its width. This restoration
is the resident `cc8:bd8`, EXE **0xeef8–0xef1e**. The fast plotting and reading
helpers (`cc8:bb6` and `cc8:bff`) use direct VGA address arithmetic without a BGI
viewport clipping test. Path coordinates normally stay around the playfield,
but raw out-of-field accesses are an original edge case.

## Sound, final explosion and settling

Each restored row optionally consumes `Random(600)` and calls
`Sound(600+result)`. There is no Delay in either sweep. After each pass the game
switches path buffers and calls NoSound unconditionally. Therefore there are
159 sound calls per pass when enabled and one NoSound per pass regardless of
sound enablement. Sound RNG occurs after the next path was generated, and affects
later path generation. A separate pre-generated sound stream would change the
paths if it consumed the shared RNG in a different order.

At **0x1a777–0x1a7ae**, choose weapon `trunc(passes/3)`; if it is zero, replace it
with weapon 11. Invoke ordinary impact at `(xEnd,189)` with player index 0:

- 1–2 passes: weapon 11, Hand Grenade.
- 3–5 passes: weapon 1, Incinerator.
- 6–8 passes: weapon 2, Incinerator Mk II.

The final explosion has its own ordinary effect and sound. This weapon choice
is written into the dummy player-0 record, not the active player's selection.

The shared tail at **0x1a7b1–0x1a7f5** redraws all tanks, invokes the crumble
probability gate if the crumble setting is positive, and invokes tank falling
if enabled. When entered with a nonzero argument the routine skips the bolt
branch and performs only this shared tail.

The drawing/restoration sweeps have CPU-dependent duration; any browser pacing
is an explicit presentation policy, not an extracted original millisecond delay.

## Independent instruction oracle

Run:

```sh
PYTHONPATH=/tmp/tankwars-research-pylib python3 tools/verify-lightning-oracle.py
```

The optional Unicorn tool executes the original unmodified path instructions and
resident Pascal Real routines. It intercepts graphics/audio I/O and provides a
deterministic bounded RNG; expected paths do not come from the web implementation.
`tests/fixtures/lightning-oracle.json` contains four full multi-pass sequences
(two sound-on and two sound-off), RNG consumption counts, restoration and sound
counts, and eleven original trigger-comparison cases.

The 21 displayed paths contain 3,339 original center coordinates. A JavaScript
translation using ordinary double arithmetic differs in 19 coordinates across
these fixtures. The operation-by-operation Real rounding above reproduces every
recorded coordinate, while retaining the distinct initial/subsequent formulas.

## Browser integration limits

`dist/lightning.js` reproduces the paths and RNG/sound calls in the independent
fixtures. The original sweep has no fixed Delay; the browser displays each draw
and clear for 1/60 second. Pixels outside the battlefield are clipped rather
than reproducing raw VGA writes. The engine checks victory before scheduling
another strike, avoiding the original endless-strike edge case at cycle 100.
