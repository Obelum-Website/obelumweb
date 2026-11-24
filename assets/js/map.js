/* Obelum property map (map.html).
 *
 * A full-screen satellite map of every project in data/projects.json, with a filter bar on top:
 * Search, District, Company, Price, Payments, Handover, Unit type, Bedrooms and Status.
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
  const PRICE_STEPS = [500000, 750000, 1000000, 1500000, 2000000, 3000000, 4000000, 6000000, 8000000, 10000000, 15000000, 20000000];
  const PAY_OPTS = [
    ['post', 'Post-handover payment plan'],
    ['b10', 'Down payment 10% or less'],
    ['b20', 'Down payment 20% or less'],
    ['h50', '50% or less paid by handover'],
  ];

  // Filter state. Sets for the multi-choice menus.
  const F = { q: '', area: new Set(), dev: new Set(), pmin: 0, pmax: 0, pay: new Set(), ho: new Set(), type: new Set(), beds: new Set(), st: new Set() };
  const DEFAULT_ST = ['On Sale', 'Presale (EOI)', 'Start of Sales', 'Announced'];

  let data = [], pay = {}, logos = {}, map, cluster, markers = new Map(), listOpen = false;

  /* ------------------------------------------------------------ URL <-> filters */
  const LIST_KEYS = ['area', 'dev', 'pay', 'ho', 'type', 'beds', 'st'];
  function readURL() {
    const p = new URLSearchParams(location.search);
    F.q = p.get('q') || '';
    F.pmin = +p.get('pmin') || 0; F.pmax = +p.get('pmax') || 0;
    LIST_KEYS.forEach((k) => { F[k] = new Set((p.get(k) || '').split('|').filter(Boolean)); });
    if (!p.has('st')) F.st = new Set(DEFAULT_ST);
  }
  function writeURL() {
    const p = new URLSearchParams();
    if (F.q) p.set('q', F.q);
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
  const hoKey = (p) => (p.st === 'ready' ? 'ready' : p.y ? (p.y >= 2031 ? '2031+' : String(p.y)) : 'tba');
  function test(p, skip) {
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
  function pinHTML(p) {
    const logo = logos[p.dv];
    const inner = logo
      ? `<img class="mpin__logo" src="${esc(logo)}" alt="" loading="lazy" decoding="async">`
      : p.img ? `<img src="${esc(IMG(p.img, 96, 96))}" alt="" loading="lazy" decoding="async" data-full="${esc(p.img)}">`
        : `<b>${esc((p.dv || p.n || '?').trim().charAt(0))}</b>`;
    return `<span class="mpin${p.ss === 'Out of Stock' ? ' mpin--sold' : ''}${logo ? ' mpin--logo' : ''}">${inner}</span>`;
  }

  function buildMarkers() {
    data.forEach((p) => {
      if (p.la == null || p.lo == null) return;
      const m = L.marker([p.la, p.lo], {
        icon: L.divIcon({ className: 'mpin-wrap', html: pinHTML(p), iconSize: [44, 44], iconAnchor: [22, 22] }),
        title: p.n, riseOnHover: true,
      });
      m.bindTooltip(`<strong>${esc(p.n)}</strong><br>${esc(p.dv || '')}${p.p1 ? ' · from AED ' + money(p.p1) : ''}`, { direction: 'top', offset: [0, -22], className: 'mtip' });
      m.on('click', () => open(p));
      markers.set(p.id, m);
    });
  }

  function open(p) { if (S().openModal) S().openModal(p); }

  let first = true;
  function apply(fit) {
    const list = data.filter((p) => test(p));
    cluster.clearLayers();
    cluster.addLayers(list.map((p) => markers.get(p.id)).filter(Boolean));
    $('[data-map-count]').textContent = `${list.length.toLocaleString()} ${list.length === 1 ? 'project' : 'projects'}`;
    $('[data-map-empty]').hidden = list.length > 0;
    renderChips();
    writeURL();
    if ((fit || first) && list.length) {
      const b = L.latLngBounds(list.map((p) => [p.la, p.lo]));
      // With no place filter, open on Dubai rather than on the whole world (Bali, Riyadh, London...).
      if (first && !F.area.size && !F.q && !F.dev.size) map.setView([25.13, 55.25], 11);
      else map.fitBounds(b, { padding: [60, 60], maxZoom: 15 });
    }
    first = false;
    renderList();
  }

  /* -------------------------------------------------------------- filter bar */
  // Each menu: chip label, how to summarise the current choice, and how to draw its panel.
  const MENUS = {
    area: { label: 'District', panel: () => checklist('area', options((p) => p.a || p.r, 'area'), true) },
    dev: { label: 'Company', panel: () => checklist('dev', options((p) => p.dv, 'dev'), true, true) },
    price: { label: 'Price', panel: pricePanel },
    pay: { label: 'Payments', panel: () => checklist('pay', PAY_OPTS.map(([k, l]) => ({ v: k, l, n: countWith('pay', k) }))) },
    ho: { label: 'Handover', panel: () => checklist('ho', handoverOptions()) },
    type: { label: 'Unit type', panel: () => checklist('type', options((p) => p.t, 'type').map((o) => ({ ...o, l: TYPE_LABEL[o.v] || o.v }))) },
    beds: { label: 'Bedrooms', panel: bedsPanel },
    st: { label: 'Status', panel: () => checklist('st', STATUS_ORDER.map((s) => ({ v: s, l: STATUS_LABEL[s] || s, n: countWith('st', s) }))) },
  };

  // Options with live counts: how many projects each choice would show given the other filters.
  function options(get, key) {
    const c = new Map();
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

  function checklist(key, opts, searchable, withLogo) {
    const box = document.createElement('div');
    box.className = 'mpanel__body';
    box.innerHTML = `
      ${searchable ? `<input class="mpanel__find" type="search" placeholder="Search ${esc(MENUS[key].label.toLowerCase())}…" aria-label="Search">` : ''}
      <ul class="mcheck" role="listbox" aria-multiselectable="true">
        ${opts.map((o) => `<li><label class="${o.n ? '' : 'is-zero'}">
          <input type="checkbox" value="${esc(o.v)}"${F[key].has(o.v) ? ' checked' : ''}>
          ${withLogo && logos[o.v] ? `<img class="mcheck__logo" src="${esc(logos[o.v])}" alt="" loading="lazy">` : ''}
          <span>${esc(o.l)}</span><em>${o.n.toLocaleString()}</em></label></li>`).join('')}
      </ul>
      <div class="mpanel__foot"><button type="button" data-clear="${key}">Clear</button><button type="button" class="is-main" data-close-panel>Done</button></div>`;
    box.addEventListener('change', (e) => {
      const cb = e.target.closest('input[type=checkbox]'); if (!cb) return;
      if (cb.checked) F[key].add(cb.value); else F[key].delete(cb.value);
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
      <div class="mquick">${[[0, 1e6, 'Under 1M'], [1e6, 2e6, '1M – 2M'], [2e6, 4e6, '2M – 4M'], [4e6, 8e6, '4M – 8M'], [1e7, 0, '10M+']]
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

  function renderChips() {
    document.querySelectorAll('[data-menu]').forEach((b) => {
      const k = b.dataset.menu, s = summary(k);
      b.classList.toggle('is-active', !!s);
      b.querySelector('span').textContent = s ? `${MENUS[k].label}: ${s}` : MENUS[k].label;
    });
    const any = F.q || F.pmin || F.pmax || LIST_KEYS.some((k) => (k === 'st' ? !sameSet(F.st, DEFAULT_ST) : F[k].size));
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
    pn.style.left = `${Math.max(8, Math.min(r.left - host.left, host.width - pn.offsetWidth - 8))}px`;
    const f = pn.querySelector('.mpanel__find'); if (f && matchMedia('(hover: hover)').matches) f.focus();
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

  /* ---------------------------------------------------------------- the list */
  // Projects inside the visible part of the map, newest first.
  function renderList() {
    const el = $('[data-map-list]'); if (!listOpen || !el) return;
    const b = map.getBounds();
    const inView = data.filter((p) => test(p) && b.contains([p.la, p.lo])).sort((a, z) => z.id - a.id);
    const shown = inView.slice(0, 60);
    $('[data-map-list-count]').textContent = `${inView.length.toLocaleString()} in this area`;
    el.innerHTML = shown.map((p) => `
      <button type="button" class="mcard" data-id="${p.id}">
        <span class="mcard__img">${p.img ? `<img src="${esc(IMG(p.img, 240, 160))}" data-full="${esc(p.img)}" alt="" loading="lazy" decoding="async">` : ''}</span>
        <span class="mcard__txt">
          <b>${esc(p.n)}</b>
          <small>${esc([p.a, p.dv].filter(Boolean).join(' · '))}</small>
          <em>${p.p1 ? 'From AED ' + money(p.p1) : 'Price on request'}${p.st === 'ready' ? ' · Ready' : p.y ? ' · ' + p.y : ''}</em>
        </span>
      </button>`).join('') + (inView.length > shown.length ? `<p class="mlist__more">Zoom in to see the other ${(inView.length - shown.length).toLocaleString()}.</p>` : '');
  }
  function toggleList(on) {
    listOpen = on ?? !listOpen;
    $('.mapapp').classList.toggle('is-list', listOpen);
    $('[data-map-list-toggle]').setAttribute('aria-pressed', String(listOpen));
    setTimeout(() => { map.invalidateSize(); renderList(); }, 260);
  }

  /* ------------------------------------------------------------------- start */
  function init() {
    const root = $('.mapapp'); if (!root || !window.L) return;
    readURL();

    map = L.map($('[data-map]'), { zoomControl: false, worldCopyJump: true, minZoom: 3 }).setView([25.13, 55.25], 11);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const sat = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
    ]);
    const streets = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO' });
    sat.addTo(map);
    $('[data-map-style]').addEventListener('click', (e) => {
      const toSat = !map.hasLayer(sat);
      map.removeLayer(toSat ? streets : sat); (toSat ? sat : streets).addTo(map);
      e.currentTarget.textContent = toSat ? 'Map' : 'Satellite';
      root.classList.toggle('is-streets', !toSat);
    });

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
      const card = e.target.closest('.mcard');
      if (card) { const p = data.find((x) => x.id === +card.dataset.id); if (p) open(p); }
    });
    root.addEventListener('mouseover', (e) => {
      const card = e.target.closest('.mcard'); document.querySelectorAll('.mpin.is-hot').forEach((x) => x.classList.remove('is-hot'));
      const m = card && markers.get(+card.dataset.id); const el = m && m.getElement && m.getElement();
      if (el) el.querySelector('.mpin').classList.add('is-hot');
    });
    document.addEventListener('click', (e) => { if (openKey && !e.target.closest('[data-map-panel], [data-menu]')) hidePanel(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openKey) hidePanel(); });

    const q = $('[data-map-q]'); q.value = F.q;
    let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { F.q = q.value.trim(); apply(true); }, 250); });
    $('[data-map-reset]').addEventListener('click', () => {
      F.q = ''; q.value = ''; F.pmin = F.pmax = 0; LIST_KEYS.forEach((k) => { F[k] = new Set(k === 'st' ? DEFAULT_ST : []); });
      hidePanel(); apply(); map.setView([25.13, 55.25], 11);
    });
    $('[data-map-list-toggle]').addEventListener('click', () => toggleList());
    $('[data-map-locate]').addEventListener('click', () => map.locate({ setView: true, maxZoom: 14 }));

    const loadJSON = (u) => fetch(u, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([S().loadData ? S().loadData() : loadJSON('data/projects.json'), loadJSON('data/payments.json'), loadJSON('data/developers.json')])
      .then(([d, py, dv]) => {
        data = (d && d.projects || []).filter((p) => p.la != null && p.lo != null);
        pay = py || {};
        ((dv && dv.developers) || []).forEach((x) => (x.dv || []).forEach((n) => { logos[n] = x.file || x.logo; }));
        buildMarkers();
        apply();
        root.classList.remove('is-loading');
        if (matchMedia('(min-width: 64rem)').matches) toggleList(true);
      })
      .catch(() => { $('[data-map-count]').textContent = 'Projects could not be loaded. Please refresh.'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
