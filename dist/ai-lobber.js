import { real40 } from './lightning.js';

// BOMB.EXE 0x3026–0x3797: Lobber learns from its two latest landing positions.
// The DOS object keeps its desired elevation/direction independently of the
// player's visible controls; a direction change starts a new learning sequence.
const word = (value) => (Math.trunc(value) << 16) >> 16;
const distance = (a, b) => word(Math.abs(word(a - b)));

export function planLobber(game, player) {
  const order = game.order;
  const ownIndex = order.indexOf(player.id);
  const enemies = game.enemies?.(player);
  const valid = (candidate) =>
    enemies
      ? enemies.includes(candidate)
      : candidate.alive && candidate.id !== player.id && candidate.team !== player.team;
  if (!order.some((id) => valid(game.players[id]))) return null;

  const previous = player.lob.at(-1);
  const legacyAngle = previous?.angle ?? 75;
  const aim =
    player.lobAim ||
    (previous
      ? {
          elevation: Math.min(legacyAngle, 180 - legacyAngle),
          direction: previous.direction ?? (legacyAngle > 90 ? -1 : 1),
        }
      : { elevation: 0, direction: 1 });
  let direction = Math.abs(aim.direction) === 1 ? aim.direction : 1;
  // Older browser saves stored the untruncated flight coordinates.
  let history = (player.lob = player.lob.map((entry) => ({
    ...entry,
    x: entry.x > 32767 ? 32767 : word(entry.x),
    y: word(entry.y ?? 0),
    power: word(entry.power),
  })));
  let targetIndex = ownIndex;
  let weapon = 1;
  if (history.length < 2) {
    let step = direction;
    if (history.length === 0 && game.rng.next() <= 0.5) step = -step;
    do {
      targetIndex = (targetIndex + step + order.length) % order.length;
    } while (!valid(game.players[order[targetIndex]]));
  } else {
    let nearest = 32767;
    const previousX = history.at(-1).x;
    for (let i = 0; i < order.length; i++) {
      const candidate = game.players[order[i]];
      const separation = distance(previousX, candidate.x);
      if (separation < nearest && valid(candidate)) {
        nearest = separation;
        targetIndex = i;
      }
    }
  }

  if ((targetIndex > ownIndex && direction === -1) || (targetIndex < ownIndex && direction === 1)) {
    player.lob = history = [];
  }
  direction = targetIndex > ownIndex ? 1 : -1;
  let elevation = aim.elevation;
  let power;
  if (history.length < 2) {
    elevation = 75;
    power = history.length === 0 ? 100 + game.rng.int(100) : 200 + game.rng.int(200);
  } else {
    // The original loops over every pair, overwriting the same locals each time.
    // Only the final pair contributes to the result (including its error size).
    const earlier = history.at(-2);
    const later = history.at(-1);
    const dx = word(later.x - earlier.x) || 1;
    const dp = word(later.power - earlier.power) || 1;
    const error = word(game.players[order[targetIndex]].x - earlier.x);
    const correction = Math.trunc(real40(error * real40(dp / dx))) % 32767;
    power = word(earlier.power + correction);
    if (power < 0) power = word(-2 * power);
    weapon = Math.abs(error) > 30 ? 4 : Math.abs(error) > 15 ? 3 : Math.abs(error) > 5 ? 2 : 1;
    while (weapon !== 0 && player.ammo[weapon] < 1) {
      weapon = weapon === 1 ? 11 : weapon === 11 ? 0 : weapon - 1;
    }
  }
  player.lobAim = { elevation, direction };
  return {
    target: order[targetIndex],
    angle: direction > 0 ? elevation : 180 - elevation,
    power,
    weapon,
  };
}

// OVR 0x15722–0x1584c records the final shared projectile coordinates once per
// fired weapon. History uses signed integer words, not the flight's Real values.
export function recordLobberShot(player, shot) {
  player.lob.push({
    x: shot.x > 32767 ? 32767 : word(shot.x),
    y: word(shot.y),
    power: word(shot.power ?? player.power),
    angle: Math.min(player.angle, 180 - player.angle),
    direction: player.angle > 90 ? -1 : 1,
  });
}
