/* ============================================================================
   js/admin.js — полный скрипт админ-панели
   ============================================================================ */

let activeTicketId = null;
let supportPoll = null;

(async function () {
  const ok = await initApp({ requireAuth: true, requireRole: ['admin', 'moderator', 'owner'] });
  if (!ok) return;

  setupTabs();
  loadStats();
  loadUsers();
  loadTopics(1);
  loadNewsAdmin();
  loadStaffTickets('open');
  pollSupportBadge();

  document.getElementById('news-form').addEventListener('submit', submitNews);
  document.getElementById('news-cancel-edit').addEventListener('click', resetNewsForm);
  document.getElementById('staff-reply-form').addEventListener('submit', staffReply);
  document.querySelectorAll('.status-filter').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.status-filter').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeTicketId = null;
      resetSupportChat();
      loadStaffTickets(btn.dataset.status);
    };
  });

  // Открыть тикет по URL-параметру (?tab=support&ticket=5)
  if (getParam('tab') === 'support') {
    switchTab('support');
    const tid = getParam('ticket');
    if (tid) {
      await loadStaffTickets('all');
      document.querySelectorAll('.status-filter').forEach((b) => b.classList.toggle('active', b.dataset.status === 'all'));
      openStaffTicket(Number(tid));
    }
  }
})();

