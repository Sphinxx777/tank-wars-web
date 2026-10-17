# Advanced weapon and terrain algorithms — Tank Wars 3.2

Static read-only disassembly of original BOMB.EXE/BOMB.OVR. All offsets are hexadecimal file offsets. Findings below are reverse-derived, not dynamically validated. See binary-findings.md for hashes and basic physics. Original files and dist were not modified.

## CRI: pixel random walks, not blast circles

OVR0x18f2c is the constant-set area used by explosion handler0x1900c. Exact Pascal membership sets decoded from32 bytes each:

| Set offset | Members | Purpose |
|---|---|---|
|+0x00|1,2,3,4,7,11|simple bombs|
|+0x20|5,6,7,8,9,10|CRI-compatible branch (earlier handlers exclude some)|
|+0x40|20..29|tank colors|
|+0x60|6,8,10|diagonal-capable CRI/D|
|+0x80|12|Sonic|
|+0xa0|13..16|dirt balls|
|+0xc0|17|Explosive Dirt|

Actual CRIs: ID6=4 walkers, ID8=8 walkers, ID9=20 walkers cardinal-only, ID10=20 walkers with diagonals. D means **diagonal adjacency**, ND means no diagonal adjacency. This is exact from the neighbor enumeration and membership set (OVR0x19a90–0x19aa7).

If collision is a tank (color20..29), CRI applies `1+randomInt(weaponId*6)` direct damage, awards10 points per actual lost man to a different-team shooter, then returns (0x19796–0x19865). Thus maximum direct raw damage is36,48,54,60 for IDs6,8,9,10. It does not launch terrain walking from a direct tank hit.

If collision is dirt (color2), the terrain sequence begins0x19865. Radius variable is reused as walker count, not a radius. Impact x/y are truncated to integers (0x198c6–0x198e5). The starting y is increased until at least one cardinal neighboring pixel equals dirt2 (0x198ed–0x19940). This matters when the hit point was on a thin edge. All N walkers start at that same seed (0x19942–0x1997a).

```js
const directions = [
  [0,-1], [1,-1], [1,0], [1,1],
  [0,1], [-1,1], [-1,0], [-1,-1]
];
const diagonals = [6,8,10].includes(weaponId);
// Seed y advances until any N/E/S/W neighbor is dirt2.
const heads = Array.from({length: N}, () => ({x: seedX, y: seedY}));
while (true) {
  for (let i=0; i<N; i++) {
    const h=heads[i];
    const choices=[];
    for (let k=0;k<8;k++) {
      if ((k%2===0 || diagonals) && pixel(h.x+directions[k][0],h.y+directions[k][1])===2)
        choices.push(k);
    }
    if (choices.length) {
      const k=choices[randomInt(choices.length)];
      h.x+=directions[k][0]; h.y+=directions[k][1];
      restoreBackgroundPixel(h.x,h.y); // removes ONE selected dirt pixel
    } else heads[i]={x:0,y:0};
  }
  let dead=0;
  for (let i=0;i<N;i++) if (heads[i].x===0) {
    dead++;
    // Original searches20 storage slots, excluding i, for first x!=0.
    const live=heads.find((h,j)=>j!==i && h.x!==0);
    if(live) heads[i]={...live};
  }
  if(dead===N) break;
}
```

Evidence: cardinal candidates0x199b5–0x19a8d, diagonal candidates0x19a90–0x19b82, uniform choice0x19b94–0x19ba3, movement0x19ba7–0x19c5c, pixel removal0x19c73–0x19c91, dead marker0x19c98–0x19cae, clone-first-live0x19cbd–0x19d54, termination0x19d56–0x19d6b. Traversal is sequential, so later walkers see removals by earlier walkers in the same iteration. Restoring original background is required for the palette animation effect; replacing pixels with black loses that effect.

There is no blast radius or fixed iteration budget in this routine. It consumes connected dirt until all walkers have no neighboring dirt. This can remove huge amounts of terrain. Pixels of tanks are not dirt2, so CRI paths go around them. Later crumble/fall processing creates much of its lethality.

## Crumble: probability of whole event, pixel gravity to rest

OVR0x1ad57 first redraws the boundary, then compares `random()*100` to the crumble setting (DS e8a4). It skips collapse only when random*100 > setting. If permitted it calls resident routine431:496 = EXE **0x5e46**. Consequently75% means approximately75% chance of a complete crumble event, **not**75% of loose pixels.

