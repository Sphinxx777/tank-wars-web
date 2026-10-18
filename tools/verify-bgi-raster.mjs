import fs from 'node:fs';
import assert from 'node:assert/strict';
import { renderShopFixture } from './verify-shop.mjs';
const pixels = renderShopFixture(),
  reference = fs.readFileSync(
    new URL('../research/screenshots/shop-reference.rgb', import.meta.url),
  );
let different = 0;
for (let i = 0; i < 64000; i++)
  if (!pixels.subarray(i * 3, i * 3 + 3).equals(reference.subarray(i * 3, i * 3 + 3))) different++;
console.log(`Production shop: ${64000 - different}/64000 RGB pixels match DOS reference.`);
assert.equal(different, 0);
