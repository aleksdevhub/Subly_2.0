// =========================================================
//  Главная страница. Разметка — в dashboard.html,
//  здесь загрузка данных и заполнение блоков.
// =========================================================

const Dash = { data: null, filter: 'all', query: '', expanded: false, firstLoad: true };
const LIST_LIMIT = 7;

const MONTHS_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const MONTHS_DAT = ['январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню', 'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю'];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

async function initDashboard() {
  initApp();
  $('#greet').textContent = greeting();

  $('#add-btn').addEventListener('click', () => openSubscriptionForm({ onSaved: loadDashboard }));
  $('#empty-add').addEventListener('click', () => openSubscriptionForm({ onSaved: loadDashboard }));
  $('#search').addEventListener('input', (e) => { Dash.query = e.target.value.trim().toLowerCase(); renderList(); });
  $('#bell').addEventListener('click', (e) => { e.stopPropagation(); showUpcomingMenu(e.currentTarget); });
  $('#toggle-all').addEventListener('click', () => { Dash.expanded = !Dash.expanded; renderList(); });
  $$('.chip[data-filter]').forEach((chip) => chip.addEventListener('click', () => {
    Dash.filter = chip.dataset.filter;
    Dash.expanded = false;
    $$('.chip[data-filter]').forEach((c) => c.classList.toggle('active', c === chip));
    renderList();
  }));

  const params = new URLSearchParams(location.search);
  if (params.has('welcome')) toast('Аккаунт создан! Добавьте первую подписку');
  if (params.size) history.replaceState(null, '', '/dashboard.html');
  await loadDashboard();
  // Из быстрого поиска (Ctrl+K) можно прийти сразу к добавлению подписки
  if (params.has('add')) openSubscriptionForm({ onSaved: loadDashboard });
}

async function loadDashboard() {
  try {
    Dash.data = await api('/api/dashboard');
  } catch (err) {
    toast(err.message, 'error');
    return;
  }
  const { stats, userName, today } = Dash.data;
  updateSidebar(stats, Auth.user);

  $('#greet').textContent = `${greeting()}, ${(userName || '').split(' ')[0]}`;
  const d = Fmt.parse(today);
  const left = stats.upcomingCount;
  $('#today-line').textContent = `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}` +
    (left ? ` · ${left} ${plural(left, 'списание', 'списания', 'списаний')} до конца месяца` : ' · до конца месяца списаний нет');
  $('#bell-dot').classList.toggle('hidden', !Dash.data.subscriptions.some((s) => s.isActive && s.daysUntilPayment <= 3));

  renderStats();
  renderChips();
  renderList();
  renderSegments();
  renderUpcoming();
  renderTip();
  Dash.firstLoad = false;
}

// ---------- Карточки статистики ----------
function renderStats() {
  const s = Dash.data.stats;
  const monthIdx = Number(s.month.split('-')[1]) - 1;

  $('#st-month-label').textContent = `Расходы в ${MONTHS_PREP[monthIdx]}`;
  animateNumber($('#st-month'), s.monthTotal, Fmt.money);
  if (s.changePercent === null || s.changePercent === undefined) {
    $('#st-month-hint').textContent = `оплачено ${Fmt.money(s.paidThisMonth)}`;
  } else {
    const up = s.changePercent > 0;
    $('#st-month-hint').innerHTML = `<span class="${up ? 'c-warning' : 'c-success'} medium">${up ? '+' : ''}${Fmt.percent(s.changePercent)}</span>` +
      ` к ${MONTHS_DAT[(monthIdx + 11) % 12]}`;
  }

  // Итоги месяца под полосой категорий
  animateNumber($('#st-paid'), s.paidThisMonth, Fmt.money);
  animateNumber($('#st-upcoming'), s.upcomingThisMonth, Fmt.money);
  $('#st-budget').textContent = s.budget > 0
    ? `${Math.round((s.monthTotal / s.budget) * 100)}% из ${Fmt.money(s.budget)}` : 'не задан';
  $('#st-budget').classList.toggle('c-danger', s.budget > 0 && s.monthTotal > s.budget);

  animateNumber($('#st-active'), s.activeSubscriptions);
  $('#st-active-hint').textContent = s.activeSubscriptions
    ? `в ${s.categoriesUsed} ${plural(s.categoriesUsed, 'категории', 'категориях', 'категориях')}` : 'пока ни одной';

  if (s.nextPayment) {
    animateNumber($('#st-next'), s.nextPayment.amount, Fmt.money);
    $('#st-next-hint').textContent = `${s.nextPayment.name} · ${Fmt.date(s.nextPayment.date)}`;
  } else {
    $('#st-next').textContent = '—';
    $('#st-next-hint').textContent = 'нет активных подписок';
  }

  animateNumber($('#st-avg'), s.averageMonthly, Fmt.money);
  $('#st-avg-hint').textContent = `с начала ${new Date().getFullYear()} года`;
}

