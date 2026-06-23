/* ============================================================================
   js/register.js
   ============================================================================ */

(async function () {
  await initApp();
  if (currentUser) {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('reg-nickname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;
    const btn = document.getElementById('register-submit');

    if (password !== password2) {
      toast('Пароли не совпадают', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Регистрируем…';
    try {
      await api('/auth/register', { method: 'POST', body: { nickname, email, password } });
      document.querySelector('.auth-card').innerHTML = `
        <div class="alert alert-success">
          ✅ Регистрация прошла успешно!<br><br>
          Мы отправили письмо со ссылкой подтверждения на <b>${escapeHtml(email)}</b>.
          Перейдите по ссылке из письма, чтобы активировать аккаунт.
          <br><br>
          <span style="font-size:12.5px;opacity:0.8;">Если письма нет во входящих — проверьте папку «Спам», либо смотрите консоль сервера (режим разработки выводит ссылку туда).</span>
        </div>
        <a class="btn btn-primary btn-block" href="login.html">Перейти ко входу</a>`;
    } catch (err) {
      apiErrorToast(err);
      btn.disabled = false;
      btn.textContent = 'Зарегистрироваться';
    }
  });
})();