function setupTabs() {
  document.querySelectorAll('#admin-tabs .tab-btn').forEach((btn) => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
}

function switchTab(name) {
  document.querySelectorAll('#admin-tabs .tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  document.getElementById(`panel-${name}`).classList.add('active');
  if (name !== 'support') { clearInterval(supportPoll); supportPoll = null; }
}

/* ───────────── СТАТИСТИКА ───────────── */
async function loadStats() {
  const host = document.getElementById('admin-stats');
  try {
    const s = await api('/admin/stats');
    const ticketCount = await api('/support/staff/tickets?status=open').then((d) => d.tickets.length).catch(() => '?');
    host.innerHTML = `
      <div class="card admin-stat-card"><div class="num">${s.usersCount}</div><div class="lab">Пользователей</div></div>
      <div class="card admin-stat-card"><div class="num">${s.topicsCount}</div><div class="lab">Тем</div></div>
      <div class="card admin-stat-card"><div class="num" style="color:var(--success)">${s.onlineCount}</div><div class="lab">Онлайн</div></div>
      <div class="card admin-stat-card"><div class="num" style="color:var(--gold)">${ticketCount}</div><div class="lab">Новых обращений</div></div>`;
  } catch (e) { apiErrorToast(e); }
}

/* ───────────── ПОЛЬЗОВАТЕЛИ ───────────── */
async function loadUsers() {
  const body = document.getElementById('admin-users-body');
  const canManage = currentUser.role === 'admin' || currentUser.role === 'owner';

  // Доступные для назначения роли в зависимости от роли текущего пользователя
  // owner  → может назначить user / moderator / admin
  // admin  → может назначить user / moderator  (не admin/owner)
  // moderator → кнопка назначения роли вообще не показывается
  const availableRoles = currentUser.role === 'owner'
    ? [['user','Пользователь'],['moderator','Модератор'],['admin','Администратор']]
    : [['user','Пользователь'],['moderator','Модератор']];

  try {
    const { users } = await api('/admin/users');
    body.innerHTML = users.map((u) => {
      // Выбор роли: owner — красивый select на все роли; admin — select только user/mod
      // Для целей с ролью owner или (admin целевой) при req.user=admin — disabled
      const isSelf = u.id === currentUser.id;
      const isOwnerTarget = u.role === 'owner';
      const cantTouchRole = !canManage || isSelf || isOwnerTarget
        || (u.role === 'admin' && currentUser.role !== 'owner');

      const roleCell = isOwnerTarget
        ? roleBadge('owner')
        : `<div class="role-select-wrap">
             <select class="role-select" data-id="${u.id}" ${cantTouchRole ? 'disabled' : ''}>
               ${availableRoles.map(([v, l]) => `<option value="${v}" ${u.role === v ? 'selected' : ''}>${l}</option>`).join('')}
             </select>
           </div>`;

      const cantBan = !canManage || isOwnerTarget || isSelf
        || (u.role === 'admin' && currentUser.role !== 'owner');
      const banCell = cantBan
        ? '<span style="color:var(--text-3);font-size:12px;">—</span>'
        : `<button class="btn btn-sm ${u.is_banned ? 'btn-outline' : 'btn-danger'}" data-ban="${u.id}" data-banned="${u.is_banned ? '1' : '0'}">${u.is_banned ? 'Разблокировать' : 'Заблокировать'}</button>`;

      return `
      <tr>
        <td class="row-flex"><img class="avatar avatar-sm" src="${u.avatar}"><a href="profile.html?id=${u.id}">${escapeHtml(u.nickname)}</a></td>
        <td style="color:var(--text-3);font-size:12px;">${escapeHtml(u.email)}</td>
        <td>${roleCell}</td>
        <td>${u.is_banned ? '<span class="badge badge-locked">Заблокирован</span>' : '<span class="badge badge-online">Активен</span>'}</td>
        <td style="font-size:12px;color:var(--text-3);">${formatDate(u.created_at)}</td>
        <td>${banCell}</td>
      </tr>`;
    }).join('');

    body.querySelectorAll('.role-select').forEach((sel) => {
      sel.onchange = async () => {
        try {
          await api(`/admin/users/${sel.dataset.id}/role`, { method: 'PUT', body: { role: sel.value } });
          toast('Роль обновлена', 'success');
        } catch (e) { apiErrorToast(e); await loadUsers(); }
      };
    });
    body.querySelectorAll('[data-ban]').forEach((btn) => {
      btn.onclick = async () => {
        const isBanning = btn.dataset.banned !== '1';
        let reason = '';
        if (isBanning) reason = prompt('Причина блокировки:') || 'Нарушение правил форума';
        try {
          await api(`/admin/users/${btn.dataset.ban}/ban`, { method: 'PUT', body: { banned: isBanning, reason } });
          toast(isBanning ? 'Заблокирован' : 'Разблокирован', 'success');
          loadUsers();
        } catch (e) { apiErrorToast(e); }
      };
    });
  } catch (e) {
    body.innerHTML = `<tr><td colspan="6" style="color:var(--danger)">Ошибка загрузки</td></tr>`;
  }
}

/* ───────────── ТЕМЫ ───────────── */
async function loadTopics(page) {
  const body = document.getElementById('admin-topics-body');
  try {
    const { topics, pagination } = await api(`/admin/topics${qs({ page })}`);
    if (!topics.length) { body.innerHTML = `<tr><td colspan="6" style="color:var(--text-3)">Тем пока нет</td></tr>`; return; }
    body.innerHTML = topics.map((t) => `
      <tr>
        <td><a href="topic.html?id=${t.id}">${escapeHtml(t.title)}</a></td>
        <td style="font-size:12.5px;color:var(--text-3);">${escapeHtml(t.category_name)}</td>
        <td style="font-size:12.5px;">${escapeHtml(t.author_nickname)}</td>
        <td style="font-size:12px;color:var(--text-3);">${formatDate(t.created_at)}</td>
        <td>${t.is_pinned ? '<img class="badge-icon" src="icons/pin.png" title="Закреплено">' : ''}${t.is_locked ? '<img class="badge-icon" src="icons/lock.png" title="Закрыто">' : ''}</td>
        <td class="row-flex" style="flex-wrap:wrap;gap:4px;">
          <button class="btn btn-sm btn-outline" data-pin="${t.id}">${t.is_pinned ? 'Открепить' : 'Закрепить'}</button>
          <button class="btn btn-sm btn-outline" data-lock="${t.id}">${t.is_locked ? 'Открыть' : 'Закрыть'}</button>
          <button class="btn btn-sm btn-danger" data-del="${t.id}">Удалить</button>
        </td>
      </tr>`).join('');

    body.querySelectorAll('[data-pin]').forEach((b) => b.onclick = async () => { await api(`/admin/topics/${b.dataset.pin}/pin`, { method: 'PUT' }); loadTopics(page); });
    body.querySelectorAll('[data-lock]').forEach((b) => b.onclick = async () => { await api(`/admin/topics/${b.dataset.lock}/lock`, { method: 'PUT' }); loadTopics(page); });
    body.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      const ok = await confirmModal({ title: 'Удалить тему?', text: 'Действие необратимо.', confirmText: 'Удалить' });
      if (!ok) return;
      await api(`/admin/topics/${b.dataset.del}`, { method: 'DELETE' });
      toast('Тема удалена', 'success');
      loadTopics(page); loadStats();
    });
    renderPagination(document.getElementById('topics-pagination'), pagination, loadTopics);
  } catch (e) { body.innerHTML = `<tr><td colspan="6">Ошибка загрузки</td></tr>`; }
}

