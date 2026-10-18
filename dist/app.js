import { initLanguage, t, getLanguage } from './i18n.js';
import { loadGameAssets } from './assets-loader.js';
import { getScreenStatus, localizeHitLabel } from './ui-text.js';
import { GAME_OPTION_KEYS } from './menu-render.js';
import { shopItems, shopStock, visibleShopItems, cartCost, reserve } from './shop.js';
import { PCSpeaker } from './sound.js';
import { Game, DEFAULTS, AI_NAMES, clamp, maxPower } from './engine.js';
import { Renderer } from './render.js';
const $ = (id) => document.getElementById(id),
  canvas = $('screen');
initLanguage();
const { catalog, fonts, bitmap, title } = await loadGameAssets().catch((error) => {
  $('loading').textContent = t('loadError');
  throw error;
});
export const app = {
  screen: 'splash',
  options: { ...DEFAULTS },
  game: null,
  selection: 0,
  editPlayer: 0,
  shopPlayer: 0,
  statsPlayer: 0,
  cart: [],
  roster: Array.from({ length: 10 }, (_, i) => ({
    name: i === 0 ? 'Player 1' : i === 1 ? 'Mr. Stupid' : `Player ${i + 1}`,
    ai: i === 0 ? -1 : i === 1 ? 0 : -1,
    team: i % 2,
  })),
  shopItems: shopItems(catalog),
  shopStock(it) {
    return shopStock(this.game.players[this.shopPlayer], it);
  },
  shopVisible() {
    return visibleShopItems(this.game.players[this.shopPlayer], this.shopItems);
  },
  cartCost() {
    return cartCost(this.cart, this.shopItems);
  },
};
const renderer = new Renderer(canvas, fonts, bitmap, title);
const speaker = new PCSpeaker();
let oldTime = 0,
  lastControlKey = '',
  messageUntil = 0,
  previousScreen = 'battle',
  pendingConfirm = null,
  held = null;
let activeNotice = null,
  confirmationKey = null;
