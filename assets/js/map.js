/* Obelum property map (map.html).
 *
 * A full-screen satellite map of every project in data/projects.json, with a filter bar on top:
 * Search, District, Developer, Price, Payments, Handover, Unit type, Bedrooms and Status.
 * Filters apply as soon as they change and are kept in the address, so a filtered map can be
 * shared as a link. Clicking a project opens the same project pop-up as the search
 * (assets/js/property-search.js, window.ObelumSearch.openModal).
 *
 * Data: data/projects.json (projects), data/payments.json (payment-plan summary, from
 * tools/build_payments.py), data/developers.json (developer logos for the markers).
 */
(() => {
  const S = () => window.ObelumSearch || {};
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const money = (v) => (v >= 1e6 ? `${parseFloat((v / 1e6).toFixed(2))}M` : `${Math.round(v / 1e3)}K`);
  const IMG = (u, w, h) => (S().IMG ? S().IMG(u, w, h) : u);

  const TYPE_LABEL = { Apartments: 'Apartment' };
  const STATUS_ORDER = ['On Sale', 'Presale (EOI)', 'Start of Sales', 'Announced', 'Out of Stock'];
  const STATUS_LABEL = { 'Out of Stock': 'Sold out' };
  const PRICE_STEPS = [500000, 750000, 1000000, 1500000, 2000000, 3000000, 4000000, 6000000, 8000000, 10000000, 15000000, 20000000, 30000000, 50000000, 100000000];
  const PAY_OPTS = [
    ['post', 'Post-handover payment plan'],
    ['b10', 'Down payment 10% or less'],
    ['b20', 'Down payment 20% or less'],
    ['h50', '50% or less paid by handover'],
  ];

  // Filter state. Sets for the multi-choice menus.
  const F = { c: 'United Arab Emirates', saved: false, ids: new Set(), q: '', area: new Set(), dev: new Set(), pmin: 0, pmax: 0, pay: new Set(), ho: new Set(), type: new Set(), beds: new Set(), st: new Set() };
  const DEFAULT_ST = ['On Sale', 'Presale (EOI)', 'Start of Sales', 'Announced'];

  let data = [], pay = {}, cards = {}, logos = {}, map, cluster, markers = new Map(), listOpen = false;

  /* ------------------------------------------------------------ URL <-> filters */
  const LIST_KEYS = ['area', 'dev', 'pay', 'ho', 'type', 'beds', 'st'];
  function readURL() {
    const p = new URLSearchParams(location.search);
    F.q = p.get('q') || '';
    F.c = p.get('c') || 'United Arab Emirates'; F.saved = p.get('saved') === '1';
    // A shared selection: ?ids=12.345.678 shows only those projects (from someone's saved list).
    F.ids = new Set((p.get('ids') || '').split('.').filter((x) => /^\d+$/.test(x)).slice(0, 200));
    F.pmin = +p.get('pmin') || 0; F.pmax = +p.get('pmax') || 0;
    LIST_KEYS.forEach((k) => { F[k] = new Set((p.get(k) || '').split('|').filter(Boolean)); });
    if (!p.has('st')) F.st = new Set(DEFAULT_ST);
    F.ai = null; F.aiLabel = '';
    if (p.get('ai')) { try { const a = new URLSearchParams(p.get('ai')); const f = {}; a.forEach((v, k) => { if (k !== 'label') f[k] = v; }); if (Object.keys(f).length) { F.ai = f; F.aiLabel = a.get('label') || ''; } } catch (e) {} }
  }
  function writeURL() {
    const p = new URLSearchParams();
    const view = new URLSearchParams(location.search).get('view'); if (view) p.set('view', view); // Buy page (map view)
    if (F.q) p.set('q', F.q);
    if (F.ai) { const a = new URLSearchParams(F.ai); if (F.aiLabel) a.set('label', F.aiLabel); p.set('ai', a.toString()); }
    if (F.c !== 'United Arab Emirates') p.set('c', F.c);
    if (F.saved) p.set('saved', '1');
    if (F.ids.size) p.set('ids', [...F.ids].join('.'));
    if (F.pmin) p.set('pmin', F.pmin);
    if (F.pmax) p.set('pmax', F.pmax);
    LIST_KEYS.forEach((k) => {
      if (k === 'st' && sameSet(F.st, DEFAULT_ST)) return;
      if (F[k].size || k === 'st') p.set(k, [...F[k]].join('|'));
    });
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + (/^#project-/.test(location.hash) ? location.hash : ''));
  }
  const sameSet = (a, arr) => a.size === arr.length && arr.every((x) => a.has(x));

  /* ---------------------------------------------------------------- matching */
  // Country of a project: from its region, else from where its pin is (148 projects have no region).
  const UAE_R = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras al-Khaimah', 'Umm al-Quwain', 'Fujairah'];
  const REGION_COUNTRY = {
    Bali: 'Indonesia', Badung: 'Indonesia', 'East Nusa Tenggara': 'Indonesia', 'Muscat Governorate': 'Oman', 'Dhofar Governorate': 'Oman',
    'Riyadh Region': 'Saudi Arabia', 'Makkah Region': 'Saudi Arabia', England: 'United Kingdom', 'Marmara Region': 'Türkiye',
    Cairo: 'Egypt', Matruh: 'Egypt', 'Aj Jiza': 'Egypt', 'Nairobi County': 'Kenya', 'Tashkent Region': 'Uzbekistan',
    'Baghdad Governorate': 'Iraq', Andalusia: 'Spain', 'Al-Daayen': 'Qatar', 'Malé Atoll': 'Maldives', 'Rif Dimashq Governorate': 'Syria',
    Uri: 'Switzerland', 'Autonomous Republic of Adjara': 'Georgia', Amman: 'Jordan', Florida: 'United States', 'Addis Ababa': 'Ethiopia',
    Punjab: 'Pakistan', 'Lagos State': 'Nigeria', 'Federal Capital Territory': 'Nigeria', "Provence-Alpes-Côte d'Azur": 'France',
    'Bengo Province': 'Angola', 'Central Region': 'Uganda',
  };
  const BOXES = [ // [country, latMin, latMax, lonMin, lonMax] for pins without a region
    ['United Arab Emirates', 22.5, 26.3, 51.5, 56.5], ['Thailand', 5.5, 20.5, 97, 106], ['Azerbaijan', 38, 42, 44.8, 51],
    ['Georgia', 41, 43.6, 39.9, 46.8], ['Rwanda', -3, -1, 28.8, 31], ['Indonesia', -11, 6, 95, 141], ['Oman', 16.5, 26.5, 52, 60],
  ];
  function countryOf(p) {
    if (p._c) return p._c;
    if (p.r) return (p._c = UAE_R.includes(p.r) ? 'United Arab Emirates' : REGION_COUNTRY[p.r] || 'Other countries');
    const b = BOXES.find(([, a, z, w, e]) => p.la >= a && p.la <= z && p.lo >= w && p.lo <= e);
    return (p._c = b ? b[0] : 'Other countries');
  }
  const hoKey = (p) => (p.st === 'ready' ? 'ready' : p.y ? (p.y >= 2031 ? '2031+' : String(p.y)) : 'tba');
  function test(p, skip) {
    // Saved / shared selection: show exactly those projects, whatever the other filters say.
    if (F.saved) return !!(S().isSaved && S().isSaved(p.id));
    if (F.ids.size) return F.ids.has(String(p.id));
    // A sentence from the AI search bar: the very same rule as the catalogue's search (Home and Buy).
    if (F.ai && S().matches && !S().matches(p, F.ai)) return false;
    if (skip !== 'c' && F.c !== 'All' && countryOf(p) !== F.c) return false;
    if (skip !== 'st' && F.st.size && !F.st.has(p.ss)) return false;
    if (skip !== 'area' && F.area.size && !F.area.has(p.a || p.r)) return false;
    if (skip !== 'dev' && F.dev.size && !F.dev.has(p.dv)) return false;
    if (skip !== 'type' && F.type.size && !p.t.some((t) => F.type.has(t))) return false;
    if (skip !== 'ho' && F.ho.size && !F.ho.has(hoKey(p))) return false;
    if (skip !== 'beds' && F.beds.size) {
      if (p.b1 === null || p.b2 === null) return false;
      if (![...F.beds].some((b) => (+b >= 5 ? p.b2 >= 5 : +b >= p.b1 && +b <= p.b2))) return false;
    }
    if (skip !== 'price') {
      if (F.pmax && !(p.p1 && p.p1 <= F.pmax)) return false;
      if (F.pmin && !((p.p2 || p.p1) && (p.p2 || p.p1) >= F.pmin)) return false;
    }
    if (skip !== 'pay' && F.pay.size) {
      const v = pay[p.id]; if (!v) return false;
      if (F.pay.has('post') && !v[0]) return false;
      if (F.pay.has('b10') && !(v[1] != null && v[1] <= 10)) return false;
      if (F.pay.has('b20') && !(v[1] != null && v[1] <= 20)) return false;
      if (F.pay.has('h50') && !(v[2] != null && v[2] <= 50)) return false;
    }
    if (F.q) {
      const hay = norm(`${p.n} ${p.dv} ${p.a} ${p.r}`);
      if (!norm(F.q).split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }

  /* ----------------------------------------------------------------- markers */
  // Every pin is a round thumbnail of the project's own photo; the developer logo is only a
  // fallback for the few projects without a photo (white logos sit on anthracite, others on white).
  function pinHTML(p) {
    const logo = logos[p.dv], own = logo && /assets\/img\/devs\//.test(logo);
    const inner = p.img
      ? `<img src="${esc(IMG(p.img, 120, 120))}" alt="" decoding="async" data-full="${esc(p.img)}">`
      : logo ? `<img class="mpin__logo" src="${esc(logo)}" alt="" decoding="async">`
        : `<b>${esc((p.dv || p.n || '?').trim().charAt(0))}</b>`;
    const cls = !p.img && logo ? (own ? ' mpin--logo mpin--logo-dark' : ' mpin--logo') : '';
    return `<span class="mpin${p.ss === 'Out of Stock' ? ' mpin--sold' : ''}${cls}">${inner}</span>`;
  }
  // If the image service is slow or blocked (Brave Shields), switch the pin to the original photo.
  const pinGuard = (m) => {
    const img = m.getElement && m.getElement() && m.getElement().querySelector('img[data-full]');
    if (!img || img.src === img.dataset.full) return;
    setTimeout(() => { if (img.isConnected && !(img.complete && img.naturalWidth)) img.src = img.dataset.full; }, 4000);
  };

  const priceTxt = (v) => (S().money ? S().money(v) : 'AED ' + money(v));
  const tipHTML = (p) => `<strong>${esc(p.n)}</strong><br>${esc(p.dv || '')}${p.p1 ? ' · from ' + priceTxt(p.p1) : ''}`;
  function buildTips() { data.forEach((p) => { const m = markers.get(p.id); if (m) m.setTooltipContent(tipHTML(p)); }); }

  function buildMarkers() {
    data.forEach((p) => {
      if (p.la == null || p.lo == null) return;
      const m = L.marker([p.la, p.lo], {
        icon: L.divIcon({ className: 'mpin-wrap', html: pinHTML(p), iconSize: [44, 44], iconAnchor: [22, 22] }),
        title: p.n, riseOnHover: true,
      });
      m.bindTooltip(tipHTML(p), { direction: 'top', offset: [0, -22], className: 'mtip' });
      m.on('click', () => open(p));
      m.on('add', () => pinGuard(m));
      markers.set(p.id, m);
    });
  }

  function open(p) { if (S().openModal) S().openModal(p); }
  let lastTap = { id: 0, t: 0 };

  let focusId = null;
  function markFocus() {
    document.querySelectorAll('.mcard.is-focus').forEach((c) => c.classList.remove('is-focus'));
    document.querySelectorAll('.mpin.is-focus').forEach((x) => x.classList.remove('is-focus'));
    if (focusId == null) return;
    const c = document.querySelector(`.mcard[data-id="${focusId}"]`); if (c) c.classList.add('is-focus');
    const m = markers.get(focusId), el = m && m.getElement && m.getElement(); if (el) el.querySelector('.mpin').classList.add('is-focus');
  }
  // The list floats over the right of the map (desktop): keep what matters in the visible part.
  const listPad = () => (listOpen && matchMedia('(min-width: 52.01rem)').matches ? ($('.mlist') || {}).offsetWidth || 0 : 0);
  // Travel to a project: one smooth flight (out a little, across, and in), its length set by the
  // distance - about 1 s next door, up to 2.2 s across the city. Then the pin is shown and lit.
  function focusProject(p) {
    focusId = p.id;
    const m = markers.get(p.id);
    const to = L.latLng(p.la, p.lo), from = map.getCenter();
    const km = from.distanceTo(to) / 1000;
    const zoom = Math.max(map.getZoom(), 16);
    const duration = Math.min(2.2, Math.max(0.9, 0.9 + Math.log10(1 + km) * 0.75));
    map.stop();
    const pad = listPad(); const aim = pad ? map.unproject(map.project(to, zoom).add([pad / 2, 0]), zoom) : to;
    map.flyTo(aim, zoom, { duration, easeLinearity: 0.2 });
    map.once('moveend', () => {
      const show = () => { markFocus(); if (m && m.openTooltip) m.openTooltip(); };
      // Still inside a cluster at this zoom (very close neighbours): open it gently.
      if (m && cluster.hasLayer(m) && !m.getElement()) cluster.zoomToShowLayer(m, show); else show();
    });
    markFocus();
  }

  // Where most of the chosen projects are: the pins within 35 km of their median point, when that
  // holds at least 60% of them. Keeps one far-away project (RAK, London...) from zooming the map out.
  function coreBounds(list) {
    if (list.length < 3) return null;
    const med = (a) => { const v = a.slice().sort((x, y) => x - y); return v[v.length >> 1]; };
    const c = L.latLng(med(list.map((p) => p.la)), med(list.map((p) => p.lo)));
    const near = list.filter((p) => c.distanceTo([p.la, p.lo]) < 35000);
    return near.length >= list.length * 0.6 ? L.latLngBounds(near.map((p) => [p.la, p.lo])) : null;
  }

  let first = true, totalShown = 0;
  function apply(fit) {
    // "Saved" with nothing saved (e.g. an old ?saved=1 link): show every project instead of an empty map.
    if (F.saved && !(S().saved && S().saved.size)) { F.saved = false; fit = true; }
    const list = data.filter((p) => test(p));
    totalShown = list.length;
    cluster.clearLayers();
    cluster.addLayers(list.map((p) => markers.get(p.id)).filter(Boolean));
    $('[data-map-count]').textContent = `${list.length.toLocaleString()} ${list.length === 1 ? 'project' : 'projects'}`;
    $('[data-map-empty]').hidden = list.length > 0 || F.saved || F.ids.size > 0;
    renderChips();
    writeURL();
    if ((fit || first) && list.length) {
      const b = L.latLngBounds(list.map((p) => [p.la, p.lo]));
      // With no place filter in the UAE, show Dubai rather than the whole world (also after a district is unticked).
      if (!F.area.size && !F.q && !F.dev.size && !F.saved && !F.ids.size && F.c === 'United Arab Emirates') map.setView([25.13, 55.25], 11);
      else map.fitBounds(coreBounds(list) || b, { paddingTopLeft: [60, 60], paddingBottomRight: [60 + listPad(), 60], maxZoom: 15 });
    }
    first = false;
    renderList();
  }

  /* -------------------------------------------------------------- filter bar */
  // Each menu: chip label, how to summarise the current choice, and how to draw its panel.
  const MENUS = {
    area: { label: 'Districts', panel: () => checklist('area', options((p) => p.a || p.r, 'area', true).sort((a, b) => a.l.localeCompare(b.l)), true) },
    dev: { label: 'Developers', panel: () => checklist('dev', topThenAlpha(options((p) => p.dv, 'dev', true).filter((o) => o.n > 0 || F.dev.has(o.v)), 15), true, true) },
    price: { label: 'Price', panel: pricePanel },
    pay: { label: 'Payments', panel: () => checklist('pay', PAY_OPTS.map(([k, l]) => ({ v: k, l, n: countWith('pay', k) }))) },
    ho: { label: 'Handover', panel: () => checklist('ho', handoverOptions()) },
    type: { label: 'Unit type', panel: () => checklist('type', options((p) => p.t, 'type').map((o) => ({ ...o, l: TYPE_LABEL[o.v] || o.v }))) },
    beds: { label: 'Bedrooms', panel: bedsPanel },
    st: { label: 'Status', panel: () => checklist('st', STATUS_ORDER.map((s) => ({ v: s, l: STATUS_LABEL[s] || s, n: countWith('st', s) }))) },
    cur: { label: 'Currency', top: true, panel: currencyPanel },
  };
  const CURRENCIES = [['AED', 'UAE dirham'], ['USD', 'US dollar'], ['EUR', 'Euro'], ['GBP', 'British pound'], ['RUB', 'Russian rouble'], ['CNY', 'Chinese yuan'], ['INR', 'Indian rupee'], ['SAR', 'Saudi riyal']];
  function radioPanel(items, current, onPick, note) {
    const box = document.createElement('div');
    box.className = 'mpanel__body';
    box.innerHTML = `<ul class="mcheck mradio" role="listbox">${items.map((o) => `<li><label class="${o.n === 0 ? 'is-zero' : ''}">
        <input type="radio" name="mradio" value="${esc(o.v)}"${o.v === current ? ' checked' : ''}>
        ${o.flag ? `<i class="mflag" aria-hidden="true">${o.flag}</i>` : ''}<span>${esc(o.l)}</span>${o.n != null ? `<em>${o.n.toLocaleString()}</em>` : o.sub ? `<em>${esc(o.sub)}</em>` : ''}</label></li>`).join('')}</ul>
      ${note ? `<p class="mpanel__note">${note}</p>` : ''}
      <div class="mpanel__foot"><span></span><button type="button" class="is-main" data-close-panel>Done</button></div>`;
    box.addEventListener('change', (e) => { const r = e.target.closest('input[type=radio]'); if (r) onPick(r.value); });
    return box;
  }
  function currencyPanel() {
    const items = CURRENCIES.map(([v, l]) => ({ v, l: `${v} · ${l}`, sub: v === 'AED' ? 'Developer price' : v === 'USD' ? 'Fixed peg' : 'Daily rate' }));
    return radioPanel(items, S().prefs ? S().prefs.cur : 'AED', (v) => {
      const go = () => { S().setPref('cur', v); renderTop(); renderList(); buildTips(); };
      if (v === 'AED' || v === 'USD') go(); else S().loadRates().then(go);
    }, 'Prices are set by developers in AED. Other currencies are converted for guidance only.');
  }

  // The N with the most projects first, then everything else A–Z (a thin line marks the split).
  function topThenAlpha(opts, n) {
    const top = opts.slice(0, n), rest = opts.slice(n).sort((a, b) => a.l.localeCompare(b.l));
    if (rest.length) rest[0] = { ...rest[0], first: true };
    return [...top, ...rest];
  }
  // Options with live counts: how many projects each choice would show given the other filters.
  function options(get, key, full) {
    const c = new Map();
    // full: list every value in the whole catalogue (all countries, sold out too); counts still follow the filters.
    if (full) data.forEach((p) => [].concat(get(p) || []).forEach((v) => { if (v && !c.has(v)) c.set(v, 0); }));
    data.forEach((p) => {
      if (!test(p, key)) return;
      [].concat(get(p) || []).forEach((v) => { if (v) c.set(v, (c.get(v) || 0) + 1); });
    });
    F[key].forEach((v) => { if (!c.has(v)) c.set(v, 0); });
    return [...c].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(b[0])).map(([v, n]) => ({ v, l: v, n }));
  }
  function countWith(key, val) {
    const saved = F[key]; F[key] = new Set([val]);
    const n = data.reduce((s, p) => s + (test(p) ? 1 : 0), 0);
    F[key] = saved; return n;
  }
  function handoverOptions() {
    const c = new Map();
    data.forEach((p) => { if (test(p, 'ho')) { const k = hoKey(p); c.set(k, (c.get(k) || 0) + 1); } });
    const keys = ['ready', ...[...c.keys()].filter((k) => /^\d/.test(k)).sort(), 'tba'];
    return keys.filter((k) => c.has(k) || F.ho.has(k)).map((k) => ({
      v: k, n: c.get(k) || 0,
      l: k === 'ready' ? 'Ready / completed' : k === 'tba' ? 'Date to be announced' : k === '2031+' ? '2031 and later' : `Handover ${k}`,
    }));
  }

  const lastTick = {}; // the option last ticked/unticked in each menu, to reopen the menu there
  function checklist(key, opts, searchable, withLogo) {
    const box = document.createElement('div');
    box.className = 'mpanel__body';
    box.innerHTML = `
      ${searchable ? `<input class="mpanel__find" type="search" placeholder="Search ${esc(MENUS[key].label.toLowerCase())}…" aria-label="Search">` : ''}
      <ul class="mcheck" role="listbox" aria-multiselectable="true">
        ${opts.map((o) => `<li${o.first ? ' class="mcheck__split"' : ''}><label class="${o.n ? '' : 'is-zero'}">
          <input type="checkbox" value="${esc(o.v)}"${F[key].has(o.v) ? ' checked' : ''}>
          ${withLogo && logos[o.v] ? `<img class="mcheck__logo${/assets\/img\/devs\//.test(logos[o.v]) ? ' mcheck__logo--dark' : ''}" src="${esc(logos[o.v])}" alt="" loading="lazy">` : ''}
          <span>${esc(o.l)}</span><em>${o.n.toLocaleString()}</em></label></li>`).join('')}
      </ul>
      <div class="mpanel__foot"><button type="button" data-clear="${key}">Clear</button><button type="button" class="is-main" data-close-panel>Done</button></div>`;
    box.addEventListener('change', (e) => {
      const cb = e.target.closest('input[type=checkbox]'); if (!cb) return;
      if (cb.checked) F[key].add(cb.value); else F[key].delete(cb.value);
      lastTick[key] = cb.value;
      // Ticking a district or developer with nothing under the current filters (another country, or
      // only sold-out projects): widen the country and status so its projects appear.
      if (cb.checked && (key === 'area' || key === 'dev') && cb.closest('label').classList.contains('is-zero')) {
        F.c = 'All'; F.st = new Set(STATUS_ORDER);
      }
      // No district or developer chosen any more: back to UAE projects.
      if (!F.area.size && !F.dev.size) F.c = 'United Arab Emirates';
      apply(key === 'area' || key === 'dev');
      refreshPanel();
    });
    const find = box.querySelector('.mpanel__find');
    if (find) find.addEventListener('input', () => {
      const t = norm(find.value);
      box.querySelectorAll('.mcheck li').forEach((li) => { li.hidden = t && !norm(li.textContent).includes(t); });
    });
    return box;
  }

  function pricePanel() {
    const box = document.createElement('div');
    box.className = 'mpanel__body';
    const opt = (v, sel) => `<option value="${v}"${+sel === v ? ' selected' : ''}>${v ? 'AED ' + money(v) : 'Any'}</option>`;
    box.innerHTML = `
      <div class="mprice">
        <label><span>Min price</span><select data-p="pmin">${[0, ...PRICE_STEPS].map((v) => opt(v, F.pmin)).join('')}</select></label>
        <label><span>Max price</span><select data-p="pmax">${[0, ...PRICE_STEPS].map((v) => opt(v, F.pmax)).join('')}</select></label>
      </div>
      <div class="mquick">${[[0, 1e6, 'Under 1M'], [1e6, 2e6, '1M – 2M'], [2e6, 4e6, '2M – 4M'], [4e6, 8e6, '4M – 8M'], [1e7, 0, '10M+'], [3e7, 0, '30M+'], [5e7, 0, '50M+'], [1e8, 0, '100M+']]
        .map(([a, b, l]) => `<button type="button" data-range="${a},${b}" class="${F.pmin === a && F.pmax === b ? 'is-on' : ''}">${l}</button>`).join('')}</div>
      <p class="mpanel__note">Developer starting prices. A project shows if any of its units fits the range.</p>
      <div class="mpanel__foot"><button type="button" data-clear="price">Clear</button><button type="button" class="is-main" data-close-panel>Done</button></div>`;
    box.addEventListener('change', (e) => { const s = e.target.closest('[data-p]'); if (!s) return; F[s.dataset.p] = +s.value; apply(); refreshPanel(); });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-range]'); if (!b) return;
      const [a, z] = b.dataset.range.split(',').map(Number); F.pmin = a; F.pmax = z; apply(); refreshPanel();
    });
    return box;
  }

  function bedsPanel() {
    const box = document.createElement('div');
    box.className = 'mpanel__body';
    const opts = [['0', 'Studio'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5+']];
    box.innerHTML = `
      <div class="mbeds">${opts.map(([v, l]) => `<button type="button" data-bed="${v}" class="${F.beds.has(v) ? 'is-on' : ''}" aria-pressed="${F.beds.has(v)}">${l}</button>`).join('')}</div>
      <p class="mpanel__note">Choose one or more. Offices and shops have no bedrooms and are hidden while this is set.</p>
      <div class="mpanel__foot"><button type="button" data-clear="beds">Clear</button><button type="button" class="is-main" data-close-panel>Done</button></div>`;
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-bed]'); if (!b) return;
      F.beds.has(b.dataset.bed) ? F.beds.delete(b.dataset.bed) : F.beds.add(b.dataset.bed);
      apply(); refreshPanel();
    });
    return box;
  }

  function summary(key) {
    if (key === 'price') {
      if (!F.pmin && !F.pmax) return '';
      return F.pmin && F.pmax ? `${money(F.pmin)} – ${money(F.pmax)}` : F.pmin ? `${money(F.pmin)}+` : `Up to ${money(F.pmax)}`;
    }
    if (key === 'st' && sameSet(F.st, DEFAULT_ST)) return '';
    const s = F[key]; if (!s || !s.size) return '';
    if (s.size > 1) return String(s.size);
    const v = [...s][0];
    if (key === 'beds') return v === '0' ? 'Studio' : v === '5' ? '5+ bed' : `${v} bed`;
    if (key === 'ho') return v === 'ready' ? 'Ready' : v === 'tba' ? 'TBA' : v;
    if (key === 'pay') return (PAY_OPTS.find((o) => o[0] === v) || [, v])[1].replace(' payment plan', '').replace('Down payment ', '').replace(' or less', '');
    if (key === 'type') return TYPE_LABEL[v] || v;
    if (key === 'st') return STATUS_LABEL[v] || v;
    return v;
  }

  function renderTop() {
    const cu = $('[data-top-cur]'); if (cu) cu.textContent = S().curNow ? S().curNow() : 'AED';
    const u = $('[data-top-unit-label]'); if (u) u.innerHTML = S().prefs && S().prefs.unit === 'm2' ? 'm<sup>2</sup>' : 'sq ft';
    const sv = $('[data-top-saved]'); if (sv) { const n = S().saved ? S().saved.size : 0; sv.classList.toggle('is-on', F.saved); sv.setAttribute('aria-pressed', String(F.saved)); sv.querySelector('em').textContent = n ? n : ''; }
    const ls = $('[data-top-list]'); if (ls) { ls.classList.toggle('is-on', listOpen); ls.setAttribute('aria-checked', String(listOpen)); const nm = $('[data-view-name]', ls); if (nm) nm.textContent = listOpen ? 'Catalogue' : 'Map'; }
    // Share: with saved projects it shares that list (a link that opens just those on the map);
    // with nothing saved it shares the map as it is.
    const sh = $('.mtop [data-share]');
    if (sh) {
      const ids = S().saved ? [...S().saved] : [];
      const lbl = sh.querySelector('span');
      if (ids.length) {
        const u = new URL(location.pathname, location.origin); u.searchParams.set('ids', ids.join('.'));
        const view = new URLSearchParams(location.search).get('view'); if (view) u.searchParams.set('view', view);
        sh.dataset.shareUrl = u.href;
        sh.dataset.shareTitle = `My property shortlist (${ids.length} ${ids.length === 1 ? 'project' : 'projects'})`;
        if (lbl) lbl.textContent = `Share saved (${ids.length})`;
      } else {
        delete sh.dataset.shareUrl; sh.dataset.shareTitle = 'Dubai off-plan map';
        if (lbl) lbl.textContent = 'Share';
      }
    }
    const tag = $('[data-shared-tag]');
    if (tag) { tag.hidden = !F.ids.size; const n = tag.querySelector('b'); if (n) n.textContent = F.ids.size; }
  }
  function renderChips() {
    renderTop();
    document.querySelectorAll('.mbar__chips [data-menu]').forEach((b) => {
      const k = b.dataset.menu, s = summary(k);
      b.classList.toggle('is-active', !!s);
      b.querySelector('span').textContent = s ? `${MENUS[k].label}: ${s}` : MENUS[k].label;
      // District and Developer show how many there are in the whole catalogue.
      if (k === 'area' || k === 'dev') {
        let n = b.querySelector('.mchip__n');
        if (!n) { n = document.createElement('b'); n.className = 'mchip__n'; b.appendChild(n); }
        const get = k === 'area' ? (p) => p.a || p.r : (p) => p.dv;
        const seen = new Set(); data.forEach((p) => { const v = get(p); if (v) seen.add(v); }); // whole catalogue
        n.textContent = seen.size.toLocaleString(); n.hidden = !!s || !seen.size;
      }
    });
    const any = F.ai || F.q || F.pmin || F.pmax || LIST_KEYS.some((k) => (k === 'st' ? !sameSet(F.st, DEFAULT_ST) : F[k].size));
    $('[data-map-reset]').hidden = !any;
  }

  /* ------------------------------------------------------------ panel popover */
  let openKey = null;
  const panel = () => $('[data-map-panel]');
  function showPanel(key, btn) {
    if (openKey === key) return hidePanel();
    openKey = key;
    const pn = panel();
    pn.innerHTML = `<div class="mpanel__head"><strong>${esc(MENUS[key].label)}</strong><button type="button" data-close-panel aria-label="Close">×</button></div>`;
    pn.appendChild(MENUS[key].panel());
    pn.hidden = false;
    document.querySelectorAll('[data-menu]').forEach((b) => b.setAttribute('aria-expanded', String(b === btn)));
    // Desktop: drop the panel under its chip. Phones: a bottom sheet (CSS).
    const r = btn.getBoundingClientRect(), host = $('.mapapp').getBoundingClientRect();
    pn.style.top = `${r.bottom - host.top + 8}px`;
    // Use the room left below the button, so the list never shrinks to one row on short screens.
    if (matchMedia('(min-width: 52.01rem)').matches) pn.style.maxHeight = `${Math.max(260, Math.min(560, host.bottom - r.bottom - 20))}px`;
    else pn.style.maxHeight = '';
    pn.style.left = `${Math.max(8, Math.min(r.left - host.left, host.width - pn.offsetWidth - 8))}px`;
    const f = pn.querySelector('.mpanel__find'); if (f && matchMedia('(hover: hover)').matches) f.focus({ preventScroll: true });
    // Reopened with choices already ticked: start the list at the first ticked one, not at the top.
    const ul = pn.querySelector('.mcheck');
    const last = ul && lastTick[key] != null && [...ul.querySelectorAll('input')].find((i) => i.value === lastTick[key]);
    const on = ul && (last || ul.querySelector('input:checked'));
    if (on && ul.scrollHeight > ul.clientHeight) {
      const li = on.closest('li'); ul.scrollTop = Math.max(0, li.offsetTop - ul.offsetTop - ul.clientHeight / 2 + li.offsetHeight / 2);
    }
  }
  function refreshPanel() {
    if (!openKey) return;
    const pn = panel(), old = pn.querySelector('.mpanel__body'), scroll = old && (old.querySelector('.mcheck') || old).scrollTop;
    const find = old && old.querySelector('.mpanel__find'), term = find && find.value;
    const fresh = MENUS[openKey].panel(); old.replaceWith(fresh);
    const f2 = fresh.querySelector('.mpanel__find'); if (f2 && term) { f2.value = term; f2.dispatchEvent(new Event('input')); }
    const list = fresh.querySelector('.mcheck') || fresh; list.scrollTop = scroll || 0;
  }
  function hidePanel() {
    openKey = null; panel().hidden = true;
    document.querySelectorAll('[data-menu]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }

  // Side-list card (Reelly-style): photo with status + handover pills, developer logo, name,
  // "District · by Developer", then "Price from" and "Payment plan".
  const SS_LABEL = { 'Presale (EOI)': 'EOI', 'Out of Stock': 'Sold out' };
  function cardHTML(p) {
    const logo = logos[p.dv], own = logo && /assets\/img\/devs\//.test(logo);
    const extra = cards[p.id] || [];
    const ho = p.st === 'ready' ? 'Ready' : extra[0] || (p.y ? String(p.y) : 'TBA');
    const v = pay[p.id], split = v && v[3] ? (v[3] === '100/0' ? '100%' : `${v[3]}%`) : null;
    const price = p.p1 ? (S().moneyFull ? S().moneyFull(p.p1) : `AED ${Math.round(p.p1).toLocaleString('en-US')}`) : 'On request';
    const on = S().isSaved && S().isSaved(p.id);
    return `
      <button type="button" class="mcard${p.ss === 'Out of Stock' ? ' mcard--sold' : ''}" data-id="${p.id}">
        <span class="mcard__img">
          ${p.img ? `<img src="${esc(IMG(p.img, 480, 300))}" data-full="${esc(p.img)}" alt="" loading="lazy" decoding="async">` : ''}
          <span class="mcard__save${on ? ' is-on' : ''}" data-save="${p.id}" role="button" tabindex="0" aria-pressed="${!!on}" aria-label="Save ${esc(p.n)}">${S().HEART_SVG || '♥'}</span>
          <span class="mcard__pills"><i>${esc(SS_LABEL[p.ss] || p.ss || '')}</i><i>${esc(ho)}</i></span>
          ${logo ? `<span class="mcard__logo${own ? ' mcard__logo--dark' : ''}"><img src="${esc(logo)}" alt="" loading="lazy" decoding="async"></span>` : ''}
        </span>
        <span class="mcard__txt">
          <b>${esc(p.n)}</b>
          <small>${esc([p.a || p.r, p.dv ? 'by ' + p.dv : ''].filter(Boolean).join(' \u2022 '))}</small>
          <span class="mcard__nums">
            <span><small>Price from</small><strong>${esc(price)}</strong></span>
            ${split ? `<span class="mcard__plan"><small>Payment plan</small><strong>${esc(split)}${extra[1] ? `<i class="mcard__info" role="button" tabindex="0" data-tip="${esc(extra[1])}" aria-label="Payment plan: ${esc(extra[1])}"><svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 9v4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="6.4" r="1" fill="currentColor"/></svg></i>` : ''}</strong></span>` : ''}
          </span>
        </span>
      </button>`;
  }

  /* ---------------------------------------------------------------- the list */
  // Projects inside the visible part of the map, newest first.
  function renderList() {
    const el = $('[data-map-list]'); if (!listOpen || !el) return;
    const b = map.getBounds();
    // Saved / shared: the list holds the whole selection and does not change as the map moves.
    const fixed = F.saved || F.ids.size > 0;
    const inView = data.filter((p) => test(p) && (fixed || b.contains([p.la, p.lo]))).sort((a, z) => (!fixed && ((z.id === focusId) - (a.id === focusId))) || z.id - a.id);
    const shown = inView.slice(0, 60);
    const sig = (fixed ? 'f:' : 'v:') + shown.map((p) => p.id).join('.') + ':' + (S().curNow ? S().curNow() : '');
    if (fixed && el.dataset.sig === sig) { markFocus(); return; } // same selection: keep the list (and its scroll) as it is
    el.dataset.sig = sig;
    $('[data-map-list-count]').textContent = fixed
      ? `${inView.length.toLocaleString()} ${F.saved ? 'saved' : 'shared'} ${inView.length === 1 ? 'project' : 'projects'}`
      : `${inView.length.toLocaleString()} in this area`;
    // Buy map on phones shows the whole count here too ("… of 1,258 projects"); hidden elsewhere by CSS.
    if (!fixed) { const of = document.createElement('span'); of.className = 'mlist__of'; of.textContent = ` of ${totalShown.toLocaleString()} ${totalShown === 1 ? 'project' : 'projects'}`; $('[data-map-list-count]').appendChild(of); }
    // 1–3 projects: a narrow one-card-wide list; 4 or more: the wide two-column list.
    const narrow = inView.length <= 3, app = $('.mapapp');
    if (app.classList.contains('is-narrow') !== narrow) {
      app.classList.toggle('is-narrow', narrow);
      setTimeout(() => map.invalidateSize({ pan: false }), 270); // no re-centre, so no list re-render loop
    }
    if (!fixed && focusId != null && shown[0] && shown[0].id === focusId) el.scrollTop = 0;
    el.innerHTML = shown.map(cardHTML).join('') + (inView.length > shown.length ? `<p class="mlist__more">Zoom in to see the other ${(inView.length - shown.length).toLocaleString()}.</p>` : '');
    markFocus();
    sizeList();
  }
  function toggleList(on) {
    listOpen = on ?? !listOpen;
    $('.mapapp').classList.toggle('is-list', listOpen);
    document.querySelectorAll('[data-map-list-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(listOpen)));
    renderTop();
    const tab = $('[data-map-list-tab]');
    if (tab) { tab.setAttribute('aria-expanded', String(listOpen)); tab.setAttribute('aria-label', listOpen ? 'Hide project list' : 'Show project list'); tab.querySelector('span').textContent = listOpen ? 'Hide list' : 'Show list'; }
    setTimeout(() => { map.invalidateSize(); renderList(); }, 260);
    sizeList();
  }

  /* ---------------------------------------------------------------- phones: list size and top menu */
  const phone = matchMedia('(max-width: 52rem)');
  let rows = 1; // rows of cards when the list is open on a phone: 1 (2 projects) or 2 (4 projects)
  // Height of the open list on a phone: its header plus exactly 1 or 2 rows of cards.
  function sizeList() {
    const stage = $('.mstage'), app = $('.mapapp'); if (!stage) return;
    const ctl = $('[data-map-list-ctl]'), st = listOpen ? rows : 0;
    if (ctl) {
      ctl.dataset.rows = String(st);
      const less = $('[data-rows-less] span', ctl), more = $('[data-rows-more] span', ctl);
      if (less) less.textContent = st === 2 ? 'Less' : 'Hide list';
      if (more) more.textContent = st === 0 ? 'Show list' : 'More';
    }
    app.classList.toggle('is-rows2', listOpen && rows === 2);
    if (!phone.matches || !listOpen) { stage.style.removeProperty('--mlh'); return; }
    const head = $('.mlist__head'), card = $('.mlist__body .mcard'), body = $('.mlist__body');
    const cs = body ? getComputedStyle(body) : null;
    const cardH = card ? card.offsetHeight : 250, gap = cs ? parseFloat(cs.rowGap) || 11 : 11, pad = cs ? parseFloat(cs.paddingTop) || 11 : 11;
    const want = (head ? head.offsetHeight : 46) + pad + rows * cardH + (rows - 1) * gap + pad;
    stage.style.setProperty('--mlh', Math.min(want, stage.offsetHeight - 56) + 'px');
  }
  function setRows(n) {
    if (n <= 0) { if (listOpen) toggleList(false); else sizeList(); return; }
    rows = Math.min(2, n);
    if (!listOpen) toggleList(true); else { sizeList(); setTimeout(() => map.invalidateSize({ pan: false }), 260); }
  }
  function setTop(show) {
    const app = $('.mapapp'), b = $('[data-map-top-toggle]'); if (!app) return;
    app.classList.toggle('is-topless', !show);
    if (b) { b.setAttribute('aria-expanded', String(show)); b.setAttribute('aria-label', show ? 'Hide the top menu' : 'Show the top menu'); $('span', b).textContent = show ? 'Hide menu' : 'Show menu'; }
    if (!show) hidePanel();
    setTimeout(() => { map.invalidateSize({ pan: false }); sizeList(); }, 30);
  }

  /* ---------------------------------------------------------------- AI search */
  // Turn what the search understood ({loc, dev, type, beds, pmin, pmax, status, year, sold}) into the
  // map's own filters. Returns short labels of what was applied.
  function aiLabels(f) {
    const labels = [];
    if (f.loc) labels.push(String(f.loc));
    if (f.dev) {
      const n = norm(f.dev); const d = data.find((p) => p.dv && norm(p.dv).includes(n));
      labels.push(`by ${d ? d.dv : f.dev}`);
    }
    if (f.type) labels.push(TYPE_LABEL[f.type] || f.type);
    if (f.beds !== undefined) labels.push(f.beds === '0' ? 'Studio' : `${f.beds}${f.beds === '5' ? '+' : ''} bed`);
    if (f.pmin) labels.push(`from AED ${money(+f.pmin)}`);
    if (f.pmax) labels.push(`up to AED ${money(+f.pmax)}`);
    if (f.year) labels.push(`keys by ${f.year}`);
    else if (f.status === 'ready') labels.push('Ready');
    else if (f.status === 'offplan') labels.push('Off-plan');
    return labels;
  }
  // A search handed over in the address (from the catalogue): the same rule as the catalogue, all countries.
  function adoptAI() {
    if (!F.ai) return;
    F.st = new Set(F.ai.sold ? STATUS_ORDER : DEFAULT_ST); F.c = 'All';
    if (!F.aiLabel) F.aiLabel = aiLabels(F.ai).join(' · ');
    const hint = $('[data-map-ai-hint]'); if (hint && F.aiLabel) { hint.textContent = `Searching for: ${F.aiLabel}`; hint.hidden = false; }
  }
  function applyAI(f, text) {
    const labels = [];
    F.q = ''; F.area = new Set(); F.dev = new Set(); F.type = new Set(); F.beds = new Set(); F.ho = new Set(); F.pay = new Set();
    F.pmin = 0; F.pmax = 0; F.saved = false; F.ids = new Set();
    // Statuses: the sentence decides (sold-out only when asked), as in the catalogue.
    F.st = new Set(f.sold ? STATUS_ORDER : DEFAULT_ST);
    // Every country, like the catalogue (a few developers also build abroad); the map still frames the main group.
    F.c = 'All';
    if (f.loc) labels.push(String(f.loc));
    if (f.dev) {
      const n = norm(f.dev); const d = data.find((p) => p.dv && norm(p.dv).includes(n));
      labels.push(`by ${d ? d.dv : f.dev}`);
    }
    if (f.type) labels.push(TYPE_LABEL[f.type] || f.type);
    if (f.beds !== undefined) labels.push(f.beds === '0' ? 'Studio' : `${f.beds}${f.beds === '5' ? '+' : ''} bed`);
    if (f.pmin) labels.push(`from AED ${money(+f.pmin)}`);
    if (f.pmax) labels.push(`up to AED ${money(+f.pmax)}`);
    if (f.year) labels.push(`keys by ${f.year}`);
    else if (f.status === 'ready') labels.push('Ready');
    else if (f.status === 'offplan') labels.push('Off-plan');
    if (labels.length) { F.ai = { ...f }; F.aiLabel = labels.join(' · '); } else { F.ai = null; F.aiLabel = ''; F.q = text; }
    hidePanel(); apply(true);
    return labels;
  }

  /* ------------------------------------------------------------------- start */
  function init() {
    const root = $('.mapapp'); if (!root || !window.L) return;
    readURL();

    // Two-finger rotate on phones and tablets (leaflet-rotate). A compass button appears while the map
    // is turned; tapping it points north again. On desktop: hold Shift and drag, or Shift+Alt+arrows.
    const canRotate = !!(L.Map.prototype.setBearing);
    map = L.map($('[data-map]'), Object.assign({ zoomControl: false, worldCopyJump: !canRotate, minZoom: 3 },
      canRotate ? { rotate: true, touchRotate: true, shiftKeyRotate: true, bearing: 0,
        rotateControl: { closeOnZeroBearing: true, position: 'bottomright' } } : {})).setView([25.13, 55.25], 11);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    if (map.attributionControl) map.attributionControl.setPrefix(false); // no 'Leaflet' link; the imagery credit stays (tiny, see map.css)
    const sat = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
    ]);
    sat.addTo(map); // satellite only (the street-map switch was removed 25 Nov 2026)

    cluster = L.markerClusterGroup({
      showCoverageOnHover: false, maxClusterRadius: 46, spiderfyOnMaxZoom: true, chunkedLoading: true,
      iconCreateFunction: (c) => {
        const n = c.getChildCount();
        return L.divIcon({ html: `<span>${n}</span>`, className: `mcluster${n > 99 ? ' mcluster--l' : n > 19 ? ' mcluster--m' : ''}`, iconSize: [44, 44] });
      },
    });
    map.addLayer(cluster);
    map.on('moveend', renderList);

    // Filter bar
    root.addEventListener('click', (e) => {
      const m = e.target.closest('[data-menu]'); if (m) return showPanel(m.dataset.menu, m);
      if (e.target.closest('[data-close-panel]')) return hidePanel();
      const c = e.target.closest('[data-clear]');
      if (c) {
        const k = c.dataset.clear;
        if (k === 'price') { F.pmin = 0; F.pmax = 0; } else F[k] = new Set();
        apply(); return refreshPanel();
      }
      const info = e.target.closest('.mcard__info');
      if (info) { document.querySelectorAll('.mcard__info.is-open').forEach((x) => x !== info && x.classList.remove('is-open')); info.classList.toggle('is-open'); return; }
      const card = e.target.closest('.mcard');
      if (card) {
        const p = data.find((x) => x.id === +card.dataset.id); if (!p) return;
        // One click zooms the map to the project; two quick clicks (or taps) open its details.
        const now = Date.now();
        // (The list moves the chosen project to the top, so the second tap can land on another card: open the first one.)
        if (lastTap.id && now - lastTap.t < 450) { const q = data.find((x) => x.id === lastTap.id) || p; lastTap = { id: 0, t: 0 }; return open(q); }
        lastTap = { id: p.id, t: now };
        focusProject(p, card);
      }
    });
    root.addEventListener('mouseover', (e) => {
      const card = e.target.closest('.mcard'); document.querySelectorAll('.mpin.is-hot').forEach((x) => x.classList.remove('is-hot'));
      const m = card && markers.get(+card.dataset.id); const el = m && m.getElement && m.getElement();
      if (el) el.querySelector('.mpin').classList.add('is-hot');
    });
    document.addEventListener('click', (e) => { if (openKey && e.target.isConnected && !e.target.closest('[data-map-panel], [data-menu]')) hidePanel(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openKey) hidePanel(); });

    const q = $('[data-map-q]'); q.value = F.q;
    // Typing narrows by name straight away; Enter (or the AI button) reads the whole sentence -
    // "2 bed off-plan in Business Bay under 2.5M by Emaar" - and sets the map's filters from it.
    let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { F.q = q.value.trim(); F.ai = null; F.aiLabel = ''; if (hint) hint.hidden = true; apply(true); }, 250); });
    const aiBtn = $('[data-map-ai]'), hint = $('[data-map-ai-hint]');
    if (F.ai && hint) { hint.textContent = `Searching for: ${F.aiLabel}`; hint.hidden = false; }
    async function aiSearch() {
      const text = q.value.trim(); if (!text || !S().understand) return;
      aiBtn && aiBtn.classList.add('is-busy');
      const res = await S().understand(text, { projects: data });
      aiBtn && aiBtn.classList.remove('is-busy');
      const got = applyAI(res.f || {}, text);
      if (hint) { hint.textContent = got.length ? `${res.via === 'ai' ? 'AI understood' : 'Searching for'}: ${got.join(' · ')}` : ''; hint.hidden = !got.length; }
    }
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(t); aiSearch(); } });
    if (aiBtn) aiBtn.addEventListener('click', aiSearch);
    $('[data-map-reset]').addEventListener('click', () => {
      if ($('[data-map-ai-hint]')) $('[data-map-ai-hint]').hidden = true;
      F.q = ''; q.value = ''; F.ai = null; F.aiLabel = ''; F.pmin = F.pmax = 0; F.c = 'United Arab Emirates'; F.ids = new Set(); LIST_KEYS.forEach((k) => { F[k] = new Set(k === 'st' ? DEFAULT_ST : []); });
      hidePanel(); apply(); map.setView([25.13, 55.25], 11);
    });
    document.querySelectorAll('[data-map-list-toggle], [data-map-list-tab]').forEach((b) => b.addEventListener('click', () => toggleList()));
    const lessB = $('[data-rows-less]'), moreB = $('[data-rows-more]'), topB = $('[data-map-top-toggle]');
    if (lessB) lessB.addEventListener('click', () => setRows(listOpen ? rows - 1 : 0));
    if (moreB) moreB.addEventListener('click', () => setRows(listOpen ? rows + 1 : 1));
    if (topB) topB.addEventListener('click', () => setTop($('.mapapp').classList.contains('is-topless')));
    phone.addEventListener('change', () => { if (!phone.matches) setTop(true); sizeList(); });
    addEventListener('resize', () => sizeList());
    const tagEl = $('[data-shared-tag]');
    if (tagEl) tagEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-shared-saveall]')) {
        F.ids.forEach((id) => { if (S().isSaved && !S().isSaved(id)) S().toggleSaved(id); });
        e.target.closest('[data-shared-saveall]').textContent = 'Saved ✓';
        return;
      }
      if (e.target.closest('[data-shared-clear]')) { F.ids = new Set(); apply(true); }
    });
    if (F.ids.size && !listOpen) setTimeout(() => toggleList(true), 0);
    const sv = $('[data-top-saved]');
    if (sv) sv.addEventListener('click', () => { if (!F.saved && !(S().saved && S().saved.size)) return; F.saved = !F.saved; if (F.saved && !listOpen) toggleList(true); apply(true); });
    const un = $('[data-top-unit]');
    if (un) un.addEventListener('click', () => { S().setPref('unit', S().prefs.unit === 'm2' ? 'sqft' : 'm2'); renderTop(); });
    document.addEventListener('obelum:saved', (e) => {
      // Last saved project removed while viewing Saved: go back to every project, on the Dubai view.
      if (F.saved && e.detail && !e.detail.count) { F.saved = false; apply(true); return; }
      renderTop(); if (F.saved) apply();
    });
    document.addEventListener('obelum:prefs', () => { renderTop(); renderList(); if (markers.size) buildTips(); });
    $('[data-map-locate]').addEventListener('click', () => map.locate({ setView: true, maxZoom: 14 }));

    const loadJSON = (u) => fetch(u, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    loadJSON('data/cards.json').then((c) => { cards = c || {}; if (listOpen) renderList(); });
    Promise.all([S().loadData ? S().loadData() : loadJSON('data/projects.json'), loadJSON('data/payments.json'), loadJSON('data/developers.json')])
      .then(([d, py, dv]) => {
        data = (d && d.projects || []).filter((p) => p.la != null && p.lo != null);
        pay = py || {};
        ((dv && dv.developers) || []).forEach((x) => (x.dv || []).forEach((n) => { logos[n] = x.file || x.logo; }));
        buildMarkers();
        adoptAI();
        apply();
        // A new catalogue search while the map was already open (Buy): read the address again.
        document.addEventListener('obelum:map-url', () => { readURL(); adoptAI(); hidePanel(); const qi = $('[data-map-q]'); if (qi) qi.value = F.q; apply(true); });
        // A shared link ending in #project-123 opens that project straight away.
        const deep = location.hash.match(/^#project-(\d+)$/);
        const hit = deep && data.find((x) => String(x.id) === deep[1]);
        if (hit) { map.setView([hit.la, hit.lo], 15); open(hit); }
        root.classList.remove('is-loading');
        if (matchMedia('(min-width: 64rem)').matches) toggleList(true);
      })
      .catch(() => { $('[data-map-count]').textContent = 'Projects could not be loaded. Please refresh.'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
