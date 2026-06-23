/* ============================================================================
   js/topic.js
   ============================================================================ */

let topicId = null;
let topicData = null;
let quotedPost = null;

(async function () {
  await initApp();
  topicId = getParam('id');
  if (!topicId) { window.location.href = 'forum.html'; return; }
  await loadTopic(1);

  document.getElementById('reply-form').addEventListener('submit', submitReply);

  // Счётчик символов для поля ответа
  const replyTA  = document.getElementById('reply-content');
  const replyCnt = document.getElementById('reply-counter');
  if (replyTA && replyCnt) {
    replyTA.addEventListener('input', () => {
      const len = replyTA.value.length;
      replyCnt.textContent = `${len} / 1000`;
      replyCnt.className   = 'char-counter' + (len > 900 ? ' warn' : '') + (len >= 1000 ? ' over' : '');
    });
  }
})();

async function loadTopic(page) {
  try {
    const { topic, posts, pagination } = await api(`/forum/topics/${topicId}${qs({ page })}`);
    topicData = topic;

    document.title = `${topic.title} — Кровавый Меридиан`;
    document.getElementById('bc-category').innerHTML =
      `<a href="category.html?slug=${topic.category_slug}">${escapeHtml(topic.category_name)}</a>`;

    renderTopicHeader(topic);
    renderPosts(posts);
    renderPagination(document.getElementById('pagination'), pagination, loadTopic);
    setupReplyArea(topic);
    window.scrollTo({ top: page > 1 ? 0 : window.scrollY, behavior: 'smooth' });
  } catch (e) {
    document.getElementById('topic-header').innerHTML = `<div class="empty-state"><div class="es-icon">❌</div><h4>Тема не найдена</h4></div>`;
    document.getElementById('posts-list').innerHTML = '';
  }
}

function isStaff() {
  return currentUser && isStaffRole(currentUser.role);
}

/** Может ли текущий пользователь отвечать в этой теме (используется в нескольких местах) */
function canReplyInTopic(topic) {
  if (!currentUser) return false;
  if (topic.is_locked && !isStaff()) return false;
  if (topic.category_staff_only && !isStaff()) return false;
  return true;
}

function renderTopicHeader(t) {
  const isOwner = currentUser && currentUser.id === t.user_id;
  const canEditTitle = isOwner; // редактировать содержимое чужой темы нельзя даже персоналу
  const canModerate = isOwner || isStaff(); // удалять может ещё и персонал (модерация)

  document.getElementById('topic-header').innerHTML = `
    <div class="flex-between">
      <div class="row-flex" style="flex-wrap:wrap;">
        ${t.is_pinned ? pinnedBadge() : ''}
        ${t.is_locked ? lockedBadge() : ''}
      </div>
      <div class="row-flex" style="flex-wrap:wrap;">
        ${isStaff() ? `
          <button class="btn btn-outline btn-sm" id="btn-pin"><img class="badge-icon" src="icons/pin.png" alt="">${t.is_pinned ? 'Открепить' : 'Закрепить'}</button>
          <button class="btn btn-outline btn-sm" id="btn-lock"><img class="badge-icon" src="icons/lock.png" alt="">${t.is_locked ? 'Открыть' : 'Закрыть'}</button>
        ` : ''}
        ${canEditTitle ? `<button class="btn btn-outline btn-sm" id="btn-edit-title">${ICONS.edit} Изменить</button>` : ''}
        ${canModerate ? `<button class="btn btn-danger btn-sm" id="btn-delete-topic">${ICONS.trash} Удалить</button>` : ''}
      </div>
    </div>
    <h1 id="topic-title-text" style="margin-top:10px;">${escapeHtml(t.title)}</h1>
    <div class="topic-header-meta">
      <span>Автор: <a href="profile.html?id=${t.user_id}" style="color:var(--text-2);font-weight:600;">${escapeHtml(t.author_nickname)}</a></span>
      <span>·</span><span>${formatDateFull(t.created_at)}</span>
      <span>·</span><span>${ICONS.eye} ${t.views} просмотров</span>
    </div>`;

  if (isStaff()) {
    document.getElementById('btn-pin').onclick = async () => {
      await api(`/admin/topics/${t.id}/pin`, { method: 'PUT' });
      loadTopic(1);
    };
    document.getElementById('btn-lock').onclick = async () => {
      await api(`/admin/topics/${t.id}/lock`, { method: 'PUT' });
      loadTopic(1);
    };
  }
  if (canEditTitle) {
    document.getElementById('btn-edit-title').onclick = () => editTopicTitle(t);
  }
  if (canModerate) {
    document.getElementById('btn-delete-topic').onclick = async () => {
      const ok = await confirmModal({ title: 'Удалить тему?', text: 'Это действие нельзя отменить. Все сообщения темы будут удалены.', confirmText: 'Удалить' });
      if (!ok) return;
      try {
        await api(`/forum/topics/${t.id}`, { method: 'DELETE' });
        toast('Тема удалена', 'success');
        setTimeout(() => (window.location.href = 'forum.html'), 500);
      } catch (e) { apiErrorToast(e); }
    };
  }
}

