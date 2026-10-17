# Tank Wars 3.2 binary findings

Read-only analysis of the original files, 2026-10-18. All offsets below are hexadecimal **file offsets**, not loaded addresses, unless marked DS. Analysis used Python, `strings`, `xxd`, and Capstone 16-bit decoding. No original file was changed. This is static analysis; the physical trajectory and visual rendering need dynamic comparison against DOS before claiming exact equivalence.

## Provenance and executable layout

- `BOMB.EXE`: 106192 bytes, SHA-256 `659ace6b9a97c30191a8f65cf25f22322c087166909e9fa1d522e529adbafd9d`.
- `BOMB.OVR`: 127951 bytes, SHA-256 `8186d7d4190350992a2a1b7036d9ba62cc4e300c3e9fd3ce901eddbcad5b466f`.

- MZ header is 0x16a0 bytes. Runtime initializer at EXE 0x14380 loads DS segment 0x14d5, so initialized DS file base is `0x16a0 + 0x14d5*16 = 0x163f0`.
- Version Pascal string at EXE 0x16446 is `3.2`.
- OVR begins `FBOV`. Overlay stubs encode file positions. E.g. EXE 0xc8a0 contains `cd3f 0000 23f10100`, which points to OVR 0x1f123. Its entry at EXE 0xc8c0 (segment b20:20) dispatches the damage routine at that OVR position.
- Player record stride is 0x74 bytes, at DS `0x402e + playerIndex*0x74`. Index is 1-based. Useful record offsets: +0x0f x, +0x11 y, +0x13 cumulative score, +0x1b power, +0x1d elevation, +0x1f direction (signed +/-1), +0x21 men, +0x23 alive, +0x24 selected weapon, +0x2e ammo[18] (uint16), +0x52 explosion shield (int32), +0x56 fall shield (int32), +0x5a repulsers (int32), +0x66 team. Some semantic names are reverse-derived from their uses.

## Weapon tables

Names and numbers are directly extracted. Names are 256-byte Pascal string slots; first byte gives length. Complete names start EXE **0x16c6c**, short display names at **0x17e6c**. Prices are signed little-endian 32-bit integers starting **0x1906c**, quantities uint16 starting **0x190b4**. Each has 18 elements in the same order.

The purchase overlay compares available money with DS `[di+0x2c7c]` / `[di+0x2c7e]` (OVR 0x8c83, 0x8c8e; 0x916b, 0x9173), and loads quantity from `[di+0x2cc4]` (OVR 0x951a). This confirms meanings, rather than merely guessing from adjacent numbers.

| ID | Full original name | Price | Purchase quantity | Explosion/dirt radius px |
|---:|---|---:|---:|---:|
| 0 | Lead Ball | -1 | 0 | — |
| 1 | Incinerator | 3000 | 100 | 10 |
| 2 | Mark II Incinerator | 4000 | 10 | 15 |
| 3 | 20 Kiloton Nuke | 7000 | 2 | 30 |
| 4 | 5 Megaton Nuke | 10000 | 1 | 60 |
| 5 | Laser Blaster | 10000 | 1000 | — |
| 6 | Chain Reaction Inducer 4/D | 5000 | 5 | — |
| 7 | MIRV (5 Mark IIs inside) | 8500 | 3 | 15 |
| 8 | Chain Reaction Inducer 8/D | 10000 | 3 | — |
| 9 | Chain Reaction Inducer 20/ND | 10000 | 3 | — |
| 10 | Chain Reaction Inducer 20/D | 15000 | 1 | — |
| 11 | Hand Grenade | -1 | 0 | 2 |
| 12 | Sonic Blaster | 4500 | 10 | — |
| 13 | Ball o Dirt | 4000 | 10 | 10 |
| 14 | Ball o Dirt Mark II | 6000 | 7 | 15 |
| 15 | Ball o Compresed Dirt | 8000 | 3 | 30 |
| 16 | Ball o Super-Compressed Dirt | 10000 | 1 | 60 |
| 17 | Explosive Dirt | 4500 | 10 | — |

`-1`/`0` denotes a non-purchasable entry; it does not mean an automatic unlimited-ammo value. A null/blank radius means not a simple explosion or not identified. MIRV radius is that of each child bomb. Original spelling (Compresed, Absorbtion, etc.) is preserved.

