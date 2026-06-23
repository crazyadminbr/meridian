/* ============================================================================
   js/forum.js — список категорий форума
   ============================================================================ */

(async function () {
  await initApp();
  loadCategories();
})();

async function loadCategories() {
  const host = document.getElementById('categories-list');
  try {
    const { categories } = await api('/forum/categories');
    if (!categories.length) {
      host.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="es-icon">📭</div><h4>Категорий пока нет</h4></div>`;
      return;
    }
    host.innerHTML = categories
      .map((c) => {
        const lp = c.lastPost
          ? `<span class="lp-title">${escapeHtml(c.lastPost.topic_title)}</span>${escapeHtml(c.lastPost.nickname)} · ${formatDate(c.lastPost.created_at)}`
          : 'Сообщений пока нет';
        return `
        <a href="category.html?slug=${c.slug}" class="card card-hover category-card" style="text-decoration:none;">
          <div class="category-icon"><img src="${c.icon}" alt=""></div>
          <div class="category-info">
            <h3>${escapeHtml(c.name)}</h3>
            <p>${escapeHtml(c.description)}</p>
          </div>
          <div class="category-stats">
            <div class="cs-item"><div class="cs-num">${c.topicsCount}</div><div class="cs-lab">Тем</div></div>
            <div class="cs-item"><div class="cs-num">${c.postsCount}</div><div class="cs-lab">Сообщ.</div></div>
          </div>
          <div class="category-lastpost">${lp}</div>
        </a>`;
      })
      .join('');
  } catch (e) {
    host.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Не удалось загрузить разделы форума</div>`;
  }
}
