# Tank Wars 3.2 shop: layout and interaction

Static disassembly of the unmodified original `BOMB.EXE` / `BOMB.OVR`, 2026-10-18. Offsets below are hexadecimal file offsets. The rendering code is completely different from the initial web shop's 21-row table: the DOS shop uses compact cards in up to three columns. Raw BGI text anchors/justifications are specified below because the BGI baseline conventions must be verified against the reference screenshot; they should not be guessed from CSS top positions.

## Entry and visibility

Main buying procedure OVR **0x98ab–0xaea2**; card drawing procedure **0x8be7–0x97c7**.

- Minimum positive-quantity purchase price is scanned across weapons, guidance and defenses (0x98c9–0x9995). In this version it is 3000.
- Players with available money `score - spent < 3000` **skip the shop entirely**, even if they already own supplies (0x99f1–0x9a1c).
- AI may also skip based on buying strategy/Computers Can Buy (0x99c2–0x99ee).
- Cards are included if the player already owns a positive amount **or** can afford one lot. For weapons, the quantity table must additionally be nonzero (0x8c57–0x8ca4); therefore Lead Ball and Hand Grenade are never shown. Guidance/defense have the same owned-or-affordable criterion, with quantity checked on the affordability path.
- Inclusion uses money before cart reservations; affordability lamp uses money minus cart cost. Cards remain visible as reservations reduce money, and are rebuilt after actual Purchase (0xacd3–0xacfc).
- Order: weapon IDs0..17, guidance IDs0..1, defense IDs0..2. This is 21 maximum cards.

## Screen structure

Coordinates are native 320×200 pixels and inclusive unless noted.

