const API_BASE = (() => {
  const host = location.hostname;
  if (host === '127.0.0.1') return 'http://127.0.0.1:4000/api';
  if (host === 'localhost') return 'http://localhost:4000/api';
  return 'https://api.athar-online.com/api';
})();

const state = { admin: null, view: 'overview' };
const $ = (selector) => document.querySelector(selector);

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'تعذر إكمال الطلب.');
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

function money(value, currency = 'USD') {
  return new Intl.NumberFormat('ar-EG', { style: 'currency', currency }).format(Number(value || 0));
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
    if (view === 'products') return renderProducts(await request('/admin/products'));
    if (view === 'categories') return renderCategories(await request('/admin/categories'));
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
  $('#content').innerHTML = `
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

function sectionHead(title, desc) {
  return `<div class="section-head"><div><h2>${title}</h2><p>${desc}</p></div><span class="read-only-note">الإدارة والتعديل تُفعّل في Patch 033</span></div>`;
}

function renderProducts({ items }) {
  $('#content').innerHTML = sectionHead('المنتجات','كل المنتجات من PostgreSQL بما فيها المسودات.') + table(['المنتج','التصنيف','السعر','الحالة','آخر تحديث'], items.map(p=>[`<strong>${esc(p.titleAr)}</strong><small>${esc(p.slug)}</small>`,esc(p.category.nameAr),money(p.price,p.currency),badge(p.status),formatDate(p.updatedAt)]));
}
function renderCategories({ items }) {
  $('#content').innerHTML = sectionHead('التصنيفات','التصنيفات وعدد المنتجات المرتبطة بكل منها.') + table(['التصنيف','Slug','المنتجات','الحالة','الترتيب'], items.map(c=>[`<strong>${esc(c.nameAr)}</strong><small>${esc(c.shortAr||'')}</small>`,esc(c.slug),c._count.products,c.isActive?badge('ACTIVE'):badge('SUSPENDED'),c.sortOrder]));
}
function renderUsers({ items }) {
  $('#content').innerHTML = sectionHead('المستخدمون','حسابات العملاء والإدارة المسجلة في المنصة.') + table(['المستخدم','الدور','الحالة','الطلبات','المكتبة','تاريخ التسجيل'], items.map(u=>[`<strong>${esc(u.fullName)}</strong><small>${esc(u.email)}</small>`,roleLabel(u.role),badge(u.status),u._count.orders,u._count.libraryItems,formatDate(u.createdAt)]));
}
function renderNewsletter({ items }) {
  $('#content').innerHTML = sectionHead('النشرة البريدية','الاشتراكات التي تصل من Footer المتجر.') + table(['البريد الإلكتروني','الحالة','المصدر','مرتبط بحساب','تاريخ الاشتراك'], items.map(n=>[esc(n.email),badge(n.status),esc(n.source),n.user?esc(n.user.fullName):'—',formatDate(n.subscribedAt)]));
}
function renderOrders({ items }) {
  $('#content').innerHTML = sectionHead('الطلبات','ستظهر هنا طلبات Mock ثم XPay في مراحل الدفع القادمة.') + table(['رقم الطلب','العميل','الإجمالي','الحالة','العناصر','التاريخ'], items.map(o=>[esc(o.orderNumber),`<strong>${esc(o.user.fullName)}</strong><small>${esc(o.user.email)}</small>`,money(o.total,o.currency),badge(o.status),o._count.items,formatDate(o.createdAt)]));
}
function table(headers, rows) {
  if (!rows.length) return '<div class="empty">لا توجد بيانات في هذا القسم حتى الآن.</div>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

restoreSession();
