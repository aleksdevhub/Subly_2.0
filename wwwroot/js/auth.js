// =========================================================
//  Страницы входа и регистрации.
//  Разметка форм — в login.html и register.html, здесь только логика.
// =========================================================

/** Если уже вошли — сразу на главную */
function redirectIfLoggedIn() {
  if (Auth.token) location.replace('/dashboard.html');
}

// ---------- Вход ----------
function initLogin() {
  redirectIfLoggedIn();
  const form = $('#login-form');
  bindPasswordToggles(form);

  const params = new URLSearchParams(location.search);
  if (params.has('expired')) showFormError($('#form-msg'), 'Сессия истекла. Войдите снова.');
  if (params.has('deleted')) {
    $('#form-msg').innerHTML = `<div class="form-error form-success">${icon('check', 18)}<span>Аккаунт удалён. Будем рады видеть вас снова.</span></div>`;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#email').value.trim();
    const password = $('#password').value;
    setFieldError('email', email ? null : 'Введите почту');
    setFieldError('password', password ? null : 'Введите пароль');
    if (!email || !password) return;

    const btn = $('#submit');
    setLoading(btn, true, 'Входим…');
    try {
      const res = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      Auth.save(res.token, res.user);
      location.href = '/dashboard.html';
    } catch (err) {
      showFormError($('#form-msg'), err.message);
      setLoading(btn, false);
    }
  });
}

// ---------- Регистрация ----------
function initRegister() {
  redirectIfLoggedIn();
  const form = $('#register-form');
  bindPasswordToggles(form);

  // Подсказка о совпадении паролей прямо при вводе
  $('#password2').addEventListener('input', () => {
    const a = $('#password').value, b = $('#password2').value;
    const hint = $('#password2-hint');
    if (!b) { hint.className = 'hint hidden'; return; }
    hint.textContent = a === b ? 'Пароли совпадают' : 'Пароли не совпадают';
    hint.className = 'hint ' + (a === b ? 'ok' : 'error');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#name').value.trim();
    const email = $('#email').value.trim();
    const password = $('#password').value;
    const password2 = $('#password2').value;

    const errors = {
      name: name.length < 2 ? 'Введите имя (минимум 2 символа)' : null,
      email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? null : 'Некорректный адрес почты',
      password: validatePassword(password),
      password2: password !== password2 ? 'Пароли не совпадают' : null,
    };
    Object.entries(errors).forEach(([id, msg]) => setFieldError(id, msg));
    if (!errors.password) {
      const h = $('#password-hint');
      h.textContent = 'Минимум 8 символов, буквы и цифры';
      h.className = 'hint';
    }
    if (Object.values(errors).some(Boolean)) return;
    if (!$('#agree').checked) {
      showFormError($('#form-msg'), 'Нужно принять условия использования');
      return;
    }

    const btn = $('#submit');
    setLoading(btn, true, 'Создаём аккаунт…');
    try {
      const res = await api('/api/auth/register', { method: 'POST', body: { name, email, password } });
      Auth.save(res.token, res.user);
      location.href = '/dashboard.html?welcome=1';
    } catch (err) {
      showFormError($('#form-msg'), err.message);
      setLoading(btn, false);
    }
  });
}
