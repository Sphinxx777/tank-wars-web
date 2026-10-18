# Tank Wars — Native Web

Native JavaScript reconstruction of **Tank Wars 3.2 (1992)** by Kenneth Morse.

**[Play](https://tank-wars-native.readyangel128.chatgpt.site/)** · **[Player guide](https://tank-wars-native.readyangel128.chatgpt.site/guide.html)** · **[Accuracy notes](https://tank-wars-native.readyangel128.chatgpt.site/accuracy.html)**

## Features

- 2–10 local players, seven computer opponent types, teams and multiple rounds.
- 18 weapons, guidance systems, defenses and a shop between rounds.
- Destructible terrain, wind and configurable walls.
- Original 320×200 graphics and synthesized PC Speaker sound.
- Keyboard, mouse and on-screen controls, browser saves, English/Russian interface.

## Run locally

Requires Node.js 18+.

```sh
git clone https://github.com/Sphinxx777/tank-wars-web.git
cd tank-wars-web
npm start
```

Open [localhost:8786](http://127.0.0.1:8786/). No dependency installation or build step needed. To host elsewhere, serve `dist/` over HTTP.

## Development

```sh
npm ci
npm run check
```

`npm run check` runs tests, formatting and syntax checks. Use `npm run format` to format changes.

- [`dist/`](dist/) — game source and assets.
- [`tests/`](tests/) — simulation, rendering and audio tests.
- [`tools/`](tools/) — extraction and verification scripts.
- [`research/`](research/) — findings and reference data.

See [Contributing](CONTRIBUTING.md) and [Architecture](docs/ARCHITECTURE.md).

## Accuracy

See the [accuracy notes](https://tank-wars-native.readyangel128.chatgpt.site/accuracy.html) for verified details and remaining differences. Online multiplayer and DOS save-file import are not supported.

## Credits and license

Original game: **Tank Wars 3.2, Kenneth Morse, 1992**. Independent reconstruction.

Implementation code: [MIT](LICENSE). Extracted artwork, fonts and other third-party assets are covered separately in [Third-party notices](THIRD_PARTY_NOTICES.md).
