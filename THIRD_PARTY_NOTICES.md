# Third-party material and provenance

The MIT license in this repository applies to the reconstruction's original implementation code. It does **not** grant a new license for third-party artwork, font data, game text or other extracted material. Converting an asset to JSON, PNG or JavaScript does not change that distinction.

The source game is **Tank Wars 3.2**, credited to **Kenneth Morse, 1992**. This project is an independent reconstruction and does not represent an official release, endorsement or transfer of the original game's rights. No permission from the original author has been established in the project records. A confirmed redistribution license for the extracted resources listed below has not been identified here. These notices document provenance; they do not assert that the original material is public domain or covered by MIT.

## Material included in the repository

| Files or family                                                                    | Source and transformation                                                                                              | Evidence and limits                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dist/assets/title-indexed.bin`; `research/reference-assets/title*.png`            | Original BOMB1.RAW and BOMB2.RAW image/palette data; decoded and composed for browser display.                         | `tools/extract-assets.py` and `research/title-animation.md` describe decoding and the executable's composition/animation behavior. Original artwork rights are not relicensed by this project.                                                                           |
| `research/reference-assets/palette-1.json`, `palette-2.json`                       | Palette data extracted from the original title resources.                                                              | Retained as research data; no independent redistribution permission is recorded.                                                                                                                                                                                         |
| `dist/assets/{tiny,litt,euro}-font.json` and `research/*-font-extracted.json`      | BGI stroke-font payloads embedded in the original BOMB.EXE, decoded into glyph widths and stroke commands.             | Offsets and font metadata are recorded in `research/binary-findings.md`; the extractor validates them against the executable. BGI format identification is not a determination of the individual font copyright holder or license. Those have not been established here. |
| `dist/assets/font8.bin`                                                            | A 1,024-byte 8×8 bitmap font dumped from the BIOS memory of the local DOSBox reference environment.                    | The original game's graphics driver reads BIOS ROM font data rather than embedding this font. See `research/binary-findings.md`. The dump's precise upstream font attribution and applicable redistribution terms have not been verified in this repository.             |
| `dist/assets/weapon-icons.js`, `research/icons-extracted.json`                     | Weapon masks reconstructed from drawing instructions in BOMB.OVR; guidance letters use the reference BIOS bitmap font. | `tools/extract-icons.py` and `research/icons.md` record extraction and pixel comparison. The generated masks reproduce the original game's graphics.                                                                                                                     |
| `dist/assets/weapons.json`, `research/*-extracted.json`, other extracted constants | Names, descriptions, numeric tables, offsets and decoded resource metadata from the researched game build.             | Provenance is recorded alongside the data and in the research notes. The project makes no blanket licensing claim about all extracted content.                                                                                                                           |
| Reference-derived fixtures and hashes under `tests/`                               | Expected results obtained from original captures or execution of original drawing instructions.                        | Test comments and research notes explain each reference's scope. Hashes are measurements; included image/mask data remains reference-derived material.                                                                                                                   |

The game also preserves original English UI labels and weapon names. The JavaScript implementations of rendering, simulation and synthesis were written for this reconstruction; any embedded original resource data remains subject to the distinctions above. PC Speaker effects are synthesized from researched commands rather than distributed as recordings from the DOS game.

## Research inputs not included

The original DOS installation, BOMB.EXE, BOMB.OVR, BOMB.DOC, RAW source files, local emulator application bundle and capture directories are excluded from version control and are not part of the static site deployment. Re-running extraction requires separately obtaining the appropriate reference files.

The researched executable hashes are:

- **BOMB.EXE:** `659ace6b9a97c30191a8f65cf25f22322c087166909e9fa1d522e529adbafd9d`
- **BOMB.OVR:** `8186d7d4190350992a2a1b7036d9ba62cc4e300c3e9fd3ce901eddbcad5b466f`

These identify the analyzed build; they do not convey permission to use or redistribute it.

## Development and research tools

The browser application has no third-party JavaScript runtime package dependency. Development packages installed through npm, including the formatter, retain their respective package licenses. Consult the installed packages and lockfile for exact versions and notices.

DOSBox, Capstone and other optional research tools may be used locally to inspect or compare the game. They are not shipped as part of the browser application. Their licenses are separate from both this reconstruction and the original game assets.

## Corrections

If you can provide authoritative attribution or licensing information for a listed resource, please open an issue in [the project repository](https://github.com/Sphinxx777/tank-wars-web). Include the specific file and a source for the correction. This notice should be updated when new evidence is established.
