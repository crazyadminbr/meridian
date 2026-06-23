/* ============================================================================
   js/reset.js
   ============================================================================ */

(async function () {
  await initApp();
  const token = getParam('token');

  if (!token) {
    document.getElementById('reset-box').innerHTML = `<div class="alert alert-error">Ссылка сброса пароля некорректна.</div><a class="btn btn-outline btn-block" href="forgot-password.html">Запросить новую ссылку</a>`;
    return;
  }

  document.getElementById('reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('reset-password').value;
    const password2 = document.getElementById('reset-password2').value;
    const btn = document.getElementById('reset-submit');

    if (password !== password2) {
      toast('Пароли не совпадают', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Сохраняем…';
    try {
      await api(`/auth/reset-password/${token}`, { method: 'POST', body: { password } });
      document.getElementById('reset-box').innerHTML = `
        <h1>Готово! 🔐</h1>
        <div class="alert alert-success">Пароль успешно изменён. Теперь вы можете войти с новым паролем.</div>
        <a class="btn btn-primary btn-block btn-lg" href="login.html">Войти</a>`;
    } catch (err) {
      apiErrorToast(err);
      btn.disabled = false;
      btn.textContent = 'Сохранить пароль';
    }
  });
})();