function showNotice(key, seconds = 3) {
  activeNotice = key;
  $('status').textContent = t(key);
  messageUntil = performance.now() + seconds * 1000;
}
function setScreen(s) {
  if (s !== 'battle') speaker.stop();
  app.screen = s;
  if (s === 'options' || s === 'sound') app.optionIndex = 0;
  lastControlKey = '';
  canvas.focus({ preventScroll: true });
}
function confirmAction(message, action) {
  pendingConfirm = action;
  confirmationKey = message;
  $('confirm-text').textContent = t(message);
  $('confirm-dialog').showModal();
}
$('confirm-dialog').addEventListener('close', () => {
  if ($('confirm-dialog').returnValue === 'ok') pendingConfirm?.();
  pendingConfirm = null;
  canvas.focus({ preventScroll: true });
});
function newGame(quick = false) {
  speaker.stop();
  const opts = quick
    ? {
        ...app.options,
        players: 2,
        rounds: 5,
        wind: 1,
        walls: 0,
        background: 0,
        computerBuy: false,
      }
    : app.options;
  app.game = new Game(catalog.weapons, opts);
  app.game.start(
    quick
      ? [
          { name: 'Player 1', ai: -1, team: 0 },
          { name: 'Mr. Stupid', ai: 0, team: 1 },
        ]
      : app.roster.slice(0, opts.players),
  );
  setScreen('battle');
}
function saveGame() {
  if (!app.game || !['aim', 'score'].includes(app.game.phase)) {
    showNotice('saveUnavailable');
    return;
  }
  try {
    localStorage.setItem('tank-wars-save-v1', app.game.serialize());
    showNotice('saved');
  } catch {
    showNotice('saveFailed', 5);
  }
}
function loadGame() {
  try {
    const data = localStorage.getItem('tank-wars-save-v1');
    if (!data) {
      showNotice('noSave');
      return;
    }
    app.game = Game.restore(data, catalog.weapons);
    app.options = { ...app.game.options };
    updateSound();
    setScreen(app.game.phase === 'score' ? 'score' : 'battle');
    showNotice('loaded');
  } catch {
    showNotice('loadFailed');
  }
}
export function beginShop() {
  if (app.game.round >= app.game.options.rounds) {
    setScreen('menu');
    showNotice('gameFinished');
    return;
  }
  if (app.game.shopPreparedRound !== app.game.round) {
    app.game.computerShop();
    app.game.shopPreparedRound = app.game.round;
  }
  app.shopQueue = app.game.players
    .filter((p) => p.ai < 0 && p.money >= Math.min(...app.shopItems.map((it) => it.price)))
    .map((p) => p.id);
  nextShop();
}
function nextShop() {
  app.cart = [];
  app.shopSelection = 0;
  const next = app.shopQueue.shift();
  if (next === undefined) {
    app.game.nextRound();
    setScreen('battle');
  } else {
    app.shopPlayer = next;
    setScreen('shop');
  }
}
function purchase() {
  const p = app.game.players[app.shopPlayer],
    cost = app.cartCost();
  if (cost === 0) {
    app.cart = [];
    return true;
  }
  if (cost > p.money) {
    showNotice('insufficientFunds');
    return false;
  }
  app.cart.forEach((n, i) => {
    if (!n) return;
    const it = app.shopItems[i];
    app.game.buy(
      p.id,
      it.index,
      n,
      it.kind,
      it.kind === 'guidance' ? catalog.guidance : catalog.defenses,
    );
  });
  app.cart = [];
  app.shopSelection = Math.min(app.shopSelection || 0, Math.max(0, app.shopVisible().length - 1));
  showNotice('purchased');
  return true;
}
function changeOption(key, dir = 1) {
  const limits = {
    crumble: [0, 100, 25],
    walls: [0, 5, 1],
    wind: [0, 5, 1],
    background: [0, 9, 1],
    paletteSpeed: [0, 10, 1],
  };
  if (typeof app.options[key] === 'boolean') app.options[key] = !app.options[key];
  else {
    const [min, max, step] = limits[key];
    let v = app.options[key] + step * dir;
    if (v > max) v = min;
    if (v < min) v = max;
    app.options[key] = v;
  }
  updateSound();
}
function updateSound() {
  if (!app.options.sound) speaker.stop();
  $('sound').textContent = t(app.options.sound ? 'soundOn' : 'soundOff');
  $('sound').setAttribute('aria-pressed', String(app.options.sound));
  if (app.game) app.game.options.sound = app.options.sound;
}
function dispatchAction(actionId, dir = 1) {
  const [name, arg] = actionId.split(':'),
    n = Number(arg);
  switch (name) {
    case 'menu':
      setScreen('menu');
      break;
    case 'confirmMenu':
      confirmAction('confirmMenu', () => setScreen('menu'));
      break;
    case 'sound':
    case 'options':
    case 'roster':
      setScreen(name);
      break;
    case 'quick':
      if (app.game && app.screen === 'battle') confirmAction('confirmQuick', () => newGame(true));
      else newGame(true);
      break;
    case 'start':
      newGame();
      break;
    case 'playersCount':
      app.options.players = clamp(app.options.players + dir, 2, 10);
      break;
    case 'roundsCount':
      app.options.rounds = clamp(app.options.rounds + dir, 1, 99);
      break;
    case 'option':
      changeOption(arg, dir);
      break;
    case 'mouse':
    case 'human':
      app.roster[n].control = name === 'mouse' ? 'mouse' : 'keyboard';
      app.roster[n].ai = -1;
      app.editPlayer = n;
      if (AI_NAMES.includes(app.roster[n].name)) app.roster[n].name = 'Player ' + (n + 1);
      break;
    case 'name':
      app.editPlayer = n;
      $('player-name').value = app.roster[n].name;
      $('name-dialog').showModal();
      $('player-name').select();
      break;
    case 'ai':
      app.editPlayer = n;
      app.aiSelection = undefined;
      setScreen('ai');
      break;
    case 'aiRandom':
      dispatchAction('setAI:' + Math.floor(Math.random() * AI_NAMES.length));
      break;
    case 'setAI':
      app.roster[app.editPlayer].ai = n;
      app.roster[app.editPlayer].name = AI_NAMES[n];
      setScreen('roster');
      break;
    case 'team':
      app.roster[n].team = (app.roster[n].team + 1) % app.options.players;
      break;
    case 'weapon':
      if (!canAim()) break;
      if (n < 18 && app.game.current.ammo[n] !== 0) app.game.current.weapon = n;
      else if (n >= 18) app.game.armGuidance(n - 18);
      break;
    case 'angle':
      if (canAim()) app.game.setAngle(app.game.current.angle + dir);
      break;
    case 'power':
      if (canAim()) app.game.setPower(app.game.current.power + dir * 100);
      break;
    case 'reverse':
      if (canAim()) app.game.setAngle(180 - app.game.current.angle, true);
      break;
    case 'tank':
      if (canAim() && app.game.current.armed > 0 && n !== app.game.active)
        app.game.current.target = n;
      else {
        previousScreen = app.screen;
        app.statsPlayer = n;
        setScreen('stats');
      }
      break;
    case 'stats':
      previousScreen = 'score';
      app.statsPlayer = n;
      setScreen('stats');
      break;
    case 'save':
      saveGame();
      break;
    case 'load':
      if (app.game && app.screen === 'battle') confirmAction('confirmLoad', loadGame);
      else loadGame();
      break;
    case 'shop':
      beginShop();
      break;
    case 'addRounds':
      app.game.options.rounds += 5;
      showNotice('roundsAdded');
      break;
    case 'shopCard':
      app.shopSelection = app.shopVisible().indexOf(n);
      dispatchAction((dir < 0 ? 'cartPlus:' : 'cartMinus:') + n);
      break;
    case 'cartPlus':
      if (!reserve(app.cart, app.shopItems, app.game.players[app.shopPlayer], n))
        showNotice('cartLimit');
      break;
    case 'cartMinus':
      reserve(app.cart, app.shopItems, app.game.players[app.shopPlayer], n, -1);
      break;
    case 'purchase':
      purchase();
      break;
    case 'shopDone':
      if (purchase()) nextShop();
      break;
    case 'mirvSpread':
      app.game.options.mirvSpread = (app.game.options.mirvSpread + 1) % 5;
      break;
    case 'mirvDetonation':
      app.game.options.mirvDetonation = (app.game.options.mirvDetonation + 1) % 3;
      break;
    case 'mirvFire':
      setScreen('battle');
      app.game.fire();
      break;
    case 'resume':
      setScreen(previousScreen === 'score' ? 'score' : 'battle');
      break;
  }
}
$('name-dialog').addEventListener('close', () => {
  if ($('name-dialog').returnValue === 'ok')
    app.roster[app.editPlayer].name =
      $('player-name').value.trim().slice(0, 12) || 'Player ' + (app.editPlayer + 1);
  canvas.focus();
});
function canAim() {
  return app.screen === 'battle' && app.game.phase === 'aim' && app.game.current.ai < 0;
}
function pause() {
  if (!app.game) return;
  if (app.game.phase === 'score') {
    setScreen('score');
    return;
  }
  previousScreen = 'battle';
  setScreen(app.screen === 'battle' ? 'pause' : 'battle');
}
function fire() {
  if (canAim()) {
    if (app.game.current.weapon === 7) {
      setScreen('mirv');
      return;
    }
    if (!app.game.fire()) showNotice('outOfAmmo');
  }
  canvas.focus({ preventScroll: true });
}
$('fire').addEventListener('click', fire);
$('quick').addEventListener('click', () => dispatchAction('quick'));
$('menu').addEventListener('click', () =>
  app.game && app.screen === 'battle' ? dispatchAction('confirmMenu') : setScreen('menu'),
);
$('pause').addEventListener('click', pause);
$('save').addEventListener('click', saveGame);
$('load').addEventListener('click', () => dispatchAction('load'));
$('sound').addEventListener('click', () => {
  app.options.sound = !app.options.sound;
  updateSound();
});
$('help-toggle').addEventListener('click', () => {
  $('help').open = !$('help').open;
});
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $('screen-wrap').requestFullscreen();
  } catch {
    showNotice('fullscreenFailed');
  }
});
$('angle').addEventListener('input', (e) => {
  if (canAim()) app.game.setAngle(Number(e.target.value));
});
$('power').addEventListener('input', (e) => {
  if (canAim()) app.game.setPower(Number(e.target.value));
});
$('weapon').addEventListener('change', (e) => {
  if (canAim()) app.game.current.weapon = Number(e.target.value);
  canvas.focus();
});
document.querySelectorAll('[data-key]').forEach((b) => {
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handleKey(b.dataset.key);
    held = { key: b.dataset.key, since: performance.now(), last: performance.now() };
    b.setPointerCapture(e.pointerId);
  });
  b.addEventListener('pointerup', () => (held = null));
  b.addEventListener('pointercancel', () => (held = null));
});
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * 320) / r.width, y: ((e.clientY - r.top) * 200) / r.height };
}
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  canvas.focus({ preventScroll: true });
  const { x, y } = canvasPoint(e);
  const hit = [...renderer.hits]
    .reverse()
    .find((h) => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h);
  if (hit) dispatchAction(hit.action, e.button === 2 ? -1 : 1);
  else if (canAim() && e.buttons === 3) fire();
});
canvas.addEventListener('pointermove', (e) => {
  const { x, y } = canvasPoint(e);
  const hit = renderer.hits.find((h) => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h);
  canvas.style.cursor = hit ? 'pointer' : 'default';
  canvas.title = hit ? localizeHitLabel(hit) : '';
});
function handleKey(k, shift = false, ctrl = false) {
  if (k === 'F10') {
    if (app.screen === 'boss') setScreen(previousScreen);
    else {
      previousScreen = app.screen;
      setScreen('boss');
    }
    return;
  }
  if (app.screen === 'stats') {
    dispatchAction('resume');
    return;
  }
  if (app.screen === 'boss') {
    if (k === ' ') setScreen(previousScreen);
    return;
  }
  if (ctrl && k.toLowerCase() === 's') {
    app.options.sound = !app.options.sound;
    updateSound();
    return;
  }
  if (ctrl && k.toLowerCase() === 'p') {
    pause();
    return;
  }
  if (ctrl && k.toLowerCase() === 'q') {
    dispatchAction('confirmMenu');
    return;
  }
  if (k === 'Escape') {
    if (['pause', 'stats', 'mirv'].includes(app.screen)) dispatchAction('resume');
    else if (app.screen === 'battle') pause();
    else if (app.screen === 'ai') setScreen('roster');
    else if (app.screen === 'shop') dispatchAction('shopDone');
    else if (app.screen !== 'score' && app.screen !== 'shop') setScreen('menu');
    return;
  }
  if (app.screen === 'splash') {
    setScreen('menu');
    return;
  }
  if (app.screen === 'menu') return handleMenuKey(k);
  if (['sound', 'options'].includes(app.screen)) return handleOptionsKey(k);
  if (app.screen === 'ai') return handleOpponentKey(k);
  if (app.screen === 'roster' && (k === 'Enter' || k === ' ')) {
    newGame();
    return;
  }
  if (app.screen === 'mirv' && (k === 'Enter' || k === ' ')) {
    dispatchAction('mirvFire');
    return;
  }
  if (app.screen === 'score' && (k === 'Enter' || k === ' ')) {
    beginShop();
    return;
  }
  if (app.screen === 'shop') return handleShopKey(k);
  if (app.screen === 'battle') handleBattleKey(k, shift, ctrl);
}

