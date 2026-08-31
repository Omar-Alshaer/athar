(() => {
  const apiBase = window.ATHR_DATA?.apiBase || 'http://localhost:4000/api';
  const title = document.getElementById('account-title');
  if (!title) return;
  const returnedFromPayment = new URLSearchParams(location.search).get('payment') === 'return';

  function paymentMessage(text, type = 'pending') {
    let node = document.getElementById('account-payment-message');
    if (!node) {
      node = document.createElement('div');
      node.id = 'account-payment-message';
      title.parentElement.appendChild(node);
    }
    node.className = `account-payment-message ${type}`;
    node.textContent = text;
  }

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  const money = (value, currency = 'EGP') => {
    const amount = Number(value);
    if (currency === 'EGP') return `${amount.toFixed(2)} ج.م`;
    if (currency === 'SAR') return `${amount.toFixed(2)} ر.س`;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount);
  };
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
    root.innerHTML = items.map(order => {
      const pendingPayment = (order.payments || []).find(payment => payment.status === 'PENDING');
      const checkoutUrl = String(pendingPayment?.checkoutUrl || '');
      const canResume = checkoutUrl.startsWith('https://') || checkoutUrl.startsWith('payment-mock.html?');
      return `
      <article class="order-card">
        <div class="order-card-top">
          <div><strong>${escapeHtml(order.orderNumber)}</strong><small>${new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.createdAt))}</small></div>
          <span class="order-status ${statusClass(order.status)}">${statusLabel(order.status)}</span>
        </div>
        <div class="order-lines">
          ${order.items.map(item => `<div class="order-line"><span>${escapeHtml(item.title)} × ${item.quantity}</span><b>${money(item.lineTotal, order.currency)}</b></div>`).join('')}
        </div>
        <div class="order-total"><span>الإجمالي</span><b>${money(order.total, order.currency)}</b></div>
        ${order.status === 'PENDING_PAYMENT' && canResume ? `<div class="library-actions"><a class="primary-btn" href="${escapeHtml(checkoutUrl)}">استكمال الدفع</a></div>` : ''}
      </article>
    `;}).join('');
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
      const ownedSlugs = new Set((library.items || []).map(item => item.product?.slug).filter(Boolean));
      if (ownedSlugs.size && typeof getCart === 'function' && typeof saveCart === 'function') {
        saveCart(getCart().filter(item => !ownedSlugs.has(item.id)));
      }
      return { library, orders };
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

  (async () => {
    let result = await load();
    if (!returnedFromPayment || !result) return;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const newest = result.orders?.items?.[0];
      if (newest?.status === 'PAID') {
        paymentMessage('تم تأكيد الدفع، وأضيفت مشترياتك إلى مكتبتك.', 'success');
        return;
      }
      if (['PAYMENT_FAILED', 'CANCELLED'].includes(newest?.status)) {
        paymentMessage('لم يكتمل الدفع. راجع حالة الطلب أو حاول مرة أخرى من المتجر.', 'error');
        return;
      }

      paymentMessage('عاد المتصفح من بوابة الدفع، وما زلنا ننتظر التأكيد الآمن منها.', 'pending');
      await new Promise(resolve => setTimeout(resolve, 2000));
      result = await load();
      if (!result) return;
    }
  })();
})();
