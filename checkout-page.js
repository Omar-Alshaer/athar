(async () => {
  const form = document.getElementById('checkout-form');
  const itemsRoot = document.getElementById('checkout-items');
  const subtotalNode = document.getElementById('checkout-subtotal');
  const totalNode = document.getElementById('checkout-total');
  const errorNode = document.getElementById('checkout-error');
  const authNote = document.getElementById('checkout-auth-note');

  if (!form || !itemsRoot) return;

  if (new URLSearchParams(location.search).get('payment') === 'cancelled') {
    errorNode.textContent = 'لم يكتمل الدفع. يمكنك مراجعة الطلب أو استكمال جلسة الدفع من صفحة حسابك.';
  }

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
      error.code = typeof body.code === 'string' ? body.code : '';
      error.checkoutUrl = typeof body.checkoutUrl === 'string' ? body.checkoutUrl : '';
      error.orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber : '';
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
  let phoneInput = null;
  try {
    const result = await request('/auth/me');
    user = result.user;
    document.getElementById('checkout-name').value = user.fullName || '';
    document.getElementById('checkout-email').value = user.email || '';
    phoneInput = window.ATHR_PHONE.create(document.getElementById('checkout-phone'), {
      initialCountry: user.phoneCountry || 'EG',
      initialNumber: user.phone || '',
    });
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

  const subtotalEgp = rows.reduce((sum, item) => sum + Number(item.product.price || 0), 0);
  const subtotalSar = rows.reduce((sum, item) => sum + Number(item.product.sarPrice || 0), 0);

  const safeXPayCheckoutUrl = value => {
    try {
      const url = new URL(String(value || ''), location.href);
      return url.protocol === 'https:' && url.hostname === 'checkout.xpay.app'
        ? url.href
        : '';
    } catch {
      return '';
    }
  };

  const setResumeCheckout = value => {
    const checkoutUrl = safeXPayCheckoutUrl(value);
    if (!checkoutUrl) return false;

    const submit = form.querySelector('button[type="submit"]');
    submit.dataset.resumeCheckoutUrl = checkoutUrl;
    submit.disabled = false;
    submit.textContent = 'استكمال الدفع';

    if (authNote) {
      authNote.classList.remove('warn');
      authNote.textContent = 'لديك طلب قيد الدفع بالفعل. يمكنك استكمال نفس عملية الدفع دون إنشاء طلب جديد.';
    }

    errorNode.textContent = '';
    return true;
  };

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
        <span>${escapeHtml(product.format || 'منتج رقمي')} · نسخة واحدة</span>
      </div>
      <b class="checkout-item-price">${money(product.sarPrice,'SAR')}<small>${money(product.price,'EGP')}</small></b>
    </div>
  `).join('');

  subtotalNode.innerHTML = `${money(subtotalSar,'SAR')}<small class="checkout-currency-secondary">${money(subtotalEgp,'EGP')}</small>`;
  totalNode.innerHTML = `${money(subtotalSar,'SAR')}<small class="checkout-currency-secondary">${money(subtotalEgp,'EGP')}</small>`;

  if (user) {
    try {
      const result = await request('/commerce/orders');
      const cartProductIds = rows
        .map(({ product }) => product.dbId)
        .filter(Boolean)
        .sort();

      const pendingOrder = (result.items || []).find(order => {
        if (order.status !== 'PENDING_PAYMENT') return false;

        const orderProductIds = (order.items || [])
          .map(item => item.productId)
          .filter(Boolean)
          .sort();

        if (orderProductIds.length !== cartProductIds.length) return false;

        const sameProducts = orderProductIds.every(
          (id, index) => id === cartProductIds[index],
        );

        if (!sameProducts) return false;

        return (order.payments || []).some(
          payment =>
            payment.status === 'PENDING' &&
            safeXPayCheckoutUrl(payment.checkoutUrl),
        );
      });

      const pendingPayment = pendingOrder?.payments?.find(
        payment =>
          payment.status === 'PENDING' &&
          safeXPayCheckoutUrl(payment.checkoutUrl),
      );

      if (pendingPayment) {
        setResumeCheckout(pendingPayment.checkoutUrl);
      }
    } catch (error) {
      if (error.status !== 401) {
        console.warn('ATHR could not inspect pending orders.', error);
      }
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorNode.textContent = '';

    const submit = form.querySelector('button[type="submit"]');
    if (submit.dataset.loginRequired === 'true' || !user) {
      location.href = `auth.html?next=${encodeURIComponent('checkout.html')}`;
      return;
    }

    const resumeCheckoutUrl = safeXPayCheckoutUrl(
      submit.dataset.resumeCheckoutUrl,
    );

    if (resumeCheckoutUrl) {
      location.href = resumeCheckoutUrl;
      return;
    }

    let normalizedPhone;
    try {
      normalizedPhone = phoneInput.value();
    } catch (error) {
      errorNode.textContent = error.message;
      return;
    }

    const previousText = submit.textContent;
    submit.disabled = true;
    submit.textContent = 'جارٍ إنشاء الطلب...';

    try {
      const result = await request('/commerce/checkout/session', {
        method: 'POST',
        body: JSON.stringify({
          ...normalizedPhone,
          items: rows.map(({ product }) => ({ slug: product.id, quantity: 1 })),
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
      if (
        error.status === 409 &&
        error.code === 'PENDING_PAYMENT_EXISTS' &&
        setResumeCheckout(error.checkoutUrl)
      ) {
        return;
      }

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
