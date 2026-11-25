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

  // Desktop: the switch opens out of the menu right after "Buy" and pushes Rent, Sell... along.
  // Clicking "Buy" on this page folds it away or brings it back. Phones keep it at the bottom.
  const nav = $('.hero-nav'); const buy = nav && $('.hero-nav__link[aria-current="page"]', nav);
  const slot = document.createElement('span'); slot.className = 'btslot';
  // Open / close the slot; the menu's tighter spacing (small desktops) goes with it, so other pages
  // (normal spacing) never see a jump.
  const setOpen = (on) => {
    if (on) slot.style.setProperty('--w', (sw.offsetWidth + 2) + 'px');
    slot.classList.toggle('is-open', on); nav && nav.classList.toggle('has-btslot', on);
  };
  const wide = matchMedia('(min-width: 64rem)');
  let introDone = false; // the slide-out plays once on arrival; nothing opens the slot before it
  function place() {
    if (wide.matches && buy) {
      if (sw.parentNode !== slot) { slot.appendChild(sw); buy.after(slot); }
      // First open: wait until the page has painted, then play the slide-out once.
      if (!slot.dataset.intro) {
        slot.dataset.intro = '1';
        const go = () => setTimeout(() => { introDone = true; slot.classList.add('is-intro'); setOpen(true); setTimeout(() => slot.classList.remove('is-intro'), 1600); }, 450);
        if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
      } else if (introDone) setOpen(true);
    } else {
      // Phones and tablets: in the header, top left, beside the logo.
      const hd = document.querySelector('.site-header');
      if (hd && sw.parentNode !== hd) { hd.prepend(sw); slot.remove(); nav && nav.classList.remove('has-btslot'); }
    }
  }
  place(); wide.addEventListener('change', place);
  if (buy) buy.addEventListener('click', (e) => { if (!wide.matches) return; e.preventDefault(); setOpen(!slot.classList.contains('is-open')); });
  // Leaving Buy from the menu: the switch slides back into "Buy" first, then the page changes.
  if (nav) nav.addEventListener('click', (e) => {
    const a = e.target.closest('a.hero-nav__link'); if (!a || a === buy || !slot.classList.contains('is-open')) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || a.target === '_blank') return; // new tab: no animation
    e.preventDefault(); slot.classList.remove('is-intro'); slot.classList.add('is-leaving'); setOpen(false);
    setTimeout(() => { location.href = a.href; }, 650);
  });
  addEventListener('pageshow', (e) => { if (e.persisted) { slot.classList.remove('is-leaving'); if (slot.parentNode) setOpen(true); } });
  const nameEl = $('[data-view-name]', sw);

  // A Map / Catalogue button above the first row (Latest launches), in the middle.
  /* Desktop catalogue: a slim dark band under the photo header (sticks under the site menu) with the map's top controls, in this order:
     [Map | switch | Catalogue]  [Saved | Share]  [AED | sq ft]. Same colour as the project rows. */
  const S = () => window.ObelumSearch || {};
  const CURRENCIES = [['AED', 'UAE dirham'], ['USD', 'US dollar'], ['EUR', 'Euro'], ['GBP', 'British pound'], ['RUB', 'Russian rouble'], ['CNY', 'Chinese yuan'], ['INR', 'Indian rupee'], ['SAR', 'Saudi riyal']];
  function addTopBar() {
    const hd = $('.site-header'), sec = $('#property-search'); if (!sec || $('.btbar')) return;
    const icons = sw.querySelector('.btswitch__track');
    const ic = (cls) => { const i = icons && icons.querySelector('.' + cls); return i ? i.outerHTML : ''; };
    const bar = document.createElement('div'); bar.className = 'btbar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Catalogue view');
    bar.innerHTML = `<div class="btbar__in">
      <button type="button" class="btbox" aria-label="Show the projects on the map"><span class="btbox__lbl btbox__lbl--map">Map</span><span class="btbox__track" aria-hidden="true">${ic('ic-map')}${ic('ic-cat')}<span class="btbox__knob">${ic('ic-map')}${ic('ic-cat')}</span></span><span class="btbox__lbl btbox__lbl--cat">Catalogue</span></button>
      <div class="btbar__group">
        <button type="button" class="btbar__btn" data-bt-saved title="Projects you saved with ♡"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 16.5s-6.2-3.7-6.2-8.2A3.4 3.4 0 0 1 10 6.4a3.4 3.4 0 0 1 6.2 1.9c0 4.5-6.2 8.2-6.2 8.2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span>Saved</span><em></em></button>
        <button type="button" class="btbar__btn" data-share data-share-title="Buy property in Dubai — Obelum"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 13V3M6 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 10v6.5h12V10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Share</span></button>
      </div>
      <div class="btbar__group btbar__group--pref">
        <button type="button" class="btbar__btn" data-bt-cur aria-haspopup="listbox" aria-expanded="false" aria-label="Currency"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><rect x="2.5" y="5" width="15" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 5V4h9" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="13.5" cy="10.5" r="1.2" fill="currentColor"/></svg><span data-bt-cur-label>AED</span></button>
        <button type="button" class="btbar__btn" data-bt-unit aria-label="Switch between square feet and square metres"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M3 17L17 3M3 17v-4M3 17h4M17 3h-4M17 3v4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><b data-bt-unit-label>sq ft</b></button>
        <ul class="btbar__menu" role="listbox" aria-label="Currency" hidden></ul>
      </div>
    </div>`;
    // Under the photo header, above the first row; once scrolled to, it stays under the site menu
    // while you browse the rows.
    sec.insertBefore(bar, sec.firstChild);
    const place = () => { if (hd) bar.style.top = hd.offsetHeight + 'px'; };
    place(); addEventListener('resize', place);
    if (hd && window.ResizeObserver) new ResizeObserver(place).observe(hd);

    const box = $('.btbox', bar);
    box.addEventListener('click', () => { box.classList.add('is-going'); setTimeout(() => { show('map', true); box.classList.remove('is-going'); scrollTo(0, 0); }, 320); });
    const menu = $('.btbar__menu', bar), curB = $('[data-bt-cur]', bar);
    const render = () => {
      const s = S(); const n = s.saved ? s.saved.size : 0;
      $('[data-bt-saved] em', bar).textContent = n ? n : '';
      $('[data-bt-cur-label]', bar).textContent = s.curNow ? s.curNow() : 'AED';
      $('[data-bt-unit-label]', bar).innerHTML = s.prefs && s.prefs.unit === 'm2' ? 'm<sup>2</sup>' : 'sq ft';
      // Share: with saved projects, a link that opens just those on the map; otherwise this page.
      const sh = $('[data-share]', bar), lbl = $('span', sh);
      if (n) { const u = new URL(location.pathname, location.origin); u.searchParams.set('view', 'map'); u.searchParams.set('ids', [...s.saved].join('.')); sh.dataset.shareUrl = u.href; sh.dataset.shareTitle = `My property shortlist (${n} ${n === 1 ? 'project' : 'projects'})`; lbl.textContent = `Share saved (${n})`; }
      else { delete sh.dataset.shareUrl; sh.dataset.shareTitle = 'Buy property in Dubai — Obelum'; lbl.textContent = 'Share'; }
    };
    // Saved: opens the saved projects on the map (the map keeps the saved list).
    $('[data-bt-saved]', bar).addEventListener('click', () => {
      const s = S(); if (!(s.saved && s.saved.size)) { const b = $('[data-bt-saved]', bar); b.classList.add('is-hint'); setTimeout(() => b.classList.remove('is-hint'), 1600); return; }
      location.href = location.pathname + '?view=map&saved=1';
    });
    const closeMenu = () => { menu.hidden = true; curB.setAttribute('aria-expanded', 'false'); };
    curB.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!menu.hidden) return closeMenu();
      const cur = S().prefs ? S().prefs.cur : 'AED';
      menu.innerHTML = CURRENCIES.map(([v, l]) => `<li role="option" aria-selected="${v === cur}" data-v="${v}"><b>${v}</b><span>${l}</span></li>`).join('') + '<li class="btbar__note" aria-hidden="true">Prices are set in AED; other currencies are for guidance.</li>';
      menu.hidden = false; curB.setAttribute('aria-expanded', 'true');
    });
    menu.addEventListener('click', (e) => {
      const li = e.target.closest('[data-v]'); if (!li) return;
      const v = li.dataset.v, s = S(); closeMenu();
      const go = () => s.setPref && s.setPref('cur', v);
      if (v === 'AED' || v === 'USD' || !s.loadRates) go(); else s.loadRates().then(go);
    });
    document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.btbar__group--pref')) closeMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
    $('[data-bt-unit]', bar).addEventListener('click', () => { const s = S(); if (s.setPref) s.setPref('unit', s.prefs && s.prefs.unit === 'm2' ? 'sqft' : 'm2'); });
    document.addEventListener('obelum:prefs', render);
    document.addEventListener('obelum:saved', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addTopBar); else addTopBar();

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

  function show(view, push) {
    const toMap = view === 'map';
    sw.classList.toggle('is-on', !toMap);
    sw.setAttribute('aria-checked', String(!toMap));
    if (nameEl) nameEl.textContent = toMap ? 'Map' : 'Catalogue';
    if (slot.parentNode && introDone && !slot.classList.contains('is-leaving')) setOpen(true);
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
