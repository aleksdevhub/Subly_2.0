// =========================================================
//  Связь с Telegram: разворачиваем приложение на весь экран,
//  красим шапку Telegram в цвета сайта и добавляем лёгкую вибрацию.
//  Вне Telegram (в обычном браузере) этот файл ничего не делает.
// =========================================================

(() => {
  const TG = window.Telegram && window.Telegram.WebApp;
  if (!TG || !TG.initData) return;

  document.documentElement.classList.add('in-telegram');
  TG.ready();
  TG.expand();

  // Шапка и фон Telegram — в цвет текущей темы сайта
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  function paint() {
    try {
      if (TG.isVersionAtLeast('6.1')) {
        TG.setHeaderColor(css('--bg-surface'));
        TG.setBackgroundColor(css('--bg-canvas'));
      }
      if (TG.isVersionAtLeast('7.10')) TG.setBottomBarColor(css('--bg-surface'));
    } catch { /* старый клиент Telegram */ }
  }
  paint();
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Лёгкий «тап» при нажатиях: вкладки и фильтры — как переключатель, кнопки — как нажатие
  if (TG.HapticFeedback) {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('.nav a, .chip, .year-switch button, .swatch, .icon-pick button, ' +
        '.btn, .icon-btn, .more-btn, .cat-card, .cat-add, .theme-row, .theme-toggle, .palette-item, .menu button, .search-trigger');
      if (!el || el.disabled) return;
      try {
        if (el.matches('.nav a, .chip, .year-switch button, .swatch, .icon-pick button')) TG.HapticFeedback.selectionChanged();
        else TG.HapticFeedback.impactOccurred('light');
      } catch { /* старый клиент Telegram */ }
    }, true);
  }

  // Лёгкая вибрация: успех — при сохранении, ошибка — при ошибке
  if (typeof toast === 'function' && TG.HapticFeedback) {
    const original = toast;
    window.toast = toast = (text, type) => {
      try { TG.HapticFeedback.notificationOccurred(type === 'error' ? 'error' : 'success'); } catch { /* ignore */ }
      return original(text, type);
    };
  }
})();
