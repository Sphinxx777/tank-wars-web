# Local v0.2 verification — 2026-10-18

This update remains local; the previously published v0.1 site only had access changed to public.

- Icons: tools/extract-icons.py matched all20 masks against original-battle.png:3000/3000 pixels.
- Original shop: loaded research/original/QA200K.TWS in unmodified BOMB.EXE, entered the shop, captured DOSBox image0001.png (1600×1200 integer-scaled output). Resampled nearest to320×200. Production Renderer.shop matches all64000 RGB pixels. The discovered BGI stroke direction and error-accumulator rule are explained in bgi-line.md. The full-frame hash is locked by fidelity.test.mjs.
- Shop browser UI: original right-click reserves; left-click releases; Purchase spends3000 and raises Incinerator stock100→200; keyboard navigation/reservation and Done enter the next round. Touch controls use the same actions. Found and fixed a recursive action-handler parameter shadowing bug during this check.
- Audio: browser AudioWorklet runs; analyser measured peak0.1200 during the reconstructed laser sequence. No module-loading errors. Tested a normal human shot in the production game. PIT arithmetic and launch/laser/blast/sonic timing have unit coverage. One monophonic synthesized channel, no random WebAudio envelopes.
- Audio reference recording: DOSBox WAV capture succeeded on the second attempt, but this was not a synchronized waveform comparison. Exact analog speaker timbre, CPU-paced loops and all effect timing remain unverified. CPU_WRITE_MS=.035 is explicitly an estimate. The lightning gameplay trigger and several existing effect/laser branches remain approximations.
-31 automated tests pass, including all18 weapons,7 death effects, full AI round, shop economics, full shop golden raster and icon assets. git diff --check clean.

Evidence retained locally in research/screenshots/ and research/capture/ (ignored by git). Original EXE/OVR were not modified. Browser tests use generated research/fixtures/shop-ui.html and tests/browser.html, served from repository root on8787; game uses dist/ on8786. QA pages are not shipped in dist.
