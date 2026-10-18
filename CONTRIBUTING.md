# Contributing

The goal is to reproduce the behavior and appearance of Tank Wars 3.2 while keeping the browser version understandable and practical to play. A change should state whether it restores original behavior, fixes a browser defect or adds a convenience outside the original framebuffer.

## Local setup

Use Node.js 18 or later. Python 3 is only needed for optional asset extraction and research scripts. Run `npm start` and open the address printed by the server. The served game lives in `dist/`; there is no bundler or compilation step.

```sh
npm ci
npm run check
```

`npm run check` runs the tests, formatting checks and JavaScript syntax checks. Use `npm run format` before submitting a change. Follow the checked-in formatter configuration and ignore list. The project keeps generated extraction data and binary assets separate from hand-edited JavaScript; do not rewrite those files merely to satisfy stylistic preferences. They may preserve original spellings, offsets or intentionally unusual values.

## Making a change

1. Keep the change focused and describe a reproducible problem.
2. For fidelity work, identify the original version and cite a binary file offset, original documentation passage or comparable reference capture. Mark an inference as an inference.
3. Edit the relevant source in `dist/`. Keep simulation rules independent of browser UI and rendering where possible.
4. Run the tests appropriate to the change and the full `npm test` suite before submitting. Check the affected interaction in a browser when it involves input, display or audio.
5. Update the relevant research note and accuracy documentation when the evidence or known limitations change.

A useful pull request explains the observable before/after behavior, evidence for the change and validation performed. An exact claim should name its scope: one frame, one rasterizer, one sound sequence or a tested gameplay case.

## Visual and audio verification

The renderer targets 320×200 pixels. Compare captures at that native resolution using nearest-neighbor scaling. Avoid browser image smoothing, compressed screenshots or text reflow in the game canvas.

Pixel tests contain reference hashes or fixtures measured independently of the implementation. Do not replace a golden value just because a test fails. First establish why the old reference is wrong or why the intended original state changed. Palette normalization is appropriate only for a documented difference in capture phase; it must not hide geometry or layout changes.

`tools/verify-menu.mjs`, `tools/verify-shop.mjs` and `tools/verify-hud.mjs` render production components for inspection. Some research tools need an original executable, an emulator, a captured frame or optional Python packages; ordinary `npm test` should not require the original DOS installation. Browser QA pages under `tests/` require serving the repository root separately because the default server exposes only `dist/`.

AudioWorklet output must be checked in a real browser after a user gesture enables audio. A matching frequency sequence does not establish identical analog sound or CPU-dependent timing.

## Assets and research material

Read [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The MIT license for the reconstruction does not cover extracted third-party assets.

Do not commit a DOS game installation, personal paths, private correspondence, emulator application bundles or capture directories. Keep originals in the ignored `research/original/` directory if you need them locally. Record hashes and addresses in research notes instead of including executable files.

For the verified original build, resources can be regenerated with:

```sh
python3 tools/extract-assets.py /path/to/tankwars --bios-font /path/to/FONT8.BIN
python3 tools/extract-icons.py /path/to/tankwars
```

The first extractor checks the BOMB.EXE hash and validates extracted font/table data. `FONT8.BIN` is a separately obtained reference-environment bitmap font, not a resource from BOMB.EXE. Other versions need a separately documented extraction path rather than removal of the hash check.

## Reporting problems

Include browser and operating system, game options, weapon, player count, steps and whether the issue reproduces after a fresh match. For a fidelity report, identify the DOS version and explain what differs. Screenshots or short recordings of the same state are more useful than a general claim that an effect looks different. Remove personal information from anything you attach.
