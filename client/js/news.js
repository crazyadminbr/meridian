/* ============================================================================
   js/news.js
   ============================================================================ */

(async function () {
  await initApp();
  loadNews(1);
})();

async function loadNews(page) {
  const host = document.getElementById('news-list');
  try {
    const { news, pagination } = await api(`/news${qs({ page, limit: 9 })}`);
    if (!news.length) {
      host.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="es-icon">📰</div><h4>Новостей пока нет</h4><p>Загляните позже!</p></div>`;
      return;
    }
    host.innerHTML = news
      .map(
        (n) => `
      <a href="news-item.html?id=${n.id}" class="card card-hover news-card" style="text-decoration:none;">
        <div class="news-card-img">📰</div>
        <div class="news-card-body">
          <div class="nc-date">${formatDate(n.created_at)} ${n.author_nickname ? '· ' + escapeHtml(n.author_nickname) : ''}</div>
          <h3>${escapeHtml(n.title)}</h3>
          <p>${escapeHtml(n.content).slice(0, 110)}…</p>
          <div class="nc-more">Читать далее →</div>
        </div>
      </a>`
      )
      .join('');
    renderPagination(document.getElementById('pagination'), pagination, loadNews);
  } catch (e) {
    host.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Не удалось загрузить новости</div>`;
  }
}