function handleMenuKey(k) {
  if (k.toLowerCase() === 'l') {
    loadGame();
    return;
  }
  if (k === 'ArrowDown') app.selection = (app.selection + 1) % 5;
  if (k === 'ArrowUp') app.selection = (app.selection + 4) % 5;
  if (['Enter', 'ArrowRight', 'ArrowLeft', ' '].includes(k)) {
    dispatchAction(
      ['sound', 'options', 'playersCount', 'roundsCount', 'roster'][app.selection],
      k === 'ArrowLeft' ? -1 : 1,
    );
  }
  return;
}

function handleOptionsKey(k) {
  const keys = app.screen === 'sound' ? ['sound', 'flySound'] : GAME_OPTION_KEYS;
  if (k === 'ArrowDown') app.optionIndex = ((app.optionIndex || 0) + 1) % keys.length;
  if (k === 'ArrowUp') app.optionIndex = ((app.optionIndex || 0) + keys.length - 1) % keys.length;
  if (k === 'ArrowLeft' || k === 'ArrowRight')
    changeOption(keys[app.optionIndex || 0], k === 'ArrowLeft' ? -1 : 1);
  if (k === 'Enter') setScreen('menu');
  return;
}

function handleOpponentKey(k) {
  const ids = [-1, 0, 1, 2, 4, 3, 5, 6];
  app.aiSelection ??= Math.max(0, ids.indexOf(app.roster[app.editPlayer].ai));
  if (k === 'ArrowDown') app.aiSelection = (app.aiSelection + 1) % 8;
  if (k === 'ArrowUp') app.aiSelection = (app.aiSelection + 7) % 8;
  if (k === 'Enter' || k === ' ')
    dispatchAction(app.aiSelection === 0 ? 'aiRandom' : 'setAI:' + ids[app.aiSelection]);
  return;
}

