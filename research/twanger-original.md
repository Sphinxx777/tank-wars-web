# Twanger: solid-wall decisions and aiming

The local Tank Wars 3.2 `BOMB.EXE` planner runs at file offsets
`0x4b30–0x587a`. `tools/verify-twanger-oracle.py` executes its complete solid-wall
planning branch, including the original Pascal Real runtime. The only replaced
operation is `Random(51)`, whose result is supplied by the fixture. Rendering
reads/writes and framebuffer save/restore execute the original instructions.
The harness stops before the common command selector, which is tested separately.
No original executable bytes are distributed.

`tests/fixtures/twanger-oracle.json` contains **184 plans**, including obstacle
layouts, player positions, left/right shots, near-integer angles, dead players,
teams, laser thresholds and tank-colored pixels over dirt. Tests compare target,
elevation/direction, power, weapon, all path scores, ranking, final weapon score,
and the SHA-256 of **every sampled ray coordinate in order**.

## Path evaluation

With wall modes 1, 2 or 3, each enemy begins with score 1000. Self, dead and
same-team records receive −1. Candidate traversal is original player-record
order, represented by the native round's left-to-right `game.order`.

The virtual reflection line is y=28. For each candidate:

```
angle = atan(abs((self.y + target.y - 56) / (target.x - self.x)))
rise = self.y - 28
run = trunc(direction * rise / (sin(angle) / cos(angle)))
ceiling = (self.x + run, 28)
```

The outgoing leg is sampled from self to ceiling. Each earth pixel costs
**three points**, not one (`0x4e37–0x4e58`). The return leg from ceiling to target
costs **one point** per earth pixel (`0x4fab–0x4fb9`). Both sample k=1 through
trunc(length), calculating each coordinate by truncating the *entire* real-valued
sum, rather than truncating its displacement first.

Each sample writes the candidate's tank palette index to the temporary
framebuffer. Consequently, repeated pixels and earlier candidates' rays no
longer count as earth. Existing tank pixels likewise do not count as earth.
The original framebuffer is restored after scoring; these rays never dig holes.

## Ranking and second evaluation

`0x4fe2–0x510c` assigns increasing ranks to successive positive score maxima,
assigns equal ranks to ties, and removes every rank below the final maximum.
This retains the best path scores. `0x5117–0x5225` replaces retained scores with
`1000 − trunc(hypot(self.x − target.x, self.y − target.y))`, then chooses the
first strictly greatest value. Thus equal path scores prefer the nearest target;
equal truncated distances retain record order.

Crucially, `0x5231–0x5607` restores the saved framebuffer and evaluates the chosen
path again, by itself. Weapon selection uses **this fresh score**, not the score
obtained after other candidate rays painted over its obstacles. The second
scan's direction follows record index; final aim direction follows sign(dx).

## Final controls and weapon

Power is `950 + Random(51)` (`0x5667–0x5676`). Elevation is the truncated degrees
of the reflection angle. Wind and the specific solid-wall bounce coefficient do
not enter this planner.

The default weapon is 1. If the rechecked score is strictly greater than 990,
scan weapons 2, 3 and 4 in that order, retaining each available weapon whose
radius (15, 30, 60) is **strictly less** than the straight-line tank distance.
There is no Rifleman +4 vertical offset in this distance. Otherwise, laser 5 is
selected only when laser ammunition is **strictly greater than 100**.
The existing shared command planner subsequently applies ammunition fallback,
current-men power cap and laser-energy cap.

Non-solid modes dispatch to Rifleman at `0x57f6`; the native engine retains that
dispatch. The gradual weapon, direction, power and angle commands remain the
same shared controls as other AIs.

## Scoped Pascal arithmetic

Plain JavaScript trigonometry produced different ray pixels and scores even on
ordinary layouts. `dist/ai-real.js` therefore rounds operations to the Real48
39-bit stored fraction and translates the runtime's sine and arctangent
polynomial reductions and constants. This is scoped to these aiming calculations;
it is not a claim to emulate the entire Pascal runtime or all overflow behavior.
The fixture hashes verify all intermediate ray raster coordinates for the tested
layouts, including their rounding-sensitive integer boundaries.

## Boundaries

The planner assumes distinct tank x positions, as the original round setup does.
A zero horizontal separation divides by zero in DOS. The original also leaves
its target record at zero if all path scores are negative; record zero is scratch
storage, not a playable tank. For pathological imported terrain that produces
this condition, the native planner explicitly falls back to the first enemy.
Normal candidate positions and terrain are covered by the fixture suite; these
invalid/scratch-record cases are not represented as exact normal gameplay.

The temporary targeting rays are still computed immediately in the browser.
Their CPU-dependent transient display speed is not claimed to be identical.
The visible gun/weapon controls run through the already verified shared command
animation. The layered native renderer can still differ from DOS for unusual
interleaving of overlapping sprites and terrain outside these planner reads.
