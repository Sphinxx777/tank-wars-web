# Explosion and Sonic visual reconstruction

Static analysis and original-instruction execution, 2026-10-18. All offsets are hexadecimal file offsets in the user's unmodified BOMB.EXE/BOMB.OVR. New module: `dist/effects-render.js`.

## Ordinary blast (also used by death case 6)

The prior white/yellow/orange layered disks were not the original effect. The original draws **red-only indexed rings**, then changes their palette; there is no white center, additive blend, alpha fade, or orange outline.

- OVR `0x19118..0x19167`: clear RGB palette buffer, calculate integer `unit = trunc(63 / radius)`, and initialize red entry `j` to `(radius - j) * unit`; green and blue stay zero. Palette indices start at 130.
- OVR `0x191f6..0x19288`: radii `0..radius` inclusive, each radius draws three custom ellipse outlines, centers `x+1`, `x-1`, then `x`, with equal axes and index `130+r`. The last outline wins where outlines overlap. There is no fixed expansion Delay.
- OVR `0x1928a..0x19324`: `i=0..radius`, for `j=i..radius`, set red[j] = `(radius-j+i)*unit`, upload palette, Delay(E).
- OVR `0x19327..0x193b3`: `i=0..radius`, for `j=i..0` descending, set red[j] = `(radius-i+j)*unit`, upload palette, Delay(E).
- OVR `0x193b5..0x19449`: `i=0..radius`, for `j=i..radius`, set red[j] = `(j-i)*unit`, upload palette, Delay(E).
- OVR `0x1944e..0x194b8`: after all palette phases, BG-restore the same three outlines for every radius. This clears the precise drawn disk footprint; health damage follows.

Thus fixed nominal duration is `3*(radius+1)*E`, independent of sound being on/off. E is 8 ms in the supplied configuration; MIRV temporarily divides E by 5 with integer truncation, giving 1 ms. `blastTimeline` optionally includes the already-existing `CPU_WRITE_MS` sound-write estimate, solely to keep the visual palette timeline aligned with the synthesized sound. That CPU overhead is an approximation, not an original time constant. Expansion often completes before the next browser refresh because the original has no fixed expansion delay.

Palette remains deliberately dimmer at some radii due to integer division: r=10 peaks at60/63; r=15,30,60 peak at60/63; r=2 peaks at62/63. It must not be normalized to full red. Conversion to browser RGB uses round(DAC*255/63).

### Exact custom ellipse raster

EXE `0xe671..0xe85c` is far address `cc8:351`. It initializes a four-way midpoint ellipse and calls its four-point plot helper at `0xe85f`, or clipped equivalent `0xe8b5`. Integer quarter/half operations use arithmetic right shifts, including the negative region transition. This differs from both a mathematical filled disk and a standard eight-way Bresenham circle.

`bgiEllipse(cx,cy,rx,ry,plot)` directly translates the arithmetic. It emits integer points without clipping; caller applies the viewport. `blastRaster(radius)` caches the result of the original three-center, increasing-radius draw order. Its entries are final radius indices; -1 denotes untouched pixels.

**Independent check:** `tools/verify-ellipse-oracle.py` executes those actual original 16-bit instructions in Unicorn, using real VGA framebuffer writes and original clipping code. It verifies the routine returns and saves SHA-256 hashes of its entire 320×200 framebuffer. `tests/fixtures/bgi-ellipse-oracle.json` contains 177 such expected hashes: every circle radius 0..170 plus six noncircular ellipses, including clipped cases. `tests/effects-render.test.mjs` matches the JavaScript raster against every original-execution hash. No binary code or source screenshot is distributed with the browser implementation.

## Sonic is a flashing cross and flashing earth

- OVR `0x19d92..0x19db0` calls EXE `0x5d73..0x5dbc`, which draws exactly five pixels, center plus its four cardinal neighbors, using palette index19. It does **not** draw a circular wave.
- First100 iterations: set index19 RGB to `[R(64),0,0]`; optional Sound(3000+R1000); Delay(E).
- Next100 iterations: set index19 `[R(64),0,0]`, set earth palette index2 to `[32+R(32),32+R(32),32+R(32)]`; optional Sound(3500+R1000); Delay(E). The earth change is global, not restricted to the hit point.
- OVR `0x19e78..0x19e9e` calls EXE `0x5dbf..0x5e1d` to restore the same cross from the original background. Index19 returns to white, earth index2 returns to DAC `[0,42,0]`, then crumble runs.

`sonicSound` may capture these palette RNG values in optional frames without consuming any extra RNG. `sonicFrame(effect)` selects the frame using 8 ms steps, and `drawSonic` draws the five-pixel cross. Renderer ground color must read the frame's `ground` value, and the engine should remove the five restored terrain pixels at the end. Nominal duration1600ms, even with sound disabled.

## Integration API

- `bgiEllipse(cx,cy,rx,ry,plot)` — exact custom ellipse; caller clips.
- `blastRaster(radius)` — `{width,height,left,top,indices}`; useful for both drawing and the final terrain deletion.
- `blastTimeline(radius,delayMs=8,cpuWriteMs=0)` — `{frames, expansionSeconds, duration}` in seconds. Frames have `{phase,step,at}`.
- `blastState(effect)` — effect has `{max,age,visualTimeline?}`; returns current palette and radius.
- `drawBlast(renderer,effect)` — renderer needs `rect`; effect has integer center `x,y` plus the above fields. Drawing must be clipped to the original playfield.
- `sonicFrame(effect)` and `drawSonic(renderer,effect)` — effect has `visualFrames` entries `{red,ground}` and age/delayMs.

## Remaining boundaries

- Ordinary dirt also draws three concentric outline sets, has **no Delay**, and no impact sound. Its calls are to Borland Graph Circle (`e26:11ea`), not the game's custom ellipse helper. The circle wrapper uses a dynamically installed generic BGI fallback because the VGA256 driver's ellipse entry is a stub. Equal axis aspect1:1 is established at OVR0x1cab7, but exact generic BGI raster has not been reconstructed in this pass. Reusing `blastRaster` for dirt is explicitly temporary.
- Laser charge/beam palette state and particle branches remain separate work; this module does not invent or claim them.
- CPU-dependent tight-loop durations and browser refresh sampling prevent a universal wall-clock match to every DOS machine. Fixed Delay calls and order are preserved; CPU overhead is labelled separately.
