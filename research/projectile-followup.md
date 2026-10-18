# Ordinary projectile follow-up: collision identity and impact dispatch

Tank Wars 3.2, original local `BOMB.EXE` / `BOMB.OVR`, inspected 2026-10-19.
All addresses below are hexadecimal **file offsets**. This bounded audit
supplements `projectile-audit.md`; it does not claim full-game equivalence.

`tools/verify-projectile-collision-oracle.py` executes the original ordinary
collision loop and original Pascal Real runtime. It replaces only VGA pixel reads
and palette I/O. Its 141 cases in
`tests/fixtures/projectile-collision-oracle.json` cover the five-pixel sample
order, last classified color, power thresholds, repeated ricochets and guidance
cancellation. There is no native-engine code in the fixture generator.

## Confirmed mismatch: sticky target versus last collision color

OVR `0x11a69–0x11b60` scans left, above, center, below, right. Every dirt sample
sets the persistent word DS:47de to 2 (`0x11a89–0x11a8c`). Every tank palette
sample 20..29 sets the same word to that color (`0x11ad3–0x11ad6`). Empty pixels,
trail colors, and other palette entries do not overwrite it. The slot retains
its previous value even on a later substep that samples no classified pixel.

The scan does **not** test tank MEN or the alive flag. This differs from MIRV,
whose separate collision routine tests MEN before stopping. The ordinary scan
reads visible framebuffer colors, including any remaining dead tank pixels;
a layered tank model cannot fully reproduce that behavior from `alive` alone.

A tank on the left and dirt on the right therefore ends with color 2 even if
the earlier tank sample stopped the projectile. A later tank on the right wins
over earlier dirt or a different tank. The previous native engine retained
`hitTank` and also inferred a direct hit from the endpoint center; both can
produce a direct hit the original did not classify.

The original passes the **real** endpoint x/y and this color to the impact
routine at `0x1204f–0x1206e`; it does not replace the endpoint with cached pixels
or perform a fresh sprite hit test there.

## Ricochet is per sample

Weapons 12..16 clear the stop flag and guidance, then set `vy=-1.2*vy` for every
sample with tank color (`0x11afc–0x11b48`). Three qualifying pixels therefore
perform three multiplications; later dirt can set or clear stopping again using
the high-power rule. Each ricochet requests projectile palette19=(0,0,63), blue.
The fixture records every such palette request and the original Real result.
It is not one bounce per tank or per physics step.

## Direct-hit dispatch and damage order

These branches were independently read from the original instructions:

- Lead Ball0: only color20..29 invokes raw damage5 (`0x1903b–0x19065`).
- Conventional bombs1,2,3,4,7,11: radial blast work precedes the additional
  raw damage200. The color20..29 check and call are `0x194ba–0x194e4`, after the
  blast radial-damage loop. Thus the direct hit must be applied after completion
  of the blast, not immediately when its browser animation begins.
- Chain-reaction weapons: color20..29 invokes `1+Random(weapon*6)` at
  `0x197a9–0x197e0`. If it is not a tank color, **only color2 starts the chain**
  (`0x19865–0x1986b`). All other colors bypass chain creation. The old native
  branch began a chain for any endpoint not inferred to be a direct hit.

Direct damage target is the one-based player index `color-19` (zero-based native
index `color-20`). The shared damage helper and later death processing still
own shield absorption and death handling; this classification does not make
those systems equivalent in every edge case.

## Confirmed boundary details for this implementation pass

Ordinary shots differ from MIRV in two important places:

- After a floor reflection, ordinary flight stops when **abs(vy)<0.1**,
  irrespective of horizontal speed (`0x11d41–0x11d64`). MIRV checks both axes.
- Open-wall shortcuts require guidance0 and set real y to **300**, leaving
  cached y unchanged. Conditions are cached x>310, vx>1, wind>0, or cached x<10,
  vx<+1, wind<0 (`0x11dd3–0x11e62`). Zero wind does not discard the shot.

After collision/walls, outer groups>1000 sets both stopped and impact-enabled.
With non-solid walls, cached y<-5000 sets stopped and clears impact-enabled,
with an optional four-tone sound. Cached y>=190 sets stopped but leaves
impact-enabled as it was (`0x11e62–0x11ef3`). These checks use cached coordinates,
not any real y changed by guidance or the open-wall shortcut.

## Bounded remaining backlog

These are cautions or still-incomplete work, not additional proven fixes in
this pass:

1. **Framebuffer overlap.** Original projectile restoration can erase tank,
   terrain, and previous effect pixels before subsequent collision reads.
   Native terrain and sprite layers still cannot represent every such write
   ordering. Persisted last-color and barrel excavation fix concrete cases but
   do not establish complete pixel-memory equivalence.
2. **Arithmetic boundaries and audiovisual pacing.** Pascal Real rounds each
   primitive differently from JavaScript double. Original flight has no fixed
   Delay; browser pacing remains explicit. Long trajectories near truncation
   boundaries and CPU/sound dependent timing still need whole-flight reference
   comparison.
3. **AI edge cases.** `remaining-mechanics.md` documents incomplete Twanger
   ranking/tie passes and Lobber signed16 overflow/remainder parity. These are
   independent of projectile subdivision cadence; this audit makes no new claim
   that those choices match the original.
4. **Memory-dependent death colors and incomplete interface features.** Some
   death flashes depend on arbitrary low DOS-memory bytes. Custom RAW backgrounds,
   DOS save import, and network multiplayer remain absent. Existing notes should
   not be read as evidence that these were implemented by the projectile work.

The ordinary substep counter/integration oracle is a separate companion audit;
this fixture deliberately does not duplicate that work.
