# Architecture

The game is a static JavaScript application with ES modules. Source and assets live in `dist/`, served directly without a build step.

## Runtime

`index.html` loads `app.js`, which fetches assets, initializes rendering and audio, and handles screens and input. A `Game` instance owns match state; the animation loop advances it and renders the result.

Graphics use a 320×200 canvas scaled to 4:3. The game retains its original English labels; surrounding controls and the player guide support English and Russian.

## Modules

| File in `dist/`                            | Responsibility                                           |
| ------------------------------------------ | -------------------------------------------------------- |
| `app.js`                                   | Screens, input, browser saves and UI/audio coordination. |
| `engine.js`                                | Turns, physics, weapons, AI, damage and scoring.         |
| `render.js`, `menu-render.js`              | Game, HUD and menu drawing.                              |
| `background.js`, `palette.js`, `title.js`  | Backgrounds, colors and title animation.                 |
| `effects-render.js`, `death.js`            | Explosions and tank destruction.                         |
| `shop.js`                                  | Catalog, stock and cart.                                 |
| `sound.js`, `speaker-worklet.js`           | PC Speaker sequences and synthesis.                      |
| `trig.js`                                  | Simulation math.                                         |
| `assets-loader.js`, `assets/`              | Asset loading, fonts, images and weapon data.            |
| `i18n.js`, `translations.js`, `ui-text.js` | Language, UI strings and contextual labels.              |
| `guide-content.js`, `guide.js`             | Player guide using the shared equipment catalog.         |
| `document-ui.js`, `accuracy.js`            | Documentation UI and accuracy notes.                     |

## Simulation and rendering

Simulation runs without a DOM. Rendering reads state; palette animation recolors fixed geometry. Keep random-number draws out of rendering and preserve their simulation order.

`Game.update()` processes projectiles, chain reactions, explosion completion and turn settling in that order. `advanceDeathAnimation()` consumes delays from `deathEffect()`.

Drawing follows original BGI coordinate, stroke and alignment rules. Replacing these helpers with standard canvas text or shapes can change pixels.

Browser saves use localStorage and the application's serialization format. Add compatible defaults when introducing new state.

## Audio

`sound.js` schedules frequency/gate events; `speaker-worklet.js` synthesizes a monophonic PIT channel. User interaction enables browser audio. DOS loops without explicit delays require CPU timing assumptions.

## Verification

- Node tests cover simulation and rendering references.
- Browser QA covers input, layout, animation and audio.
- `research/` records evidence, extraction details and known differences.
- `tools/` contains extraction and comparison scripts; some require original files or Python dependencies.

Run `npm run check` for tests, formatting and syntax checks. See [Contributing](../CONTRIBUTING.md), [accuracy notes](../dist/accuracy.html) and [asset provenance](../THIRD_PARTY_NOTICES.md).
