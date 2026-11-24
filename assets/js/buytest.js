/* Buy (test) page: one switch between the catalogue (this Buy page) and the property map.
 *
 * - Catalogue: the normal Buy page; scrolls as usual.
 * - Map: the map page's app (template#map-view) laid over the page. The page underneath is
 *   locked (no scrolling) and hidden, so its images stop loading.
 * - Nothing of the map is loaded until it is first opened: its CSS, Leaflet, the rotate and
 *   cluster plugins and map.js are fetched on demand. Opening ?view=map loads the map first and
 *   leaves the catalogue's images unloaded until the catalogue is opened.
 * - The view is kept in the address (?view=map), so the back button and shared links work.
 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const sw = $('[data-view-switch]');
  if (!sw) return;

  // Desktop: the switch opens out of the menu right after "Buy" and pushes Rent, Sell... along.
  // Clicking "Buy" on this page folds it away or brings it back. Phones keep it at the bottom.
  const nav = $('.hero-nav'); const buy = nav && $('.hero-nav__link[aria-current="page"]', nav);
  const slot = document.createElement('span'); slot.className = 'btslot';
  const wide = matchMedia('(min-width: 64rem)');
  function place() {
    if (wide.matches && buy) {
      if (sw.parentNode !== slot) { slot.appendChild(sw); buy.after(slot); nav.classList.add('has-btslot'); }
      requestAnimationFrame(() => setTimeout(() => slot.classList.add('is-open'), 250));
    } else if (sw.parentNode !== document.body) {
      document.body.appendChild(sw); slot.remove(); nav && nav.classList.remove('has-btslot');
    }
  }
  place(); wide.addEventListener('change', place);
  if (buy) buy.addEventListener('click', (e) => { if (!wide.matches) return; e.preventDefault(); slot.classList.toggle('is-open'); });
  const nameEl = $('[data-view-name]', sw);

  let mapReady = null;
  const css = (href) => new Promise((ok) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = ok; l.onerror = ok; document.head.appendChild(l);
  });
  const js = (src) => new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.body.appendChild(s);
  });

  function loadMap() {
    if (mapReady) return mapReady;
    const tpl = $('#map-view');
    // Styles first, then the map's markup, so it never shows unstyled.
    mapReady = Promise.all([
      css('assets/vendor/leaflet/leaflet.css'),
      css('assets/vendor/leaflet/MarkerCluster.css'),
      css(tpl.dataset.mapCss), // versions come from buytest.html (set by tools/sync_buytest.py from map.html)
    ])
      .then(() => { document.body.appendChild(tpl.content.cloneNode(true)); })
      .then(() => (window.L ? null : js('assets/vendor/leaflet/leaflet.js')))
      .then(() => (window.L && L.Map.prototype.setBearing ? null : js('assets/vendor/leaflet/leaflet-rotate.js')))
      .then(() => (window.L && L.markerClusterGroup ? null : js('assets/vendor/leaflet/leaflet.markercluster.js')))
      .then(() => js(tpl.dataset.mapJs));
    return mapReady;
  }

  function show(view, push) {
    const toMap = view === 'map';
    sw.classList.toggle('is-on', !toMap);
    sw.setAttribute('aria-checked', String(!toMap));
    if (nameEl) nameEl.textContent = toMap ? 'Map' : 'Catalogue';
    if (slot.parentNode) slot.classList.add('is-open');
    document.body.classList.toggle('bt-map', toMap);
    document.body.classList.toggle('page-map', toMap);
    if (toMap) {
      sw.classList.add('is-busy');
      loadMap().then(() => {
        sw.classList.remove('is-busy');
        document.documentElement.classList.remove('bt-early-map');
        window.dispatchEvent(new Event('resize')); // Leaflet re-measures after being hidden
      }).catch(() => { sw.classList.remove('is-busy'); show('catalogue', true); });
    }
    if (push) {
      const u = new URL(location.href);
      if (toMap) u.searchParams.set('view', 'map'); else u.searchParams.delete('view');
      history.pushState({ view }, '', u);
    }
    if (!toMap) { document.documentElement.classList.remove('bt-early-map'); window.dispatchEvent(new Event('resize')); }
  }

  sw.addEventListener('click', () => show(document.body.classList.contains('bt-map') ? 'catalogue' : 'map', true));
  addEventListener('popstate', () => show(new URLSearchParams(location.search).get('view') === 'map' ? 'map' : 'catalogue', false));
  show(new URLSearchParams(location.search).get('view') === 'map' ? 'map' : 'catalogue', false);
})();
