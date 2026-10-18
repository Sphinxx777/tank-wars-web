import { controlSound } from './sound.js';

// Original command order and sizes: EXE 0x2bc5..0x2e17, OVR 0x1aef0 onward.
// AI bypasses the DOS input polling delay. These presentation intervals make
// its CPU-dependent controls visible in a browser, including with sound muted.
export const AI_CONTROL_SECONDS = 1 / 30;
export const AI_WEAPON_SECONDS = 0.128;

export function aiControl(player, plan, direction) {
  if (player.weapon !== plan.weapon) return { kind: 'weapon' };
  const desiredDirection = plan.angle > 90 ? -1 : 1;
  if (direction !== desiredDirection) return { kind: 'flip' };
  const difference = plan.power - player.power;
  if (difference) {
    const distance = Math.abs(difference);
    const step = distance >= 100 ? 100 : distance >= 10 ? 10 : 1;
    return { kind: 'power', value: player.power + Math.sign(difference) * step };
  }
  if (player.angle !== plan.angle)
    return { kind: 'angle', value: player.angle + Math.sign(plan.angle - player.angle) };
  return { kind: 'fire' };
}

export function aiIconColor(transition, weapon) {
  if (!transition) return null;
  // OVR 0x1afd2..0x1b02d: first counter=3, then +4 through 63.
  const level = Math.min(63, 3 + 4 * Math.floor(transition.elapsed / 0.008));
  const shade = weapon === transition.from ? level : weapon === transition.to ? 63 - level : null;
  return shade === null
    ? null
    : `rgb(255,${Math.round((shade * 255) / 63)},${Math.round((shade * 255) / 63)})`;
}

export function updateAIAim(game, dt) {
  const player = game.current;
  if (game.aiWeaponTransition) {
    game.aiWeaponTransition.elapsed += dt;
    if (game.aiWeaponTransition.elapsed >= AI_WEAPON_SECONDS) game.aiWeaponTransition = null;
  }
  if (!game.aiAim) {
    game.aiTimer -= dt;
    if (game.aiTimer > 1e-12) return;
    // Run the existing strategist exactly once; keep its RNG calls and chosen
    // shot, but restore the visible controls until their commands are executed.
    const previous = {
      angle: player.angle,
      power: player.power,
      weapon: player.weapon,
      target: player.target,
    };
    game.aimAI(player);
    const plan = {
      angle: player.angle,
      power: player.power,
      weapon: player.weapon,
      target: player.target,
    };
    Object.assign(player, previous);
    game.aiAim = {
      owner: player.id,
      plan,
      direction: player.angle > 90 ? -1 : 1,
      wait: game.aiTimer,
    };
  } else game.aiAim.wait -= dt;
  const state = game.aiAim;
  while (state.wait <= 1e-12 && game.phase === 'aim') {
    const action = aiControl(player, state.plan, state.direction);
    let duration = AI_CONTROL_SECONDS;
    if (action.kind === 'weapon') {
      const from = player.weapon;
      // Control 8 always cycles forward, skipping unavailable ammunition.
      for (let i = 0; i < 18; i++) {
        player.weapon = (player.weapon + 1) % 18;
        if (player.ammo[player.weapon] > 0 && (player.weapon !== 5 || player.ammo[5] >= 100)) break;
      }
      game.aiWeaponTransition = { from, to: player.weapon, elapsed: Math.max(0, -state.wait) };
      duration = AI_WEAPON_SECONDS;
    } else if (action.kind === 'flip') {
      state.direction *= -1;
      player.angle = 180 - player.angle;
      game.audio(controlSound('flip'));
    } else if (action.kind === 'power') {
      game.setPower(action.value);
    } else if (action.kind === 'angle') {
      // Keep direction separately while passing through vertical: angle=90
      // alone cannot tell a left-facing gun from a right-facing one.
      const increasing = action.value > player.angle;
      player.angle = action.value;
      game.audio(controlSound(increasing ? 'angleUp' : 'angleDown'));
    } else {
      player.target = state.plan.target;
      game.aiAim = null;
      game.aiWeaponTransition = null;
      game.fire();
      return;
    }
    state.wait += duration;
  }
}
