# PC Speaker sound reconstruction — Tank Wars 3.2

Static analysis of the user's BOMB.EXE/BOMB.OVR and BOMB.CFG, 2026-10-18. Offsets below are hexadecimal **file offsets**, not loaded segment addresses. No emulator or browser was operated. `R(n)` means the original shared Turbo Pascal Random(n); audio RNG calls happen only when sound is enabled and affect subsequent gameplay RNG. `Sound(f)`, `NoSound()`, `Delay(n)` below are actual calls, not invented audio envelopes.

## Hardware helpers and timing

| Helper | Far address | EXE file offset | Behavior |
|---|---|---|---|
| Sound | 11f8:02c7 | 0x138e7–0x13911 | Argument is unsigned16 frequency. For f<=18 **return without changing the speaker**, including f=0. Else divisor=floor(0x1234dd/f)=floor(1193181/f). Enable bits0/1 of port61; when both bits were clear, also write0xb6 to PIT control port43. Write divisor low/high to port42. |
| NoSound | 11f8:02f4 | 0x13914–0x1391a | Clear port61 bits0/1. |
| Delay | 11f8:029c | 0x138bc–0x138e6 | Zero returns immediately; otherwise repeat a calibrated busy loop n times. Nominal unit is **milliseconds**, with execution overhead added. |

Sound has no duration argument. Pitch remains active until a later valid Sound or NoSound. It is one monophonic hardware voice; overlapping WebAudio oscillators would change the original behavior. Real output frequency is PIT input clock/divisor; 1193181 is the exact division numerator in this binary. A frequency expression passed to Sound is truncated/wrapped to a16-bit word.

Delay calibration is explicit at EXE0x13684–0x136a7: synchronize to BIOS tick low byte at0040:006c, count loop iterations to the next tick, divide that count by55, store DS[0xec44]. Delay loops that many iterations per unit. This establishes approximately1ms, despite BOMB.DOC describing the settings as “microsecond delays.” It is not a one-tick-per-delay implementation. Calibration has a16-bit counter, so precision/behavior remains CPU-dependent; delayless drawing/PIT loops are entirely CPU-dependent. Static code alone cannot supply their exact historical wall-clock durations.

Original waveform is PIT mode3 (square wave, duty slightly unequal for odd divisors). Speaker/DOSBox analog filtering is not defined by the executable. For precise synthesis preserve one gated oscillator, integer divisor quantization, no-op calls <=18Hz, and chronological calls. Do not turn every Random pitch into an independently enveloped note.

## Config actually found

Read path OVR0x6d8c–0x7002 establishes packed CFG offsets. Values are the file present during this analysis, not claims about a fresh installation.

| CFG offset decimal | DS | Name/use | Value |
|---:|---|---|---:|
| 5 | e8b3 byte | sound enabled | 1 |
| 6 | e8b2 byte | in-flight whistle enabled | 0 |
| 31 | e8c4 word | turret/input polling delay | 8 |
| 33 | e8c8 word | fall delay | 5 |
| 35 | e8c6 word | explosion/palette delay E | 8 |
| 37 | e8ca word | trajectory subdivisions S, not milliseconds | 10 |
| 39 | e8cc word | laser/shot animation delay L | 5 |

Turret/input delay call0x1bf46–0x1bf4a is skipped for input type3. Fall delay0x1ac9e–0x1aca2 occurs per fallen pixel. Defaults before reading CFG zero e8c6/e8c8/e8ca/e8cc at0x6c90–0x6cbf; do not replace the installed settings with those temporary zero initializers. The source names in old DOC/command-line prose are not fully consistent, so DS address and actual use are decisive.

## Shot launch and ordinary flight / MIRV

Both ordinary projectile entry0x10ebc and MIRV entry reproduce this contiguous launch sequence (sound gate at0x10ef0/0x12808). Each item is `[frequencyHz, nominalDelayMs]`; NoSound follows the last item:

```js
[[111,3],[222,3],[333,5],[444,5],[555,5],[666,5],
 [777,5],[888,5],[999,5],[1111,9],[1333,13],[1777,17],[2111,20]]
```

Total explicit delay100ms. Evidence0x10efa–0x10fe4; duplicate0x12812–0x128fc. No random calls in this sequence. Launch sequence is gated by sound; the associated delays disappear when sound is disabled.

During ordinary flight, if both whistle e8b2 and sound e8b3 are true, set `Sound(uint16(600-2*trunc(screenY)))` per simulation update, OVR0x11908–0x11934. The y value is the current screen-coordinate integer `[bp-0x1a]`, not relative height above the firing tank. MIRV uses the same expression on each active particle's y,0x13198–0x131ca. Last processed active projectile owns the speaker. There is **no explicit Delay at the flight pitch call**; S changes simulation subdivisions, not a tone's ms length. Stop at0x12008 before ordinary impact dispatch, and again0x12073; MIRV cleanup0x14119. MIRV temporarily sets `E=trunc(E/5)` at0x120e0–0x120f0 and restores E at0x1411e–0x14122; its explosions therefore have shorter explicit palette delays.

