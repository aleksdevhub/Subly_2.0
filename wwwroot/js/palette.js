// =========================================================
//  Быстрый поиск по сайту — окно по Ctrl+K (как в Linear, Notion, Vercel).
//  Ищет по разделам, действиям и подпискам пользователя.
//  Разметка окна — шаблон <template id="tpl-palette"> в HTML.
// =========================================================

const Palette = (() => {
  let subs = null;        // подписки загружаются при первом открытии
  let current = null;     // открытое окно { el, close }
  let items = [];         // пункты, которые сейчас на экране
  let active = 0;         // выбранный пункт

  const go = (url) => { location.href = url; };

  const PAGES = [
    { label: 'Главная', icon: 'home', run: () => go('/dashboard.html') },
    { label: 'Аналитика', icon: 'chart', run: () => go('/analytics.html') },
    { label: 'Категории', icon: 'grid', run: () => go('/categories.html') },
    { label: 'Профиль', icon: 'user', run: () => go('/profile.html') },
  ];

  function actions() {
    const dark = Theme.current() === 'dark';
    return [
      { label: 'Добавить подписку', icon: 'plus',
        run: () => ($('#add-btn') ? $('#add-btn').click() : go('/dashboard.html?add=1')) },
      { label: dark ? 'Включить светлую тему' : 'Включить тёмную тему', icon: dark ? 'sun' : 'moon',
        run: () => Theme.toggle() },
      { label: 'Выгрузить платежи в CSV', icon: 'download',
        run: () => ($('#export-btn') ? $('#export-btn').click() : go('/analytics.html')) },
      { label: 'Сменить пароль', icon: 'key',
        run: () => ($('#pwd-btn') ? $('#pwd-btn').click() : go('/profile.html')) },
      { label: 'Выйти из аккаунта', icon: 'logout', run: () => { Auth.clear(); go('/login.html'); } },
    ];
  }

  /** Собирает пункты под текущий запрос: группы «Подписки», «Разделы», «Действия» */
  function build(query) {
    const q = query.trim().toLowerCase();
    const match = (text) => !q || text.toLowerCase().includes(q);
    const groups = [];

    if (q && subs) {
      const found = subs.filter((s) => match(s.name) || match(s.categoryName)).slice(0, 6);
      if (found.length) groups.push({
        title: 'Подписки',
        items: found.map((s) => ({
          label: s.name,
          hint: `${s.categoryName} · ${Fmt.money(s.price)} ${Fmt.period(s.billingPeriod)}`,
          tile: { color: catColor(s.categoryColor), icon: s.categoryIcon },
          run: () => go(`/categories.html?id=${s.categoryId}`),
        })),
      });
    }
    const pages = PAGES.filter((p) => match(p.label));
    if (pages.length) groups.push({ title: 'Разделы', items: pages });
    const acts = actions().filter((a) => match(a.label));
    if (acts.length) groups.push({ title: 'Действия', items: acts });
    return groups;
  }

  function render() {
    const list = part(current.el, 'list');
    const groups = build(part(current.el, 'input').value);
    items = groups.flatMap((g) => g.items);
    active = Math.min(active, Math.max(items.length - 1, 0));

    if (!items.length) {
      list.innerHTML = '<div class="palette-empty">Ничего не найдено</div>';
      return;
    }

    let index = 0;
    list.replaceChildren(...groups.flatMap((g) => {
      const title = document.createElement('div');
      title.className = 'palette-group';
      title.textContent = g.title;
      return [title, ...g.items.map((it) => {
        const i = index++;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'palette-item' + (i === active ? ' active' : '');
        btn.innerHTML = (it.tile
          ? `<span class="tile tile-xs" style="background:${it.tile.color}">${icon(it.tile.icon, 14)}</span>`
          : `<span class="p-icon">${icon(it.icon, 18)}</span>`)
          + `<span class="p-label">${esc(it.label)}</span>`
          + (it.hint ? `<span class="p-hint">${esc(it.hint)}</span>` : '');
        btn.addEventListener('mousemove', () => { if (active !== i) { active = i; highlight(); } });
        btn.addEventListener('click', () => choose(i));
        return btn;
      })];
    }));
  }

  function highlight() {
    $$('.palette-item', current.el).forEach((b, i) => b.classList.toggle('active', i === active));
    $$('.palette-item', current.el)[active]?.scrollIntoView({ block: 'nearest' });
  }

  function choose(i) {
    const it = items[i];
    if (!it) return;
    current.close();
    it.run();
  }

  async function open() {
    if (current) return;
    current = openModal('tpl-palette', { onClose: () => { current = null; } });
    current.el.parentElement.classList.add('palette-backdrop');
    active = 0;
    const input = part(current.el, 'input');
    input.addEventListener('input', () => { active = 0; render(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(items.length, 1); highlight(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % Math.max(items.length, 1); highlight(); }
      if (e.key === 'Enter') { e.preventDefault(); choose(active); }
    });
    render();
    if (!subs) {
      try { subs = await api('/api/subscriptions'); } catch { subs = []; }
      if (current) render();
    }
  }

  // Ctrl+K (на Mac — Cmd+K) открывает и закрывает окно; работает и в русской раскладке
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
      e.preventDefault();
      if (current) current.close(); else open();
    }
  });
  document.querySelectorAll('[data-palette]').forEach((b) => b.addEventListener('click', open));

  return { open };
})();
