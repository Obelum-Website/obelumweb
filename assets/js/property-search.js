/* Obelum property search.
 *
 * Two jobs, one file:
 *   1. Any element with [data-psearch] becomes a search bar (home hero, buy page).
 *      It has an "ask in your own words" field plus quick filters, and sends the
 *      visitor to /search with the filters in the URL.
 *   2. On /search ([data-psearch-results]) it loads data/projects.json, applies the
 *      filters and shows only the matching projects, on a map and as cards.
 *
 * Words typed into the AI field go to /api/ai-search (Claude turns them into
 * filters). If that endpoint is missing or fails (e.g. the static preview), a
 * built-in parser reads the common phrasings instead, so search always works.
 */
(() => {
  const DATA_URL = 'data/projects.json';
  const AI_URL = location.hostname.endsWith('github.io') ? 'https://obelum.ae/api/ai-search' : 'api/ai-search';
  const WHATSAPP = '971586033881';
  const PAGE = 24;

  const TYPES = ['Apartments', 'Villa', 'Townhouse', 'Penthouse', 'Duplex', 'Office', 'Retail'];
  const TYPE_LABEL = { Apartments: 'Apartment' };
  const NO_BEDS = ['Office', 'Retail'];
  const PRICES = [1000000, 1500000, 2000000, 3000000, 4000000, 6000000, 8000000];
  const TOP_PRICE = 10000000; // the last option, "+10M", means 10M and above

  // Spoken names people use for areas, mapped to what the data calls them.
  const ALIASES = {
    'jvc': 'JVC', 'jumeirah village circle': 'JVC', 'jvt': 'JVT', 'jumeirah village triangle': 'JVT',
    'marina': 'Dubai Marina', 'dubai marina': 'Dubai Marina', 'jbr': 'JBR', 'downtown': 'Downtown',
    'palm': 'Palm Jumeirah', 'the palm': 'Palm Jumeirah', 'creek': 'Creek', 'dubai creek harbour': 'Creek',
    'business bay': 'Business Bay', 'bb': 'Business Bay', 'difc': 'DIFC', 'mbr': 'MBR District', 'mbr city': 'MBR District', 'sobha one': 'Sobha',
    'meydan': 'Meydan', 'dubai hills': 'Dubai Hills', 'damac hills': 'DAMAC Hills', 'jlt': 'JLT',
    'sobha hartland': 'Sobha Hartland', 'dubai south': 'Dubai South', 'al marjan': 'Al Marjan',
    'rak': 'Ras al-Khaimah', 'ras al khaimah': 'Ras al-Khaimah', 'abu dhabi': 'Abu Dhabi',
    'sharjah': 'Sharjah', 'ajman': 'Ajman', 'umm al quwain': 'Umm al-Quwain', 'bali': 'Bali',
  };

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (v) => v >= 1e6 ? `AED ${parseFloat((v / 1e6).toFixed(2))}M` : `AED ${Math.round(v / 1e3)}K`;
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* ------------------------------------------------------------ data */
  let dataPromise;
  function loadData() {
    if (!dataPromise) {
      dataPromise = fetch(DATA_URL, { cache: 'no-cache' }).then((r) => {
        if (!r.ok) throw new Error('data ' + r.status);
        return r.json();
      });
    }
    return dataPromise;
  }

  /* --------------------------------------------------------- filters */
  // A filter object: { loc, type, beds, pmin, pmax, status, dev, year, sold }
  const KEYS = ['loc', 'type', 'beds', 'pmin', 'pmax', 'status', 'dev', 'year', 'sold'];

  function readParams() {
    const p = new URLSearchParams(location.search);
    const f = {};
    KEYS.forEach((k) => { const v = p.get(k); if (v !== null && v !== '') f[k] = v; });
    return { f, q: p.get('q') || '' };
  }

  function toQuery(f, q) {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    KEYS.forEach((k) => { if (f[k] !== undefined && f[k] !== null && f[k] !== '') p.set(k, f[k]); });
    return p.toString();
  }

  function matches(p, f) {
    if (!f.sold && p.ss === 'Out of Stock') return false;
    if (f.status && p.st !== f.status) return false;
    if (f.type && !p.t.includes(f.type)) return false;
    if (f.beds !== undefined) {
      const b = Number(f.beds);
      if (p.b1 === null || p.b2 === null) return false;
      if (b >= 5 ? p.b2 < 5 : (b < p.b1 || b > p.b2)) return false;
    }
    if (f.pmax && !(p.p1 && p.p1 <= Number(f.pmax))) return false;
    if (f.pmin && !((p.p2 || p.p1) && (p.p2 || p.p1) >= Number(f.pmin))) return false;
    if (f.year && !(p.y && p.y <= Number(f.year))) return false;
    if (f.dev && !norm(p.dv).includes(norm(f.dev))) return false;
    if (f.loc) {
      const hay = norm(`${p.a} ${p.r} ${p.n}`);
      if (!norm(f.loc).split(/\s*,\s*/).some((l) => l && hay.includes(l))) return false;
    }
    return true;
  }

  /* ------------------------------------------- reading plain language */
  const WORDNUM = { studio: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

  function parseMoney(n, unit) {
    let v = parseFloat(String(n).replace(/,/g, ''));
    if (isNaN(v)) return null;
    unit = (unit || '').toLowerCase();
    if (/^(m|mn|mil|million)/.test(unit)) v *= 1e6;
    else if (/^(k|thousand)/.test(unit)) v *= 1e3;
    else if (v < 100) v *= 1e6; // "under 2" in a property search means millions
    return Math.round(v);
  }

  function localParse(text, data) {
    const t = ' ' + norm(text).replace(/[^\w.,\s-]/g, ' ') + ' ';
    const f = {};

    const bed = t.match(/\b(\d|one|two|three|four|five|six)\s*(?:-|\s)?(?:bed|beds|bedroom|bedrooms|br|bhk|bd)\b/);
    if (bed) f.beds = String(WORDNUM[bed[1]] ?? bed[1]);
    else if (/\bstudio/.test(t)) f.beds = '0';

    const M = '(\\d[\\d,.]*)\\s*(m|mn|mil|million|k|thousand)?';
    let m;
    if ((m = t.match(new RegExp(`between\\s*(?:aed\\s*)?${M}\\s*(?:and|-|to)\\s*(?:aed\\s*)?${M}`)))) {
      f.pmin = parseMoney(m[1], m[2] || m[4]); f.pmax = parseMoney(m[3], m[4]);
    } else {
      if ((m = t.match(new RegExp(`\\b(?:under|below|less than|up to|upto|max(?:imum)?|budget(?: of)?|within)\\s*(?:aed\\s*)?${M}`)))) f.pmax = parseMoney(m[1], m[2]);
      if ((m = t.match(new RegExp(`\\b(?:over|above|more than|from|min(?:imum)?|starting at)\\s*(?:aed\\s*)?${M}`)))) f.pmin = parseMoney(m[1], m[2]);
    }

    if (/off[\s-]?plan|under construction|new launch|pre[\s-]?launch/.test(t)) f.status = 'offplan';
    else if (/\bready\b|completed|move in|handed over/.test(t)) f.status = 'ready';

    const yr = t.match(/\b(?:by|before|handover(?: in)?|completion(?: in)?|ready (?:by|in))\s*(?:q\d\s*)?(20\d\d)\b/);
    if (yr) { f.year = yr[1]; f.status = f.status || 'offplan'; }

    const typeWords = [['penthouse', 'Penthouse'], ['townhouse', 'Townhouse'], ['town house', 'Townhouse'], ['villa', 'Villa'],
      ['duplex', 'Duplex'], ['office', 'Office'], ['retail', 'Retail'], ['shop', 'Retail'], ['apartment', 'Apartments'], ['flat', 'Apartments']];
    for (const [w, v] of typeWords) if (t.includes(w)) { f.type = v; break; }

    // Locations: try aliases first, then every area/region in the data (longest first).
    let found = null;
    for (const a of Object.keys(ALIASES).sort((x, y) => y.length - x.length)) {
      if (new RegExp(`\\b${a}\\b`).test(t)) { found = ALIASES[a]; break; }
    }
    if (!found && data) {
      const places = [...new Set(data.projects.flatMap((p) => [p.a, p.r]).filter(Boolean))]
        .sort((x, y) => y.length - x.length);
      for (const pl of places) {
        const short = norm(pl).replace(/\s*\(.*\)\s*/, '').trim();
        if (short.length > 3 && t.includes(' ' + short)) { found = pl.replace(/\s*\(.*\)\s*/, ''); break; }
      }
    }
    if (found) f.loc = found;

    if (data) {
      const placeWords = new Set(data.projects.flatMap((p) => [norm(p.a), norm(p.r)]));
      const devs = [...new Set(data.projects.map((p) => p.dv).filter(Boolean))].sort((x, y) => y.length - x.length);
      for (const d of devs) {
        const dn = norm(d).replace(/\b(properties|developers?|development|group|real estate|llc)\b/g, '').trim();
        if (dn.length > 3 && !placeWords.has(dn) && !norm(found || '').includes(dn) && new RegExp(`\\b${dn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t)) { f.dev = dn; break; }
      }
    }
    return f;
  }

  async function understand(text, data) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      const r = await fetch(AI_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text }), signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (r.ok) {
        const j = await r.json();
        if (j && j.filters && typeof j.filters === 'object') {
          const f = {};
          KEYS.forEach((k) => { if (j.filters[k] !== undefined && j.filters[k] !== null && j.filters[k] !== '') f[k] = String(j.filters[k]); });
          return { f, via: 'ai', note: j.note || '' };
        }
      }
    } catch (e) { /* fall through to the built-in reader */ }
    return { f: localParse(text, data), via: 'local', note: '' };
  }

  /* ---------------------------------------------------- the search bar */
  function opt(v, label, sel) { return `<option value="${esc(v)}"${String(sel) === String(v) ? ' selected' : ''}>${esc(label)}</option>`; }

  function priceSel(f) { return f.pmax ? String(f.pmax) : (Number(f.pmin) >= TOP_PRICE ? 'top' : ''); }
  function priceOptions(f) {
    const sel = priceSel(f);
    const list = [...new Set([...PRICES, ...(f.pmax && +f.pmax !== TOP_PRICE ? [+f.pmax] : [])])].sort((a, b) => a - b);
    return opt('', 'Any', sel) + list.map((p) => opt(p, money(p).replace('AED ', ''), sel)).join('') + opt('top', '+10M', sel);
  }

  function barHTML(f, q, goLabel = 'Search') {
    return `
    <form class="psearch__form" role="search" novalidate>
      <label class="psearch__ai">
        <span class="psearch__spark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z M19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" fill="currentColor"/></svg>
        </span>
        <span class="visually-hidden">Describe what you are looking for</span>
        <input class="psearch__q" name="q" type="search" value="${esc(q)}" autocomplete="off"
          placeholder="${matchMedia('(max-width: 40rem)').matches ? 'Describe what you’re looking for…' : 'Try “2-bed off-plan in Business Bay under 2.5M, handover 2027”'}">
        <button class="psearch__go" type="submit">${esc(goLabel)}</button>
      </label>
      <div class="psearch__filters">
        <label class="psearch__field psearch__field--loc"><span>Location</span>
          <input name="loc" list="psearch-places" value="${esc(f.loc || '')}" placeholder="Any area" autocomplete="off"></label>
        <label class="psearch__field"><span>Type</span>
          <select name="type">${opt('', 'Any', f.type)}${TYPES.map((t) => opt(t, TYPE_LABEL[t] || t, f.type)).join('')}</select></label>
        <label class="psearch__field"><span>Beds</span>
          <select name="beds">${opt('', 'Any', f.beds)}${opt('0', 'Studio', f.beds)}${[1, 2, 3, 4].map((b) => opt(b, b, f.beds)).join('')}${opt('5', '5+', f.beds)}</select></label>
        <label class="psearch__field"><span>Max price</span>
          <select name="pmax">${priceOptions(f)}</select></label>
        <label class="psearch__field"><span>Status</span>
          <select name="status">${opt('', 'Any', f.status)}${opt('offplan', 'Off-plan', f.status)}${opt('ready', 'Ready', f.status)}</select></label>
        <button class="psearch__fgo" type="submit" value="filters">
          <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          Search
        </button>
      </div>
      <datalist id="psearch-places"></datalist>
    </form>`;
  }

  function fillPlaces(form) {
    const dl = form.querySelector('datalist');
    if (!dl || dl.childElementCount) return;
    loadData().then((d) => {
      const count = {};
      d.projects.forEach((p) => { [p.a, p.r].forEach((x) => { if (x) count[x] = (count[x] || 0) + 1; }); });
      // Every area, A to Z.
      dl.innerHTML = Object.keys(count).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
        .map((x) => `<option value="${esc(x)}">`).join('');
    }).catch(() => {});
  }

  function mountBar(host, { onSubmit } = {}) {
    const { f, q } = readParams();
    host.innerHTML = barHTML(f, q, host.dataset.goLabel || 'Search');
    const form = host.querySelector('form');
    // Offices and shops have no bedrooms: lock the Beds filter for them.
    const lockBeds = () => {
      const beds = form.elements.beds, t = form.elements.type.value;
      const off = NO_BEDS.includes(t);
      beds.disabled = off;
      if (off) beds.value = '';
      beds.closest('.psearch__field').classList.toggle('is-disabled', off);
    };
    form.elements.type.addEventListener('change', lockBeds);
    lockBeds();
    form.lockBeds = lockBeds;
    form.addEventListener('focusin', () => fillPlaces(form), { once: true });
    const gather = () => {
      const fd = new FormData(form);
      const nf = {};
      ['loc', 'type', 'beds', 'pmax', 'status'].forEach((k) => { const v = (fd.get(k) || '').toString().trim(); if (v) nf[k] = v; });
      if (nf.pmax === 'top') { delete nf.pmax; nf.pmin = String(TOP_PRICE); }
      return { f: nf, q: (fd.get('q') || '').toString().trim() };
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const s = gather();
      // The filters' own button searches by the filters only, ignoring the sentence.
      if (e.submitter && e.submitter.value === 'filters') { s.q = ''; form.elements.q.value = ''; }
      if (onSubmit) onSubmit(s);
      else location.href = 'search?' + toQuery(s.f, s.q);
    });
    // Filters apply only when Search is pressed, never on change.
    return form;
  }

  /* ------------------------------------------------- the results page */
  // The project's own page (search page opens its pop-up), so advisors get the full details.
  const projectUrl = (p) => new URL('search#project-' + p.id, document.baseURI).href;

  function cardHTML(p) {
    const price = p.p1 ? `From ${money(p.p1)}` : 'Price on request';
    const beds = p.b1 === null ? '' : p.b1 === p.b2 ? (p.b1 === 0 ? 'Studio' : `${p.b1} bed`) : `${p.b1 === 0 ? 'Studio' : p.b1}–${p.b2} bed`;
    const types = p.t.map((t) => TYPE_LABEL[t] || t).slice(0, 3).join(' · ');
    const status = p.st === 'ready' ? 'Ready' : (p.y ? `Off-plan · ${p.y}` : 'Off-plan');
    const msg = encodeURIComponent(`Hi Obelum, I'm interested in ${p.n}${p.a ? ' (' + p.a + ')' : ''}. Could you send me details?\n${projectUrl(p)}`);
    return `
    <article class="pcard" data-id="${p.id}" tabindex="0" role="button" aria-label="View ${esc(p.n)}">
      <div class="pcard__media">
        ${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy" decoding="async">` : ''}
        <span class="pcard__badge">${esc(status)}</span>
        ${p.ss === 'Out of Stock' ? '<span class="pcard__badge pcard__badge--sold">Sold out</span>' : ''}
      </div>
      <div class="pcard__body">
        <p class="pcard__place">${esc([p.a, p.r].filter(Boolean).join(', '))}</p>
        <h3 class="pcard__name">${esc(p.n)}</h3>
        <p class="pcard__dev">${esc(p.dv || '')}</p>
        <p class="pcard__price">${esc(price)}</p>
        <p class="pcard__spec">${esc([beds, types].filter(Boolean).join(' · '))}</p>
        <div class="pcard__actions">
          <a class="pcard__btn" href="https://wa.me/${WHATSAPP}?text=${msg}" target="_blank" rel="noopener">Enquire</a>
          <button class="pcard__map" type="button" data-fly="${p.id}">On map</button>
        </div>
      </div>
    </article>`;
  }

  function chipsHTML(f, via) {
    const L = {
      loc: (v) => v, type: (v) => TYPE_LABEL[v] || v, beds: (v) => v === '0' ? 'Studio' : v === '5' ? '5+ beds' : v === '1' ? '1 bed' : `${v} beds`,
      pmin: (v) => `From ${money(+v)}`, pmax: (v) => `Up to ${money(+v)}`, status: (v) => v === 'ready' ? 'Ready' : 'Off-plan',
      dev: (v) => `Developer: ${v}`, year: (v) => `Handover by ${v}`, sold: () => 'Incl. sold out',
    };
    const chips = KEYS.filter((k) => f[k] !== undefined).map((k) =>
      `<button type="button" class="pchip" data-drop="${k}" aria-label="Remove ${esc(L[k](f[k]))}">${esc(L[k](f[k]))}<span aria-hidden="true">×</span></button>`);
    if (!chips.length) return '';
    return `<span class="pchips__lead">${via === 'ai' ? 'AI understood' : 'Searching for'}</span>${chips.join('')}`;
  }

  let leafletPromise;
  function loadLeaflet() {
    if (window.L && window.L.markerClusterGroup) return Promise.resolve();
    if (leafletPromise) return leafletPromise;
    const css = (href) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); };
    const js = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    css('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
    css('https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css');
    leafletPromise = js('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js')
      .then(() => js('https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'));
    return leafletPromise;
  }

  let map, cluster, markers = {};
  function ensureMap(el) {
    if (map || !window.L) return map;
    map = L.map(el, { scrollWheelZoom: false, zoomControl: true }).setView([25.15, 55.25], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO', subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);
    cluster = L.markerClusterGroup({
      showCoverageOnHover: false, maxClusterRadius: 50,
      iconCreateFunction: (c) => L.divIcon({ html: `<span>${c.getChildCount()}</span>`, className: 'pcluster', iconSize: [40, 40] }),
    });
    map.addLayer(cluster);
    el.addEventListener('click', () => map.scrollWheelZoom.enable(), { once: true });
    return map;
  }

  async function drawMap(list) {
    if (!list.length || !$('[data-psearch-map]')) return; // no map on this page, or nothing to show
    try { await loadLeaflet(); } catch (e) { return; }
    if (!ensureMap($('[data-psearch-map]'))) return;
    cluster.clearLayers(); markers = {};
    const icon = L.divIcon({ className: 'ppin', iconSize: [16, 16] });
    const layers = list.map((p) => {
      const m = L.marker([p.la, p.lo], { icon, title: p.n });
      m.bindPopup(`<strong>${esc(p.n)}</strong><br>${esc(p.a || p.r || '')}<br>${p.p1 ? 'From ' + money(p.p1) : 'Price on request'}`);
      m.on('click', () => {
        const card = document.querySelector(`.pcard[data-id="${p.id}"]`);
        document.querySelectorAll('.pcard.is-on').forEach((c) => c.classList.remove('is-on'));
        if (card) card.classList.add('is-on');
      });
      markers[p.id] = m;
      return m;
    });
    cluster.addLayers(layers);
    if (layers.length) map.fitBounds(cluster.getBounds(), { padding: [30, 30], maxZoom: 15 });
    setTimeout(() => map.invalidateSize(), 50);
  }

  /* ------------------------------------------------ project pop-up */
  const detailCache = {};
  function loadDetail(id) {
    if (!detailCache[id]) detailCache[id] = fetch(`data/p/${id}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    return detailCache[id];
  }

  // Reelly descriptions are light markdown: "##### Heading" and paragraphs.
  function descHTML(md) {
    return String(md || '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean).map((b) => {
      const h = b.match(/^#{1,6}\s*(.+)$/);
      if (h) return `<h4>${esc(h[1])}</h4>`;
      return `<p>${esc(b.replace(/\*\*/g, '')).replace(/\n/g, '<br>')}</p>`;
    }).join('');
  }
  const bedLabel = (b) => (b === 0 ? 'Studio' : `${String(b).replace(/\.5$/, '.5')} bed`);
  const range = (a, b, f) => (a && b && a !== b ? `${f(a)} – ${f(b)}` : a ? f(a) : b ? f(b) : '—');
  const sqft = (v) => `${Math.round(v).toLocaleString()} sq ft`;

  let modal, modalProject, galleryIdx = 0, lastFocus;
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'pmodal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="pmodal__backdrop" data-close></div>
      <div class="pmodal__dialog" role="dialog" aria-modal="true" aria-labelledby="pmodal-title" tabindex="-1">
        <button class="pmodal__close" type="button" data-close aria-label="Close">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" stroke-width="1.6"/></svg>
        </button>
        <div class="pmodal__body" data-pmodal-body></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) closeModal();
      const nav = e.target.closest('[data-gal]');
      if (nav) showPhoto(galleryIdx + Number(nav.dataset.gal));
      const th = e.target.closest('[data-thumb]');
      if (th) showPhoto(Number(th.dataset.thumb));
    });
    document.addEventListener('keydown', (e) => {
      if (modal.hidden) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowRight') showPhoto(galleryIdx + 1);
      if (e.key === 'ArrowLeft') showPhoto(galleryIdx - 1);
    });
    return modal;
  }

  function showPhoto(i) {
    const photos = (modalProject && modalProject.photos) || [];
    if (!photos.length) return;
    galleryIdx = (i + photos.length) % photos.length;
    const main = modal.querySelector('[data-gal-main]');
    if (main) main.src = photos[galleryIdx];
    const count = modal.querySelector('[data-gal-count]');
    if (count) count.textContent = `${galleryIdx + 1} / ${photos.length}`;
    modal.querySelectorAll('[data-thumb]').forEach((t) => t.classList.toggle('is-on', Number(t.dataset.thumb) === galleryIdx));
    const on = modal.querySelector('[data-thumb].is-on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function modalHTML(p, d) {
    const photos = (d && d.photos && d.photos.length ? d.photos : [p.img]).filter(Boolean);
    modalProject = { photos };
    const status = p.st === 'ready' ? 'Ready' : 'Off-plan';
    const beds = p.b1 === null ? '—' : p.b1 === p.b2 ? bedLabel(p.b1) : `${p.b1 === 0 ? 'Studio' : p.b1} – ${bedLabel(p.b2)}`;
    const facts = [
      ['Starting price', p.p1 ? money(p.p1) : 'On request'],
      ['Handover', (d && d.handover) || (p.y ? String(p.y) : '—')],
      ['Status', `${status}${p.ss ? ' · ' + p.ss : ''}`],
      ['Bedrooms', beds],
      ['Size', range((d && d.s1) || null, (d && d.s2) || null, sqft)],
      ['Property types', p.t.map((t) => TYPE_LABEL[t] || t).join(', ') || '—'],
    ];
    if (d && d.furnishing) facts.push(['Furnishing', d.furnishing]);
    if (d && d.service_charge) facts.push(['Service charge', d.service_charge]);
    if (d && d.post_handover) facts.push(['Payment', 'Post-handover plan available']);

    const msg = encodeURIComponent(`Hi Obelum, I'm interested in ${p.n}${p.a ? ' (' + p.a + ')' : ''}. Could you send me prices, floor plans and the payment plan?\n${projectUrl(p)}`);
    const units = d && d.units && d.units.length ? `
      <section class="pmodal__sec"><h3>Units &amp; prices</h3>
        <table class="punits"><thead><tr><th>Type</th><th>Size</th><th>Price</th><th></th></tr></thead><tbody>
        ${d.units.map((u) => `<tr><td>${esc(bedLabel(u.beds))}</td><td>${esc(range(u.s1, u.s2, sqft))}</td><td>${esc(range(u.p1, u.p2, money))}</td>
          <td>${u.layout ? `<a href="${esc(u.layout)}" target="_blank" rel="noopener">Layout</a>` : ''}</td></tr>`).join('')}
        </tbody></table></section>` : '';
    const plans = d && d.plans && d.plans.length ? `
      <section class="pmodal__sec"><h3>Payment plan${d.plans.length > 1 ? 's' : ''}</h3>
        ${d.plans.map((pl) => `<div class="pplan"><p class="pplan__name">${esc(pl.name)}</p>
          <div class="pplan__bar">${pl.steps.map((s) => `<span style="flex:${s.pct}" title="${esc(s.name)} ${s.pct}%"></span>`).join('')}</div>
          <ul class="pplan__steps">${pl.steps.map((s) => `<li><b>${+s.pct}%</b> ${esc(s.name)}</li>`).join('')}</ul></div>`).join('')}
      </section>` : '';
    const amen = d && d.amenities && d.amenities.length ? `
      <section class="pmodal__sec"><h3>Amenities</h3><ul class="pamen">${d.amenities.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>` : '';
    const near = d && d.nearby && d.nearby.length ? `
      <section class="pmodal__sec"><h3>Nearby</h3><ul class="pnear">${d.nearby.map((n) => `<li><span>${esc(n.name)}</span><b>${n.km != null ? esc(n.km) + ' km' : ''}</b></li>`).join('')}</ul></section>` : '';
    const desc = d && d.desc ? `<section class="pmodal__sec pdesc"><h3>About the project</h3>${descHTML(d.desc)}</section>` : '';

    return `
      <div class="pgal">
        <div class="pgal__stage">
          ${photos.length ? `<img data-gal-main src="${esc(photos[0])}" alt="${esc(p.n)}">` : ''}
          ${photos.length > 1 ? `
            <button class="pgal__nav pgal__nav--prev" type="button" data-gal="-1" aria-label="Previous photo">&#8249;</button>
            <button class="pgal__nav pgal__nav--next" type="button" data-gal="1" aria-label="Next photo">&#8250;</button>
            <span class="pgal__count" data-gal-count>1 / ${photos.length}</span>` : ''}
        </div>
        ${photos.length > 1 ? `<div class="pgal__thumbs">${photos.map((u, i) => `<button type="button" data-thumb="${i}" class="${i ? '' : 'is-on'}" aria-label="Photo ${i + 1}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
      </div>
      <header class="pmodal__head">
        <p class="pcard__place">${esc([p.a, p.r].filter(Boolean).join(', '))}</p>
        <h2 class="pmodal__title" id="pmodal-title">${esc(p.n)}</h2>
        <p class="pmodal__dev">${esc(p.dv ? 'by ' + p.dv : '')}</p>
      </header>
      <dl class="pfacts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${units}${plans}${desc}${amen}${near}
      ${d ? '' : '<p class="pmodal__loading">Loading project details…</p>'}
      <div class="pmodal__cta">
        <a class="pcard__btn" href="https://wa.me/${WHATSAPP}?text=${msg}" target="_blank" rel="noopener">Enquire on WhatsApp</a>
        <p>Prices are developer starting prices and change often. An advisor will confirm availability.</p>
      </div>`;
  }

  async function openModal(p) {
    ensureModal();
    lastFocus = document.activeElement;
    const body = modal.querySelector('[data-pmodal-body]');
    body.innerHTML = modalHTML(p, null);
    galleryIdx = 0;
    modal.hidden = false;
    document.documentElement.classList.add('pmodal-open');
    modal.querySelector('.pmodal__dialog').focus();
    modal.querySelector('.pmodal__dialog').scrollTop = 0;
    if (location.hash !== `#project-${p.id}`) history.replaceState(history.state, '', `${location.pathname}${location.search}#project-${p.id}`);
    const d = await loadDetail(p.id);
    if (!modal.hidden && body.isConnected) { body.innerHTML = modalHTML(p, d || {}); showPhoto(0); }
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.documentElement.classList.remove('pmodal-open');
    if (/^#project-/.test(location.hash)) history.replaceState(history.state, '', location.pathname + location.search);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function results(root) {
    const listEl = $('[data-psearch-list]', root);
    const countEl = $('[data-psearch-count]', root);
    const chipsEl = $('[data-psearch-chips]', root);
    const moreEl = $('[data-psearch-more]', root);
    const sortEl = $('[data-psearch-sort]', root);
    const emptyEl = $('[data-psearch-empty]', root);
    const startEl = $('[data-psearch-start]', root);
    const bodyEl = $('[data-psearch-body]', root);
    let state = { f: {}, via: '' }, list = [], shown = 0, data;

    // Filters only the AI can set (min price, developer, handover, sold) survive
    // edits to the quick filters; a new sentence starts a fresh search.
    const EXTRA = ['pmin', 'dev', 'year', 'sold'];
    const inline = root.hasAttribute('data-psearch-inline');
    const bar = mountBar($('[data-psearch]', root) || $('[data-psearch]'), {
      onSubmit: (s) => {
        if (s.q) return run({ f: {}, q: s.q }, true);
        const keep = {}; EXTRA.forEach((k) => { if (state.f[k] !== undefined) keep[k] = state.f[k]; });
        if (s.f.pmax) delete keep.pmin;
        if (state.f.pmin >= TOP_PRICE && !s.f.pmin) delete keep.pmin;
        run({ f: { ...keep, ...s.f }, q: '' }, true);
      },
    });

    function sorted(arr) {
      const s = sortEl.value;
      const by = {
        'price-asc': (a, b) => (a.p1 || 9e15) - (b.p1 || 9e15),
        'price-desc': (a, b) => (b.p1 || 0) - (a.p1 || 0),
        'handover': (a, b) => (a.y || 9999) - (b.y || 9999),
        'new': (a, b) => (b.u > a.u ? 1 : -1),
      }[s];
      return by ? arr.slice().sort(by) : arr;
    }

    function render() {
      const any = Object.keys(state.f).filter((k) => k !== 'sold').length > 0;
      startEl.hidden = any; bodyEl.hidden = !any;
      root.classList.toggle('is-start', !any);
      chipsEl.innerHTML = chipsHTML(state.f, state.via);
      if (!any) return;
      list = sorted(data.projects.filter((p) => matches(p, state.f)));
      countEl.textContent = `${list.length.toLocaleString()} ${list.length === 1 ? 'project' : 'projects'}`;
      emptyEl.hidden = list.length > 0;
      root.classList.toggle('is-empty', list.length === 0);
      listEl.innerHTML = ''; shown = 0; more();
      drawMap(list);
    }

    function more() {
      listEl.insertAdjacentHTML('beforeend', list.slice(shown, shown + PAGE).map(cardHTML).join(''));
      shown = Math.min(shown + PAGE, list.length);
      moreEl.hidden = shown >= list.length;
      moreEl.textContent = `Show more (${(list.length - shown).toLocaleString()} left)`;
    }

    async function run({ f, q }, push) {
      data = data || await loadData();
      let via = '';
      if (q) {
        root.classList.add('is-thinking'); bar.classList.add('is-thinking');
        const u = await understand(q, data);
        root.classList.remove('is-thinking'); bar.classList.remove('is-thinking');
        // Quick filters the visitor set by hand win over what was read from the text.
        f = { ...u.f, ...f }; via = u.via;
      }
      if (state.f.sold && f.sold === undefined) f.sold = state.f.sold;
      if (NO_BEDS.includes(f.type)) delete f.beds;
      state = { f, via };
      // Keep the URL shareable: the words are replaced by the filters they produced.
      if (push) history.pushState(null, '', location.pathname + '?' + toQuery(f, '') + (inline ? '#property-search' : ''));
      syncBar(f, q);
      render();
      if (push && inline) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function syncBar(f, q) {
      bar.elements.pmax.innerHTML = priceOptions(f);
      ['loc', 'type', 'beds', 'status'].forEach((k) => { const el = bar.elements[k]; if (el) el.value = f[k] || ''; });
      bar.elements.q.value = q || '';
      if (bar.lockBeds) bar.lockBeds();
      $('[data-psearch-sold]', root).checked = !!f.sold;
    }

    chipsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-drop]'); if (!b) return;
      const f = { ...state.f }; delete f[b.dataset.drop];
      run({ f, q: '' }, true);
    });
    $('[data-psearch-sold]', root).addEventListener('change', (e) => {
      const f = { ...state.f }; if (e.target.checked) f.sold = '1'; else delete f.sold;
      run({ f, q: '' }, true);
    });
    sortEl.addEventListener('change', render);
    moreEl.addEventListener('click', more);
    const byId = (id) => data && data.projects.find((p) => String(p.id) === String(id));
    // A link ending in #project-123 opens that project's pop-up.
    const openFromHash = () => {
      const deep = location.hash.match(/^#project-(\d+)$/);
      if (deep && data) { const p = byId(deep[1]); if (p) openModal(p); }
    };
    window.addEventListener('hashchange', openFromHash);
    listEl.addEventListener('click', (e) => {
      if (e.target.closest('a, [data-fly]')) return;
      const card = e.target.closest('.pcard'); const p = card && byId(card.dataset.id);
      if (p) openModal(p);
    });
    listEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.pcard'); if (!card || e.target !== card) return;
      e.preventDefault(); const p = byId(card.dataset.id); if (p) openModal(p);
    });
    listEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fly]'); if (!b || !map) return;
      const m = markers[b.dataset.fly]; if (!m) return;
      $('[data-psearch-map]', root).scrollIntoView({ behavior: 'smooth', block: 'center' });
      cluster.zoomToShowLayer(m, () => m.openPopup());
    });
    root.querySelectorAll('[data-example]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault(); bar.elements.q.value = a.textContent.trim(); bar.requestSubmit();
    }));
    window.addEventListener('popstate', () => { const p = readParams(); run(p, false); });

    /* Home/Buy: before any search, narrow rows of projects. Each row's data-psearch-latest
       picks what it shows: "" or "latest" (most recently updated), "price" (highest price),
       "villas", "studios". */
    const rowEls = [...document.querySelectorAll('[data-psearch-latest]')];
    const ROWS = {
      latest: { keep: () => true, by: (a, b) => (b.u > a.u ? 1 : -1) },
      price: { keep: () => true, by: (a, b) => b.p1 - a.p1 },
      villas: { keep: (p) => p.t.includes('Villa'), by: (a, b) => (b.u > a.u ? 1 : -1) },
      studios: { keep: (p) => p.b1 === 0, by: (a, b) => (b.u > a.u ? 1 : -1) },
    };
    const plate = (p) => `
        <article class="plate" data-id="${p.id}" tabindex="0" role="button" aria-label="View ${esc(p.n)}">
          <img src="${esc(p.img)}" alt="" loading="lazy" decoding="async">
          <div><p class="plate__name">${esc(p.n)}</p><p class="plate__place">${esc(p.a || p.r || '')}</p><p class="plate__price">From ${esc(money(p.p1))}</p></div>
        </article>`;
    // Home: the same rows in the Curated Inventory style (portrait photo, name, spec, price).
    const bedsOf = (p) => (p.b1 == null ? '' : p.b1 === p.b2 ? (p.b1 === 0 ? 'Studio' : `${p.b1} BR`) : `${p.b1 === 0 ? 'Studio' : p.b1}–${p.b2} BR`);
    const tile = (p) => `
        <article class="tile prow-tile" data-id="${p.id}" tabindex="0" role="button" aria-label="View ${esc(p.n)}">
          <img src="${esc(p.img)}" alt="" loading="lazy" decoding="async">
          <span class="tile__body">
            <span class="tile__place">${esc(p.n)}</span>
            <span class="tile__spec">${esc([p.a || p.r, bedsOf(p)].filter(Boolean).join(' | '))}</span>
            <span class="tile__price">From AED ${esc(Math.round(p.p1).toLocaleString('en-US'))}</span>
          </span>
        </article>`;
    /* Home "Curated Inventory": four live Dubai projects per tab, in the same tile style. */
    const CURATED = {
      under2m: (p) => p.p1 < 2e6,
      waterfront: (p) => /palm|marina|creek harbour|dubai islands|bluewaters|beach|jbr|harbour|world of islands|maritime|mina rashid|la mer|jumeirah bay|waterfront/i.test(p.a || ''),
      villas: (p) => p.t.includes('Villa') || p.t.includes('Mansion'),
      over10m: (p) => p.p1 >= 1e7,
    };
    function curated(d) {
      const wrap = document.querySelector('[data-tiles]'); if (!wrap) return;
      const base = d.projects.filter((p) => p.img && p.ss !== 'Out of Stock' && p.p1 && p.r === 'Dubai').sort((a, b) => (b.u > a.u ? 1 : -1));
      // Up to 24 per tab: one project per area first, then the rest.
      const pick = (keep) => { const seen = new Set(); const all = base.filter(keep); const first = all.filter((p) => !seen.has(p.a) && seen.add(p.a)); return first.concat(all.filter((p) => !first.includes(p))).slice(0, 24); };
      // Shuffle each tab's first four, and never show the same project in the same slot on two tabs.
      const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [arr[i], arr[k]] = [arr[k], arr[i]]; } return arr; };
      const used = []; const lists = {};
      Object.entries(CURATED).forEach(([cat, keep]) => {
        const l = pick(keep); const head = shuffle(l.slice(0, 4));
        for (let tries = 0; tries < 20 && head.some((p, i) => used.some((u) => u[i] === p.id)); tries++) shuffle(head);
        used.push(head.map((p) => p.id)); lists[cat] = head.concat(l.slice(4));
      });
      if (!Object.values(lists).some((l) => l.length)) return;
      const tabs = [...document.querySelectorAll('.cats__tab')];
      const curCat = () => ((tabs.find((x) => x.getAttribute('aria-selected') === 'true') || tabs[0] || {}).dataset || {}).cat;
      let page = 0;
      // Arrows on the left and right edges, same as the rows below.
      const chev = (dd) => `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="${dd}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      wrap.classList.add('tiles--paged');
      wrap.insertAdjacentHTML('beforeend', `<button type="button" class="prow__arrow prow__arrow--prev" data-tiles-prev aria-label="Previous properties">${chev('M15 4l-8 8 8 8')}</button><button type="button" class="prow__arrow prow__arrow--next" data-tiles-next aria-label="More properties">${chev('M9 4l8 8-8 8')}</button>`);
      const aPrev = wrap.querySelector('[data-tiles-prev]'); const aNext = wrap.querySelector('[data-tiles-next]');
      const render = () => {
        const cat = curCat(); const l = lists[cat] || []; const pages = Math.max(1, Math.ceil(l.length / 4));
        page = (page + pages) % pages; // wraps round at either end
        wrap.querySelectorAll('.tile').forEach((x) => x.remove());
        wrap.insertAdjacentHTML('afterbegin', l.slice(page * 4, page * 4 + 4).map((p) => tile(p).replace('class="tile prow-tile"', `class="tile" data-cats="${cat}"`)).join(''));
        aPrev.hidden = aNext.hidden = pages < 2;
        wrap.dispatchEvent(new Event('tiles:changed'));
      };
      aPrev.addEventListener('click', () => { page--; render(); });
      aNext.addEventListener('click', () => { page++; render(); });
      tabs.forEach((x) => x.addEventListener('click', () => { page = 0; render(); }));
      render();
      const open = (e) => { const c = e.target.closest('.tile[data-id]'); const p = c && byId(c.dataset.id); if (p) openModal(p); };
      wrap.addEventListener('click', open);
      wrap.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.tile[data-id]')) { e.preventDefault(); open(e); } });
    }
    function latest(d) {
      curated(d);
      const base = d.projects.filter((p) => p.img && p.ss !== 'Out of Stock' && p.p1);
      rowEls.forEach((el) => {
        const r = ROWS[el.dataset.psearchLatest] || ROWS.latest;
        const tiles = !!el.closest('[data-row-style="tiles"]');
        el.innerHTML = base.filter(r.keep).sort(r.by).slice(0, tiles ? 20 : 14).map(tiles ? tile : plate).join('');
      });
    }
    rowEls.forEach((el) => {
      const open = (e) => { const c = e.target.closest('.plate, .prow-tile'); const p = c && byId(c.dataset.id); if (p) openModal(p); };
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } });
      const step = (dir) => el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
      const box = el.closest('.psearch-latest') || root;
      const prev = $('[data-latest-prev]', box); const next = $('[data-latest-next]', box);
      if (prev) prev.addEventListener('click', () => step(-1));
      if (next) next.addEventListener('click', () => step(1));
      // Buy rows: large arrows on the left and right page edges, over a narrow fade.
      if (el.closest('.psearch-rows')) {
        const wrap = document.createElement('div'); wrap.className = 'prow';
        el.parentNode.insertBefore(wrap, el); wrap.appendChild(el);
        const chev = (d) => `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        wrap.insertAdjacentHTML('beforeend', `<button type="button" class="prow__arrow prow__arrow--prev" aria-label="Scroll left">${chev('M15 4l-8 8 8 8')}</button><button type="button" class="prow__arrow prow__arrow--next" aria-label="Scroll right">${chev('M9 4l8 8-8 8')}</button>`);
        const [aPrev, aNext] = wrap.querySelectorAll('.prow__arrow');
        aPrev.addEventListener('click', () => step(-1)); aNext.addEventListener('click', () => step(1));
        const sync = () => { aPrev.hidden = el.scrollLeft < 8; aNext.hidden = el.scrollLeft + el.clientWidth > el.scrollWidth - 8; };
        el.addEventListener('scroll', sync, { passive: true }); window.addEventListener('resize', sync);
        new MutationObserver(sync).observe(el, { childList: true }); sync();
      }
    });

    loadData().then((d) => {
      data = d;
      latest(d);
      const upd = $('[data-psearch-updated]', root);
      if (upd && d.updated) upd.textContent = new Date(d.updated + 'Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      run(readParams(), false);
      openFromHash();
    }).catch(() => { listEl.innerHTML = '<p class="psearch__err">Listings could not be loaded. Please refresh the page.</p>'; bodyEl.hidden = false; startEl.hidden = true; });
  }

  /* ------------------------------------------------------------ start */
  function init() {
    const root = document.querySelector('[data-psearch-results]');
    if (root) results(root);
    if (!root) document.querySelectorAll('[data-psearch]').forEach((host) => mountBar(host));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // Exposed for testing in the console.
  window.ObelumSearch = { localParse, matches, loadData };
})();
