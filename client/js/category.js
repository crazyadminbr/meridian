/* ============================================================================
   js/category.js
   ============================================================================ */

let categorySlug = null;
let currentPage = 1;

(async function () {
  await initApp();
  categorySlug = getParam('slug');
  if (!categorySlug) {
    window.location.href = 'forum.html';
    return;
  }
  loadOnlineWidget('sidebar-online');
  await loadTopics(1);
})();

async function loadTopics(page) {
  currentPage = page;
  const host = document.getElementById('topics-list');
  host.innerHTML = `<div class="spinner"></div>`;

  try {
    const { category, topics, pagination } = await api(`/forum/categories/${categorySlug}/topics${qs({ page })}`);

    document.title = `${category.name} — Кровавый Меридиан`;
    document.getElementById('page-title').textContent = `${category.name} — Кровавый Меридиан`;
    document.getElementById('bc-category').textContent = category.name;
    document.getElementById('category-title').innerHTML = `<span class="accent-bar"></span><img src="${category.icon}" alt="" style="width:26px;height:26px;vertical-align:-5px;object-fit:contain;"> ${escapeHtml(category.name)}`;
    document.getElementById('category-desc').textContent = category.description;
    document.getElementById('sidebar-desc').textContent = category.description;

    // Раздел только для персонала: создавать темы могут модератор/админ/Команда Проекта
    const newTopicBtn = document.getElementById('new-topic-btn');
    if (category.staff_only && !(currentUser && isStaffRole(currentUser.role))) {
      newTopicBtn.style.display = 'none';
      const notice = document.getElementById('staff-only-notice');
      notice.style.display = 'block';
      notice.textContent = currentUser
        ? 'Создавать темы и отвечать в этом разделе могут только модераторы, администраторы и Команда Проекта.'
        : 'Этот раздел ведётся администрацией. Создавать темы и отвечать могут только модераторы, администраторы и Команда Проекта.';
    } else {
      newTopicBtn.style.display = '';
      newTopicBtn.href = `new-topic.html?slug=${categorySlug}`;
    }

    if (!topics.length) {
      host.innerHTML = `<div class="empty-state"><div class="es-icon">📭</div><h4>В этом разделе пока нет тем</h4><p>Стань первым, кто начнёт обсуждение!</p></div>`;
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    host.innerHTML = topics
      .map((t) => {
        const lp = t.lastPost
          ? `<b>${escapeHtml(t.lastPost.nickname)}</b><br>${formatDate(t.lastPost.created_at)}`
          : '—';
        return `
        <div class="topic-row">
          <img class="avatar avatar-md" src="${t.author_avatar}" alt="">
          <div class="topic-main">
            <div class="topic-title-row">
              ${t.is_pinned ? pinnedBadge() : ''}
              ${t.is_locked ? lockedBadge() : ''}
              <a href="topic.html?id=${t.id}">${escapeHtml(t.title)}</a>
            </div>
            <div class="topic-meta">от <a href="profile.html?id=${t.user_id}">${escapeHtml(t.author_nickname)}</a> · ${formatDate(t.created_at)}</div>
          </div>
          <div class="topic-stats">
            <div class="ts-item"><div class="ts-num">${t.postsCount}</div><div class="ts-lab">Ответов</div></div>
            <div class="ts-item"><div class="ts-num">${t.views}</div><div class="ts-lab">Просм.</div></div>
          </div>
          <div class="topic-lastreply">${lp}</div>
        </div>`;
      })
      .join('');

    renderPagination(document.getElementById('pagination'), pagination, loadTopics);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    host.innerHTML = `<div class="empty-state">Раздел не найден или произошла ошибка</div>`;
  }
}