// ---------- Фильтры и список подписок ----------
function monthBounds(offset) {
  const now = Fmt.parse(Dash.data.today);
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: Fmt.iso(start), to: Fmt.iso(end), month: start.getMonth() };
}

function filterSubs(filter, query = '') {
  const subs = Dash.data.subscriptions;
  let list = subs;
  if (filter === 'this' || filter === 'next') {
    const { from, to } = monthBounds(filter === 'this' ? 0 : 1);
    list = subs.filter((s) => s.isActive && s.nextPaymentDate >= from && s.nextPaymentDate <= to);
  } else if (filter === 'paused') {
    list = subs.filter((s) => !s.isActive);
  }
  if (query) list = list.filter((s) => s.name.toLowerCase().includes(query) || s.categoryName.toLowerCase().includes(query));
  return list;
}

function renderChips() {
  $('#lbl-this').textContent = MONTHS_NOM[monthBounds(0).month];
  $('#lbl-next').textContent = MONTHS_NOM[monthBounds(1).month];
  $('#cnt-all').textContent = Dash.data.subscriptions.length;
  $('#cnt-this').textContent = filterSubs('this').length;
  $('#cnt-next').textContent = filterSubs('next').length;
  const paused = filterSubs('paused').length;
  $('#cnt-paused').textContent = paused;
  $('.chip[data-filter="paused"]').classList.toggle('hidden', !paused);
}

function renderList() {
  const all = Dash.data.subscriptions;
  const list = filterSubs(Dash.filter, Dash.query);
  const shown = Dash.expanded ? list : list.slice(0, LIST_LIMIT);

  $('#list-empty').classList.toggle('hidden', all.length > 0);
  $('#list-nothing').classList.toggle('hidden', !(all.length > 0 && list.length === 0));
  renderSubRows($('#list'), shown, loadDashboard, Dash.firstLoad);

  const foot = $('#list-foot');
  foot.classList.toggle('hidden', list.length <= LIST_LIMIT);
  $('#toggle-all').innerHTML = (Dash.expanded ? 'Свернуть' : `Показать все подписки (${list.length})`) +
    icon(Dash.expanded ? 'chevronD' : 'chevronR', 16);
}

