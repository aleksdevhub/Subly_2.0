// =========================================================
//  Как отменить подписку: пошаговые инструкции для популярных сервисов.
//  Окно открывается из меню «⋯» у подписки и из быстрого поиска.
//  Названия кнопок в сервисах иногда меняются — поэтому в каждой
//  инструкции есть ссылка на страницу, где подписка управляется.
// =========================================================

const CancelGuides = (() => {
  // Общие способы: если подписка оплачена через магазин приложений или банк
  const STORES = [
    {
      title: 'Оплачивали через iPhone (App Store)',
      steps: ['Откройте «Настройки» и нажмите на своё имя вверху', 'Выберите «Подписки»',
        'Нажмите на нужную подписку → «Отменить подписку»'],
      url: 'https://account.apple.com/account/manage/section/subscriptions',
    },
    {
      title: 'Оплачивали через Android (Google Play)',
      steps: ['Откройте Google Play и нажмите на значок профиля', 'Выберите «Платежи и подписки» → «Подписки»',
        'Откройте подписку и нажмите «Отменить подписку»'],
      url: 'https://play.google.com/store/account/subscriptions',
    },
    {
      title: 'Списывается с карты, а где оформлено — непонятно',
      steps: ['Найдите списание в приложении банка — там видно название сервиса',
        'В приложении банка откройте раздел «Подписки» или «Автоплатежи» и отключите его',
        'Если подписка через оператора связи — отключите в приложении оператора (Мой МТС, Мой билайн, МегаФон, Т2)'],
    },
  ];

  const GUIDES = [
    {
      id: 'yandex-plus', name: 'Яндекс Плюс', color: '#FC3F1D',
      match: ['яндекс плюс', 'яндекс+', 'плюс мульти', 'yandex plus', 'яндекс музыка', 'яндекс.музыка', 'букмейт', 'bookmate'],
      url: 'https://plus.yandex.ru/my', urlLabel: 'Открыть plus.yandex.ru',
      ways: [
        { title: 'На сайте', steps: ['Войдите на plus.yandex.ru под своим Яндекс ID', 'Откройте «Управление подпиской»',
          'Прокрутите вниз и нажмите «Отменить подписку»', 'Если предложат паузу или скидку — откажитесь и подтвердите отмену'] },
        { title: 'В приложении Яндекса или Кинопоиска', steps: ['Откройте профиль — там будет «Плюс активен»',
          'Нажмите «Управлять»', 'Внизу страницы — «Отменить подписку»'] },
      ],
      note: 'Кнопки «Отменить» нет, если Плюс подключён через App Store, Google Play, оператора связи или по промокоду — тогда отменяйте там, где оплачивали.',
      after: 'Плюс работает до конца оплаченного периода',
    },
    {
      id: 'kinopoisk', name: 'Кинопоиск', color: '#FF6600',
      match: ['кинопоиск', 'kinopoisk'],
      url: 'https://plus.yandex.ru/my', urlLabel: 'Открыть управление подпиской',
      ways: [
        { title: 'На сайте', steps: ['На kinopoisk.ru нажмите на аватар → «Настройки»', 'Выберите «Управление подпиской»',
          'Внизу страницы нажмите «Отменить подписку»', 'Сервис предложит паузу на месяц — нажимайте «Отменить», пока не появится сообщение об отмене'] },
        { title: 'В приложении', steps: ['Откройте «Профиль» (справа внизу)', 'В блоке «Плюс активен» нажмите «Управлять»', 'Внизу — «Отменить подписку»'] },
      ],
      note: 'Кинопоиск входит в Яндекс Плюс — отменяя его, вы отменяете весь Плюс. Подписка через МТС, билайн или по промокоду отключается там, где оформлена.',
      after: 'Фильмы доступны до конца оплаченного периода',
    },
    {
      id: 'yandex-360', name: 'Яндекс 360', color: '#3B8CF0',
      match: ['яндекс 360', 'яндекс360', 'yandex 360', 'яндекс диск', 'яндекс.диск'],
      url: 'https://360.yandex.ru', urlLabel: 'Открыть 360.yandex.ru',
      ways: [
        { title: 'На сайте', steps: ['Войдите на 360.yandex.ru', 'Откройте раздел «Тарифы»', 'Нажмите «Отменить» у активного тарифа и подтвердите'] },
      ],
      note: 'Семейный тариф может отменить только владелец семьи. Если оплачивали в App Store или Google Play — отменяйте там.',
      after: 'Место на Диске сохраняется до конца оплаченного периода',
    },
    {
      id: 'vk-music', name: 'VK Музыка', color: '#0077FF',
      match: ['vk музыка', 'вк музыка', 'vk combo', 'вк комбо', 'vk music', 'boom', 'бум'],
      url: 'https://music.vk.com', urlLabel: 'Открыть music.vk.com',
      ways: [
        { title: 'На сайте (лучше с компьютера)', steps: ['Откройте music.vk.com → «Перейти в личный кабинет»', 'Войдите через VK ID',
          'В блоке «Моя подписка» нажмите «Управлять подпиской»', 'Выберите «Отменить подписку» и подтвердите'] },
      ],
      note: 'Если подписку оформляли в приложении на телефоне через App Store или Google Play — отменяйте в магазине (см. ниже).',
      after: 'Музыка без ограничений — до конца оплаченного периода',
    },
    {
      id: 'ivi', name: 'Иви', color: '#EA003D',
      match: ['иви', 'ivi'],
      url: 'https://www.ivi.ru', urlLabel: 'Открыть подписки Иви',
      ways: [
        { title: 'На сайте', steps: ['Войдите на ivi.ru и нажмите на значок профиля справа вверху', 'Откройте «Все подписки» → у активной «Управлять»',
          'Внизу нажмите «Выйти из подписки»', 'Укажите причину и подтверждайте («Продолжить» → «Всё равно отключить»); от скидки откажитесь'] },
        { title: 'В приложении', steps: ['Откройте «Профиль» в нижнем меню → «Подписки»', 'У активной подписки — «Управлять» → «Выйти из подписки»', 'Укажите причину и подтвердите'] },
      ],
      note: 'На Smart TV отключить нельзя. Если кнопки нет — подождите сутки или напишите в поддержку ask.ivi.ru.',
      after: 'Внимание: у Иви доступ может закрыться сразу после отключения',
    },
    {
      id: 'okko', name: 'Okko', color: '#6E3BF0',
      match: ['okko', 'окко'],
      url: 'https://okko.tv', urlLabel: 'Открыть okko.tv',
      ways: [
        { title: 'На сайте или в приложении', steps: ['Войдите в Okko и нажмите на значок профиля справа вверху', 'Откройте «Настройки» → «Подписки»',
          'Выберите действующую подписку и нажмите «Отключить автопродление»', 'Проверьте, что появилась дата окончания доступа'] },
      ],
      note: 'Если Okko входит в СберПрайм — отключайте СберПрайм в приложении Сбера.',
      after: 'Подписка работает до конца оплаченного периода',
    },
    {
      id: 'wink', name: 'Wink', color: '#FF4F12',
      match: ['wink', 'винк'],
      url: 'https://wink.ru/my', urlLabel: 'Открыть wink.ru/my',
      ways: [
        { title: 'На сайте', steps: ['Войдите на wink.ru/my и откройте раздел с подписками', 'Откройте карточку подписки с пометкой «Активна»',
          'Внизу нажмите «Отключить» и подтвердите'] },
        { title: 'В приложении', steps: ['Нажмите «Ещё» справа внизу', 'Выберите «Подписки» → нужную подписку', 'Нажмите «Отключить» и укажите причину'] },
      ],
      note: 'Если вместо кнопки написано «Активна до…» — автопродление уже выключено. Поддержка: 8 800 100-08-00.',
      after: 'Wink покажет дату, до которой работает подписка',
    },
    {
      id: 'sberprime', name: 'СберПрайм', color: '#21A038',
      match: ['сберпрайм', 'сбер прайм', 'sberprime', 'сбер', 'звук', 'zvuk'],
      url: 'https://www.sberbank.com/sberprime', urlLabel: 'Открыть СберПрайм',
      ways: [
        { title: 'В приложении СберБанк Онлайн', steps: ['На главном экране откройте «Все сервисы» → «Подписки»', 'Выберите «СберПрайм»',
          'Нажмите «Отключить подписку» и подтвердите'] },
        { title: 'В веб-версии', steps: ['Войдите в СберБанк Онлайн и откройте профиль', 'Нажмите «СберПрайм» → «Отключить автопродление»'] },
      ],
      note: 'Отключайте минимум за сутки до списания. Если подписка подключена через партнёра (например, Звук) — отключайте у партнёра.',
      after: 'Okko, Звук и другие сервисы работают до конца периода',
    },
    {
      id: 'mts', name: 'МТС Premium', color: '#E30611',
      match: ['мтс', 'mts', 'кион', 'kion'],
      url: 'https://mts.ru', urlLabel: 'Открыть mts.ru',
      ways: [
        { title: 'В приложении «Мой МТС»', steps: ['Войдите по номеру, на котором оформлена подписка', 'Откройте «Подключённые услуги и сервисы»',
          'На баннере МТС Premium нажмите «Настроить»', 'Внизу — «Отключить подписку», выберите причину и подтвердите'] },
      ],
      note: 'Если подписка оформлена через KION — отключайте в KION.',
      after: 'Привилегии действуют до конца оплаченного периода',
    },
    {
      id: 'tbank', name: 'Т-Банк Pro', color: '#FFDD2D',
      match: ['т-банк', 'тбанк', 'тинькофф', 'tinkoff', 't-bank', 'тинькофф pro'],
      url: 'https://www.tbank.ru', urlLabel: 'Открыть tbank.ru',
      ways: [
        { title: 'В приложении Т-Банка', steps: ['На главном экране нажмите на своё имя слева вверху', 'Откройте блок с подпиской Pro',
          'Нажмите на значок настроек справа вверху', 'Выберите «Отключить подписку»'] },
      ],
      note: 'Названия пунктов в приложении банка периодически меняются; если не нашли — напишите в чат поддержки.',
      after: 'Повышенный кешбэк закончится вместе с подпиской',
    },
    {
      id: 'litres', name: 'Литрес', color: '#FF5C00',
      match: ['литрес', 'litres', 'абонемент'],
      url: 'https://www.litres.ru', urlLabel: 'Открыть Литрес',
      ways: [
        { title: 'На сайте или в приложении', steps: ['Войдите в Литрес и откройте профиль', 'Найдите раздел «Подписка» (Абонемент)',
          'Нажмите «Отключить автопродление» и подтвердите'] },
      ],
      note: 'Если подписка оформлена в приложении на iPhone или Android — отменяйте в App Store или Google Play.',
      after: 'Книги из подписки доступны до конца периода',
    },
    {
      id: 'telegram', name: 'Telegram Premium', color: '#2AABEE',
      match: ['telegram', 'телеграм', 'телеграмм', 'tg premium'],
      ways: [
        { title: 'Оплачено через бота @PremiumBot', steps: ['Откройте чат с @PremiumBot', 'Нажмите «Управление подпиской» → «Отключить автопродление»',
          'Или просто отправьте боту /stop'] },
        { title: 'Оплачено в приложении на телефоне', steps: ['iPhone: «Настройки» → ваше имя → «Подписки» → Telegram Premium → «Отменить»',
          'Android: Google Play → профиль → «Платежи и подписки» → Telegram Premium → «Отменить»'] },
      ],
      note: 'Отменяйте за 2–3 дня до продления: уведомление о списании приходит уже после него.',
      after: 'Premium работает до конца оплаченного периода',
    },
    {
      id: 'spotify', name: 'Spotify', color: '#1DB954',
      match: ['spotify', 'спотифай'],
      url: 'https://www.spotify.com/account/subscription/manage/', urlLabel: 'Открыть управление планом',
      ways: [
        { title: 'На сайте', steps: ['Откройте spotify.com/account и войдите', 'Перейдите в «Управление планом»', 'Нажмите «Отменить подписку» и подтвердите'] },
      ],
      note: 'Если кнопки отмены нет — план оплачивается через партнёра (оператора или провайдера): его контакты указаны в разделе «Оплата».',
      after: 'Premium останется до следующей даты оплаты, потом — бесплатный тариф',
    },
    {
      id: 'youtube', name: 'YouTube Premium', color: '#FF0033',
      match: ['youtube', 'ютуб', 'ютюб', 'yt premium', 'youtube music'],
      url: 'https://www.youtube.com/paid_memberships', urlLabel: 'Открыть платные подписки',
      ways: [
        { title: 'На сайте или в приложении YouTube', steps: ['Нажмите на фото профиля → «Платные подписки»', 'Выберите YouTube Premium',
          'Нажмите «Продолжить отмену», укажите причину → «Да, отменить»'] },
      ],
      note: 'Если подключали в приложении YouTube на iPhone — отменяйте в настройках Apple ID.',
      after: 'Без рекламы — до конца оплаченного периода',
    },
    {
      id: 'netflix', name: 'Netflix', color: '#E50914',
      match: ['netflix', 'нетфликс'],
      url: 'https://www.netflix.com/cancelplan', urlLabel: 'Открыть отмену плана',
      ways: [
        { title: 'На сайте', steps: ['Войдите на netflix.com → «Аккаунт»', 'Нажмите «Отменить подписку» (Cancel membership)', 'Подтвердите — «Завершить отмену»'] },
      ],
      after: 'Смотреть можно до конца оплаченного месяца',
    },
    {
      id: 'chatgpt', name: 'ChatGPT Plus', color: '#10A37F',
      match: ['chatgpt', 'чатгпт', 'чат гпт', 'openai', 'gpt'],
      url: 'https://chatgpt.com/#settings/Account', urlLabel: 'Открыть настройки ChatGPT',
      ways: [
        { title: 'На сайте', steps: ['Откройте chatgpt.com и нажмите на своё имя слева внизу', 'Выберите «Мой план» → «Управление подпиской»',
          'Нажмите «Отменить план» и подтвердите'] },
      ],
      note: 'Подписку из приложения на iPhone или Android отменяйте в App Store или Google Play.',
      after: 'Plus работает до конца оплаченного периода',
    },
    {
      id: 'apple', name: 'Apple (iCloud+, Apple Music)', color: '#8E8E93',
      match: ['apple', 'icloud', 'айклауд', 'apple music', 'apple one', 'apple tv', 'эпл'],
      url: 'https://account.apple.com/account/manage/section/subscriptions', urlLabel: 'Открыть подписки Apple',
      ways: [
        { title: 'На iPhone или iPad', steps: ['Откройте «Настройки» и нажмите на своё имя', 'Выберите «Подписки»', 'Нажмите на подписку → «Отменить подписку»'] },
        { title: 'Хранилище iCloud+', steps: ['«Настройки» → ваше имя → iCloud', '«Управлять хранилищем» → «Сменить план»', 'Выберите бесплатные 5 ГБ'] },
      ],
      after: 'Подписка работает до конца оплаченного периода',
    },
    {
      id: 'google-one', name: 'Google One', color: '#4285F4',
      match: ['google one', 'гугл диск', 'google drive', 'google диск'],
      url: 'https://one.google.com/settings', urlLabel: 'Открыть настройки Google One',
      ways: [
        { title: 'На сайте', steps: ['Откройте one.google.com → «Настройки»', 'Нажмите «Отменить подписку» и подтвердите'] },
      ],
      after: 'Место останется до конца оплаченного периода',
    },
    {
      id: 'psplus', name: 'PlayStation Plus', color: '#0070D1',
      match: ['ps plus', 'playstation', 'ps+', 'плейстейшен'],
      url: 'https://store.playstation.com', urlLabel: 'Открыть PlayStation Store',
      ways: [
        { title: 'На PS5', steps: ['«Настройки» → «Пользователи и учётные записи» → «Учётная запись»', '«Платежи и подписки» → «Подписки»',
          'Выберите PlayStation Plus → «Отменить подписку»'] },
        { title: 'На сайте', steps: ['Войдите в PlayStation Store и нажмите на аватар', 'Откройте «Подписки»', 'Выберите PlayStation Plus и отключите автопродление'] },
      ],
      after: 'Онлайн и игры каталога доступны до конца периода',
    },
    {
      id: 'xbox', name: 'Xbox Game Pass', color: '#107C10',
      match: ['game pass', 'xbox', 'гейм пасс'],
      url: 'https://account.microsoft.com/services', urlLabel: 'Открыть подписки Microsoft',
      ways: [
        { title: 'На сайте Microsoft', steps: ['Откройте account.microsoft.com/services и войдите', 'У Game Pass нажмите «Управление»',
          'Выберите «Отменить подписку» и подтвердите'] },
      ],
      after: 'Игры из каталога доступны до конца периода',
    },
    {
      id: 'ms365', name: 'Microsoft 365', color: '#D83B01',
      match: ['microsoft 365', 'office 365', 'майкрософт 365', 'office'],
      url: 'https://account.microsoft.com/services', urlLabel: 'Открыть подписки Microsoft',
      ways: [
        { title: 'На сайте Microsoft', steps: ['Откройте account.microsoft.com/services', 'У Microsoft 365 нажмите «Управление»', 'Выберите «Отменить подписку»'] },
      ],
      note: 'Годовую подписку иногда можно вернуть частично — Microsoft покажет это при отмене.',
      after: 'Word, Excel и OneDrive работают до конца периода',
    },
    {
      id: 'adobe', name: 'Adobe Creative Cloud', color: '#FA0F00',
      match: ['adobe', 'photoshop', 'creative cloud', 'фотошоп', 'lightroom'],
      url: 'https://account.adobe.com/plans', urlLabel: 'Открыть планы Adobe',
      ways: [
        { title: 'На сайте Adobe', steps: ['Откройте account.adobe.com/plans', 'Нажмите «Управление планом» → «Отменить план»',
          'На каждом экране с предложениями выбирайте «Продолжить отмену»'] },
      ],
      note: 'Годовой план с помесячной оплатой: при отмене посреди года Adobe берёт 50% за оставшиеся месяцы. Без штрафа — в первые 14 дней после продления.',
    },
    {
      id: 'discord', name: 'Discord Nitro', color: '#5865F2',
      match: ['discord', 'nitro', 'дискорд'],
      ways: [
        { title: 'В Discord (компьютер или телефон)', steps: ['Откройте «Настройки пользователя» (шестерёнка)', 'Раздел «Подписки»',
          'Нажмите «Отменить» у Nitro и подтвердите'] },
      ],
      after: 'Nitro работает до конца оплаченного периода',
    },
    {
      id: 'notion', name: 'Notion', color: '#37352F',
      match: ['notion', 'ноушн'],
      url: 'https://www.notion.so', urlLabel: 'Открыть Notion',
      ways: [
        { title: 'В Notion', steps: ['Откройте «Настройки» (Settings) слева', 'Перейдите в «Оплата» (Billing)',
          'Нажмите «Сменить план» и выберите бесплатный (Free)'] },
      ],
      note: 'Сменить план может только владелец рабочего пространства.',
    },
    {
      id: 'duolingo', name: 'Duolingo Super', color: '#58CC02',
      match: ['duolingo', 'дуолинго', 'super duolingo'],
      url: 'https://www.duolingo.com/settings', urlLabel: 'Открыть настройки Duolingo',
      ways: [
        { title: 'На сайте', steps: ['Войдите на duolingo.com → «Настройки»', 'Откройте раздел подписки Super', 'Нажмите «Отменить подписку»'] },
      ],
      note: 'Чаще всего Super оформляют в приложении — тогда отменять нужно в App Store или Google Play (см. ниже).',
      after: 'Super работает до конца оплаченного периода',
    },
  ];

  const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

  /** Ищет инструкцию по названию подписки (сначала самое длинное совпадение) */
  function find(name) {
    const n = norm(name);
    if (!n) return null;
    let best = null, bestLen = 0;
    for (const g of GUIDES) {
      for (const m of [g.name, ...g.match]) {
        const k = norm(m);
        const hit = k.length <= 3 ? new RegExp(`(^|[^a-zа-я0-9])${k}([^a-zа-я0-9]|$)`).test(n) : n.includes(k);
        if (hit && k.length > bestLen) { best = g; bestLen = k.length; }
      }
    }
    return best;
  }

  function openLink(url) {
    const TG = window.Telegram && window.Telegram.WebApp;
    if (TG && TG.initData && TG.openLink) TG.openLink(url);
    else window.open(url, '_blank', 'noopener');
  }

  const stepsHtml = (steps) => `<ol class="cg-steps">${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;

  /**
   * Открыть инструкцию.
   * guide — объект из списка (или null — общая инструкция);
   * sub — подписка из Subly, onDone — что сделать по кнопке «Я отменил»
   */
  function open(guide, { sub = null, onDone = null } = {}) {
    const title = guide ? guide.name : (sub ? sub.name : 'подписку');
    const letter = (guide ? guide.name : title).trim()[0]?.toUpperCase() || '?';
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal cg-modal" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div class="cg-logo" style="--c:${guide ? guide.color : 'var(--accent)'}">${esc(letter)}</div>
          <button type="button" class="close-btn" data-close aria-label="Закрыть">${icon('x', 18)}</button>
        </div>
        <div class="modal-title">
          <h2 class="h2">Как отменить ${esc(title)}</h2>
          <p class="muted">${guide ? esc(guide.after || 'Подписка обычно работает до конца оплаченного периода')
            : 'Отдельной инструкции для этого сервиса нет — вот способы, которые работают почти всегда'}</p>
        </div>
        <div class="cg-body">
          ${guide ? guide.ways.map((w) => `<section class="cg-way"><div class="overline faint">${esc(w.title)}</div>${stepsHtml(w.steps)}</section>`).join('')
            : `<section class="cg-way"><div class="overline faint">В личном кабинете сервиса</div>${stepsHtml(['Войдите на сайт или в приложение сервиса',
              'Откройте профиль → «Подписки», «Управление подпиской» или «Оплата»', 'Нажмите «Отменить» или «Отключить автопродление» и подтвердите'])}</section>`}
          ${guide && guide.note ? `<div class="cg-note">${icon('alert', 16)}<span>${esc(guide.note)}</span></div>` : ''}
          <details class="cg-more" ${guide ? '' : 'open'}>
            <summary>${guide ? 'Оплачивали через App Store, Google Play или банк?' : 'Если оплачивали через магазин приложений или банк'}${icon('chevronD', 16)}</summary>
            ${STORES.map((s) => `<div class="cg-store"><div class="medium">${esc(s.title)}</div>${stepsHtml(s.steps)}
              ${s.url ? `<button type="button" class="link-btn" data-url="${esc(s.url)}">Открыть ${icon('chevronR', 14)}</button>` : ''}</div>`).join('')}
          </details>
        </div>
        <div class="cg-actions">
          ${guide && guide.url ? `<button type="button" class="btn btn-secondary btn-block" data-url="${esc(guide.url)}">${esc(guide.urlLabel || 'Открыть сайт')}</button>` : ''}
          ${sub && sub.isActive && onDone ? `<button type="button" class="btn btn-primary btn-block" data-done>${icon('check', 16)}Я отменил — поставить на паузу</button>` : ''}
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';

    const close = () => {
      backdrop.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    backdrop.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    backdrop.querySelectorAll('[data-url]').forEach((b) => b.addEventListener('click', () => openLink(b.dataset.url)));
    backdrop.querySelector('[data-done]')?.addEventListener('click', () => { close(); onDone(); });
  }

  /** Окно для подписки из списка Subly */
  function openFor(sub, onDone) { open(find(sub.name), { sub, onDone }); }

  return { GUIDES, find, open, openFor };
})();