function handleShopKey(k) {
  const visible = app.shopVisible(),
    move = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -9, ArrowRight: 9 }[k];
  if (move) {
    const next = (app.shopSelection || 0) + move;
    if (next >= 0 && next < visible.length) app.shopSelection = next;
  }
  const i = visible[app.shopSelection || 0];
  if (i !== undefined) {
    if ([' ', '+', '='].includes(k)) dispatchAction('cartPlus:' + i);
    if (k === '-') dispatchAction('cartMinus:' + i);
  }
  if (k.toLowerCase() === 'd') dispatchAction('shopDone');
  if (k.toLowerCase() === 'p' || k === 'Enter') purchase();
  return;
}

function handleBattleKey(k, shift, ctrl) {
  if (/^[0-9]$/.test(k)) {
    const id = (Number(k) + 9) % 10;
    if (app.game.players[id]) dispatchAction('tank:' + id);
    return;
  }
  if (ctrl && k.toLowerCase() === 'r') {
    app.game.setBackground(9);
    return;
  }
  if (!canAim()) return;
  const g = app.game,
    p = g.current;
  if (k === 'ArrowLeft') g.setAngle(p.angle + 1);
  if (k === 'ArrowRight') g.setAngle(p.angle - 1);
  if (k === 'ArrowUp') g.setPower(p.power + 1);
  if (k === 'ArrowDown') g.setPower(p.power - 1);
  if (k === 'PageUp') g.setPower(p.power + 100);
  if (k === 'PageDown') g.setPower(p.power - 100);
  if (k === 'i' || k === 'I') g.setAngle(180 - p.angle, true);
  if (k === 'Tab') g.cycleWeapon(shift ? -1 : 1);
  if (k === 'h' || k === 'H') g.armGuidance(0);
  if (k === 'v' || k === 'V') g.armGuidance(1);
  if (k === ' ' || k === 'Enter') fire();
}
window.addEventListener('keydown', (e) => {
  if (
    document.querySelector('dialog[open]') ||
    ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)
  )
    return;
  if (
    [
      ' ',
      'Enter',
      'Escape',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'PageUp',
      'PageDown',
      'F10',
    ].includes(e.key) ||
    (e.key === 'Tab' && app.screen === 'battle') ||
    (e.ctrlKey && ['s', 'p', 'q', 'r', 'm'].includes(e.key.toLowerCase()))
  )
    e.preventDefault();
  handleKey(e.key, e.shiftKey, e.ctrlKey);
});
window.addEventListener('blur', () => {
  held = null;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && app.screen === 'battle') pause();
});
for (const [id, k] of [
  ['shop-prev', 'ArrowUp'],
  ['shop-next', 'ArrowDown'],
  ['shop-plus', '+'],
  ['shop-minus', '-'],
  ['shop-buy', 'Enter'],
  ['shop-done', 'd'],
])
  $(id).addEventListener('click', () => {
    handleKey(k);
    canvas.focus({ preventScroll: true });
  });
