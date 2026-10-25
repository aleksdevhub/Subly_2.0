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

  // ---------- Иконка Subly на главном экране телефона (Telegram 8.0+) ----------
  const canAddToHome = TG.isVersionAtLeast('8.0') && typeof TG.addToHomeScreen === 'function';
  const BANNER_KEY = 'subly_home_banner_hidden';

  function showHomeStatus(status) {
    // unsupported — телефон не умеет, added — уже на экране, missed / unknown — можно добавить
    const card = document.getElementById('home-card');
    const banner = document.getElementById('home-banner');
    if (status === 'unsupported') return;
    if (status === 'added' && typeof Achievements !== 'undefined') Achievements.event('home');

    if (card) {
      card.classList.remove('hidden');
      const btn = card.querySelector('[data-home-add]');
      if (status === 'added' && btn) {
        btn.outerHTML = '<span class="done">✓ Уже на экране</span>';
        document.getElementById('home-text').textContent = 'Subly открывается с главного экрана телефона';
      }
    }
    let hidden = false;
    try { hidden = localStorage.getItem(BANNER_KEY) === '1'; } catch { /* ignore */ }
    if (banner) banner.classList.toggle('hidden', status === 'added' || hidden);
  }

  if (canAddToHome) {
    document.querySelectorAll('[data-home-add]').forEach((b) => b.addEventListener('click', () => TG.addToHomeScreen()));
    document.getElementById('home-banner-close')?.addEventListener('click', () => {
      try { localStorage.setItem(BANNER_KEY, '1'); } catch { /* ignore */ }
      document.getElementById('home-banner').classList.add('hidden');
    });
    TG.onEvent('homeScreenAdded', () => {
      showHomeStatus('added');
      if (typeof Achievements !== 'undefined') Achievements.event('home');
      if (typeof toast === 'function') toast('Subly добавлен на главный экран');
    });
    try { TG.checkHomeScreenStatus(showHomeStatus); } catch { /* старый клиент */ }
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
