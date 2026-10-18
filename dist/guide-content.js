// Player-facing guide to the current native web engine.
// IDs match assets/weapons.json and engine.js AI_NAMES. Prices, pack sizes,
// and blast radii belong to that catalog and should be rendered from it.
// Keep the original English equipment names in both languages so players can
// identify the same items in the DOS-style shop and toolbar.
export const guideContent = {
  en: {
    title: 'How to play Tank Wars',
    intro: [
      'Choose an angle, set your power, and take turns firing across a destructible landscape. A good shot can destroy a tank directly or remove the ground holding it up.',
      'This guide describes the current browser reconstruction. Equipment names follow Tank Wars 3.2; details that are still being checked against the DOS game are listed on the accuracy page.',
    ],
    sections: {
      basics: 'Your first battle',
      controls: 'Controls',
      weapons: 'Weapons',
      guidance: 'Guidance systems',
      defenses: 'Defenses',
      opponents: 'Computer opponents',
      strategy: 'Reading the battlefield',
      notes: 'About this guide',
    },
    basics: [
      {
        title: 'Set up the players',
        description:
          'Quick Battle starts a game immediately. For a custom match, choose the player count and number of rounds in the main menu, then open START. Choose KEYBOARD for people sharing the device, or COMPUTER and an opponent type. A match supports two to ten tanks.',
      },
      {
        title: 'Aim and fire',
        description:
          'On your turn, select a weapon and adjust angle and power. The angle changes the direction of the barrel; power changes the launch speed. Fire, watch the full result, then use the next shot to correct your aim. The controls also work with the sliders and buttons below the game.',
      },
      {
        title: 'Watch MEN and power',
        description:
          'MEN is your tank’s remaining strength. A tank starts each round with 100 MEN, and its maximum power is ten times its remaining MEN: 1000 at full strength, 500 at 50 MEN. Damage can make a previously reachable target harder to hit.',
      },
      {
        title: 'Earn points and buy supplies',
        description:
          'Enemy damage, kills, and round victories earn rewards. Between rounds, use the shop to spend your money on ammunition, guidance, or defenses. Purchases are packs, not necessarily single shots. The shop shows supplies you already own or can afford; unused stock carries into the next round. With Computers Can Buy enabled, computer opponents visit the same shop automatically, including after a lost round. Each keeps a buying strategy: stock explosives, prioritize larger bombs, favor lasers, or buy defenses.',
      },
      {
        title: 'Choose the rules',
        description:
          'Wind bends projectile paths. Walls can be absent, slow rebounds, preserve rebounds, accelerate rebounds, or wrap shots from one side to the other. Random walls are chosen for the round. Crumbling Hills controls ordinary terrain collapse, while Tanks Fall controls whether unsupported tanks drop.',
      },
    ],
    controls: [
      { keys: '← / →', action: 'Rotate the barrel one degree.' },
      { keys: '↑ / ↓', action: 'Increase or decrease power by 1.' },
      { keys: 'PgUp / PgDn', action: 'Increase or decrease power by 100.' },
      {
        keys: 'Space / Enter',
        action: 'Fire the selected weapon. MIRV first opens its spread and detonation settings.',
      },
      { keys: 'Tab / Shift+Tab', action: 'Select the next or previous weapon with ammunition.' },
      { keys: 'I', action: 'Reverse the barrel direction while keeping its elevation.' },
      {
        keys: 'H / V',
        action: 'Arm or disarm Herb’s or Vick’s guidance for the next shot, if you own it.',
      },
      {
        keys: '1–9 / 0',
        action:
          'Choose tank 1–9 or 10 as a guidance target while guidance is armed; otherwise view that tank’s statistics. You can also click a tank.',
      },
      { keys: 'Esc / Ctrl+P', action: 'Pause or resume the battle.' },
      { keys: 'Ctrl+S', action: 'Toggle sound. Use the Save button to save the game.' },
      { keys: 'F10', action: 'Show the DOS-style “boss screen”; press F10 or Space to return.' },
      { keys: 'Shop: arrows', action: 'Move between supplies.' },
      { keys: 'Shop: Space / + / right click', action: 'Add a pack to the selected order.' },
      { keys: 'Shop: − / left click', action: 'Remove a pack from the selected order.' },
      { keys: 'Shop: Enter / P', action: 'Purchase the current order and stay in the shop.' },
      { keys: 'Shop: D / Esc', action: 'Purchase the current order and leave the shop.' },
    ],
    weaponSections: [
      {
        id: 0,
        name: 'Lead Ball',
        role: 'Direct hit',
        description:
          'A plain projectile with no explosion. It deals 5 damage on a direct tank hit and does not dig a crater. It comes with your starting supplies and cannot be bought in the shop.',
        tips: [
          'Use it for inexpensive aiming practice or to finish a nearly defeated tank. A near miss has no blast damage.',
        ],
      },
      {
        id: 1,
        name: 'Incinerator',
        role: 'Standard explosive',
        description:
          'The basic shell makes a small crater and damages nearby tanks. It is sold in a large pack, making it a practical weapon for adjusting your aim over several turns.',
        tips: [
          'Watch where the shell lands before changing both angle and power. A hit beneath a tank can also remove its support.',
        ],
      },
      {
        id: 2,
        name: 'Mark II Incinerator',
        role: 'Larger explosive',
        description:
          'A larger version of the Incinerator with a wider blast and crater. It gives a close shot more room for error, but its packs contain fewer rounds.',
        tips: ['Switch to it after a basic shell lands close to the target.'],
      },
      {
        id: 3,
        name: '20 Kiloton Nuke',
        role: 'Wide blast',
        description:
          'A powerful shell that removes a broad area of terrain and threatens several nearby tanks. Blast damage is strongest near its center.',
        tips: [
          'Aim between clustered enemies, but check the distance to your own tank and teammates.',
        ],
      },
      {
        id: 4,
        name: '5 Megaton Nuke',
        role: 'Largest ordinary blast',
        description:
          'The widest conventional explosion in the arsenal. One shot can destroy a large section of a hill and trigger several falls or tank death effects.',
        tips: [
          'Keep it for a shot with a clear payoff. A close impact can be just as dangerous to you as to the target.',
        ],
      },
      {
        id: 5,
        name: 'Laser Blaster',
        role: 'Straight beam',
        description:
          'Charges and fires along the barrel direction without a ballistic arc. The beam spends energy as it travels, clears terrain along its path, and can keep damaging a tank it reaches. Laser ammunition is an energy reserve: firing requires at least 100 units in reserve, but spends the selected positive power, limited by the available reserve. Shields absorb beam damage; unshielded hits scatter colored particles.',
        tips: [
          'Aim the barrel directly along the desired line. Check the reserve before firing: a pack of laser energy is not a pack of individual shots.',
        ],
      },
      {
        id: 6,
        name: 'Chain Reaction Inducer 4/D',
        role: 'Terrain removal',
        description:
          'On a terrain hit, starts four moving reactions that eat connected dirt. They can move to neighboring dirt diagonally as well as horizontally and vertically. A direct tank hit instead deals a smaller random hit without starting the terrain reaction.',
        tips: [
          'Place it in the hill supporting an enemy. Its effect depends on connected dirt, not a circular blast radius.',
        ],
      },
      {
        id: 7,
        name: 'MIRV (5 Mark IIs inside)',
        role: 'Five bomblets',
        description:
          'Splits into five Mark II-sized bomblets as the main projectile starts descending. Before firing, choose a random, horizontal, vertical, cross, or diagonal spread. Impact detonates each bomblet when it lands; Simultaneous waits for all of them; None disables their impact explosions.',
        tips: [
          'Use a wider spread for separated targets or terrain coverage. MIRV does not use guidance systems.',
        ],
      },
      {
        id: 8,
        name: 'Chain Reaction Inducer 8/D',
        role: 'Eight terrain reactions',
        description:
          'Starts eight dirt-eating reactions on a terrain hit, with diagonal movement enabled. Like the other CRIs, it follows available dirt and can undermine a hill rather than produce a neat crater.',
        tips: [
          'More reactions explore the terrain in parallel; they do not mean a fixed larger blast radius.',
        ],
      },
      {
        id: 9,
        name: 'Chain Reaction Inducer 20/ND',
        role: 'Twenty orthogonal reactions',
        description:
          'Starts twenty reactions that move only up, down, left, or right through dirt. ND means no diagonal movement, so dirt joined only at a corner cannot be crossed directly.',
        tips: [
          'Use it on a substantial connected mass of terrain. Thin diagonal connections behave differently from the /D versions.',
        ],
      },
      {
        id: 10,
        name: 'Chain Reaction Inducer 20/D',
        role: 'Twenty diagonal-capable reactions',
        description:
          'Starts twenty terrain reactions with all eight neighboring directions available. It is the most expensive CRI pack and contains just one round; it still relies on terrain connectivity rather than radial damage.',
        tips: [
          'Target a hill that supports several enemies. Keep an eye on your own support if it belongs to the same connected terrain.',
        ],
      },
      {
        id: 11,
        name: 'Hand Grenade',
        role: 'Tiny explosive',
        description:
          'A small explosive with a very narrow crater. It is included in the starting ammunition and is not sold in the shop. A direct hit is much more useful than a distant landing.',
        tips: ['Use it when you have a precise shot or want to conserve bought ammunition.'],
      },
      {
        id: 12,
        name: 'Sonic Blaster',
        role: 'Terrain collapse',
        description:
          'Flashes at the impact point and makes the terrain collapse, even when the normal crumbling chance would not trigger. It has no ordinary blast damage or circular crater. The resulting falls are its main threat when Tanks Fall is enabled.',
        tips: [
          'Use it after other shots have left holes or unsupported ground. It can change the footing of every tank, including yours.',
        ],
      },
      {
        id: 13,
        name: 'Ball o Dirt',
        role: 'Add terrain',
        description:
          'Deposits a small round mass of dirt at the impact point instead of blowing a crater. Dirt balls bounce off tanks, so aim at the ground where you want the deposit.',
        tips: [
          'Build an obstacle in an opponent’s firing line or change the shape of a nearby slope.',
        ],
      },
      {
        id: 14,
        name: 'Ball o Dirt Mark II',
        role: 'Larger dirt deposit',
        description:
          'Adds a larger mass of dirt than the basic dirt ball. It reshapes the battlefield without applying conventional explosion damage.',
        tips: [
          'Use it where a small deposit would not block the shot path. Added terrain can also obstruct your own next shot.',
        ],
      },
      {
        id: 15,
        name: 'Ball o Compresed Dirt',
        role: 'Broad dirt deposit',
        description:
          'Creates a broad mass of new terrain at impact. The compressed-dirt name refers to the size of the deposit; this is still terrain-building ammunition.',
        tips: [
          'Aim beside or above a position you want to obstruct, rather than expecting direct blast damage.',
        ],
      },
      {
        id: 16,
        name: 'Ball o Super-Compressed Dirt',
        role: 'Largest dirt deposit',
        description:
          'Makes the largest round dirt deposit of the four dirt balls. One shot can substantially alter the available firing paths.',
        tips: [
          'Check both sides of the impact point before using it. A wall of dirt is an obstacle for everyone.',
        ],
      },
      {
        id: 17,
        name: 'Explosive Dirt',
        role: 'Scattered dirt',
        description:
          'Scatters dirt points above and around the impact rather than making a solid circular deposit. It can also trigger terrain collapse. Despite its name, it does not use the ordinary bomb’s radial damage effect.',
        tips: [
          'Use it to disrupt a terrain layout, then reassess the slopes and exposed tanks before your next shot.',
        ],
      },
    ],
    guidance: [
      {
        id: 0,
        name: "Herb's Guidance System",
        description:
          'Steers a shell horizontally toward the selected target when it passes just above the target’s height. It is a correction near the target, not a guarantee that the entire trajectory will be safe.',
        tips: [
          'Press H, then click an enemy tank or use its number to choose the target. Launch an ordinary shell on a path that passes above that tank. Each armed shot spends a guidance charge.',
        ],
      },
      {
        id: 1,
        name: "Vick's Guidance System",
        description:
          'Adjusts a shell vertically when it reaches the selected target’s horizontal position. It helps a suitable trajectory line up with the target’s column.',
        tips: [
          'Press V and choose a target before firing. Both systems can be armed together, but use them with ordinary shells: MIRV ignores guidance and the laser follows the barrel.',
        ],
      },
    ],
    defenses: [
      {
        id: 0,
        name: 'Energy Absorbtion Shield',
        description:
          'Provides a reserve that absorbs explosion and tank-death damage before it reaches MEN. The reserve is consumed by damage; it is not an invulnerability timer.',
        tips: ['Buy it to survive blast damage. It does not replace protection against falling.'],
      },
      {
        id: 1,
        name: 'Inertia Dampener',
        description:
          'Absorbs falling damage from a separate reserve. It does not stop the tank falling or protect against ordinary explosions.',
        tips: [
          'Useful on high ground, especially when enemies use CRIs or Sonic Blasters to remove support.',
        ],
      },
      {
        id: 2,
        name: 'Repulser',
        description:
          'Pushes nearby flying projectiles away from the tank and changes their trajectory. It can be lost when the tank takes damage, and it is not a shield against every weapon or effect.',
        tips: [
          'Expect shots to curve near a protected tank. A nearby terrain impact or a fall can still be dangerous.',
        ],
      },
    ],
    opponents: [
      {
        id: 0,
        name: 'Mr. Stupid',
        description:
          'Chooses a random elevation and power instead of solving a trajectory. Rebounding walls give its shots a different range of possibilities.',
        tips: [
          'A useful first opponent for learning the controls. Random aim can still produce a dangerous hit, especially with a large shell.',
        ],
      },
      {
        id: 1,
        name: 'Lobber',
        description:
          'Uses steep shots and learns from earlier landing positions and power settings. Its first shots establish a rough range; later shots adjust toward a target.',
        tips: [
          'Watch its misses: it is gathering information. A major terrain change can make its earlier landing data less useful.',
        ],
      },
      {
        id: 2,
        name: 'Rifleman',
        description:
          'Looks for a useful direct firing line and often shoots at high power. Terrain in the path affects its choice; if available, it may choose a laser for an obstructed line.',
        tips: [
          'Exposed tanks with a clear line between them are convenient targets. Hills can complicate its shot, but do not guarantee safety.',
        ],
      },
      {
        id: 3,
        name: 'Windless Wit',
        description:
          'Calculates a ballistic shot toward a chosen enemy but leaves wind out of that calculation. It tries different elevations to find a power within its current limit.',
        tips: [
          'It is more comfortable in calm conditions. Strong wind exposes the limitation behind its name.',
        ],
      },
      {
        id: 4,
        name: 'Lob & Shoot',
        description:
          'Combines two styles according to the walls: it behaves like Rifleman with rebounding walls and like Lobber when walls are absent or wrap shots.',
        tips: [
          'Check the wall setting before assuming it will use the same approach as in the previous round.',
        ],
      },
      {
        id: 5,
        name: 'Twanger',
        description:
          'With rebounding walls, aims for a shot that bounces from the top boundary toward its target. Without those walls, it falls back to the Rifleman style.',
        tips: [
          'Watch above your tank as well as directly across the terrain. An apparently high shot may be intentional.',
        ],
      },
      {
        id: 6,
        name: 'Wind Master',
        description:
          'Includes wind in its ballistic calculation and searches for a usable angle and power toward a chosen enemy. Terrain, walls, and special effects can still interfere with the result.',
        tips: [
          'Do not rely on wind alone to spoil its aim. Terrain cover and reducing its MEN can limit its options.',
        ],
      },
    ],
    strategy: [
      {
        title: 'Change one aiming variable at a time',
        description:
          'Keep the angle steady while adjusting power after a miss, or keep the power steady while changing the angle. The landing point then tells you more about what changed. Use visible trails if you want help comparing shots.',
      },
      {
        title: 'Aim at the support, too',
        description:
          'A tank on a tall column is vulnerable even if a direct hit is difficult. An explosive or CRI can remove the support; Sonic can collapse loose terrain. This plan depends on the falling and crumbling rules.',
      },
      {
        title: 'Spend for the situation',
        description:
          'A large ammunition pack is useful while learning a shot. Nukes offer a wider damage area, CRIs work on connected terrain, and defenses help preserve MEN. Buy according to the terrain and opponents rather than price alone.',
      },
      {
        title: 'Wait for the whole result',
        description:
          'An impact may lead to a fall, a tank death effect, or another explosion. The turn is not over until those effects finish. Recheck the terrain and remaining MEN before reusing your last settings.',
      },
      {
        title: 'Keep teammates out of the blast',
        description:
          'Team play changes who counts as an enemy; it does not make allies immune. Friendly kills carry a penalty, and large craters or terrain collapse can endanger several tanks at once.',
      },
    ],
    notes: [
      'Equipment prices, pack sizes, and identified blast radii are shown from the game’s extracted catalog. A missing radius means the weapon does not use a conventional circular blast or the catalog does not specify one.',
      'The original equipment names and their spelling are retained so this guide matches the game. This is an independent browser reconstruction, not an official release by Kenneth Morse.',
    ],
  },
  ru: {
    title: 'Как играть в Tank Wars',
    intro: [
      'Выберите угол, задайте мощность и по очереди стреляйте через разрушаемый ландшафт. Удачный выстрел может уничтожить танк напрямую или убрать землю, на которой он стоит.',
      'Этот справочник описывает текущую браузерную реконструкцию. Названия вооружений взяты из Tank Wars 3.2; детали, которые ещё сверяются с DOS-игрой, перечислены на странице точности.',
    ],
    sections: {
      basics: 'Первый бой',
      controls: 'Управление',
      weapons: 'Оружие',
      guidance: 'Системы наведения',
      defenses: 'Защита',
      opponents: 'Компьютерные противники',
      strategy: 'Как оценить обстановку',
      notes: 'О справочнике',
    },
    basics: [
      {
        title: 'Настройте игроков',
        description:
          '«Быстрый бой» сразу запускает игру. Для своей партии выберите число игроков и раундов в главном меню, затем откройте START. KEYBOARD — человек за этим устройством, COMPUTER — компьютер выбранного типа. В партии могут участвовать от двух до десяти танков.',
      },
      {
        title: 'Прицельтесь и выстрелите',
        description:
          'На своём ходу выберите оружие, угол и мощность. Угол задаёт направление ствола, мощность — начальную скорость снаряда. Выстрелите, дождитесь результата и скорректируйте следующий выстрел. Под экраном есть ползунки и кнопки для управления мышью или касанием.',
      },
      {
        title: 'Следите за MEN и мощностью',
        description:
          'MEN — оставшаяся сила танка. Каждый раунд начинается со 100 MEN, а предел мощности равен десятикратному значению MEN: 1000 при полной силе, 500 при 50 MEN. После повреждений добраться до прежней цели может стать труднее.',
      },
      {
        title: 'Зарабатывайте и покупайте припасы',
        description:
          'За урон врагам, уничтожения и победы в раундах выдаются награды. Между раундами в магазине можно потратить деньги на боеприпасы, наведение и защиту. Товары продаются комплектами, не обязательно по одному выстрелу. Магазин показывает то, что уже есть у вас или доступно по цене; неизрасходованный запас переходит в следующий раунд. При включённом Computers Can Buy компьютерные соперники автоматически посещают тот же магазин, в том числе после проигранного раунда. Каждый сохраняет стратегию закупок: запас взрывчатки, крупные бомбы, лазеры или защита.',
      },
      {
        title: 'Выберите правила',
        description:
          'Ветер отклоняет снаряды. Стены могут отсутствовать, замедлять отскок, сохранять его скорость, ускорять снаряд или переносить его с одного края на другой. Случайный тип стен выбирается на раунд. Crumbling Hills задаёт обычную вероятность осыпания земли, а Tanks Fall — падают ли танки без опоры.',
      },
    ],
    controls: [
      { keys: '← / →', action: 'Повернуть ствол на один градус.' },
      { keys: '↑ / ↓', action: 'Прибавить или убавить 1 единицу мощности.' },
      { keys: 'PgUp / PgDn', action: 'Прибавить или убавить 100 единиц мощности.' },
      {
        keys: 'Space / Enter',
        action:
          'Выстрелить выбранным оружием. Для MIRV сначала открываются настройки разлёта и детонации.',
      },
      {
        keys: 'Tab / Shift+Tab',
        action: 'Выбрать следующее или предыдущее оружие с боеприпасами.',
      },
      { keys: 'I', action: 'Развернуть ствол в другую сторону, сохранив угол возвышения.' },
      {
        keys: 'H / V',
        action:
          'Включить или отключить наведение Herb или Vick для следующего выстрела, если оно есть в запасе.',
      },
      {
        keys: '1–9 / 0',
        action:
          'При включённом наведении выбрать целью танк 1–9 или 10; иначе — открыть его статистику. Также можно щёлкнуть по танку.',
      },
      { keys: 'Esc / Ctrl+P', action: 'Поставить бой на паузу или продолжить его.' },
      {
        keys: 'Ctrl+S',
        action: 'Переключить звук. Для сохранения игры используйте кнопку «Сохранить».',
      },
      {
        keys: 'F10',
        action: 'Открыть DOS-экран «начальник идёт»; F10 или пробел возвращает в игру.',
      },
      { keys: 'Магазин: стрелки', action: 'Перейти к другому товару.' },
      { keys: 'Магазин: Space / + / ПКМ', action: 'Добавить комплект выбранного товара в заказ.' },
      { keys: 'Магазин: − / ЛКМ', action: 'Убрать комплект выбранного товара из заказа.' },
      { keys: 'Магазин: Enter / P', action: 'Купить заказ и остаться в магазине.' },
      { keys: 'Магазин: D / Esc', action: 'Купить заказ и выйти из магазина.' },
    ],
    weaponSections: [
      {
        id: 0,
        name: 'Lead Ball',
        role: 'Прямое попадание',
        description:
          'Обычный снаряд без взрыва. При прямом попадании в танк наносит 5 урона и не оставляет воронку. Входит в начальный запас, в магазине не продаётся.',
        tips: [
          'Подходит для пристрелки или добивания почти уничтоженного танка. Близкий промах не наносит урон взрывом.',
        ],
      },
      {
        id: 1,
        name: 'Incinerator',
        role: 'Базовый взрывной снаряд',
        description:
          'Делает небольшую воронку и повреждает танки рядом с местом взрыва. Продаётся большим комплектом, поэтому подходит для нескольких последовательных попыток пристреляться.',
        tips: [
          'Посмотрите, куда упал снаряд, прежде чем менять сразу угол и мощность. Взрыв под танком может лишить его опоры.',
        ],
      },
      {
        id: 2,
        name: 'Mark II Incinerator',
        role: 'Усиленный взрывной снаряд',
        description:
          'Увеличенная версия Incinerator с более широкими взрывом и воронкой. Прощает небольшую ошибку прицеливания, но в комплекте меньше боеприпасов.',
        tips: ['Переходите на него, когда базовый снаряд уже ложится рядом с целью.'],
      },
      {
        id: 3,
        name: '20 Kiloton Nuke',
        role: 'Широкая зона взрыва',
        description:
          'Мощный снаряд, который удаляет большой участок земли и угрожает нескольким танкам рядом. Ближе к центру взрыва урон сильнее.',
        tips: [
          'Цельтесь между близко стоящими врагами, но проверьте расстояние до себя и союзников.',
        ],
      },
      {
        id: 4,
        name: '5 Megaton Nuke',
        role: 'Самый большой обычный взрыв',
        description:
          'Самый широкий обычный взрыв в арсенале. Один выстрел может снести значительную часть холма и вызвать несколько падений или анимаций гибели танков.',
        tips: [
          'Берегите его для выстрела с понятной выгодой. Близкий взрыв опасен и для стреляющего.',
        ],
      },
      {
        id: 5,
        name: 'Laser Blaster',
        role: 'Прямой луч',
        description:
          'Заряжается и стреляет по направлению ствола без баллистической дуги. Луч расходует энергию при движении, расчищает землю на пути и может продолжать повреждать достигнутый танк. Боезапас лазера — запас энергии: для выстрела нужно иметь хотя бы 100 единиц, но расход равен выбранной положительной мощности и ограничен остатком запаса. Щит поглощает урон луча; попадание в незащищённый танк разбрасывает цветные частицы.',
        tips: [
          'Направляйте ствол прямо по нужной линии. Комплект энергии лазера — не такое же число отдельных выстрелов.',
        ],
      },
      {
        id: 6,
        name: 'Chain Reaction Inducer 4/D',
        role: 'Разрушение земли',
        description:
          'При попадании в грунт запускает четыре движущиеся реакции, которые поглощают связанную землю. Они могут переходить к соседнему грунту по диагонали, горизонтали и вертикали. Прямое попадание в танк вместо этого наносит меньший случайный урон без реакции в земле.',
        tips: [
          'Попадите в холм, на котором стоит враг. Эффект зависит от связности грунта, а не от круглого радиуса взрыва.',
        ],
      },
      {
        id: 7,
        name: 'MIRV (5 Mark IIs inside)',
        role: 'Пять суббоеприпасов',
        description:
          'Когда основной снаряд начинает снижаться, он разделяется на пять боеприпасов с взрывами размера Mark II. Перед выстрелом выбирается случайный, горизонтальный, вертикальный, крестообразный или диагональный разлёт. Impact взрывает каждый при падении, Simultaneous ждёт падения всех, None отключает их взрывы при попадании.',
        tips: [
          'Широкий разлёт полезен против разнесённых целей и для охвата земли. MIRV не использует системы наведения.',
        ],
      },
      {
        id: 8,
        name: 'Chain Reaction Inducer 8/D',
        role: 'Восемь реакций в грунте',
        description:
          'При попадании в землю запускает восемь реакций с возможностью двигаться по диагонали. Как и другие CRI, они следуют по доступному грунту и подкапывают холм вместо создания ровной воронки.',
        tips: [
          'Большее число реакций означает несколько направлений разрушения одновременно, а не фиксированный больший радиус взрыва.',
        ],
      },
      {
        id: 9,
        name: 'Chain Reaction Inducer 20/ND',
        role: 'Двадцать реакций без диагоналей',
        description:
          'Запускает двадцать реакций, движущихся по земле только вверх, вниз, влево и вправо. ND означает отсутствие диагональных переходов: грунт, соприкасающийся лишь углами, напрямую пересечь нельзя.',
        tips: [
          'Используйте на большом связанном массиве земли. Узкие диагональные соединения работают иначе, чем у вариантов /D.',
        ],
      },
      {
        id: 10,
        name: 'Chain Reaction Inducer 20/D',
        role: 'Двадцать реакций с диагоналями',
        description:
          'Запускает двадцать реакций со всеми восемью направлениями перехода к соседнему грунту. Это самый дорогой комплект CRI, содержащий один снаряд; его действие всё равно зависит от связности земли, а не от радиального урона.',
        tips: [
          'Цельтесь в холм под несколькими врагами. Если ваша опора связана с ним тем же грунтом, следите и за ней.',
        ],
      },
      {
        id: 11,
        name: 'Hand Grenade',
        role: 'Маленький взрыв',
        description:
          'Небольшой взрывной боеприпас с очень узкой воронкой. Входит в начальный запас и не продаётся в магазине. Прямое попадание гораздо полезнее падения вдали от танка.',
        tips: ['Используйте для точного выстрела или чтобы сберечь купленные боеприпасы.'],
      },
      {
        id: 12,
        name: 'Sonic Blaster',
        role: 'Обрушение грунта',
        description:
          'Мигает в точке попадания и вызывает осыпание земли, даже если обычная проверка вероятности его не вызвала бы. Не наносит обычный урон взрывом и не делает круглую воронку. Главная опасность — последующие падения, если включён Tanks Fall.',
        tips: [
          'Полезен после выстрелов, оставивших пустоты и грунт без опоры. Может изменить положение всех танков, включая ваш.',
        ],
      },
      {
        id: 13,
        name: 'Ball o Dirt',
        role: 'Добавление земли',
        description:
          'Вместо воронки добавляет небольшой круглый массив грунта в точке попадания. Шары земли отскакивают от танков, поэтому цельтесь в место, где нужен новый грунт.',
        tips: ['Создайте помеху на линии огня противника или измените форму ближайшего склона.'],
      },
      {
        id: 14,
        name: 'Ball o Dirt Mark II',
        role: 'Увеличенный шар земли',
        description:
          'Добавляет больше земли, чем базовый шар. Меняет ландшафт без обычного урона взрывом.',
        tips: [
          'Подходит, когда небольшого объёма земли недостаточно для перекрытия линии огня. Новый грунт может помешать и вашему следующему выстрелу.',
        ],
      },
      {
        id: 15,
        name: 'Ball o Compresed Dirt',
        role: 'Большой массив земли',
        description:
          'Создаёт большой массив нового грунта в точке попадания. Название «сжатая земля» относится к размеру добавляемого объёма: это по-прежнему боеприпас для изменения местности.',
        tips: [
          'Цельтесь рядом с позицией, которую хотите загородить, или над ней, не рассчитывая на прямой урон взрывом.',
        ],
      },
      {
        id: 16,
        name: 'Ball o Super-Compressed Dirt',
        role: 'Самый большой шар земли',
        description:
          'Добавляет самый большой круглый массив грунта из четырёх шаров земли. Один выстрел может значительно изменить доступные линии огня.',
        tips: ['Проверьте обе стороны от места попадания. Земляная преграда мешает всем.'],
      },
      {
        id: 17,
        name: 'Explosive Dirt',
        role: 'Россыпь земли',
        description:
          'Разбрасывает точки грунта над местом попадания и вокруг него вместо сплошного круглого массива. Также может вызвать осыпание земли. Несмотря на название, не использует радиальный урон обычной бомбы.',
        tips: [
          'Используйте для изменения рельефа, затем перед следующим выстрелом заново оцените склоны и открытые танки.',
        ],
      },
    ],
    guidance: [
      {
        id: 0,
        name: "Herb's Guidance System",
        description:
          'Направляет снаряд по горизонтали к выбранному танку, когда тот проходит чуть выше высоты цели. Это коррекция рядом с целью, а не гарантия безопасного пути на всей траектории.',
        tips: [
          'Нажмите H, затем щёлкните по врагу или выберите его номер. Запускайте обычный снаряд так, чтобы он прошёл над целью. Выстрел с включённым наведением расходует заряд системы.',
        ],
      },
      {
        id: 1,
        name: "Vick's Guidance System",
        description:
          'Корректирует снаряд по вертикали, когда он достигает горизонтальной позиции выбранного танка. Помогает подходящей траектории попасть на вертикаль цели.',
        tips: [
          'Нажмите V и выберите цель до выстрела. Можно включить обе системы сразу, но используйте их с обычными снарядами: MIRV игнорирует наведение, а лазер идёт по направлению ствола.',
        ],
      },
    ],
    defenses: [
      {
        id: 0,
        name: 'Energy Absorbtion Shield',
        description:
          'Даёт запас защиты, который поглощает урон от взрывов и гибели танков до уменьшения MEN. Запас расходуется от повреждений; это не временная неуязвимость.',
        tips: ['Покупайте для защиты от взрывов. Он не заменяет защиту от падения.'],
      },
      {
        id: 1,
        name: 'Inertia Dampener',
        description:
          'Поглощает урон от падений из отдельного запаса защиты. Не останавливает само падение танка и не защищает от обычных взрывов.',
        tips: [
          'Полезен на возвышенностях, особенно против CRI и Sonic Blaster, способных лишить танк опоры.',
        ],
      },
      {
        id: 2,
        name: 'Repulser',
        description:
          'Отталкивает пролетающие рядом снаряды и меняет их траекторию. Может быть потерян при получении урона; это не защита от любого оружия и любого эффекта.',
        tips: [
          'Учитывайте искривление траектории рядом с защищённым танком. Взрыв в грунте поблизости или падение всё равно опасны.',
        ],
      },
    ],
    opponents: [
      {
        id: 0,
        name: 'Mr. Stupid',
        description:
          'Выбирает случайные угол и мощность вместо расчёта траектории. Стены с отскоками меняют возможности его выстрелов.',
        tips: [
          'Подходит для знакомства с управлением. Случайное прицеливание тоже может дать опасное попадание, особенно крупным снарядом.',
        ],
      },
      {
        id: 1,
        name: 'Lobber',
        description:
          'Стреляет по крутой дуге и использует предыдущие места падения и значения мощности. Первые выстрелы дают приблизительную дальность, следующие корректируются в сторону цели.',
        tips: [
          'Следите за промахами: он собирает данные. Сильное изменение рельефа может сделать прошлые попадания менее полезными для прицеливания.',
        ],
      },
      {
        id: 2,
        name: 'Rifleman',
        description:
          'Ищет подходящую прямую линию огня и часто стреляет с большой мощностью. Земля на пути влияет на выбор; если есть лазер, может использовать его для затруднённой линии.',
        tips: [
          'Открытые танки с прямой видимостью удобны ему как цели. Холм осложняет выстрел, но не гарантирует безопасность.',
        ],
      },
      {
        id: 3,
        name: 'Windless Wit',
        description:
          'Рассчитывает баллистический выстрел по выбранному врагу, но не учитывает ветер. Пробует разные углы, чтобы подобрать мощность в пределах текущего лимита.',
        tips: [
          'Ему удобнее в штиль. Сильный ветер проявляет ограничение, заложенное в его названии.',
        ],
      },
      {
        id: 4,
        name: 'Lob & Shoot',
        description:
          'Объединяет два стиля в зависимости от стен: при стенах с отскоком действует как Rifleman, при отсутствии стен или переносе с края на край — как Lobber.',
        tips: ['Проверьте тип стен, прежде чем ожидать ту же тактику, что в прошлом раунде.'],
      },
      {
        id: 5,
        name: 'Twanger',
        description:
          'При стенах с отскоком целится с расчётом на отражение от верхней границы в сторону цели. Без таких стен переходит к стилю Rifleman.',
        tips: [
          'Следите не только за прямой линией через холмы, но и за пространством сверху. Очень высокий выстрел может быть намеренным.',
        ],
      },
      {
        id: 6,
        name: 'Wind Master',
        description:
          'Учитывает ветер в баллистическом расчёте и ищет подходящие угол и мощность для выбранного врага. Земля, стены и специальные эффекты всё ещё могут помешать результату.',
        tips: [
          'Не рассчитывайте, что один ветер испортит ему прицел. Укрытия и уменьшение его MEN могут ограничить варианты выстрела.',
        ],
      },
    ],
    strategy: [
      {
        title: 'Меняйте один параметр прицеливания за раз',
        description:
          'После промаха оставьте угол прежним и измените мощность либо сохраните мощность и измените угол. Так точка падения понятнее покажет результат изменения. Для сравнения выстрелов можно включить видимые следы.',
      },
      {
        title: 'Цельтесь и в опору',
        description:
          'Танк на высокой колонне уязвим, даже если прямое попадание затруднено. Взрыв или CRI могут убрать опору, Sonic — обрушить землю. Такая тактика зависит от настроек падения и осыпания.',
      },
      {
        title: 'Покупайте под ситуацию',
        description:
          'Большой комплект снарядов полезен для пристрелки. Ядерные боеприпасы расширяют зону поражения, CRI работают со связанным грунтом, защита помогает сохранить MEN. Выбирайте покупки под ландшафт и противников, а не только по цене.',
      },
      {
        title: 'Дождитесь полного результата',
        description:
          'После попадания возможны падение, эффект гибели танка или ещё один взрыв. Ход не закончен, пока цепочка не завершилась. Перед повторением прежних настроек проверьте новый рельеф и оставшиеся MEN.',
      },
      {
        title: 'Берегите союзников от взрыва',
        description:
          'Командная игра меняет состав врагов, но не делает союзников неуязвимыми. За уничтожение своего предусмотрен штраф, а большая воронка или обрушение могут затронуть несколько танков сразу.',
      },
    ],
    notes: [
      'Цены, размеры комплектов и установленные радиусы взрывов берутся из извлечённого каталога игры. Отсутствие радиуса означает, что оружие не использует обычный круглый взрыв или в каталоге нет такого значения.',
      'Названия вооружений и их исходное написание сохранены, чтобы справочник совпадал с игрой. Это независимая браузерная реконструкция, а не официальный выпуск Kenneth Morse.',
    ],
  },
};
