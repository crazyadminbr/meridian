/* ============================================================================
   js/search.js
   ============================================================================ */

(async function () {
  await initApp();
  const q = getParam('q') || '';
  document.getElementById('search-q').textContent = q;
  document.getElementById('search-input').value = q;

  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      window.location.href = `search.html?q=${encodeURIComponent(e.target.value.trim())}`;
    }
  });

  if (!q || q.length < 2) {
    document.getElementById('search-topics').innerHTML = `<div class="empty-state">Введите минимум 2 символа для поиска</div>`;
    return;
  }

  try {
    const { topics, posts, users } = await api(`/forum/search${qs({ q })}`);

    document.getElementById('search-topics').innerHTML = topics.length
      ? topics.map((t) => `
        <div class="topic-row">
          <div class="topic-main">
            <div class="topic-title-row"><a href="topic.html?id=${t.id}">${escapeHtml(t.title)}</a></div>
            <div class="topic-meta">${escapeHtml(t.category_name)} · от ${escapeHtml(t.author_nickname)} · ${formatDate(t.updated_at)}</div>
          </div>
        </div>`).join('')
      : `<div class="empty-state">Темы не найдены</div>`;

    document.getElementById('search-posts').innerHTML = posts.length
      ? posts.map((p) => `
        <div class="topic-row">
          <div class="topic-main">
            <div class="topic-title-row"><a href="topic.html?id=${p.topic_id}">${escapeHtml(p.topic_title)}</a></div>
            <div class="topic-meta">${escapeHtml(p.author_nickname)}: «${escapeHtml(p.content).slice(0, 120)}…» · ${formatDate(p.created_at)}</div>
          </div>
        </div>`).join('')
      : `<div class="empty-state">Сообщения не найдены</div>`;

    document.getElementById('search-users').innerHTML = users.length
      ? users.map((u) => `
        <a href="profile.html?id=${u.id}" class="card card-hover user-card" style="text-decoration:none;">
          <img class="avatar avatar-lg" src="${u.avatar}" style="margin:0 auto 12px;" alt="">
          <h4>${escapeHtml(u.nickname)}</h4>
          ${roleBadge(u.role)}
        </a>`).join('')
      : `<div class="empty-state" style="grid-column:1/-1">Пользователи не найдены</div>`;
  } catch (e) {
    apiErrorToast(e);
  }
})();
