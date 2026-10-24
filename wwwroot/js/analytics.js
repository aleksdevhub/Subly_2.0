// =========================================================
//  Аналитика платежей. Разметка — в analytics.html.
// =========================================================

const An = { year: new Date().getFullYear(), data: null, payments: [], expanded: false };
const PAY_LIMIT = 8;

async function initAnalytics() {
  initApp();
  $('#prev-year').addEventListener('click', () => { An.year--; load(); });
  $('#next-year').addEventListener('click', () => { An.year++; load(); });
  $('#export-btn').addEventListener('click', exportCsv);
  $('#more-pay').addEventListener('click', () => { An.expanded = !An.expanded; renderTable(); });
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(renderBars, 150); });
  await load();
}

async function load() {
  $('#year-label').textContent = An.year;
  try {
    const [data, payments] = await Promise.all([
      api(`/api/analytics?year=${An.year}`),
      api(`/api/payments?year=${An.year}`),
    ]);
    An.data = data;
    An.payments = payments;
    An.expanded = false;
  } catch (err) {
    toast(err.message, 'error');
    return;
  }

  const d = An.data;
  const thisYear = new Date().getFullYear();
  updateSidebar(d.stats, Auth.user);
  $('#sub-title').textContent = `Расходы на подписки в ${d.year} году`;
  $('#prev-year').disabled = d.year <= Math.min(...d.years);
  $('#next-year').disabled = d.year >= thisYear;
  $('#donut-year').textContent = d.year === thisYear ? 'с начала года' : `за ${d.year} год`;

  renderKpis();
  renderBars();
  renderStructure();
  renderTable();
}

// ---------- Ключевые показатели ----------
function renderKpis() {
  const d = An.data, s = d.stats;
  const isCurrent = d.year === new Date().getFullYear();
  const monthIdx = Number(s.month.split('-')[1]) - 1;
  const best = d.months.reduce((a, m) => (m.paid > a.paid ? m : a), d.months[0]);
  const n = An.payments.length;

  $('#k-year-label').textContent = isCurrent ? 'С начала года' : `За ${d.year} год`;
  animateNumber($('#k-year'), d.yearTotal, Fmt.money);
  $('#k-year-hint').textContent = `${n} ${plural(n, 'платёж', 'платежа', 'платежей')}`;

  $('#k-avg-label').textContent = 'В среднем в месяц';
  animateNumber($('#k-avg'), d.averageMonthly, Fmt.money);
  $('#k-avg-hint').textContent = 'по месяцам с платежами';

  if (isCurrent) {
    $('#k-month-label').textContent = MONTHS_NOM[monthIdx];
    animateNumber($('#k-month'), s.monthTotal, Fmt.money);
    if (s.changePercent == null) {
      $('#k-month-hint').textContent = `предстоит ${Fmt.money(s.upcomingThisMonth)}`;
    } else {
      const up = s.changePercent > 0;
      $('#k-month-hint').innerHTML = `<span class="${up ? 'c-warning' : 'c-success'}">${up ? '+' : ''}${Fmt.percent(s.changePercent)} к прошлому месяцу</span>`;
    }
  } else {
    $('#k-month-label').textContent = 'Самый дорогой месяц';
    animateNumber($('#k-month'), best.paid, Fmt.money);
    $('#k-month-hint').textContent = best.paid ? MONTHS_NOM[best.month - 1] : 'нет платежей';
  }

  $('#k-top-label').textContent = 'Самая дорогая подписка';
  if (s.mostExpensive) {
    animateNumber($('#k-top'), s.mostExpensive.amount, Fmt.money);
    $('#k-top-hint').textContent = `${s.mostExpensive.name} · в месяц`;
  } else {
    $('#k-top').textContent = '—';
    $('#k-top-hint').textContent = 'нет активных подписок';
  }
}

// ---------- Графики ----------
function renderBars() {
  if (!An.data) return;
  renderBarChart($('#bars'), An.data.months.map((m) => ({
    label: MONTHS_SHORT[m.month - 1],
    fullLabel: MONTHS_NOM[m.month - 1] + ' ' + An.data.year,
    paid: m.paid,
    forecast: m.forecast,
    highlight: m.isCurrent,
  })));
}