- Explosion switch: OVR **0x190d0–0x19118**, assigns DS `[0x47d8]`: weapon 1 = 10; weapons 2 and 7 = 15; weapon 3 = 30; weapon 4 = 60; weapon 11 = 2.
- These are actual drawing radii: OVR **0x191f6–0x19288** iterates radius 0..value and draws three concentric sequences at x-1, x, x+1 (calls at 0x1924b, 0x19265, 0x1927d). Visual horizontal extents can therefore exceed the radius by one pixel.
- Dirt switch: OVR **0x19f0e–0x19f40**, weapons 13,14,15,16 = radii 10,15,30,60. Same x-1/x/x+1 circle approach (0x19fb7–0x1a03c).
- CRI branch count: OVR **0x1987a–0x198c6** maps 5/6→4, 7/8→8, 9/10→20. Only appropriate entries reach this branch; do not treat it as a radius table. Branches walk through ground pixels; adjacent ground checks begin 0x198ed, choose next direction at 0x19995 onwards.

Guidance names start EXE 0x190d8; short names 0x192d8; int32 prices at 0x194d8 `[20000,20000]`; uint16 quantities 0x194e0 `[5,5]`. Names Herb's Guidance System and Vick's Guidance System.

Defense names start EXE 0x194e4; short names 0x197e4; int32 prices 0x19ae4 `[20000,10000,15000]`; uint16 quantities 0x19af0 `[1000,100,1]`. Names Energy Absorbtion Shield, Inertia Dampener, Repulser.

## Initial state and documented controls

OVR **0x839–0x914** initializes a player record, with zero-filled memory before these assignments:

- selected weapon = 1 (Incinerator), 0x893;
- Lead Ball ammo = 100, 0x8a5;
- Incinerator ammo = `3 * GamesToPlay`, 0x8ab–0x8b7;
- Hand Grenade ammo = `min(10 * GamesToPlay, 999)`, 0x8bb–0x8d7;
- men = 100, 0x8f4;
- initial direction = +1, 0x906.

Each round setup sets power = **200** at OVR **0x1d154**, men = **100** through the helper at **0x1d181–0x1d193**. The last tank faces left (-1) at 0x1d16b; others face right (+1) at 0x1d17b. Elevation is 75 or 90 depending on a preceding membership test; constants at 0x1d136 and 0x1d146. That exact selection condition is not decoded here.

BOMB.DOC lines 230–290: max power = `100 * men`; arrows up/down change power by1; PageUp/PageDown by100; left/right alter gun angle; I reverses direction without changing elevation; Space/Return fire; Tab/Shift-Tab cycle weapons; H/V activate guidance; numeric keys inspect players. Terrain drawn first, tanks fall into position, one random player starts, then turns advance left-to-right (DOC 216–227).

## Projectile integration (reverse-derived)

This is a direct translation of static arithmetic, **not yet dynamically validated**. DS stores x at 0x4796, y at 0x479c, vx at 0x47a2, vy at 0x47a8, all Turbo Pascal six-byte Real values. Math helper mapping follows call sites: runtime 12ce:11b6 add, 11bc subtract, 11c8 multiply, 11ce divide, 11dc integer→Real, 11e0 Real→integer.

```js
// Angle is in degrees. Screen y points downward.
x = tank.x + 10 * Math.cos(angleRadians) * direction;
y = tank.y - 10 * Math.sin(angleRadians);
vx = power / 50 * Math.cos(angleRadians) * direction;
vy = -power / 50 * Math.sin(angleRadians);
// S is the projectile integration subdivision count from DS e8ca.
x += vx / S;
y += vy / S;
vy += 0.1 / S;
vx += wind / 5000 / S;
```

- Initial x/y: OVR **0x11089–0x1114a**; muzzle distance10 is encoded as Real register tuple `CX=0x84, SI=0, DI=0x2000`.
- Initial velocity: **0x1114e–0x11216**; divisor50 is Real tuple `0x86,0,0x4800`. Sin and cos calls at runtime 12ce:1301 and 12ce:12ee. Degree-to-radian helper at EXE **0xf349** divides by180 then multiplies by pi.
- Integration: OVR **0x11329–0x1141a**, explicitly position first and acceleration second (Euler update). Gravity is tuple `AX=0xcd7d, BX=0xcccc, DX=0x4ccc`, the TP Real representation of approximately0.1. Wind divisor is `CX=0x8d,SI=0,DI=0x1c40` = 5000.
- S is copied from DS e8ca at 0x11229; the supplied BOMB.CFG contains S=10 at file offset0x25 (uint16), loaded into DS e8ca by OVR0x6fa2–0x6faf. Wall modes, guidance and repulsers modify velocities in later blocks.
- Pascal Real has ~39 fraction bits, unlike JS double; pixel-level collision parity also depends on matching the Real→integer conversion and timing. No claim of seed-equivalent trajectories is made here.

## Blast damage and score (reverse-derived)

OVR **0x19580–0x19777** loops over alive tanks and computes Euclidean distance `d` to impact. Distance helper at EXE **0xf2ff–0xf346** squares both coordinates, adds, takes sqrt. Let `r` be the weapon radius.

