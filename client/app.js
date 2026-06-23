/* ============================================================================
   app.js — общий модуль фронтенда «Кровавый Меридиан»
   Подключается на КАЖДОЙ странице (до page-скрипта).
   Отвечает за: API-клиент, состояние авторизации, рендер шапки/подвала,
   тосты, модалки, уведомления, поиск, мобильное меню.
   ============================================================================ */

const API_BASE = '/api';

/* ---------------------------------------------------------------------------
   ИКОНКИ (инлайн SVG, лёгкие, без внешних зависимостей)
   ВАЖНО: у каждой иконки заданы явные width/height. Без них браузер рендерит SVG
   в размере по умолчанию ~300x150px, что и было причиной "огромных" иконок
   (например, в блоке цитаты) — это распространённая SVG-ловушка.
   --------------------------------------------------------------------------- */
const ICONS = {
  search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m22 7-10 6L2 7"/></svg>',
  menu: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  heart: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  heartFill: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  quote: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v4"/></svg>',
  edit: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  pin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-1.4-7L19 8a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2l1.4 2z"/></svg>',
  lock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  eye: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>',
  users: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  send: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  shield: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
  crown: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M3 18h18l1-9-6 4-4-7-4 7-6-4 1 9Z"/><rect x="3" y="19.5" width="18" height="2" rx="1"/></svg>',
  camera: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></svg>',
};

/* ---------------------------------------------------------------------------
   РОЛИ (общая логика, синхронизирована с server/utils/helpers.js)
   Иерархия: owner (Команда Проекта) > admin > moderator > user
   --------------------------------------------------------------------------- */
const STAFF_ROLES = ['moderator', 'admin', 'owner'];
function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

/* ---------------------------------------------------------------------------
   ХРАНЕНИЕ ТОКЕНА
   --------------------------------------------------------------------------- */
const Auth = {
  getToken() {
    return localStorage.getItem('mk_token') || sessionStorage.getItem('mk_token');
  },
  setToken(token, remember) {
    if (remember) {
      localStorage.setItem('mk_token', token);
      sessionStorage.removeItem('mk_token');
    } else {
      sessionStorage.setItem('mk_token', token);
      localStorage.removeItem('mk_token');
    }
  },
  clear() {
    localStorage.removeItem('mk_token');
    sessionStorage.removeItem('mk_token');
    localStorage.removeItem('mk_user_cache');
  },
  cacheUser(user) {
    localStorage.setItem('mk_user_cache', JSON.stringify(user));
  },
  getCachedUser() {
    try { return JSON.parse(localStorage.getItem('mk_user_cache')); } catch (e) { return null; }
  },
};

let currentUser = null; // заполняется в initApp()

/* ---------------------------------------------------------------------------
   API-КЛИЕНТ
   --------------------------------------------------------------------------- */
