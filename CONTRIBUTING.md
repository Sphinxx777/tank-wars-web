# Contributing

## Setup

Requires Node.js 18+. The editable game source is in `dist/`; no build step is needed.

```sh
npm ci
npm start
```

Before submitting:

```sh
npm run format
npm run check
```

Python 3 is needed only for optional extraction and research scripts.

## Changes

- Describe the problem, the resulting behavior and how you tested it.
- For changes to original behavior, cite a binary offset, documentation or reference capture. Label inferences.
- Keep simulation rules separate from UI and rendering. Preserve random-number ordering.
- Check input, display and audio changes in a browser as well as running tests.
- Update research and accuracy notes when findings change.

## Visual and audio checks

Compare captures at the native 320×200 resolution without image smoothing. Reference hashes and fixtures must come from independent measurements; investigate failures before replacing them. Normalize palettes only for documented capture-phase differences.

Use `tools/verify-menu.mjs`, `tools/verify-shop.mjs` and `tools/verify-hud.mjs` to inspect rendering. Browser QA pages in `tests/` require serving the repository root; `npm start` serves only `dist/`.

Check AudioWorklet output in a browser after enabling sound with a user gesture. Frequency sequences alone do not verify speaker sound or CPU-dependent timing.

## Assets

See [Third-party notices](THIRD_PARTY_NOTICES.md). Keep original DOS files and local captures out of commits; use the ignored `research/original/` directory. Preserve generated data and record provenance in research notes.

To regenerate assets for the verified build:

```sh
python3 tools/extract-assets.py /path/to/tankwars --bios-font /path/to/FONT8.BIN
python3 tools/extract-icons.py /path/to/tankwars
```

The extractor validates BOMB.EXE and its data. `FONT8.BIN` is obtained separately from the reference environment. Document other game versions separately; keep hash validation intact.

## Bug reports

Include browser/OS, game settings, reproduction steps and whether a fresh match reproduces the issue. For DOS comparisons, identify the version and attach captures of the same state when possible.
