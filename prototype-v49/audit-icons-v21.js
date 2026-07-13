// v21 PNG icon helper. Keeps newly supplied icons as <img>, not SVG sprite replacements.
(() => {
  const VH_ICON_FILES = Object.freeze({
    logout: 'logout_signout.png',
    emptyHistory: 'empty_history_records.png',
    alwaysOpen: 'status_24_7.png',
    priceRange: 'price_range_filter.png',
  });

  function VH_PNG_ICON(name, className = '') {
    const file = VH_ICON_FILES[name];
    if (!file) return null;
    const img = document.createElement('img');
    img.src = `vethelp_icon_refresh/${file}`;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.decoding = 'async';
    img.loading = 'lazy';
    img.draggable = false;
    img.width = 1024;
    img.height = 1024;
    img.className = `vh-icon icon-refresh user-provided-icon ${className}`.trim();
    return img;
  }

  window.VH_ICON_FILES = VH_ICON_FILES;
  window.VH_PNG_ICON = VH_PNG_ICON;
})();
