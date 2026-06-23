/* ============================================================================
   js/profile.js — профиль пользователя (просмотр + редактирование + баннер)
   ============================================================================ */

let profileUser  = null;
let isOwnProfile = false;

(async function () {
  await initApp();

  const idParam  = getParam('id');
  if (!idParam && !currentUser) { window.location.href = 'login.html'; return; }
  const targetId = idParam ? Number(idParam) : currentUser.id;
  isOwnProfile   = currentUser && Number(targetId) === currentUser.id;

  await loadProfile(targetId);
  setupTabs();

  if (isOwnProfile) {
    document.getElementById('tab-edit-btn').style.display     = '';
    document.getElementById('tab-security-btn').style.display = '';
    fillEditForm();
    setupEditForm();
    setupAvatarUpload();
    setupPasswordForm();
    setupAboutCounter();
  }

  // Баннер: кнопки показываем только owner'у (для любого профиля)
  if (currentUser && currentUser.role === 'owner') {
    setupBannerControls(targetId);
  }
})();

/* ─────────────────────────── ЗАГРУЗКА ПРОФИЛЯ ─────────────────────────── */
async function loadProfile(id) {
  try {
    const { user } = await api(`/users/${id}`);
    profileUser = user;

    document.title = `${user.nickname} — Кровавый Меридиан`;
    document.getElementById('page-title').textContent = `${user.nickname} — Кровавый Меридиан`;

    // Баннер
    const bannerImg = document.getElementById('banner-img');
    if (user.banner) {
      bannerImg.src = user.banner;
      bannerImg.style.display = 'block';
      document.getElementById('banner-remove-btn').style.display = '';
    } else {
      bannerImg.style.display = 'none';
      document.getElementById('banner-remove-btn').style.display = 'none';
    }

    // Аватар + ник + статус
    document.getElementById('profile-header-body').innerHTML = `
      <div class="profile-avatar-wrap">
        <img class="avatar avatar-xl" src="${user.avatar}" alt="">
        ${user.is_online ? '<span class="online-dot" style="width:16px;height:16px;bottom:3px;right:3px;"></span>' : ''}
      </div>
      <div class="profile-info">
        <h1>${escapeHtml(user.nickname)}</h1>
        <div class="status-text">${escapeHtml(user.status || '')}</div>
        <div class="badges-row">
          ${roleBadge(user.role)}
          ${user.is_online ? '<span class="badge badge-online">🟢 Онлайн</span>' : ''}
        </div>
        ${!isOwnProfile && currentUser ? `<a href="messages.html?with=${user.id}" class="btn btn-primary btn-sm" style="margin-top:12px;">✉️ Написать</a>` : ''}
      </div>`;

    // Статистика
    const joined = user.created_at ? new Date(user.created_at.replace(' ','T')+'Z').toLocaleDateString('ru-RU',{month:'short',year:'numeric'}) : '—';
    document.getElementById('stat-reputation').textContent = user.reputation;
    document.getElementById('stat-topics').textContent     = user.topicsCount;
    document.getElementById('stat-posts').textContent      = user.postsCount;
    document.getElementById('stat-joined').textContent     = joined;
    document.getElementById('profile-stats').style.display = 'flex';

    // О себе
    document.getElementById('overview-content').innerHTML = `
      <h3 style="margin-bottom:12px;">О себе</h3>
      <p style="color:var(--text-2);white-space:pre-wrap;line-height:1.7;font-size:14px;">${escapeHtml(user.about) || '<span style="color:var(--text-3);font-style:italic;">Пользователь ещё ничего не написал о себе.</span>'}</p>
      <hr style="border:none;border-top:1px solid var(--border);margin:18px 0;">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;">
        <div><div style="color:var(--text-3);font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Роль</div>${roleBadge(user.role)}</div>
        <div><div style="color:var(--text-3);font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Зарегистрирован</div><div style="font-weight:600;font-size:13.5px;">${formatDateFull(user.created_at)}</div></div>
      </div>`;
  } catch (e) {
    document.getElementById('profile-header-body').innerHTML = `<div class="empty-state" style="padding:40px;"><div class="es-icon">❌</div><h4>Пользователь не найден</h4></div>`;
  }
}

/* ─────────────────────────── ВКЛАДКИ ─────────────────────────── */
function setupTabs() {
  document.querySelectorAll('#profile-tabs .tab-btn').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('#profile-tabs .tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
    };
  });
}

