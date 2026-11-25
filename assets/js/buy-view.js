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
      <form class="btbar__ai" role="search" aria-label="AI search" novalidate>
        <svg class="btbar__spark" viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6z M15.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill="currentColor"/></svg>
        <input type="search" name="q" autocomplete="off" placeholder="Ask: 2-bed in Business Bay under 2.5M" aria-label="Describe what you are looking for" tabindex="-1">
        <button type="submit" tabindex="-1">AI search</button>
      </form>
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
    // The photo header grows by the band's height and the band (solid) sits along its bottom edge.
    const soon = $('section.soon');
    if (soon) { const room = document.createElement('div'); room.className = 'btbar-room'; room.setAttribute('aria-hidden', 'true'); soon.appendChild(room); }
    // Pinned (the photo has scrolled away): the AI search bar slides in on the left of the band.
    const ai = $('.btbar__ai', bar);
    const pinned = () => {
      const r = bar.getBoundingClientRect(), top = hd ? hd.offsetHeight : 64;
      const on = !!soon && r.top <= top + 1 && soon.getBoundingClientRect().bottom < r.bottom - 1;
      if (on === bar.classList.contains('is-pinned')) return;
      bar.classList.toggle('is-pinned', on);
      ai.querySelectorAll('input, button').forEach((x) => { x.tabIndex = on ? 0 : -1; });
      if (!on && ai.contains(document.activeElement)) document.activeElement.blur();
    };
    // Same search as the AI bar in the photo header: the sentence goes through that form (with its filters).
    ai.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = ai.elements.q.value.trim(); if (!text) return ai.elements.q.focus();
      const hero = $('section.soon form.psearch__form');
      if (!hero) { location.href = 'search?q=' + encodeURIComponent(text); return; }
      hero.elements.q.value = text;
      const go = hero.querySelector('.psearch__go');
      if (hero.requestSubmit) hero.requestSubmit(go || undefined); else go.click();
      ai.elements.q.blur();
    });
    const place = () => { if (hd) bar.style.top = hd.offsetHeight + 'px'; pinned(); };
    place(); addEventListener('resize', place); addEventListener('scroll', pinned, { passive: true });
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
    // Saved: a pop-up over the catalogue with the saved projects, sized to how many there are.
    $('[data-bt-saved]', bar).addEventListener('click', () => {
      const s = S(); if (!(s.saved && s.saved.size)) { const b = $('[data-bt-saved]', bar); b.classList.add('is-hint'); setTimeout(() => b.classList.remove('is-hint'), 1600); return; }
      openSaved();
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
  /* Saved pop-up: the saved projects as the Buy cards; up to 4 across, wider or narrower with the count.
     Heart removes a project (the pop-up shrinks); a card opens the project's details. */
  let savedPop = null;
  function openSaved() {
    const s = S(); if (!s.loadData) return;
    if (!savedPop) {
      savedPop = document.createElement('div'); savedPop.className = 'btsaved'; savedPop.hidden = true;
      savedPop.setAttribute('role', 'dialog'); savedPop.setAttribute('aria-modal', 'true'); savedPop.setAttribute('aria-labelledby', 'btsaved-title');
      savedPop.innerHTML = `<div class="btsaved__backdrop" data-saved-close></div>
        <div class="btsaved__box">
          <div class="btsaved__head">
            <h2 id="btsaved-title">Saved projects <span data-saved-n></span></h2>
            <div class="btsaved__acts">
              <button type="button" class="btsaved__btn" data-saved-map>View on map</button>
              <button type="button" class="btsaved__btn" data-share data-saved-share>Share</button>
              <button type="button" class="btsaved__x" data-saved-close aria-label="Close">×</button>
            </div>
          </div>
          <div class="btsaved__grid" data-saved-grid></div>
        </div>`;
      document.body.appendChild(savedPop);
      savedPop.addEventListener('click', (e) => {
        if (e.target.closest('[data-save]')) return; // the heart (handled by the shared save code)
        if (e.target.closest('[data-saved-close]')) return closeSaved();
        if (e.target.closest('[data-saved-map]')) { location.href = location.pathname + '?view=map&saved=1'; return; }
        const card = e.target.closest('.plate'); if (!card) return;
        s.loadData().then((d) => { const p = d.projects.find((x) => String(x.id) === card.dataset.id); if (p && s.openModal) s.openModal(p); });
      });
      savedPop.addEventListener('keydown', (e) => { const card = e.target.closest('.plate'); if (card && (e.key === 'Enter' || e.key === ' ') && !e.target.closest('[data-save]')) { e.preventDefault(); card.click(); } });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && savedPop && !savedPop.hidden && !document.documentElement.classList.contains('pmodal-open')) closeSaved(); });
      document.addEventListener('obelum:saved', () => { if (savedPop && !savedPop.hidden) drawSaved(); });
      document.addEventListener('obelum:prefs', () => { if (savedPop && !savedPop.hidden) drawSaved(); });
    }
    drawSaved().then(() => {
      savedPop.hidden = false; document.documentElement.classList.add('btsaved-open');
      requestAnimationFrame(() => savedPop.classList.add('is-in'));
      const x = $('.btsaved__x', savedPop); if (x) x.focus({ preventScroll: true });
    });
  }
  function drawSaved() {
    const s = S();
    return s.loadData().then((d) => {
      const ids = [...(s.saved || [])];
      const list = ids.map((id) => d.projects.find((p) => String(p.id) === String(id))).filter(Boolean).reverse(); // newest saved first
      const n = list.length;
      $('[data-saved-n]', savedPop).textContent = n ? `(${n})` : '';
      savedPop.style.setProperty('--cols', String(Math.max(1, Math.min(4, n))));
      $('[data-saved-grid]', savedPop).innerHTML = n ? list.map((p) => s.plate(p)).join('') : '<p class="btsaved__empty">Nothing saved yet. Tap ♡ on a project to save it.</p>';
      const sh = $('[data-saved-share]', savedPop);
      if (n) { const u = new URL(location.pathname, location.origin); u.searchParams.set('view', 'map'); u.searchParams.set('ids', ids.join('.')); sh.dataset.shareUrl = u.href; sh.dataset.shareTitle = `My property shortlist (${n} ${n === 1 ? 'project' : 'projects'})`; sh.hidden = false; }
      else sh.hidden = true;
      $('[data-saved-map]', savedPop).hidden = !n;
    });
  }
  function closeSaved() {
    if (!savedPop) return;
    savedPop.classList.remove('is-in'); document.documentElement.classList.remove('btsaved-open');
    setTimeout(() => { savedPop.hidden = true; }, 220);
    const b = $('[data-bt-saved]'); if (b) b.focus({ preventScroll: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addTopBar); else addTopBar();
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
      <p>For the full experience, use a tablet or desktop.</p></div>`;
    const close = () => { tip.classList.add('is-out'); setTimeout(() => tip.remove(), 250); };
    tip.addEventListener('click', close);
    document.body.appendChild(tip);
    requestAnimationFrame(() => tip.classList.add('is-in'));
  }

  // Map top bar: an arrow left of "Property map", back to the catalogue.
  function mapBack() {
    const title = $('.mapapp .mtop__title'); if (!title || $('.mapapp .mback')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mback'; b.setAttribute('aria-label', 'Back to the catalogue'); b.title = 'Back to the catalogue';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    b.addEventListener('click', () => { show('catalogue', true); });
    title.prepend(b);
  }

  /* Catalogue search -> map: the catalogue's filters in the address (dev=sobha, loc=JVC, beds=2...) are
     handed to the map as its "ai" filter, which the map applies with the catalogue's own rule
     (its own dev/type/beds keys expect exact names from its menus, so "sobha" matched nothing). */
  const CAT_KEYS = ['loc', 'type', 'beds', 'pmin', 'pmax', 'status', 'dev', 'year', 'sold'];
  function carrySearch(u, all) {
    if (all) { // "Explore all projects on the map": every project, whatever was searched
      CAT_KEYS.concat(['q', 'area', 'dev', 'ho', 'pay', 'st', 'ids', 'saved', 'ai', 'c']).forEach((k) => u.searchParams.delete(k)); u.hash = ''; return;
    }
    const f = {}; CAT_KEYS.forEach((k) => { const v = u.searchParams.get(k); if (v !== null && v !== '') f[k] = v; });
    if (!Object.keys(f).length) return;
    CAT_KEYS.concat(['q', 'area', 'ho', 'pay', 'st', 'ids', 'saved', 'ai']).forEach((k) => u.searchParams.delete(k));
    u.searchParams.set('ai', new URLSearchParams(f).toString());
    u.hash = '';
  }
  let mapLoaded = false, catUrl = '';

  function show(view, push, all) {
    const toMap = view === 'map', fromCat = !document.body.classList.contains('bt-map');
    sw.classList.toggle('is-on', !toMap);
    sw.setAttribute('aria-checked', String(!toMap));
    if (nameEl) nameEl.textContent = toMap ? 'Map' : 'Catalogue';
    if (slot.parentNode && introDone && !slot.classList.contains('is-leaving')) setOpen(true);
    document.body.classList.toggle('bt-map', toMap);
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
      // Back to the catalogue: its own address as it was (with its search), not the map's.
      const u = new URL(!toMap && catUrl ? catUrl : location.href);
      if (toMap) { if (fromCat) catUrl = location.href; u.searchParams.set('view', 'map'); carrySearch(u, all); } else u.searchParams.delete('view');
      history.pushState({ view }, '', u);
      if (toMap && mapLoaded) document.dispatchEvent(new CustomEvent('obelum:map-url')); // the map re-reads the address
    }
    if (!toMap) { document.documentElement.classList.remove('bt-early-map'); window.dispatchEvent(new Event('resize')); }
  }

  sw.addEventListener('click', () => show(document.body.classList.contains('bt-map') ? 'catalogue' : 'map', true));
  addEventListener('popstate', () => show(new URLSearchParams(location.search).get('view') === 'map' ? 'map' : 'catalogue', false));
  show(new URLSearchParams(location.search).get('view') === 'map' ? 'map' : 'catalogue', false);
})();