function updateControls() {
  $('shop-controls').hidden = app.screen !== 'shop';
  const battle = app.screen === 'battle',
    g = app.game,
    p = g?.current;
  $('battle-controls').hidden = !battle;
  $('pause').disabled = !g;
  $('save').disabled = !g || !['aim', 'score'].includes(g.phase);
  if (!battle) {
    if (performance.now() > messageUntil) $('status').textContent = getScreenStatus(app);
    return;
  }
  const allowed = canAim();
  for (const id of ['angle', 'power', 'weapon', 'fire']) $(id).disabled = !allowed;
  $('angle').value = p.angle;
  $('angle-value').textContent =
    Math.min(p.angle, 180 - p.angle) + '° ' + (p.angle > 90 ? '←' : '→');
  $('power').max = maxPower(p);
  $('power').value = p.power;
  $('power-value').textContent = p.power;
  const signature = p.id + ':' + p.ammo.join(',') + ':' + p.weapon;
  if (signature !== lastControlKey) {
    lastControlKey = signature;
    $('weapon').replaceChildren(
      ...catalog.weapons
        .filter((w, i) => p.ammo[i] !== 0)
        .map((w) => {
          const o = document.createElement('option');
          o.value = w.id;
          o.textContent = w.shortName + ' · ' + p.ammo[w.id];
          o.selected = w.id === p.weapon;
          return o;
        }),
    );
  }
  if (performance.now() > messageUntil) $('status').textContent = getScreenStatus(app);
}
let hitSignature = '';
function syncHitTargets() {
  const layer = $('hit-layer'),
    hits = renderer.hits;
  layer.style.left = canvas.offsetLeft + 'px';
  layer.style.top = canvas.offsetTop + 'px';
  layer.style.width = canvas.clientWidth + 'px';
  layer.style.height = canvas.clientHeight + 'px';
  const signature =
    getLanguage() +
    '|' +
    app.screen +
    '|' +
    hits.map((h) => [h.action, h.label, h.x, h.y, h.w, h.h].join(':')).join('|');
  if (signature === hitSignature) return;
  hitSignature = signature;
  layer.replaceChildren(
    ...hits.map((h) => {
      const b = document.createElement('button');
      b.setAttribute('aria-label', localizeHitLabel(h));
      b.style.cssText = `left:${h.x / 3.2}%;top:${h.y / 2}%;width:${h.w / 3.2}%;height:${h.h / 2}%;`;
      b.addEventListener('click', (e) => {
        if (e.button === 0) dispatchAction(h.action);
      });
      b.addEventListener('pointerdown', (e) => {
        if (e.button === 2) {
          e.preventDefault();
          dispatchAction(h.action, -1);
        }
      });
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      return b;
    }),
  );
}
let lastDraw = 0;
function frame(t) {
  const dt = Math.min(0.05, (t - oldTime) / 1000 || 0.016);
  oldTime = t;
  if (held && t - held.since > 300 && t - held.last > 65) {
    handleKey(held.key);
    held.last = t;
  }
  if (app.screen === 'battle' && app.game) {
    app.game.update(dt);
    for (const event of app.game.events.splice(0)) {
      if (event.type === 'speaker' && app.options.sound) speaker.play(event.sequence);
      if (event.type === 'roundEnd') {
        setScreen('score');
        saveGame();
      }
    }
  }
  if ((app.screen === 'battle' && app.game?.falling) || t - lastDraw > 1000 / 30) {
    renderer.render(app, t / 1000);
    syncHitTargets();
    updateControls();
    lastDraw = t;
  }
  requestAnimationFrame(frame);
}
// Unlock from the first real gesture, before any delayed animation callback.
for (const event of ['pointerdown', 'keydown'])
  document.addEventListener(
    event,
    () => {
      if (app.options.sound) speaker.unlock();
    },
    { capture: true },
  );
window.addEventListener('languagechange', () => {
  updateSound();
  if (activeNotice && performance.now() < messageUntil) $('status').textContent = t(activeNotice);
  else updateControls();
  if (confirmationKey) $('confirm-text').textContent = t(confirmationKey);
  syncHitTargets();
});
// Dynamic status text is state-driven rather than part of the static DOM translations.
$('status').removeAttribute('data-i18n');
updateSound();
$('loading').remove();
requestAnimationFrame(frame);
canvas.focus({ preventScroll: true });
