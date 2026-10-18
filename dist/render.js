import { aiIconColor } from './ai-controls.js';
import { runtimeCos, runtimeSin } from './runtime-trig.js';
import {
  menuLayout,
  optionsLayout,
  rosterLayout,
  scoreLayout,
  aiLayout,
  statsLayout,
} from './menu-render.js';
import { createMenuBackground, backgroundFrame } from './background.js';
import { drawBlast, drawSonic, sonicFrame } from './effects-render.js';
import { tankColor, dacColor, TRAIL_COLORS, EGA, SCREEN_COLOR } from './palette.js';
import { titleFrame, TITLE_STEP_SECONDS, TITLE_COLORS } from './title.js';
import weaponIcons from './assets/weapon-icons.js';
import { W, H, TOP, LEFT, RIGHT, BOTTOM, COLORS } from './engine.js';
export class Renderer {
  constructor(canvas, fonts, bitmap, title) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.fonts = fonts;
    this.bitmap = bitmap;
    this.hits = [];
    this.time = 0;
    this.buttons = [];
    this.ctx.imageSmoothingEnabled = false;
    this.back = document.createElement('canvas');
    this.back.width = W;
    this.back.height = H;
    this.bc = this.back.getContext('2d');
    this.title = title;
    this.titlePixels = this.ctx.createImageData(W, H);
    this.titlePhase = -1;
  }
  rect(x, y, w, h, c) {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    let dx = Math.abs(x1 - x0),
      sx = x0 < x1 ? 1 : -1,
      dy = -Math.abs(y1 - y0),
      sy = y0 < y1 ? 1 : -1,
      err = dx + dy;
    this.ctx.fillStyle = c;
    for (let n = 0; n < 2000; n++) {
      this.ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e = err * 2;
      if (e >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  box(x, y, w, h, fill = '#aaa', inset = false) {
    this.rect(x, y, w, h, fill);
    const hi = inset ? '#555' : '#fff',
      lo = inset ? '#fff' : '#555';
    this.line(x, y, x + w - 1, y, hi);
    this.line(x, y, x, y + h - 1, hi);
    this.line(x + w - 1, y + 1, x + w - 1, y + h - 1, lo);
    this.line(x + 1, y + h - 1, x + w - 1, y + h - 1, lo);
  }
  textWidth(str, font = 'litt', scale = 1) {
    if (font === 'bios') return String(str).length * 8 * scale;
    const f = this.fonts[font];
    return [...String(str)].reduce(
      (n, c) => n + (f.glyphs[c]?.width || f.glyphs[c.toUpperCase()]?.width || 4) * scale,
      0,
    );
  }
  text(str, x, y, color = '#fff', font = 'litt', scale = 1, align = 'left') {
    str = String(str);
    if (align === 'center') x -= this.textWidth(str, font, scale) / 2;
    if (align === 'right') x -= this.textWidth(str, font, scale);
    if (font === 'bios') {
      for (const c of str) {
        const code = c.charCodeAt(0) & 127;
        for (let row = 0; row < 8; row++)
          for (let col = 0; col < 8; col++)
            if (this.bitmap[code * 8 + row] & (128 >> col))
              this.rect(x + col * scale, y + row * scale, scale, scale, color);
        x += 8 * scale;
      }
      return;
    }
    const f = this.fonts[font];
    for (let c of str) {
      let g = f.glyphs[c];
      if (!g?.width) g = f.glyphs[c.toUpperCase()];
      if (!g) {
        x += 4 * scale;
        continue;
      }
      let px = 0,
        py = 0;
      for (const [cmd, gx, gy] of g.commands) {
        const nx = x + gx * scale,
          ny = y + (f.ascender - gy) * scale;
        if (cmd === 'line') this.line(px, py, nx, ny, color);
        px = nx;
        py = ny;
      }
      x += g.width * scale;
    }
  }
  hit(x, y, w, h, action, label) {
    this.hits.push({ x, y, w, h, action, label });
  }
  button(
    label,
    x,
    y,
    w,
    h,
    action,
    { color = '#55ff55', font = 'litt', scale = 1, selected = false, fill = '#aaa' } = {},
  ) {
    this.box(x, y, w, h, fill, selected);
    this.text(
      label,
      x + w / 2,
      y + (h - (font === 'bios' ? 8 : this.fonts[font].ascender + 1) * scale) / 2,
      color,
      font,
      scale,
      'center',
    );
    this.hit(x, y, w, h, action, label);
  }
  circle(x, y, r, color, fill = false) {
    if (fill) {
      for (let yy = -r; yy <= r; yy++) {
        const xx = Math.floor(Math.sqrt(Math.max(0, r * r - yy * yy)));
        this.rect(x - xx, y + yy, xx * 2 + 1, 1, color);
      }
    } else {
      let xx = r,
        yy = 0,
        e = 1 - r;
      while (xx >= yy) {
        for (const [a, b] of [
          [xx, yy],
          [yy, xx],
          [-yy, xx],
          [-xx, yy],
          [-xx, -yy],
          [-yy, -xx],
          [yy, -xx],
          [xx, -yy],
        ])
          this.rect(x + a, y + b, 1, 1, color);
        yy++;
        if (e < 0) e += 2 * yy + 1;
        else {
          xx--;
          e += 2 * (yy - xx) + 1;
        }
      }
    }
  }
  paintBackground(model, elapsed, speed) {
    if (
      this.cachedModel !== model ||
      this.cachedElapsed !== elapsed ||
      this.cachedSpeed !== speed
    ) {
      const im = this.bc.createImageData(W, H);
      backgroundFrame(model, elapsed, speed, im.data);
      this.bc.putImageData(im, 0, 0);
      this.cachedModel = model;
      this.cachedElapsed = elapsed;
      this.cachedSpeed = speed;
    }
    this.ctx.drawImage(this.back, 0, 0);
  }
  menuBackground(speed = 3) {
    this.menuModel ??= createMenuBackground(0, 100);
    this.menuEpoch ??= this.time;
    this.paintBackground(this.menuModel, this.time - this.menuEpoch, speed);
  }
  heading() {
    this.box(8, 4, 304, 40);
    this.text('TANK WARS  3.2', 160, 10, '#ffff55', 'euro', 0.57, 'center');
    this.text('TANK WARS  3.2', 159, 9, '#ff5555', 'euro', 0.57, 'center');
  }
  splash() {
    this.titleStart ??= this.time;
    const phase = Math.floor((this.time - this.titleStart) / TITLE_STEP_SECONDS) % TITLE_COLORS;
    if (phase !== this.titlePhase) {
      titleFrame(this.title, phase, this.titlePixels.data);
      this.titlePhase = phase;
    }
    this.ctx.putImageData(this.titlePixels, 0, 0);
    this.hit(0, 0, 320, 200, 'menu', 'Continue');
  }
  menu(app) {
    menuLayout.call(this, app);
  }
  options(app, sound = false) {
    optionsLayout.call(this, app, sound);
  }
  roster(app) {
    rosterLayout.call(this, app);
  }
  ai(app) {
    aiLayout.call(this, app);
  }
  tank(p, level = p.men, drawGun = true) {
    const x = Math.round(p.x),
      y = Math.round(p.y),
      c = tankColor(p.id, level);
    const rows = ['000111000', '011111110', '011111110', '111010111', '111111111'];
    for (let r = 0; r < rows.length; r++)
      for (let k = 0; k < 9; k++) if (rows[r][k] === '1') this.rect(x - 4 + k, y - 4 + r, 1, 1, c);
    if (drawGun) {
      this.bgiLine(
        x,
        y,
        x + Math.trunc(runtimeCos(p.angle) * 8),
        y - Math.trunc(runtimeSin(p.angle) * 8),
        c,
      );
    }
  }
  icon(id, x, y, c) {
    for (let row = 0; row < 10; row++)
      for (let col = 0; col < 15; col++)
        if (weaponIcons[id][row][col] === '1') this.rect(x + col, y + row, 1, 1, c);
  }
  bevel(x1, y1, x2, y2, fill = '#aaa', hi = '#fff', lo = '#555') {
    this.rect(x1, y1, x2 - x1 + 1, y2 - y1 + 1, fill);
    for (let n = 1; n <= 2; n++) {
      this.line(x2 + n, y1 - n, x2 + n, y2 + n, lo);
      this.line(x1 - n, y2 + n, x2 + n, y2 + n, lo);
      this.line(x1 - n, y1 - n, x1 - n, y2 + n, hi);
      this.line(x1 - n, y1 - n, x2 + n, y1 - n, hi);
    }
  }
  // BGI driver EXE 0x82bc: half-major error, tested against the DOS frame.
  bgiLine(x0, y0, x1, y1, color) {
    const dx = Math.abs(x1 - x0),
      dy = Math.abs(y1 - y0),
      horizontal = dx > dy,
      major = horizontal ? dx : dy,
      minor = horizontal ? dy : dx,
      sx = x1 > x0 ? 1 : -1,
      sy = y1 > y0 ? 1 : -1;
    let error = major >> 1;
    this.rect(x0, y0, 1, 1, color);
    for (let n = 0; n < major; n++) {
      if (horizontal) x0 += sx;
      else y0 += sy;
      error += minor;
      if (error >= major) {
        if (horizontal) y0 += sy;
        else x0 += sx;
        error -= major;
      }
      this.rect(x0, y0, 1, 1, color);
    }
  }
  bgiText(str, x, y, color, font = 'litt', scale = 1, horizontal = 'left', vertical = 'top') {
    const f = this.fonts[font],
      height = Math.trunc((f.ascender - f.descender) * scale),
      width = Math.trunc(this.textWidth(str, font, scale));
    if (horizontal === 'center') x -= Math.floor(width / 2) - 1;
    else if (horizontal === 'right') x -= width;
    const baseline =
      y + (vertical === 'top' ? height : vertical === 'center' ? Math.floor(height / 2) : 0);
    for (const c of String(str)) {
      const g = f.glyphs[c] || f.glyphs[c.toUpperCase()];
      if (!g) {
        x += Math.trunc(4 * scale);
        continue;
      }
      let px = 0,
        py = 0;
      for (const [cmd, gx, gy] of g.commands) {
        const nx = x + Math.trunc(gx * scale),
          ny = baseline - Math.trunc(gy * scale);
        if (cmd === 'line') this.bgiLine(nx, ny, px, py, color);
        px = nx;
        py = ny;
      }
      x += Math.trunc(g.width * scale);
    }
  }
  shopBackground(speed = 3) {
    const phase = Math.floor((this.time * 18.2065) / Math.max(1, speed)) % 30;
    for (let y = 0; y < 200; y++) {
      const v = Math.round(((30 + ((y + phase) % 30)) * 255) / 63);
      this.rect(0, y, 320, 1, `rgb(${v},0,${v})`);
    }
  }
  battle(app) {
    const g = app.game,
      p = g.current;
    this.paintBackground(g.backgroundModel, g.backgroundElapsed || 0, g.options.paletteSpeed);
    // Trails belong to the saved background, underneath mutable terrain.
    for (let y = TOP; y <= BOTTOM; y++)
      for (let x = LEFT; x <= RIGHT; x++) {
        const owner = g.trailPixels[y * W + x];
        if (owner) this.rect(x, y, 1, 1, TRAIL_COLORS[owner - 1]);
      }
    const sonic = g.explosions.find((e) => e.kind === 'sonic'),
      rgb = sonic && sonicFrame(sonic)?.ground;
    const ground = rgb ? `rgb(${rgb.map((v) => Math.round((v * 255) / 63)).join(',')})` : '#00aa00';
    this.ctx.fillStyle = ground;
    for (let y = TOP; y <= BOTTOM; y++) {
      let start = -1;
      for (let x = LEFT; x <= RIGHT + 1; x++) {
        const solid = x <= RIGHT && g.terrain.data[y * W + x];
        if (solid && start < 0) start = x;
        if (!solid && start >= 0) {
          this.ctx.fillRect(start, y, x - start, 1);
          start = -1;
        }
      }
    }
    for (const s of g.shots) {
      if (g.options.visible && s.x > LEFT && s.x < RIGHT && s.y > TOP && s.y < BOTTOM)
        for (const [dx, dy] of [
          [0, 0],
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ])
          this.rect(
            (s.pixelX ?? Math.trunc(s.x)) + dx,
            (s.pixelY ?? Math.trunc(s.y)) + dy,
            1,
            1,
            s.color || '#fff',
          );
    }
    for (const tank of g.players) {
      const waiting =
        g.falling?.intro && g.falling.queue.slice(1).some((item) => item.player === tank.id);
      if (waiting) continue;
      if (
        tank.alive ||
        g.dyingTank?.id === tank.id ||
        g.deathQueue.some((dead) => dead.id === tank.id)
      ) {
        const falling = g.falling?.queue[0]?.player === tank.id;
        this.tank(
          tank,
          g.deathVisual?.tank?.id === tank.id ? g.deathVisual.level : tank.men,
          !falling,
        );
      }
    }
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(LEFT, TOP, RIGHT - LEFT + 1, BOTTOM - TOP + 1);
    this.ctx.clip();
    if (g.lightningVisual) {
      g.lightningVisual.forEach((x, index) => {
        this.rect(x, index + 31, 1, 1, '#ffffff');
        this.rect(x + 1, index + 31, 1, 1, '#0000ca');
        this.rect(x - 1, index + 31, 1, 1, '#0000ca');
      });
    }
    const laser = g.laserVisual;
    if (laser) {
      const color = dacColor(laser.rgb);
      for (const [x, y] of laser.path.values()) this.rect(x, y, 1, 1, color);
      for (const [x, y, id] of laser.particles)
        this.rect(x, y, 1, 1, tankColor(id, g.players[id].men));
    }
    for (const e of g.explosions) {
      if (e.kind === 'sonic') drawSonic(this, e);
      else drawBlast(this, e);
    }
    const death = g.deathVisual;
    if (death) {
      for (const [x, y, c] of death.points || [])
        this.rect(
          x,
          y,
          1,
          1,
          death.palette?.[c] ??
            (c >= 20 && c <= 29 ? tankColor(c - 20) : EGA[(c >= 200 ? c - 200 : c) % 16]),
        );
      for (const [x, y, r] of death.discs || []) this.circle(x, y, r, death.color, true);
    }
    this.ctx.restore();
    this.battleHUD(app);
    for (const shot of g.shots) {
      const x = shot.pixelX ?? Math.trunc(shot.x),
        y = shot.pixelY ?? Math.trunc(shot.y);
      if (x >= 9 && x <= 311) {
        this.rect(x, 29, 1, 1, '#ff55ff');
        this.rect(x, 191, 1, 1, '#ff55ff');
      }
      if (y >= 29 && y <= 191) {
        this.rect(9, y, 1, 1, '#ff55ff');
        this.rect(311, y, 1, 1, '#ff55ff');
      }
    }
  }
  battleHUD(app) {
    const g = app.game,
      p = g.current;
    this.rect(0, 0, 320, 28, SCREEN_COLOR);
    this.rect(0, 18, 8, 182, SCREEN_COLOR);
    this.rect(312, 18, 8, 182, SCREEN_COLOR);
    this.rect(0, 193, 320, 7, SCREEN_COLOR);
    this.text('Angle:', 8, 0, '#aa00aa', 'bios');
    this.text(Math.min(p.angle, 180 - p.angle), 56, 0, '#ffff55', 'bios');
    this.text('Power:', 8, 10, '#aa00aa', 'bios');
    this.text(p.power, 56, 10, '#ffff55', 'bios');
    this.text(
      p.name.slice(0, 12),
      161,
      0,
      tankColor(p.id, g.deathVisual?.tank?.id === p.id ? g.deathVisual.level : p.men),
      'bios',
      1,
      'center',
    );
    this.text(
      'Wind: ' + Math.abs(g.wind) + (g.wind < 0 ? ' \x1b' : ' \x1a'),
      161,
      10,
      '#5555ff',
      'bios',
      1,
      'center',
    );
    const facingLeft = g.aiAim?.owner === p.id ? g.aiAim.direction < 0 : p.angle > 90;
    this.text('Direction(' + (facingLeft ? '\x1b' : '\x1a') + ')', 216, 0, '#aa00aa', 'bios');
    this.text(facingLeft ? '\x1b' : '\x1a', 296, 0, '#ffff55', 'bios');
    this.text('Men:', 216, 10, '#aa00aa', 'bios');
    this.text(p.men, 248, 10, '#ffff55', 'bios');
    for (let i = 0; i < 20; i++) {
      const x = 10 + i * 15,
        loaded = i < 18 ? p.weapon === i : Boolean(p.armed & (1 << (i - 18))),
        have = i < 18 ? p.ammo[i] !== 0 : p.guidance[i - 18] > 0,
        c = aiIconColor(g.aiWeaponTransition, i) ?? (have ? (loaded ? '#ff0000' : '#fff') : '#000');
      this.rect(x, 18, 15, 10, SCREEN_COLOR);
      this.icon(i, x, 18, c);
      this.hit(
        x,
        18,
        15,
        10,
        'weapon:' + i,
        i < 18 ? g.weapons[i].name : i === 18 ? 'Herb guidance' : 'Vick guidance',
      );
    }
    for (let j = 0; j < 3; j++) {
      const c = j === 1 ? SCREEN_COLOR : '#ff55ff';
      this.line(8 + j, 28 + j, 312 - j, 28 + j, c);
      this.line(8 + j, 28 + j, 8 + j, 192 - j, c);
      this.line(312 - j, 28 + j, 312 - j, 192 - j, c);
      this.line(8 + j, 192 - j, 312 - j, 192 - j, c);
    }
    this.hit(8, 0, 90, 9, 'angle', 'Angle');
    this.hit(8, 10, 90, 8, 'power', 'Power');
    this.hit(215, 0, 95, 9, 'reverse', 'Reverse barrel');
    for (const t of g.players)
      if (t.alive) this.hit(t.x - 5, t.y - 10, 11, 15, 'tank:' + t.id, t.name);
  }
  score(app) {
    scoreLayout.call(this, app);
  }
  shop(app) {
    this.shopBackground(app.options.paletteSpeed);
    const p = app.game.players[app.shopPlayer],
      items = app.shopItems,
      unallocated = p.money - app.cartCost();
    this.bevel(5, 5, 314, 35);
    this.bgiText(p.name, 160, 3, p.color, 'euro', 0.5, 'center');
    this.bevel(10, 16, 59, 24);
    this.bgiText('Purchase', 11, 14, '#555');
    this.hit(10, 16, 50, 9, 'purchase', 'Purchase');
    this.bevel(284, 16, 310, 24);
    this.bgiText('Done', 285, 14, '#555');
    this.hit(284, 16, 27, 9, 'shopDone', 'Done');
    this.bgiText('YOU HAVE UNALLOCATED:', 11, 0, '#aa5500', 'tiny');
    this.bgiText('YOU CURRENTLY HAVE:', 309, 0, '#ffff55', 'tiny', 1, 'right');
    this.bgiText(unallocated + ' DOLLARS', 11, 21, '#aa5500', 'tiny');
    this.bgiText(p.money + ' DOLLARS', 309, 21, '#ffff55', 'tiny', 1, 'right');
    const visible = app.shopVisible();
    visible.forEach((i, j) => {
      const it = items[i],
        x = 5 + Math.floor(j / 9) * 104,
        y = 40 + (j % 9) * 18,
        canBuy = unallocated >= it.price,
        stock = app.shopStock(it);
      this.bevel(x, y, x + 99, y + 13);
      this.bgiText(
        it.shortName,
        x + 42,
        y + 3,
        it.kind === 'weapon' ? '#a00' : it.kind === 'guidance' ? '#55ff55' : '#5555ff',
        'litt',
        1,
        'center',
        'center',
      );
      const percent = it.kind === 'defense' && it.index < 2,
        quantity = percent ? '100%' : it.quantity;
      this.bgiText(
        quantity + ' FOR ' + it.price,
        x + 2,
        y + 13,
        '#000',
        'tiny',
        1,
        'left',
        'bottom',
      );
      if (stock > 0)
        this.bgiText(
          percent ? Math.min(100, Math.trunc(stock / (it.index === 0 ? 10 : 1))) + '%' : stock,
          x + 86,
          y + 13,
          '#ffff55',
          'tiny',
          1,
          'right',
          'bottom',
        );
      const lamp = canBuy ? '#f00' : '#000';
      this.rect(x + 58, y + 11, 3, 1, lamp);
      this.rect(x + 59, y + 10, 1, 3, lamp);
      this.bevel(x + 90, y + 3, x + 96, y + 10, '#aaa', '#555', '#fff');
      if (j === (app.shopSelection || 0)) {
        const c = canBuy ? '#55ffff' : '#000';
        this.line(x + 90, y + 3, x + 96, y + 3, c);
        this.line(x + 90, y + 3, x + 90, y + 10, c);
        this.line(x + 96, y + 3, x + 96, y + 10, c);
        this.line(x + 90, y + 10, x + 96, y + 10, c);
      }
      if (app.cart[i] > 0)
        this.bgiText(app.cart[i], x + 93, y + 4, '#aa5500', 'tiny', 1, 'center', 'center');
      this.hit(
        x,
        y,
        100,
        14,
        'shopCard:' + i,
        it.shortName + ' — ' + it.quantity + ' for ' + it.price,
      );
    });
  }
  mirv(app) {
    this.battle(app);
    this.box(70, 55, 180, 103);
    this.text('MIRV SETUP', 160, 64, '#0000aa', 'bios', 1, 'center');
    this.text('Spread', 82, 83, '#000');
    this.button(
      ['Random', 'Horizontal', 'Vertical', '+4 Way', 'X4 Way'][app.game.options.mirvSpread],
      137,
      79,
      100,
      15,
      'mirvSpread',
      { color: '#800000' },
    );
    this.text('Detonate', 82, 106, '#000');
    this.button(
      ['Impact', 'Simultaneous', 'None'][app.game.options.mirvDetonation],
      137,
      102,
      100,
      15,
      'mirvDetonation',
      { color: '#800000' },
    );
    this.button('FIRE', 122, 133, 76, 16, 'mirvFire', { color: '#800000' });
  }
  pause(app) {
    this.battle(app);
    this.box(55, 55, 210, 95);
    this.text('GAME PAUSED', 160, 64, '#0000aa', 'bios', 1, 'center');
    this.text(
      'Round ' + app.game.round + ' / ' + app.game.options.rounds,
      160,
      80,
      '#000',
      'litt',
      1,
      'center',
    );
    this.button('Continue', 75, 99, 75, 16, 'resume', { color: '#000' });
    this.button('Save', 170, 99, 75, 16, 'save', { color: '#000' });
    this.button('Main Menu', 110, 124, 100, 16, 'confirmMenu', { color: '#000' });
  }
  stats(app) {
    statsLayout.call(this, app);
  }
  render(app, time) {
    this.time = time;
    this.hits = [];
    this.rect(0, 0, W, H, '#000');
    if (app.screen === 'splash') this.splash();
    else if (app.screen === 'menu') this.menu(app);
    else if (app.screen === 'options' || app.screen === 'sound')
      this.options(app, app.screen === 'sound');
    else if (app.screen === 'roster') this.roster(app);
    else if (app.screen === 'ai') this.ai(app);
    else if (app.screen === 'battle') this.battle(app);
    else if (app.screen === 'score') this.score(app);
    else if (app.screen === 'shop') this.shop(app);
    else if (app.screen === 'mirv') this.mirv(app);
    else if (app.screen === 'pause') this.pause(app);
    else if (app.screen === 'stats') this.stats(app);
    else if (app.screen === 'boss') {
      this.rect(0, 0, 320, 200, '#000');
      this.text('Microsoft(R) MS-DOS(R)', 0, 0, '#aaa', 'bios');
      this.text('C:\\>', 0, 24, '#aaa', 'bios');
    }
    return this.hits;
  }
}
