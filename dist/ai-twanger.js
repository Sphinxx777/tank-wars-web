import { real, realAtan, realSin, realCos, realAdd, realMultiply, realDivide } from './ai-real.js';
// Solid-wall Twanger: BOMB.EXE 0x4b30..0x57f4. Ray calculations use a
// temporary framebuffer; their writes must never remove real terrain.
function reflectedRay(player, target, direction, visit) {
  const rise = player.y - 28;
  const theta = realAtan(Math.abs(realDivide(player.y + target.y - 56, target.x - player.x)));
  const run = Math.trunc(realDivide(direction * rise, realDivide(realSin(theta), realCos(theta))));
  const ceilingX = player.x + run;
  for (const [x, y, dx, dy, penalty] of [
    [player.x, player.y, run, -rise, 3],
    [ceilingX, 28, target.x - ceilingX, target.y - 28, 1],
  ]) {
    const length = real(Math.hypot(dx, dy));
    for (let k = 1; k <= Math.trunc(length); k++) {
      visit(
        Math.trunc(realAdd(x, realMultiply(k, realDivide(dx, length)))),
        Math.trunc(realAdd(y, realMultiply(k, realDivide(dy, length)))),
        penalty,
      );
    }
  }
}

export function planTwanger(game, player, tankPixel = () => false) {
  const ordered = game.order.map((id) => game.players[id]);
  const ownIndex = ordered.indexOf(player);
  const enemies = game.enemies(player);
  const overwritten = new Set();
  const samples = [];
  const scan = (target, direction) => {
    let score = 1000;
    reflectedRay(player, target, direction, (x, y, penalty) => {
      const key = y * 320 + x;
      samples.push([x, y]);
      if (
        !overwritten.has(key) &&
        game.terrain.solid(x, y) &&
        !game.players.some((tank) => tank.alive && tankPixel(tank, x, y))
      )
        score -= penalty;
      overwritten.add(key);
    });
    return score;
  };
  const scores = ordered.map((target) =>
    enemies.includes(target) ? scan(target, target.x < player.x ? -1 : 1) : -1,
  );
  // The original records successive maxima, then keeps the final maximum
  // rank. Among its ties, nearest truncated Euclidean distance wins.
  let bestScore = 0;
  let rank = 1;
  const ranking = scores.map((score) => {
    if (score > bestScore) {
      bestScore = score;
      rank++;
      return rank;
    }
    return score === bestScore ? rank : 0;
  });
  const highest = Math.max(...ranking);
  for (let i = 0; i < ranking.length; i++) if (ranking[i] < highest) ranking[i] = 0;
  let selected = -1;
  let nearestScore = 0;
  for (let i = 0; i < ordered.length; i++) {
    if (!ranking[i]) continue;
    const target = ordered[i];
    const score = 1000 - Math.trunc(Math.hypot(player.x - target.x, player.y - target.y));
    if (score > nearestScore) {
      nearestScore = score;
      selected = i;
    }
  }
  // DOS leaves target index zero if every path score is negative. There is
  // no real player zero in the browser, so imported pathological layouts
  // use the first enemy instead of reading the DOS scratch player record.
  if (selected < 0) selected = ordered.indexOf(enemies[0]);
  const target = ordered[selected];
  overwritten.clear();
  const weaponScore = scan(target, selected < ownIndex ? -1 : 1);
  const dx = target.x - player.x;
  const dy = player.y - target.y;
  const angle = Math.trunc(
    realDivide(
      realMultiply(realAtan(Math.abs(realDivide(player.y + target.y - 56, dx))), 180),
      real(Math.PI),
    ),
  );
  const power = 950 + game.rng.int(51);
  let weapon = 1;
  if (weaponScore > 990) {
    for (let id = 2; id <= 4; id++)
      if (player.ammo[id] > 0 && game.weapons[id].radius < Math.hypot(dx, dy)) weapon = id;
  } else if (player.ammo[5] > 100) weapon = 5;
  return {
    target: target.id,
    angle: dx < 0 ? 180 - angle : angle,
    power,
    weapon,
    debug: { scores, ranking, weaponScore, samples },
  };
}
