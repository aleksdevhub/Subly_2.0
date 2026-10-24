// =========================================================
//  Категории. Разметка — в categories.html,
//  здесь загрузка данных, карточки и окно категории.
// =========================================================

const Cat = { list: [], selectedId: null, subs: [], firstLoad: true };

async function initCategories() {
  initApp();
  $('#new-cat').addEventListener('click', () => openCategoryForm());
  $('#edit-cat').addEventListener('click', () => openCategoryForm(selected()));
  $('#add-sub').addEventListener('click', () => openSubscriptionForm({ categoryId: Cat.selectedId, onSaved: reloadAll }));

  const id = Number(new URLSearchParams(location.search).get('id'));
  if (id) Cat.selectedId = id;
  await loadCategories();
  refreshSidebar();
}

const selected = () => Cat.list.find((x) => x.id === Cat.selectedId);
const subsWord = (n) => `${n} ${plural(n, 'подписка', 'подписки', 'подписок')}`;

async function loadCategories() {
  try {
    Cat.list = await api('/api/categories');
  } catch (err) { toast(err.message, 'error'); return; }

  const totalSubs = Cat.list.reduce((s, c) => s + c.subscriptionsCount, 0);
  const totalMonthly = Cat.list.reduce((s, c) => s + c.monthlyTotal, 0);
  const used = Cat.list.filter((c) => c.subscriptionsCount > 0).length;
  $('#cat-sub').textContent = `${subsWord(totalSubs)} в ${used} ${plural(used, 'категории', 'категориях', 'категориях')} · ${Fmt.money(totalMonthly)} в месяц`;

  if (!selected()) {
    Cat.selectedId = (Cat.list.find((c) => c.subscriptionsCount > 0) || Cat.list[0])?.id ?? null;
  }
  renderGrid(totalMonthly);
  await loadDetail();
  Cat.firstLoad = false;
}

// ---------- Сетка карточек ----------
function renderGrid(totalMonthly) {
  const cards = Cat.list.map((c, i) => {
    const share = totalMonthly > 0 ? (c.monthlyTotal / totalMonthly) * 100 : 0;
    const card = fromTemplate('tpl-cat-card');
    card.dataset.id = c.id;
    card.classList.toggle('selected', c.id === Cat.selectedId);
    if (Cat.firstLoad) revealIndex(card, i + 1); else card.classList.remove('reveal');

    const tile = part(card, 'tile');
    tile.style.background = catColor(c.color);
    tile.innerHTML = icon(c.icon, 22);
    setText(card, {
      name: c.name,
      count: subsWord(c.subscriptionsCount),
      sum: Fmt.money(c.monthlyTotal),
      share: `${Fmt.percent(share)} от всех расходов`,
    });
    setBar(part(card, 'bar'), share, catColor(c.color));

    // Клик по карточке — показать её подписки ниже
    const select = () => {
      Cat.selectedId = c.id;
      $$('.cat-card').forEach((x) => x.classList.toggle('selected', x === card));
      history.replaceState(null, '', `/categories.html?id=${c.id}`);
      loadDetail();
    };
    card.addEventListener('click', select);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') select(); });

    part(card, 'more').addEventListener('click', (e) => {
      e.stopPropagation();
      showMenu(e.currentTarget, [
        { label: 'Изменить', icon: 'edit', onClick: () => openCategoryForm(c) },
        { label: 'Удалить', icon: 'trash', danger: true, onClick: () => deleteCategory(c) },
      ]);
    });
    return card;
  });

  const add = fromTemplate('tpl-cat-add');
  if (Cat.firstLoad) revealIndex(add, Cat.list.length + 1); else add.classList.remove('reveal');
  add.addEventListener('click', () => openCategoryForm());

  $('#grid').replaceChildren(...cards, add);
}

