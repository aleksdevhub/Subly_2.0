// =========================================================
//  Боковое меню (разметка — в каждом HTML-файле) и проверка входа
// =========================================================

/** Если пользователь не вошёл — отправляем на страницу входа */
function requireAuth() {
  if (!Auth.token) {
    location.replace('/login.html');
    throw new Error('not authenticated');
  }
}

/** Запуск страницы приложения: проверка входа, данные пользователя в меню, кнопка «Выйти» */
function initApp() {
  requireAuth();
  updateSidebar(null, Auth.user);
  // Данные в браузере могли устареть (например, после обновления сайта) — берём свежие с сервера
  refreshSidebar();
  $('#logout-btn').addEventListener('click', () => {
    Auth.clear();
    location.href = '/login.html';
  });
}

/** Обновляет имя, почту и карточку бюджета в меню */
function updateSidebar(stats, user) {
  if (user) {
    $('#sb-name').textContent = user.name;
    $('#sb-email').textContent = user.email;
    $('#sb-avatar').textContent = initials(user.name);
  }
  if (!stats) return;

  const monthIdx = Number(stats.month.split('-')[1]) - 1;
  $('#sb-budget-title').textContent = 'Бюджет на ' + MONTHS_NOM[monthIdx].toLowerCase();
  $('#sb-budget-spent').textContent = Fmt.money(stats.monthTotal);

  const track = $('#sb-budget-track');
  if (stats.budget > 0) {
    const left = stats.budget - stats.monthTotal;
    $('#sb-budget-total').textContent = 'из ' + Fmt.money(stats.budget);
    $('#sb-budget-left').textContent = left >= 0 ? 'Осталось ' + Fmt.money(left) : 'Превышен на ' + Fmt.money(-left);
    track.classList.remove('hidden');
    track.classList.toggle('over', left < 0);
    setBar(track.firstElementChild, (stats.monthTotal / stats.budget) * 100);
  } else {
    $('#sb-budget-total').textContent = 'бюджет не задан';
    $('#sb-budget-left').textContent = '';
    track.classList.add('hidden');
  }
}

/** Загрузить профиль и обновить меню (для страниц, которые сами профиль не загружают) */
async function refreshSidebar() {
  try {
    const p = await api('/api/profile');
    Auth.save(Auth.token, p.user);
    updateSidebar(p.stats, p.user);
    return p;
  } catch { return null; }
}