Resident routine0x5e46–0x5f1a is assembly over VGA pixel memory. It scans bottom-to-top, identifies dirt palette index2, and allows a downward move only if destination color is0 or30..99 inclusive. Colors20..29 (tanks), boundaries, projectiles and other non-background colors block movement. In the original, moving a dirt pixel restores the original background color at its old position. Background color0 and palette cycling30..99 must be distinguishable from solid dirt2.

1. Initial descending scan (0x5e64–0x5ea7): for each dirt pixel with background below, move it down by320 bytes (one row), restore old pixel from the background buffer, append new address to an active list.
2. Append sentinel0xffff (0x5ea9).
3. Repeatedly traverse active list in the same order (0x5eb4–0x5f14). If a pixel's destination becomes blocked, remove it from active list by zeroing its address. Otherwise move it down one row and update its stored address.
4. Finish when no nonzero active entries remain.

Bottom-to-top ordering ensures a pixel above can move into a vacancy opened by one below. The routine operates on every dirt pixel, not connected components, and has no stochastic per-pixel decisions. It does not move tank pixels. The separate falling-tank routine runs afterward when enabled.

Sonic Blaster (ID12) enters0x19d76, uses palette/sound effects, and unconditionally calls the same full collapse routine at0x19ede, ignoring the configured probabilistic gate. Its existing pixel visual is restored before collapse. No simple explosion radius or bomb blast damage occurs in this branch.

## MIRV

Setup labels at0x1207f–0x120d5: Random, Horizontal, Vertical, +4 Way, X4 Way; Detonations: Impact, Simultanious, None. The original misspelling is preserved in UI.

A parent flight uses the standard initial velocity and physics. It transitions to five children after `vy > 0` (strictly positive, OVR0x138d7–0x13907); the documentation calls this the arc peak. Children inherit parent's x,y,vx,vy (0x13cb4–0x13d3a). Spread is added to velocity, **not** to position or launch angle:

| Mode | Velocity offsets per child |
|---|---|
|Random|each axis independently `random()*6−3`|
|Horizontal|vx += `(i−3)*1.75`, vy unchanged; i1..5|
|Vertical|vy += `(i−3)*1.75`, vx unchanged; i1..5|
|+4 Way|(+1.75,0),(-1.75,0),(0,-1.75),(0,+1.75),(0,0)|
|X4 Way|(+1.75,+1.75),(-1.75,-1.75),(+1.75,-1.75),(-1.75,+1.75),(0,0)|

Random0x13d48–0x13dec; horizontal0x13df7–0x13e41; vertical0x13e4c–0x13e96; plus0x13ec6–0x13f56; X0x13f64–0x14088. The Real tuple0x81,0,0x6000 is1.75;0x83,0,0x4000 is6;0x82,0,0x4000 is3.

Impact mode triggers each child blast when it stops (0x13b3f–0x13bae). Simultanious mode waits for all children to stop, then detonates five stored endpoints (0x14096–0x14117). None does not call these detonation branches. Child blasts use weapon7's radius15. Flight subdivision is adjusted after splitting to `max(1,ceil(configuredSubdivisions/aliveChildren))` (0x13c3d–0x13c6e). Guidance selection is cleared for MIRV at0x12927–0x12929.

## H/V guidance

Selected guidance value is a bitmask: set at overlay-base0x10d05+0x177 is{1,3}, set+0x197 is{2,3}. H=1, V=2, both=3. One charge of each selected system is consumed on firing (ordinary shot0x1100f–0x1104d). It does not aim the initial gun automatically.

After ordinary ballistic integration and repulser force:

- **V**, if `abs(target.x-trunc(shot.x))<=2`: set vx=0. If target.y−trunc(shot.y)>0, add0.5 directly to shot.y; otherwise subtract0.5. It does **not** zero vy. Evidence0x11787–0x1180b.
- **H**, if `0 < target.y−trunc(shot.y) <= 4`: set vy=0. Let dx=target.x−trunc(shot.x). If dx*vx<0, multiply vx by−1.01. Else if vx!=0 multiply vx by1.01. Else set vx=+0.1 (even if target lies left). Evidence0x1180f–0x118ea.
- If either adjustment happened, projectile palette color19 becomes red (0x118f0–0x11904).

This produces a vertical/horizontal alignment trap, not ordinary homing steering. Guidance target selection/UI is separate, and edge cases involving dead targets were not traced fully.

## Defenses and repulser

Common damage routine OVR0x1f123 subtracts raw damage from reserve[type], where type0 explosion reserve at record+0x52, type1 fall reserve at+0x56. Nonnegative remaining reserve absorbs everything. A negative result overflows into men, clamped at0, and reserve is then set0. Thus shields use continuous capacity, not percentage reduction. Return value is actual men lost.

