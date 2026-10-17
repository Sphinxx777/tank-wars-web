# Remaining mechanics — Tank Wars 3.2

Bounded read-only static analysis, 2026-10-18. Addresses are hexadecimal file offsets in BOMB.EXE or BOMB.OVR. Complete formulas are distinguished from partial observations. No graphics-only effects were reconstructed. Shared RNG and integer-degree trigonometric table are in fidelity-details.md/fidelity-constants.json.

## Important weapon-name correction

Weapon **0 is Lead Ball**, **11 is Hand Grenade**. Prior prose calling AI fallback11 “lead” was incorrect; numerical IDs in the disassembly and extracted weapon JSON were correct. The fallback used by several AIs is Hand Grenade11, eventually falling back further if ammunition is exhausted.

## Common AI execution

All AIs finish through resident EXE **0x2b00–0x2e17**, which converts their chosen shot to incremental aiming/power/weapon actions. This common code:

- If the desired weapon has no ammo, decrements its ID until ammo is available, wrapping below0 to12 (0x2b06–0x2b40). Some AIs have an earlier, more restricted fallback order as noted below.
- Clamps desired power to **10*current men**, then if weapon5 (Laser), to available laser energy, then to a minimum0 (0x2b42–0x2bc1).
- Prioritizes correcting weapon, direction, power, then elevation before firing. Its intermediate large adjustments accelerate convergence; they do not add random aim errors.

AI object offsets: +3 desired power, +5 elevation, +7 direction, +9 weapon, +0xc target player index, +0x10 own player index, +2 has-current-plan flag. Constructor IDs match name strings at EXE0x1646c+256*ID:1 Mr. Stupid,2 Lobber,3 Rifleman,4 Lob & Shoot,5 Windless Wit,6 Twanger,7 Wind Master.

## Mr. Stupid — complete shot selection

EXE **0x2ea8–0x2fb8**, constructor ID1 at0x2e78. Solid-wall test uses the bitset at0x2e88, exactly modes{1,2,3}.

```
weapon = 11
for id in 1..4: if ammo[id]>0: weapon=id
angle = Random(90)
if wallMode in {1,2,3}:
    do direction=Random(3)-1 while abs(direction)!=1
    power=20+Random(5000)
else:
    direction = selfIndex <= playerCount div 2 ? +1 : -1
    power=20+Random(300)
```

No enemy-target choice or ballistic solution occurs. Solid walls frequently produce a proposed power above1000, subsequently capped by the common10*men rule. Direction sampling consumes a variable number of RNG calls because zero is rejected.

## Rifleman — complete principal shot selection

EXE **0x383a–0x3d76**, constructor ID3 at0x380a.

For each player in index order, score=1000. If target.y>self.y+3, divide score by10, giving100. If dead/self/same team, set score0 and skip ray scoring. Otherwise dx=target.x−self.x, dy=target.y−self.y, length=hypot(dx,dy). For k=1..trunc(length):

```
x = self.x + trunc(k*dx/length)
y = self.y + trunc(k*dy/length)
if framebuffer[x,y]==2: score--
framebuffer[x,y] = targetIndex+19
```

Evidence0x388e–0x3ab3. The drawn rays are gameplay-relevant during this calculation: earlier target rays can overwrite dirt before a later ray samples it. The complete framebuffer is saved before and restored after choosing. For a strict reproduction, evaluate on a temporary framebuffer with those writes, not independently against immutable terrain.

Choose the **first maximum score across all players**, including the zero scores for excluded targets (0x3abe–0x3b18); there is no second validity filter in that selection loop.

Compute X=target.x−self.x, Y=self.y−target.y+4. Replace a zero X or Y by1. Default weapon1. If selected score>990, scan IDs2,3,4 in increasing order, selecting the latest ID whose ammo>0 and whose blast radius15/30/60 is **strictly less** than hypot(X,Y). If score<=990 and laser ammo>100, select laser5. These tests are0x3b77–0x3c53.

Set power1000. Angle=`abs(trunc(degrees(atan(Y/X))))`; direction is−1 if targetIndex<selfIndex, else+1 (0x3c53–0x3cd3). No wind or gravity compensation is applied.

If target.y−4>self.y (target substantially lower):

```
angle = 10+Random(70)
if wallMode not in {1,2,3}:
    power=20+Random(280)
    angle=45
weapon=1
```

This fallback,0x3cd3–0x3d42, intentionally consumes Random(70) even when its angle is overwritten by45. Common execution subsequently caps power and handles unavailable ammunition.

## Windless Wit — complete principal solver