// ---------- Полоса категорий под главной цифрой ----------
function renderSegments() {
  const cats = Dash.data.stats.byCategory.filter((c) => c.monthlyTotal > 0);
  const total = cats.reduce((sum, c) => sum + c.monthlyTotal, 0);
  const seg = $('#seg');

  if (!total) {
    seg.replaceChildren();
    $('#seg-legend').innerHTML = '<span class="small muted">Добавьте подписки — здесь появится, на что уходят деньги.</span>';
    return;
  }

  // Каждая категория — кусок полосы шириной по своей доле
  seg.replaceChildren(...cats.map((c, i) => {
    const piece = document.createElement('span');
    piece.style.background = catColor(c.color);
    piece.title = `${c.name}: ${Fmt.money(c.monthlyTotal)}`;
    // Сначала ширина 0, затем плавно растёт до своей доли (переход в animations.css)
    requestAnimationFrame(() => requestAnimationFrame(() => { piece.style.flexGrow = c.monthlyTotal; }));
    return piece;
  }));

  // Подписи: 4 самые крупные категории, остальные — «Другое»
  const top = cats.slice(0, 4);
  const rest = cats.slice(4).reduce((sum, c) => sum + c.monthlyTotal, 0);
  const items = top.map((c) => {
    const a = fromTemplate('tpl-seg-item');
    a.href = `/categories.html?id=${c.id}`;
    part(a, 'dot').style.background = catColor(c.color);
    setText(a, { name: c.name, sum: Fmt.money(c.monthlyTotal) });
    return a;
  });
  if (rest > 0) {
    const a = fromTemplate('tpl-seg-item');
    a.href = '/categories.html';
    part(a, 'dot').style.background = 'var(--border-strong)';
    setText(a, { name: 'Другое', sum: Fmt.money(rest) });
    items.push(a);
  }
  $('#seg-legend').replaceChildren(...items);
}

// ---------- Лента «Ближайшие 14 дней» ----------
const WD_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function renderUpcoming() {
  const today = Fmt.parse(Dash.data.today);
  const active = Dash.data.subscriptions.filter((s) => s.isActive);
  let count = 0, total = 0;

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const iso = Fmt.iso(d);
    const subs = active.filter((s) => s.nextPaymentDate === iso);
    const sum = subs.reduce((acc, s) => acc + s.price, 0);
    count += subs.length; total += sum;

    const day = fromTemplate('tpl-day');
    day.classList.toggle('today', i === 0);
    day.classList.toggle('has', subs.length > 0);
    day.style.setProperty('--i', i);
    setText(day, {
      wd: i === 0 ? 'Сегодня' : WD_SHORT[d.getDay()],
      dn: d.getDate() === 1 || i === 0 ? `${d.getDate()} ${MONTHS_GEN[d.getMonth()].slice(0, 3)}` : String(d.getDate()),
      sum: sum ? Fmt.money(sum) : '',
    });
    // Плитки сервисов, которые спишутся в этот день
    part(day, 'logos').replaceChildren(...subs.slice(0, 3).map((s) => {
      const t = document.createElement('span');
      t.className = 'tile tile-xs';
      t.style.background = catColor(s.categoryColor);
      t.innerHTML = icon(s.categoryIcon, 14);
      t.title = `${s.name} — ${Fmt.money(s.price)}`;
      return t;
    }));
    if (subs.length) day.title = subs.map((s) => `${s.name} — ${Fmt.money(s.price)}`).join('\n');
    return day;
  });

  $('#days').replaceChildren(...days);
  $('#up-total').textContent = count
    ? `${count} ${plural(count, 'списание', 'списания', 'списаний')} · ${Fmt.money(total)}`
    : 'списаний нет';
}

// ---------- Совет ----------
function renderTip() {
  const tip = Dash.data.stats.tip;
  $('#tip').classList.toggle('hidden', !tip);
  if (tip) $('#tip-text').textContent = tip.replace(/ (\d[\d\s,.]*) ₽/g, ' $1 ₽');
}

// ---------- Колокольчик: списания в ближайшие 7 дней ----------
function showUpcomingMenu(anchor) {
  const soon = Dash.data.subscriptions
    .filter((s) => s.isActive && s.daysUntilPayment <= 7)
    .sort((a, b) => a.daysUntilPayment - b.daysUntilPayment);
  if (!soon.length) {
    showMenu(anchor, [{ label: 'В ближайшие 7 дней списаний нет', icon: 'check', onClick: () => {} }]);
    return;
  }
  showMenu(anchor, soon.map((s) => ({
    label: `${s.name} — ${Fmt.daysLeft(s.daysUntilPayment)}, ${Fmt.money(s.price)}`,
    icon: 'calendar',
    onClick: () => openSubscriptionForm({ sub: s, onSaved: loadDashboard }),
  })));
}
