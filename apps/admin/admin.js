const API_BASE = (() => {
  const host = location.hostname;
  if (host === '127.0.0.1') return 'http://127.0.0.1:4000/api';
  if (host === 'localhost') return 'http://localhost:4000/api';
  return 'https://api.athar-online.com/api';
})();

const state = {
  admin: null,
  view: 'overview',
  products: [],
  categories: [],
  cloudinary: null,
};
const $ = (selector) => document.querySelector(selector);

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const raw = data.message || 'تعذر إكمال الطلب.';
    const message = Array.isArray(raw) ? raw.join(' · ') : raw;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  })[char]);
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function money(value, currency = 'SAR') {
  return new Intl.NumberFormat('ar-EG', { style: 'currency', currency }).format(Number(value || 0));
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


function roleLabel(role) {
  return ({ CUSTOMER:'عميل', ADMIN:'Admin', SUPER_ADMIN:'Super Admin' })[role] || role;
}
function statusLabel(status) {
  return ({ ACTIVE:'نشط', SUSPENDED:'موقوف', PUBLISHED:'منشور', DRAFT:'مسودة', ARCHIVED:'مؤرشف', SUBSCRIBED:'مشترك', UNSUBSCRIBED:'ملغي', PENDING_PAYMENT:'بانتظار الدفع', PAID:'مدفوع', PAYMENT_FAILED:'فشل الدفع', CANCELLED:'ملغي', REFUNDED:'مسترد' })[status] || status;
}
function badge(status) {
  const bad = ['SUSPENDED','PAYMENT_FAILED','CANCELLED','ARCHIVED','UNSUBSCRIBED'].includes(status) ? ' danger' : ['DRAFT','PENDING_PAYMENT'].includes(status) ? ' warn' : '';
  return `<span class="badge${bad}">${esc(statusLabel(status))}</span>`;
}

function toast(message, type = 'success') {
  const root = $('#toast-root');
  if (!root) return;
  const node = document.createElement('div');
  node.className = `admin-toast ${type}`;
  node.textContent = message;
  root.appendChild(node);
  setTimeout(() => node.remove(), 3500);
}

function showLogin() {
  $('#login-view').hidden = false;
  $('#admin-view').hidden = true;
}

function showAdmin(user) {
  state.admin = user;
  $('#login-view').hidden = true;
  $('#admin-view').hidden = false;
  $('#admin-name').textContent = user.fullName;
  $('#admin-role').textContent = roleLabel(user.role);
  $('.avatar').textContent = (user.fullName || 'أ').trim().charAt(0);
  loadView('overview');
}

async function restoreSession() {
  try {
    const { user } = await request('/admin/auth/me');
    showAdmin(user);
  } catch {
    showLogin();
  }
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#login-submit');
  const error = $('#login-error');
  error.textContent = '';
  button.disabled = true;
  button.textContent = 'جارٍ التحقق…';
  try {
    const { user } = await request('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: $('#login-email').value.trim(),
        password: $('#login-password').value,
      }),
    });
    showAdmin(user);
  } catch (err) {
    error.textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = 'تسجيل الدخول';
  }
});

$('#logout-btn').addEventListener('click', async () => {
  try { await request('/admin/auth/logout', { method: 'POST' }); } catch {}
  state.admin = null;
  showLogin();
});

$('#menu-btn').addEventListener('click', () => $('.sidebar').classList.toggle('open'));

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', () => loadView(button.dataset.view));
});

const titles = { overview:'نظرة عامة', products:'المنتجات', categories:'التصنيفات', users:'المستخدمون', newsletter:'النشرة البريدية', orders:'الطلبات' };