function editTopicTitle(t) {
  const el = document.getElementById('topic-title-text');
  el.outerHTML = `
    <div class="form-row" style="margin-top:10px;">
      <input class="form-input" id="topic-title-edit" value="${escapeHtml(t.title)}" style="flex:1;">
      <button class="btn btn-primary btn-sm" id="save-title">Сохранить</button>
      <button class="btn btn-ghost btn-sm" id="cancel-title">Отмена</button>
    </div>`;
  document.getElementById('cancel-title').onclick = () => loadTopic(1);
  document.getElementById('save-title').onclick = async () => {
    const title = document.getElementById('topic-title-edit').value.trim();
    if (title.length < 3) { toast('Заголовок слишком короткий', 'error'); return; }
    try {
      await api(`/forum/topics/${t.id}`, { method: 'PUT', body: { title } });
      toast('Заголовок обновлён', 'success');
      loadTopic(1);
    } catch (e) { apiErrorToast(e); }
  };
}

function renderPosts(posts) {
  const host = document.getElementById('posts-list');
  if (!posts.length) {
    host.innerHTML = `<div class="card card-pad empty-state">Сообщений нет</div>`;
    return;
  }
  host.innerHTML = posts.map(renderPost).join('');

  posts.forEach((p) => {
    const likeBtn = document.getElementById(`like-${p.id}`);
    if (likeBtn) likeBtn.onclick = () => toggleLike(p.id);

    const quoteBtn = document.getElementById(`quote-${p.id}`);
    if (quoteBtn) quoteBtn.onclick = () => setQuote(p);

    const editBtn = document.getElementById(`edit-${p.id}`);
    if (editBtn) editBtn.onclick = () => editPost(p);

    const delBtn = document.getElementById(`del-${p.id}`);
    if (delBtn) delBtn.onclick = () => deletePost(p.id);
  });
}

function renderPost(p) {
  const isOwner = currentUser && currentUser.id === p.user_id;
  // Редактировать текст сообщения может ТОЛЬКО автор — даже персонал больше не может
  // подменять чужие слова. Удалять (для модерации) по-прежнему может персонал.
  const canEditContent = isOwner;
  const canDelete = isOwner || isStaff();
  const canReply = topicData && canReplyInTopic(topicData);
  const joined = p.user_created_at ? new Date(p.user_created_at.replace(' ', 'T') + 'Z').toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }) : '';

  return `
  <div class="card post" id="post-${p.id}">
    <div class="post-author">
      <img class="avatar avatar-lg" src="${p.avatar}" alt="">
      <a href="profile.html?id=${p.user_id}" class="pa-name">${escapeHtml(p.nickname)}</a>
      ${roleBadge(p.role)}
      <div class="pa-meta">⭐ Репутация: ${p.reputation}</div>
      <div class="pa-meta">На форуме с ${joined}</div>
    </div>
    <div class="post-body">
      <div class="post-toprow">
        <span class="post-time">${formatDateFull(p.created_at)}${p.updated_at !== p.created_at ? ' · изменено' : ''}</span>
      </div>
      ${p.quoted ? `<div class="post-quote">${ICONS.quote} <b>${escapeHtml(p.quoted.nickname)}</b> писал(а): ${escapeHtml((p.quoted.content || '').slice(0, 180))}${(p.quoted.content || '').length > 180 ? '…' : ''}</div>` : ''}
      <div class="post-content" id="content-${p.id}">${escapeHtml(p.content)}</div>
      <div class="post-actions">
        <button class="btn btn-outline btn-sm like-btn ${p.likedByMe ? 'liked' : ''}" id="like-${p.id}">${p.likedByMe ? ICONS.heartFill : ICONS.heart} <span id="likecount-${p.id}">${p.likesCount}</span></button>
        ${canReply ? `<button class="btn btn-outline btn-sm" id="quote-${p.id}">${ICONS.quote} Цитировать</button>` : ''}
        ${canEditContent ? `<button class="btn btn-outline btn-sm" id="edit-${p.id}">${ICONS.edit} Редактировать</button>` : ''}
        ${canDelete ? `<button class="btn btn-outline btn-sm" id="del-${p.id}" style="color:var(--danger)">${ICONS.trash} Удалить</button>` : ''}
      </div>
    </div>
  </div>`;
}