// ---------- Подписки выбранной категории ----------
async function loadDetail() {
  const c = selected();
  $('#detail').classList.toggle('hidden', !c);
  if (!c) return;
  try {
    Cat.subs = await api(`/api/subscriptions?categoryId=${c.id}`);
  } catch (err) { toast(err.message, 'error'); return; }

  const tile = $('#d-tile');
  tile.style.background = catColor(c.color);
  tile.innerHTML = icon(c.icon, 20);
  $('#d-name').textContent = c.name;
  $('#d-meta').textContent = `${subsWord(c.subscriptionsCount)} · ${Fmt.money(c.monthlyTotal)} в месяц · ${Fmt.money(c.monthlyTotal * 12)} в год`;

  $('#detail-empty').classList.toggle('hidden', Cat.subs.length > 0);
  renderSubRows($('#detail-list'), Cat.subs, reloadAll);
}

async function reloadAll() {
  await loadCategories();
  refreshSidebar();
}

async function deleteCategory(c) {
  if (c.subscriptionsCount > 0) {
    toast(`Сначала перенесите или удалите ${c.subscriptionsCount} ${plural(c.subscriptionsCount, 'подписку', 'подписки', 'подписок')} из этой категории`, 'error');
    return;
  }
  const ok = await confirmDialog({
    title: `Удалить категорию «${c.name}»?`,
    text: 'Категория исчезнет из списка. История платежей сохранится.',
  });
  if (!ok) return;
  try {
    await api(`/api/categories/${c.id}`, { method: 'DELETE' });
    toast('Категория удалена');
    if (Cat.selectedId === c.id) Cat.selectedId = null;
    await loadCategories();
  } catch (err) { toast(err.message, 'error'); }
}

// ---------- Окно создания / изменения категории ----------
function openCategoryForm(cat = null) {
  const state = { icon: cat?.icon ?? 'grid', color: cat?.color ?? CATEGORY_COLORS[1] };
  const m = openModal('modal-category');
  const el = m.el;

  part(el, 'title').textContent = cat ? 'Изменить категорию' : 'Новая категория';
  $('#cat-name', el).value = cat?.name ?? '';
  $('#cat-save', el).textContent = cat ? 'Сохранить' : 'Создать';

  // Предпросмотр плитки обновляется сразу при выборе цвета или иконки
  const preview = () => {
    const p = part(el, 'preview');
    p.style.background = catColor(state.color);
    p.innerHTML = icon(state.icon, 24);
  };
  preview();

  // Кнопки цветов
  $('#swatches', el).replaceChildren(...CATEGORY_COLORS.map((col) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (col.toUpperCase() === state.color.toUpperCase() ? ' selected' : '');
    b.style.background = col;
    b.setAttribute('aria-label', col);
    b.addEventListener('click', () => {
      state.color = col;
      $$('.swatch', el).forEach((x) => x.classList.toggle('selected', x === b));
      preview();
    });
    return b;
  }));

  // Кнопки иконок
  $('#icon-pick', el).replaceChildren(...CATEGORY_ICONS.map((ic) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = ic === state.icon ? 'selected' : '';
    b.setAttribute('aria-label', ic);
    b.innerHTML = icon(ic, 20);
    b.addEventListener('click', () => {
      state.icon = ic;
      $$('#icon-pick button', el).forEach((x) => x.classList.toggle('selected', x === b));
      preview();
    });
    return b;
  }));

  $('#cat-form', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#cat-name').value.trim();
    setFieldError('cat-name', name ? null : 'Введите название');
    if (!name) return;
    const btn = $('#cat-save');
    setLoading(btn, true, 'Сохраняем…');
    try {
      const saved = await api(cat ? `/api/categories/${cat.id}` : '/api/categories', {
        method: cat ? 'PUT' : 'POST', body: { name, icon: state.icon, color: state.color },
      });
      m.close();
      toast(cat ? 'Категория обновлена' : 'Категория создана');
      Cat.selectedId = saved.id;
      await loadCategories();
    } catch (err) {
      showFormError($('#cat-msg'), err.message);
      setLoading(btn, false);
    }
  });
}
