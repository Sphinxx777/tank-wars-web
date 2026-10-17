# Original DOS shop QA fixture

`QA200K.TWS` is a synthetic, locally generated Tank Wars3.2 saved game. It is not a modification of BOMB.EXE or BOMB.OVR. A copy is placed in `../original/QA200K.TWS` so the existing DOSBox reference mount can see it.

Generate/reproduce with:

```
python3 research/fixtures/make-shop-save.py
```

The generator refuses to overwrite a different existing fixture. Exact field offsets and SHA-256 are in `QA200K-layout.json`.

## Intended reference UI sequence

From the original game's main menu, choose **LOAD**, choose **QA200K** with the arrows, and **OK**. The main-menu load path sets DS4817=1, and the outer game loop sees that flag and skips directly to round results. Choose the result screen's continuation/OK control to enter Player1's shop. The original DOS screen must be observed to confirm this path; loading has not yet been dynamically validated at fixture construction time.

Player1 has score200000, spent0, therefore cash200000, and every purchasable item is visible. All weapons are stocked100; both guidance reserves5; Energy Shield1000(100%), Inertia Dampener100(100%), Repulser1. Player2 is keyboard, cash0, and will skip shopping.

## File-format evidence

- Write procedure OVR0xc5e0–0xca22, read0xca70–0xd0d1.
- Exact30-byte header `Tank Wars Saved Game\r\nV3.2\x00\r\n\x1a`; written without a Pascal length prefix. Header strings atOVR0xc5c3,0xc5d8,0xc5da,0xc5dc,0xc5de; version fromEXE0x16446. Reader compares this header verbatim.
-41-byte globals written0xc701–0xc96c, read0xcc60–0xcecb. Individual DS locations, byte sizes and chosen values are recorded in JSON.
- For each of playerCount players:116-byte player record (DS402e+i*74hex), followed by2-byte input kind. Input kind3 would require extra variable AI-object state, deliberately avoided here. All fixture input kinds1(KEYBOARD).
- After all player records,583-byte statistics table fromDS4838. Fixture sets this whole optional accumulated statistics state tozero.
- Money is score field+0x13 minus spent field+0x17. Player name is Pascal string atrecord+1. Data is little endian; no checksum, compression, or external executable patch is present in the read/write procedures.
- Total2-player keyboard-only file length30+41+2*(116+2)+583=890.

Known limitation: unspecified counters and trailing statistics are valid zero-filled values by construction but still require testing in the actual game. This fixture should be used solely for visual QA; it is not a saved historical match.

Validation correction: first synthetic revision was rejected because the embedded Pascal version has length4 and contains a significant NUL byte after `3.2`. The corrected generator extracts all4bytes directly from the EXE instead of hardcoding a display version string.