The four-tone termination sequence is specifically the extreme offscreen y condition `screenY < -5000` (and its surrounding mode guard), not a generic collision/ricochet sound:

```js
[[1525,15],[4674,5],[222,10],[121,14]]; NoSound();
```

Evidence0x11e7b–0x11edd; MIRV duplicate0x1398e–0x139dd. Explicit total44ms.

## Ordinary blast, grenade and MIRV impact

IDs1/2/3/4/7/11 share normal blast code0x190ac–0x19777, radius10/15/30/60/15/2 respectively. ID0 Lead Ball has no separate impact Sound call (0x1902c–0x190a9). Normal blast's sound timeline is exact below. `draw/updatePalette` consumes CPU time; only marked Delay calls imply fixed nominal timing.

```js
// Initial expansion, r=0..radius inclusive. No explicit Delay.
for (let r=0;r<=radius;r++) {
  if(sound) Sound(500+R(500));
  drawThreeCircleOutlines(r); //x-1,x,x+1
}
// Three palette phases. Sound is INSIDE inner loops, Delay outside.
for (let i=0;i<=radius;i++) {
  for (let j=i;j<=radius;j++) {
    if(sound) Sound(250+R(500));
    updatePaletteEntry(j);
  }
  uploadPalette(); Delay(E);
}
for (let i=0;i<=radius;i++) {
  for (let j=i;j>=0;j--) {
    if(sound) Sound(3+R(500));
    updatePaletteEntry(j);
  }
  uploadPalette(); Delay(E);
}
for (let i=0;i<=radius;i++) {
  for (let j=i;j<=radius;j++) {
    if(sound) Sound(3+R(250));
    updatePaletteEntry(j);
  }
  uploadPalette(); Delay(E);
}
NoSound();
```

Evidence: expansion0x191f6–0x19288; phase1 0x1928a–0x19324, phase2 0x19327–0x193b3, phase3 0x193b5–0x19449. Explicit duration `3*(radius+1)*E` ms plus expansion and loop/rendering overhead. RNG calls `(radius+1)+3*(radius+1)*(radius+2)/2`. Calls3..18 do **not** mute/change pitch. Most random pitches in a palette inner loop exist only for a handful of CPU instructions; the last valid pitch survives the following Delay(E). Applying E to every inner pitch would greatly lengthen the blast and alter its character.

## CRI

Direct tank impact of a CRI (ID6/8/9/10) follows0x19796–0x19862. After its direct damage it plays a tight frequency sweep:

```js
if(sound) {
  for(let f=1000;f<=30000;f++) Sound(f);
  for(let f=30000;f>=1000;f--) Sound(f);
  NoSound();
}
```

There are58002 Sound writes and **no explicit delay** (0x1982b–0x1985d). Duration is CPU/emulator-cycle dependent; no exact ms constant can be inferred from this loop.

For the terrain crawler branch, after moving each active crawler, `Sound(1+R(500))`, then restore its new terrain pixel. OVR0x19c5c–0x19c91. No explicit delay; <=18 leaves the previous pitch. `NoSound()` at0x19d6e after all crawlers terminate. See advanced-weapons.md for crawler count and lifetime; do not play a new generic explosion on every crawler step.

## Laser

Laser has its own entry/body0x1412b–0x15120, not ordinary shot flight whistle. Initial charge preparation builds100 palette entries and calls `Sound(50*i)` for i1..100 without Delay (0x1434e–0x1442d). Then:

```js
for(let pass=1;pass<=2;pass++) {
  for(let i=1;i<=100;i++) { updatePalette(i); Delay(trunc(L/pass)); if(sound) Sound(50*i); }
  for(let i=100;i>=1;i--) { updatePalette(i); Delay(trunc(L/pass)); if(sound) Sound(50*i); }
}
for(let i=1;i<=100;i++) { updatePalette(i); if(sound) Sound(50*i); Delay(trunc(L/2)); }
```

The last loop divisor is **2**: at0x1451e the completed outer loop jumps out on equality, leaving the shared counter at2 (0x14432–0x14596). Explicit charge delay `200*L+300*trunc(L/2)` ms, plus initial preparation. Pitch changes after the delay in the first two passes, before it in final ascent; preserve that ordering.

Next plays the same13 frequencies as ordinary launch with delays `[6,6,9,9,9,9,9,9,9,20,33,33,40]`, then NoSound (0x145a2–0x1468c): total201ms.

During laser operation:

