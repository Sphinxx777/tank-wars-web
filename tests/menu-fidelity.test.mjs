import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {renderMenuFixture,normalizeMenuPalette} from '../tools/verify-menu.mjs';
// Hashes measured from original DOSBox captures on 2026-10-18. Palette-only
// magenta pixels are normalized because screenshot timing changes DAC phase.
// Exact backdrop index geometry and cycling are checked independently.
const reference={
 menu:'1c44197c42e73e7789114a96018406d9752cd89ec4efc1bee33be6097a95d690',
 roster:'c9d60ee5c8708b6dbe69259b8069cca2ec87ce00d3888c69d40e3802acabfeba',
 options:'0e1c6777d63d66eddb18273cebd1b9ee1285f88c8aa49b6987a2d289abe1bf6d',
 sound:'ea684d6a9cdbd451582fc826fe0da93a6baac96a78a98b5fdefa7e619975bf24',
 score:'ee5759361fd36575fb6494f720470116f1d81649013d904e9f4e2bcfd136d2d2'
};
for(const [screen,hash] of Object.entries(reference))test(screen+' pixels match original DOS capture (cycling palette normalized)',()=>{
 assert.equal(createHash('sha256').update(normalizeMenuPalette(renderMenuFixture(screen))).digest('hex'),hash);
});