async function loadView(view) {
  state.view = view;
  $('#page-title').textContent = titles[view] || 'لوحة الإدارة';
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  $('.sidebar').classList.remove('open');
  $('#content').innerHTML = '<div class="loading">جارٍ تحميل البيانات…</div>';

  try {
    if (view === 'overview') return renderOverview(await request('/admin/dashboard'));
    if (view === 'products') {
      const [products, categories, cloudinary] = await Promise.all([
        request('/admin/products'),
        request('/admin/categories'),
        request('/admin/cloudinary/status'),
      ]);
      state.products = products.items || [];
      state.categories = categories.items || [];
      state.cloudinary = cloudinary;
      return renderProducts(products);
    }
    if (view === 'categories') {
      const categories = await request('/admin/categories');
      state.categories = categories.items || [];
      return renderCategories(categories);
    }
    if (view === 'users') return renderUsers(await request('/admin/users'));
    if (view === 'newsletter') return renderNewsletter(await request('/admin/newsletter'));
    if (view === 'orders') return renderOrders(await request('/admin/orders'));
  } catch (error) {
    if (error.status === 401 || error.status === 403) return showLogin();
    $('#content').innerHTML = `<div class="empty">${esc(error.message)}</div>`;
  }
}

function renderOverview(data) {
  const s = data.stats;
  const cloud = data.cloudinary?.configured
    ? '<span class="badge">Cloudinary متصل</span>'
    : '<span class="badge warn">Cloudinary غير مهيأ</span>';
  $('#content').innerHTML = `
    <div class="overview-tools"><div><b>حالة الوسائط</b><small>صور المنتجات تُرفع إلى Cloudinary</small></div>${cloud}</div>
    <div class="stat-grid">
      <article class="stat-card"><span>إجمالي المستخدمين</span><strong>${s.users.total}</strong><small>${s.users.customers} عميل</small></article>
      <article class="stat-card"><span>المنتجات</span><strong>${s.products.total}</strong><small>${s.products.published} منشور · ${s.products.draft} مسودة</small></article>
      <article class="stat-card"><span>مشتركو النشرة</span><strong>${s.newsletterSubscribers}</strong><small>اشتراكات فعالة</small></article>
      <article class="stat-card"><span>إجمالي الإيراد</span><strong>${money(s.revenue.amount,s.revenue.currency)}</strong><small>${s.orders.paid} طلب مدفوع</small></article>
    </div>
    <div class="panel-grid">
      <section class="panel"><div class="panel-head"><h2>أحدث المستخدمين</h2><span class="badge">${data.recentUsers.length}</span></div>${data.recentUsers.length ? data.recentUsers.map(u=>`<div class="list-row"><div><strong>${esc(u.fullName)}</strong><small>${esc(u.email)}</small></div>${badge(u.status)}</div>`).join('') : '<div class="empty">لا توجد حسابات بعد.</div>'}</section>
      <section class="panel"><div class="panel-head"><h2>أحدث الطلبات</h2><span class="badge">${data.recentOrders.length}</span></div>${data.recentOrders.length ? data.recentOrders.map(o=>`<div class="list-row"><div><strong>${esc(o.orderNumber)}</strong><small>${esc(o.user.fullName)} · ${money(o.total,o.currency)}</small></div>${badge(o.status)}</div>`).join('') : '<div class="empty">لا توجد طلبات حتى الآن.</div>'}</section>
    </div>`;
}

function sectionHead(title, desc, action = '') {
  return `<div class="section-head"><div><h2>${title}</h2><p>${desc}</p></div>${action}</div>`;
}

