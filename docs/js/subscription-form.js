// =========================================================
//  Подписки: строка списка (шаблон tpl-sub-row), меню действий
//  и окно добавления / изменения (шаблон modal-subscription)
// =========================================================

/** Создаёт строку подписки из шаблона <template id="tpl-sub-row"> */
function createSubRow(s, index = 0, animate = true) {
  const row = fromTemplate('tpl-sub-row');
  row.dataset.id = s.id;
  row.classList.toggle('inactive', !s.isActive);
  // Строки появляются по очереди (только при загрузке страницы, не при поиске)
  if (animate) {
    row.classList.add('reveal');
    revealIndex(row, index);
  }

  const tile = part(row, 'tile');
  tile.style.background = catColor(s.categoryColor);
  tile.innerHTML = icon(s.categoryIcon, 22);

  setText(row, {
    name: s.name,
    meta: `${s.categoryName} · ${Fmt.periodName(s.billingPeriod)}${s.paymentMethod ? ' · ' + s.paymentMethod : ''}`,
    date: s.isActive ? Fmt.date(s.nextPaymentDate) : '—',
    due: s.isActive ? Fmt.daysLeft(s.daysUntilPayment) : 'на паузе',
    price: Fmt.money(s.price),
    period: Fmt.period(s.billingPeriod),
  });
  // Списание в ближайшие 3 дня выделяем оранжевым
  if (s.isActive && s.daysUntilPayment <= 3) part(row, 'due').className = 'small c-warning';
  return row;
}

/** Выводит список подписок в контейнер и подключает меню «⋯» */
function renderSubRows(container, subs, onChanged, animate = true) {
  container.replaceChildren(...subs.map((s, i) => createSubRow(s, i, animate)));
  $$('.sub-row', container).forEach((row) => {
    const s = subs.find((x) => x.id === +row.dataset.id);
    part(row, 'more').addEventListener('click', (e) => {
      e.stopPropagation();
      showSubscriptionMenu(e.currentTarget, s, onChanged);
    });
  });
}

/** Меню действий подписки: изменить, пауза/возобновить, удалить */
function showSubscriptionMenu(anchor, s, onChanged) {
  showMenu(anchor, [
    { label: 'Изменить', icon: 'edit', onClick: () => openSubscriptionForm({ sub: s, onSaved: onChanged }) },
    {
      label: s.isActive ? 'Поставить на паузу' : 'Возобновить', icon: s.isActive ? 'pause' : 'play',
      onClick: async () => {
        try {
          await api(`/api/subscriptions/${s.id}`, { method: 'PUT', body: toRequest(s, { isActive: !s.isActive }) });
          toast(s.isActive ? 'Подписка на паузе — списания не учитываются' : 'Подписка снова активна');
          onChanged();
        } catch (err) { toast(err.message, 'error'); }
      },
    },
    {
      label: 'Удалить', icon: 'trash', danger: true,
      onClick: async () => {
        const ok = await confirmDialog({
          title: `Удалить «${s.name}»?`,
          text: 'Подписка исчезнет из списка, а история её платежей сохранится в аналитике.',
        });
        if (!ok) return;
        try {
          await api(`/api/subscriptions/${s.id}`, { method: 'DELETE' });
          toast('Подписка удалена');
          onChanged();
        } catch (err) { toast(err.message, 'error'); }
      },
    },
  ]);
}

function toRequest(s, patch = {}) {
  return {
    name: s.name, categoryId: s.categoryId, price: s.price, billingPeriod: s.billingPeriod,
    nextPaymentDate: s.nextPaymentDate, paymentMethod: s.paymentMethod, isActive: s.isActive, ...patch,
  };
}

/**
 * Окно добавления / изменения подписки.
 * sub — подписка для изменения (нет — новая), categoryId — категория по умолчанию.
 */
async function openSubscriptionForm({ sub = null, categoryId = null, onSaved } = {}) {
  let categories;
  try { categories = await api('/api/categories'); } catch (err) { toast(err.message, 'error'); return; }
  if (!categories.length) {
    toast('Сначала создайте хотя бы одну категорию', 'error');
    return;
  }

  const isEdit = !!sub;
  const m = openModal('modal-subscription');
  const el = m.el;

  // Заголовок окна
  part(el, 'head-icon').innerHTML = icon(isEdit ? 'edit' : 'plus', 24);
  setText(el, {
    title: isEdit ? 'Изменить подписку' : 'Новая подписка',
    subtitle: isEdit ? 'Изменения применятся к будущим списаниям.'
      : 'Укажите стоимость и дату следующего списания — остальное Subly посчитает сам.',
  });

  // Заполняем поля
  const select = $('#sub-cat', el);
  select.replaceChildren(...categories.map((c) => new Option(c.name, c.id)));
  select.value = sub?.categoryId ?? categoryId ?? categories[0].id;

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  $('#sub-name', el).value = sub?.name ?? '';
  $('#sub-price', el).value = sub?.price ?? '';
  $('#sub-period', el).value = sub?.billingPeriod ?? 'monthly';
  $('#sub-date', el).value = sub?.nextPaymentDate ?? Fmt.iso(tomorrow);
  $('#sub-method', el).value = sub?.paymentMethod ?? '';
  if (isEdit) {
    $('#sub-active-wrap', el).classList.remove('hidden');
    $('#sub-active', el).checked = sub.isActive;
  }
  $('#sub-save', el).textContent = isEdit ? 'Сохранить' : 'Добавить';

  $('#sub-form', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: $('#sub-name').value.trim(),
      categoryId: +$('#sub-cat').value,
      price: parseFloat(String($('#sub-price').value).replace(',', '.')),
      billingPeriod: $('#sub-period').value,
      nextPaymentDate: $('#sub-date').value,
      paymentMethod: $('#sub-method').value.trim() || null,
      isActive: isEdit ? $('#sub-active').checked : true,
    };
    setFieldError('sub-name', body.name ? null : 'Введите название');
    setFieldError('sub-price', body.price > 0 ? null : 'Укажите стоимость больше нуля');
    setFieldError('sub-date', body.nextPaymentDate ? null : 'Выберите дату');
    if (!body.name || !(body.price > 0) || !body.nextPaymentDate) return;

    const btn = $('#sub-save');
    setLoading(btn, true, 'Сохраняем…');
    try {
      await api(isEdit ? `/api/subscriptions/${sub.id}` : '/api/subscriptions', { method: isEdit ? 'PUT' : 'POST', body });
      m.close();
      toast(isEdit ? 'Подписка обновлена' : 'Подписка добавлена');
      onSaved?.();
    } catch (err) {
      showFormError($('#sub-msg'), err.message);
      setLoading(btn, false);
    }
  });
}
