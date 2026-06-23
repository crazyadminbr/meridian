/* ============================================================================
   js/support.js — страница поддержки (пользовательская часть)
   ============================================================================ */

let activeTicketId = null;
let chatPoll = null;

(async function () {
  await initApp();

  // Если не авторизован — скрываем вкладки тикетов и показываем поле email
  if (!currentUser) {
    document.getElementById('tab-my-btn').style.display = 'none';
    document.getElementById('guest-email-group').style.display = 'block';
  }

  setupTabs();
  setupNewTicketForm();
  document.getElementById('back-to-list').onclick = () => {
    clearInterval(chatPoll);
    document.getElementById('ticket-chat').style.display = 'none';
    document.getElementById('my-tickets-list').style.display = 'block';
  };
  document.getElementById('chat-reply-form').addEventListener('submit', submitChatReply);

  // Открыть тикет по параметру URL (например, из уведомления)
  const ticketParam = getParam('ticket');
  if (ticketParam && currentUser) {
    switchTab('my');
    await loadMyTickets();
    openTicket(Number(ticketParam));
  }
})();

function setupTabs() {
  document.querySelectorAll('#support-tabs .tab-btn').forEach((btn) => {
    btn.onclick = async () => switchTab(btn.dataset.tab);
  });
}

async function switchTab(name) {
  document.querySelectorAll('#support-tabs .tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  document.getElementById(`panel-${name}`).classList.add('active');

  clearInterval(chatPoll);
  document.getElementById('ticket-chat').style.display = 'none';
  document.getElementById('my-tickets-list').style.display = 'block';

  if (name === 'my' && currentUser) await loadMyTickets();
}

async function loadMyTickets() {
  const host = document.getElementById('my-tickets-list');
  if (!currentUser) {
    host.innerHTML = `<div class="empty-state"><div class="es-icon">🔒</div><h4>Войдите в аккаунт, чтобы увидеть свои обращения</h4></div>`;
    return;
  }
  try {
    const { tickets } = await api('/support/my');
    if (!tickets.length) {
      host.innerHTML = `<div class="empty-state"><div class="es-icon">📭</div><h4>У вас пока нет обращений</h4><p>Нажмите «Создать обращение», если нужна помощь</p></div>`;
      return;
    }
    const STATUS = { open: ['🟡', 'Ожидает ответа'], claimed: ['🟢', 'Принято в работу'], closed: ['⚫', 'Закрыто'] };
    host.innerHTML = tickets.map((t) => {
      const [icon, label] = STATUS[t.status] || ['⚪', t.status];
      return `
      <div class="card" style="margin-bottom:12px;padding:18px 22px;cursor:pointer;transition:border-color .2s;" class="card card-hover" data-tid="${t.id}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;font-size:15px;">${escapeHtml(t.subject)}</div>
            <div style="font-size:12.5px;color:var(--text-3);margin-top:4px;">${formatDate(t.updated_at)} · ${t.claimed_nickname ? 'Отвечает: ' + escapeHtml(t.claimed_nickname) : 'Ещё не принято'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
            <span class="badge ${t.status === 'closed' ? 'badge-locked' : t.status === 'claimed' ? 'badge-online' : 'badge-pinned'}">${icon} ${label}</span>
            <button class="btn btn-outline btn-sm open-ticket" data-tid="${t.id}">Открыть →</button>
          </div>
        </div>
        ${t.last_message ? `<div style="margin-top:8px;font-size:13px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(t.last_message)}</div>` : ''}
      </div>`;
    }).join('');

    host.querySelectorAll('.open-ticket').forEach((btn) => {
      btn.onclick = (e) => { e.stopPropagation(); openTicket(Number(btn.dataset.tid)); };
    });
    host.querySelectorAll('[data-tid]').forEach((row) => {
      row.onclick = () => openTicket(Number(row.dataset.tid));
    });
  } catch (e) {
    host.innerHTML = `<div class="empty-state">Не удалось загрузить обращения</div>`;
  }
}

async function openTicket(id) {
  activeTicketId = id;
  document.getElementById('my-tickets-list').style.display = 'none';
  document.getElementById('ticket-chat').style.display = 'block';
  await renderTicketChat();
  chatPoll = setInterval(renderTicketChat, 8000);
}

async function renderTicketChat() {
  if (!activeTicketId) return;
  try {
    const { ticket, messages } = await api(`/support/${activeTicketId}`);

    document.getElementById('chat-ticket-subject').textContent = ticket.subject;
    const STATUS_LABEL = { open: '🟡 Ожидает', claimed: '🟢 В работе', closed: '⚫ Закрыто' };
    document.getElementById('chat-ticket-status').innerHTML =
      `<span class="badge ${ticket.status === 'closed' ? 'badge-locked' : ticket.status === 'claimed' ? 'badge-online' : 'badge-pinned'}">${STATUS_LABEL[ticket.status] || ticket.status}</span>`;

    const box = document.getElementById('chat-messages-box');
    const wasBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 40;
    box.innerHTML = messages.map((m) => {
      const isMine = currentUser && m.sender_id === currentUser.id;
      const isSystem = m.content && m.content.startsWith('—');
      if (isSystem) {
        return `<div style="text-align:center;color:var(--text-3);font-size:12.5px;font-style:italic;padding:4px 0;">${escapeHtml(m.content)}</div>`;
      }
      return `
      <div style="display:flex;flex-direction:column;align-items:${isMine ? 'flex-end' : 'flex-start'};">
        <div style="font-size:11px;color:var(--text-3);margin-bottom:3px;">
          ${m.is_staff ? `<span class="badge badge-admin" style="font-size:10px;">Персонал</span> ` : ''}${escapeHtml(m.nickname || 'Гость')} · ${formatDate(m.created_at)}
        </div>
        <div class="${isMine ? 'bubble bubble-me' : 'bubble bubble-them'}">${escapeHtml(m.content)}</div>
      </div>`;
    }).join('');
    if (wasBottom) box.scrollTop = box.scrollHeight;

    const replyArea  = document.getElementById('chat-reply-area');
    const closedNote = document.getElementById('chat-closed-notice');
    if (ticket.status === 'closed') {
      replyArea.style.display  = 'none';
      closedNote.style.display = 'block';
    } else {
      replyArea.style.display  = 'flex';
      closedNote.style.display = 'none';
    }
  } catch (e) { /* тихо */ }
}

async function submitChatReply(e) {
  e.preventDefault();
  const input = document.getElementById('chat-reply-input');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  try {
    await api(`/support/${activeTicketId}/messages`, { method: 'POST', body: { content } });
    await renderTicketChat();
  } catch (err) { apiErrorToast(err); }
}

function setupNewTicketForm() {
  document.getElementById('new-ticket-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const subject = document.getElementById('ticket-subject').value.trim();
    const message = document.getElementById('ticket-message').value.trim();
    const email   = document.getElementById('ticket-guest-email') ? document.getElementById('ticket-guest-email').value.trim() : '';
    const btn = document.getElementById('ticket-submit');
    btn.disabled = true;
    btn.textContent = 'Отправляем…';
    try {
      const { message: msg, ticketId } = await api('/support', { method: 'POST', body: { subject, message, email } });
      toast(msg, 'success');
      document.getElementById('new-ticket-form').reset();
      if (currentUser && ticketId) {
        await switchTab('my');
        await loadMyTickets();
        openTicket(ticketId);
      }
    } catch (err) {
      apiErrorToast(err);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Отправить обращение';
    }
  });
}