EXE **0x3f90–0x441f**, constructor ID5 at0x3f80. Choose `1+Random(playerCount)` until alive, not self, different team (0x3fc8–0x401e). Keep that target while trying candidate angles. Visual targeting animation has no RNG call.

Each attempt (0x415b onward):

```
dx = target.x-self.x
dy = target.y-self.y
direction = dx>0 ? +1 : -1
angle = Random(90)
c=lookupCos(angle); s=lookupSin(angle); t=s/c
X = trunc(dx-8*c*direction)
Y = trunc(dy+8*s)-1
vx = sqrt(abs((0.05*X*X)/(abs(X)*t+Y)))
vy = t*vx
power = trunc(hypot(50*vy,50*vx))
valid = !(t < abs(Y/X) && Y<0) && power<=10*men
```

Coordinate offsets0x41d6–0x4259; vx0x425c–0x42eb; vy and power0x42ee–0x4350; validity0x4354–0x43b7. `lookupTan` is sin/cos in helper b25:bd at EXE0xc9ad–0xc9e1. There is no explicit zero-denominator guard in the translated section; do not replace that behavior with a claim of a fully robust mathematical solver. Actual calculations use Pascal Real.

Retry while invalid and attemptCount<=40, hence at most41 attempts. After the cap retain the last candidate. Default weapon11; scan1..4 and take the highest available (0x43c6–0x4403). The solver ignores actual wind entirely. Wind Master differs as documented in fidelity-details.md.

## Lob & Shoot — exact dispatch

EXE **0x3e04–0x3f1f**, constructor ID4 at0x3dd4. If walls in{1,2,3}, instantiate and execute Rifleman; otherwise instantiate and execute Lobber. State is copied between temporary AI object and player AI object; this is not a random alternation between two shot styles (0x3e17–0x3f0a).

## Lobber — confirmed history-based logic

EXE **0x3026–0x37a9**, constructor ID2 at0x3016. This is an adaptive previous-shot estimator, not an analytical gravity/wind solver.

Let n be the player's word at record+0x5e (absolute DS:408c+116*player). A direction crossing can reset n=1 at0x3260–0x32a0. If n=1, proposed angle75 and power100+Random(100). If n=2, angle75 and power200+Random(200) (0x32ca–0x334c).

On a new plan with n<3, start at own player index and walk through players cyclically in current direction, skipping dead/self/same team. For n=1 only, invert the traversal direction if Random()<=.5 (0x307e–0x3147). For n>=3, choose the valid enemy whose x is nearest the most recent stored impact x; ties retain the first (0x314a–0x323f). Direction then follows target index relative to self index.

History is a10-byte-per-shot table per player, with player stride0x7da. Fields by DS base:4a80 angle,4a82 power,4a84 direction,4a86 impact x,4a88 impact y. Writes are confirmed at OVR0x1575a–0x1584c.

For n>=3, the estimator loops all prior pairs i=1..n−2, j=i+1..n−1. At EXE0x3514–0x3631 it calculates:

```
dX = history[j].x-history[i].x; if dX==0: dX=1
ndP = history[j].power-history[i].power; if ndP==0: ndP=1
error = target.x-history[i].x
correction = trunc(error * ndP / dX) rem 32767
```

The routine does not visibly accumulate these values; each pair overwrites the locals, so the final pair dominates. At0x3652–0x3692 it adds correction to the power of final outer-loop history entry, storing a signed16 word; if negative it replaces it by−2*that value. This statement follows final-loop variable lifetime and stores; edge-case parity of overflow and the runtime signed remainder has not been separately emulated.

For n>2, desired weapon starts1, then is increased to2 if abs(error)>5, to3 if>15, to4 if>30 (0x3696–0x3709). If unavailable, explicit fallback is4→3→2→1→11→0 (0x3709–0x377e). Angle is retained at75 from initial plans; no new angle assignment appears in the history branch. Reset/state timing requires the normal turn/history system, so simply approximating it by fresh ballistic search loses this AI's characteristic learning behavior.

## Twanger — confirmed portions; targeting ranking incomplete

EXE **0x4b30–0x587a**, constructor ID6 at0x4b00. Without solid walls{1,2,3}, directly delegates to Rifleman (0x57f6–0x5865). With solid walls it evaluates paths reflected from the ceiling rather than simulating a ballistic arc.

For a target, X=target.x−self.x, Y=self.y−target.y, H=target.y−28. The reflected-line angle is `atan(abs((Y+2*H)/X))`, i.e. uses virtual ceiling y28 (0x4c2e–0x4cad, repeated0x5630–0x56ad). Initial candidate scores1000; self/dead/same-team become−1. It samples both legs to/from the ceiling, subtracting for dirt; then runs additional score-ranking/tie-distance passes. Those ranking passes at0x4fe2–0x5225 were not fully translated, so no exact target-selection pseudocode is claimed.

