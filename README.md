# Tank Wars — Native Web

A browser reconstruction of **Tank Wars 3.2**, the 1992 DOS artillery game by **Kenneth Morse**. The game uses a new JavaScript simulation, Canvas renderer and Web Audio PC Speaker synthesizer. It does not run the DOS executable or an emulator.

**[Play in your browser](https://tank-wars-native.readyangel128.chatgpt.site/)** · **[Player guide](https://tank-wars-native.readyangel128.chatgpt.site/guide.html)** · **[Accuracy notes](https://tank-wars-native.readyangel128.chatgpt.site/accuracy.html)**

The surrounding interface and player guide support English and Russian. The reconstructed DOS game screen keeps its original English labels.

## Run locally

```sh
git clone https://github.com/Sphinxx777/tank-wars-web.git
cd tank-wars-web
npm start
```

Open [localhost:8786](http://127.0.0.1:8786/). Node.js 18 or later is required for the local server. No dependency installation or build step is required to play. Serve `dist/` over HTTP rather than opening `index.html` directly: the game loads JavaScript modules and asset files.

Install the optional development tools to run formatting checks:

```sh
npm ci
npm run check
```

`npm run check` runs tests, formatting checks and JavaScript syntax checks. `npm test` can also run on its own without installing packages. `npm run format` applies the project's formatting rules. Development dependencies are not loaded by the game.

## What you can play

- Matches with 2–10 local players, seven computer opponent types, teams and multiple rounds.
- Eighteen weapons, including MIRVs, chain reactions, lasers and dirt weapons; two guidance systems and three defenses.
- Destructible terrain, falling tanks, wind, wall modes and a shop between rounds.
- The original 320×200 game layout, displayed at 4:3, with animated title lettering, cycling background palettes and reconstructed effects.
- Keyboard, mouse and on-screen controls, synthesized PC Speaker sound, pause and browser saves.

Quick Battle creates a match against Mr. Stupid. Use the main menu for a full match setup. Sound becomes available after interacting with the page. Saves stay in the browser and are separate for each site address. DOS save-file import and online multiplayer are not implemented.

## How close is it?

The project combines disassembly, resource extraction, reference captures and executable raster oracles. Some comparisons are exact within their tested scope:

| Component                                                  | Evidence                                                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Title image                                                | A reference phase matches all 64,000 original pixels; lettering uses the original 20-step, 60 ms palette cycle. |
| Weapon icons                                               | All 3,000 pixels across 20 icons match the DOS reference.                                                       |
| Shop                                                       | A populated reference shop matches all 64,000 pixels.                                                           |
| Main menu, player setup, options, sound options and scores | Five complete frames match after normalizing only the animated magenta palette phase.                           |
| Battle HUD                                                 | All 8,960 pixels in the tested upper panel match.                                                               |
| Explosion rasterizer                                       | 177 circle/ellipse rasters were checked by executing the original drawing instructions.                         |

These checks do **not** prove that every match or animation is identical. Remaining differences include JavaScript numbers versus Turbo Pascal Real, some random-number call ordering and collision boundaries, CPU-dependent animation timing, parts of computer strategy and buying, and effects that still need synchronized DOS/browser comparison. Some original effects read changing DOS memory; the reconstruction does not reproduce that environment. Window transitions and some dialogs remain incomplete. Custom RAW backgrounds and DOS file compatibility are not supported.

See [accuracy.html](dist/accuracy.html) for the player-facing summary and [research/](research/) for addresses, measurements and limits of individual findings. Tests of translated rules are distinguished from comparisons against the original.

## Project layout

- [`dist/`](dist/) — the actual editable game source and static assets. The directory name is historical; it is committed source, not a build output.
- [`tests/`](tests/) — simulation, rendering and audio tests, plus browser-only QA pages.
- [`tools/`](tools/) — extraction and verification tools.
- [`research/`](research/) — reverse-engineering notes and extracted data with provenance.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — module responsibilities and runtime flow.

Any static HTTP host can serve `dist/`. The deployed site does not need a game server, package runtime or DOS installation.

## Contributing and attribution

Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing a reconstructed rule or updating a visual reference. Reports with an original-game version, reproduction steps and comparable captures are especially useful.

Original game: **Tank Wars 3.2, Kenneth Morse, 1992**. This is an independent reconstruction, not an official release.

The repository's original implementation code is provided under the [MIT license](LICENSE). **That license does not relicense the original game's extracted artwork, fonts or other third-party material.** Their provenance and the limits of the available rights information are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The original DOS executables are not included.