async function api(path, { method = 'GET', body, isFormData = false } = {}) {
  const headers = {};
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  let data = {};
  try { data = await res.json(); } catch (e) { /* пустой ответ */ }

  if (!res.ok) {
    const err = new Error(data.error || 'Произошла ошибка запроса');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/* ---------------------------------------------------------------------------
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   --------------------------------------------------------------------------- */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(sqlDate) {
  if (!sqlDate) return '';
  const d = new Date(sqlDate.replace(' ', 'T') + 'Z');
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин. назад`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ч. назад`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} дн. назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateFull(sqlDate) {
  if (!sqlDate) return '';
  const d = new Date(sqlDate.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function roleBadge(role) {
  const map = {
    owner:     `<span class="badge badge-owner">${ICONS.crown} Владелец</span>`,
    admin:     `<span class="badge badge-admin">${ICONS.shield} Администратор</span>`,
    moderator: `<span class="badge badge-moderator">Модератор</span>`,
    user:      `<span class="badge badge-user">Пользователь</span>`,
  };
  return map[role] || map.user;
}

/** Бейдж "Закреплено" с картинкой-иконкой (вместо эмодзи 📌) */
function pinnedBadge() {
  return `<span class="badge badge-pinned"><img class="badge-icon" src="icons/pin.png" alt="">Закреплено</span>`;
}
/** Бейдж "Закрыто" с картинкой-иконкой (вместо эмодзи 🔒) */
function lockedBadge() {
  return `<span class="badge badge-locked"><img class="badge-icon" src="icons/lock.png" alt="">Закрыто</span>`;
}

function qs(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') usp.set(k, v); });
  const s = usp.toString();
  return s ? `?${s}` : '';
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Рендерит компонент пагинации в указанный контейнер.
 * onPage(pageNumber) вызывается при клике на номер/стрелку.
 */
function renderPagination(container, pagination, onPage) {
  if (!container) return;
  const { page, totalPages } = pagination;
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }

  container.innerHTML = `
    <button class="page-btn" data-p="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹</button>
    ${pages.map((p) => p === '…'
      ? `<span class="page-btn" style="pointer-events:none;border:none;background:none;">…</span>`
      : `<button class="page-btn ${p === page ? 'active' : ''}" data-p="${p}">${p}</button>`
    ).join('')}
    <button class="page-btn" data-p="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>›</button>`;

  container.querySelectorAll('[data-p]').forEach((btn) => {
    btn.onclick = () => onPage(Number(btn.dataset.p));
  });
}

/* ---------------------------------------------------------------------------
   ТОСТЫ
   --------------------------------------------------------------------------- */
function toast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(30px)';
    setTimeout(() => el.remove(), 300);
  }, 3800);
}

function apiErrorToast(err) {
  toast(err.message || 'Произошла ошибка', 'error');
}

/* ---------------------------------------------------------------------------
   ПОДТВЕРЖДЕНИЕ ДЕЙСТВИЯ (модалка вместо confirm())
   --------------------------------------------------------------------------- */
function confirmModal({ title, text, confirmText = 'Подтвердить', danger = true }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box card">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(text)}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-act="cancel">Отмена</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${escapeHtml(confirmText)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    function close(result) {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    }
    overlay.querySelector('[data-act="cancel"]').onclick = () => close(false);
    overlay.querySelector('[data-act="ok"]').onclick = () => close(true);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
  });
}

/* ---------------------------------------------------------------------------
   ШАПКА САЙТА
   --------------------------------------------------------------------------- */
const NAV_LINKS = [
  { href: 'index.html', label: 'Главная', page: 'index' },
  { href: 'forum.html', label: 'Форум', page: 'forum' },
  { href: 'news.html', label: 'Новости', page: 'news' },
  { href: 'users.html', label: 'Пользователи', page: 'users' },
  { href: 'support.html', label: 'Поддержка', page: 'support' },
];

function currentPageName() {
  const file = window.location.pathname.split('/').pop() || 'index.html';
  return file.replace('.html', '') || 'index';
}

