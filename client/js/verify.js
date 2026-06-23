/* ============================================================================
   js/verify.js
   ============================================================================ */

(async function () {
  await initApp();
  const box = document.getElementById('verify-box');
  const token = getParam('token');

  if (!token) {
    box.innerHTML = `<div class="alert alert-error">Ссылка подтверждения некорректна — отсутствует токен.</div><a class="btn btn-outline btn-block" href="index.html">На главную</a>`;
    return;
  }

  try {
    const { message } = await api(`/auth/verify/${token}`);
    box.innerHTML = `
      <h1>🎉 Готово!</h1>
      <div class="alert alert-success">${escapeHtml(message)}</div>
      <a class="btn btn-primary btn-block btn-lg" href="login.html">Войти в аккаунт</a>`;
  } catch (err) {
    box.innerHTML = `
      <h1>Не получилось</h1>
      <div class="alert alert-error">${escapeHtml(err.message)}</div>
      <a class="btn btn-outline btn-block" href="index.html">На главную</a>`;
  }
})();