- Dirt interaction debris loop index k1..15: `Sound(500+R(uint16(500*k)))` at0x14a11–0x14a29; there is no adjacent delay.
- Other beam particle loops k1..15 use same expression at0x14c2a–0x14c42, followed by `Delay(L)`0x14c47; and0x14cc7–0x14cdf without adjacent Delay. These occur only along their respective collision/effect branches, not necessarily once per beam pixel.
- At the common beam-step tail: `Delay(L)`, then if sound `Sound(100+R(uint16(12*remainingFuel)))`,0x14dca–0x14df6. Fuel is the signed word initialized10*selectedPower and reduced as in advanced-weapons.md. The multiplication passed to R retains low16bits (not an arbitrary floating range).
- Laser exit calls NoSound at0x15118.

This is the exact local sound logic; mapping every branch to a compressed fixed-duration “laser sample” loses its dependence on material and remaining fuel.

## Sonic and dirt weapons

Sonic ID12 (0x19d92–0x19ede):100 iterations: palette RNG `R(64)` then, if sound, `Sound(3000+R(1000))`, then `Delay(E)`. Followed by100 iterations: palette RNG `R(64),R(32),R(32),R(32)`, then if sound `Sound(3500+R(1000))`, then `Delay(E)`. NoSound0x19ea3 before collapse. Explicit total200*E ms. Preserve the interleaved palette RNG if seed parity matters.

Dirt IDs13..16: **no Sound call at all** in their earth-circle impact branch0x19ee6–0x1a0a4. Ordinary launch still applies; don't fabricate a dirt impact noise.

Explosive Dirt ID17: for each of N=300+R(100) points in each layer j=1..3+R(8), after writing that point, if sound `Sound(100*j+R(200))` (0x1a315–0x1a337). No explicit Delay in the particle drawing loops; NoSound0x1a34f. Positions are prepared before rendering; follow remaining-mechanics.md RNG order.

**Correction: the sound at0x1a737 is lightning, not crumble.** Actual crumble is EXE0x5e46, gated by OVR0x1ad57, and has no direct Sound calls. Lightning routine0x1a3f1 enters its bolt branch only when argument0; it is called from the prolonged/no-kill round logic0x15a78–0x15aa4. BOMB.DOC also names lightning bolts in this context.

Exact lightning sound loop (OVR0x1a403–0x1a766):

```js
const xStart=10+R(300), xEnd=10+R(300); //each10..309
let current=1;
//Initial path generation, no sound: for y31..189 inclusive,
//update walk with R(7)-3, store currentPath[y].
const passes=1+R(8);                   //1..8; RNG AFTER initial159R(7)
for(let pass=1;pass<=passes;pass++) {
  //First full y-sweep: draw old path, raw damage3 at tank pixels,
  //generate next path; one R(7) per y. No Sound during this sweep.
  for(let y=31;y<=189;y++) {
    drawOldPathAndPrepareNext(y);       //159 iterations
  }
  //Second full y-sweep: restore background and sound.
  for(let y=31;y<=189;y++) {
    const x=path[current][y];          //x is a value, NOT a loop variable
    restoreBG(x,y); restoreBG(x+1,y); restoreBG(x-1,y);
    if(sound) Sound(600+R(600));       //600..1199Hz, one call per y
  }
  current=1-current;
  NoSound();                          //unconditional; once per pass
}
```

Exact counts: `159*passes` Sound calls (159,318,...,1272), and `passes` NoSound calls (1..8). Sound calls are not skipped for an out-of-field path x; the drawing helper may clip, but the sound call still runs. There is no Delay in either sweep. NoSound is immediately after y189 and buffer switch, at0x1a766; the next pass's drawing/generation sweep occurs silent. Bound evidence: N0x1a526–0x1a546; first y sweep0x1a554–0x1a6bb; restoration sweep0x1a6c0–0x1a757; toggle/stop/outer-loop0x1a75a–0x1a774. The prior wording “horizontal traversal iteration” was incorrect.

After those passes, at0x1a777–0x1a7ae lightning dispatches an ordinary impact at `(xEnd,189)` with weapon `trunc(passes/3)`, replacing0 by11. That impact has its separate ordinary blast sound. Thus159*N counts only the jagged bolt sound, excluding its final grenade/incinerator/mark-II blast. Normal per-tank falling has Delay(F), no direct Sound call.


## Death effects

Full movement/counts in death-effects.md; below are actual audio hooks and important corrections to its earlier audio shorthand.

