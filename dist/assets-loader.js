/** The game has no bundler: fetch the checked-in assets relative to this module. */
async function fetchAsset(filename, binary = false) {
  const response = await fetch(new URL(`./assets/${filename}`, import.meta.url));
  if (!response.ok) throw new Error(`Could not load ${filename}: HTTP ${response.status}`);
  return binary ? new Uint8Array(await response.arrayBuffer()) : response.json();
}

export function loadCatalog() {
  return fetchAsset('weapons.json');
}

export async function loadGameAssets() {
  const [catalog, tiny, litt, euro, bitmap, title] = await Promise.all([
    loadCatalog(),
    fetchAsset('tiny-font.json'),
    fetchAsset('litt-font.json'),
    fetchAsset('euro-font.json'),
    fetchAsset('font8.bin', true),
    fetchAsset('title-indexed.bin', true),
  ]);
  return { catalog, fonts: { tiny, litt, euro }, bitmap, title };
}