function renderHeader() {
  const host = document.getElementById('site-header');
  if (!host) return;
  const page = currentPageName();

  const navHtml = NAV_LINKS.map(
    (l) => `<a class="nav-link ${page === l.page ? 'active' : ''}" href="${l.href}">${l.label}</a>`
  ).join('');

  const profileLink = currentUser
    ? `<a class="nav-link ${page === 'profile' ? 'active' : ''}" href="profile.html">Профиль</a>`
    : '';

  let authArea = '';
  if (currentUser) {
    authArea = `
      <div class="dropdown" id="notif-dd">
        <button class="icon-btn" id="notif-btn" aria-label="Уведомления">${ICONS.bell}<span class="icon-badge" id="notif-count" style="display:none">0</span></button>
        <div class="dropdown-panel" id="notif-panel">
          <div class="dropdown-head"><span>Уведомления</span><button id="notif-readall">Прочитать всё</button></div>
          <div id="notif-list"><div class="dropdown-empty">Загрузка…</div></div>
        </div>
      </div>
      <a class="icon-btn" href="messages.html" aria-label="Сообщения" id="messages-link">${ICONS.mail}<span class="icon-badge" id="msg-count" style="display:none">0</span></a>
      <div class="dropdown" id="user-dd">
        <button class="user-chip" id="user-chip-btn">
          <img class="avatar avatar-sm" src="${currentUser.avatar}" alt="">
          <span>${escapeHtml(currentUser.nickname)}</span>
        </button>
        <div class="dropdown-panel" id="user-panel" style="width:220px;">
          <a class="notif-item" href="profile.html">👤 Мой профиль</a>
          ${isStaffRole(currentUser.role) ? '<a class="notif-item" href="admin.html">🛡️ Админ-панель</a>' : ''}
          <button class="notif-item" id="logout-btn" style="width:100%;text-align:left;color:var(--danger)">🚪 Выйти</button>
        </div>
      </div>`;
  } else {
    authArea = `
      <a class="btn btn-ghost btn-sm" href="login.html">Войти</a>
      <a class="btn btn-primary btn-sm" href="register.html">Регистрация</a>`;
  }

  host.innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <a class="logo" href="index.html">
          <img class="logo-mark" src="icons/1.png" alt="Кровавый Меридиан">
          <span><span class="logo-text-main">Кровавый</span> <span class="logo-text-sub">Меридиан</span></span>
        </a>
        <nav class="nav-main" id="nav-main">${navHtml}${profileLink}</nav>
        <div class="topbar-search">
          ${ICONS.search}
          <input type="text" id="global-search" placeholder="Поиск по форуму…" autocomplete="off">
        </div>
        <div class="topbar-actions">
          ${authArea}
          <button class="burger" id="burger-btn" aria-label="Меню">${ICONS.menu}</button>
        </div>
      </div>
    </header>`;

  // мобильное меню
  const burger = document.getElementById('burger-btn');
  const navMain = document.getElementById('nav-main');
  if (burger) burger.onclick = () => navMain.classList.toggle('open');

  // поиск
  const searchInput = document.getElementById('global-search');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchInput.value.trim()) {
        window.location.href = `search.html?q=${encodeURIComponent(searchInput.value.trim())}`;
      }
    });
  }

  if (currentUser) {
    setupDropdown('notif-dd', 'notif-btn', 'notif-panel', loadNotifications);
    setupDropdown('user-dd', 'user-chip-btn', 'user-panel');
    document.getElementById('logout-btn').onclick = logout;
    document.getElementById('notif-readall').onclick = async (e) => {
      e.stopPropagation();
      await api('/notifications/read-all', { method: 'PUT' });
      loadNotifications();
    };
    refreshNotifBadges();
    let pollInterval = setInterval(refreshNotifBadges, 30000);

    // Если вкладка скрыта (человек переключился в другое окно/свернул браузер) — не шлём
    // фоновые запросы. Это, в частности, устраняет ситуацию, когда пользователь давно
    // не смотрит на сайт, а статус "онлайн" искусственно поддерживается фоновым опросом.
    document.addEventListener('visibilitychange', () => {
      clearInterval(pollInterval);
      if (!document.hidden) {
        refreshNotifBadges();
        pollInterval = setInterval(refreshNotifBadges, 30000);
      }
    });
  }
}

function setupDropdown(wrapId, btnId, panelId, onOpen) {
  const btn = document.getElementById(btnId);
  const panel = document.getElementById(panelId);
  if (!btn || !panel) return;
  btn.onclick = (e) => {
    e.stopPropagation();
    const willOpen = !panel.classList.contains('open');
    document.querySelectorAll('.dropdown-panel.open').forEach((p) => p.classList.remove('open'));
    if (willOpen) {
      panel.classList.add('open');
      if (onOpen) onOpen();
    }
  };
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('open');
  });
}

async function loadNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  try {
    const { notifications } = await api('/notifications');
    if (!notifications.length) {
      list.innerHTML = `<div class="dropdown-empty">Уведомлений пока нет</div>`;
      return;
    }
    list.innerHTML = notifications
      .map(
        (n) => `<a class="notif-item ${n.is_read ? '' : 'unread'}" href="${n.link || '#'}">
          <div class="ni-text">${escapeHtml(n.content)}</div>
          <div class="ni-time">${formatDate(n.created_at)}</div>
        </a>`
      )
      .join('');
  } catch (e) {
    list.innerHTML = `<div class="dropdown-empty">Не удалось загрузить</div>`;
  }
}

async function refreshNotifBadges() {
  try {
    const { unreadCount } = await api('/notifications');
    const badge = document.getElementById('notif-count');
    if (badge) {
      badge.style.display = unreadCount > 0 ? 'flex' : 'none';
      badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
    }
  } catch (e) { /* тихо игнорируем */ }

  try {
    const { conversations } = await api('/messages/conversations');
    const unread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    const badge = document.getElementById('msg-count');
    if (badge) {
      badge.style.display = unread > 0 ? 'flex' : 'none';
      badge.textContent = unread > 9 ? '9+' : unread;
    }
  } catch (e) { /* тихо игнорируем */ }
}

function renderFooter() {
  const host = document.getElementById('site-footer');
  if (!host) return;
  host.innerHTML = `
    <footer class="footer">
      <div class="container">
        © ${new Date().getFullYear()} <b>Кровавый Меридиан</b> — игровой форум сообщества. Все права защищены.
      </div>
    </footer>`;
}

async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch (e) { /* даже если запрос не прошёл — всё равно выходим локально */ }
  Auth.clear();
  currentUser = null;
  toast('Вы вышли из аккаунта', 'success');
  setTimeout(() => (window.location.href = 'index.html'), 600);
}

/**
 * Заполняет виджет "сейчас онлайн" в боковой панели. Переиспользуется на нескольких страницах.
 */
async function loadOnlineWidget(containerId, limit = 8) {
  const host = document.getElementById(containerId);
  if (!host) return;
  try {
    const { users, count } = await api('/users/online');
    if (!count) {
      host.innerHTML = `<div style="color:var(--text-3);font-size:13px;">Сейчас никого нет онлайн</div>`;
      return;
    }
    host.innerHTML = users
      .slice(0, limit)
      .map(
        (u) => `<a href="profile.html?id=${u.id}" class="online-user-row">
          <span class="avatar-wrap"><img class="avatar avatar-sm" src="${u.avatar}"><span class="online-dot"></span></span>
          <span class="ou-name">${escapeHtml(u.nickname)}</span>
        </a>`
      )
      .join('') + (count > limit ? `<div style="font-size:12px;color:var(--text-3);margin-top:8px;">и ещё ${count - limit}…</div>` : '');
  } catch (e) {
    host.innerHTML = `<div style="color:var(--text-3);font-size:13px;">Не удалось загрузить</div>`;
  }
}

/* ---------------------------------------------------------------------------
   ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
   Вызывается в каждом page-скрипте: await initApp();
   --------------------------------------------------------------------------- */
async function initApp({ requireAuth = false, requireRole = null } = {}) {
  const token = Auth.getToken();
  if (token) {
    const cached = Auth.getCachedUser();
    if (cached) currentUser = cached; // мгновенный рендер по кэшу, затем сверяем с сервером

    try {
      const { user } = await api('/auth/me');
      currentUser = user;
      Auth.cacheUser(user);
    } catch (e) {
      Auth.clear();
      currentUser = null;
    }
  }

  renderHeader();
  renderFooter();

  if (requireAuth && !currentUser) {
    toast('Войдите в аккаунт, чтобы получить доступ к этой странице', 'error');
    setTimeout(() => (window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`), 900);
    return false;
  }
  if (requireRole && currentUser && !requireRole.includes(currentUser.role)) {
    toast('У вас недостаточно прав для доступа к этой странице', 'error');
    setTimeout(() => (window.location.href = 'index.html'), 900);
    return false;
  }
  if (requireRole && !currentUser) {
    setTimeout(() => (window.location.href = 'login.html'), 200);
    return false;
  }

  return true;
}
