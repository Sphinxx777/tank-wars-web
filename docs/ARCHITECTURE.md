# Architecture

Tank Wars Native Web is a static ES-module application. It reconstructs the DOS game's behavior in JavaScript; it does not execute BOMB.EXE or BOMB.OVR. The playable source is kept directly in `dist/`, with no generated application bundle.

## Runtime flow

`index.html` loads `app.js`, which fetches the weapon catalog, extracted vector fonts, bitmap font and indexed title image. The app creates a renderer and PC Speaker synthesizer, tracks the current screen and translates keyboard, pointer and on-screen controls into game actions.

A `Game` instance owns match and simulation state. The animation loop advances that state and asks the renderer to draw it. Aiming, projectile flight, explosions, terrain settling, tank falling, deaths and score presentation have separate state transitions so that visible effects can complete before the next player acts.

All game graphics use a 320×200 canvas. CSS scales the output for the original 4:3 display shape. Menus and text are drawn from original bitmap/vector data using integer rasterization; HTML controls around the canvas provide browser conveniences. English/Russian interface text and `guide.html` belong to that surrounding interface. The reconstructed framebuffer retains the original labels.

## Modules

| File in `dist/`      | Responsibility                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `app.js`             | Screens, per-screen input handlers, browser saves, controls and UI/audio coordination.     |
| `engine.js`          | Players, turns, terrain, projectile physics, weapons, AI, damage, scoring and match state. |
| `render.js`          | Canvas drawing and screen dispatch, game HUD, tank sprites and interaction hit areas.      |
| `menu-render.js`     | Reconstructed menu, roster, options, score, AI and statistics layouts.                     |
| `background.js`      | Indexed background generation and animated palette rotation.                               |
| `effects-render.js`  | Original-style ellipse rasterization and effect drawing data.                              |
| `death.js`           | Tank destruction sequences and their evolving visual state.                                |
| `palette.js`         | VGA/EGA color definitions and player color intensity.                                      |
| `title.js`           | Original indexed title composition and palette animation.                                  |
| `shop.js`            | Shop catalog, item visibility, stock and cart reservations.                                |
| `sound.js`           | PC Speaker event sequences and AudioWorklet scheduling.                                    |
| `speaker-worklet.js` | One synthesized PIT speaker channel in the audio rendering thread.                         |
| `trig.js`            | Numeric helpers used by the translated simulation.                                         |
| `assets/`            | Extracted or reconstructed images, fonts, palette data, icons and weapon tables.           |

See the source for current exports; research notes document original addresses and assumptions behind individual procedures.

## Simulation and rendering boundaries

The simulation operates without a DOM and is exercised by Node's built-in test runner. Rendering reads game state and draws its current appearance. Generated scenery is retained as indexed pixels and palettes instead of consuming gameplay random numbers during every repaint. Palette animation changes colors over fixed geometry.

Randomness is part of the game's behavior. Avoid introducing draws into render functions or changing the sequence incidentally when refactoring simulation code. Existing saves need compatible defaults when new state is introduced. Browser saves use the application's serialization format and localStorage; they are not DOS TWS files.

Rendering helpers reproduce BGI conventions, including inclusive coordinates, outside bevels, stroke baselines, per-glyph integer advancement and the original center alignment offset. A generic canvas text call or standard circle primitive can change many pixels even if it appears visually similar.

## Audio

Sound effects are synthesized rather than played from recordings. `sound.js` creates timed frequency/gate events; `speaker-worklet.js` models a monophonic PIT output using integer divisors. Browser audio is unlocked by user interaction.

Explicit DOS delays and frequency writes provide strong evidence for sequence reconstruction. Loops without delays depend on the original CPU and therefore need timing assumptions. The project does not claim an exact physical speaker, DOSBox filter or waveform match merely because the note sequence is correct.

## Verification and provenance

- Simulation tests check translated game rules and transitions.
- Raster tests compare production drawing with independently recorded original hashes or instruction-level reference results.
- Browser QA checks input, layout, animation and real audio behavior that a Node test cannot establish.
- `research/` records binary offsets, formulas, extraction details and remaining uncertainties.
- `tools/` holds repeatable extraction and comparison utilities. Some require separately supplied originals or optional research dependencies.

A passing test is evidence for its stated case, not proof of complete game equivalence. Read [the accuracy notes](../dist/accuracy.html) and [third-party notices](../THIRD_PARTY_NOTICES.md) before making fidelity or licensing claims.

## Serving and editing

Serve `dist/` through any ordinary static HTTP host. The browser requires no npm dependencies, DOS files, emulator or backend. The root `npm start` script uses `tools/serve.mjs`, a Node.js 18+ static server with no package dependencies. Tests use the same Node runtime. `npm run check` combines tests, formatting and syntax checks. Python is only needed for optional extraction and research scripts. Formatting is a development operation (`npm run format` / `npm run check:format`), not a build requirement.

Keep original installations and local captures in the ignored research locations. Extracted resources are checked-in inputs to the browser application; regenerate them through the documented tools instead of silently replacing their contents. Preserve provenance and keep third-party assets distinct from MIT-licensed implementation code.

## Web interface and documentation

`assets-loader.js` fetches the shared catalog and rendering assets. `i18n.js` owns
language selection and safe localStorage persistence; `translations.js` holds
English/Russian UI strings. `ui-text.js` derives instructions and accessible
labels from the current game state without changing the simulation.

`guide-content.js` holds bilingual descriptions; `guide.js` combines them with
the authoritative equipment catalog, so prices and radii are not duplicated.
`document-ui.js` provides text-only DOM helpers shared with `accuracy.js`.

Within `Game.update()`, projectiles, chain reactions, explosion completion and
turn settling run in that order. `advanceDeathAnimation()` consumes the delays
yielded by `deathEffect()`. Keep these steps ordered: moving a random-number draw
or settling terrain before an animation completes can change a later shot.
