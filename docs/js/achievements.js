// =========================================================
//  Достижения и серии: праздничное окно при открытии награды,
//  полоска серий на главной и страница «Достижения».
//  Считает всё Store (js/store.js), здесь — только отображение.
// =========================================================

const Achievements = (() => {
  const TG = window.Telegram && window.Telegram.WebApp;
  const CONFETTI = ['#5B4CF0', '#C8F169', '#F25F8B', '#E8962C', '#3B8CF0', '#1FA88A'];
  let queue = [];
  let showing = false;

  /** Праздничное окно: одна награда — крупно, несколько — списком */
  function celebrate(list) {
    if (!list || !list.length) return;
    for (const a of list) if (!queue.some((q) => q.id === a.id)) queue.push(a);
    if (!showing) setTimeout(showNext, 350);   // даём странице дорисоваться
  }

  function showNext() {
    if (!queue.length) { showing = false; return; }
    showing = true;
    const items = queue.splice(0, queue.length);
    const one = items.length === 1;

    const backdrop = document.createElement('div');
    backdrop.className = 'unlock-backdrop';
    backdrop.innerHTML = `
      <div class="unlock-card" role="dialog" aria-modal="true">
        <div class="confetti" aria-hidden="true">${Array.from({ length: 26 }, (_, i) =>
          `<i style="--x:${Math.round(Math.random() * 100)}%;--d:${(Math.random() * 0.5).toFixed(2)}s;--r:${Math.round(Math.random() * 360)}deg;background:${CONFETTI[i % CONFETTI.length]}"></i>`).join('')}</div>
        <div class="overline unlock-kicker">${one ? 'Новое достижение' : `Новые достижения: ${items.length}`}</div>
        ${one ? `
          <div class="unlock-badge" style="--c:${items[0].color}">${icon(items[0].icon, 40, 2)}</div>
          <h2 class="h2">${esc(items[0].title)}</h2>
          <p class="muted">${esc(items[0].desc)}</p>`
        : `<div class="unlock-list">${items.map((a) => `
            <div class="unlock-row"><span class="ach-icon sm" style="--c:${a.color}">${icon(a.icon, 18)}</span>
              <span><span class="medium">${esc(a.title)}</span><br><span class="small muted">${esc(a.desc)}</span></span></div>`).join('')}</div>`}
        <button class="btn btn-primary btn-block" data-close>Круто!</button>
        <a class="link-btn" href="achievements.html">Все достижения ${icon('chevronR', 14)}</a>
      </div>`;
    document.body.appendChild(backdrop);
    try { TG && TG.initData && TG.HapticFeedback.notificationOccurred('success'); } catch { /* ignore */ }

    const close = () => { backdrop.remove(); setTimeout(showNext, 200); };
    backdrop.querySelector('[data-close]').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  }

  /** Разовые события для наград «Тёмная сторона» и «Как приложение» */
  function event(name) {
    api('/api/achievements', { method: 'POST', body: { event: name } }).catch(() => {});
  }
  function watchTheme() {
    const check = () => { if (document.documentElement.dataset.theme === 'dark') event('dark'); };
    check();
    new MutationObserver(check).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  const days = (n) => plural(n, 'день', 'дня', 'дней');
  const months = (n) => plural(n, 'месяц', 'месяца', 'месяцев');

  /** Полоска серий на главной */
  async function renderStrip() {
    const strip = $('#streak-strip');
    if (!strip) return;
    let a;
    try { a = await api('/api/achievements'); } catch { return; }
    $('#ss-visit').textContent = a.visit.days;
    $('#ss-visit-l').textContent = `${days(a.visit.days)} подряд`;
    $('#ss-budget').textContent = a.streak.current;
    $('#ss-budget-l').textContent = `${months(a.streak.current)} в бюджете`;
    $('#ss-ach').textContent = `${a.unlocked}/${a.total}`;
    strip.classList.remove('hidden');
  }

  /** Страница «Достижения» */
  async function initPage() {
    initApp();
    let a;
    try { a = await api('/api/achievements'); } catch (err) { toast(err.message, 'error'); return; }

    $('#ach-sub').textContent = `Открыто ${a.unlocked} из ${a.total} · серии и экономия`;

    // Серия месяцев в бюджете
    const st = a.streak;
    animateNumber($('#st-budget-num'), st.current);
    $('#st-budget-unit').textContent = months(st.current);
    $('#st-months').replaceChildren(...[...st.months, { month: 'now', ok: st.thisMonth.ok, now: true }].map((m) => {
      const dot = document.createElement('span');
      dot.className = 'mdot ' + (m.now ? (st.budget > 0 ? (m.ok ? 'now ok' : 'now bad') : 'now') : m.ok ? 'ok' : st.budget > 0 ? 'bad' : '');
      const label = m.now ? 'сейчас' : MONTHS_SHORT[Number(m.month.split('-')[1]) - 1];
      dot.innerHTML = `<i>${m.ok ? icon('check', 12, 3) : ''}</i><span>${label}</span>`;
      dot.title = m.now ? `Этот месяц: ${Fmt.money(st.thisMonth.spent)}` : `${label}: ${Fmt.money(m.spent)}`;
      return dot;
    }));
    $('#st-budget-hint').textContent = st.budget > 0
      ? (st.thisMonth.ok ? `Этот месяц идёт по плану · рекорд ${st.best} ${months(st.best)}` : `В этом месяце бюджет превышен · рекорд ${st.best} ${months(st.best)}`)
      : 'Задайте бюджет в профиле — и серия начнётся';

    // Серия дней
    animateNumber($('#st-visit-num'), a.visit.days);
    $('#st-visit-unit').textContent = days(a.visit.days);
    const filled = Math.min(a.visit.days, 7);
    $('#st-week').replaceChildren(...Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const el = document.createElement('span');
      el.className = 'wdot' + (i >= 7 - filled ? ' on' : '') + (i === 6 ? ' today' : '');
      el.innerHTML = `<i>${i >= 7 - filled ? icon('flame', 12, 2.4) : ''}</i><span>${['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][d.getDay()]}</span>`;
      return el;
    }));
    $('#st-visit-hint').textContent = `Рекорд — ${a.visit.best} ${days(a.visit.best)}. Заходите каждый день, чтобы не прервать серию`;

    // Экономия
    animateNumber($('#st-saved'), a.savings.yearly, Fmt.money);
    $('#st-saved-list').innerHTML = a.savings.items.length
      ? a.savings.items.slice(0, 4).map((x) => `<div class="saved-row"><span>${esc(x.name)}</span><span class="medium c-success">+${Fmt.money(x.monthly * 12)}/год</span></div>`).join('')
      : '<div class="small muted">Отмените ненужную подписку или поставьте на паузу — здесь появится, сколько вы сэкономите за год</div>';

    // Награды
    $('#ach-count').textContent = `${a.unlocked} из ${a.total}`;
    setBar($('#ach-bar'), (a.unlocked / a.total) * 100);
    const sorted = [...a.achievements].sort((x, y) => (y.unlocked - x.unlocked) || (y.value / y.goal - x.value / x.goal));
    $('#ach-grid').replaceChildren(...sorted.map((x, i) => {
      const card = fromTemplate('tpl-ach');
      card.classList.toggle('locked', !x.unlocked);
      revealIndex(card, i);
      const ic = part(card, 'icon');
      ic.style.setProperty('--c', x.color);
      ic.innerHTML = icon(x.icon, 22) + (x.unlocked ? '' : `<span class="lock">${icon('lock', 11, 2.6)}</span>`);
      setText(card, {
        title: x.title, desc: x.desc,
        progress: x.unlocked ? `Получено ${Fmt.date(x.date)}` : (x.goal > 1 ? `${x.value.toLocaleString('ru-RU')} из ${x.goal.toLocaleString('ru-RU')}` : 'Ещё не получено'),
      });
      const bar = part(card, 'bar');
      if (x.unlocked || x.goal === 1) bar.parentElement.classList.add('hidden');
      else setBar(bar, (x.value / x.goal) * 100, x.color);
      return card;
    }));
  }

  document.addEventListener('DOMContentLoaded', watchTheme);
  if (document.readyState !== 'loading') watchTheme();

  return { celebrate, event, renderStrip, initPage };
})();
