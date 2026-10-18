import { initLanguage, getLanguage, t } from './i18n.js';
import { loadCatalog } from './assets-loader.js';
import { guideContent } from './guide-content.js';
import weaponIcons from './assets/weapon-icons.js';
import { element, textList } from './document-ui.js';

initLanguage();
const container = document.getElementById('guide-content');
let catalog;

function icon(id) {
  const canvas = element('canvas', undefined, 'weapon-icon');
  canvas.width = 15;
  canvas.height = 10;
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  context.fillStyle = '#d4ed9e';
  weaponIcons[id].forEach((row, y) =>
    [...row].forEach((pixel, x) => {
      if (pixel === '1') context.fillRect(x, y, 1, 1);
    }),
  );
  return canvas;
}

function statistics(item, category, id) {
  const list = element('dl', undefined, 'item-stats');
  const money = new Intl.NumberFormat(getLanguage() === 'ru' ? 'ru-RU' : 'en-US');
  const values = [[t('price'), item.price < 0 ? t('notSold') : `$${money.format(item.price)}`]];
  if (item.quantity > 0) {
    const label = category === 'weapons' && id === 5 ? t('energyUnits') : t('quantity');
    values.push([label, money.format(item.quantity)]);
  }
  if (category === 'weapons' && item.radius !== null) {
    values.push([
      t(id === 7 ? 'bombletRadius' : id >= 13 && id <= 16 ? 'dirtRadius' : 'radius'),
      item.radius,
    ]);
  }
  for (const [label, value] of values) {
    const entry = element('div');
    entry.append(element('dt', label), element('dd', value));
    list.append(entry);
  }
  return list;
}

function card(entry, category, index) {
  const article = element('article', undefined, 'doc-card');
  article.id = `${category}-${entry.id ?? index}`;
  if (category === 'weapons' || category === 'guidance')
    article.append(icon(category === 'weapons' ? entry.id : 18 + entry.id));
  if (entry.role) article.append(element('p', entry.role, 'role'));
  article.append(element('h3', entry.name || entry.title), element('p', entry.description));
  if (entry.tips?.length) article.append(textList(entry.tips));
  const item = catalog[category]?.[entry.id];
  if (item) article.append(statistics(item, category, entry.id));
  return article;
}

function renderGuide() {
  const content = guideContent[getLanguage()];
  const fragment = document.createDocumentFragment();
  for (const paragraph of content.intro) fragment.append(element('p', paragraph, 'doc-lead'));
  for (const [id, entries] of [
    ['basics', content.basics],
    ['weapons', content.weaponSections],
    ['guidance', content.guidance],
    ['defenses', content.defenses],
    ['opponents', content.opponents],
    ['controls', content.controls],
    ['strategy', content.strategy],
  ]) {
    const section = element('section', undefined, 'doc-section');
    section.id = id;
    section.append(element('h2', t(`${id}Heading`)));
    if (id === 'controls') {
      const table = element('table', undefined, 'doc-table');
      for (const entry of entries) {
        const row = element('tr');
        const label = element('th', entry.keys);
        label.scope = 'row';
        row.append(label, element('td', entry.action));
        table.append(row);
      }
      section.append(table);
    } else {
      const grid = element('div', undefined, 'doc-grid');
      entries.forEach((entry, index) => grid.append(card(entry, id, index)));
      section.append(grid);
    }
    fragment.append(section);
  }
  content.notes.forEach((note) => fragment.append(element('p', note, 'doc-note')));
  const accuracy = element('a', t('accuracyLink'));
  accuracy.href = './accuracy.html';
  fragment.append(accuracy);
  container.replaceChildren(fragment);
}

try {
  catalog = await loadCatalog();
  renderGuide();
} catch {
  container.textContent = t('guideError');
}
window.addEventListener('languagechange', () => {
  if (catalog) renderGuide();
  else container.textContent = t('guideError');
});
