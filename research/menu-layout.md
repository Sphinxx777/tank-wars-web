# Original menus: geometry, text and verification

2026-10-18. Addresses are file offsets in unmodified BOMB.OVR unless EXE specified.

`dist/menu-render.js` reconstructs drawing calls using extracted LITT/EURO and ROM8×8 fonts. Native dimensions320×200. The main, sound/options, roster and score fixtures match **all64000 pixels** of their corresponding DOS captures after normalizing the cycling magenta palette values only. No approximate placement, CSS fonts or screenshots are used to draw them. Background ring geometry is separately covered by background research.

Golden hashes in `tests/menu-fidelity.test.mjs` were calculated from `research/screenshots/dos-{menu,roster,options,sound,score}.png`, not the implementation. Screenshots are ignored local research artifacts; the committed hashes do not depend on them being available. `tools/verify-menu.mjs` rasterizes production methods to PPM. Magenta normalization maps colors where R=B>90,G=0 to255,0,255. It only removes time-dependent DAC phase; the header, text, borders, controls and their occupied pixels must still match exactly.

## Main menu

- Heading procedure0xca5–0xd9b: bevel(10,6)..(310,42), EURO preset size1=3/5, center/center. Draw `TANK WARS  3.2` yellow at163,23;162,22;161,21, then light red at160,20.
- Header0xef1–0xf5c: bevel(118,63)..(202,77); BIOS font size1, color1, center/center anchor160,70. BGI bitmap centering has the same +1X as vector centering; visible upper-left text124,66.
- Main body0x2467–0x27c4: bevel(118,85)..(202,187). Recesses122,91..198,101 plus20Y for five rows. Bevel fill2, top-left17, bottom-right15, then restore saved backdrop within each interior. LITT explicit1/1 scale, center/center anchors160,95+20i. `Sound Options`,`Game Options`,`Players: `,`Games: ` green10, START magenta13. Counts yellow14, centered at160+floor(labelWidth/2).
- Load Game bevel20,145..80,155; anchor50,149, green10. Red12 `L        ` overprint marks shortcut.
- Selected crosses112,95+20i and208,95+20i. Resident EXE0x5d73–0x5dbc draws a five-pixel white19 plus. No Quick Start or reconstruction footer inside the original framebuffer.

## Popup options

Popups preserve main menu behind them; they do not replace the entire screen.

- Sound0xfcf–0x13de: bevel35,55..105,85. `Effect:` and `Flying:` black0 at40,62 and40,76, center vertically. Yellow14 values85,sameY, left aligned. Selection crosses29/111 at rowY.
- Game0x17b4–0x1ab7: bevel95,47..225,153. Ten labels left100,52+10i, values right223 at sameY; left/right vertical center. Selection crosses89/231.
- Row order exactly: Crumble Percent, Walls, Trail Visible, Ball Visible, Tanks Fall, Computer Can Buy, Background, Cycle Delay, Wind Force, Team Play.
- String functions0x13de–0x16ce confirm NO/STICK/ELASTIC/ACCEL/WARP/RND walls; None/Low/Norm/High/Gale/RND wind; None/Stars/Bars/Circles/Spread/Sky/Static/Rectangle/Asterisk/RND/USER backgrounds.

## Player roster

- Layout0x58c5–0x5a9e: x10+61col,y50 or111, inclusive55×55 span (56pixels);10 slots. Gray18 active and17 inactive, standard outside2pixelbevel.
- Name field0x54f6–0x566b: recessed(x+3,y+3)..(x+52,y+12), same active/inactivefill. AnchorcenterX,y+1, LITT top. Horizontal scale starts100/100 and decreases numerator until textwidth<=49, vertical stays1. Disabled names black; enabled colorsplayerpalette20..29 fullintensity.
- Controls0x5684–0x583d: KEYBOARD/MOUSE/COMPUTER center/center atcenterX,y+19/29/39. LITT xscale1, yscale1 except MOUSE yscale1/3! Selected type brightblue9; others black.
- Bottom markercenterX,y+51: active nonselected cross restores the saved magenta backdrop; disabled cross black; focused active cross white.
- START0xda2–0xee6: bevel71,171..248,197; EURO xscale1,yscale3/10. Yellow strokes at163±n,182±n for allfourcombinations,n1..5, red at163,182. The old generic button rendered a very different mark.

## Scores

- Formula0xe592–0xe5b7: halfheight15+5players, top100-halfheight, bottom100+halfheight.
- Main bevel45,top..275,bottom; heading65,top-20..255,top-5. Headingcenter160,top-13 brown6, LITT center/center, `N Game(s) Played out of M`.
- Sort0xe5ed–0xe6fc by wins descending, score descending within equalwins. Rank repeats for exact ties. Names remain originalplayercolors.
- Gray17 line50,top+16..270,top+16; labels Player50/Winsright185/Scoreright270, top+5. Rows top+20+10i. Rank at50, name72, winsright185, scoreright270; LITT top.
- Buttons0xeb48–0xec60: Add60..110, Continue/Exit135..185, Save210..260; Ybottom+5..bottom+15, textcenterX,bottom+9 center/center. Color0 retains the battle palette RGB57,36,40, **not black**.

## Additional original layouts

- AI0x4e03–0x5181: bevel116,58..204,142, eight rowscenter160,63+10i. Random(?), Mr.Stupid, Lobber, Rifleman, Lob&Shoot(B), WindlessWit, Twanger, WindMaster. Padded separate strings reproduce brown6/yellow14 shortcuts. Crosses119/201. This is statically decoded; requires dynamic screenshot comparison.
- Stats0xaf95–0xb63c: bevel80,30..240,170, namecenter160,33 fullplayercolor. Separator80,47..240,47. Twelve leftlabels84,46+10i, rightvalues236,sameY. Labels use palette0; valuesyellow14 except lasttwo darkred4. Exact strings include original typo `Fatalties:`. Type labels Human(K),Human(M),Computer. Kills/round displays2decimals width5; fatalities/round1decimal width5; accuracy trunc(hit/shot*100), killrate formatted0decimalpercent width3. Zero shots gives `Undefined`. Any key/click dismisses; no OKbutton. Team label at2,180..84,195 only in teammode; actual customteamnames are not yet carried in the web model.

## Remaining gaps

AI and stats are currently binary-derived but lack a reference capture test. Stats game counters/rounding still depend on native engine parity; old saved games lack deaths. Menu transition wipe routines0x444b–0x45de are not implemented by this module. Main backdrop original randomly chooses ring100/160 once; the current default100 matches the captured instance. Pointer input and browser name entry remain web adaptations outside pixel tests.