- Cases0/2 preflicker: optional `Sound(R(500))` per preflicker step, then palette flash (which consumes its own R65535). No explicit Delay in flash helper0x1613c. After preflicker NoSound0x16307/0x17ec7. Each of11 particle initializations also calls Sound(R500).
- Cases0/2 flight: `Sound(uint16(1500+5*(deadRecord.y-trunc(particleLocalY))))` per active particle step,0x16549–0x16576 /0x1820a–0x18237. Original deadRecord.y has been changed to viewport-local coordinates earlier in these routines; retain the actual record/coordinate convention of death-effects.md. No explicit Delay here; case0 then calls palette flash, case2 writes point immediately.
- Cases0/2 landing craters: per radius step on expansion and contraction Sound(R2500); draw/erase outlines and Delay(E). Calls0x1668a/0x1671b, delays0x166da/0x16766; case2 0x18367/0x183f2, delays0x183bf/0x1843d. Case0 NoSound at0x16657 before each crater starts; case2 does not have that corresponding stop.
- Case0 center alternating rings: Sound(R(1300-40*r)) at0x16828 and0x168ba. These hook existing radius/half-wave loops; one Delay(E) at0x168d5 follows the second half. No explicit delay at the first Sound. Case2 corresponding hooks0x184d4/0x18539; Delay(E)0x18550.
- **Correction to older common fade shorthand:** case0 final fade does not use R200. Outer a=4..0 descending, inner b=4-a..0 descending: `Sound(R(600+100*b))`, then three palette R63 calls; NoSound inside each inner iteration at0x169cc. Evidence0x168ee–0x16a0a. Case2 fade uses R200 at0x185ab and NoSound0x18644 in each fade iteration. Preserve each variant separately.
- Cases1/3 each drawn point calls `Sound(100+R(500*layer))` and **immediately NoSound**, before contact/drawing, with no Delay between the two calls. Case1 first layer0x16b47–0x16b60, layers2..5 0x16c1f–0x16c3b; case3 0x16dd1–0x16ded. These are very short pulses, not sustained per-point random tones. This detail was omitted from the prior death pseudocode.
- Case4 each point: `Sound(100*wave+R(1000))`, no Delay, NoSound at end0x189e1. wave/counts as death-effects.md.
- Case5 intensity i0..100 then100..0: `Sound(2000+100*i); Delay(E)` per step,0x18a4f–0x18aa7; NoSound0x18ab2.202 steps, explicit202*E ms; no audio RNG.
- Case6: choose localDelay=E, then one R(2) changes it to0 if result1 (0x18ae2–0x18af8). Three sweeps i0..100 each, followed by one i100..1: `Sound(2000+100*i); Delay(localDelay)` per step,0x18b34–0x18b90.403 steps. Then ordinary explosion chain as in remaining-mechanics.md, finally NoSound0x18c7a. Do not add another generic death tone.

## Turret, power and menus

Controls (OVR0x1b23e onward):

| Action | Speaker sequence | Evidence |
|---|---|---|
| Direction-aware angle increment, control1 (`angle+=dir`) | Sound1750; Delay10; NoSound | 0x1b26c,0x1b3ca–0x1b3e2 |
| Direction-aware angle decrement, control2 (`angle-=dir`) | Sound2000; Delay10; NoSound | 0x1b23e,0x1b3e9–0x1b3fb |
| Decrease power, control3 | Sound1500; Delay10; NoSound | 0x1b488,0x1b50b–0x1b523 |
| Increase power, control4 | Sound2500; Delay10; NoSound | 0x1b467,0x1b52a–0x1b53c |
| Power adjustment branch following controls3/4 | Sound1500; Delay10; Sound2500; Delay10; NoSound | 0x1b5e4–0x1b60f; exact input binding not traced here |
| Flip direction | Sound1750,2000,1500,1250 each with Delay5; NoSound | 0x1b75e–0x1b7b9 |

All these sequences, including their Delay, are skipped with sound disabled. General polling delay T=8 is separate. Angle limit reflection and power clamping happen before the beep, so a bounded/clamped action may still beep.

No direct Sound call exists anywhere in BOMB.EXE: exact byte scan found0 Sound,7 NoSound,0 Delay far calls. All108 direct Sound calls in BOMB.OVR are in the shot/effect/control ranges documented above. Main menu/purchase screens therefore have no direct PC Speaker click/beep routine in these binaries; do not add a generic web menu sound. This is a direct-call inventory, not a proof excluding BIOS text bell or arbitrary indirect calls. CRT output can pass ASCII7 to BIOS; no intentional menu bell was identified in this bounded pass.

## Reproduction boundaries

The file sound-call-inventory.json contains every exact direct Sound/NoSound/Delay far-call offset and confirmed fixed sequences/config. Core formulas and explicit delays above are verified. Delayless writes need measured DOS timing or a cycle model to match their duration and texture exactly; choosing, for example,5ms per pixel is an implementation approximation, not a reverse-engineered fact. No duration should be silently invented for those loops. Audio RNG must reuse the engine RNG at the same point, not Math.random or a separate random stream.
