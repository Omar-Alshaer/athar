(() => {
  const localHost = window.location.hostname;
  const isLocal = ['127.0.0.1', 'localhost'].includes(localHost);
  const apiBase = isLocal
    ? `${window.location.protocol}//${localHost}:4000/api`
    : 'https://api.athar-online.com/api';

  const data = (window.ATHR_DATA = {
    apiBase,
    categories: [],
    products: [],
    loaded: false,
    catalogError: null,
  });

  const fallbackCoverByCategory = {
    kids: 'cover-kids',
    wellness: 'cover-sage',
    family: 'cover-rose',
    growth: 'cover-green',
    money: 'cover-gold',
  };

  function mapCategory(category) {
    return {
      id: category.slug,
      dbId: category.id,
      name: category.nameAr,
      short: category.shortAr || '',
      desc: category.descriptionAr || '',
      icon: category.icon || 'book',
      tone: category.tone || 'sage',
      sortOrder: category.sortOrder || 0,
    };
  }

  function mapProduct(product) {
    const categorySlug = product.category?.slug || '';
    return {
      id: product.slug,
      dbId: product.id,
      title: product.titleAr,
      category: categorySlug,
      price: Number(product.price),
      currency: product.currency || 'SAR',
      rating: Number(product.ratingAverage || 0),
      reviews: Number(product.reviewCount || 0),
      badge: product.badgeAr || 'منتج أثر',
      cover: fallbackCoverByCategory[categorySlug] || 'cover-green',
      coverUrl: product.coverImage?.secureUrl || '',
      coverAlt: product.coverImage?.altAr || product.titleAr,
      gallery: Array.isArray(product.images) ? product.images : [],
      subtitle: product.subtitleAr || '',
      description: product.descriptionAr || '',
      pages: product.contentLabelAr || 'منتج رقمي',
      format: product.formatLabelAr || 'PDF رقمي',
      featured: Boolean(product.featured),
      publishedAt: product.publishedAt || null,
    };
  }

  window.ATHR_MAP_PRODUCT = mapProduct;

  async function fetchJson(path) {
    const response = await fetch(`${apiBase}${path}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`ATHR API ${response.status} for ${path}`);
    }

    return response.json();
  }

  window.ATHR_CATALOG_READY = Promise.all([
    fetchJson('/categories'),
    fetchJson('/products?limit=48'),
  ])
    .then(([categoriesResponse, productsResponse]) => {
      data.categories = (categoriesResponse.items || []).map(mapCategory);
      data.products = (productsResponse.items || []).map(mapProduct);
      data.loaded = true;
      data.catalogError = null;
      return true;
    })
    .catch((error) => {
      console.error('ATHR catalog could not be loaded.', error);
      data.loaded = false;
      data.catalogError = error instanceof Error ? error.message : String(error);
      return false;
    });
})();
