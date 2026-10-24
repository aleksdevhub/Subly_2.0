// =========================================================
//  Светлая / тёмная тема.
//  Файл подключается в <head>, чтобы тема применилась до отрисовки
//  страницы и не было «вспышки» белого фона.
// =========================================================

const Theme = (() => {
  const KEY = 'subly-theme';
  const root = document.documentElement;

  function saved() {
    try { return localStorage.getItem(KEY); } catch { return null; }
  }

  // При первом визите берём тему из настроек системы
  // При первом запуске берём тему из Telegram (или из настроек системы, если открыто в браузере)
  const tg = window.Telegram && window.Telegram.WebApp;
  const tgScheme = tg && tg.initData ? tg.colorScheme : null;
  const initial = saved() || tgScheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.dataset.theme = initial;

  function current() { return root.dataset.theme; }

  function apply(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch { /* приватный режим — просто не запоминаем */ }
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
      b.setAttribute('aria-pressed', theme === 'dark');
      b.title = theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
    });
  }

  /**
   * Переключает тему с анимацией: новая тема расходится кругом
   * от точки (x, y) — места клика. Если браузер не умеет
   * View Transitions, цвета просто плавно меняются.
   */
  function toggle(x = innerWidth / 2, y = innerHeight / 2) {
    const next = current() === 'dark' ? 'light' : 'dark';
    const noMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (noMotion) { apply(next); return; }

    if (!document.startViewTransition) {
      root.classList.add('theme-fade');
      apply(next);
      setTimeout(() => root.classList.remove('theme-fade'), 500);
      return;
    }

    // Радиус круга — до самого дальнего угла экрана
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(() => apply(next));
    transition.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.65, 0, .35, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    });
  }

  // Подключаем все кнопки с атрибутом data-theme-toggle
  document.addEventListener('DOMContentLoaded', () => {
    apply(current());
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const rect = btn.getBoundingClientRect();
        // Центр кнопки (клик с клавиатуры не даёт координат)
        const x = e.clientX || rect.left + rect.width / 2;
        const y = e.clientY || rect.top + rect.height / 2;
        toggle(x, y);
      });
    });
  });

  return { current, toggle };
})();
