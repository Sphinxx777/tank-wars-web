# Tank Wars 3.2 — final fidelity details

Static reverse engineering of the user's original BOMB.EXE/BOMB.OVR, 2026-10-18. All addresses are hexadecimal **file offsets**. This report supplements binary-findings.md and advanced-weapons.md. Original files were read only; no executable patching. Statements below translate observed instructions; this is not a complete dynamic equivalence proof.

## Turbo Pascal random generator

The game's linked runtime is important: its bounded Random is modulo of the **upper 16 bits**, not a scaled 32-bit multiplication.

```js
function nextSeed() { seed = (Math.imul(seed, 0x08088405) + 1) >>> 0; return seed; }
function randomInt(n) { const s = nextSeed(); return n === 0 ? 0 : (s >>> 16) % n; }
function randomReal() { return nextSeed() / 4294967296; }
```

Evidence: EXE **0x15a44–0x15a79** updates DS:3ad6/3ad8. Multiplication low constant at0x15a7a is0x8405; shifts/adds implement high half0x0808. EXE **0x159f5–0x15a08** calls the update, zeros AX, loads n, exchanges DX/AX, divides by n, and returns the remainder. `n=0` skips division but **still advances the seed**. Calls use segment12ce:1675.

EXE **0x15a0b–0x15a27** (12ce:168b) takes all32 updated bits into DX:BX, normalizes them into a Pascal Real with initial exponent0x80 and AH0. Thus the unbounded Real is exactly the updated unsigned seed divided by2^32, not high16/65536. The source fraction is exactly representable within Real's39 stored fraction bits.

`Randomize`, EXE **0x15a7c–0x15a88**, uses DOS int21h/AH2Ch, stores CX as low word and DX as high word. Given DOS's clock register layout, the resulting seed is `(seconds<<24)|(hundredths<<16)|(hours<<8)|minutes`.

Independent arithmetic vectors from seed0, one update per row:

| Next seed hex | high16 | Random(100) | Random() if that same update was used |
|---|---:|---:|---:|
|00000001|0|0|0.00000000023283064365386963|
|08088406|2056|56|0.031379939522594213|
|dc6dac1f|56429|29|0.8610484672244638|
|33dc589c|13276|76|0.20258096512407064|
|45de2b0d|17886|86|0.2729212671983987|
|abf18b42|44017|17|0.6716544185765088|

These are alternative views of each update, not consecutive calls of both functions. Original seed parity additionally requires preserving every random call, including visual effects and sound.

## Wind and gusts

OVR **0x151d1–0x152f6**, in the round initialization routine beginning0x151ac:

```js
const selectedMode = configuredMode === 5 ? randomInt(5) : configuredMode;
const range = [0, 20, 100, 300, 4000][selectedMode];
let wind;
do { wind = Math.trunc(range / 2) - randomInt(range); }
while (Math.abs(wind) < Math.trunc(range / 10));
for (const chance of [0.1, 0.1, 0.05, 0.05]) {
  if (randomReal() < chance) wind = (wind * 4 << 16) >> 16;
}
wind = Math.max(-30000, Math.min(30000, wind));
```

The signed16 wrapping in each multiplication is real behavior: two `shl ax,1` instructions store the word before the final signed clamp. Rare strong gusts can overflow and change sign. For literal Pascal Real thresholds .1 is0.10000000000002274 and .05 is0.05000000000001137; no 32-bit RNG output lies between these values and the nearest ordinary JS thresholds, so tests have identical decisions.

Base ranges before gusts: Low −9..10 excluding−1..1; Normal −49..50 excluding−9..9; High −149..150 excluding−29..29; Gale −1999..2000 excluding−399..399. Distribution inherits the small modulo bias from Random(n). None uses Random(0), then all four randomReal gust tests, despite wind remaining zero.

All writes to global DS:e8a2 found in the overlay disassembly are this block. Physics and display read it elsewhere. This supports round-constant wind, with gusts applied during initialization, not a gust reroll each turn.

## Walls

OVR **0x1cbe2–0x1cc57** assigns Pascal Real factor:

| Mode | Factor | Exact decoded Real |
|---|---:|---:|
|Sticky (1)|0.707106|0.7071059999998397|
|Elastic (2)|1|1|
|Accelerator (3)|1.41421|1.4142100000008213|

Random wall mode5 chooses Random(5), including None0 through Warp4 (OVR0x1ca6a–0x1ca7d). Solid-wall flag DS4814 is true for1..3; Warp flag4815 is true only for4.

Ordinary projectile collision, **0x11b63–0x11d69**:

- Left: trunc(x)<=10 and vx<0; right: trunc(x)>=310 and vx>0. Set `vx=-vx*factor`, `vy=vy*factor`.
- Top: trunc(y)<=30 and vy<0; bottom: trunc(y)>=188 and vy>0. Set `vy=-vy*factor`, `vx=vx*factor`.
- Conditions are evaluated sequentially, so a corner can multiply both components twice in one substep.
- Position is not mirrored or clamped in these blocks. Direction tests prevent repeatedly reflecting an already inward velocity.
- After bottom reflection, if abs(vy)<.1, the shot is marked stopped/finished (0x11d41–0x11d64).
- Warp: trunc(x)<=10 adds300 to real x; trunc(x)>=310 subtracts300, **0x11d6c–0x11dc6**. No y wrapping in this block.

No-wall shots may travel above the visible play area. Very high exit cutoff is y<−5000; y>=190 ends the shot (**0x11e7b–0x11ef3**). Additional timeout and acceleration checks exist; this is not a full termination translation.

## Direct projectile collision and tank sprite

