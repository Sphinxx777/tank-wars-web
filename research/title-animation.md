# Original title animation

BOMB.OVR 0x99–0x109 builds forty RGB triples: only red is populated, with `Trunc(6.3 * (i mod 20))`, i=1..40. Turbo Pascal Real constant bytes are 83 9a 99 99 99 49. VGA DAC writes retain only six bits, so the second part of the ramp wraps at 64 instead of clamping.

OVR 0x480–0x4b6 cycles offsets 1..20, writes twenty palette entries starting at 135, and calls Delay(60). This is a 1.2-second cycle, independent of the gameplay Palette Speed option. It changes only the front faces of TANK WARS, using original BOMB2.RAW palette indices 135..154. Other prepared blue/green ramps are not used by this loop.

OVR 0x369–0x456 overlays BOMB2 indices 135..154, 16..20, 115..124, 155..164 and 175..184 onto BOMB1. Resident copy helper EXE 0x5e20–0x5e43 ignores the source pointer offset: the reference allocation starts at offset 8, producing an eight-pixel shift in this DOS build. The web extraction reproduces it. The final global palette comes from BOMB2.RAW.

Verification: DOSBox capture `capture/image0002.png`, 1600x1200 nearest-scaled down to 320x200, matches all 64000 pixels of titleFrame phase zero. RGBA SHA256: 62a292b756459a5ce105af63d65c077bb7a677817ebd3f72b5ba96dbe5511e6e. The capture confirms the six-bit wrap and extracted pixel alignment. Browser retains its existing continue prompt overlay.

Re-extract using `python3 tools/extract-assets.py research/original --titles-only`.
