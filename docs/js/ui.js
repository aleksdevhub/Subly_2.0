// =========================================================
//  Общие функции интерфейса: шаблоны, поля, окна, меню,
//  уведомления и небольшие анимации
// =========================================================

// ---------- Шаблоны <template> из HTML ----------

/** Копия первого элемента из <template id="..."> с уже вставленными иконками */
function fromTemplate(id) {
  const node = document.getElementById(id).content.firstElementChild.cloneNode(true);
  hydrateIcons(node);
  return node;
}

/** Элемент с атрибутом data-f="name" внутри node */
function part(node, name) {
  return node.querySelector(`[data-f="${name}"]`);
}

/** Записать текст в элементы data-f: setText(row, { name: 'Okko', price: '399 ₽' }) */
function setText(node, values) {
  Object.entries(values).forEach(([name, value]) => {
    const el = part(node, name);
    if (el) el.textContent = value;
  });
}

/** Номер для поочерёдного появления (анимация .reveal в animations.css) */
function revealIndex(el, i) {
  el.style.setProperty('--i', i);
  return el;
}

// ---------- Поля ввода ----------

/** Кнопки «показать / скрыть пароль» */
function bindPasswordToggles(root = document) {
  $$('.toggle-pwd', root).forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.for);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = icon(show ? 'eyeOff' : 'eye', 20);
      btn.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
    });
  });
}

/** Подсветить поле с ошибкой и показать текст под ним (null — убрать ошибку) */
function setFieldError(id, message) {
  const input = document.getElementById(id);
  const hint = document.getElementById(id + '-hint');
  input?.closest('.input-wrap')?.classList.toggle('invalid', !!message);
  if (!hint) return;
  if (message) {
    hint.textContent = message;
    hint.className = 'hint error';
  } else if (hint.classList.contains('error')) {
    hint.className = 'hint hidden';
  }
}

/** Блок с ошибкой над формой */
function showFormError(container, message) {
  container.innerHTML = message ? `<div class="form-error">${icon('alert', 18)}<span>${esc(message)}</span></div>` : '';
}

/** Состояние «загрузка» для кнопки */
function setLoading(btn, loading, text) {
  if (loading) {
    btn.dataset.html = btn.innerHTML;
    btn.disabled = true;
    if (text) btn.textContent = text;
  } else {
    btn.disabled = false;
    if (btn.dataset.html) btn.innerHTML = btn.dataset.html;
  }
}

/** Надёжность пароля: 0..4 */
function passwordStrength(pwd) {
  const long8 = pwd.length >= 8;
  const mixed = /\p{L}/u.test(pwd) && /\d/.test(pwd);
  const long12 = pwd.length >= 12;
  const special = /[^\p{L}\d]/u.test(pwd) || (/[a-zа-яё]/.test(pwd) && /[A-ZА-ЯЁ]/.test(pwd));
  let score = [long8, mixed, long12, special].filter(Boolean).length;
  if (!long8 || !mixed) score = Math.min(score, 1);
  const labels = ['Слишком простой', 'Слабый пароль', 'Средний пароль', 'Надёжный пароль', 'Очень надёжный пароль'];
  const colors = ['var(--danger)', 'var(--danger)', 'var(--warning)', 'var(--success)', 'var(--success)'];
  return { score, label: labels[score], color: colors[score] };
}

/** Проверка пароля — те же правила, что и на сервере */
function validatePassword(pwd) {
  if (!pwd || pwd.length < 8) return 'Пароль должен быть не короче 8 символов';
  if (!/\p{L}/u.test(pwd) || !/\d/.test(pwd)) return 'Пароль должен содержать буквы и цифры';
  return null;
}

// ---------- Модальные окна ----------

/**
 * Открыть окно из <template id="...">. Возвращает { el, close }.
 * Кнопки с атрибутом data-close закрывают окно, также работает Esc и клик по фону.
 */
function openModal(templateId, { onClose } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = fromTemplate(templateId);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    document.body.style.overflow = '';
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  $$('[data-close]', modal).forEach((b) => b.addEventListener('click', close));
  bindPasswordToggles(modal);
  setTimeout(() => modal.querySelector('input:not([type=checkbox]), select')?.focus(), 30);
  return { el: modal, close };
}

/** Окно подтверждения удаления. Возвращает Promise<boolean>. */
function confirmDialog({ title, text, confirmText = 'Удалить' }) {
  return new Promise((resolve) => {
    let result = false;
    const m = openModal('modal-confirm', { onClose: () => resolve(result) });
    setText(m.el, { title, text, ok: confirmText });
    part(m.el, 'ok').addEventListener('click', () => { result = true; m.close(); });
  });
}

// ---------- Выпадающее меню «⋯» ----------

let openMenuEl = null;
function closeMenu() { openMenuEl?.remove(); openMenuEl = null; }
document.addEventListener('click', closeMenu);
window.addEventListener('scroll', closeMenu, true);

/** items: [{ label, icon, danger, onClick }] */
function showMenu(anchor, items) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.innerHTML = items.map((it, i) =>
    `<button type="button" data-i="${i}" class="${it.danger ? 'danger' : ''}">${icon(it.icon, 18)}${esc(it.label)}</button>`).join('');
  document.body.appendChild(menu);

  const r = anchor.getBoundingClientRect();
  // Если снизу не хватает места — открываем меню вверх
  const fitsBelow = r.bottom + 6 + menu.offsetHeight <= window.innerHeight - 8;
  menu.style.top = ((fitsBelow ? r.bottom + 6 : r.top - 6 - menu.offsetHeight) + window.scrollY) + 'px';
  menu.style.left = Math.max(8, r.right - menu.offsetWidth + window.scrollX) + 'px';
  menu.style.transformOrigin = fitsBelow ? 'top right' : 'bottom right';

  menu.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    e.stopPropagation();
    closeMenu();
    items[+b.dataset.i].onClick();
  });
  openMenuEl = menu;
}

// ---------- Уведомление внизу экрана ----------

function toast(message, type = 'ok') {
  $$('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'error' ? ' error' : '');
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ---------- Подсказка над столбиками графика ----------

const Tooltip = {
  el: null,
  show(text, x, y) {
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.className = 'tooltip';
      document.body.appendChild(this.el);
    }
    this.el.textContent = text;
    this.el.style.left = x + 'px';
    this.el.style.top = (y - 8) + 'px';
    this.el.style.display = 'block';
  },
  hide() { if (this.el) this.el.style.display = 'none'; },
};

// ---------- Анимации ----------

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Плавный счётчик: число «набегает» от 0 до нужного значения.
 * format — функция, которая превращает число в текст (например, Fmt.money).
 */
function animateNumber(el, value, format = String, duration = 900) {
  const target = Number(value) || 0;
  if (reduceMotion || target === 0) { el.textContent = format(target); return; }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // плавное замедление в конце
    const current = t < 1 ? Math.round(target * eased) : target;
    el.textContent = format(current);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Полоса прогресса растёт от 0 до нужной ширины (переход задан в animations.css) */
function setBar(span, percent, color) {
  if (color) span.style.background = color;
  span.style.width = '0%';
  requestAnimationFrame(() => requestAnimationFrame(() => { span.style.width = Math.max(0, Math.min(100, percent)) + '%'; }));
}