```js
let damage = 0;
if (d <= 1.5*r) damage += trunc(1.8*r - d);
if (d < r) damage += 10 + 2*trunc(1.8*r - d);
if (d < 0.7*r) damage += 150;
```

These conditions **accumulate**, rather than choose one branch. First threshold 0x1962b–0x19687; second 0x1968a–0x196e6; third 0x196e9–0x19716. The constants are six-byte Real encodings (1.5,1.8,0.7). Real→integer conversion is confirmed `trunc` toward zero: EXE0x15560 sets CH=0 before conversion0x154da; the carry-round increment at0x15513 is skipped for CH=0, and sign is reapplied afterward.

Before area damage, a projectile collision color in20..29 denotes a direct tank hit. A simple bomb calls the damage helper with200 at OVR **0x194ba–0x194e4**. A Lead Ball only does5 on direct hit (**0x1903b–0x19065**). The original DOC also explicitly says Lead Ball damage5.

Damage helper OVR **0x1f123–0x1f26a** subtracts damage from the relevant defense reserve first. If reserve becomes negative, overflow reduces men, clamped at0. It returns previous men minus new men, so scoring uses actual men removed, not uncapped blast damage. On non-falling damage there is also a chance to destroy a Repulser; exact probability logic should be checked separately.

OVR **0x19732–0x19767** multiplies returned men loss by10 and adds it to the shooter's cumulative score only if teams differ. Score helper at **0x1f2ae–0x1f2cc** adds to record+0x13. Lead Ball/direct-hit/CRI paths follow the same pattern. Kill and victory rewards were subsequently identified below.

## Fonts and rendering

Three full BGI stroke fonts embedded in EXE were decoded to JSON, with their original glyph widths and integer move/line commands:

| File | Embedded start | Font header | Data start | Characters | Ascender / baseline / descender |
|---|---:|---:|---:|---:|---|
| tiny-font-extracted.json | 0xc0ae | 0xc12e | 0xc25e |32..127|4 /0 /-7|
| litt-font-extracted.json | 0x8b90 | 0x8c10 | 0x8ebd |32..254|7 /0 /-2|
| euro-font-extracted.json | 0x9f9b | 0xa01b | 0xa2c8 |32..254|45 /0 /-10|

BGI CHR header: numchars uint16 at header+1, first code at+4, stroke-data offset at+5, offsets table at+16, followed by uint8 width table. Stroke pairs use bit7 of x to indicate valid command; bit7 of y is draw vs move; remaining7 bits are signed coordinates. Glyphs end when x bit7 is clear. TINY has mostly no lowercase glyphs (width0). LITT and EURO include lowercase. JSON keys above127 are raw character-code values, not Unicode decoding of CP437.

Canvas rendering should use integer line rasterization (e.g. Bresenham) with y inverted: tiny top baseline is `screenY = top + 4 - glyphY`. Font scale and BGI text justification still depend on the call site. All three exports preserve source vectors and widths, so they can be rasterized without CSS font substitution.

**Default 8x8 BGI bitmap font is not embedded here.** The VGA256 driver reads BIOS ROM: EXE **0x8799** `add bp,0xfa6e`; **0x879d** `mov ax,0xf000`; **0x87a0** `mov es,ax`. It then reads8 bytes at ES:BP. Higher characters can come from interrupt vector1F at address0x7c (0x8777–0x8794). Thus BIOS ROM `F000:FA6E` from the reference DOS environment is the right source for exact default bitmap glyphs.

Playfield viewport is `(11,31) .. (309,189)` in the explosion and dirt code (OVR 0x19179–0x1918c and 0x19f49–0x19f5c). Screen mode string EXE0x7ff5 is320x200 VGA/MCGA mode13H. Menu weapon icons are procedurally drawn with BGI primitives around OVR0x1d2xx–0x1dfa9; e.g. Hand Grenade at0x1db2c–0x1db7b.

## Explicit gaps

Exact crumbling/falling damage, wind distributions/gust rules, AI, wall behavior, laser energy/damage, guidance, full CRI rules, exact initial elevation selection, full economy edge cases and RNG have not been completely decoded. These should remain marked approximations until compared to the original executable. Data tables and font payloads are exact extractions; formulas above are static reverse-derived translations with cited instructions, not a completed proof of whole-game equivalence.


## Terrain generation and initial placement (reverse-derived)

The terrain is a correlated integer slope walk, not a sine wave or midpoint displacement. OVR **0x1cca3–0x1cffa**:

