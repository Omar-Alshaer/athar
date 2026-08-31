(async () => {
  const root = document.getElementById('payment-root');
  const orderNumber = new URLSearchParams(location.search).get('order');
  if (!root) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  const money = value => `${Number(value).toFixed(2)} ج.م`;

  const request = async (path, options = {}) => {
    const response = await fetch(`${window.ATHR_DATA.apiBase}${path}`, {
      credentials: 'include',
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const raw = Array.isArray(body.message) ? body.message[0] : body.message;
      const error = new Error(raw || 'تعذر الاتصال بخدمة الدفع.');
      error.status = response.status;
      throw error;
    }
    return body;
  };

  if (!orderNumber) {
    root.innerHTML = '<h1>رابط دفع غير صالح</h1><p>لم يتم العثور على رقم الطلب.</p><a class="primary-btn" href="cart.html">العودة إلى السلة</a>';
    return;
  }

  try {
    const { order } = await request(`/commerce/orders/${encodeURIComponent(orderNumber)}`);
    if (order.status === 'PAID') {
      renderSuccess(order, true);
      return;
    }

    root.innerHTML = `
      <span class="payment-kicker">بوابة تجريبية</span>
      <h1>تأكيد الدفع</h1>
      <p>هذه الشاشة تحاكي صفحة الدفع الخارجية. عند تفعيل XPay سيتم استبدالها بصفحة XPay الفعلية.</p>
      <div class="payment-order">
        <div class="payment-order-row"><span>رقم الطلب</span><strong>${esc(order.orderNumber)}</strong></div>
        <div class="payment-order-row"><span>الإجمالي</span><strong>${money(order.total)}</strong></div>
        <div class="payment-items">
          ${order.items.map(item => `<div class="payment-item"><span>${esc(item.title)} × ${item.quantity}</span><b>${money(item.lineTotal)}</b></div>`).join('')}
        </div>
      </div>
      <div class="payment-actions">
        <button class="primary-btn full" id="mock-pay-btn" type="button">محاكاة دفع ناجح</button>
        <a class="secondary-btn full" href="account.html#orders">العودة إلى حسابي</a>
      </div>
      <div class="payment-secure">🔒 لا توجد أي عملية مالية حقيقية في هذه البيئة.</div>
    `;

    document.getElementById('mock-pay-btn')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'جارٍ تأكيد الدفع...';
      try {
        const result = await request(`/commerce/payments/mock/${encodeURIComponent(orderNumber)}/succeed`, { method: 'POST' });
        localStorage.removeItem('athr-cart');
        renderSuccess(result.order, false);
      } catch (error) {
        button.disabled = false;
        button.textContent = 'محاكاة دفع ناجح';
        alert(error.message || 'تعذر تأكيد الدفع التجريبي.');
      }
    });
  } catch (error) {
    if (error.status === 401) {
      location.replace(`auth.html?next=${encodeURIComponent(`payment-mock.html?order=${orderNumber}`)}`);
      return;
    }
    root.innerHTML = `<h1>تعذر تحميل الطلب</h1><p>${esc(error.message)}</p><a class="primary-btn" href="account.html#orders">العودة إلى حسابي</a>`;
  }

  function renderSuccess(order, alreadyPaid) {
    root.innerHTML = `
      <div class="payment-success">
        <div class="payment-success-mark">✓</div>
        <span class="payment-kicker">تم الدفع</span>
        <h1>${alreadyPaid ? 'هذا الطلب مدفوع بالفعل' : 'تم تأكيد الدفع بنجاح'}</h1>
        <p>تمت إضافة المنتجات إلى مكتبتك في حساب أثر.</p>
        <div class="payment-order">
          <div class="payment-order-row"><span>رقم الطلب</span><strong>${esc(order.orderNumber)}</strong></div>
          <div class="payment-order-row"><span>الإجمالي</span><strong>${money(order.total)}</strong></div>
        </div>
        <div class="payment-actions">
          <a class="primary-btn full" href="account.html#library">فتح مكتبتي</a>
          <a class="secondary-btn full" href="shop.html">العودة إلى المتجر</a>
        </div>
      </div>
    `;
  }
})();