- Gray upper panel `(5,5)..(314,35)` (0x9a56–0x9a72).
- Player name centered at raw BGI anchor `(160,3)`, color `playerIndex + 19`, EURO font (`DS:e910`), horizontal direction, size4, then user scale x1/2,y1/2, justification(center,top). Font registration EURO is EXE0xf633; DS assignment0xf698.
- Purchase button `(10,16)..(59,24)`, label `Purchase` at raw anchor `(11,14)`; Done button `(284,16)..(310,24)`, label `Done` at `(285,14)`. Font SMALL_FONT=2 (LITT), size4, left/top justification. Label color palette17 (#555555). These buttons are narrow; no extra footer buttons appear.
- `YOU HAVE UNALLOCATED:` at `(11,0)`; `YOU CURRENTLY HAVE:` at `(309,0)`. Both TINY font (`DS:e91a`), size4. Left/top and right/top justification respectively. Color palette6 for left (#AA5500 under normal EGA palette), palette14 for right (#FFFF55).
- Left cash text at `(11,21)` is `score-spent-cartCost + " DOLLARS"`.
- Right cash text at `(309,21)` starts `score-spent + " DOLLARS"`.
- After Purchase, right cash redraw also subtracts cartCost (normally zero after committing), OVR0xae08–0xae42.
- Header label strings are exact Pascal strings at OVR0x97ca (`Purchase`),0x97d3(`Done`),0x97d8(`YOU HAVE UNALLOCATED:`),0x97ee(` DOLLARS`),0x97f7(`YOU CURRENTLY HAVE:`).
- Below y38, original restores a saved framebuffer from pointer DS:e5be/e5bc (0x9c5d–0x9c74 and0xacd3–0xacea). This is a pixel copy (`cc8:cc`, EXE0xe3ec–0xe437), **not** a new generic animated gradient. The specific saved background must be checked dynamically/caller-side.

## Card placement

Start x5,y40; each card has interior bounds `(x,y)..(x+99,y+13)`; after a card y+=18. If new y+13>197, reset y40 and x+=104. Thus nine cards per column, with x=5,109,213; y=40,58,76,94,112,130,148,166,184. Maximum third column has three cards. OVR0x8c25–0x8c2b,0x8da3–0x8db9; repeats for guidance/defenses.

No weapon pictogram appears on these shop cards. Names, prices, stocks, cart count, and an affordability lamp are drawn.

### Card names

- Use **short names** from EXE0x17e6c (weapons),0x192d8(guidance),0x197e4(defense), not the long inventory description.
- Raw text anchor `(trunc((left+right)/2)-7, top+3)` = `(x+42,y+3)`.
- Font SMALL_FONT=2 / LITT; SetTextStyle(2,0,1), SetUserCharSize(8,8,8,8), SetTextJustify(1,1) = center/center. These calls precede all names, OVR0x8bee–0x8c42.
- Weapon names color4 (dark red), guidance10 (bright green), defense9 (bright blue).
- Name calls:0x8d82–0x8d9e,0x8f09–0x8f25,0x909b–0x90b7.

| Category | Original short labels, in order |
|---|---|
| Weapons | Incinerator; Mark II Incin.; 20 Kilo Nuke; 5 Meg Nuke; Laser; CRI 4/D; MIRV; CRI 8/D; CRI 20/ND; CRI 20/D; Sonic Blaster; Ball 'O' Dirt; Mark II Dirt; Pressured Dirt; High Pres. Dirt; Xplosive Dirt |
| Guidance | Herb's Guide; Vick's Guide |
| Defense | Energy Shield; Inertia Damp.; Repulser |

### Price / lot size

- TINY, size4, left/bottom justification, color0(black); raw anchor `(x+2,y+13)`.
- Text `quantity + " FOR " + price` (literal separator at OVR0x8be1), no dollar sign, no commas.
- Energy Shield and Inertia Damp. display lot quantity as `100%` regardless of their raw capacities (1000 and100); Repulser displays1. Other quantities exactly from extracted tables.
- OVR0x94ae–0x9722.

### Current inventory

- TINY,size4,right/bottom, color14(yellow); raw anchor `(x+86,y+13)`.
- Omit when quantity<=0.
- Energy Shield text is `trunc(value/10)+"%"`, capped display100% above1000; Inertia Dampener is `value+"%"`, capped100% above100; Repulser integer.
- OVR0x92f5–0x94ae. Notice max capped only in display here, not necessarily stored capacity.

### Affordability lamp

- Center `(right-40,bottom-2)` = `(x+59,y+11)`.
- Draw ellipse radius1,1 in palette index `100+visibleCardIndex`, then center pixel in same palette index; it is a five-pixel cross.
- Corresponding palette RGB6-bit is `(63,0,0)` when remaining unallocated money >= lot price, otherwise `(0,0,0)`, so bright red vs black.
- Geometry OVR0x9282–0x92e5. Palette reassigned in0x9127–0x9282 and0xa942–0xaae1 after cart changes.

### Cart count box and selection

- Recessed gray box `(right-9,top+3)..(right-3,bottom-3)` = `(x+90,y+3)..(x+96,y+10)`; drawing call0x9763–0x97b7.
- Its bevel colors are reversed relative to the card body: fill18, upper/left17, bottom/right15.
- When selected, rectangle outline of this box changes to palette11(cyan) if another lot is affordable, else palette0(black); OVR0x9ca3–0x9e0e. Previously selected outline restored color18 at0xa4f4–0xa54f.
- Count text shown only if count>0. TINY,size4, center/center,color6(brown). Raw anchor `trunc((2*right-13)/2)+1`, `trunc((top+bottom)/2)-2`, which is `(x+93,y+4)` for nonnegative coords.
- Original allows 0..9 **lots** in cart per card (0xa78c–0xa7a2), not unit quantities.

## Bevel geometry and palette

All header/card/button calls invoke resident `431:2a7`, EXE**0x5c57–0x5d70**. Arguments x1,y1,x2,y2,fill,upperLeft,bottomRight. It fills inclusive interior rectangle, then draws two-pixel bevel **outside** supplied bounds:

```js
fillRectInclusive(x1,y1,x2,y2,fill);
line(x2+1,y1-1,x2+1,y2+1,bottomRight);
line(x2+2,y1-2,x2+2,y2+2,bottomRight);
line(x1-1,y2+1,x2+1,y2+1,bottomRight);
line(x1-2,y2+2,x2+2,y2+2,bottomRight);
line(x1-1,y1-1,x1-1,y2+1,upperLeft);
line(x1-2,y1-2,x1-2,y2+2,upperLeft);
line(x1-1,y1-1,x2+1,y1-1,upperLeft);
line(x1-2,y1-2,x2+2,y1-2,upperLeft);
```

Card/header/button calls use `(18,15,17)` = fill#AAAAAA, highlightwhite, shadow#555555. Small count box uses(18,17,15). Palette17 explicitly set RGB6=(21,21,21),18=(42,42,42),19=(63,63,63) in EXE0x5b88–0x5bc3. Do not use the initial web renderer's one-pixel internal bevel for this exact layout.

## Interaction and commit

- Keyboard Up/Down changes selected card by1 within range. Right/Left changes by9 only if that resulting card exists (0x9ecb–0x9f2d).
- Space, `+`, `=` reserve one lot. `-` releases one lot (0x9e53–0x9ec1).
- `P` or Enter means Purchase; `D` or Escape means Done. Uppercasing happens before comparison. The Pascal key sets at0x980b decode[13,80], at0x982b[27,68].
- Mouse right button reserves, left releases, matching BOMB.DOC375–376 and OVR0x9f6d–0x9f82. Buttonmask1 is left and2 right, verified int33h function3 wrapper EXE0xf827–0xf849.
- Mouse entire card is hit area, including name/price, not just the count box. Selection updates to clicked card. Top button hit areas use the inclusive rectangles given above.
- Reservation limited by remaining available cash and9lots. Release only when count>0. Cart reservation cost changes immediately; inventory remains unchanged until commit.
- Purchase commits every nonzero reservation, increments cumulativeSpent, grants quantity×count. Then clears cart, rebuilds list from new ownership/affordability, remains on shop. Done executes same commit and then moves to next eligible player. No discard-on-Done semantics (0xaae4–0xad0e).
- On exit, writes cumulativeSpent to player's+0x17 at0xae51–0xae5f. Score remains unchanged.

## Explicit validation needs

The positions/strings/filtering/colors/interaction above are supported by disassembly. The later sections below resolve BGI vector baseline, scale and saved-background generation from the linked runtime. A final dynamic original-vs-web screenshot match is still required; no such match has been performed in this bounded research task.

## Follow-up: exact BGI font scale and alignment

The linked vector font renderer defines size multipliers at EXE**0x13013**, read at0x13032–0x1304a:

| BGI size | Scale |
|---:|---:|
|1|3/5|
|2|2/3|
|3|3/4|
|4|1|
|5|4/3|
|6|5/3|
|7|2|
|8|5/2|
|9|3|
|10|4|

Thus `SetTextStyle(TINY,0,4)` means original glyph coordinates at **scale1**, not four-times font! `SetUserCharSize` sets size0 and applies the provided rational scales immediately (EXE0x10fe3–0x11022 and0x13158–0x13193). Shop card names explicitly set8/8→scale1; header name explicitly1/2→scale0.5; header buttons LITT size4→scale1; all TINY size4→scale1.

Font full height=`trunc((ascender-descender)*scaleY)`: TINY11, LITT9, EURO at1/2→27. This includes the font's unusual nominal descender even when particular glyphs never occupy it. For horizontal text, the stroke baseline is:

```js
width=trunc(sum(glyphAdvanceWidths)*scaleX);
height=trunc((font.ascender-font.descender)*scaleY);
originX = rawX - (hJust===0 ? 0 : hJust===1 ? (width>>1)-1 : width);
baselineY = rawY + (vJust===0 ? 0 : vJust===1 ? height>>1 : height);
// Each stroke endpoint uses truncation toward zero independently.
px=originX+trunc(glyphX*scaleX);
py=baselineY-trunc(glyphY*scaleY);
```

Evidence: width accumulation0x13242–0x13288; signed coordinate scaling0x13394–0x133eb; justification0x13445–0x134a5. Center X has a deliberate **+1 pixel** relative to usual mathematical centering. Width is summed and scaled once for justification, but glyph advancement is scaled per glyph (see0x132d9–0x132f8 and0x134a6), which matters at non-integer scales.

Examples with exact raw anchors from earlier sections:

- TINY header `(11,0)` top justification: baseline11, visible uppercase strokes y7..11.
- LITT Purchase `(11,14)` top: baseline23, uppercase visible y16..23.
- LITT card name `(x+42,y+3)` center: baseliney+7, uppercase visible y..y+7.
- TINY card price bottom `(x+2,y+13)`: baseliney+13, visible strokesy+9..y+13.
- TINY inventory same bottom baseline as price.
- TINY count center `(x+93,y+4)`: baseliney+9, visibley+5..y+9.
- EURO header name `(160,3)` top, half scale: baseline30, max uppercase ascender at trunc(45/2)=22 gives top8. Endpoint scaling is truncation, not round.

BGI has an aspect-ratio correction hook for preset sizes (0x131a5–0x131c2), but stored aspect default here is10000, and the correction only applies below10000. Explicit user scales bypass it. The reference mode uses uncorrected original glyph widths; screenshot verification can confirm final positions.

## Follow-up: menu/score/shop backdrop

Background routine is OVR**0x417e–0x431a**, mapped by EXE b02:34 overlay stub at0xc6f4 (overlaybase0x5e8+relative0x3b96=0x417e).

Palette initialization: for palette index i30..59, RGB6=`(i,0,i)` (0x4184–0x41a8). RGB8 conversion in the web renderer should match the reference VGA expansion; with round(v*255/63), the range is(121,0,121) through(239,0,239). It does not include arbitrary blue/red asymmetry or a sine gradient.

Two bitmap modes:

```js
// Mode 0, main menu: exactly one Random(2)
const lastRing = Random(2) === 0 ? 100 : 160;
for(let i=0;i<=lastRing;i++)
  outlineRectangle(i,i,319-i,199-i,30+(i%30));
// Mode 1, score and shop:
for(let y=0;y<=199;y++) line(0,y,319,y,30+(y%30));
```

Ring geometry0x41b5–0x421d; row geometry0x4281–0x42b4. Rectangle helper cc8:31 draws four inclusive lines without discarding reversed coordinates, so mode0's160 variant deliberately draws rectangles whose y endpoints have crossed. Do not reduce that variant to simply `min(x,y,319-x,199-y)%30`.

The score procedure explicitly calls mode1 at **0xe702–0xe706** and copies the complete framebuffer to DS:e5be at**0xe70b–0xe71d**, before drawing the scores overlay. Shop restores this buffer. Therefore the shop background should use **horizontal magenta palette bands**, even though main menu backdrop uses rectangular bands. Screenshot comparison is still useful to establish runtime palette phase.

Palette cycling:

-30-color range start30,end59, offset0, enabled1; duplicate the same30 RGB entries twice in a60-entry buffer (OVR0x421f–0x4273 /0x42b6–0x430a).
- The hardware interrupt handler EXE0xdf13–0xdfc3 increments an8-bit wait counter each interrupt. Once counter>=configured palette delay DS:e8c2 low byte (copied to e8dd), reset counter and set DAC slots30..59 from the30 entries beginning at offset. Then increment offset; wrap0 when offset>29. This is a rotating palette over **fixed pixels**, not moving geometry.
- Original can use BIOS timer INT1Ch or VGA retrace IRQ depending on configuration (EXE0xe074–0xe173). Static code fixes the phase sequence but does not uniquely establish wall-clock rate without the selected environment. With timer fallback, one event perBIOS tick (~18.2Hz); with VGA retrace, display-frequency events. Delay0 and1 both update each event.
