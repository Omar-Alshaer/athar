(() => {
  const apiBase = window.ATHR_DATA?.apiBase || 'http://127.0.0.1:4000/api';
  const title = document.getElementById('account-title');
  if (!title) return;

  async function request(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      credentials: 'include',
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.message || 'تعذر الاتصال بالحساب.'), { status: response.status });
    return body;
  }

  function render(user) {
    const firstName = String(user.fullName || 'أثر').trim().split(/\s+/)[0] || 'أثر';
    title.textContent = `أهلًا ${firstName}`;
    document.getElementById('account-name').textContent = user.fullName;
    document.getElementById('account-email').textContent = user.email;
    document.getElementById('account-avatar').textContent = firstName.charAt(0);
    document.getElementById('profile-name').textContent = user.fullName;
    document.getElementById('profile-email').textContent = user.email;
    document.getElementById('profile-phone').textContent = user.phone || 'غير مضاف';
    document.getElementById('profile-created').textContent = new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(user.createdAt));
  }

  async function load() {
    try {
      const { user } = await request('/auth/me');
      render(user);
    } catch (error) {
      if (error.status === 401) {
        location.replace(`auth.html?next=${encodeURIComponent('account.html')}`);
        return;
      }
      title.textContent = 'تعذر تحميل الحساب';
    }
  }

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await request('/auth/logout', { method: 'POST' }).catch(() => null);
    location.replace('auth.html');
  });

  document.getElementById('logout-all-btn')?.addEventListener('click', async () => {
    const button = document.getElementById('logout-all-btn');
    button.disabled = true;
    try {
      await request('/auth/logout-all', { method: 'POST' });
      location.replace('auth.html');
    } catch {
      button.disabled = false;
    }
  });

  load();
})();
