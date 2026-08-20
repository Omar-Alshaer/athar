(() => {
  const navRoot = document.getElementById('site-nav');
  if (!navRoot) return;

  const topbar = navRoot.querySelector('.topbar');
  const header = navRoot.querySelector('.site-header');

  if (!header) return;

  const syncSizes = () => {
    const topbarHeight = topbar ? Math.ceil(topbar.getBoundingClientRect().height) : 0;
    const headerHeight = Math.ceil(header.getBoundingClientRect().height);
    const totalHeight = topbarHeight + headerHeight;

    document.documentElement.style.setProperty('--athr-topbar-height', `${topbarHeight}px`);
    document.documentElement.style.setProperty('--athr-nav-height', `${totalHeight}px`);
  };

  const syncScroll = () => {
    header.classList.toggle('athr-nav-shadow', window.scrollY > 8);
  };

  const sync = () => {
    syncSizes();
    syncScroll();
  };

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(syncSizes);
    if (topbar) ro.observe(topbar);
    ro.observe(header);
  }

  const mo = new MutationObserver(syncSizes);
  mo.observe(navRoot, { childList:true, subtree:true, attributes:true });

  window.addEventListener('resize', syncSizes, { passive:true });
  window.addEventListener('scroll', syncScroll, { passive:true });

  requestAnimationFrame(sync);
  setTimeout(sync, 120);
})();