Final selected shot power=`950+Random(51)` (0x5667–0x5676), angle=`trunc(degrees(atan(abs((Y+2*H)/X))))`, direction by sign(X). After ray evaluation its weapon tests match Rifleman: default1; for score>990, prefer available IDs2..4 if target distance exceeds their radius; for score<=990 and laser ammo>100 select5 (0x5707–0x57ec). Common power cap still applies. Wind, gravity, and the wall damping/acceleration factor do not enter this aim-angle equation.

## Dirt13..16 and Explosive Dirt17

**There is no direct bomb-style damage call in either impact branch.** Their effect is terrain placement, not a hidden radial blast. The common impact routine dispatches conventional explosives through a set{1,2,3,4,7,11} at OVR0x190ac, which excludes all dirt weapons.

Ordinary dirt branch **OVR0x19f02–0x1a0a4** selects radius10,15,30,60 for IDs13..16. It sets dirt color2, uses viewport x11..309,y31..189, subtracts viewport origin from impact coordinates, and for each r=0..radius draws three circle outlines centered at local x+1,x−1,x. Drawing all radii fills the disk; shifted circles close raster holes. No damage-helper call or local crumble chance in this branch. Sonic and dirt13..16 bounce off tank pixels during flight, as described in fidelity-details.md.

Explosive Dirt17, **OVR0x1a0a7–0x1a3eb**, uses a set containing only17 at overlay0x18fec. Its name does not mean an ordinary explosion:

```
N = 300+Random(100)  // one shared count, not rerolled per layer
L = 3+Random(8)
for layer j=1..L:
    for particle k=1..N:
        h = Random(20*j)
        dx = trunc(Random(h+1) - h/2)
        x = trunc(impactX-11) + dx
        y = trunc(impactY-31) - h + 2
        store(x,y)
for j=1..L:
    for k=1..N:
        putPixelWithinViewport(storedX,storedY,2)
```

Particle preparation0x1a137–0x1a2af; drawing0x1a2af–0x1a34f. If sound enabled, each drawn particle additionally consumes Random(200) for pitch. The rendering loop places pixels without checking for tanks/background/previous dirt. No immediate damage helper is called.

Finally **Random()*100 < 2*crumbleSetting** triggers the full crumble routine (0x1a3ac–0x1a3e6). Thus setting50 or more guarantees collapse, except theoretical threshold representations do not change that conclusion. At setting0 it never collapses through this branch, but still consumes Random(). Later turn settlement remains separate. Burial is a movement/firing obstruction effect; this pass found no special suffocation formula in the dirt impact code.

## Death effects: no universal death-blast radius

Main turn handling **OVR0x1587b–0x15995** identifies men<=0 while alive, marks dead, then calls **Random(7)**. Cases0..6 dispatch six different routines (one takes two variants). Thus a universal radius assigned to every tank death is not original behavior.

| Random result | Routine file offset | Confirmed distinction |
|---:|---:|---|
|0|0x1615b|Particle effect; direct tank contacts include5+Random(10) raw damage at0x16502–0x16525.|
|1|0x16edc, extra arg0|Separate death effect; full mechanics not translated.|
|2|0x17d1a|Multiple moving particles; tank contact10+Random(10) raw damage at0x181bf–0x181e2.|
|3|0x16edc, extra arg1|Second variant of the same routine as case1.|
|4|0x1879e|Separate effect; full mechanics not translated.|
|5|0x18a1a|Separate effect; full mechanics not translated.|
|6|0x18adc|Conventional escalating blast sequence, detailed below.|

Case6 copies the dead player's record to scratch player0 (0x18b9b–0x18bb2), then rolls Random(10):0..1→max weapon1;2..4→2;5..7→3;8..9→4 (0x18bb7–0x18c0c). It calls the ordinary explosion routine for **every weapon from1 through that max**, at dead tank x,y, collision color2 (0x18c12–0x18c47). Therefore conditional on case6:

- 20%: radius10 only.
- 30%: radius10 then15.
- 30%: radius10 then15 then30.
- 20%: radius10 then15 then30 then60.

These are cumulative damage-producing blasts, not just a large final visual circle. Each uses the ordinary explosion damage formula. The other death modes can also damage other tanks with particles; they should not be represented as harmless cosmetics if pursuing full equivalence.

The outer death-handling pass repeats through chain deaths, then applies collapse/falling calls0x15a3f–0x15a50. Full particle movement of cases0..5 remains a known, explicitly bounded research gap.
