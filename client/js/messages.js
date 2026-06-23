/* ============================================================================
   js/messages.js — личные сообщения
   Ключевые исправления:
   - переполнение чата: chat-messages имеет flex:1 + min-height:0 → скролл внутри
   - на мобильном: стек вместо grid, conv-list ограничен по высоте
   ============================================================================ */

let activePartnerId  = null;
let chatPollInterval = null;

(async function () {
  const ok = await initApp({ requireAuth: true });
  if (!ok) return;

  await loadConversations();

  const withId = getParam('with');
  if (withId) openConversation(Number(withId));

  document.getElementById('chat-form').addEventListener('submit', sendMessage);
})();

async function loadConversations() {
  const body = document.getElementById('conv-list-body');
  try {
    const { conversations } = await api('/messages/conversations');
    if (!conversations.length) {
      body.innerHTML = `<div style="padding:24px 16px;text-align:center;color:var(--text-3);font-size:13px;">Диалогов пока нет.<br>Напишите кому-нибудь с его профиля.</div>`;
      return;
    }
    body.innerHTML = conversations.map((c) => `
      <div class="conv-item ${c.partner.id === activePartnerId ? 'active' : ''}" data-id="${c.partner.id}">
        <div class="avatar-wrap" style="flex-shrink:0;">
          <img class="avatar avatar-sm" src="${c.partner.avatar}" alt="">
          ${c.partner.is_online ? '<span class="online-dot"></span>' : ''}
        </div>
        <div style="flex:1;min-width:0;">
          <div class="ci-name">${escapeHtml(c.partner.nickname)}</div>
          <div class="ci-preview">${escapeHtml(c.lastMessage ? c.lastMessage.content : '')}</div>
        </div>
        ${c.unreadCount > 0 ? `<span class="icon-badge" style="position:static;min-width:18px;height:18px;font-size:10px;">${c.unreadCount}</span>` : ''}
      </div>`).join('');

    body.querySelectorAll('.conv-item').forEach((el) => {
      el.onclick = () => openConversation(Number(el.dataset.id));
    });
  } catch (e) {
    body.innerHTML = `<div style="padding:20px;color:var(--danger);font-size:13px;">Ошибка загрузки</div>`;
  }
}

async function openConversation(partnerId) {
  activePartnerId = partnerId;
  document.getElementById('chat-form').style.display = 'flex';
  // Подсветить активный диалог
  document.querySelectorAll('.conv-item').forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.id) === partnerId);
  });
  if (chatPollInterval) clearInterval(chatPollInterval);
  await renderConversation();
  chatPollInterval = setInterval(renderConversation, 6000);
}

async function renderConversation() {
  if (!activePartnerId) return;
  try {
    const { partner, messages } = await api(`/messages/${activePartnerId}`);

    // Шапка чата
    document.getElementById('chat-head').innerHTML = `
      <img class="avatar avatar-sm" src="${partner.avatar}" alt="">
      <div style="flex:1;min-width:0;">
        <a href="profile.html?id=${partner.id}" style="font-weight:700;font-size:14px;">${escapeHtml(partner.nickname)}</a>
        ${partner.is_online ? '<span class="badge badge-online" style="margin-left:6px;">Онлайн</span>' : ''}
      </div>`;

    const box = document.getElementById('chat-messages');
    // Запоминаем, был ли скролл у нижнего края (чтобы автоскроллить при новых сообщениях)
    const wasAtBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 48;

    if (!messages.length) {
      box.innerHTML = `<div class="chat-empty">Начните диалог — напишите первое сообщение!</div>`;
    } else {
      box.innerHTML = messages.map((m) => {
        const isMine = m.sender_id === currentUser.id;
        return `
        <div style="display:flex;flex-direction:column;align-items:${isMine ? 'flex-end' : 'flex-start'};">
          <div class="bubble ${isMine ? 'bubble-me' : 'bubble-them'}">
            ${escapeHtml(m.content)}
            <span class="bubble-time">${formatDate(m.created_at)}</span>
          </div>
        </div>`;
      }).join('');
    }

    if (wasAtBottom || messages.length <= 15) {
      box.scrollTop = box.scrollHeight;
    }

    // Обновляем список диалогов (счётчики непрочитанных)
    await loadConversations();
    refreshNotifBadges();
  } catch (e) { /* тихо */ }
}

async function sendMessage(e) {
  e.preventDefault();
  const input   = document.getElementById('chat-text');
  const content = input.value.trim();
  if (!content || !activePartnerId) return;
  input.value = '';
  try {
    await api(`/messages/${activePartnerId}`, { method: 'POST', body: { content } });
    await renderConversation();
  } catch (err) { apiErrorToast(err); }
}