async function toggleLike(postId) {
  if (!currentUser) { toast('Войдите, чтобы оценивать сообщения', 'error'); return; }
  try {
    const { liked, likesCount } = await api(`/forum/posts/${postId}/like`, { method: 'POST' });
    const btn = document.getElementById(`like-${postId}`);
    btn.classList.toggle('liked', liked);
    btn.innerHTML = `${liked ? ICONS.heartFill : ICONS.heart} <span>${likesCount}</span>`;
  } catch (e) { apiErrorToast(e); }
}

function setQuote(p) {
  quotedPost = p;
  // Превью цитаты в форме ответа — заведомо короткое (макс. 140 симв.), чтобы не раздувать
  // блок: сама цитата при отправке хранится по ссылке (quote_post_id), а не копируется целиком.
  const preview = (p.content || '').replace(/\s+/g, ' ').slice(0, 140);
  document.getElementById('quote-preview').innerHTML = `
    <div class="post-quote flex-between">
      <span>${ICONS.quote} Цитата из сообщения <b>${escapeHtml(p.nickname)}</b>: «${escapeHtml(preview)}${(p.content || '').length > 140 ? '…' : ''}»</span>
      <button class="btn btn-ghost btn-sm" id="cancel-quote">✕</button>
    </div>`;
  document.getElementById('cancel-quote').onclick = () => { quotedPost = null; document.getElementById('quote-preview').innerHTML = ''; };
  document.getElementById('reply-box').scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('reply-content').focus();
}

function editPost(p) {
  const el = document.getElementById(`content-${p.id}`);
  el.innerHTML = `
    <textarea class="form-textarea" id="editarea-${p.id}" rows="5">${escapeHtml(p.content)}</textarea>
    <div class="row-flex" style="margin-top:10px;">
      <button class="btn btn-primary btn-sm" id="savepost-${p.id}">Сохранить</button>
      <button class="btn btn-ghost btn-sm" id="cancelpost-${p.id}">Отмена</button>
    </div>`;
  document.getElementById(`cancelpost-${p.id}`).onclick = () => loadTopic(1);
  document.getElementById(`savepost-${p.id}`).onclick = async () => {
    const content = document.getElementById(`editarea-${p.id}`).value.trim();
    if (!content) { toast('Сообщение не может быть пустым', 'error'); return; }
    try {
      await api(`/forum/posts/${p.id}`, { method: 'PUT', body: { content } });
      toast('Сообщение обновлено', 'success');
      loadTopic(1);
    } catch (e) { apiErrorToast(e); }
  };
}

async function deletePost(postId) {
  const ok = await confirmModal({ title: 'Удалить сообщение?', text: 'Это действие нельзя отменить.', confirmText: 'Удалить' });
  if (!ok) return;
  try {
    await api(`/forum/posts/${postId}`, { method: 'DELETE' });
    toast('Сообщение удалено', 'success');
    loadTopic(1);
  } catch (e) { apiErrorToast(e); }
}

function setupReplyArea(topic) {
  const replyBox = document.getElementById('reply-box');
  const locked = document.getElementById('reply-locked');
  const guest = document.getElementById('reply-guest');
  replyBox.style.display = 'none';
  locked.style.display = 'none';
  guest.style.display = 'none';

  if (!currentUser) { guest.style.display = 'block'; return; }
  if (topic.is_locked && !isStaff()) {
    locked.style.display = 'block';
    locked.querySelector('p').innerHTML = `${ICONS.lock} Эта тема закрыта для новых ответов`;
    return;
  }
  if (topic.category_staff_only && !isStaff()) {
    locked.style.display = 'block';
    locked.querySelector('p').textContent = 'Отвечать в этом разделе могут только модераторы, администраторы и Команда Проекта.';
    return;
  }
  replyBox.style.display = 'block';
}

async function submitReply(e) {
  e.preventDefault();
  const content = document.getElementById('reply-content').value.trim();
  if (!content) return;
  const btn = document.getElementById('reply-submit');
  btn.disabled = true;
  btn.textContent = 'Отправляем…';
  try {
    await api(`/forum/topics/${topicId}/posts`, {
      method: 'POST',
      body: { content, quote_post_id: quotedPost ? quotedPost.id : undefined },
    });
    document.getElementById('reply-content').value = '';
    quotedPost = null;
    document.getElementById('quote-preview').innerHTML = '';
    toast('Ответ опубликован', 'success');
    // переходим на последнюю страницу, чтобы увидеть новый ответ
    const { pagination } = await api(`/forum/topics/${topicId}`);
    await loadTopic(pagination.totalPages);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  } catch (err) {
    apiErrorToast(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Отправить ответ';
  }
}