If non-fall damage overflows a shield and a repulser exists, destroy one repulser with probability `min(1,overflowDamage/40)` (0x1f1cf–0x1f231). This uses overflow raw damage before men-loss clamping. It does not automatically consume a repulser charge every time a shot is deflected.

Ordinary projectile repulsion (0x1148d–0x11731) considers alive tanks with repulser count>0. There is a distance check: both abs(dx),abs(dy)<=40, and squared distance<=1600. The shooter is excluded until its shot has left a40x40 coordinate box around the launch tank (0x11444–0x11484). The force is active for enemy and friendly tanks.

For dx=tank.x−shotPixelX and dy=shotPixelY−tank.y, squared distance d2=dx²+dy² (note y sign), force magnitude is **−600 / d2 / subdivisions**, decoded from Real tuple0x8a,0,0x9600 at0x1161f. Angle is `trunc(atan(dy/dx)*180/pi)`, plus180 when dx<0; if dx=0 use90 for dy>0, else270. Then vx += cos(angle)*force; vy -= sin(angle)*force (0x11640–0x116f9). Original uses integer-angle sine/cosine lookup functions. It draws a yellow line between repulser tank and projectile (0x115dd–0x11600) then restores it.

The singular d2=0 behavior is not separately guarded in the inspected code; collision order normally prevents reaching that state. Do not invent a numerical proof from this static pass.

## Laser (partial exact translation)

- Muzzle offset7 pixels, unlike ordinary shot10 (0x1470e–0x147cf).
- Velocity is a unit direction vector: cos(theta),−sin(theta). For left-facing gun theta=180−elevation (0x146a3–0x146d7,0x147d3–0x14818).
- Internal fuel begins `10*selectedPower` (0x14691–0x146a0), loses10 per spatial unit step (0x148c0–0x1490e). With no obstructions, selectedPower approximates maximum travel distance in pixels.
- Beam intensity follows remaining-fuel ratio using multiplier53/(10*power), plus10, assigned to palette254 (0x14888–0x1494e).
- At a dirt pixel, it performs15 random background restores behind the beam: x−randomInt(20)*vx, y−randomInt(20)*vy, each axis sampled independently, excluding tank colors20..29 and beam color254, and within field bounds (0x14987–0x14aab). It keeps advancing; there is no explosion radius.
- At a live tank pixel, fuel loses an additional10 (0x14aff), damage3 via explosion shield is applied (0x14d61–0x14d77), and position is backed up by one unit direction vector (0x14d7c–0x14dc6). This pins the beam onto the same surface while consuming fuel and damaging the tank. Shield presence also controls particle effects.
- No10*men damage-score call exists within this laser damage loop; common later kill accounting still applies.
- Lasers reflect on solid wall modes, warp on warp mode, and terminate at outward field boundaries otherwise. Detailed palette particles and power/ammunition deduction entry paths are not fully translated here. DOC confirms1000 energy per purchase, selected power denotes energy to use, minimum100 energy required to fire.

## Backgrounds

Exact ordered names decoded from Pascal strings OVR0x13d7: **None, Stars, Bars, Circles, Spread, Sky, Static, Rectangle, Asterisk, RND, USER** (indices0..10). Main gameplay renderer starts0x1c0c0. Background pixels use palette30..99 and are saved in a buffer for restoration by weapons; animated look largely comes from changing palette entries instead of modifying pixel positions.

Confirmed recipes:

- Stars, mode1: count `250+randomInt(500)`; each x=`11+randomInt(299)`, y=`31+randomInt(159)`, color=`30+randomInt(20)` (0x1c15c–0x1c1c0). Palette30..49 rotates; cycle delay setup uses3*(configuredDelay+1).
- Bars, mode2: for y31..190, horizontal x11..310 line colored `30+(y%30)` (0x1c223–0x1c262). Palette30..59 rotates.
- Circles, mode3: concentric radius sequence from0 with palette `30+(radius%30)`, circles drawn at center x and x+1 (0x1c29a–0x1c321). Center is selected by two resident random helper functions; full range not decoded in this pass.
- RND, mode9: choose `randomInt(9)` once per round (0x1cafc–0x1cb0d).
- USER, mode10: repeatedly choose `randomInt(9)` until corresponding bit in configured background mask is set (0x1cb11–0x1cb3a).

Other background mathematical recipes and palette initializers are not fully decoded. Exact typography/rendering can use the font data extracted in the previous pass.
