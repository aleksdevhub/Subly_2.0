// =========================================================
//  «API» мини-приложения и общие функции форматирования.
//  Запросы не уходят на сервер — их обрабатывает Store (js/store.js),
//  а данные хранятся в облаке Telegram.
// =========================================================

/** Пользователь: в мини-приложении вход не нужен — человека знает Telegram */
const Auth = {
  token: 'telegram',
  get user() {
    try {
      const saved = JSON.parse(localStorage.getItem('subly_user_' + Store.USER_KEY) || 'null');
      if (saved) return saved;
    } catch { /* ignore */ }
    const tg = Store.telegramUser();
    return { name: tg.name, email: tg.username ? '@' + tg.username : 'Telegram', photoUrl: tg.photoUrl };
  },
  save(_token, user) {
    try { localStorage.setItem('subly_user_' + Store.USER_KEY, JSON.stringify(user)); } catch { /* ignore */ }
  },
  clear() {
    try { localStorage.removeItem('subly_user_' + Store.USER_KEY); } catch { /* ignore */ }
  },
};

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Запрос к «API»: отвечает Store так же, как отвечал сервер */
async function api(path, options = {}) {
  try {
    return await Store.request(path, options);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error(err);
    throw new ApiError(0, 'Не получилось сохранить данные. Попробуйте ещё раз.');
  }
}

// ---------- Форматирование ----------

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const Fmt = {
  /** 4223 → «4 223 ₽» (с неразрывными пробелами) */
  money(n, withDecimals = false) {
    const v = Number(n) || 0;
    const opts = withDecimals || v % 1 !== 0
      ? { minimumFractionDigits: 0, maximumFractionDigits: 2 }
      : { maximumFractionDigits: 0 };
    return v.toLocaleString('ru-RU', opts).replace(/\s/g, ' ') + ' ₽';
  },
  /** «2026-10-18» → Date (в локальном времени) */
  parse(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  },
  /** «2026-10-18» → «18 октября» (год добавляется, если не текущий) */
  date(iso, withYear) {
    const d = Fmt.parse(iso);
    const showYear = withYear ?? d.getFullYear() !== new Date().getFullYear();
    return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${showYear ? ' ' + d.getFullYear() : ''}`;
  },
  /** Date → «2026-10-18» */
  iso(date) {
    const p = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  },
  /** 3 → «через 3 дня» */
  daysLeft(n) {
    if (n < 0) return 'просрочено';
    if (n === 0) return 'сегодня';
    if (n === 1) return 'завтра';
    return `через ${n} ${plural(n, 'день', 'дня', 'дней')}`;
  },
  percent(n) {
    return (Math.round(n * 10) / 10).toString().replace('.', ',') + '%';
  },
  period(p) { return p === 'yearly' ? 'в год' : 'в месяц'; },
  periodName(p) { return p === 'yearly' ? 'ежегодно' : 'ежемесячно'; },
};

/** Склонение: plural(5, 'подписка', 'подписки', 'подписок') → «подписок» */
/**
 * Цвет категории для вывода на страницу. Чёрный цвет в тёмной теме
 * слился бы с фоном, поэтому подменяем его CSS-переменной (см. base.css).
 */
function catColor(hex) {
  return String(hex || '').toUpperCase() === '#16161D' ? 'var(--cat-black)' : hex;
}

function plural(n, one, few, many) {
  const m100 = Math.abs(n) % 100, m10 = m100 % 10;
  if (m100 >= 11 && m100 <= 14) return many;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
}

/** Экранирование текста перед вставкой в HTML */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
