/* ============================================================================
   js/users.js
   ============================================================================ */

let userSearchTimeout = null;

(async function () {
  await initApp();
  loadUsers(1);

  document.getElementById('user-search').addEventListener('input', (e) => {
    clearTimeout(userSearchTimeout);
    userSearchTimeout = setTimeout(() => loadUsers(1, e.target.value.trim()), 350);
  });
})();

async function loadUsers(page, search = '') {
  const host = document.getElementById('users-list');
  host.innerHTML = `<div class="spinner"></div>`;

  try {
    const { users, pagination } = await api(`/users${qs({ page, search, limit: 16 })}`);
    if (!users.length) {
      host.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="es-icon">🔍</div><h4>Никого не найдено</h4></div>`;
      document.getElementById('pagination').innerHTML = '';
      return;
    }
    host.innerHTML = users
      .map(
        (u) => `
      <a href="profile.html?id=${u.id}" class="card card-hover user-card" style="text-decoration:none;">
        <div class="avatar-wrap">
          <img class="avatar avatar-lg" src="${u.avatar}" alt="">
          ${u.is_online ? '<span class="online-dot"></span>' : ''}
        </div>
        <h4>${escapeHtml(u.nickname)}</h4>
        <div class="uc-status">${escapeHtml(u.status || '')}</div>
        ${roleBadge(u.role)}
      </a>`
      )
      .join('');
    renderPagination(document.getElementById('pagination'), pagination, (p) => loadUsers(p, search));
  } catch (e) {
    host.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Ошибка загрузки</div>`;
  }
}
