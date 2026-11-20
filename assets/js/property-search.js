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
  const PRICES = [500000, 750000, 1000000, 1500000, 2000000, 3000000, 5000000, 10000000, 20000000];

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
  const money = (v) => v >= 1e6 ? `AED ${(v / 1e6).toFixed(v >= 1e7 ? 0 : 2).replace(/\.?0+$/, '')}M` : `AED ${Math.round(v / 1e3)}K`;
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

  function barHTML(f, q) {
    return `
    <form class="psearch__form" role="search" novalidate>
      <label class="psearch__ai">
        <span class="psearch__spark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z M19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" fill="currentColor"/></svg>
        </span>
        <span class="visually-hidden">Describe what you are looking for</span>
        <input class="psearch__q" name="q" type="search" value="${esc(q)}" autocomplete="off"
          placeholder="${matchMedia('(max-width: 40rem)').matches ? 'Describe what you’re looking for…' : 'Try “2-bed off-plan in Business Bay under 2.5M, handover 2027”'}">
        <button class="psearch__go" type="submit">Search</button>
      </label>
      <div class="psearch__filters">
        <label class="psearch__field psearch__field--loc"><span>Location</span>
          <input name="loc" list="psearch-places" value="${esc(f.loc || '')}" placeholder="Any area" autocomplete="off"></label>
        <label class="psearch__field"><span>Type</span>
          <select name="type">${opt('', 'Any', f.type)}${TYPES.map((t) => opt(t, TYPE_LABEL[t] || t, f.type)).join('')}</select></label>
        <label class="psearch__field"><span>Beds</span>
          <select name="beds">${opt('', 'Any', f.beds)}${opt('0', 'Studio', f.beds)}${[1, 2, 3, 4].map((b) => opt(b, b, f.beds)).join('')}${opt('5', '5+', f.beds)}</select></label>
        <label class="psearch__field"><span>Max price</span>
          <select name="pmax">${opt('', 'Any', f.pmax)}${[...new Set([...PRICES, ...(f.pmax ? [+f.pmax] : [])])].sort((a, b) => a - b).map((p) => opt(p, money(p), f.pmax)).join('')}</select></label>
        <label class="psearch__field"><span>Status</span>
          <select name="status">${opt('', 'Any', f.status)}${opt('offplan', 'Off-plan', f.status)}${opt('ready', 'Ready', f.status)}</select></label>
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
      dl.innerHTML = Object.keys(count).sort((a, b) => count[b] - count[a]).slice(0, 300)
        .map((x) => `<option value="${esc(x)}">`).join('');
    }).catch(() => {});
  }

  function mountBar(host, { onSubmit } = {}) {
    const { f, q } = readParams();
    host.innerHTML = barHTML(f, q);
    const form = host.querySelector('form');
    form.addEventListener('focusin', () => fillPlaces(form), { once: true });
    const gather = () => {
      const fd = new FormData(form);
      const nf = {};
      ['loc', 'type', 'beds', 'pmax', 'status'].forEach((k) => { const v = (fd.get(k) || '').toString().trim(); if (v) nf[k] = v; });
      return { f: nf, q: (fd.get('q') || '').toString().trim() };
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const s = gather();
      if (onSubmit) onSubmit(s);
      else location.href = 'search?' + toQuery(s.f, s.q);
    });
    // On the results page, the quick filters apply as soon as they change.
    if (onSubmit) form.querySelectorAll('select, input[name=loc]').forEach((el) =>
      el.addEventListener('change', () => { const s = gather(); onSubmit({ f: s.f, q: '' }); }));
    return form;
  }

  /* ------------------------------------------------- the results page */
  function cardHTML(p) {
    const price = p.p1 ? `From ${money(p.p1)}` : 'Price on request';
    const beds = p.b1 === null ? '' : p.b1 === p.b2 ? (p.b1 === 0 ? 'Studio' : `${p.b1} bed`) : `${p.b1 === 0 ? 'Studio' : p.b1}–${p.b2} bed`;
    const types = p.t.map((t) => TYPE_LABEL[t] || t).slice(0, 3).join(' · ');
    const status = p.st === 'ready' ? 'Ready' : (p.y ? `Off-plan · ${p.y}` : 'Off-plan');
    const msg = encodeURIComponent(`Hi Obelum, I'm interested in ${p.n}${p.a ? ' (' + p.a + ')' : ''}. Could you send me details?`);
    return `
    <article class="pcard" data-id="${p.id}">
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
      loc: (v) => v, type: (v) => TYPE_LABEL[v] || v, beds: (v) => v === '0' ? 'Studio' : v === '5' ? '5+ beds' : `${v} beds`,
      pmin: (v) => `From ${money(+v)}`, pmax: (v) => `Up to ${money(+v)}`, status: (v) => v === 'ready' ? 'Ready' : 'Off-plan',
      dev: (v) => `Developer: ${v}`, year: (v) => `Handover by ${v}`, sold: () => 'Incl. sold out',
    };
    const chips = KEYS.filter((k) => f[k] !== undefined).map((k) =>
      `<button type="button" class="pchip" data-drop="${k}" aria-label="Remove ${esc(L[k](f[k]))}">${esc(L[k](f[k]))}<span aria-hidden="true">×</span></button>`);
    if (!chips.length) return '';
    return `<span class="pchips__lead">${via === 'ai' ? 'AI understood' : 'Searching for'}</span>${chips.join('')}`;
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

  function drawMap(list) {
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
    const bar = mountBar($('[data-psearch]', root), {
      onSubmit: (s) => {
        if (s.q) return run({ f: {}, q: s.q }, true);
        const keep = {}; EXTRA.forEach((k) => { if (state.f[k] !== undefined) keep[k] = state.f[k]; });
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
      chipsEl.innerHTML = chipsHTML(state.f, state.via);
      if (!any) return;
      list = sorted(data.projects.filter((p) => matches(p, state.f)));
      countEl.textContent = `${list.length.toLocaleString()} ${list.length === 1 ? 'project' : 'projects'}`;
      emptyEl.hidden = list.length > 0;
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
        root.classList.add('is-thinking');
        const u = await understand(q, data);
        root.classList.remove('is-thinking');
        // Quick filters the visitor set by hand win over what was read from the text.
        f = { ...u.f, ...f }; via = u.via;
      }
      if (state.f.sold && f.sold === undefined) f.sold = state.f.sold;
      state = { f, via };
      // Keep the URL shareable: the words are replaced by the filters they produced.
      if (push) history.pushState(null, '', 'search?' + toQuery(f, ''));
      syncBar(f, q);
      render();
    }

    function syncBar(f, q) {
      const ps = bar.elements.pmax;
      if (f.pmax && ![...ps.options].some((o) => o.value === String(f.pmax))) {
        const o = new Option(money(+f.pmax), f.pmax);
        const after = [...ps.options].find((x) => x.value && +x.value > +f.pmax);
        ps.add(o, after || null);
      }
      ['loc', 'type', 'beds', 'pmax', 'status'].forEach((k) => { const el = bar.elements[k]; if (el) el.value = f[k] || ''; });
      bar.elements.q.value = q || '';
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

    loadData().then((d) => {
      data = d;
      const upd = $('[data-psearch-updated]', root);
      if (upd && d.updated) upd.textContent = new Date(d.updated + 'Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      run(readParams(), false);
    }).catch(() => { listEl.innerHTML = '<p class="psearch__err">Listings could not be loaded. Please refresh the page.</p>'; bodyEl.hidden = false; startEl.hidden = true; });
  }

  /* ------------------------------------------------------------ start */
  function init() {
    const root = document.querySelector('[data-psearch-results]');
    if (root) results(root);
    document.querySelectorAll('[data-psearch]').forEach((host) => { if (!host.closest('[data-psearch-results]')) mountBar(host); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // Exposed for testing in the console.
  window.ObelumSearch = { localParse, matches, loadData };
})();
