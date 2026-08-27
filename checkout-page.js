(async () => {
  const form = document.getElementById('checkout-form');
  const itemsRoot = document.getElementById('checkout-items');
  const subtotalNode = document.getElementById('checkout-subtotal');
  const totalNode = document.getElementById('checkout-total');
  const errorNode = document.getElementById('checkout-error');
  const authNote = document.getElementById('checkout-auth-note');

  if (!form || !itemsRoot) return;

  if (window.ATHR_CATALOG_READY) await window.ATHR_CATALOG_READY;

  const request = async (path, options = {}) => {
    const response = await fetch(`${DATA.apiBase}${path}`, {
      credentials: 'include',
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
      ...options,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const raw = Array.isArray(body.message) ? body.message[0] : body.message;
      const error = new Error(raw || 'تعذر إتمام العملية.');
      error.status = response.status;
      throw error;
    }
    return body;
  };

  if (DATA.catalogError) {
    itemsRoot.innerHTML = '<div class="checkout-empty"><p>تعذر تحميل بيانات المنتجات حاليًا.</p><a class="secondary-btn" href="cart.html">العودة إلى السلة</a></div>';
    form.querySelector('button[type="submit"]').disabled = true;
    subtotalNode.textContent = '—';
    totalNode.textContent = '—';
    return;
  }

  let user = null;
  try {
    const result = await request('/auth/me');
    user = result.user;
    document.getElementById('checkout-name').value = user.fullName || '';
    document.getElementById('checkout-email').value = user.email || '';
    document.getElementById('checkout-phone').value = user.phone || '';
    if (authNote) authNote.textContent = `سيتم ربط الطلب بحساب ${user.email}.`;
  } catch (error) {
    if (error.status === 401) {
      if (authNote) {
        authNote.classList.add('warn');
        authNote.innerHTML = 'يجب تسجيل الدخول قبل الدفع حتى نضيف الكتاب إلى مكتبتك بعد نجاح العملية.';
      }
      const submit = form.querySelector('button[type="submit"]');
      submit.textContent = 'تسجيل الدخول للمتابعة';
      submit.dataset.loginRequired = 'true';
    } else {
      errorNode.textContent = 'تعذر التحقق من الحساب حاليًا.';
    }
  }

  const cart = typeof getCart === 'function' ? getCart() : [];
  const rows = cart.map(row => ({
    row,
    product: DATA.products.find(product => product.id === row.id),
  })).filter(item => item.product);

  const subtotal = rows.reduce((sum, item) => sum + item.product.price * item.row.qty, 0);

  if (!rows.length) {
    itemsRoot.innerHTML = '<div class="checkout-empty"><p>سلتك فارغة حاليًا.</p><a class="primary-btn" href="shop.html">تصفح المنتجات</a></div>';
    form.querySelector('button[type="submit"]').disabled = true;
    subtotalNode.textContent = money(0);
    totalNode.textContent = money(0);
    return;
  }

  itemsRoot.innerHTML = rows.map(({ row, product }) => `
    <div class="checkout-item">
      <div class="checkout-item-main">
        <strong>${escapeHtml(product.title)}</strong>
        <span>${escapeHtml(product.format || 'منتج رقمي')} × ${row.qty}</span>
      </div>
      <b class="checkout-item-price">${money(product.price * row.qty)}</b>
    </div>
  `).join('');

  subtotalNode.textContent = money(subtotal);
  totalNode.textContent = money(subtotal);

  const cleanPhone = value => String(value || '').replace(/[^\d+()\-\s]/g, '').trim();

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorNode.textContent = '';

    const submit = form.querySelector('button[type="submit"]');
    if (submit.dataset.loginRequired === 'true' || !user) {
      location.href = `auth.html?next=${encodeURIComponent('checkout.html')}`;
      return;
    }

    const phone = cleanPhone(document.getElementById('checkout-phone').value);
    if (phone.replace(/\D/g, '').length < 8) {
      errorNode.textContent = 'من فضلك أدخل رقم هاتف صحيحًا مع كود الدولة.';
      return;
    }

    const previousText = submit.textContent;
    submit.disabled = true;
    submit.textContent = 'جارٍ إنشاء الطلب...';

    try {
      const result = await request('/commerce/checkout/session', {
        method: 'POST',
        body: JSON.stringify({
          phone,
          items: rows.map(({ row, product }) => ({ slug: product.id, quantity: row.qty })),
        }),
      });

      if (result.payment?.provider === 'MOCK' && result.payment?.checkoutPath) {
        location.href = result.payment.checkoutPath;
        return;
      }

      if (result.payment?.checkoutUrl) {
        location.href = result.payment.checkoutUrl;
        return;
      }

      throw new Error('لم يتم إنشاء رابط الدفع.');
    } catch (error) {
      if (error.status === 401) {
        location.href = `auth.html?next=${encodeURIComponent('checkout.html')}`;
        return;
      }
      errorNode.textContent = error.message || 'تعذر إنشاء الطلب. حاول مرة أخرى.';
      submit.disabled = false;
      submit.textContent = previousText;
    }
  });
})();