/* ───────────── НОВОСТИ ───────────── */
async function loadNewsAdmin() {
  const body = document.getElementById('admin-news-body');
  try {
    const { news } = await api('/news?limit=50');
    if (!news.length) { body.innerHTML = `<tr><td colspan="4" style="color:var(--text-3)">Новостей пока нет</td></tr>`; return; }
    body.innerHTML = news.map((n) => `
      <tr>
        <td><a href="news-item.html?id=${n.id}">${escapeHtml(n.title)}</a></td>
        <td style="font-size:12.5px;">${escapeHtml(n.author_nickname || '—')}</td>
        <td style="font-size:12px;color:var(--text-3);">${formatDate(n.created_at)}</td>
        <td class="row-flex">
          <button class="btn btn-sm btn-outline" data-edit='${JSON.stringify({id:n.id,title:n.title,content:n.content}).replace(/'/g,"&#39;")}'>Изменить</button>
          <button class="btn btn-sm btn-danger" data-del="${n.id}">Удалить</button>
        </td>
      </tr>`).join('');

    body.querySelectorAll('[data-edit]').forEach((b) => {
      b.onclick = () => {
        const d = JSON.parse(b.dataset.edit);
        document.getElementById('news-edit-id').value = d.id;
        document.getElementById('news-title').value = d.title;
        document.getElementById('news-content').value = d.content;
        document.getElementById('news-form-title').textContent = 'Редактировать новость';
        document.getElementById('news-submit').textContent = 'Сохранить';
        document.getElementById('news-cancel-edit').style.display = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });
    body.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        const ok = await confirmModal({ title: 'Удалить новость?', text: 'Действие необратимо.', confirmText: 'Удалить' });
        if (!ok) return;
        await api(`/admin/news/${b.dataset.del}`, { method: 'DELETE' });
        toast('Новость удалена', 'success');
        loadNewsAdmin();
      };
    });
  } catch (e) { body.innerHTML = `<tr><td colspan="4">Ошибка загрузки</td></tr>`; }
}

function resetNewsForm() {
  document.getElementById('news-form').reset();
  document.getElementById('news-edit-id').value = '';
  document.getElementById('news-form-title').textContent = 'Опубликовать новость';
  document.getElementById('news-submit').textContent = 'Опубликовать';
  document.getElementById('news-cancel-edit').style.display = 'none';
}
async function submitNews(e) {
  e.preventDefault();
  const id = document.getElementById('news-edit-id').value;
  const title = document.getElementById('news-title').value.trim();
  const content = document.getElementById('news-content').value.trim();
  const btn = document.getElementById('news-submit');
  btn.disabled = true;
  try {
    if (id) { await api(`/admin/news/${id}`, { method: 'PUT', body: { title, content } }); toast('Новость обновлена', 'success'); }
    else     { await api('/admin/news', { method: 'POST', body: { title, content } }); toast('Новость опубликована', 'success'); }
    resetNewsForm(); loadNewsAdmin();
  } catch (err) { apiErrorToast(err); }
  finally { btn.disabled = false; }
}

