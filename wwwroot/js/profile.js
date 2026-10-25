// =========================================================
//  Профиль: данные, траты за месяц, смена пароля, удаление аккаунта.
//  Разметка страницы и всех окон — в profile.html.
// =========================================================

const Prof = { user: null, stats: null };

const MONTHS_INS = ['январём', 'февралём', 'мартом', 'апрелем', 'маем', 'июнем', 'июлем', 'августом', 'сентябрём', 'октябрём', 'ноябрём', 'декабрём'];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function initProfile() {
  initApp();
  $$('[data-edit]').forEach((b) => b.addEventListener('click', openEditProfile));
  $('#pwd-btn').addEventListener('click', openChangePassword);
  $('#delete-btn').addEventListener('click', openDeleteAccount);
  $('#cal-all-btn')?.addEventListener('click', async () => {
    try { SublyCalendar.open(await api('/api/subscriptions')); } catch (err) { toast(err.message, 'error'); }
  });
  await loadProfile();
}

async function loadProfile() {
  try {
    const p = await api('/api/profile');
    Prof.user = p.user;
    Prof.stats = p.stats;
    Auth.save(Auth.token, p.user);
  } catch (err) { toast(err.message, 'error'); return; }
  updateSidebar(Prof.stats, Prof.user);
  renderInfo();
  renderSpend();
}

// ---------- Личные данные ----------
function renderInfo() {
  const u = Prof.user, s = Prof.stats;
  const since = Fmt.parse(u.createdAt.slice(0, 10));
  $('#p-avatar').textContent = initials(u.name);
  $('#p-name-title').textContent = u.name;
  $('#p-role').classList.toggle('hidden', u.role !== 'admin');   // значок «Администратор»
  $('#p-since').textContent = `В Subly с ${MONTHS_GEN[since.getMonth()]} ${since.getFullYear()} · ` +
    `${s.activeSubscriptions} ${plural(s.activeSubscriptions, 'подписка', 'подписки', 'подписок')}`;
  $('#p-name').textContent = u.name;
  $('#p-email').textContent = u.email;
  $('#p-budget').innerHTML = u.monthlyBudget > 0 ? Fmt.money(u.monthlyBudget) : '<span class="faint">не задан</span>';
}

// ---------- Траты за месяц и статистика ----------
function renderSpend() {
  const s = Prof.stats;
  const monthIdx = Number(s.month.split('-')[1]) - 1;
  const diff = s.monthTotal - s.prevMonthTotal;

  $('#s-month').textContent = MONTHS_NOM[monthIdx];
  animateNumber($('#s-total'), s.monthTotal, Fmt.money);
  $('#s-sub').textContent = `на ${s.activeSubscriptions} ${plural(s.activeSubscriptions, 'подписку', 'подписки', 'подписок')}` +
    ` в ${s.categoriesUsed} ${plural(s.categoriesUsed, 'категории', 'категориях', 'категориях')}`;
  setBar($('#s-bar'), s.monthTotal > 0 ? (s.paidThisMonth / s.monthTotal) * 100 : 0);
  $('#s-paid').textContent = Fmt.money(s.paidThisMonth);
  $('#s-upcoming').textContent = Fmt.money(s.upcomingThisMonth);

  $('#s-cmp-label').textContent = `По сравнению с ${MONTHS_INS[(monthIdx + 11) % 12]}`;
  const cmp = $('#s-cmp');
  if (s.prevMonthTotal > 0) {
    cmp.className = `medium ${diff > 0 ? 'c-warning' : 'c-success'}`;
    cmp.style.cssText = 'display:inline-flex;align-items:center;gap:4px';
    cmp.innerHTML = icon(diff > 0 ? 'up' : 'down', 14) + (diff > 0 ? '+' : diff < 0 ? '−' : '') + Fmt.money(Math.abs(diff));
  } else {
    cmp.className = 'faint';
    cmp.textContent = 'нет данных';
  }

  animateNumber($('#a-active'), s.activeSubscriptions);
  animateNumber($('#a-cats'), s.categoriesUsed);
  animateNumber($('#a-year'), s.yearPaid, Fmt.money);
  animateNumber($('#a-avg'), s.averageSubscription, (v) => `${Fmt.money(v)} в месяц`);
}

