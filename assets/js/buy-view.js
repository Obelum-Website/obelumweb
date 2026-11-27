/* Buy page: one switch between the catalogue (this Buy page) and the property map.
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

  // Desktop (27 Nov 2026): the menu has a plain "Map" link after "Buy" on every page, and the
  // Map / Catalogue switch no longer opens out of the menu. It stays parked (hidden) on desktop so the
  // views still work; "Map" and "Buy" switch views here without reloading. Phones and tablets: the
  // switch sits in the header, top left of the logo, as before.
  const nav = $('.hero-nav'); const buy = nav && $('.hero-nav__link[aria-current="page"]', nav);
  const mapLink = nav && $('.hero-nav__link[data-nav-map]', nav);
  const slot = document.createElement('span'); // kept for show(); never placed any more
  const setOpen = () => {};
  const wide = matchMedia('(min-width: 64rem)');
  let introDone = false;
  function place() {
    if (wide.matches) { if (sw.parentNode !== document.body) document.body.appendChild(sw); }
    else {
      const hd = document.querySelector('.site-header');
      if (hd && sw.parentNode !== hd) hd.prepend(sw);
    }
  }
  place(); wide.addEventListener('change', place);
  const plain = (e) => e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0;
  if (mapLink) mapLink.addEventListener('click', (e) => { if (plain(e)) return; e.preventDefault(); if (!document.body.classList.contains('bt-map')) { show('map', true); scrollTo(0, 0); } });
  if (buy) buy.addEventListener('click', (e) => { if (plain(e) || !document.body.classList.contains('bt-map')) return; e.preventDefault(); show('catalogue', true); });
  const markNav = (toMap) => {
    if (buy) { if (toMap) buy.removeAttribute('aria-current'); else buy.setAttribute('aria-current', 'page'); }
    if (mapLink) { if (toMap) mapLink.setAttribute('aria-current', 'page'); else mapLink.removeAttribute('aria-current'); }
  };
  const nameEl = $('[data-view-name]', sw);

  const S = () => window.ObelumSearch || {};
  // The pinned band (assets/js/band.js) opens the map through this.
  window.ObelumBuyView = { showMap: () => { show('map', true); scrollTo(0, 0); } };
  // "Explore all projects on the map" (photo header): the Buy map view, on this page.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a.soon__map'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault(); show('map', true, true); scrollTo(0, 0);
  });

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
      css(tpl.dataset.mapCss), // versions come from buy.html (set by tools/sync_buy_map.py from map.html)
    ])
      .then(() => { document.body.appendChild(tpl.content.cloneNode(true)); })
      .then(() => (window.L ? null : js('assets/vendor/leaflet/leaflet.js')))
      .then(() => (window.L && L.Map.prototype.setBearing ? null : js('assets/vendor/leaflet/leaflet-rotate.js')))
      .then(() => (window.L && L.markerClusterGroup ? null : js('assets/vendor/leaflet/leaflet.markercluster.js')))
      .then(() => js(tpl.dataset.mapJs))
      .then(() => {
        // The map's own switch (left of Saved) works here as the Map / Catalogue switch for the page.
        const own = $('.mapapp .mapsw');
        if (own) {
          const twin = own.cloneNode(true); // a copy without the map's list behaviour
          twin.removeAttribute('data-map-list-toggle'); twin.removeAttribute('data-top-list');
          twin.classList.remove('is-on'); twin.setAttribute('aria-checked', 'false');
          twin.setAttribute('aria-label', 'Switch to the catalogue');
          const nm = twin.querySelector('[data-view-name]'); if (nm) nm.textContent = 'Map';
          twin.addEventListener('click', () => show('catalogue', true));
          own.replaceWith(twin);
        }
      });
    return mapReady;
  }

  // Phones: each time the map opens, a short note that it is fuller on a tablet or desktop.
  // Closes with a tap anywhere (or the X).
  const phone = matchMedia('(max-width: 47.99rem)');
  function phoneTip() {
    if (!phone.matches || $('.bt-tip')) return;
    const tip = document.createElement('div'); tip.className = 'bt-tip'; tip.setAttribute('role', 'dialog'); tip.setAttribute('aria-label', 'Tip');
    tip.innerHTML = `<div class="bt-tip__card"><button type="button" class="bt-tip__x" aria-label="Close">×</button>
      <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 20h8M12 16v4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      <p>For the full experience, use<br><b>Tablet</b> or <b>Desktop</b>.</p></div>`;
    const close = () => { tip.classList.add('is-out'); setTimeout(() => tip.remove(), 250); };
    tip.addEventListener('click', close);
    document.body.appendChild(tip);
    requestAnimationFrame(() => tip.classList.add('is-in'));
  }

  // Map top bar: an arrow left of "Property map", back to the catalogue.
  function mapBack() {
    const title = $('.mapapp .mtop__title'); if (!title || $('.mapapp .mback')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mback'; b.setAttribute('aria-label', 'Back to the catalogue'); b.title = 'Back to the catalogue';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    b.addEventListener('click', () => { show('catalogue', true); });
    title.prepend(b);
  }

  /* Catalogue search -> map: the catalogue's filters in the address (dev=sobha, loc=JVC, beds=2...) are
     handed to the map as its "ai" filter, which the map applies with the catalogue's own rule
     (its own dev/type/beds keys expect exact names from its menus, so "sobha" matched nothing). */
  const CAT_KEYS = ['loc', 'type', 'beds', 'pmin', 'pmax', 'status', 'dev', 'year', 'sold', 'name'];
  function carrySearch(u, all) {
    if (all) { // "Explore all projects on the map": every project, whatever was searched
      CAT_KEYS.concat(['q', 'area', 'dev', 'ho', 'pay', 'st', 'ids', 'saved', 'ai', 'c']).forEach((k) => u.searchParams.delete(k)); u.hash = ''; return;
    }
    carried = '';
    const f = {}; CAT_KEYS.forEach((k) => { const v = u.searchParams.get(k); if (v !== null && v !== '') f[k] = v; });
    if (!Object.keys(f).length) return;
    CAT_KEYS.concat(['q', 'area', 'ho', 'pay', 'st', 'ids', 'saved', 'ai']).forEach((k) => u.searchParams.delete(k));
    u.searchParams.set('ai', new URLSearchParams(f).toString());
    carried = JSON.stringify(f);
    u.hash = '';
  }
  let mapLoaded = false, catUrl = '', mapUrl = '', carried = '';
  const sameAI = (a) => { if (!a || !carried) return false; const b = JSON.parse(carried); const ka = Object.keys(a).filter((k) => k !== 'label').sort(), kb = Object.keys(b).sort(); return ka.join() === kb.join() && ka.every((k) => String(a[k]) === String(b[k])); };
  /* Map -> catalogue: the catalogue shows what the map was showing.
     - The catalogue's own search, untouched on the map: the catalogue as it was.
     - Anything else filtered on the map (districts, developers, price, payments, handover, AI or name
       search, saved...): exactly the map's projects, tagged "From the map: ..." (removable).
     - Nothing filtered on the map: the catalogue's normal rows. */
  function fromMap() {
    const M = window.ObelumMap, R = S().results && S().results(); if (!M || !R) return null;
    if (M.onlyAI() && sameAI(M.ai())) return 'keep';
    if (M.active()) { R.show({ ids: new Set(M.ids()), idsLabel: M.label() }, false); return 'selection'; }
    const cur = R.state(); if (Object.keys(cur).some((k) => k !== 'sold')) R.show({}, false);
    return 'clear';
  }

  function show(view, push, all) {
    const toMap = view === 'map', fromCat = !document.body.classList.contains('bt-map');
    sw.classList.toggle('is-on', !toMap);
    sw.setAttribute('aria-checked', String(!toMap));
    if (nameEl) nameEl.textContent = toMap ? 'Map' : 'Catalogue';
    if (slot.parentNode && introDone && !slot.classList.contains('is-leaving')) setOpen(true);
    document.body.classList.toggle('bt-map', toMap);
    markNav(toMap);
    document.body.classList.toggle('page-map', toMap);
    if (toMap) {
      sw.classList.add('is-busy');
      loadMap().then(() => {
        sw.classList.remove('is-busy'); mapLoaded = true;
        phoneTip(); mapBack();
        document.documentElement.classList.remove('bt-early-map');
        window.dispatchEvent(new Event('resize')); // Leaflet re-measures after being hidden
      }).catch(() => { sw.classList.remove('is-busy'); show('catalogue', true); });
    }
    if (push) {
      let u;
      if (toMap) {
        const R = S().results && S().results(), sel = R && R.state().ids;
        if (fromCat) catUrl = location.href;
        // The catalogue is showing the map's last selection: back to the map as it was.
        if (sel && mapUrl && !all) { u = new URL(mapUrl); u.searchParams.set('view', 'map'); }
        else { u = new URL(location.href); u.searchParams.set('view', 'map'); carrySearch(u, all); if (all) carried = ''; }
      } else {
        if (!fromCat) mapUrl = location.href;
        const how = fromCat ? null : fromMap();
        // Back to the catalogue: its own address as it was (with its search), or a clean one for a map selection.
        u = new URL(how === 'keep' && catUrl ? catUrl : location.pathname, location.href);
        u.searchParams.delete('view');
        if (how === 'selection') { u.hash = 'property-search'; requestAnimationFrame(() => { const sec = $('#property-search'); if (sec) sec.scrollIntoView({ block: 'start' }); }); }
      }
      history.pushState({ view }, '', u);
      if (toMap && mapLoaded) document.dispatchEvent(new CustomEvent('obelum:map-url')); // the map re-reads the address
    }
    if (!toMap) { document.documentElement.classList.remove('bt-early-map'); window.dispatchEvent(new Event('resize')); }
  }

  sw.addEventListener('click', () => show(document.body.classList.contains('bt-map') ? 'catalogue' : 'map', true));
  addEventListener('popstate', () => show(new URLSearchParams(location.search).get('view') === 'map' ? 'map' : 'catalogue', false));
  show(new URLSearchParams(location.search).get('view') === 'map' ? 'map' : 'catalogue', false);
})();
