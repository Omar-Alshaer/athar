(async () => {
  const STORE_WHATSAPP = '9660510390125';

  const form = document.getElementById('checkout-form');
  const itemsRoot = document.getElementById('checkout-items');
  const subtotalNode = document.getElementById('checkout-subtotal');
  const totalNode = document.getElementById('checkout-total');
  const errorNode = document.getElementById('checkout-error');

  if (!form || !itemsRoot) return;

  if (window.ATHR_CATALOG_READY) {
    await window.ATHR_CATALOG_READY;
  }

  if (DATA.catalogError) {
    itemsRoot.innerHTML = '<div class="checkout-empty"><p>تعذر تحميل بيانات المنتجات حاليًا.</p><a class="secondary-btn" href="cart.html">العودة إلى السلة</a></div>';
    form.querySelector('button[type="submit"]').disabled = true;
    subtotalNode.textContent = '—';
    totalNode.textContent = '—';
    return;
  }

  const cart = typeof getCart === 'function' ? getCart() : [];
  const rows = cart.map(row => ({
    row,
    product: DATA.products.find(product => product.id === row.id)
  })).filter(item => item.product);

  const subtotal = rows.reduce(
    (sum, item) => sum + item.product.price * item.row.qty,
    0
  );

  if (!rows.length) {
    itemsRoot.innerHTML = `
      <div class="checkout-empty">
        <p>سلتك فارغة حاليًا.</p>
        <a class="primary-btn" href="shop.html">تصفح المنتجات</a>
      </div>`;
    form.querySelector('button[type="submit"]').disabled = true;
    subtotalNode.textContent = money(0);
    totalNode.textContent = money(0);
    return;
  }

  itemsRoot.innerHTML = rows.map(({ row, product }) => `
    <div class="checkout-item">
      <div class="checkout-item-main">
        <strong>${product.title}</strong>
        <span>${product.format || 'منتج رقمي'} × ${row.qty}</span>
      </div>
      <b class="checkout-item-price">${money(product.price * row.qty)}</b>
    </div>
  `).join('');

  subtotalNode.textContent = money(subtotal);
  totalNode.textContent = money(subtotal);

  const cleanPhone = value => String(value || '').replace(/[^\d+]/g, '');

  form.addEventListener('submit', event => {
    event.preventDefault();
    errorNode.textContent = '';

    const name = document.getElementById('checkout-name').value.trim();
    const email = document.getElementById('checkout-email').value.trim();
    const phone = cleanPhone(document.getElementById('checkout-phone').value);

    if (!name) {
      errorNode.textContent = 'من فضلك أدخل الاسم الكامل.';
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errorNode.textContent = 'من فضلك أدخل بريدًا إلكترونيًا صحيحًا.';
      return;
    }

    if (phone.replace(/\D/g, '').length < 8) {
      errorNode.textContent = 'من فضلك أدخل رقم هاتف صحيحًا مع كود الدولة.';
      return;
    }

    const productsText = rows.map(({ row, product }) =>
      `• ${product.title} × ${row.qty} — ${money(product.price * row.qty)}`
    ).join('\n');

    const message = [
      'مرحبًا أثر، أرغب في إتمام هذا الطلب:',
      '',
      productsText,
      '',
      `الإجمالي: ${money(subtotal)}`,
      '',
      `الاسم: ${name}`,
      `البريد الإلكتروني: ${email}`,
      `رقم الهاتف: ${phone}`
    ].join('\n');

    const url = `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });
})();
