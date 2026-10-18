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
        ],
        paragraphs: [
          'These checks cover specific reference states. They do not establish complete equivalence for every possible screen, shot or animation.',
        ],
      },
      {
        title: 'Animation and sound',
        paragraphs: [
          'Ordinary explosions use the original ellipse raster and three red palette passes. Sonic uses a flashing five-pixel cross and changing ground colors. Explosive tank death includes brightness pulses and successive blasts. Tank colors dim with MEN; nine backgrounds have been reconstructed.',
          'Audio uses one synthesized PC Speaker channel with recovered frequencies, PIT divisors and explicit delays. Tight loops without Delay still use estimated timing; physical speaker timbre and full audiovisual synchronization have not been verified as identical.',
        ],
      },
      {
        title: 'Known differences and unfinished checks',
        items: [
          'JavaScript floating-point calculations differ from Pascal Real. RNG call order and edge collisions still need more comparison.',
          'Some death flashes read arbitrary bytes from low DOS memory. Those flashes, CPU-dependent loops, laser timing, burial and anti-stalemate lightning are not fully reproduced.',
          'Dirt-circle rasterization, some dialogs and transitions, and AI edge cases remain under review.',
          'Computer purchasing and parts of Twanger and Lobber behavior remain approximate.',
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
        ],
        paragraphs: [
          'Эти проверки подтверждают конкретные эталонные состояния. Они не доказывают полное совпадение каждого возможного экрана, выстрела или анимации.',
        ],
      },
      {
        title: 'Анимация и звук',
        paragraphs: [
          'Обычные взрывы используют исходную растеризацию эллипса и три прохода красной палитры. Sonic — мигающий крест из пяти пикселей и смена цвета земли. Взрывная смерть танка включает пульсацию яркости и последовательные взрывы. Цвет танков темнеет с уменьшением MEN; восстановлены девять фонов.',
          'Звук синтезируется одним каналом PC Speaker с восстановленными частотами, делителями PIT и явными задержками. Быстрые циклы без Delay пока используют оценочную длительность; тембр физического динамика и полная синхронизация звука с изображением не подтверждены как идентичные.',
        ],
      },
      {
        title: 'Известные отличия и незавершённые проверки',
        items: [
          'Вычисления JavaScript отличаются от Pascal Real. Порядок вызовов RNG и граничные столкновения требуют дальнейшей сверки.',
          'Некоторые вспышки смерти читают случайные байты из низкой DOS-памяти. Эти вспышки, CPU-зависимые циклы, темп лазера, засыпание и антизатяжная молния воспроизведены не полностью.',
          'Окружности земляного оружия, отдельные диалоги и переходы, крайние случаи AI ещё проверяются.',
          'Покупки компьютеров и часть поведения Twanger и Lobber остаются приближёнными.',
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
