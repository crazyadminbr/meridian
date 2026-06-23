/* ============================================================================
   js/login.js
   ============================================================================ */

(async function () {
  await initApp();
  if (currentUser) {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const loginField = document.getElementById('login-field').value.trim();
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me').checked;
    const btn = document.getElementById('login-submit');

    btn.disabled = true;
    btn.textContent = 'Входим…';
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: { login: loginField, password, rememberMe } });
      Auth.setToken(token, rememberMe);
      Auth.cacheUser(user);
      toast(`Добро пожаловать, ${user.nickname}!`, 'success');
      const redirect = getParam('redirect');
      setTimeout(() => (window.location.href = redirect || 'index.html'), 500);
    } catch (err) {
      apiErrorToast(err);
      btn.disabled = false;
      btn.textContent = 'Войти';
    }
  });
})();