/* ─────────────────────────── РЕДАКТИРОВАНИЕ ПРОФИЛЯ ─────────────────────────── */
function fillEditForm() {
  if (!profileUser) return;
  document.getElementById('edit-avatar-preview').src  = profileUser.avatar;
  document.getElementById('edit-nickname').value       = profileUser.nickname;
  document.getElementById('edit-status').value         = profileUser.status || '';
  document.getElementById('edit-about').value          = profileUser.about  || '';
  updateAboutCounter();
}

function setupAboutCounter() {
  const textarea = document.getElementById('edit-about');
  const counter  = document.getElementById('about-counter');
  if (!textarea || !counter) return;
  function updateAboutCounter() {
    const len = textarea.value.length;
    counter.textContent = `${len} / 360`;
    counter.className   = 'char-counter' + (len > 340 ? ' warn' : '') + (len > 360 ? ' over' : '');
  }
  textarea.addEventListener('input', updateAboutCounter);
  updateAboutCounter();
}
function updateAboutCounter() {
  const el = document.getElementById('edit-about');
  const co = document.getElementById('about-counter');
  if (!el || !co) return;
  const len = el.value.length;
  co.textContent = `${len} / 360`;
  co.className   = 'char-counter' + (len > 340 ? ' warn' : '') + (len >= 360 ? ' over' : '');
}

function setupEditForm() {
  document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('edit-nickname').value.trim();
    const status   = document.getElementById('edit-status').value.trim();
    const about    = document.getElementById('edit-about').value.trim();
    if (about.length > 360) { toast('О себе — максимум 360 символов', 'error'); return; }
    const btn = document.getElementById('edit-submit');
    btn.disabled = true; btn.textContent = 'Сохраняем…';
    try {
      const { user } = await api('/users/me', { method: 'PUT', body: { nickname, status, about } });
      Auth.cacheUser(user);
      toast('Профиль обновлён', 'success');
      await loadProfile(user.id);
      fillEditForm();
    } catch (err) { apiErrorToast(err); }
    finally { btn.disabled = false; btn.textContent = 'Сохранить изменения'; }
  });
}

function setupAvatarUpload() {
  document.getElementById('avatar-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('edit-avatar-preview').src = URL.createObjectURL(file);
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      const { avatar } = await api('/users/me/avatar', { method: 'PUT', body: fd, isFormData: true });
      toast('Аватар обновлён', 'success');
      const cached = Auth.getCachedUser();
      if (cached) { cached.avatar = avatar; Auth.cacheUser(cached); }
      await loadProfile(profileUser.id);
    } catch (err) { apiErrorToast(err); }
  });
}

function setupPasswordForm() {
  document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword     = document.getElementById('new-password').value;
    const btn = document.getElementById('password-submit');
    btn.disabled = true; btn.textContent = 'Сохраняем…';
    try {
      await api('/users/me/password', { method: 'PUT', body: { currentPassword, newPassword } });
      toast('Пароль успешно изменён', 'success');
      document.getElementById('password-form').reset();
    } catch (err) { apiErrorToast(err); }
    finally { btn.disabled = false; btn.textContent = 'Изменить пароль'; }
  });
}

/* ─────────────────────────── БАННЕР (только owner) ─────────────────────────── */
function setupBannerControls(targetUserId) {
  const editBtn   = document.getElementById('banner-edit-btn');
  const fileInput = document.getElementById('banner-file-input');
  const removeBtn = document.getElementById('banner-remove-btn');
  if (!editBtn) return;
  editBtn.style.display = 'flex';

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('banner', file);
    try {
      let url, resp;
      if (isOwnProfile) {
        resp = await api('/users/me/banner', { method: 'PUT', body: fd, isFormData: true });
      } else {
        resp = await api(`/users/${targetUserId}/banner`, { method: 'PUT', body: fd, isFormData: true });
      }
      toast('Баннер обновлён', 'success');
      await loadProfile(targetUserId);
    } catch (err) { apiErrorToast(err); }
  });

  removeBtn.addEventListener('click', async () => {
    const ok = await confirmModal({ title: 'Удалить баннер?', text: 'Баннер будет убран с профиля.', confirmText: 'Удалить', danger: true });
    if (!ok) return;
    try {
      await api(`/users/${targetUserId}/banner`, { method: 'DELETE' });
      toast('Баннер удалён', 'success');
      await loadProfile(targetUserId);
    } catch (err) { apiErrorToast(err); }
  });
}