function renderProducts({ items }) {
  const cloud = state.cloudinary?.configured
    ? '<span class="cloud-status ok">Cloudinary متصل</span>'
    : '<span class="cloud-status">Cloudinary غير مهيأ — يمكنك إدارة بيانات المنتج الآن ورفع الصور بعد إضافة المفاتيح.</span>';
  const rows = items.map((p) => {
    const cover = (p.images || []).find((image) => image.kind === 'COVER') || p.images?.[0];
    const thumb = cover?.secureUrl
      ? `<img class="product-thumb" src="${esc(cover.secureUrl)}" alt="${esc(cover.altAr || p.titleAr)}">`
      : '<span class="product-thumb placeholder">أثر</span>';
    return [
      `<div class="product-cell">${thumb}<div><strong>${esc(p.titleAr)}</strong><small>${esc(p.slug)}</small></div></div>`,
      esc(p.category.nameAr),
      money(p.price,p.currency),
      badge(p.status),
      p.featured ? '<span class="badge">مميز</span>' : '—',
      p.digitalFileReady ? `<span class="badge">جاهز · ${esc(formatBytes(p.digitalFileBytes))}</span>` : '<span class="badge warn">غير مرفوع</span>',
      `<div class="row-actions"><button class="action-btn" data-edit-product="${p.id}">تعديل</button><button class="action-btn muted" data-archive-product="${p.id}" ${p.status === 'ARCHIVED' ? 'disabled' : ''}>أرشفة</button></div>`,
    ];
  });
  $('#content').innerHTML = sectionHead(
    'المنتجات',
    'إضافة وتعديل ونشر المنتجات من PostgreSQL. المنتجات المنشورة تظهر في المتجر مباشرة بعد التحديث.',
    '<button class="primary compact" data-new-product>+ إضافة منتج</button>',
  ) + cloud + table(['المنتج','التصنيف','السعر','الحالة','مميز','الملف الرقمي','الإجراءات'], rows);
}

function renderCategories({ items }) {
  $('#content').innerHTML = sectionHead(
    'التصنيفات',
    'أضف التصنيفات وعدّل ترتيبها أو عطّل ظهورها في المتجر.',
    '<button class="primary compact" data-new-category>+ إضافة تصنيف</button>',
  ) + table(['التصنيف','Slug','المنتجات','الحالة','الترتيب','الإجراءات'], items.map(c=>[
    `<strong>${esc(c.nameAr)}</strong><small>${esc(c.shortAr||'')}</small>`,
    esc(c.slug),
    c._count.products,
    c.isActive?badge('ACTIVE'):badge('SUSPENDED'),
    c.sortOrder,
    `<div class="row-actions"><button class="action-btn" data-edit-category="${c.id}">تعديل</button><button class="action-btn muted" data-toggle-category="${c.id}">${c.isActive ? 'تعطيل' : 'تفعيل'}</button></div>`,
  ]));
}

function renderUsers({ items }) {
  $('#content').innerHTML = sectionHead('المستخدمون','حسابات العملاء والإدارة المسجلة في المنصة.') + table(['المستخدم','الهاتف','الدور','الحالة','الطلبات','المكتبة','تاريخ التسجيل'], items.map(u=>[`<strong>${esc(u.fullName)}</strong><small>${esc(u.email)}</small>`,u.phone?`${esc(u.phone)}${u.phoneCountry?` <small>${esc(u.phoneCountry)}</small>`:''}`:'—',roleLabel(u.role),badge(u.status),u._count.orders,u._count.libraryItems,formatDate(u.createdAt)]));
}
function renderNewsletter({ items }) {
  $('#content').innerHTML = sectionHead('النشرة البريدية','الاشتراكات التي تصل من Footer المتجر.') + table(['البريد الإلكتروني','الحالة','المصدر','مرتبط بحساب','تاريخ الاشتراك'], items.map(n=>[esc(n.email),badge(n.status),esc(n.source),n.user?esc(n.user.fullName):'—',formatDate(n.subscribedAt)]));
}
function renderOrders({ items }) {
  $('#content').innerHTML = sectionHead('الطلبات','متابعة الطلبات وحالات الدفع والمحتوى الرقمي.') + table(['رقم الطلب','العميل','الإجمالي','الحالة','العناصر','التاريخ'], items.map(o=>[esc(o.orderNumber),`<strong>${esc(o.user.fullName)}</strong><small>${esc(o.user.email)}</small>`,money(o.total,o.currency),badge(o.status),o._count.items,formatDate(o.createdAt)]));
}
function table(headers, rows) {
  if (!rows.length) return '<div class="empty">لا توجد بيانات في هذا القسم حتى الآن.</div>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function openModal(title, content, wide = false) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-modal-close><section class="admin-modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}" onclick="event.stopPropagation()"><header><div><small>ATHR ADMIN</small><h2>${esc(title)}</h2></div><button class="modal-close" type="button" data-modal-close aria-label="إغلاق">×</button></header><div class="modal-body">${content}</div></section></div>`;
  root.querySelectorAll('[data-modal-close]').forEach((button) => button.addEventListener('click', closeModal));
}