/* ───────────── ПОДДЕРЖКА (тикеты) ───────────── */
const STATUS_INFO = {
  open:    { icon: '🟡', label: 'Ожидает',   cls: 'badge-pinned' },
  claimed: { icon: '🟢', label: 'В работе',  cls: 'badge-online' },
  closed:  { icon: '⚫', label: 'Закрыто',   cls: 'badge-locked' },
};

async function loadStaffTickets(status) {
  const host = document.getElementById('staff-tickets-list');
  host.innerHTML = `<div class="spinner" style="margin:20px auto;"></div>`;
  try {
    const { tickets } = await api(`/support/staff/tickets?status=${status}`);
    if (!tickets.length) {
      host.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-3);font-size:13.5px;">Обращений нет</div>`;
      return;
    }
    host.innerHTML = tickets.map((t) => {
      const si = STATUS_INFO[t.status] || { icon: '⚪', label: t.status, cls: 'badge-user' };
      return `
      <div class="ticket-row ${t.id === activeTicketId ? 'active' : ''}" data-tid="${t.id}">
        <div class="ticket-body">
          <div class="ticket-subject">${escapeHtml(t.subject)}</div>
          <div class="ticket-meta">
            ${t.user_nickname ? `<a href="profile.html?id=${t.user_id}" onclick="event.stopPropagation()">${escapeHtml(t.user_nickname)}</a> · ` : 'Гость · '}
            ${formatDate(t.updated_at)} · ${t.msg_count} сообщ.
            ${t.claimed_nickname ? ` · Принял: ${escapeHtml(t.claimed_nickname)}` : ''}
          </div>
          ${t.last_message ? `<div class="ticket-preview">${escapeHtml(t.last_message)}</div>` : ''}
        </div>
        <span class="badge ${si.cls}" style="white-space:nowrap;flex-shrink:0;">${si.icon} ${si.label}</span>
      </div>`;
    }).join('');

    host.querySelectorAll('.ticket-row').forEach((row) => {
      row.onclick = () => openStaffTicket(Number(row.dataset.tid));
    });
  } catch (e) { host.innerHTML = `<div style="padding:20px;color:var(--danger);">Ошибка загрузки</div>`; }
}

function resetSupportChat() {
  document.getElementById('support-chat-head').innerHTML = `<div style="color:var(--text-3);font-size:14px;">Выберите обращение слева</div>`;
  document.getElementById('support-chat-messages').innerHTML = '';
  document.getElementById('support-chat-foot').style.display = 'none';
}

async function openStaffTicket(id) {
  activeTicketId = id;
  clearInterval(supportPoll);
  await renderStaffChat();
  supportPoll = setInterval(renderStaffChat, 7000);
  // Подсветить активный тикет
  document.querySelectorAll('.ticket-row').forEach((r) => r.classList.toggle('active', Number(r.dataset.tid) === id));
}

