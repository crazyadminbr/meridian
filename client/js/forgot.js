/* ============================================================================
   js/forgot.js
   ============================================================================ */

(async function () {
  await initApp();

  document.getElementById('forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const btn = document.getElementById('forgot-submit');
    btn.disabled = true;
    btn.textContent = 'Отправляем…';
    try {
      const { message } = await api('/auth/forgot-password', { method: 'POST', body: { email } });
      document.getElementById('forgot-box').innerHTML = `
        <h1>Проверьте почту</h1>
        <div class="alert alert-info">${escapeHtml(message)}</div>
        <a class="btn btn-outline btn-block" href="login.html">← Вернуться ко входу</a>`;
    } catch (err) {
      apiErrorToast(err);
      btn.disabled = false;
      btn.textContent = 'Отправить ссылку';
    }
  });
})();
