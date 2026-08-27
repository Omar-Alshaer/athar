(() => {
  const apiBase = window.ATHR_DATA?.apiBase || 'http://127.0.0.1:4000/api';
  const title = document.getElementById('account-title');
  if (!title) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  const money = value => `${Number(value).toFixed(2)}$`;
  const formatBytes = value => {
    const bytes = Number(value || 0);
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  async function request(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      credentials: 'include',
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const raw = Array.isArray(body.message) ? body.message[0] : body.message;
      throw Object.assign(new Error(raw || 'تعذر الاتصال بالحساب.'), { status: response.status });
    }
    return body;
  }

  function renderUser(user) {
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

  function renderLibrary(items) {
    const root = document.getElementById('library-root');
    const count = document.getElementById('library-count');
    if (!root) return;
    count.textContent = `${items.length} منتج`;

    if (!items.length) {
      root.className = 'account-empty';
      root.innerHTML = '<div class="account-empty-icon">↧</div><h3>مكتبتك فارغة حاليًا</h3><p>بعد نجاح الدفع ستظهر منتجاتك الرقمية هنا تلقائيًا.</p><a class="primary-btn" href="shop.html">تصفح المتجر</a>';
      return;
    }

    root.className = 'library-grid';
    root.innerHTML = items.map(item => {
      const product = item.product;
      const cover = product.coverImage?.secureUrl
        ? `<img src="${escapeHtml(product.coverImage.secureUrl)}" alt="${escapeHtml(product.coverImage.altAr || product.titleAr)}">`
        : '<span>أثر</span>';
      return `<article class="library-card">
        <div class="library-cover">${cover}</div>
        <div class="library-main">
          <small>${escapeHtml(product.category?.nameAr || 'منتج رقمي')}</small>
          <h3>${escapeHtml(product.titleAr)}</h3>
          <p>${escapeHtml(product.formatLabelAr || 'منتج رقمي')}</p>
          ${product.digitalFileReady ? `<span class="library-file-ready">${escapeHtml(product.digitalFileName || 'الملف الرقمي')}${product.digitalFileBytes ? ` · ${escapeHtml(formatBytes(product.digitalFileBytes))}` : ''}</span>` : '<span class="library-file-pending">الملف الرقمي سيتم ربطه من لوحة الإدارة</span>'}
          <div class="library-actions">
            <a class="secondary-btn" href="product.html?id=${encodeURIComponent(product.slug)}">صفحة المنتج</a>
            ${product.digitalFileReady ? `<a class="primary-btn" href="${apiBase}/commerce/library/${encodeURIComponent(item.id)}/download">تحميل الكتاب</a>` : ''}
          </div>
        </div>
      </article>`;
    }).join('');
  }

  function statusLabel(status) {
    return ({
      PAID: 'مدفوع',
      PENDING_PAYMENT: 'بانتظار الدفع',
      PAYMENT_FAILED: 'فشل الدفع',
      CANCELLED: 'ملغي',
      REFUNDED: 'مسترد',
    })[status] || status;
  }

  function statusClass(status) {
    if (status === 'PAID') return 'paid';
    if (status === 'PENDING_PAYMENT') return 'pending';
    return '';
  }

  function renderOrders(items) {
    const root = document.getElementById('orders-root');
    const count = document.getElementById('orders-count');
    if (!root) return;
    count.textContent = `${items.length} طلب`;

    if (!items.length) {
      root.className = 'account-empty compact';
      root.innerHTML = '<h3>لا توجد طلبات حتى الآن</h3><p>ابدأ من المتجر وسيظهر سجل مشترياتك هنا.</p><a class="primary-btn" href="shop.html">تصفح المتجر</a>';
      return;
    }

    root.className = 'orders-list';
    root.innerHTML = items.map(order => `
      <article class="order-card">
        <div class="order-card-top">
          <div><strong>${escapeHtml(order.orderNumber)}</strong><small>${new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.createdAt))}</small></div>
          <span class="order-status ${statusClass(order.status)}">${statusLabel(order.status)}</span>
        </div>
        <div class="order-lines">
          ${order.items.map(item => `<div class="order-line"><span>${escapeHtml(item.title)} × ${item.quantity}</span><b>${money(item.lineTotal)}</b></div>`).join('')}
        </div>
        <div class="order-total"><span>الإجمالي</span><b>${money(order.total)}</b></div>
        ${order.status === 'PENDING_PAYMENT' ? `<div class="library-actions"><a class="primary-btn" href="payment-mock.html?order=${encodeURIComponent(order.orderNumber)}">استكمال الدفع</a></div>` : ''}
      </article>
    `).join('');
  }

  async function load() {
    try {
      const [{ user }, library, orders] = await Promise.all([
        request('/auth/me'),
        request('/commerce/library'),
        request('/commerce/orders'),
      ]);
      renderUser(user);
      renderLibrary(library.items || []);
      renderOrders(orders.items || []);
    } catch (error) {
      if (error.status === 401) {
        location.replace(`auth.html?next=${encodeURIComponent('account.html')}`);
        return;
      }
      title.textContent = 'تعذر تحميل الحساب';
      const libraryRoot = document.getElementById('library-root');
      const ordersRoot = document.getElementById('orders-root');
      if (libraryRoot) libraryRoot.textContent = 'تعذر تحميل المكتبة.';
      if (ordersRoot) ordersRoot.textContent = 'تعذر تحميل الطلبات.';
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
