// =========================================================
//  Боковое меню (разметка — в каждом HTML-файле).
//  В мини-приложении вход не нужен: пользователя знает Telegram.
// =========================================================

/** Запуск страницы: данные пользователя в меню */
function initApp() {
  // Кнопка «Выйти» в Telegram не нужна — приложение закрывается крестиком Telegram
  $('#logout-btn')?.remove();
  updateSidebar(null, Auth.user);
  refreshSidebar();
}

/** Аватар: фото из Telegram или инициалы */
function setAvatar(el, user) {
  if (!el || !user) return;
  if (user.photoUrl) {
    el.textContent = '';
    el.style.backgroundImage = `url("${user.photoUrl}")`;
    el.classList.add('has-photo');
  } else {
    el.textContent = initials(user.name);
  }
}

/** Обновляет имя, Telegram-ник и карточку бюджета в меню */
function updateSidebar(stats, user) {
  if (user) {
    $('#sb-name').textContent = user.name;
    $('#sb-email').textContent = user.email;
    setAvatar($('#sb-avatar'), user);
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
    $('#sb-budget-total').textContent = 'не задан';
    $('#sb-budget-left').textContent = 'Задайте бюджет в профиле';
    track.classList.add('hidden');
  }
}

/** Загрузить профиль и обновить меню */
async function refreshSidebar() {
  try {
    const p = await api('/api/profile');
    Auth.save(Auth.token, p.user);
    updateSidebar(p.stats, p.user);
    return p;
  } catch { return null; }
}