function closeModal() {
  $('#modal-root').innerHTML = '';
}

function fieldError(form, message = '') {
  const node = form.querySelector('.modal-error');
  if (node) node.textContent = message;
}

function categoryOptions(selectedId = '') {
  return state.categories.map((category) => `<option value="${category.id}" ${category.id === selectedId ? 'selected' : ''}>${esc(category.nameAr)}${category.isActive ? '' : ' — غير فعال'}</option>`).join('');
}

async function openProductEditor(id = null) {
  try {
    let product = null;
    if (id) {
      ({ product } = await request(`/admin/products/${id}`));
    }
    if (!state.categories.length) {
      const categories = await request('/admin/categories');
      state.categories = categories.items || [];
    }
    if (!state.cloudinary) state.cloudinary = await request('/admin/cloudinary/status');

    const cover = product?.images?.find((image) => image.kind === 'COVER');
    const gallery = product?.images?.filter((image) => image.kind === 'GALLERY') || [];
    const imageNote = state.cloudinary.configured
      ? '<span class="media-ready">Cloudinary متصل — JPG/PNG/WEBP/AVIF حتى 8MB</span>'
      : '<span class="media-warning">Cloudinary غير مهيأ حاليًا. احفظ المنتج بدون صور أو أضف المفاتيح إلى .env ثم أعد تشغيل API.</span>';

    openModal(id ? 'تعديل المنتج' : 'إضافة منتج', `
      <form id="product-form" class="admin-form" data-product-id="${id || ''}">
        <div class="form-grid two">
          <label>اسم المنتج بالعربية<input name="titleAr" required minlength="2" maxlength="180" value="${esc(product?.titleAr || '')}"></label>
          <label>Slug بالإنجليزية<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="financial-awareness" value="${esc(product?.slug || '')}"></label>
        </div>
        <label>العنوان الفرعي<input name="subtitleAr" required minlength="2" maxlength="220" value="${esc(product?.subtitleAr || '')}"></label>
        <div class="form-grid three">
          <label>التصنيف<select name="categoryId" required><option value="">اختر التصنيف</option>${categoryOptions(product?.categoryId || product?.category?.id || '')}</select></label>
          <label>السعر بالريال السعودي<input name="price" type="number" min="0.01" step="0.01" required value="${product?.price ?? '39.99'}"></label>
          <label>الحالة<select name="status"><option value="DRAFT" ${product?.status === 'DRAFT' || !product ? 'selected' : ''}>مسودة</option><option value="PUBLISHED" ${product?.status === 'PUBLISHED' ? 'selected' : ''}>منشور</option><option value="ARCHIVED" ${product?.status === 'ARCHIVED' ? 'selected' : ''}>مؤرشف</option></select></label>
        </div>
        <div class="form-grid three">
          <label>شارة المنتج<input name="badgeAr" maxlength="80" placeholder="منتج أثر" value="${esc(product?.badgeAr || '')}"></label>
          <label>صيغة الملف<input name="formatLabelAr" maxlength="80" value="${esc(product?.formatLabelAr || 'PDF رقمي')}"></label>
          <label>وصف المحتوى<input name="contentLabelAr" maxlength="80" value="${esc(product?.contentLabelAr || 'منتج رقمي')}"></label>
        </div>
        <label>الوصف<textarea name="descriptionAr" rows="5" maxlength="5000">${esc(product?.descriptionAr || '')}</textarea></label>
        <label class="check-field"><input name="featured" type="checkbox" ${product?.featured ? 'checked' : ''}> <span>إظهار كمنتج مميز</span></label>

        <section class="media-editor">
          <div class="media-editor-head"><div><h3>صور المنتج</h3><p>الـCover والصور الإضافية تُحفظ على Cloudinary.</p></div>${imageNote}</div>
          <div class="form-grid two">
            <label>Cover جديد<input name="cover" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label>
            <label>صور Gallery<input name="gallery" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif"></label>
          </div>
          ${id ? `<div class="current-media">
            ${cover ? `<article class="media-card"><img src="${esc(cover.secureUrl)}" alt="${esc(cover.altAr || product.titleAr)}"><div><b>Cover الحالي</b><button type="button" class="link-danger" data-delete-image="${cover.id}" data-product="${id}">حذف</button></div></article>` : '<div class="media-empty">لا توجد Cover بعد.</div>'}
            ${gallery.map((image) => `<article class="media-card"><img src="${esc(image.secureUrl)}" alt="${esc(image.altAr || product.titleAr)}"><div><b>Gallery</b><button type="button" class="link-danger" data-delete-image="${image.id}" data-product="${id}">حذف</button></div></article>`).join('')}
          </div>` : '<p class="form-hint">يمكنك اختيار الصور الآن؛ سيتم رفعها بعد إنشاء المنتج مباشرة.</p>'}
        </section>

        <section class="media-editor digital-file-editor">
          <div class="media-editor-head"><div><h3>ملف الكتاب الرقمي</h3><p>يُحفظ في Private Storage على السيرفر، وليس داخل public أو Cloudinary.</p></div><span class="media-ready">PDF / EPUB حتى 80MB</span></div>
          <label>رفع أو استبدال الملف<input name="digitalFile" type="file" accept=".pdf,.epub,application/pdf,application/epub+zip"></label>
          ${id ? (product?.digitalFileReady ? `<div class="digital-file-current"><div><b>${esc(product.digitalFileName || 'ملف رقمي')}</b><small>${esc(product.digitalFileMime || '')} · ${esc(formatBytes(product.digitalFileBytes))}</small></div><button type="button" class="link-danger" data-delete-digital-file>حذف الملف</button></div>` : '<div class="media-empty">لم يتم رفع ملف الكتاب بعد.</div>') : '<p class="form-hint">يمكنك اختيار ملف الكتاب الآن؛ سيتم رفعه بعد إنشاء المنتج مباشرة.</p>'}
        </section>

        <div class="modal-error" role="alert"></div>
        <footer class="modal-actions">
          ${id ? '<button type="button" class="danger-btn" data-delete-product>حذف نهائي</button>' : '<span></span>'}
          <div><button type="button" class="secondary-btn" data-modal-close>إلغاء</button><button class="primary compact" type="submit">${id ? 'حفظ التعديلات' : 'إنشاء المنتج'}</button></div>
        </footer>
      </form>`, true);

    const form = $('#product-form');
    form.querySelectorAll('[data-modal-close]').forEach((button) => button.addEventListener('click', closeModal));
    form.addEventListener('submit', submitProductForm);
    form.querySelector('[data-delete-product]')?.addEventListener('click', () => deleteProduct(id));
    form.querySelectorAll('[data-delete-image]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('حذف هذه الصورة من المنتج وCloudinary؟')) return;
      try {
        await request(`/admin/products/${button.dataset.product}/images/${button.dataset.deleteImage}`, { method: 'DELETE' });
        toast('تم حذف الصورة.');
        await openProductEditor(button.dataset.product);
      } catch (error) {
        toast(error.message, 'error');
      }
    }));
    form.querySelector('[data-delete-digital-file]')?.addEventListener('click', async () => {
      if (!confirm('حذف ملف الكتاب من التخزين الخاص؟ العملاء لن يستطيعوا تحميله حتى ترفع ملفًا جديدًا.')) return;
      try {
        await request(`/admin/products/${id}/digital-file`, { method: 'DELETE' });
        toast('تم حذف ملف الكتاب.');
        await openProductEditor(id);
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function submitProductForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const productId = form.dataset.productId || null;
  const submit = form.querySelector('button[type="submit"]');
  const cover = form.elements.cover.files[0];
  const gallery = [...form.elements.gallery.files];
  const digitalFile = form.elements.digitalFile.files[0];

  if ((cover || gallery.length) && !state.cloudinary?.configured) {
    fieldError(form, 'Cloudinary غير مهيأ. أضف CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET في .env ثم أعد تشغيل API.');
    return;
  }

  const payload = {
    titleAr: form.elements.titleAr.value.trim(),
    slug: form.elements.slug.value.trim().toLowerCase(),
    subtitleAr: form.elements.subtitleAr.value.trim(),
    categoryId: form.elements.categoryId.value,
    price: Number(form.elements.price.value),
    currency: 'SAR',
    status: form.elements.status.value,
    featured: form.elements.featured.checked,
    badgeAr: form.elements.badgeAr.value.trim(),
    formatLabelAr: form.elements.formatLabelAr.value.trim(),
    contentLabelAr: form.elements.contentLabelAr.value.trim(),
    descriptionAr: form.elements.descriptionAr.value.trim(),
  };

  fieldError(form, '');
  submit.disabled = true;
  submit.textContent = 'جارٍ الحفظ…';
  try {
    const result = await request(productId ? `/admin/products/${productId}` : '/admin/products', {
      method: productId ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
    const savedId = result.product.id;

    try {
      if (cover) await uploadProductImage(savedId, 'cover', cover, payload.titleAr);
      for (const file of gallery) await uploadProductImage(savedId, 'gallery', file, payload.titleAr);
      if (digitalFile) await uploadProductDigitalFile(savedId, digitalFile);
    } catch (imageError) {
      closeModal();
      toast(`تم حفظ المنتج، لكن تعذر رفع أحد ملفات الوسائط: ${imageError.message}`, 'error');
      await loadView('products');
      return;
    }

    closeModal();
    toast(productId ? 'تم حفظ تعديلات المنتج.' : 'تم إنشاء المنتج بنجاح.');
    await loadView('products');
  } catch (error) {
    fieldError(form, error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = productId ? 'حفظ التعديلات' : 'إنشاء المنتج';
  }
}

async function uploadProductImage(productId, kind, file, altAr) {
  const body = new FormData();
  body.append('image', file);
  body.append('altAr', altAr);
  return request(`/admin/products/${productId}/images/${kind}`, { method: 'POST', body });
}

async function uploadProductDigitalFile(productId, file) {
  const body = new FormData();
  body.append('file', file);
  return request(`/admin/products/${productId}/digital-file`, { method: 'POST', body });
}

async function deleteProduct(id) {
  if (!id || !confirm('حذف المنتج نهائيًا؟ إذا كان له أي سجل شراء سيرفض النظام الحذف تلقائيًا.')) return;
  try {
    await request(`/admin/products/${id}`, { method: 'DELETE' });
    closeModal();
    toast('تم حذف المنتج.');
    await loadView('products');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function archiveProduct(id) {
  if (!confirm('أرشفة المنتج؟ لن يظهر في المتجر بعد ذلك.')) return;
  try {
    await request(`/admin/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'ARCHIVED' }),
    });
    toast('تمت أرشفة المنتج.');
    await loadView('products');
  } catch (error) {
    toast(error.message, 'error');
  }
}

function openCategoryEditor(id = null) {
  const category = id ? state.categories.find((item) => item.id === id) : null;
  openModal(id ? 'تعديل التصنيف' : 'إضافة تصنيف', `
    <form id="category-form" class="admin-form" data-category-id="${id || ''}">
      <div class="form-grid two">
        <label>اسم التصنيف<input name="nameAr" required minlength="2" maxlength="80" value="${esc(category?.nameAr || '')}"></label>
        <label>Slug بالإنجليزية<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="personal-growth" value="${esc(category?.slug || '')}"></label>
      </div>
      <label>وصف قصير<input name="shortAr" maxlength="120" value="${esc(category?.shortAr || '')}"></label>
      <label>الوصف<textarea name="descriptionAr" rows="4" maxlength="600">${esc(category?.descriptionAr || '')}</textarea></label>
      <div class="form-grid three">
        <label>Icon<input name="icon" maxlength="40" placeholder="book" value="${esc(category?.icon || 'book')}"></label>
        <label>Tone<input name="tone" maxlength="40" placeholder="sage" value="${esc(category?.tone || 'sage')}"></label>
        <label>الترتيب<input name="sortOrder" type="number" min="0" max="10000" value="${category?.sortOrder ?? 0}"></label>
      </div>
      <label class="check-field"><input name="isActive" type="checkbox" ${category?.isActive !== false ? 'checked' : ''}> <span>التصنيف فعال ويظهر في المتجر</span></label>
      <div class="modal-error" role="alert"></div>
      <footer class="modal-actions">
        ${id ? '<button type="button" class="danger-btn" data-delete-category>حذف التصنيف</button>' : '<span></span>'}
        <div><button type="button" class="secondary-btn" data-modal-close>إلغاء</button><button class="primary compact" type="submit">${id ? 'حفظ التعديلات' : 'إنشاء التصنيف'}</button></div>
      </footer>
    </form>`);

  const form = $('#category-form');
  form.querySelectorAll('[data-modal-close]').forEach((button) => button.addEventListener('click', closeModal));
  form.addEventListener('submit', submitCategoryForm);
  form.querySelector('[data-delete-category]')?.addEventListener('click', () => deleteCategory(id));
}

async function submitCategoryForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.categoryId || null;
  const submit = form.querySelector('button[type="submit"]');
  const payload = {
    nameAr: form.elements.nameAr.value.trim(),
    slug: form.elements.slug.value.trim().toLowerCase(),
    shortAr: form.elements.shortAr.value.trim(),
    descriptionAr: form.elements.descriptionAr.value.trim(),
    icon: form.elements.icon.value.trim(),
    tone: form.elements.tone.value.trim(),
    sortOrder: Number(form.elements.sortOrder.value || 0),
    isActive: form.elements.isActive.checked,
  };

  fieldError(form, '');
  submit.disabled = true;
  try {
    await request(id ? `/admin/categories/${id}` : '/admin/categories', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
    closeModal();
    toast(id ? 'تم تعديل التصنيف.' : 'تم إنشاء التصنيف.');
    await loadView('categories');
  } catch (error) {
    fieldError(form, error.message);
  } finally {
    submit.disabled = false;
  }
}

async function toggleCategory(id) {
  const category = state.categories.find((item) => item.id === id);
  if (!category) return;
  try {
    await request(`/admin/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !category.isActive }),
    });
    toast(category.isActive ? 'تم تعطيل التصنيف.' : 'تم تفعيل التصنيف.');
    await loadView('categories');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteCategory(id) {
  if (!id || !confirm('حذف التصنيف نهائيًا؟ لن يسمح النظام بالحذف إذا كان يحتوي على منتجات.')) return;
  try {
    await request(`/admin/categories/${id}`, { method: 'DELETE' });
    closeModal();
    toast('تم حذف التصنيف.');
    await loadView('categories');
  } catch (error) {
    toast(error.message, 'error');
  }
}

$('#content').addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.hasAttribute('data-new-product')) return openProductEditor();
  if (target.dataset.editProduct) return openProductEditor(target.dataset.editProduct);
  if (target.dataset.archiveProduct) return archiveProduct(target.dataset.archiveProduct);
  if (target.hasAttribute('data-new-category')) return openCategoryEditor();
  if (target.dataset.editCategory) return openCategoryEditor(target.dataset.editCategory);
  if (target.dataset.toggleCategory) return toggleCategory(target.dataset.toggleCategory);
});

restoreSession();
