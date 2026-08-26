const DATA = window.ATHR_DATA;
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const icons = {
  book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v15h4.5a2.5 2.5 0 0 1 2.5 2.5z"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/><path d="M7 12h3l1.2-3 1.8 6 1.1-3H17"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="M16 8l5-5"/><path d="M17 3h4v4"/>',
  wallet:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M16 10h5v4h-5a2 2 0 0 1 0-4z"/><path d="M7 5V3h10v2"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bag:'<path d="M6 8h12l1 13H5L6 8z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
  heart2:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/>',
  download:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  spark:'<path d="m12 3-1.2 3.6L7 8l3.8 1.4L12 13l1.2-3.6L17 8l-3.8-1.4L12 3z"/><path d="m5 15-.8 2.2L2 18l2.2.8L5 21l.8-2.2L8 18l-2.2-.8L5 15z"/>',
  headphones:'<path d="M4 14a8 8 0 0 1 16 0"/><path d="M4 14v5a2 2 0 0 0 2 2h2v-7H4z"/><path d="M20 14v5a2 2 0 0 1-2 2h-2v-7h4z"/>',
  arrow:'<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  trash:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/><path d="M10 11v6M14 11v6"/>'
};
function icon(name, cls='') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>`; }
function money(value){ return `${Number(value).toFixed(2)}$`; }
function escapeHtml(value){ return String(value??'').replace(/[&<>"']/g,ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch])); }
function productCoverClass(p){ return p?.cover||'cover-green'; }
function catalogUnavailableMarkup(){ return '<div class="empty-state catalog-unavailable"><h3>تعذر تحميل المنتجات حاليًا</h3><p>تأكد من تشغيل خدمة أثر ثم أعد تحميل الصفحة.</p></div>'; }
function productCoverVisual(p,cat){
  if(p.coverUrl){
    return `<img class="product-cover-image" src="${escapeHtml(p.coverUrl)}" alt="${escapeHtml(p.coverAlt||p.title)}" loading="lazy">`;
  }
  return `<span class="cover-brand">أثر</span><strong>${escapeHtml(p.title)}</strong><small>${escapeHtml(cat?.short||'')}</small><span class="cover-leaf">❧</span>`;
}

function getCart(){ try{return JSON.parse(localStorage.getItem('athr-cart')||'[]')}catch{return[]} }
function saveCart(cart){ localStorage.setItem('athr-cart',JSON.stringify(cart)); updateCartCount(); }
function addToCart(id, qty=1){ const cart=getCart(); const row=cart.find(x=>x.id===id); if(row) row.qty+=qty; else cart.push({id,qty}); saveCart(cart); toast('تمت إضافة المنتج إلى السلة'); }
function removeFromCart(id){ saveCart(getCart().filter(x=>x.id!==id)); renderCart(); }
function setQty(id, qty){ const cart=getCart(); const row=cart.find(x=>x.id===id); if(!row)return; row.qty=Math.max(1,qty); saveCart(cart); renderCart(); }
function updateCartCount(){ const count=getCart().reduce((s,x)=>s+x.qty,0); $$('.cart-count').forEach(el=>el.textContent=count); }
function toast(msg){ let t=$('.toast'); if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t)} t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200); }

const WISHLIST_STORAGE_KEY='athr-wishlist';
let wishlistMode='guest';
let wishlistState=new Set(loadGuestWishlist());
let wishlistProducts=new Map();
const wishlistBusy=new Set();

function loadGuestWishlist(){
  try{
    const value=JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)||'[]');
    return Array.isArray(value)?[...new Set(value.filter(item=>typeof item==='string'&&item.trim()).map(item=>item.trim()))].slice(0,100):[];
  }catch{return[]}
}
function saveGuestWishlist(){ localStorage.setItem(WISHLIST_STORAGE_KEY,JSON.stringify([...wishlistState])); }
function isWishlisted(id){ return wishlistState.has(String(id)); }
function updateWishlistUI(){
  $$('[data-wishlist-id]').forEach(button=>{
    const active=isWishlisted(button.dataset.wishlistId||'');
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
    button.setAttribute('aria-label',active?'إزالة من المفضلة':'أضف للمفضلة');
  });
  $$('.wishlist-count').forEach(el=>el.textContent=String(wishlistState.size));
  const note=$('#wishlist-mode-note');
  if(note){
    note.innerHTML=wishlistMode==='account'
      ? 'مفضلاتك محفوظة في حسابك وستظهر لك على أجهزتك.'
      : 'المفضلة محفوظة على هذا المتصفح. <a href="auth.html?next=wishlist.html">سجّل الدخول</a> لحفظها في حسابك.';
  }
}
async function wishlistRequest(path,options={}){
  const response=await fetch(`${DATA.apiBase}${path}`,{
    credentials:'include',
    ...options,
    headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok){
    const raw=Array.isArray(body.message)?body.message[0]:body.message;
    const error=new Error(raw||'تعذر تحديث المفضلة.');
    error.status=response.status;
    throw error;
  }
  return body;
}
function cacheWishlistItems(items){
  wishlistProducts=new Map();
  const mapper=window.ATHR_MAP_PRODUCT;
  (items||[]).forEach(item=>{
    const raw=item?.product;
    if(!raw?.slug)return;
    const mapped=typeof mapper==='function'?mapper(raw):null;
    if(mapped)wishlistProducts.set(mapped.id,mapped);
  });
}
async function initWishlist(){
  const guest=loadGuestWishlist();
  wishlistState=new Set(guest);
  updateWishlistUI();
  try{
    const result=guest.length
      ? await wishlistRequest('/wishlist/sync',{method:'POST',body:JSON.stringify({productSlugs:guest})})
      : await wishlistRequest('/wishlist');
    wishlistMode='account';
    wishlistState=new Set((result.items||[]).map(item=>item.product?.slug).filter(Boolean));
    cacheWishlistItems(result.items||[]);
    if(guest.length)localStorage.removeItem(WISHLIST_STORAGE_KEY);
  }catch(error){
    if(error.status!==401)console.warn('ATHR wishlist API unavailable; using browser storage.',error);
    wishlistMode='guest';
    wishlistState=new Set(guest);
  }
  updateWishlistUI();
}
async function toggleWishlist(id){
  id=String(id||'').trim();
  if(!id||wishlistBusy.has(id))return;
  const wasActive=wishlistState.has(id);
  const product=DATA.products.find(item=>item.id===id);
  if(wasActive){wishlistState.delete(id);wishlistProducts.delete(id)}
  else{wishlistState.add(id);if(product)wishlistProducts.set(id,product)}
  updateWishlistUI();
  renderWishlistPage();

  if(wishlistMode==='guest'){
    saveGuestWishlist();
    toast(wasActive?'تمت الإزالة من المفضلة':'تمت الإضافة إلى المفضلة');
    return;
  }

  wishlistBusy.add(id);
  try{
    await wishlistRequest(`/wishlist/${encodeURIComponent(id)}`,{method:wasActive?'DELETE':'POST'});
    toast(wasActive?'تمت الإزالة من المفضلة':'تمت الإضافة إلى المفضلة');
  }catch(error){
    if(error.status===401){
      wishlistMode='guest';
      wishlistState=new Set(loadGuestWishlist());
      if(!wasActive)wishlistState.add(id);
      else wishlistState.delete(id);
      saveGuestWishlist();
      toast('انتهت الجلسة؛ تم حفظ التغيير على هذا المتصفح.');
    }else{
      if(wasActive)wishlistState.add(id);else wishlistState.delete(id);
      toast('تعذر تحديث المفضلة. حاول مرة أخرى.');
    }
  }finally{
    wishlistBusy.delete(id);
    updateWishlistUI();
    renderWishlistPage();
  }
}

function productCard(p){
  const cat=DATA.categories.find(c=>c.id===p.category);
  const hasImage=Boolean(p.coverUrl);
  return `<article class="product-card">
    <a class="cover ${productCoverClass(p)} ${hasImage?'has-cloudinary-image':''}" href="product.html?id=${encodeURIComponent(p.id)}" aria-label="${escapeHtml(p.title)}">
      ${productCoverVisual(p,cat)}
      <span class="product-badge">${escapeHtml(p.badge||'منتج رقمي')}</span>
      <button class="wish-btn ${isWishlisted(p.id)?'active':''}" type="button" data-wishlist-id="${escapeHtml(p.id)}" aria-label="${isWishlisted(p.id)?'إزالة من المفضلة':'أضف للمفضلة'}" aria-pressed="${isWishlisted(p.id)}">${icon('heart2')}</button>
    </a>
    <div class="product-meta">
      <a class="product-title" href="product.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.title)}</a>
      <div class="rating"><span>★</span> ${p.rating} <em>(${p.reviews})</em></div>
      <div class="price-row"><b>${money(p.price)}</b>${p.oldPrice?`<del>${money(p.oldPrice)}</del>`:''}</div>
      <button class="quick-add" onclick="addToCart('${p.id}')">${icon('bag')} أضف للسلة</button>
    </div>
  </article>`;
}


function nav(){
  return `<div class="topbar"><div class="container topbar-inner"><span>منتجات رقمية هادفة تصنع أثرًا حقيقيًا</span><span>تحميل فوري وآمن بعد الشراء</span></div></div>
  <header class="site-header"><div class="container nav-wrap">
    <a class="brand" href="index.html"><img src="assets/athr-logo.png" alt="شعار أثر"><span><b>أثر</b><small>معرفة تترك أثرًا</small></span></a>
    <nav class="main-nav" aria-label="التنقل الرئيسي">
      <a href="index.html">الرئيسية</a><a href="shop.html">المتجر</a><a href="shop.html#categories">الأقسام</a><a href="shop.html?sort=new">وصل حديثًا</a><a href="shop.html?sort=popular">الأكثر مبيعًا</a><a href="about.html">عن أثر</a>
    </nav>
    <div class="nav-actions">
      <button class="icon-btn search-toggle" aria-label="بحث">${icon('search')}</button>
      <a class="icon-btn wishlist-link" href="wishlist.html" aria-label="المفضلة">${icon('heart2')}<span class="cart-count wishlist-count">${wishlistState.size}</span></a>
      <a class="icon-btn" href="account.html" aria-label="الحساب">${icon('user')}</a>
      <a class="icon-btn bag-link" href="cart.html" aria-label="السلة">${icon('bag')}<span class="cart-count">0</span></a>
      <button class="menu-btn" aria-label="القائمة">☰</button>
    </div>
  </div><div class="mobile-nav"><a href="index.html">الرئيسية</a><a href="shop.html">المتجر</a><a href="wishlist.html">المفضلة</a><a href="about.html">عن أثر</a><a href="account.html">حسابي</a><a href="cart.html">السلة</a></div>
  <div class="search-panel"><div class="container"><form action="shop.html" class="search-form"><input name="q" placeholder="ابحث عن منتج، كتاب أو دليل..." autofocus><button>بحث</button></form></div></div></header>`;
}

function footer(){ return `<footer class="footer"><div class="container footer-grid">
  <div><a class="brand footer-brand" href="index.html"><img src="assets/athr-logo.png" alt="أثر"><span><b>أثر</b><small>معرفة تترك أثرًا</small></span></a><p>منتجات رقمية عربية هادفة صُممت لتساعدك على بناء حياة أكثر وعيًا واتزانًا.</p></div>
  <div><h4>استكشف</h4><a href="shop.html">كل المنتجات</a><a href="shop.html?category=kids">الطفل والتربية</a><a href="shop.html?category=growth">تطوير الذات</a><a href="shop.html?category=money">الوعي المالي</a></div>
  <div><h4>المساعدة</h4><a href="#">الأسئلة الشائعة</a><a href="#">سياسة الاستخدام</a><a href="#">سياسة الاسترجاع</a><a href="#">تواصل معنا</a></div>
  <div><h4>أثر جديد في بريدك</h4><p>منتجات وأفكار وموارد مختارة، بدون إزعاج.</p><form class="newsletter" id="newsletter-form"><input type="email" name="email" required autocomplete="email" placeholder="البريد الإلكتروني" aria-label="البريد الإلكتروني"><button type="submit">انضم</button></form></div>
  </div><div class="container copyright"><span>© 2026 أثر. جميع الحقوق محفوظة.</span><span>منتج صغير. أثر حقيقي.</span></div></footer>`; }

async function subscribeNewsletter(form){
  const input=form.querySelector('input[name="email"]');
  const button=form.querySelector('button[type="submit"]');
  const email=String(input?.value||'').trim();
  if(!email)return;

  const originalText=button?.textContent||'انضم';
  if(button){button.disabled=true;button.textContent='جارٍ الاشتراك...'}

  try{
    const response=await fetch(`${DATA.apiBase}/newsletter/subscribe`,{
      method:'POST',
      credentials:'include',
      headers:{Accept:'application/json','Content-Type':'application/json'},
      body:JSON.stringify({email}),
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok){
      const raw=Array.isArray(body.message)?body.message[0]:body.message;
      throw new Error(raw||'تعذر الاشتراك حاليًا.');
    }
    form.reset();
    toast(body.alreadySubscribed?'أنت مشترك بالفعل':'تم الاشتراك في نشرة أثر بنجاح');
  }catch(error){
    const message=error?.message||'تعذر الاشتراك حاليًا. حاول مرة أخرى.';
    toast(message);
  }finally{
    if(button){button.disabled=false;button.textContent=originalText}
  }
}

function initNewsletter(){
  const form=$('#newsletter-form');
  if(!form)return;
  form.addEventListener('submit',event=>{
    event.preventDefault();
    subscribeNewsletter(form);
  });
}

function initGlobal(){
  const headerRoot=$('#site-nav'); if(headerRoot) headerRoot.innerHTML=nav();
  const footerRoot=$('#site-footer'); if(footerRoot) footerRoot.innerHTML=footer();
  initNewsletter();
  updateCartCount();
  $('.menu-btn')?.addEventListener('click',()=>$('.mobile-nav')?.classList.toggle('open'));
  $('.search-toggle')?.addEventListener('click',()=>$('.search-panel')?.classList.toggle('open'));
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-wishlist-id]');
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    toggleWishlist(button.dataset.wishlistId);
  });
}

function initHome(){
  const cats=$('#category-grid');
  if(cats) cats.innerHTML=DATA.catalogError?catalogUnavailableMarkup():DATA.categories.map(c=>`<a class="category-card ${c.tone}" href="shop.html?category=${encodeURIComponent(c.id)}"><div class="category-icon">${icon(c.icon)}</div><div><span>${escapeHtml(c.short)}</span><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.desc)}</p><b>اكتشف القسم ${icon('arrow')}</b></div></a>`).join('');
  const featured=$('#featured-products');
  if(featured) featured.innerHTML=DATA.catalogError?catalogUnavailableMarkup():DATA.products.filter(p=>p.featured).map(productCard).join('');
}


function initShop(){
  const list=$('#shop-products'); if(!list)return;
  if(DATA.catalogError){ list.innerHTML=catalogUnavailableMarkup(); const count=$('#result-count'); if(count) count.textContent=''; return; }
  const params=new URLSearchParams(location.search); let active=params.get('category')||'all'; const q=(params.get('q')||'').trim(); const sort=params.get('sort')||'featured';
  const filter=$('#category-filter'); filter.innerHTML=['<button data-id="all">الكل</button>',...DATA.categories.map(c=>`<button data-id="${c.id}">${c.name}</button>`)].join('');
  const search=$('#shop-search'); search.value=q;
  const sortSelect=$('#sort-select'); sortSelect.value=sort;
  function draw(){
    let items=[...DATA.products]; if(active!=='all') items=items.filter(p=>p.category===active); const text=search.value.trim(); if(text) items=items.filter(p=>(p.title+' '+p.subtitle).includes(text));
    const s=sortSelect.value; if(s==='price-low') items.sort((a,b)=>a.price-b.price); else if(s==='price-high') items.sort((a,b)=>b.price-a.price); else if(s==='popular') items.sort((a,b)=>b.reviews-a.reviews); else if(s==='new') items.sort((a,b)=>(b.badge==='جديد')-(a.badge==='جديد'));
    $$('#category-filter button').forEach(b=>b.classList.toggle('active',b.dataset.id===active));
    list.innerHTML=items.length?items.map(productCard).join(''):'<div class="empty-state"><h3>لا توجد نتائج مطابقة</h3><p>جرب كلمة بحث أو قسمًا مختلفًا.</p></div>';
    $('#result-count').textContent=`${items.length} منتج`;
  }
  filter.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;active=b.dataset.id;draw()}); search.addEventListener('input',draw); sortSelect.addEventListener('change',draw); draw();
}

function initProduct(){
  const root=$('#product-page'); if(!root)return;
  if(DATA.catalogError||!DATA.products.length){ root.innerHTML=catalogUnavailableMarkup(); return; }
  const id=new URLSearchParams(location.search).get('id')||DATA.products[0].id;
  const p=DATA.products.find(x=>x.id===id)||DATA.products[0];
  const cat=DATA.categories.find(c=>c.id===p.category);
  if(!cat){ root.innerHTML=catalogUnavailableMarkup(); return; }
  document.title=`${p.title} | أثر`;
  const hasImage=Boolean(p.coverUrl);
  const previews=(p.gallery||[]).filter(image=>image.secureUrl&&image.secureUrl!==p.coverUrl).slice(0,3);
  const previewMarkup=previews.length
    ? previews.map(image=>`<span class="mini-preview-image"><img src="${escapeHtml(image.secureUrl)}" alt="${escapeHtml(image.altAr||p.title)}" loading="lazy"></span>`).join('')
    : '<span>معاينة 1</span><span>معاينة 2</span><span>معاينة 3</span>';
  root.innerHTML=`<div class="product-detail-grid"><div class="product-gallery"><div class="cover detail-cover ${productCoverClass(p)} ${hasImage?'has-cloudinary-image':''}">${productCoverVisual(p,cat)}<span class="product-badge">${escapeHtml(p.badge||'منتج أثر')}</span><button class="wish-btn ${isWishlisted(p.id)?'active':''}" type="button" data-wishlist-id="${escapeHtml(p.id)}" aria-label="${isWishlisted(p.id)?'إزالة من المفضلة':'أضف للمفضلة'}" aria-pressed="${isWishlisted(p.id)}">${icon('heart2')}</button></div><div class="mini-previews">${previewMarkup}</div></div>
  <div class="product-info"><a class="crumb" href="shop.html?category=${encodeURIComponent(cat.id)}">${escapeHtml(cat.name)}</a><h1>${escapeHtml(p.title)}</h1><div class="rating big"><span>★</span> ${p.rating} <em>(${p.reviews} تقييم)</em></div><p class="lead">${escapeHtml(p.subtitle)}</p><div class="price-big">${money(p.price)} ${p.oldPrice?`<del>${money(p.oldPrice)}</del>`:''}</div><div class="buy-actions"><button class="primary-btn" onclick="addToCart('${p.id}')">${icon('bag')} أضف للسلة</button><button class="secondary-btn" onclick="addToCart('${p.id}');location.href='cart.html'">اشترِ الآن</button></div>
  <div class="mini-trust"><span>${icon('download')} تحميل فوري</span><span>${icon('shield')} دفع آمن</span><span>${icon('spark')} وصول مدى الحياة</span></div>
  <div class="product-spec"><div><span>النوع</span><b>${escapeHtml(p.format)}</b></div><div><span>المحتوى</span><b>${escapeHtml(p.pages)}</b></div><div><span>الوصول</span><b>فوري بعد الدفع</b></div></div></div></div>
  <section class="detail-copy"><h2>هذا المنتج سيساعدك على</h2><div class="benefit-list"><p>✓ تحويل الفكرة إلى خطوات بسيطة وقابلة للتطبيق.</p><p>✓ المتابعة بدون تعقيد أو شعور بالضغط.</p><p>✓ بناء وعي أعمق بالموضوع بطريقة عملية.</p><p>✓ الاحتفاظ بنسختك والرجوع لها في أي وقت.</p></div><h2>ماذا ستحصل عليه؟</h2><p>${escapeHtml(p.description||'نسخة رقمية مصممة بعناية، جاهزة للتحميل والاستخدام فور إتمام عملية الشراء. يمكن استخدامها على الهاتف أو الكمبيوتر.')}</p></section>`;
  const rel=$('#related-products'); if(rel) rel.innerHTML=DATA.products.filter(x=>x.category===p.category&&x.id!==p.id).slice(0,4).map(productCard).join('');
}


function renderWishlistPage(){
  const root=$('#wishlist-products'); if(!root)return;
  if(DATA.catalogError&&!wishlistState.size){root.innerHTML=catalogUnavailableMarkup();return}
  const items=[...wishlistState].map(id=>wishlistProducts.get(id)||DATA.products.find(product=>product.id===id)).filter(Boolean);
  if(!items.length){
    root.innerHTML='<div class="empty-state"><h3>المفضلة فارغة حاليًا</h3><p>اضغط على علامة القلب في أي منتج لتحفظه هنا.</p><a class="primary-btn" href="shop.html">اكتشف المنتجات</a></div>';
    updateWishlistUI();
    return;
  }
  root.innerHTML=items.map(productCard).join('');
  updateWishlistUI();
}

function renderCart(){
  const root=$('#cart-root'); if(!root)return;
  if(DATA.catalogError){ root.innerHTML=catalogUnavailableMarkup(); return; }
  const cart=getCart(); const rows=cart.map(row=>({row,p:DATA.products.find(p=>p.id===row.id)})).filter(x=>x.p);
  if(!rows.length){root.innerHTML='<div class="empty-cart"><div class="empty-bag">'+icon('bag')+'</div><h2>سلتك ما زالت فارغة</h2><p>اكتشف منتجات أثر واختر ما يناسب رحلتك.</p><a class="primary-btn" href="shop.html">تصفح المتجر</a></div>';return}
  const subtotal=rows.reduce((s,x)=>s+x.p.price*x.row.qty,0);
  root.innerHTML=`<div class="cart-layout"><div class="cart-items">${rows.map(({row,p})=>`<div class="cart-row"><a class="cover cart-cover ${productCoverClass(p)} ${p.coverUrl?'has-cloudinary-image':''}" href="product.html?id=${encodeURIComponent(p.id)}">${p.coverUrl?`<img class="product-cover-image" src="${escapeHtml(p.coverUrl)}" alt="${escapeHtml(p.coverAlt||p.title)}" loading="lazy">`:`<span class="cover-brand">أثر</span><strong>${escapeHtml(p.title)}</strong>`}</a><div class="cart-main"><a href="product.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.title)}</a><span>${escapeHtml(p.format)}</span><b>${money(p.price)}</b></div><div class="qty"><button onclick="setQty('${p.id}',${row.qty-1})">−</button><span>${row.qty}</span><button onclick="setQty('${p.id}',${row.qty+1})">+</button></div><strong>${money(p.price*row.qty)}</strong><button class="trash" onclick="removeFromCart('${p.id}')">${icon('trash')}</button></div>`).join('')}</div>
  <aside class="order-summary"><h2>ملخص الطلب</h2><div><span>المجموع</span><b>${money(subtotal)}</b></div><div><span>التوصيل</span><b>رقمي — مجاني</b></div><hr><div class="total"><span>الإجمالي</span><b>${money(subtotal)}</b></div><button class="primary-btn full" id="checkout-open">إتمام الطلب</button><p>${icon('shield')} دفع آمن — لن يتم طلب عنوان شحن للمنتجات الرقمية.</p></aside></div>`;
  $('#checkout-open')?.addEventListener('click',()=>{ window.location.href='checkout.html'; });
}


function normalizeWhatsAppNumber(number){
  const digits=String(number||'').replace(/\D/g,'');
  // WhatsApp requires the international number without +.
  // If a domestic zero was written after +966, remove it for the wa.me link.
  return digits.startsWith('9660') ? `966${digits.slice(4)}` : digits;
}

function isValidRegionalPhone(value){
  const digits=String(value||'').replace(/\D/g,'');
  // Accept common Middle East/MENA phone formats, with spaces/dashes/parentheses allowed.
  // 8–15 digits keeps the field flexible for different country codes and local formats.
  return digits.length>=8 && digits.length<=15;
}

function openCheckout(total){
  let modal=$('#checkout-modal'); if(!modal){ modal=document.createElement('div'); modal.id='checkout-modal'; modal.className='modal'; document.body.appendChild(modal); }
  modal.innerHTML=`<div class="modal-card"><button class="modal-close" aria-label="إغلاق">×</button><span class="modal-kicker">خطوة أخيرة</span><h2>إتمام الطلب عبر واتساب</h2><p>أدخل بياناتك ثم اضغط إرسال الطلب. سيتم فتح واتساب مباشرة لإكمال الطلب مع فريق أثر.</p><form id="checkout-form"><label>الاسم الكامل<input required name="name" autocomplete="name" placeholder="أدخل الاسم الكامل"></label><label>البريد الإلكتروني<input required type="email" name="email" autocomplete="email" placeholder="أدخل البريد الإلكتروني"></label><label>رقم الهاتف<input required type="tel" inputmode="tel" autocomplete="tel" name="phone" placeholder="أدخل رقم الهاتف"><small class="phone-help">نقبل أرقام دول الشرق الأوسط بصيغتها المحلية أو الدولية.</small></label><div class="checkout-total"><span>الإجمالي</span><b>${money(total)}</b></div><button class="primary-btn full">إكمال الطلب عبر واتساب</button><small>لن يتم الدفع داخل الموقع حاليًا؛ يتم تأكيد تفاصيل الطلب والدفع عبر واتساب.</small></form></div>`; modal.classList.add('open');
  $('.modal-close',modal).onclick=()=>modal.classList.remove('open');
  $('#checkout-form',modal).onsubmit=(e)=>{
    e.preventDefault();
    const form=new FormData(e.currentTarget);
    const name=String(form.get('name')||'').trim();
    const email=String(form.get('email')||'').trim();
    const phone=String(form.get('phone')||'').trim();
    if(!isValidRegionalPhone(phone)){
      toast('من فضلك أدخل رقم هاتف صحيح');
      e.currentTarget.elements.phone.focus();
      return;
    }

    const cart=getCart();
    const lines=cart.map(row=>{
      const p=DATA.products.find(item=>item.id===row.id);
      return p ? `• ${p.title} × ${row.qty} — ${money(p.price*row.qty)}` : '';
    }).filter(Boolean);
    const message=[
      'مرحبًا أثر، أريد إكمال هذا الطلب:',
      '',
      `الاسم: ${name}`,
      `رقم العميل: ${phone}`,
      `البريد: ${email}`,
      '',
      'المنتجات:',
      ...lines,
      '',
      `الإجمالي: ${money(total)}`,
      '',
      'أرغب في إكمال تفاصيل الطلب والدفع عبر واتساب.'
    ].join('\n');

    const target=normalizeWhatsAppNumber(DATA.whatsappNumber);
    window.open(`https://wa.me/${target}?text=${encodeURIComponent(message)}`,'_blank','noopener');
  };
}

document.addEventListener('DOMContentLoaded',async()=>{
  initGlobal();
  if(window.ATHR_CATALOG_READY) await window.ATHR_CATALOG_READY;
  await initWishlist();
  initHome();
  initShop();
  initProduct();
  renderCart();
  renderWishlistPage();
  updateWishlistUI();
  if(DATA.catalogError) toast('تعذر الاتصال بكتالوج أثر. تأكد من تشغيل الـ API.');
});
