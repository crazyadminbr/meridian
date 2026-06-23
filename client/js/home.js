/* ============================================================================
   js/home.js — логика главной страницы
   ============================================================================ */

(async function () {
  await initApp();

  // кнопки героя зависят от того, авторизован ли пользователь
  const heroActions = document.getElementById('hero-actions');
  if (currentUser) {
    heroActions.innerHTML = `
      <a class="btn btn-primary btn-lg" href="forum.html">Перейти на форум</a>
      <a class="btn btn-outline btn-lg" href="profile.html">Мой профиль</a>`;
  } else {
    heroActions.innerHTML = `
      <a class="btn btn-primary btn-lg" href="register.html">Зарегистрироваться</a>
      <a class="btn btn-outline btn-lg" href="forum.html">Перейти на форум</a>`;
  }

  loadCategoriesPreview();
  loadNewsPreview();
  loadHeroStats();
})();

async function loadHeroStats() {
  try {
    const { categories } = await api('/forum/categories');
    const topics = categories.reduce((s, c) => s + c.topicsCount, 0);
    const posts = categories.reduce((s, c) => s + c.postsCount, 0);
    document.getElementById('stat-topics').textContent = topics;
    document.getElementById('stat-posts').textContent = posts;
  } catch (e) { /* игнор */ }

  try {
    const { count } = await api('/users/online');
    document.getElementById('stat-online').textContent = count;
  } catch (e) { /* игнор */ }

  try {
    const { pagination } = await api('/users?limit=1');
    document.getElementById('stat-users').textContent = pagination.total;
  } catch (e) { /* игнор */ }
}

async function loadCategoriesPreview() {
  const host = document.getElementById('home-categories');
  try {
    const { categories } = await api('/forum/categories');
    if (!categories.length) {
      host.innerHTML = `<div class="empty-state"><div class="es-icon">📭</div><h4>Категорий пока нет</h4></div>`;
      return;
    }
    host.innerHTML = categories
      .slice(0, 6)
      .map(
        (c) => `
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
      </a>`
      )
      .join('');
  } catch (e) {
    host.innerHTML = `<div class="empty-state">Не удалось загрузить категории</div>`;
  }
}

async function loadNewsPreview() {
  const host = document.getElementById('home-news');
  try {
    const { news } = await api('/news?limit=3');
    if (!news.length) {
      host.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="es-icon">📰</div><h4>Новостей пока нет</h4></div>`;
      return;
    }
    host.innerHTML = news
      .map(
        (n) => `
      <a href="news-item.html?id=${n.id}" class="card card-hover news-card" style="text-decoration:none;">
        <div class="news-card-img">📰</div>
        <div class="news-card-body">
          <div class="nc-date">${formatDate(n.created_at)}</div>
          <h3>${escapeHtml(n.title)}</h3>
          <p>${escapeHtml(n.content).slice(0, 100)}…</p>
          <div class="nc-more">Читать далее →</div>
        </div>
      </a>`
      )
      .join('');
  } catch (e) {
    host.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Не удалось загрузить новости</div>`;
  }
}
