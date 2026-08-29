(() => {
  const apiBase = window.ATHR_DATA?.apiBase || 'http://localhost:4000/api';
  const message = document.getElementById('auth-message');
  const tabs = [...document.querySelectorAll('[data-auth-tab]')];
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (!loginForm || !registerForm) return;

  let phoneInput;
  try {
    phoneInput = window.ATHR_PHONE.create(document.getElementById('register-phone'), {
      initialCountry: 'SA',
    });
  } catch (error) {
    showMessage(error.message);
  }

  const nextUrl = new URLSearchParams(location.search).get('next') || 'account.html';

  function showMessage(text, type = 'error') {
    message.textContent = text;
    message.className = `auth-message show ${type}`;
  }

  function clearMessage() {
    message.textContent = '';
    message.className = 'auth-message';
  }

  function setMode(mode) {
    clearMessage();
    tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.authTab === mode));
    loginForm.classList.toggle('active', mode === 'login');
    registerForm.classList.toggle('active', mode === 'register');
  }

  async function request(path, payload) {
    const response = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const raw = Array.isArray(body.message) ? body.message[0] : body.message;
      throw new Error(raw || 'تعذر إكمال العملية. حاول مرة أخرى.');
    }
    return body;
  }

  async function alreadySignedIn() {
    try {
      const response = await fetch(`${apiBase}/auth/me`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (response.ok) location.replace(nextUrl);
    } catch {}
  }

  tabs.forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.authTab)));

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    clearMessage();
    const button = loginForm.querySelector('button[type="submit"]');
    const data = new FormData(loginForm);
    button.disabled = true;
    try {
      await request('/auth/login', {
        email: String(data.get('email') || '').trim(),
        password: String(data.get('password') || ''),
      });
      showMessage('تم تسجيل الدخول بنجاح.', 'success');
      location.href = nextUrl;
    } catch (error) {
      showMessage(error.message);
    } finally {
      button.disabled = false;
    }
  });

  registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    clearMessage();
    const button = registerForm.querySelector('button[type="submit"]');
    const data = new FormData(registerForm);
    const password = String(data.get('password') || '');
    const passwordConfirm = String(data.get('passwordConfirm') || '');

    if (password !== passwordConfirm) {
      showMessage('كلمتا المرور غير متطابقتين.');
      return;
    }

    if (!/(?=.*\p{L})(?=.*\d)/u.test(password)) {
      showMessage('كلمة المرور يجب أن تحتوي على حرف ورقم على الأقل.');
      return;
    }

    let normalizedPhone;
    try {
      normalizedPhone = phoneInput.value();
    } catch (error) {
      showMessage(error.message);
      return;
    }

    button.disabled = true;
    try {
      await request('/auth/register', {
        fullName: String(data.get('fullName') || '').trim(),
        email: String(data.get('email') || '').trim(),
        ...normalizedPhone,
        password,
      });
      showMessage('تم إنشاء حسابك بنجاح.', 'success');
      location.href = nextUrl;
    } catch (error) {
      showMessage(error.message);
    } finally {
      button.disabled = false;
    }
  });

  const requestedMode = new URLSearchParams(location.search).get('mode');
  setMode(requestedMode === 'register' ? 'register' : 'login');
  alreadySignedIn();
})();