async function renderStaffChat() {
  if (!activeTicketId) return;
  try {
    const { ticket, messages } = await api(`/support/${activeTicketId}`);
    const si = STATUS_INFO[ticket.status] || { icon: '⚪', label: ticket.status, cls: 'badge-user' };
    const isClosed = ticket.status === 'closed';

    document.getElementById('support-chat-head').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:700;font-size:15px;">${escapeHtml(ticket.subject)}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:3px;">
            От: ${ticket.user_nickname ? `<a href="profile.html?id=${ticket.user_id}">${escapeHtml(ticket.user_nickname)}</a>` : 'Гость'} ·
            ${formatDate(ticket.created_at)}
            ${ticket.claimed_nickname ? ` · Принял: <b>${escapeHtml(ticket.claimed_nickname)}</b>` : ''}
          </div>
        </div>
        <div class="row-flex" style="flex-wrap:wrap;gap:6px;">
          <span class="badge ${si.cls}">${si.icon} ${si.label}</span>
          ${ticket.status === 'open' ? `<button class="btn btn-sm btn-outline" id="btn-claim-ticket">Принять</button>` : ''}
          ${!isClosed ? `<button class="btn btn-sm btn-danger" id="btn-close-ticket">Закрыть</button>` : ''}
        </div>
      </div>`;

    document.getElementById('btn-claim-ticket')?.addEventListener('click', async () => {
      try { await api(`/support/staff/tickets/${activeTicketId}/claim`, { method: 'PUT' }); renderStaffChat(); loadStaffTickets(document.querySelector('.status-filter.active')?.dataset.status || 'open'); }
      catch (e) { apiErrorToast(e); }
    });
    document.getElementById('btn-close-ticket')?.addEventListener('click', async () => {
      const ok = await confirmModal({ title: 'Закрыть обращение?', text: 'Обращение будет закрыто. Пользователь получит уведомление.', confirmText: 'Закрыть', danger: false });
      if (!ok) return;
      try { await api(`/support/staff/tickets/${activeTicketId}/close`, { method: 'PUT' }); renderStaffChat(); loadStaffTickets(document.querySelector('.status-filter.active')?.dataset.status || 'open'); loadStats(); }
      catch (e) { apiErrorToast(e); }
    });

    const box = document.getElementById('support-chat-messages');
    const wasBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 40;
    box.innerHTML = messages.map((m) => {
      const isSystem = m.content.startsWith('—');
      if (isSystem) return `<div style="text-align:center;font-style:italic;font-size:12.5px;color:var(--text-3);padding:3px 0;">${escapeHtml(m.content)}</div>`;
      const isStaffMsg = !!m.is_staff;
      return `
      <div style="display:flex;flex-direction:column;align-items:${isStaffMsg ? 'flex-end' : 'flex-start'};">
        <div style="font-size:11px;color:var(--text-3);margin-bottom:3px;">
          ${isStaffMsg ? `<span class="badge badge-admin" style="font-size:10px;">Персонал</span> ` : ''}${escapeHtml(m.nickname || 'Гость')} · ${formatDate(m.created_at)}
        </div>
        <div class="${isStaffMsg ? 'bubble bubble-me' : 'bubble bubble-them'}" style="max-width:80%;word-break:break-word;">${escapeHtml(m.content)}</div>
      </div>`;
    }).join('');
    if (wasBottom) box.scrollTop = box.scrollHeight;

    const foot = document.getElementById('support-chat-foot');
    foot.style.display = isClosed ? 'none' : 'block';
  } catch (e) { /* тихо */ }
}

async function staffReply(e) {
  e.preventDefault();
  if (!activeTicketId) return;
  const input = document.getElementById('staff-reply-input');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  try {
    await api(`/support/${activeTicketId}/messages`, { method: 'POST', body: { content } });
    await renderStaffChat();
    // Обновляем список тикетов тоже
    const activeStatus = document.querySelector('.status-filter.active')?.dataset.status || 'open';
    loadStaffTickets(activeStatus);
  } catch (err) { apiErrorToast(err); }
}

async function pollSupportBadge() {
  try {
    const { tickets } = await api('/support/staff/tickets?status=open');
    const badge = document.getElementById('support-unread-badge');
    if (badge) {
      badge.style.display = tickets.length > 0 ? 'inline-flex' : 'none';
      badge.textContent = tickets.length > 9 ? '9+' : tickets.length;
    }
  } catch (e) { /* тихо */ }
  setTimeout(pollSupportBadge, 30000);
}