```js
let x=11, h=randomInt(150), slope=0, dir=1-2*randomInt(2);
const margin=60-7*(playerCount-2);
function column() { // original includes both line endpoints
  drawVertical(x,190-h,189,2); // dirt palette index2
}
while (x<310) {
  if (x<11+margin || x>309-margin) { column(); x++; continue; }
  const sign=Math.sign(slope);
  switch(Math.abs(slope)) {
    case 0: column(); x++; column(); x++; column(); break;
    case 1: column(); x++; column(); x++; h+=sign; column(); break;
    case 2: column(); x++; h+=sign; column(); x++; h+=sign; column(); break;
    case 3: column(); x++; h+=sign; column(); h+=sign; break;
    case 4: column(); h+=2*sign; break;
  }
  if (random()<0.2) slope+=dir;
  if (random()<0.1 || Math.abs(slope)>4) dir=-dir;
  slope=Math.max(-4,Math.min(4,slope));
  if(h<=20) dir=1;
  if(h>=140) dir=-1;
  if(h<=3) slope=1;
  if(h>=155) slope=-1;
  x++;
}
```

Initialization0x1cca3–0x1ccf2; flat margins0x1cd00–0x1cd4d; slope patterns0x1cd50–0x1cf66; random evolution and boundaries0x1cf66–0x1cff6. Random calls here use Pascal Random; replacing its generator will change seeds/maps even with the same algorithm. An h=0 column needs the BGI inclusive-line behavior checked (endpoints can reverse).

Placement OVR **0x1cffd–0x1d086**: first position `16+randomInt(28)`, last position `305-randomInt(28)`, interval `trunc((last-first)/(playerCount-1))`; intermediate positions `first+(i-1)*interval`. Player identities are randomized separately. Initial tank y=32 at0x1d1ad, then fall/settle logic runs.

The supplied BOMB.CFG has10 rounds (offset0x0f), Normal wind mode2 (0x07), crumble75 (0x09), no walls0 (0x0b), visible projectile (invisible flag0 at0x0d), visible trail1 (0x0e), falling enabled1 (0x11), random background9 (0x12), computer buys1 (0x1e), shot subdivision10 (0x25). These are this user's file values, not necessarily every historical version's defaults.


## Economy, falling and boundaries follow-up

- **Cash = cumulativeScore − cumulativeSpent.** Player status cash rendering at OVR0x1e725–0x1e73f subtracts record+0x17 (int32) from record+0x13 (int32). Purchases preserve the total score.
- **Enemy kill bonus +1500.** In death processing OVR0x1587b onward, men<=0 and previously alive triggers death. The current shooter's team is compared with the dead tank's team at0x15995–0x159b4. Different teams: add1500 at0x159ca; increment kills at0x15a07. Same team: subtract1000 at0x15a21. This is additional to damage points.
- **Winning-team award** OVR0x1031b–0x103ea: count members whose team equals winning team; every member of winning team gets `trunc(1000*playerCount / winningTeamMemberCount)` score. Alive members additionally gain a win at0x103b2. In free-for-all winner receives1000*playerCount.
- **Falling damage** OVR0x1a9b6–0x1acd9: checks support under tank at offsets x−3..x+3 and outer x±4, drops tank one pixel at0x1abb9, adjusts x by−1/+1 when its right/left edge hits support (0x1abed–0x1ac31), and applies `randomInt(3)+1` damage using defense type1 (fall shield) **for each fallen pixel** at0x1ac7d–0x1ac99. No per-men score helper is called there; later kill processing still awards a kill to the current shooter. Exact support material membership is not fully enumerated here.
- **Ammo/defenses persist between rounds.** Initialization at0x7fe/0x839 runs at new-game setup (call0x4348). Round terrain/tank setup0x1ca44 resets men, power, position, alive state but does not reset the inventory arrays. No per-round refill was found. This is a control-flow inference from both routines and inventory writes, rather than a complete runtime trace.
- **Shot cost in men:** ordinary firing at0x1105a–0x11084 calls Random and with probability0.2 applies1 explosion-type damage to the shooting tank. Laser setup includes the same pattern at0x146e4–0x14709. It is absorbed by applicable shield through the common helper. The thematic reason for this rule is not encoded in text.
- **Field bounds:** physical drawing viewport x11..309,y31..189 inclusive. Previous projectile restoring/trail drawing requires x>11,x<309,y>31 at0x11939–0x1194a. Collision neighborhood checks at0x11a05–0x11a26 use x>11,x<309,y>33,y<187 before examining surrounding pixels. This is **not** a rule to immediately destroy shots outside that rectangle: projectiles can fly well above the visible screen and return. Out-of-bounds/wall/timeout handling is later in the routine.
- Warping shifts x by300 at0x11d73–0x11dc2 (TP Real tuple0x89,0,0x1600). Projectile timeout is >1000 subdivision groups (0x11e62–0x11e76). A y threshold−5000 exists at0x11e82; use further inspection before assuming its exact outcome.
