import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { translations } from '../dist/translations.js';
import { translate, readStoredLanguage, getLanguage } from '../dist/i18n.js';
import { guideContent } from '../dist/guide-content.js';
import { getScreenStatus } from '../dist/ui-text.js';

const catalog = JSON.parse(
  fs.readFileSync(new URL('../dist/assets/weapons.json', import.meta.url)),
);

test('English is the default, with safe fallbacks for missing or blocked storage', () => {
  assert.equal(getLanguage(), 'en');
  for (const value of [null, '', 'fr'])
    assert.equal(readStoredLanguage({ getItem: () => value }), 'en');
  assert.equal(readStoredLanguage({ getItem: () => 'ru' }), 'ru');
  assert.equal(
    readStoredLanguage({
      getItem() {
        throw new Error('Storage blocked');
      },
    }),
    'en',
  );
});

test('both languages cover every static page label and interpolation token', () => {
  assert.deepEqual(Object.keys(translations.ru).sort(), Object.keys(translations.en).sort());
  for (const key of Object.keys(translations.en)) {
    assert.ok(translations.ru[key].length > 0, key);
    const placeholders = (text) => text.match(/\{\w+\}/g)?.sort() ?? [];
    assert.deepEqual(placeholders(translations.en[key]), placeholders(translations.ru[key]), key);
  }
  for (const page of ['index', 'guide', 'accuracy']) {
    const source = fs.readFileSync(new URL(`../dist/${page}.html`, import.meta.url), 'utf8');
    for (const [, key] of source.matchAll(/data-i18n(?:-aria|-content)?="([^"]+)"/g)) {
      assert.ok(key in translations.en, `${page}: ${key}`);
    }
    assert.match(source, /<html lang="en">/);
    assert.match(source, /data-language="en"/);
    assert.match(source, /data-language="ru"/);
    assert.doesNotMatch(source, /[А-Яа-яЁё]/, `${page} must have English fallback HTML`);
  }
  assert.equal(
    translate('status.computer', 'en', { name: 'Lobber' }),
    'Lobber is choosing a shot…',
  );
  assert.equal(translate('status.computer', 'ru', { name: 'Lobber' }), 'Lobber выбирает выстрел…');
});

test('guide covers the shipped equipment and all seven opponents in both languages', () => {
  for (const locale of ['en', 'ru']) {
    const guide = guideContent[locale];
    assert.deepEqual(
      guide.weaponSections.map((weapon) => weapon.id),
      catalog.weapons.map((weapon) => weapon.id),
    );
    assert.equal(guide.opponents.length, 7);
    assert.equal(guide.guidance.length, catalog.guidance.length);
    assert.equal(guide.defenses.length, catalog.defenses.length);
    for (const weapon of guide.weaponSections) {
      assert.equal(weapon.name, catalog.weapons[weapon.id].name);
      assert.ok(weapon.description.length > 30);
    }
  }
});

test('status instructions follow game state without modifying it', () => {
  const app = {
    screen: 'battle',
    game: { phase: 'aim', current: { name: 'Player 1', ai: -1, armed: 0 } },
  };
  const before = JSON.stringify(app);
  assert.equal(getScreenStatus(app), 'Turn: Player 1 · Set angle and power, then press Space.');
  assert.equal(JSON.stringify(app), before);
  app.game.falling = {};
  assert.equal(getScreenStatus(app), 'Tanks are descending…');
  app.game.falling = null;
  app.game.phase = 'flight';
  assert.equal(getScreenStatus(app), 'Shot in flight…');
});
