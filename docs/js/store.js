// =========================================================
//  Хранилище и «сервер внутри приложения» для Telegram Mini App.
//
//  В веб-версии Subly данные лежат в базе SQLite, а считает их сервер на C#.
//  В мини-приложении сервера нет: та же логика перенесена сюда, а данные
//  хранятся в облаке Telegram (CloudStorage) — у каждого пользователя своё.
//  Если страница открыта не в Telegram (например, в браузере на ПК),
//  данные сохраняются в браузере (localStorage).
//
//  Store.request(path, { method, body }) отвечает так же, как API сервера,
//  поэтому остальной код страниц почти не изменился.
// =========================================================

const Store = (() => {
  const TG = window.Telegram && window.Telegram.WebApp;
  const IN_TELEGRAM = !!(TG && TG.initData && TG.isVersionAtLeast && TG.isVersionAtLeast('6.9'));
  const KEY = 'subly';          // префикс ключей
  const CHUNK = 4000;           // в CloudStorage одно значение — не больше 4096 символов

  const DEFAULT_CATEGORIES = [
    ['Музыка', 'music', '#F25F8B'],
    ['Фильмы и сериалы', 'film', '#5B4CF0'],
    ['VPN', 'shield', '#1FA88A'],
    ['Облако', 'cloud', '#3B8CF0'],
    ['Игры', 'games', '#E8962C'],
    ['Образование', 'book', '#9B5DE5'],
    ['Софт', 'code', '#16161D'],
  ];
  const ICONS = ['music', 'film', 'shield', 'cloud', 'games', 'book', 'code', 'grid', 'card', 'home', 'mail', 'chart'];

  // ---------- Где хранить: облако Telegram или браузер ----------
  const cloud = {
    call(method, ...args) {
      return new Promise((resolve, reject) => {
        TG.CloudStorage[method](...args, (err, result) => (err ? reject(new Error(err)) : resolve(result)));
      });
    },
    async read() {
      const count = Number(await cloud.call('getItem', `${KEY}_n`)) || 0;
      if (!count) return null;
      const keys = Array.from({ length: count }, (_, i) => `${KEY}_${i}`);
      const parts = await cloud.call('getItems', keys);
      return keys.map((k) => parts[k] || '').join('');
    },
    async write(text) {
      const chunks = text.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g')) || [''];
      for (let i = 0; i < chunks.length; i++) await cloud.call('setItem', `${KEY}_${i}`, chunks[i]);
      const old = Number(await cloud.call('getItem', `${KEY}_n`)) || 0;
      await cloud.call('setItem', `${KEY}_n`, String(chunks.length));
      // лишние куски от прошлой, более длинной версии
      const extra = [];
      for (let i = chunks.length; i < old; i++) extra.push(`${KEY}_${i}`);
      if (extra.length) await cloud.call('removeItems', extra);
    },
    async clear() {
      const keys = await cloud.call('getKeys');
      const mine = keys.filter((k) => k.startsWith(KEY + '_'));
      if (mine.length) await cloud.call('removeItems', mine);
    },
  };

  const local = {
    async read() { try { return localStorage.getItem(KEY + '_data'); } catch { return null; } },
    async write(text) { try { localStorage.setItem(KEY + '_data', text); } catch { /* нет места или запрещено */ } },
    async clear() { try { localStorage.removeItem(KEY + '_data'); } catch { /* ignore */ } },
  };

  const backend = IN_TELEGRAM ? cloud : local;
  // Чей это кэш: у каждого пользователя Telegram свой, у «гостя» в браузере — свой
  const USER_KEY = IN_TELEGRAM && TG.initDataUnsafe && TG.initDataUnsafe.user ? 'tg' + TG.initDataUnsafe.user.id : 'guest';

  // ---------- Даты (формат ГГГГ-ММ-ДД, как в базе на сервере) ----------
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const today = () => fmt(new Date());
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const round2 = (n) => Math.round(n * 100) / 100;

  /** Следующая дата списания с сохранением «дня месяца» (как PaymentSync.NextDate на сервере) */
  function nextDate(current, period, anchorDay) {
    const d = parse(current);
    let y = d.getFullYear(), m = d.getMonth();
    if (period === 'yearly') y += 1; else m += 1;
    if (m > 11) { m = 0; y += 1; }
    return fmt(new Date(y, m, Math.min(anchorDay, daysInMonth(y, m))));
  }
  function anchorDay(s) {
    const day = parse(s.nextPaymentDate).getDate();
    return day >= 28 ? Math.max(day, parse(s.startDate).getDate()) : day;
  }
  function datesBetween(s, from, to) {
    const out = [];
    let d = s.nextPaymentDate;
    const anchor = anchorDay(s);
    for (let guard = 0; d <= to && guard < 500; guard++) {
      if (d >= from) out.push(d);
      d = nextDate(d, s.billingPeriod, anchor);
    }
    return out;
  }
  const monthlyPrice = (s) => (s.billingPeriod === 'yearly' ? round2(s.price / 12) : s.price);
  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a >= 11 && a <= 14) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  };

  // ---------- Состояние ----------
  let state = null;

  function telegramUser() {
    const u = IN_TELEGRAM && TG.initDataUnsafe && TG.initDataUnsafe.user;
    return u ? {
      name: [u.first_name, u.last_name].filter(Boolean).join(' '),
      username: u.username || '',
      photoUrl: u.photo_url || '',
    } : { name: 'Гость', username: '', photoUrl: '' };
  }

  function emptyState() {
    const tg = telegramUser();
    return {
      v: 1,
      nextId: DEFAULT_CATEGORIES.length + 1,
      user: { name: tg.name, budget: 0, createdAt: today() },
      categories: DEFAULT_CATEGORIES.map(([name, icon, color], i) => ({ id: i + 1, name, icon, color })),
      subscriptions: [],
      // платёж: [id, подписка, категория, название, сумма, дата, способ оплаты] — коротко, чтобы влезало в облако
      payments: [],
    };
  }

  async function load() {
    if (state) return state;
    // Пока открыта вкладка, держим копию в sessionStorage — переходы между страницами быстрее
    try {
      const cached = sessionStorage.getItem(`${KEY}_cache_${USER_KEY}`);
      if (cached) { state = JSON.parse(cached); return state; }
    } catch { /* ignore */ }
    let text = null;
    try { text = await backend.read(); } catch { text = null; }
    state = text ? JSON.parse(text) : emptyState();
    if (!text) await save();
    cacheSession();
    return state;
  }

  function cacheSession() {
    try { sessionStorage.setItem(`${KEY}_cache_${USER_KEY}`, JSON.stringify(state)); } catch { /* ignore */ }
  }

  async function save() {
    cacheSession();
    await backend.write(JSON.stringify(state));
  }

  const newId = () => state.nextId++;
  const catById = (id) => state.categories.find((c) => c.id === id);

  // ---------- Автоматический учёт списаний (как PaymentSync на сервере) ----------
  function syncPayments() {
    const t = today();
    let changed = false;
    for (const s of state.subscriptions) {
      if (!s.isActive || s.nextPaymentDate > t) continue;
      const anchor = anchorDay(s);
      let d = s.nextPaymentDate;
      while (d <= t) {
        const dup = state.payments.some((p) => p[1] === s.id && p[5] === d);
        if (!dup) state.payments.push([newId(), s.id, s.categoryId, s.name, s.price, d, s.paymentMethod || null]);
        d = nextDate(d, s.billingPeriod, anchor);
      }
      s.nextPaymentDate = d;
      changed = true;
    }
    return changed;
  }

  // ---------- Преобразование в ответы «как у API» ----------
  function subDto(s) {
    const c = catById(s.categoryId) || { name: '', icon: 'grid', color: '#5B4CF0' };
    return {
      id: s.id, name: s.name, categoryId: s.categoryId,
      categoryName: c.name, categoryIcon: c.icon, categoryColor: c.color,
      price: s.price, monthlyPrice: monthlyPrice(s), billingPeriod: s.billingPeriod,
      startDate: s.startDate, nextPaymentDate: s.nextPaymentDate,
      daysUntilPayment: daysBetween(today(), s.nextPaymentDate),
      paymentMethod: s.paymentMethod || null, isActive: s.isActive,
    };
  }

  function subsList() {
    return state.subscriptions
      .map(subDto)
      .sort((a, b) => (b.isActive - a.isActive) || a.nextPaymentDate.localeCompare(b.nextPaymentDate) || a.name.localeCompare(b.name));
  }

  function payDto(p) {
    const c = catById(p[2]);
    return {
      id: p[0], subscriptionId: p[1], subscriptionName: p[3],
      categoryName: c ? c.name : null, categoryIcon: c ? c.icon : null, categoryColor: c ? c.color : null,
      amount: p[4], paidAt: p[5], paymentMethod: p[6],
    };
  }

  const sumPayments = (from, to) => round2(state.payments.filter((p) => p[5] >= from && p[5] <= to).reduce((a, p) => a + p[4], 0));

  /** Статистика месяца — перенос StatsService.ComputeAsync */
  function computeStats(subs = subsList()) {
    const active = subs.filter((s) => s.isActive);
    const t = today(), td = parse(t);
    const y = td.getFullYear(), m = td.getMonth();
    const monthStart = fmt(new Date(y, m, 1)), monthEnd = fmt(new Date(y, m + 1, 0));
    const prevStart = fmt(new Date(y, m - 1, 1)), prevEnd = fmt(new Date(y, m, 0));
    const yearStart = `${y}-01-01`;

    const paid = sumPayments(monthStart, monthEnd);
    const prev = sumPayments(prevStart, prevEnd);
    const upcomingPrices = active.flatMap((s) => datesBetween(s, addDays(t, 1), monthEnd).map(() => s.price));
    const upcoming = round2(upcomingPrices.reduce((a, b) => a + b, 0));
    const total = round2(paid + upcoming);
    const change = prev > 0 ? Math.round(((total - prev) / prev) * 1000) / 10 : null;

    const yearPaidBefore = sumPayments(yearStart, addDays(monthStart, -1));
    const yearDates = state.payments.filter((p) => p[5] >= yearStart).map((p) => p[5]).sort();
    const firstMonth = yearDates.length ? parse(yearDates[0]).getMonth() : m;
    const monthsCount = Math.max(1, m - firstMonth + 1);
    const averageMonthly = Math.round((yearPaidBefore + total) / monthsCount);

    const recurring = round2(active.reduce((a, s) => a + s.monthlyPrice, 0));
    const next = [...active].sort((a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate) || a.name.localeCompare(b.name))[0];
    const expensive = [...active].sort((a, b) => b.monthlyPrice - a.monthlyPrice)[0];
    const info = (s, amount) => s && ({
      subscriptionId: s.id, name: s.name, amount, date: s.nextPaymentDate, daysLeft: s.daysUntilPayment,
    });

    const groups = new Map();
    for (const s of active) {
      if (!groups.has(s.categoryId)) groups.set(s.categoryId, []);
      groups.get(s.categoryId).push(s);
    }
    const byCategory = [...groups.entries()].map(([id, list]) => {
      const sum = round2(list.reduce((a, s) => a + s.monthlyPrice, 0));
      return {
        id, name: list[0].categoryName, icon: list[0].categoryIcon, color: list[0].categoryColor,
        count: list.length, monthlyTotal: sum, share: recurring > 0 ? Math.round((sum / recurring) * 1000) / 10 : 0,
      };
    }).sort((a, b) => b.monthlyTotal - a.monthlyTotal);

    return {
      month: monthStart.slice(0, 7),
      budget: state.user.budget,
      paidThisMonth: paid,
      upcomingThisMonth: upcoming,
      monthTotal: total,
      upcomingCount: upcomingPrices.length,
      prevMonthTotal: prev,
      changePercent: change,
      activeSubscriptions: active.length,
      categoriesUsed: byCategory.length,
      monthlyRecurring: recurring,
      averageSubscription: active.length ? Math.round(recurring / active.length) : 0,
      yearPaid: round2(yearPaidBefore + paid),
      averageMonthly,
      nextPayment: next ? info(next, next.price) : null,
      mostExpensive: expensive ? info(expensive, expensive.monthlyPrice) : null,
      byCategory,
      tip: buildTip(active),
    };
  }

  function buildTip(active) {
    const groups = {};
    for (const s of active) (groups[s.categoryName] = groups[s.categoryName] || []).push(s);
    const dup = Object.entries(groups)
      .filter(([, list]) => list.length >= 2)
      .sort((a, b) => Math.min(...b[1].map((s) => s.monthlyPrice)) - Math.min(...a[1].map((s) => s.monthlyPrice)))[0];
    if (!dup) return null;
    const [cat, list] = dup;
    const names = list.map((s) => s.name);
    const joined = names.length === 2 ? `${names[0]} и ${names[1]}` : names.join(', ');
    const saving = Math.min(...list.map((s) => s.monthlyPrice));
    return `У вас ${names.length} ${plural(names.length, 'подписка', 'подписки', 'подписок')} в категории «${cat}» — ${joined}. ` +
      `Отключите одну и сэкономите ${String(round2(saving)).replace('.', ',')} ₽ в месяц.`;
  }

  function userDto() {
    const tg = telegramUser();
    return {
      id: 1, name: state.user.name || tg.name, email: tg.username ? '@' + tg.username : 'Telegram',
      username: tg.username, photoUrl: tg.photoUrl,
      monthlyBudget: state.user.budget, role: 'user', createdAt: state.user.createdAt,
    };
  }

  // ---------- Проверки (как на сервере) ----------
  const fail = (status, message) => { throw new ApiError(status, message); };

  function validateSub(b) {
    const name = String(b.name || '').trim();
    if (name.length < 1 || name.length > 100) fail(400, 'Введите название подписки (до 100 символов)');
    const price = Number(b.price);
    if (!(price > 0) || price > 1000000) fail(400, 'Стоимость должна быть больше нуля');
    if (!['monthly', 'yearly'].includes(b.billingPeriod)) fail(400, 'Период оплаты: ежемесячно или ежегодно');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.nextPaymentDate || '')) fail(400, 'Укажите дату следующего списания');
    const t = parse(today());
    const min = fmt(new Date(t.getFullYear() - 3, t.getMonth(), t.getDate()));
    const max = fmt(new Date(t.getFullYear() + 5, t.getMonth(), t.getDate()));
    if (b.nextPaymentDate < min || b.nextPaymentDate > max) fail(400, 'Дата списания должна быть не раньше чем 3 года назад и не позже чем через 5 лет');
    if (!catById(Number(b.categoryId))) fail(400, 'Выберите категорию');
    const method = String(b.paymentMethod || '').trim().slice(0, 40);
    return { name, price: round2(price), billingPeriod: b.billingPeriod, nextPaymentDate: b.nextPaymentDate,
      categoryId: Number(b.categoryId), paymentMethod: method || null, isActive: b.isActive !== false };
  }

  function validateCat(b, exceptId) {
    const name = String(b.name || '').trim();
    if (name.length < 1 || name.length > 60) fail(400, 'Введите название категории (до 60 символов)');
    if (!ICONS.includes(b.icon)) fail(400, 'Неизвестная иконка');
    if (!/^#[0-9A-Fa-f]{6}$/.test(b.color || '')) fail(400, 'Цвет должен быть в формате #RRGGBB');
    if (state.categories.some((c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase())) fail(409, 'Категория с таким названием уже есть');
    return { name, icon: b.icon, color: b.color.toUpperCase() };
  }

  function categoriesList() {
    return state.categories.map((c) => {
      const subs = state.subscriptions.filter((s) => s.categoryId === c.id);
      const monthlyTotal = round2(subs.filter((s) => s.isActive).reduce((a, s) => a + monthlyPrice(s), 0));
      return { id: c.id, name: c.name, icon: c.icon, color: c.color, subscriptionsCount: subs.length, monthlyTotal };
    }).sort((a, b) => b.monthlyTotal - a.monthlyTotal || a.name.localeCompare(b.name));
  }

  // ---------- Обработчики «запросов» ----------
  async function request(path, { method = 'GET', body } = {}) {
    await load();
    const url = new URL(path, 'https://subly.local');
    const q = (name) => url.searchParams.get(name);
    const parts = url.pathname.split('/').filter(Boolean);   // ['api', 'subscriptions', '5']
    const id = Number(parts[2]);
    let dirty = syncPayments();
    let result;

    const route = `${method} /${parts.slice(0, 2).join('/')}${parts[2] ? '/:id' : ''}`;
    switch (route) {
      case 'GET /api/dashboard': {
        const subs = subsList();
        result = { userName: userDto().name, today: today(), stats: computeStats(subs), subscriptions: subs };
        break;
      }
      case 'GET /api/subscriptions': {
        const cat = q('categoryId');
        result = subsList().filter((s) => !cat || s.categoryId === Number(cat));
        break;
      }
      case 'POST /api/subscriptions': {
        const v = validateSub(body);
        const s = { id: newId(), ...v, startDate: v.nextPaymentDate };
        state.subscriptions.push(s);
        syncPayments();
        dirty = true;
        result = subDto(s);
        break;
      }
      case 'PUT /api/subscriptions/:id': {
        const s = state.subscriptions.find((x) => x.id === id) || fail(404, 'Подписка не найдена');
        const v = validateSub(body);
        let next = v.nextPaymentDate;
        // Включили после паузы: платежи за время паузы не начисляем
        if (!s.isActive && v.isActive && next <= today()) {
          const anchor = parse(next).getDate();
          while (next <= today()) next = nextDate(next, v.billingPeriod, anchor);
        }
        Object.assign(s, v, { nextPaymentDate: next, startDate: s.startDate < next ? s.startDate : next });
        syncPayments();
        dirty = true;
        result = subDto(s);
        break;
      }
      case 'DELETE /api/subscriptions/:id': {
        if (!state.subscriptions.some((x) => x.id === id)) fail(404, 'Подписка не найдена');
        state.subscriptions = state.subscriptions.filter((x) => x.id !== id);
        state.payments.forEach((p) => { if (p[1] === id) p[1] = null; });   // история платежей остаётся
        dirty = true;
        result = null;
        break;
      }
      case 'GET /api/categories':
        result = categoriesList();
        break;
      case 'POST /api/categories': {
        const c = { id: newId(), ...validateCat(body) };
        state.categories.push(c);
        dirty = true;
        result = categoriesList().find((x) => x.id === c.id);
        break;
      }
      case 'PUT /api/categories/:id': {
        const c = catById(id) || fail(404, 'Категория не найдена');
        Object.assign(c, validateCat(body, id));
        dirty = true;
        result = categoriesList().find((x) => x.id === id);
        break;
      }
      case 'DELETE /api/categories/:id': {
        if (!catById(id)) fail(404, 'Категория не найдена');
        const n = state.subscriptions.filter((s) => s.categoryId === id).length;
        if (n) fail(409, `В категории ${n} ${plural(n, 'подписка', 'подписки', 'подписок')}. Перенесите их в другую категорию или удалите, а затем удалите категорию.`);
        state.categories = state.categories.filter((c) => c.id !== id);
        state.payments.forEach((p) => { if (p[2] === id) p[2] = null; });
        dirty = true;
        result = null;
        break;
      }
      case 'GET /api/payments': {
        const y = Number(q('year')) || new Date().getFullYear();
        const cat = q('categoryId');
        result = state.payments
          .filter((p) => p[5].startsWith(y + '-') && (!cat || p[2] === Number(cat)))
          .sort((a, b) => b[5].localeCompare(a[5]) || b[0] - a[0])
          .map(payDto);
        break;
      }
      case 'GET /api/analytics':
        result = analytics(Number(q('year')) || new Date().getFullYear());
        break;
      case 'GET /api/profile':
        result = { user: userDto(), stats: computeStats() };
        break;
      case 'PUT /api/profile': {
        const name = String(body.name || '').trim();
        if (name.length < 2 || name.length > 100) fail(400, 'Имя: от 2 до 100 символов');
        const budget = Number(body.monthlyBudget) || 0;
        if (budget < 0 || budget > 10000000) fail(400, 'Бюджет указан неверно');
        state.user.name = name;
        state.user.budget = round2(budget);
        dirty = true;
        result = { user: userDto() };
        break;
      }
      case 'DELETE /api/profile': {
        state = emptyState();
        await backend.clear();
        dirty = true;
        result = null;
        break;
      }
      default:
        fail(404, 'Неизвестный запрос: ' + route);
    }

    if (dirty) await save();
    return result;
  }

  /** Аналитика за год — перенос AnalyticsController.Analytics */
  function analytics(y) {
    const t = today();
    const subs = subsList();
    const active = subs.filter((s) => s.isActive);
    const yearPays = state.payments.filter((p) => p[5].startsWith(y + '-'));

    const months = Array.from({ length: 12 }, (_, i) => {
      const start = fmt(new Date(y, i, 1)), end = fmt(new Date(y, i + 1, 0));
      const paid = round2(yearPays.filter((p) => p[5] >= start && p[5] <= end).reduce((a, p) => a + p[4], 0));
      const from = start > t ? start : addDays(t, 1);
      const forecast = end <= t ? 0 : round2(active.reduce((a, s) => a + datesBetween(s, from, end).length * s.price, 0));
      return { month: i + 1, paid, forecast, isCurrent: start.slice(0, 7) === t.slice(0, 7), isFuture: start > t };
    });

    const byCat = new Map();
    for (const p of yearPays) {
      const c = catById(p[2]);
      const key = c ? c.id : 0;
      if (!byCat.has(key)) byCat.set(key, { name: c ? c.name : 'Без категории', color: c ? c.color : '#A3A3AD', icon: c ? c.icon : 'grid', total: 0 });
      byCat.get(key).total = round2(byCat.get(key).total + p[4]);
    }
    const cats = [...byCat.values()].sort((a, b) => b.total - a.total);
    const yearTotal = round2(cats.reduce((a, c) => a + c.total, 0));
    const paidMonths = months.filter((m) => m.paid > 0).length;
    const years = [...new Set([...state.payments.map((p) => Number(p[5].slice(0, 4))), new Date().getFullYear()])].sort();
    const monthEnd = fmt(new Date(parse(t).getFullYear(), parse(t).getMonth() + 1, 0));

    return {
      year: y,
      years,
      yearTotal,
      averageMonthly: paidMonths ? Math.round(yearTotal / paidMonths) : 0,
      months,
      byCategory: cats.map((c) => ({ ...c, share: yearTotal > 0 ? Math.round((c.total / yearTotal) * 1000) / 10 : 0 })),
      stats: computeStats(subs),
      upcoming: active.filter((s) => s.nextPaymentDate <= monthEnd).sort((a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate)),
    };
  }

  return { request, load, IN_TELEGRAM, USER_KEY, telegramUser };
})();
