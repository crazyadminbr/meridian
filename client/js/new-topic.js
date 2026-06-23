/* ============================================================================
   js/new-topic.js
   ============================================================================ */

(async function () {
  const ok = await initApp({ requireAuth: true });
  if (!ok) return;

  const slug       = getParam('slug');
  const select     = document.getElementById('topic-category');
  const userIsStaff = isStaffRole(currentUser.role);

  // Счётчики символов
  setupCounter('topic-title',   'title-counter',   200);
  setupCounter('topic-content', 'content-counter', 1000);

  let categoryId = null;
  try {
    const { categories: allCategories } = await api('/forum/categories');
    const categories = userIsStaff ? allCategories : allCategories.filter((c) => !c.staff_only);

    if (slug) {
      const requested = allCategories.find((c) => c.slug === slug);
      if (requested && requested.staff_only && !userIsStaff) {
        toast('Создавать темы в этом разделе могут только модераторы, администраторы и Команда Проекта', 'error');
        setTimeout(() => (window.location.href = 'forum.html'), 1200);
        return;
      }
    }

    select.innerHTML = categories.map((c) =>
      `<option value="${c.id}" data-slug="${c.slug}">${escapeHtml(c.name)}${c.staff_only ? ' (только персонал)' : ''}</option>`
    ).join('');
    select.disabled = false;

    if (slug) {
      const found = categories.find((c) => c.slug === slug);
      if (found) {
        select.value = found.id;
        categoryId   = found.id;
        document.getElementById('bc-category').innerHTML =
          `<a href="category.html?slug=${found.slug}">${escapeHtml(found.name)}</a>`;
      }
    }
    if (!categoryId) categoryId = Number(select.value);
    select.addEventListener('change', () => { categoryId = Number(select.value); });
  } catch (e) { apiErrorToast(e); }

  document.getElementById('topic-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title   = document.getElementById('topic-title').value.trim();
    const content = document.getElementById('topic-content').value.trim();
    if (content.length > 1000) { toast('Сообщение не может быть длиннее 1000 символов', 'error'); return; }
    const btn = document.getElementById('topic-submit');
    btn.disabled = true; btn.textContent = 'Публикуем…';
    try {
      const { topic } = await api(`/forum/categories/${categoryId}/topics`, { method: 'POST', body: { title, content } });
      toast('Тема успешно создана!', 'success');
      setTimeout(() => (window.location.href = `topic.html?id=${topic.id}`), 500);
    } catch (err) {
      apiErrorToast(err);
      btn.disabled = false; btn.textContent = 'Опубликовать тему';
    }
  });
})();

function setupCounter(inputId, counterId, max) {
  const input   = document.getElementById(inputId);
  const counter = document.getElementById(counterId);
  if (!input || !counter) return;
  function update() {
    const len = input.value.length;
    counter.textContent = `${len} / ${max}`;
    counter.className   = 'char-counter' + (len > max * 0.9 ? ' warn' : '') + (len >= max ? ' over' : '');
  }
  input.addEventListener('input', update);
  update();
}