// ---------- Окно «Личные данные» ----------
function openEditProfile() {
  const u = Prof.user;
  const m = openModal('modal-edit');
  $('#e-name', m.el).value = u.name;
  $('#e-email', m.el).value = u.email;
  $('#e-budget', m.el).value = u.monthlyBudget;

  $('#edit-form', m.el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: $('#e-name').value.trim(),
      email: $('#e-email').value.trim(),
      monthlyBudget: Number($('#e-budget').value) || 0,
    };
    const nameOk = body.name.length >= 2, emailOk = EMAIL_RE.test(body.email);
    setFieldError('e-name', nameOk ? null : 'Минимум 2 символа');
    setFieldError('e-email', emailOk ? null : 'Некорректный адрес почты');
    if (!nameOk || !emailOk) return;

    const btn = $('#e-save');
    setLoading(btn, true, 'Сохраняем…');
    try {
      const res = await api('/api/profile', { method: 'PUT', body });
      Auth.save(res.token, res.user);
      m.close();
      toast('Данные сохранены');
      loadProfile();
    } catch (err) {
      showFormError($('#edit-msg'), err.message);
      setLoading(btn, false);
    }
  });
}

// ---------- Окно «Смена пароля» ----------
function openChangePassword() {
  const m = openModal('modal-password');
  const el = m.el;

  // Пересчитываем надёжность и требования при каждом вводе
  const update = () => {
    const cur = $('#p-current').value, pwd = $('#p-new').value, rep = $('#p-repeat').value;
    const st = passwordStrength(pwd);
    $$('.strength .segs i', el).forEach((seg, i) => {
      seg.style.background = pwd && i < Math.max(st.score, 1) ? st.color : '';
    });
    $('#s-label').textContent = pwd ? st.label : 'Введите новый пароль';
    $('#s-label').style.color = pwd ? st.color : '';
    $('#s-len').textContent = pwd ? `${pwd.length} ${plural(pwd.length, 'символ', 'символа', 'символов')}` : '';

    const reqs = {
      length: pwd.length >= 8,
      mixed: /\p{L}/u.test(pwd) && /\d/.test(pwd),
      diff: !!pwd && pwd !== cur,
    };
    $$('.req li', el).forEach((li) => {
      const ok = reqs[li.dataset.req];
      if (li.classList.contains('ok') === ok) return;
      li.classList.toggle('ok', ok);
      li.querySelector('svg').outerHTML = icon(ok ? 'check' : 'x', 16);
    });

    const hint = $('#p-repeat-hint');
    if (rep) {
      hint.textContent = rep === pwd ? 'Пароли совпадают' : 'Пароли не совпадают';
      hint.className = 'hint ' + (rep === pwd ? 'ok' : 'error');
    } else hint.className = 'hint hidden';

    $('#p-save').disabled = !(cur && Object.values(reqs).every(Boolean) && rep === pwd);
  };
  ['p-current', 'p-new', 'p-repeat'].forEach((id) => $('#' + id, el).addEventListener('input', update));

  $('#pwd-form', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#p-save');
    if (btn.disabled) return;
    setLoading(btn, true, 'Сохраняем…');
    try {
      await api('/api/profile/password', {
        method: 'PUT', body: { currentPassword: $('#p-current').value, newPassword: $('#p-new').value },
      });
      m.close();
      toast('Пароль изменён');
    } catch (err) {
      showFormError($('#pwd-msg'), err.message);
      setLoading(btn, false);
    }
  });
}

// ---------- Окно «Удалить аккаунт» ----------
function openDeleteAccount() {
  const s = Prof.stats;
  const m = openModal('modal-delete');
  const el = m.el;
  setText(el, {
    subs: `${s.activeSubscriptions} ${plural(s.activeSubscriptions, 'подписка', 'подписки', 'подписок')} и напоминания о списаниях`,
    payments: `История платежей — ${Fmt.money(s.yearPaid)} с начала года`,
  });

  // Кнопка «Удалить» активна, только когда выполнены все три условия
  const check = () => {
    $('#d-submit').disabled = !($('#d-password').value.length > 0
      && $('#d-word').value.trim().toUpperCase() === 'УДАЛИТЬ'
      && $('#d-agree').checked);
  };
  ['d-password', 'd-word'].forEach((id) => $('#' + id, el).addEventListener('input', check));
  $('#d-agree', el).addEventListener('change', check);

  $('#del-form', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#d-submit');
    if (btn.disabled) return;
    setLoading(btn, true, 'Удаляем…');
    try {
      await api('/api/profile', {
        method: 'DELETE', body: { password: $('#d-password').value, confirmation: $('#d-word').value.trim() },
      });
      Auth.clear();
      location.href = '/login.html?deleted=1';
    } catch (err) {
      showFormError($('#del-msg'), err.message);
      setLoading(btn, false);
    }
  });
}
