# Exact Tank Wars 3.2 weapon icons

All 20 toolbar masks were extracted from the original executable's procedural drawing calls, and compared against the archived original DOSBox screenshot. **All 3000 pixels match** (20 cells × 15 × 10), including the border, the circles and the BIOS-font H/V letters.

## Files and reproduction

- `icons-extracted.json`: 20 named icons, exact source call offsets and arguments, `contentRows` without the cell border, `rows` including it. Each row contains 15 zero/one characters, ten rows per icon. Paint only the ones in the current icon color.
- `../tools/extract-icons.py`: standard-library-only extractor for the original `BOMB.OVR`. It checks SHA-256, narrowly decodes the straight-line x86 instructions in each case arm, validates call signatures, and fails on unknown instructions. The H/V glyphs come from the previously dumped BIOS `font8.bin`.

Run from the project root:

```sh
python3 tools/extract-icons.py /path/to/tankwars
python3 tools/extract-icons.py --verify-screenshot research/screenshots/original-battle.png
```

The optional screenshot comparison requires Pillow. It samples pixel centers from the existing 1920×1496 capture, with game origin `(0,56)`, source-to-capture scales `(6,7.2)`. A binary brightness threshold removes capture/color-compression noise; it does not move or reshape pixels. All 20 extracted masks match the reference independently. This verifies icon silhouettes and positions; it does not certify colors of the OS screenshot, which has color noise.

## Source layout and drawing

OVR SHA-256: `8186d7d4190350992a2a1b7036d9ba62cc4e300c3e9fd3ce901eddbcad5b466f`.

The icon routine is OVR `0x1d328..0x1dfdc`, reached through resident overlay stub `b1a:25`. Overlay CS file base is `0x1c0c0`; Pascal strings H and V are at OVR `0x1d324`, `0x1d326` (CS `1264`, `1266`). All offsets in the JSON are **OVR file offsets**.

The loop runs IDs 0..19. Each cell starts at screen `(10+15*id,18)`:

- `SetColor(100+id)` at `0x1d345`.
- `SetFillStyle(SolidFill,100+id)` at `0x1d355`.
- Palette initially black at `0x1d36a`.
- `SetViewPort(10+15*id,18,25+15*id,27,true)` at `0x1d396`.
- `Rectangle(0,0,14,10)` at `0x1d3d7`. The bottom edge y=10 is clipped by the viewport ending at local y=9. Hence the toolbar has a top and two vertical borders, but no bottom border. Drawing the icons with a fully closed rectangle would be wrong.

Primitive mapping (resident Graph segment `e26`, EXE base `0xf900`):

| Call | Primitive | Notes |
|---|---|---|
| `e26:1fe4` | PutPixel(x,y,color) | color = icon ID +100 |
| `e26:11ea` | Circle(x,y,radius) | all icon radii are1; four cardinal pixels |
| `e26:1c86` | Line(x1,y1,x2,y2) | inclusive endpoints |
| `e26:1cce` | Bar(x1,y1,x2,y2) | filled inclusive rectangle, not an outline |
| `e26:10d2` | Rectangle(x1,y1,x2,y2) | outline; implemented as four lines |
| `e26:1f12` | OutTextXY(x,y,string) | H/V BIOS bitmap glyphs |

Aspect ratio is explicitly set to `(1,1)` at OVR `0x1cab7`; the circle therefore has equal integer axes. All icon diagonals are at45°, so no diagonal rasterizer tie-breaking remains unresolved here. The super-compressed dirt arrow extends to local y=-1 and y=11; viewport clipping is essential.

## H and V placement

The caller selected BIOS font0, horizontal direction0, size1 at OVR `0x151bd..0x151c7`. Icon cases18/19 set text justification `(CENTER_TEXT,CENTER_TEXT)` and draw at local `(7,6)`.

The original BGI default-font centering is subtly asymmetric: EXE `0x130ae..0x130d4` subtracts `(textWidth >> 1) - 1` from x; EXE `0x130d5..0x130fa` subtracts `(textHeight >> 1)` from y. Thus a single8×8 glyph begins at **(4,2)**, not (3,2). Its last blank row is at y9. The exported masks use the original ROM font bitmap and these exact coordinates.

## Palette states

The entire icon including its border uses one palette index, `100+id`. OVR `0x10d05..0x10e79` updates all icons for the current tank:

- ammo >0: VGA RGB `(63,63,63)` → white `#ffffff`; call `0x10d3e`.
- ammo <=0: `(0,0,0)` → black `#000000`; call `0x10d54`.
- selected weapon: `(63,0,0)` → red `#ff0000`; call `0x10d7b`, overriding the availability color.
- H/V available and unarmed: white; unavailable: black; armed: red. Calls `0x10da5`, `0x10db8`, `0x10df8`, `0x10e0b`, `0x10e4e`, `0x10e74`.

On keyboard weapon selection, OVR `0x1afd2..0x1b02d` crossfades old red to white and new white to red in VGA channel steps3,7,...,63. This is a palette transition rather than changing shape. The original final selected color is pure red, not `#ff3333`.

No complete game equivalence is inferred from this result: this pass establishes only the 20 toolbar silhouettes, their clipping, positions, font glyphs and palette states.
