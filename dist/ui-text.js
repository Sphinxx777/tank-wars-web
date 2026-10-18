import { t, translate, getLanguage } from './i18n.js';

/** Screen instructions are derived from state, so changing language never resets a game. */
export function getScreenStatus(app) {
  if (app.screen !== 'battle') return t(`status.${app.screen}`);
  const game = app.game;
  if (game.falling) return t('status.falling');
  if (game.phase === 'flight') return t('status.flight');
  const player = game.current;
  if (player.ai >= 0) return t('status.computer', { name: player.name });
  return t(player.armed > 0 ? 'status.target' : 'status.aim', { name: player.name });
}

/** Translate the DOM overlay; do not change the original canvas lettering or player names. */
export function localizeHitLabel(hit) {
  const [action] = hit.action.split(':');
  if (action === 'angle' || action === 'power' || action === 'reverse') return t(action);
  if (action === 'menu') return t(hit.label === 'Continue' ? 'continue' : 'menu');
  const alias = { sound: 'soundOptions', options: 'gameOptions', shop: 'continue' };
  if (action === 'shop') return t('continue');
  const key = `hit.${alias[action] || action}`;
  const translated = translate(key, getLanguage());
  return translated === key ? hit.label || hit.action : translated;
}
