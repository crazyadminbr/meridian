/* ============================================================================
   js/news-item.js
   ============================================================================ */

(async function () {
  await initApp();
  const id = getParam('id');
  const host = document.getElementById('news-content');
  if (!id) { host.innerHTML = `<div class="empty-state">Новость не найдена</div>`; return; }

  try {
    const { news } = await api(`/news/${id}`);
    document.title = `${news.title} — Кровавый Меридиан`;
    document.getElementById('page-title').textContent = `${news.title} — Кровавый Меридиан`;
    host.innerHTML = `
      <div class="na-date">${formatDateFull(news.created_at)} ${news.author_nickname ? '· Автор: ' + escapeHtml(news.author_nickname) : ''}</div>
      <h1>${escapeHtml(news.title)}</h1>
      <div class="na-content">${escapeHtml(news.content)}</div>`;
  } catch (e) {
    host.innerHTML = `<div class="empty-state"><div class="es-icon">❌</div><h4>Новость не найдена</h4></div>`;
  }
})();
