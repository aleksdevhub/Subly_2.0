// =========================================================
//  Напоминания о списаниях через календарь телефона.
//  Сервер не нужен: Subly создаёт повторяющееся событие (каждый месяц
//  или год) с напоминанием, а уведомление присылает сам календарь.
//  Два способа: ссылка в Google Календарь или файл .ics (iPhone, Android, Outlook).
// =========================================================

const SublyCalendar = (() => {
  const TG = window.Telegram && window.Telegram.WebApp;
  const inTelegram = !!(TG && TG.initData);

  // Когда напомнить: в день списания, за день или за 3 дня — в 10:00
  const REMIND = [
    { days: 1, label: 'За день', trigger: '-PT14H' },
    { days: 3, label: 'За 3 дня', trigger: '-P2DT14H' },
    { days: 0, label: 'В день списания', trigger: 'PT10H' },
  ];
  const REMIND_KEY = 'subly_cal_remind';

  const money = (n) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽';
  const ymd = (iso) => iso.replace(/-/g, '');
  function nextDay(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + 1));
    return dt.toISOString().slice(0, 10);
  }

  /** Правило повтора. 29–31 число бывает не в каждом месяце — тогда «последний день месяца» */
  function rrule(s) {
    if (s.billingPeriod === 'yearly') return 'FREQ=YEARLY';
    const day = Number(s.nextPaymentDate.slice(8, 10));
    return day > 28 ? 'FREQ=MONTHLY;BYMONTHDAY=-1' : 'FREQ=MONTHLY';
  }

  const title = (s) => `Списание: ${s.name} — ${money(s.price)}`;
  const details = (s) => `${s.billingPeriod === 'yearly' ? 'Ежегодная' : 'Ежемесячная'} подписка. `
    + 'Если она больше не нужна — отмените заранее. Напоминание создано в Subly.';

  // ---------- Файл .ics (стандарт iCalendar, RFC 5545) ----------
  const escText = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  /** Строки длиннее 75 байт по стандарту переносятся (русские буквы — по 2 байта) */
  function fold(line) {
    const enc = new TextEncoder();
    if (enc.encode(line).length <= 75) return line;
    const parts = [];
    let cur = '', size = 0;
    for (const ch of line) {
      const b = enc.encode(ch).length;
      if (size + b > (parts.length ? 74 : 75)) { parts.push(cur); cur = ''; size = 0; }
      cur += ch; size += b;
    }
    parts.push(cur);
    return parts.join('\r\n ');
  }

  function buildIcs(subs, remindDays) {
    const r = REMIND.find((x) => x.days === remindDays) || REMIND[0];
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Subly//Podpiski//RU', 'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH', 'X-WR-CALNAME:Subly — списания'];
    for (const s of subs) {
      lines.push('BEGIN:VEVENT',
        `UID:subly-${s.id}-${ymd(s.nextPaymentDate)}@subly`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${ymd(s.nextPaymentDate)}`,
        `DTEND;VALUE=DATE:${ymd(nextDay(s.nextPaymentDate))}`,
        `RRULE:${rrule(s)}`,
        `SUMMARY:${escText(title(s))}`,
        `DESCRIPTION:${escText(details(s))}`,
        'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escText(title(s))}`, `TRIGGER:${r.trigger}`, 'END:VALARM',
        'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  function googleUrl(s) {
    const p = new URLSearchParams({
      action: 'TEMPLATE', text: title(s), details: details(s),
      dates: `${ymd(s.nextPaymentDate)}/${ymd(nextDay(s.nextPaymentDate))}`,
      recur: `RRULE:${rrule(s)}`,
    });
    return 'https://calendar.google.com/calendar/render?' + p.toString();
  }

  // ---------- Открыть ссылку / скачать файл ----------
  function openLink(url) {
    if (inTelegram && TG.openLink) TG.openLink(url);
    else window.open(url, '_blank', 'noopener');
  }

  function downloadIcs(subs, remindDays, fileName = 'subly.ics') {
    const blob = new Blob([buildIcs(subs, remindDays)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // Внутри Telegram скачать файл нельзя — открываем в браузере страницу ics.html,
  // данные передаём после «#»: они не уходят ни на какой сервер
  const pack = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  function unpack(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  }
  const slim = (s) => ({ id: s.id, name: s.name, price: s.price, billingPeriod: s.billingPeriod, nextPaymentDate: s.nextPaymentDate });

  function saveIcs(subs, remindDays) {
    if (inTelegram) {
      const base = location.href.replace(/[^/]*([?#].*)?$/, '');
      openLink(`${base}ics.html#${pack({ r: remindDays, s: subs.map(slim) })}`);
    } else {
      downloadIcs(subs, remindDays, subs.length === 1 ? `subly-${translit(subs[0].name)}.ics` : 'subly-vse-podpiski.ics');
    }
  }

  function translit(t) {
    const m = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
    return String(t).toLowerCase().split('').map((c) => m[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'podpiska';
  }

  function getRemind() {
    try {
      const raw = localStorage.getItem(REMIND_KEY);
      const v = Number(raw);
      return raw !== null && REMIND.some((r) => r.days === v) ? v : 1;   // по умолчанию — за день
    } catch { return 1; }
  }
  function setRemind(v) { try { localStorage.setItem(REMIND_KEY, String(v)); } catch { /* ignore */ } }

  // ---------- Окно «Напомнить в календаре» ----------
  /** subs — одна подписка или список (кнопка в профиле) */
  function open(subs) {
    const list = (Array.isArray(subs) ? subs : [subs]).filter((s) => s.isActive !== false);
    if (!list.length) { toast('Нет активных подписок', 'error'); return; }
    const one = list.length === 1 ? list[0] : null;
    let remind = getRemind();

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal cal-modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div class="tile tile-lg tile-accent">${icon('calendar', 24)}</div>
          <button type="button" class="close-btn" data-close aria-label="Закрыть">${icon('x', 18)}</button>
        </div>
        <div class="modal-title">
          <h2 class="h2">${one ? 'Напомнить о списании' : 'Все списания в календарь'}</h2>
          <p class="muted">${one
            ? `${esc(one.name)} · ${money(one.price)} ${one.billingPeriod === 'yearly' ? 'раз в год' : 'каждый месяц'}. Календарь телефона сам пришлёт уведомление.`
            : `${list.length} ${plural(list.length, 'подписка', 'подписки', 'подписок')} — каждая станет повторяющимся событием с напоминанием.`}</p>
        </div>
        <div class="cal-field">
          <span class="small muted">Когда напомнить</span>
          <div class="chips cal-remind">${REMIND.map((r) => `<button type="button" class="chip${r.days === remind ? ' active' : ''}" data-days="${r.days}">${r.label}</button>`).join('')}</div>
        </div>
        <div class="cal-actions">
          <button type="button" class="btn btn-primary btn-block" data-ics>${icon('download', 16)}${inTelegram ? 'Календарь телефона' : 'Скачать для календаря (.ics)'}</button>
          ${one ? `<button type="button" class="btn btn-secondary btn-block" data-google>${icon('calendar', 16)}Google Календарь</button>` : ''}
        </div>
        <p class="small faint cal-hint">${inTelegram
          ? 'Откроется браузер — нажмите «Скачать» и откройте файл: iPhone и Android предложат добавить события в календарь.'
          : 'Откройте скачанный файл — календарь предложит добавить события.'}
          ${one ? ' В Google Календаре время напоминания берётся из его настроек.' : ''} Если поменяете цену или дату — добавьте событие заново.</p>
      </div>`;
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';

    const close = () => {
      backdrop.remove(); document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    backdrop.querySelector('[data-close]').addEventListener('click', close);
    backdrop.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => {
      remind = Number(b.dataset.days); setRemind(remind);
      backdrop.querySelectorAll('[data-days]').forEach((x) => x.classList.toggle('active', x === b));
    }));
    backdrop.querySelector('[data-ics]').addEventListener('click', () => { saveIcs(list, remind); if (!inTelegram) toast('Файл календаря скачан'); });
    backdrop.querySelector('[data-google]')?.addEventListener('click', () => openLink(googleUrl(one)));
  }

  return { REMIND, buildIcs, googleUrl, downloadIcs, unpack, open, translit };
})();