function renderStructure() {
  const cats = An.data.byCategory;
  $('#struct-total').textContent = Fmt.money(An.data.yearTotal);

  if (!cats.length) {
    $('#struct-bar').replaceChildren();
    $('#legend').innerHTML = '<p class="small muted">Платежей за этот год нет</p>';
    return;
  }

  // Общая полоса: каждая категория — кусок по своей доле
  $('#struct-bar').replaceChildren(...cats.map((c) => {
    const piece = document.createElement('span');
    piece.style.background = catColor(c.color);
    piece.title = `${c.name}: ${Fmt.money(c.total)}`;
    requestAnimationFrame(() => requestAnimationFrame(() => { piece.style.flexGrow = c.total; }));
    return piece;
  }));

  // Список: категория, сумма, доля и своя полоска
  const max = Math.max(...cats.map((c) => c.total), 1);
  $('#legend').replaceChildren(...cats.map((c) => {
    const row = fromTemplate('tpl-legend-row');
    part(row, 'dot').style.background = catColor(c.color);
    setText(row, { name: c.name, sum: Fmt.money(c.total), share: Fmt.percent(c.share) });
    setBar(part(row, 'bar'), (c.total / max) * 100, catColor(c.color));
    return row;
  }));
}

// ---------- Таблица платежей ----------
function renderTable() {
  const isCurrent = An.data.year === new Date().getFullYear();
  const upcoming = isCurrent ? An.data.upcoming.map((s) => ({
    name: s.name, categoryName: s.categoryName, categoryIcon: s.categoryIcon, categoryColor: s.categoryColor,
    date: s.nextPaymentDate, method: s.paymentMethod, amount: s.price, upcoming: true,
  })) : [];
  const paid = An.payments.map((p) => ({
    name: p.subscriptionName, categoryName: p.categoryName || 'Без категории', categoryIcon: p.categoryIcon || 'grid',
    categoryColor: p.categoryColor || '#A3A3AD', date: p.paidAt, method: p.paymentMethod, amount: p.amount, upcoming: false,
  }));
  const rows = [...upcoming, ...paid];
  $('#pay-count').textContent = paid.length ? `${paid.length} ${plural(paid.length, 'платёж', 'платежа', 'платежей')}` : '';

  $('#pay-empty').classList.toggle('hidden', rows.length > 0);
  $('#pay-empty-text').textContent = `За ${An.data.year} год платежей нет`;

  const shown = An.expanded ? rows : rows.slice(0, PAY_LIMIT);
  $('#pay-body').replaceChildren(...shown.map((r) => {
    const tr = fromTemplate('tpl-pay-row');
    const tile = part(tr, 'tile');
    tile.style.background = catColor(r.categoryColor);
    tile.innerHTML = icon(r.categoryIcon, 16);
    setText(tr, {
      name: r.name, category: r.categoryName, date: Fmt.date(r.date), amount: Fmt.money(r.amount),
      status: r.upcoming ? 'Предстоит' : 'Оплачено',
    });
    part(tr, 'status').classList.add(r.upcoming ? 'badge-warning' : 'badge-success');
    part(tr, 'method').innerHTML = r.method
      ? `<span class="pm">${icon('card', 16)}${esc(r.method)}</span>` : '<span class="faint">—</span>';
    return tr;
  }));

  $('#pay-foot').classList.toggle('hidden', rows.length <= PAY_LIMIT);
  $('#more-pay').innerHTML = (An.expanded ? 'Свернуть' : `Показать все (${rows.length})`) +
    icon(An.expanded ? 'chevronD' : 'chevronR', 16);
}

/** Выгрузка платежей за год в CSV (открывается в Excel) */
function exportCsv() {
  if (!An.payments.length) { toast('За этот год платежей нет', 'error'); return; }
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Дата', 'Подписка', 'Категория', 'Сумма, ₽', 'Способ оплаты'].map(q).join(';')];
  An.payments.forEach((p) => lines.push([p.paidAt, p.subscriptionName, p.categoryName || '', String(p.amount).replace('.', ','), p.paymentMethod || ''].map(q).join(';')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `subly-payments-${An.year}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
