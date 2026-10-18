import { initLanguage, getLanguage } from './i18n.js';
import { element, textList } from './document-ui.js';

const content = {
  en: {
    title: 'What matches the original?',
    intro:
      'Tank Wars Native Web is an independent JavaScript reconstruction of Tank Wars 3.2 by Kenneth Morse (1992). It runs a new simulation and draws through Canvas; it does not run the DOS executable.',
    sections: [
      {
        title: 'Recovered from the original',
        paragraphs: [
          'Title artwork and palettes, three vector BGI fonts, equipment names, prices and quantities. Physics, damage, wall behavior, random numbers, wind and AI have been translated from procedures in BOMB.EXE and BOMB.OVR.',
        ],
      },
      {
        title: 'Verified against reference data',
        items: [
          'All 20 weapon icons: 3,000 of 3,000 pixels match.',
          'The 21-card shop reference: 64,000 of 64,000 pixels match.',
          'Five menu, setup and results screens: 64,000 pixels each, with only the animated background palette phase normalized.',
          'Battle HUD: all 8,960 pixels in the reference crop match.',
          'Explosion outlines: 177 rasters match execution of the original instructions, including radii 0–170.',
          'MIRV: 106 original-code cases covering integration, spreads, collision order, walls and subdivisions. Dirt: 61 BGI circle hashes, 12 full or clipped disks, and 8,779 Explosive Dirt coordinates with sound and RNG checks.',
          'Laser walls: 70 reference cases. Runtime gun trigonometry: all 181 integer angles. Lightning: 3,339 center coordinates across 21 paths, with RNG and sound-call checks.',
        ],
        paragraphs: [
          'These checks cover specific reference states. They do not establish complete equivalence for every possible screen, shot or animation.',
        ],
      },
      {
        title: 'Animation and sound',
        paragraphs: [
          'Ordinary explosions use the original ellipse raster and three red palette passes. Sonic uses a flashing five-pixel cross and changing ground colors. Explosive tank death includes brightness pulses and successive blasts. Tank colors dim with MEN; nine backgrounds have been reconstructed.',
          'Terrain descends through the original one-pixel active-list passes. Tanks land on the unmodified landscape, can slide after losing support, and lose MEN or inertia reserve at every falling step. Initial gun angles and visible computer shopping have been restored. Ground animation and automatic shopping use explicit browser pacing because the DOS loops had no fixed delay.',
          'Ordinary shells have a five-pixel cross, guidance and bounce colors, dim trails that persist between shots and saves, and border position markers. New dirt can cover a trail; clearing it reveals the trail again. Laser charging, yellow beam fading, shield damage and hit particles follow recovered procedures. Lightning begins after ten full turn cycles, with original path generation, terrain cuts and a final blast.',
          'Computer opponents visibly cycle available weapons, turn, adjust power in 100/10/1 steps and aim one degree at a time before firing. Command selection matches 234 executions of the original routine. Browser control and icon-fade pacing is explicit because the DOS timing depended on CPU speed and sound settings.',
          'Audio uses one synthesized PC Speaker channel with recovered frequencies, PIT divisors and explicit delays. Tight loops without Delay still use estimated timing; physical speaker timbre and full audiovisual synchronization have not been verified as identical.',
        ],
      },
      {
        title: 'Known differences and unfinished checks',
        items: [
          'JavaScript floating-point calculations differ from Pascal Real. RNG call order and edge collisions still need more comparison.',
          'Some death flashes read arbitrary bytes from low DOS memory. Those flashes, CPU-dependent timing and burial remain incomplete. Lightning sweeps use explicit browser pacing and clip to the field; victory is checked before another strike to avoid the original endless-strike edge case.',
          'High-power ordinary projectile subdivisions and overlapping tank/projectile framebuffer writes still need further reference checks. MIRV flight and dirt drawing use explicit browser pacing for original loops without Delay; Pascal Real boundary rounding can differ from JavaScript.',
          'Some dialogs and transitions, and AI edge cases remain under review.',
          'Parts of Twanger and Lobber aiming remain approximate. Computer shopping now uses the original four persistent strategies; rejected full-cart purchases end the visit instead of reproducing a DOS no-progress loop.',
          'Custom RAW backgrounds, DOS save import and network multiplayer are not implemented.',
        ],
        paragraphs: [
          'Browser saves stay in localStorage for the current site address. English/Russian localization applies to the web interface and documentation; the original game screen retains its English lettering.',
        ],
      },
      {
        title: 'Reproducible research',
        paragraphs: [
          'The public repository includes executable offsets, research notes, extraction tools, tests and reference hashes. Original executables and installations are not included. The 8×8 bitmap font was captured from the reference DOSBox BIOS; extracted resources retain their own provenance and are not relicensed by the project’s MIT license.',
        ],
      },
    ],
    hashLabel: 'SHA-256 of the researched BOMB.EXE:',
  },
  ru: {
    title: 'Что совпадает с оригиналом?',
    intro:
      'Tank Wars Native Web — независимая JavaScript-реконструкция Tank Wars 3.2, Kenneth Morse (1992). Игра использует новую симуляцию и Canvas; оригинальный DOS-файл не исполняется.',
    sections: [
      {
        title: 'Восстановлено из оригинала',
        paragraphs: [
          'Заставки и палитры, три векторных BGI-шрифта, названия, цены и количества боеприпасов. Физика, урон, стены, генератор случайных чисел, ветер и AI переведены из процедур BOMB.EXE и BOMB.OVR.',
        ],
      },
      {
        title: 'Проверено по эталонным данным',
        items: [
          'Все 20 иконок оружия: совпали 3000 из 3000 пикселей.',
          'Контрольный кадр магазина с 21 карточкой: совпали 64000 из 64000 пикселей.',
          'Пять экранов меню, настройки и результатов: по 64000 пикселей; нормализована только фаза анимированной фоновой палитры.',
          'Верхняя панель боя: совпали все 8960 пикселей эталонного фрагмента.',
          'Контуры взрывов: 177 растров совпали с исполнением оригинальных инструкций, включая радиусы 0–170.',
          'MIRV: 106 исполнений исходного кода — движение, разлёт, порядок столкновений, стены и подшаги. Земляное оружие: 61 хеш BGI-круга, 12 полных или обрезанных насыпей и 8779 координат Explosive Dirt с проверкой звука и RNG.',
          'Стены для лазера: 70 эталонных случаев. Тригонометрия пушек: все 181 целочисленный угол. Молнии: 3339 центральных координат на 21 траектории, с проверкой вызовов RNG и звука.',
        ],
        paragraphs: [
          'Эти проверки подтверждают конкретные эталонные состояния. Они не доказывают полное совпадение каждого возможного экрана, выстрела или анимации.',
        ],
      },
      {
        title: 'Анимация и звук',
        paragraphs: [
          'Обычные взрывы используют исходную растеризацию эллипса и три прохода красной палитры. Sonic — мигающий крест из пяти пикселей и смена цвета земли. Взрывная смерть танка включает пульсацию яркости и последовательные взрывы. Цвет танков темнеет с уменьшением MEN; восстановлены девять фонов.',
          'Грунт осыпается однопиксельными проходами по исходному активному списку. Танки садятся на неизменённый рельеф, соскальзывают после потери опоры и теряют MEN или запас инерционной защиты на каждом шаге падения. Восстановлены начальные углы пушек и видимый магазин компьютера. Темп осыпания и закупок задан для браузера: в DOS эти циклы не имели фиксированной задержки.',
          'Обычные снаряды рисуются крестом из пяти пикселей, меняют цвет при наведении и отскоке, оставляют тёмные следы, сохраняющиеся между выстрелами и при загрузке игры, и метки положения на рамке. Новая земля закрывает след; удаление земли снова открывает его. Зарядка лазера, затухание жёлтого луча, урон щиту и частицы попадания восстановлены по коду. Молнии появляются после десяти полных кругов ходов: восстановлены генерация пути, прорезание грунта и завершающий взрыв.',
          'Компьютер видимо перебирает доступное оружие, разворачивается, меняет мощность шагами 100/10/1 и доводит угол по одному градусу перед выстрелом. Выбор команд совпал с 234 исполнениями оригинальной процедуры. Темп команд и переливания иконок задан для браузера: в DOS он зависел от CPU и включённого звука.',
          'Звук синтезируется одним каналом PC Speaker с восстановленными частотами, делителями PIT и явными задержками. Быстрые циклы без Delay пока используют оценочную длительность; тембр физического динамика и полная синхронизация звука с изображением не подтверждены как идентичные.',
        ],
      },
      {
        title: 'Известные отличия и незавершённые проверки',
        items: [
          'Вычисления JavaScript отличаются от Pascal Real. Порядок вызовов RNG и граничные столкновения требуют дальнейшей сверки.',
          'Некоторые вспышки смерти читают случайные байты из низкой DOS-памяти. Эти вспышки, CPU-зависимый темп и засыпание ещё воспроизведены не полностью. Для молний задан браузерный темп и отсечение по полю; победа проверяется перед новым ударом, чтобы избежать исходного зацикливания молний.',
          'Подшаги мощных обычных снарядов и перекрывающиеся записи танков и снарядов в видеопамять требуют дальнейшей сверки. Темп полёта MIRV и рисования земли задан для браузера: исходные циклы не содержат Delay. Округление Pascal Real на границах пикселей может отличаться от JavaScript.',
          'Отдельные диалоги и переходы, крайние случаи AI ещё проверяются.',
          'Часть прицеливания Twanger и Lobber остаётся приближённой. Закупки используют четыре постоянные стратегии оригинала; при невозможности добавить товар компьютер завершает покупки вместо воспроизведения зацикливания DOS.',
          'Пользовательские RAW-фоны, импорт DOS-сохранений и сетевой мультиплеер не реализованы.',
        ],
        paragraphs: [
          'Сохранения остаются в localStorage браузера для текущего адреса сайта. Переключатель En/Ru переводит веб-интерфейс и документацию; надписи оригинального игрового экрана остаются на английском.',
        ],
      },
      {
        title: 'Воспроизводимое исследование',
        paragraphs: [
          'Публичный репозиторий содержит адреса процедур, исследовательские записи, инструменты извлечения, тесты и эталонные хеши. Оригинальные исполняемые файлы и установка игры не включены. Шрифт 8×8 получен из BIOS эталонного DOSBox; извлечённые ресурсы сохраняют своё происхождение и не перелицензируются MIT-лицензией проекта.',
        ],
      },
    ],
    hashLabel: 'SHA-256 исследованного BOMB.EXE:',
  },
};

function renderAccuracy() {
  const page = content[getLanguage()];
  const article = document.getElementById('accuracy-content');
  article.replaceChildren(element('h1', page.title), element('p', page.intro));
  for (const section of page.sections) {
    article.append(element('h2', section.title));
    section.paragraphs?.forEach((paragraph) => article.append(element('p', paragraph)));
    if (section.items) article.append(textList(section.items));
  }
  article.append(
    element('p', page.hashLabel),
    element('code', '659ace6b9a97c30191a8f65cf25f22322c087166909e9fa1d522e529adbafd9d'),
  );
}
initLanguage();
renderAccuracy();
window.addEventListener('languagechange', renderAccuracy);