OVR **0x11a05–0x11b60** scans the framebuffer only if center trunc(x)>11,<309 and trunc(y)>33,<187, and the shot was not already stopped. It tests a **five-pixel cross**, in this order:

```
(-1,0), (0,-1), (0,0), (0,+1), (+1,0)
```

This is the `dx,dy=-1..1` nested loop restricted by `abs(dx)+abs(dy)<=1`. Dirt is palette2; tank pixels are20..29. It does not short-circuit after a hit, so later scanned pixels can overwrite the stored collision color.

Tank hits normally stop the projectile. Weapons12..16 (Sonic and dirt bombs) instead clear that flag, clear guidance, and set `vy=-1.2*vy` at0x11afc–0x11b48. Because the loop continues, more than one qualifying tank pixel in the same cross can repeat that transformation.

Dirt hit behavior includes a power-dependent exception: local threshold=`3*shooter.men+643` (**0x10ed8–0x10eed**). At0x11a97–0x11abf dirt stops when power<threshold or substepIndex==subdivisionCount; power==threshold explicitly clears the stop flag. Powers above threshold can pass dirt on intermediate substeps. This exception should not be silently replaced with unconditional collision when reproducing the original.

Tank body draws directly to VGA memory, EXE **0x5f9d–0x6032**. Coordinates relative to stored player x,y (bottom center):

```
          x = -4 .. +4
 y-4          ...###...
 y-3          .#######.
 y-2          .#######.
 y-1          ###.#.###
 y            #########
```

All33 body pixels use the tank palette index `playerIndex+19`, for players1..10. There is no multicolor tread/body shading in this routine. Restoring the body background uses precisely the same pixels in0x6035–0x6167.

EXE **0x616a–0x6281** draws the body, then draws a one-pixel line of that same color from `(x,y)` to `(x+trunc(8*cos(angle))*direction, y-trunc(8*sin(angle)))`. This is an8-unit barrel, rooted at the bottom center, partly hidden inside the body. Projectile muzzle placement is separately10 units. Since collision reads framebuffer colors, barrel pixels are also hit-testable.

## Wind Master AI (ID7)

Constructor EXE0x4442–0x448d assigns AI ID7. Shot computation at **0x4490–0x4a9f** reads wind directly. Name table ID7 is the Pascal string at EXE0x16b6c, `Wind Master`. This method is an analytical randomized-angle solver, not a numerical terrain search.

1. Choose `1+Random(playerCount)` repeatedly until the target is alive, different from self, and on a different team (0x44c8–0x451e). Target remains the same across angle retries.
2. Draw its target animation (omitted below; does not affect formulas).
3. For each candidate set initial fallback speed1000, choose theta=`Random(180)` (0x46ca).
4. Use the integer-degree sine table (below), c=cos(theta), s=sin(theta), then:

```js
X = trunc(target.x - self.x - 8*c);
Y = -(trunc(target.y - self.y + 8*s) - 1);
a = 0.5 * wind / 5000;
g = -0.05;
denominator = a*s - g*c;
valid = s !== 0 && c !== 0 && denominator !== 0;
if (valid) {
  t2 = (X*s - Y*c) / denominator;
  valid = t2 > 0;
  if (valid) speed = (X - a*t2) / (sqrt(t2)*c);
}
power = trunc(clamp(speed*50, -32767, 32767));
valid &&= power >= 0 && power <= 10*self.men;
```

Evidence: coordinate adjustments0x46da–0x4745; g0x4748; a0x47a7–0x47cf; invalid tests0x47d2–0x4856; t²0x4859–0x48dc; speed0x48ff–0x4957; power scale/clamp0x495a–0x49d8. Note this AI checks `10*men`, regardless of a separate user-control power cap. Retry while invalid and attemptCount<=40, meaning at most41 attempts. On final failure it still retains the last result (0x4a17–0x4a43).

Set direction+1; if theta>90 then angle=180−theta and direction−1. Weapon initially11 (Hand Grenade), then scan IDs1..4 and retain the highest ID with positive ammo (0x4a46–0x4a83). Other decision phases and fallback failure behavior are not fully modeled here. No Lobber/Windless complete algorithm is claimed in this pass.

## Trigonometric table and palettes

AI helper `b25:0` (EXE0xc8f0) is integer-degree sine. It normalizes signs and reflects angles into0..90, then reads six-byte Real at EXE **0xc9e9+6*angle**. Helper b25:5a computes sin(90−angle), i.e. cosine. Exact91 values are extracted in fidelity-constants.json. In particular sin(30)=0.4999999999990905 and sin(90)=0.999999999994543; replacing these by mathematical exact values can alter truncations. The ordinary barrel renderer calls runtime sin/cos instead; do not automatically substitute the AI lookup table everywhere.

Stars palette, OVR **0x1c0e9–0x1c15a**: for i0..9, palette30+i RGB=`[5*i,5*i,5*i]`, palette40+i=`[5*i,5*i,0]` in VGA6-bit values. Thus brightest component45, not63. Subsequent stars and palette rotation details are in advanced-weapons.md.

Shared random background palette, resident `431:c`, EXE **0x59bc–0x5b87**:

- Generate three RGB anchor colors, each channel Random(64), nine random calls total.
- For segment j0..2, sample k0..9; each channel is `trunc(anchor[j][channel] + k*(anchor[(j+1)%3][channel]-anchor[j][channel])/10)` using Real arithmetic.
- Assign this color to palette index `30+10*j+k`; store it and a repeated copy in the cycling buffer.
- This forms a30-color closed loop, with10 samples per transition. It is called by Bars and other backgrounds; no fixed hardcoded RGB gradient reproduces its per-round random colors.

Only these palette initializers were fully decoded in this pass. Other background recipes remain as documented in advanced-weapons.md.
