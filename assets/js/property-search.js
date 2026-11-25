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
  /* Speed (24 Nov 2026): project photos come from Reelly at full size (often 2-4 MB each). Rows and
     cards ask a free image service (wsrv.nl) for a small WebP copy instead (about 40 KB). If that
     service fails, the image falls back to the original (data-full) automatically. */
  // w, h: the size to fetch (about twice the size shown, for sharp phones and Retina screens). With h the
  // photo is cropped to that shape first, so a portrait tile gets a full-height picture, not a stretched strip.
  const IMG = (u, w, h) => (u && /^https:\/\/reelly-backend\.s3[^/]*\.amazonaws\.com\//.test(u)
    ? 'https://wsrv.nl/?url=' + encodeURIComponent(u.replace(/^https:\/\//, '')) + '&w=' + w + (h ? '&h=' + h + '&fit=cover' : '') + '&output=webp&q=74&we' : u);
  document.addEventListener('error', (e) => { const i = e.target; if (i && i.tagName === 'IMG' && i.dataset.full && i.src !== i.dataset.full) i.src = i.dataset.full; }, true);
  // Some browsers (Brave with Shields, some phone networks) block or stall the image service. If a photo has
  // not arrived after a few seconds, load the original straight from Reelly instead (24 Nov 2026).
  const guard = (img, ms) => {
    if (!img || !img.dataset.full || img.src === img.dataset.full) return;
    const want = img.src;
    setTimeout(() => { if (img.isConnected && img.src === want && !(img.complete && img.naturalWidth)) img.src = img.dataset.full; }, ms || 3500);
  };
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
  const moneyAED = (v) => v >= 1e6 ? `AED ${parseFloat((v / 1e6).toFixed(2))}M` : `AED ${Math.round(v / 1e3)}K`;

  /* ------------------------------------------------------------ visitor preferences */
  // Currency and area unit chosen on the map page (kept in this browser). Prices in the data are AED;
  // USD uses the dirham's fixed peg, other currencies a daily rate from open.er-api.com.
  const PREF_KEY = 'obelum.prefs', SAVED_KEY = 'obelum.saved';
  const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } } };
  // Currency, unit and saved projects are kept in first-party cookies for a year (this browser only).
  const cookie = {
    get(k) { const m = document.cookie.match(new RegExp('(?:^|; )' + k + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : null; },
    set(k, v) { document.cookie = `${k}=${encodeURIComponent(v)}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; },
  };
  const old = store.get(PREF_KEY, {}); // earlier versions kept these in localStorage
  const prefs = { cur: cookie.get('obelum_cur') || old.cur || 'AED', unit: cookie.get('obelum_unit') || old.unit || 'sqft' };
  const RATES = Object.assign({ AED: 1, USD: 1 / 3.6725 }, store.get('obelum.rates', {}).r || {});
  let ratesDay = (store.get('obelum.rates', {}).day) || '';
  function loadRates() {
    const today = new Date().toISOString().slice(0, 10);
    if (ratesDay === today) return Promise.resolve(RATES);
    return fetch('https://open.er-api.com/v6/latest/AED').then((r) => r.json()).then((j) => {
      if (j && j.rates) { Object.assign(RATES, j.rates, { AED: 1, USD: 1 / 3.6725 }); ratesDay = today; store.set('obelum.rates', { day: today, r: RATES }); }
      return RATES;
    }).catch(() => RATES);
  }
  const conv = (aed) => aed * (RATES[prefs.cur] || 1);
  const curNow = () => (RATES[prefs.cur] ? prefs.cur : 'AED');
  // Currency sign: AED stays as letters (the usual way to write dirhams); others use their symbol.
  const SIGN = { USD: '$', EUR: '€', GBP: '£', RUB: '₽', CNY: '¥', INR: '₹', SAR: 'SAR' };
  const withSign = (c, num) => (SIGN[c] && SIGN[c].length === 1 ? `${SIGN[c]}${num}` : `${SIGN[c] || c} ${num}`);
  // Full amount, e.g. "AED 2,500,000", "$680,735", "€612,400".
  const moneyFull = (v) => { const c = curNow(); return withSign(c, Math.round(v * RATES[c]).toLocaleString('en-US')); };
  // Short amount, e.g. "AED 2.5M", "$680K".
  const money = (v) => {
    const c = curNow(), x = v * RATES[c];
    return withSign(c, x >= 1e6 ? `${parseFloat((x / 1e6).toFixed(2))}M` : `${Math.round(x / 1e3)}K`);
  };
  const setPref = (k, v) => { prefs[k] = v; cookie.set(k === 'cur' ? 'obelum_cur' : 'obelum_unit', v); document.dispatchEvent(new CustomEvent('obelum:prefs', { detail: prefs })); };
  if (prefs.cur !== 'AED' && prefs.cur !== 'USD') loadRates().then(() => document.dispatchEvent(new CustomEvent('obelum:prefs', { detail: prefs })));

  // Saved projects (heart), kept in this browser.
  const savedCookie = cookie.get('obelum_saved');
  const saved = new Set((savedCookie != null ? savedCookie.split('.') : store.get(SAVED_KEY, [])).map(String).filter(Boolean));
  const isSaved = (id) => saved.has(String(id));
  function toggleSaved(id) {
    id = String(id); if (saved.has(id)) saved.delete(id); else saved.add(id);
    cookie.set('obelum_saved', [...saved].join('.'));
    document.querySelectorAll(`[data-save="${id}"]`).forEach((b) => { b.classList.toggle('is-on', saved.has(id)); b.setAttribute('aria-pressed', String(saved.has(id))); });
    document.dispatchEvent(new CustomEvent('obelum:saved', { detail: { id, on: saved.has(id), count: saved.size } }));
  }
  const HEART_SVG = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 16.5s-6.2-3.7-6.2-8.2A3.4 3.4 0 0 1 10 6.4a3.4 3.4 0 0 1 6.2 1.9c0 4.5-6.2 8.2-6.2 8.2z" fill="currentColor" fill-opacity="var(--heart-fill, 0)" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-save]'); if (!b) return;
    e.preventDefault(); e.stopPropagation(); toggleSaved(b.dataset.save);
  }, true);
  document.addEventListener('keydown', (e) => {
    const b = e.target.closest && e.target.closest('[data-save][role="button"]');
    if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); toggleSaved(b.dataset.save); }
  }, true);
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* ------------------------------------------------------------ data */
  let dataPromise;
  const LOGOS = {};
  function loadData() {
    if (!dataPromise) {
      // Projects, plus each one's headline payment plan ("60/40": before / at and after the keys).
      dataPromise = Promise.all([
        fetch(DATA_URL, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('data ' + r.status); return r.json(); }),
        fetch('data/payments.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
        fetch('data/cards.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
        fetch('data/developers.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      ]).then(([d, pay, cards, devs]) => {
        // Handover as the developer writes it ("Q2 2027"), the plan in words, and the developer logo.
        ((devs && devs.developers) || []).forEach((x) => (x.dv || []).forEach((n) => { LOGOS[n] = x.file || x.logo; }));
        (d.projects || []).forEach((p) => {
          const v = pay[p.id]; if (v && v[3]) p.pp = v[3] === '100/0' ? '100%' : `${v[3]}%`;
          const c = cards[p.id]; if (c) { p.ho = c[0]; p.ppx = c[1]; }
        });
        return d;
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

  /* Misspelled names: "soba", "shoba", "sohba" -> Sobha; "emar" -> Emaar; "busines bay" -> Business Bay.
     Compares each word (and 2-3 word group) of the sentence with every developer and area name:
     the same letters without h's and doubled letters count as a match, and so does one wrong,
     missing, extra or swapped letter (two for names of 8+ letters). */
  const skel = (s) => s.replace(/h/g, '').replace(/(.)\1+/g, '$1');
  function editDist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = []; for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      let rowMin = Infinity;
      for (let j = 1; j <= b.length; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        rowMin = Math.min(rowMin, d[i][j]);
      }
      if (rowMin > max) return max + 1;
    }
    return d[a.length][b.length];
  }
  const DEV_SUFFIX = /\b(properties|property|developers?|development|developments|group|real estate|llc|holding|holdings)\b/g;
  let fuzzyCache = null;
  function fuzzyLists(data) {
    if (fuzzyCache && fuzzyCache.data === data) return fuzzyCache;
    const devs = new Map(), places = new Map();
    data.projects.forEach((p) => {
      if (p.dv) { const k = norm(p.dv).replace(DEV_SUFFIX, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); if (k.length > 2) devs.set(k, (devs.get(k) || 0) + 1); }
      [p.a, p.r].forEach((pl) => { if (!pl) return; const k = norm(pl).replace(/\s*\(.*\)\s*/, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); if (k.length > 2) { const e = places.get(k) || { v: pl.replace(/\s*\(.*\)\s*/, ''), n: 0 }; e.n++; places.set(k, e); } });
    });
    Object.keys(ALIASES).forEach((k) => { if (k.length > 3 && !places.has(k)) places.set(k, { v: ALIASES[k], n: 1 }); });
    fuzzyCache = { data, devs: [...devs].map(([k, n]) => ({ k, v: k, n, w: k.split(' ').length })), places: [...places].map(([k, e]) => ({ k, v: e.v, n: e.n, w: k.split(' ').length })) };
    return fuzzyCache;
  }
  const COMMON = new Set(('nice good great best new big small cheap luxury luxurious modern quiet sea view views beach water waterfront '
    + 'garden pool gym park city centre center high low floor room rooms bath baths sale rent rental investment payment plan plans '
    + 'post handover something anything some any like near nearby close central family kids school metro mall golf island lake '
    + 'brand branded residence residences tower towers building project projects community').split(' '));
  function fuzzyFind(words, list, skip = new Set()) {
    let best = null;
    for (let n = 3; n >= 1; n--) for (let i = 0; i + n <= words.length; i++) {
      const part = words.slice(i, i + n);
      if (part.some((w) => skip.has(w)) || part.every((w) => KNOWN.has(w) || COMMON.has(w) || /\d/.test(w))) continue;
      const g = part.join(' '); if (g.replace(/ /g, '').length < 4) continue;
      const sg = skel(g);
      for (const c of list) {
        if (c.w !== n) continue;
        // 4-letter names only by sound ("emar" = Emaar), so ordinary words ("nice") are not read as names.
        const lim = c.k.length >= 8 ? 2 : c.k.length >= 5 ? 1 : 0;
        let d = (sg.length >= 3 && sg === skel(c.k)) ? 0.5 : editDist(g, c.k, lim);
        if (d === 0) d = 0.1; // exact (already handled by the normal reader, but keep it if it lands here)
        if (d <= lim && (!best || d < best.d || (d === best.d && c.n > best.n))) best = { d, v: c.v, n: c.n, i, len: n };
      }
    }
    return best;
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
    for (const [w, v] of typeWords) if (new RegExp(`\\b${w}s?\\b`).test(t)) { f.type = v; break; }

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
    // Nothing found by exact name: try misspellings.
    if (data) {
      const L = fuzzyLists(data);
      const words = t.trim().split(/\s+/).map((w) => w.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')).filter(Boolean);
      const fw = [];
      // Words already read as the area or developer are not read again.
      const used = new Set(norm((f.loc || '') + ' ' + (f.dev || '')).split(/[^a-z0-9]+/).filter(Boolean));
      Object.keys(ALIASES).forEach((k) => { if (new RegExp(`\\b${k}\\b`).test(t)) k.split(' ').forEach((w) => used.add(w)); });
      const dv = !f.dev ? fuzzyFind(words, L.devs, used) : null;
      // An area: also look when the exact reader only found a shorter part of it ("dubai hils" -> Dubai Hills, not Dubai).
      let lc = fuzzyFind(words, L.places, f.dev ? used : new Set());
      if (lc && f.loc && !(lc.len > 1 && norm(lc.v).includes(norm(f.loc)) && norm(lc.v) !== norm(f.loc))) lc = null;
      const overlap = dv && lc && dv.i < lc.i + lc.len && lc.i < dv.i + dv.len;
      // Same words read as both: the closer match wins, then the longer one, then the developer.
      const devWins = !overlap || dv.d < lc.d || (dv.d === lc.d && dv.len >= lc.len);
      if (dv && devWins) { f.dev = dv.v; fw.push(...words.slice(dv.i, dv.i + dv.len)); }
      if (lc && (!overlap || !devWins)) { f.loc = lc.v; fw.push(...words.slice(lc.i, lc.i + lc.len)); }
      if (fw.length) Object.defineProperty(f, '_fw', { value: fw, enumerable: false });
    }
    return f;
  }

  // A sentence the built-in reader fully understands does not need the AI: every word is a known
  // search word, a number or part of the area it found. Saves most AI calls.
  const KNOWN = new Set(('a an the in at on near around close to for of with and or i im want need looking look find show me get '
    + 'buy buying sale please my family invest investment property properties home homes unit units bed beds bedroom bedrooms br bhk bd '
    + 'studio studios apartment apartments flat flats villa villas townhouse townhouses town house houses penthouse penthouses duplex '
    + 'office offices retail shop shops under below less than up upto max maximum budget within over above more min minimum starting '
    + 'from between aed dhs dirham dirhams m mn mil million millions k thousand off plan offplan ready completed move handover completion '
    + 'by before q1 q2 q3 q4 new launch pre prelaunch construction dubai uae one two three four five six').split(' '));
  function isSimple(text, f) {
    if (!Object.keys(f).length) return false;
    const t = norm(text);
    const aliasWords = Object.keys(ALIASES).filter((a) => new RegExp(`\\b${a}\\b`).test(t)).join(' ');
    const placeWords = norm((f.loc || '') + ' ' + (f.dev || '') + ' ' + aliasWords).split(/[^a-z0-9]+/).filter(Boolean);
    return t.split(/[^a-z0-9.,-]+/).filter(Boolean).every((w) => {
      const word = w.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
      return !word || KNOWN.has(word) || placeWords.includes(word) || (f._fw && f._fw.includes(word)) || /^[\d.,]+(m|mn|k)?$/.test(word)
        || /^\d+(bed|beds|br|bhk|bd)$/.test(word) || /^off-?plan$/.test(word) || /^pre-?launch$/.test(word);
    });
  }
  // Answers the AI gave in this browser are remembered, so the same sentence never asks twice.
  const AI_MEMO = 'obelum-ai-memo';
  const memo = {
    get: (k) => { try { return (JSON.parse(localStorage.getItem(AI_MEMO) || '{}'))[k] || null; } catch (e) { return null; } },
    set: (k, v) => { try { const all = JSON.parse(localStorage.getItem(AI_MEMO) || '{}'); all[k] = v; const ks = Object.keys(all); if (ks.length > 150) delete all[ks[0]]; localStorage.setItem(AI_MEMO, JSON.stringify(all)); } catch (e) {} },
  };

  async function understand(text, data) {
    const local = localParse(text, data);
    if (isSimple(text, local)) return { f: local, via: 'local', note: '' };
    const mk = norm(text).replace(/\s+/g, ' ').trim();
    const seen = memo.get(mk); if (seen) return seen;
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
          const ans = { f, via: 'ai', note: j.note || '' }; memo.set(mk, ans); return ans;
        }
      }
    } catch (e) { /* fall through to the built-in reader */ }
    return { f: local, via: 'local', note: '' };
  }

  /* ---------------------------------------------------- the search bar */
  function opt(v, label, sel) { return `<option value="${esc(v)}"${String(sel) === String(v) ? ' selected' : ''}>${esc(label)}</option>`; }

  function priceSel(f) { return f.pmax ? String(f.pmax) : (Number(f.pmin) >= TOP_PRICE ? 'top' : ''); }
  function priceOptions(f) {
    const sel = priceSel(f);
    const list = [...new Set([...PRICES, ...(f.pmax && +f.pmax !== TOP_PRICE ? [+f.pmax] : [])])].sort((a, b) => a - b);
    return opt('', 'Any', sel) + list.map((p) => opt(p, moneyAED(p).replace('AED ', ''), sel)).join('') + opt('top', '+10M', sel);
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

  /* Location: a real dropdown (the browser's own suggestion list barely shows on phones). Opens on
     tap with every area A to Z, narrows as you type; arrow keys, Enter and Esc work. */
  let placeNames = null;
  const getPlaces = () => placeNames || loadData().then((d) => {
    // UAE only: the emirate in the data, or (when it is missing) coordinates inside the UAE.
    const UAE = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras al-Khaimah', 'Umm al-Quwain', 'Fujairah'];
    const inUAE = (p) => (p.r ? UAE.includes(p.r) : (p.la > 22.5 && p.la < 26.3 && p.lo > 51.5 && p.lo < 56.5));
    const set = new Set(); d.projects.filter(inUAE).forEach((p) => [p.a, p.r].forEach((x) => { if (x) set.add(x.replace(/\s+/g, ' ').trim()); }));
    placeNames = [...set].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })); return placeNames;
  });
  function placeMenu(form) {
    const input = form.elements.loc; if (!input) return;
    input.removeAttribute('list');
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('ul'); menu.className = 'psearch__menu'; menu.setAttribute('role', 'listbox'); menu.hidden = true;
    document.body.appendChild(menu);
    let items = [], active = -1;
    const place = () => { const r = input.closest('.psearch__field').getBoundingClientRect(); menu.style.left = (r.left + scrollX) + 'px'; menu.style.top = (r.bottom + scrollY + 6) + 'px'; menu.style.width = Math.max(r.width, 240) + 'px'; };
    const close = () => { menu.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
    const mark = () => { [...menu.children].forEach((li, i) => li.classList.toggle('is-active', i === active)); if (menu.children[active]) menu.children[active].scrollIntoView({ block: 'nearest' }); };
    const open = async () => {
      const all = await getPlaces(); const q = norm(input.value.trim());
      items = q ? all.filter((x) => norm(x).includes(q)) : all;
      menu.innerHTML = (q ? '' : '<li class="psearch__menu-any" data-v="">Any area</li>')
        + (items.length ? items.map((x) => `<li role="option" data-v="${esc(x)}">${esc(x)}</li>`).join('') : '<li class="psearch__menu-none">No area by that name</li>');
      active = -1; place(); menu.hidden = false; input.setAttribute('aria-expanded', 'true');
    };
    const pick = (li) => { if (!li || li.classList.contains('psearch__menu-none')) return; input.value = li.dataset.v; close(); input.dispatchEvent(new Event('change', { bubbles: true })); };
    input.addEventListener('focus', open);
    input.addEventListener('click', () => { if (menu.hidden) open(); });
    input.addEventListener('input', open);
    input.addEventListener('keydown', (e) => {
      if (menu.hidden && (e.key === 'ArrowDown')) { open(); return; }
      if (menu.hidden) return;
      const n = menu.children.length;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(n - 1, active + 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); mark(); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(menu.children[active]); }
      else if (e.key === 'Escape') close();
    });
    menu.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the field while choosing
    menu.addEventListener('click', (e) => pick(e.target.closest('li')));
    input.addEventListener('blur', () => setTimeout(close, 120));
    window.addEventListener('resize', () => { if (!menu.hidden) place(); });
    window.addEventListener('scroll', () => { if (!menu.hidden) place(); }, { passive: true });
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
    placeMenu(form);
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
    <div class="pcard" data-id="${p.id}" tabindex="0" role="button" aria-label="View ${esc(p.n)}">
      <div class="pcard__media">
        ${p.img ? `<img src="${esc(IMG(p.img, 800, 600))}" data-full="${esc(p.img)}" alt="" loading="lazy" decoding="async">` : ''}
        <span class="pcard__badge">${esc(status)}</span>
        ${p.ss === 'Out of Stock' ? '<span class="pcard__badge pcard__badge--sold">Sold out</span>' : ''}
      </div>
      <div class="pcard__body">
        <p class="pcard__place">${esc([p.a, p.r].filter(Boolean).join(', '))}</p>
        <h3 class="pcard__name">${esc(p.n)}</h3>
        <p class="pcard__dev">${esc(p.dv || '')}</p>
        <p class="pcard__price">${esc(price)}${p.pp ? `<span class="pcard__plan">Payment plan ${esc(p.pp)}</span>` : ''}</p>
        <p class="pcard__spec">${esc([beds, types].filter(Boolean).join(' · '))}</p>
        <div class="pcard__actions">
          <a class="pcard__btn" href="https://wa.me/${WHATSAPP}?text=${msg}" target="_blank" rel="noopener">Enquire</a>
          <button class="pcard__map" type="button" data-fly="${p.id}">On map</button>
        </div>
      </div>
    </div>`;
  }

  function chipsHTML(f, via) {
    const L = {
      loc: (v) => v, type: (v) => TYPE_LABEL[v] || v, beds: (v) => v === '0' ? 'Studio' : v === '5' ? '5+ beds' : v === '1' ? '1 bed' : `${v} beds`,
      pmin: (v) => `From ${moneyAED(+v)}`, pmax: (v) => `Up to ${moneyAED(+v)}`, status: (v) => v === 'ready' ? 'Ready' : 'Off-plan',
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
    css('assets/vendor/leaflet/leaflet.css'); // our own copies: no third-party code CDN
    css('assets/vendor/leaflet/MarkerCluster.css');
    leafletPromise = js('assets/vendor/leaflet/leaflet.js')
      .then(() => js('assets/vendor/leaflet/leaflet.markercluster.js'));
    return leafletPromise;
  }

  let map, cluster, markers = {};
  function ensureMap(el) {
    if (map || !window.L) return map;
    map = L.map(el, { scrollWheelZoom: false, zoomControl: true }).setView([25.15, 55.25], 10);
    baseLayer().addTo(map);
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

  // Payment-plan (i) on catalogue cards: tap shows the plan in words, without opening the pop-up.
  document.addEventListener('click', (e) => {
    const i = e.target.closest && e.target.closest('.rinfo');
    document.querySelectorAll('.rinfo.is-open').forEach((x) => x !== i && x.classList.remove('is-open'));
    if (i) { e.stopPropagation(); e.preventDefault(); i.classList.toggle('is-open'); }
  }, true);

  /* ------------------------------------------------------------ share */
  // Any [data-share] button shares the current page (with #project-123 while a pop-up is open).
  // Phones open the device's own share sheet (every installed app); elsewhere a small menu.
  const SHARE_SVG = '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M10 13V3M6 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 10v6.5h12V10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  let shareMenu;
  function closeShare() { if (shareMenu) shareMenu.hidden = true; }
  function openShare(btn) {
    const url = btn.dataset.shareUrl || location.href; // a button may share a specific link (e.g. a saved list)
    const title = btn.dataset.shareTitle || document.title;
    const text = `${title} — Obelum Properties`;
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      navigator.share({ title: text, text, url }).catch(() => {});
      return;
    }
    const u = encodeURIComponent(url), t = encodeURIComponent(text);
    const links = [
      ['WhatsApp', `https://wa.me/?text=${t}%20${u}`],
      ['Telegram', `https://t.me/share/url?url=${u}&text=${t}`],
      ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
      ['X', `https://twitter.com/intent/tweet?url=${u}&text=${t}`],
      ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
      ['Email', `mailto:?subject=${t}&body=${t}%0A${u}`],
    ];
    if (!shareMenu) {
      shareMenu = document.createElement('div');
      shareMenu.className = 'pshare-menu'; shareMenu.setAttribute('role', 'menu'); shareMenu.hidden = true;
      document.body.appendChild(shareMenu);
      shareMenu.addEventListener('click', (e) => {
        const c = e.target.closest('[data-share-copy]');
        if (c) {
          e.preventDefault();
          const done = () => { c.textContent = 'Link copied'; setTimeout(closeShare, 900); };
          (navigator.clipboard ? navigator.clipboard.writeText(c.dataset.shareCopy) : Promise.reject()).then(done).catch(() => { window.prompt('Copy this link:', c.dataset.shareCopy); closeShare(); });
          return;
        }
        if (e.target.closest('[data-share-native]')) { navigator.share({ title: text, text, url }).catch(() => {}); closeShare(); return; }
        if (e.target.closest('a')) setTimeout(closeShare, 50);
      });
    }
    shareMenu.innerHTML = `<p class="pshare-menu__head">Share this page</p>${links.map(([n, h]) => `<a role="menuitem" href="${esc(h)}" target="_blank" rel="noopener">${n}</a>`).join('')}<button type="button" role="menuitem" data-share-copy="${esc(url)}">Copy link</button>${navigator.share ? '<button type="button" role="menuitem" data-share-native>More apps…</button>' : ''}`;
    shareMenu.hidden = false;
    const r = btn.getBoundingClientRect(), m = shareMenu.getBoundingClientRect();
    const top = r.top - m.height - 8 > 8 ? r.top - m.height - 8 : Math.min(r.bottom + 8, innerHeight - m.height - 8);
    shareMenu.style.top = `${Math.max(8, top)}px`;
    shareMenu.style.left = `${Math.min(Math.max(8, r.left), innerWidth - m.width - 8)}px`;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-share]');
    if (b) { e.preventDefault(); if (shareMenu && !shareMenu.hidden) closeShare(); else openShare(b); return; }
    if (shareMenu && !shareMenu.hidden && !e.target.closest('.pshare-menu')) closeShare();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeShare(); }, true);
  addEventListener('scroll', closeShare, { passive: true });

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
  const sqft = (v) => (prefs.unit === 'm2' ? `${Math.round(v * 0.092903).toLocaleString()} m²` : `${Math.round(v).toLocaleString()} sq ft`);

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
    if (main) { main.dataset.full = photos[galleryIdx]; main.src = IMG(photos[galleryIdx], 1400); guard(main); }
    const count = modal.querySelector('[data-gal-count]');
    if (count) count.textContent = `${galleryIdx + 1} / ${photos.length}`;
    modal.querySelectorAll('[data-thumb]').forEach((t) => t.classList.toggle('is-on', Number(t.dataset.thumb) === galleryIdx));
    const on = modal.querySelector('[data-thumb].is-on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // Reelly sometimes lists the same picture twice under different addresses. Compare a 16x16
  // fingerprint of each photo (via the image service, which allows reading pixels) and drop repeats.
  const hashCache = {};
  function photoHash(u) {
    if (hashCache[u]) return hashCache[u];
    hashCache[u] = new Promise((ok) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = c.height = 16;
          const x = c.getContext('2d'); x.drawImage(im, 0, 0, 16, 16);
          const d = x.getImageData(0, 0, 16, 16).data, g = [];
          for (let i = 0; i < d.length; i += 4) g.push(d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11);
          const m = g.reduce((a, b) => a + b, 0) / g.length;
          ok(g.map((v) => (v > m ? 1 : 0)));
        } catch (e) { ok(null); }
      };
      im.onerror = () => ok(null);
      setTimeout(() => ok(null), 6000);
      im.src = `https://wsrv.nl/?url=${encodeURIComponent(String(u).replace(/^https?:\/\//, ''))}&w=16&h=16&fit=fill&output=png`;
    });
    return hashCache[u];
  }
  const sameHash = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n <= 10; };
  async function dedupeGallery(body, photos) {
    if (photos.length < 2) return;
    const hs = await Promise.all(photos.map(photoHash));
    const keep = [];
    photos.forEach((u, i) => { if (!hs[i] || !keep.some((k) => hs[k.i] && sameHash(hs[k.i], hs[i]))) keep.push({ u, i }); });
    if (keep.length === photos.length || !body.isConnected || modalProject.photos !== photos) return;
    const cur = photos[galleryIdx];
    modalProject.photos = keep.map((k) => k.u);
    const box = body.querySelector('.pgal__thumbs');
    if (box) {
      box.innerHTML = keep.map((k, n) => `<button type="button" data-thumb="${n}" aria-label="Photo ${n + 1}"><img src="${esc(IMG(k.u, 200))}" data-full="${esc(k.u)}" alt=""></button>`).join('');
      if (keep.length < 2) box.remove();
    }
    if (keep.length < 2) body.querySelectorAll('.pgal__nav, [data-gal-count]').forEach((e) => e.remove());
    const at = modalProject.photos.indexOf(cur);
    galleryIdx = at < 0 ? 0 : at; showPhoto(galleryIdx);
  }

  function modalHTML(p, d) {
    const photos = [...new Set((d && d.photos && d.photos.length ? d.photos : [p.img]).filter(Boolean))];
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
        <div class="pgal__stage"${p.img ? ` style="background:#d7d0c7 url('${esc(IMG(p.img, 600, 800))}') center/cover no-repeat"` : ''}>
          ${photos.length ? `<img data-gal-main src="${esc(IMG(photos[0], 1400))}" data-full="${esc(photos[0])}" alt="${esc(p.n)}">` : ''}
          ${photos.length > 1 ? `
            <button class="pgal__nav pgal__nav--prev" type="button" data-gal="-1" aria-label="Previous photo">&#8249;</button>
            <button class="pgal__nav pgal__nav--next" type="button" data-gal="1" aria-label="Next photo">&#8250;</button>
            <span class="pgal__count" data-gal-count>1 / ${photos.length}</span>` : ''}
        </div>
        ${photos.length > 1 ? `<div class="pgal__thumbs">${photos.map((u, i) => `<button type="button" data-thumb="${i}" class="${i ? '' : 'is-on'}" aria-label="Photo ${i + 1}"><img src="${esc(IMG(u, 200))}" data-full="${esc(u)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
      </div>
      <header class="pmodal__head">
        <p class="pcard__place">${esc([p.a, p.r].filter(Boolean).join(', '))}</p>
        <h2 class="pmodal__title" id="pmodal-title">${esc(p.n)}</h2>
        <p class="pmodal__dev">${esc(p.dv ? 'by ' + p.dv : '')}</p>
      </header>
      <dl class="pfacts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${units}${plans}${desc}${amen}${near}
      ${p.la && p.lo ? `<section class="pmodal__sec"><h3>Location</h3><div class="pmodal__map" data-pmap aria-label="Map of ${esc(p.n)}"></div><p class="pmodal__mapcap">${esc([p.a, p.r].filter(Boolean).join(', '))} &middot; <a href="https://www.google.com/maps/search/?api=1&amp;query=${p.la}%2C${p.lo}" target="_blank" rel="noopener">Open in Google Maps</a></p></section>` : ''}
      ${d ? '' : '<p class="pmodal__loading">Loading project details…</p>'}
      <div class="pmodal__cta">
        <a class="pcard__btn" href="https://wa.me/${WHATSAPP}?text=${msg}" target="_blank" rel="noopener">Enquire on WhatsApp</a>
        <button type="button" class="pcard__btn pshare-btn psave-btn${isSaved(p.id) ? ' is-on' : ''}" data-save="${p.id}" aria-pressed="${isSaved(p.id)}" aria-label="Save project">${HEART_SVG}<span>Save</span></button>
        <button type="button" class="pcard__btn pshare-btn" data-share data-share-title="${esc(p.n)}${p.dv ? ' by ' + esc(p.dv) : ''}" aria-haspopup="true">Share ${SHARE_SVG}</button>
        <p>Prices are developer starting prices and change often. An advisor will confirm availability.</p>
      </div>`;
  }

  // Light grey map tiles (Esri, free, no key) with place names on top. CARTO now asks for a key.
  const baseLayer = () => L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, attribution: 'Tiles &copy; Esri' }),
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16 }),
  ]);

  // Location map at the bottom of the pop-up (Leaflet is loaded only when needed; Home and Buy do not carry it).
  async function drawModalMap(p) {
    const el = modal && modal.querySelector('[data-pmap]'); if (!el || !p.la || !p.lo) return;
    try { await loadLeaflet(); } catch (e) { el.remove(); return; } // no map library: keep the area and the Google Maps link
    if (!el.isConnected || el._map) return;
    const m = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true }).setView([p.la, p.lo], 14);
    baseLayer().addTo(m);
    L.circleMarker([p.la, p.lo], { radius: 10, color: '#4A3522', weight: 2, fillColor: '#B39F74', fillOpacity: 0.95 }).addTo(m).bindTooltip(p.n, { direction: 'top', offset: [0, -8] });
    el._map = m; setTimeout(() => m.invalidateSize(), 150);
  }

  async function openModal(p) {
    ensureModal();
    lastFocus = document.activeElement;
    const body = modal.querySelector('[data-pmodal-body]');
    body.innerHTML = modalHTML(p, null);
    drawModalMap(p);
    galleryIdx = 0;
    modal.hidden = false;
    document.documentElement.classList.add('pmodal-open');
    modal.querySelector('.pmodal__dialog').focus();
    modal.querySelector('.pmodal__dialog').scrollTop = 0;
    if (location.hash !== `#project-${p.id}`) history.replaceState(history.state, '', `${location.pathname}${location.search}#project-${p.id}`);
    const d = await loadDetail(p.id);
    if (!modal.hidden && body.isConnected) { body.innerHTML = modalHTML(p, d || {}); showPhoto(0); drawModalMap(p); body.querySelectorAll('[data-thumb] img').forEach((i) => guard(i, 5000)); dedupeGallery(body, modalProject.photos); }
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
      // A new sentence keeps "Include sold out"; unticking the box itself must be able to turn it off.
      if (q && state.f.sold && f.sold === undefined) f.sold = state.f.sold;
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
    /* Rows on Home and Buy (rules from Nico, 23 Nov 2026; also written above the sections in index.html and buy.html):
       latest     Latest launches  = most recent by date
       price      Highest tickets  = highest price first
       villas     Villas           = villas only
       townhouses Townhouses       = townhouses only
       apartments Apartments       = apartments, mixed 1, 2, 3, 4 and 5+ BR (Dubai, picked at random)
       studios    Studios          = studios only
       offices    Offices          = office projects (Buy, after the rows above)
       area       (Home, 24 Nov)   = one area per row: Palm Jumeirah, Dubai South, Dubai Marina, Business Bay, Downtown Dubai */
    const newest = (a, b) => (b.u > a.u ? 1 : -1);
    const only = (p, types) => p.t.length > 0 && p.t.every((x) => types.includes(x));
    const BRANDED = /\b(Four Seasons|Ritz[- ]Carlton|Jumeirah (Living|Asora|Marsa)|W Residences|Residences by W|Mandarin Oriental|Aman|Six Senses|Dorchester|Waldorf|Fairmont|Address (Residences|Resorts|Grand|Hotel)|by Address|Palace Residences|by Palace|Sofitel|Autograph Collection|Marriott|Anantara|Mr\.? C|Habtoor Grand|Do Hotel|The Chedi|Rove Home|by Rove|Rotana|FIVE (Jumeirah|Palm|Luxe|Residences)|Paramount|Armani|Bulgari|Bvlgari|Cavalli|Elie Saab|Missoni|Baccarat|Trussardi|Bentley|Bugatti|Aston Martin|Mercedes[- ]Benz|Maserati|Jacob & Co|Dior|Fendi|Versace|Pagani|Lamborghini|Porsche Design|Tonino Lamborghini)\b/i;
    const NOT_BRANDED = /\b(Park Five|Barari Palace)\b/i;
    const ROWS = {
      // Latest launches: newest projects first by Reelly id (a higher id = added later), so every data update
      // brings the newly added projects to the front of this row on Home and Buy (Nico, 24 Nov 2026).
      latest: { keep: () => true, by: (a, b) => b.id - a.id },
      price: { keep: () => true, by: (a, b) => b.p1 - a.p1 },
      // Branded Projects (Home + Buy, 24 Nov 2026): Dubai residences named after an international hotel, fashion,
      // design, car or jewellery brand, newest first. Whole brand names only ("Park Five", "Barari Palace" and
      // community names like Jumeirah Village are not brands).
      branded: { keep: (p) => p.r === 'Dubai' && (BRANDED.test(p.n) || /\bEDITION\b/.test(p.n)) && !NOT_BRANDED.test(p.n), by: (a, b) => b.id - a.id },
      villas: { keep: (p) => only(p, ['Villa', 'Mansion']), by: newest },
      townhouses: { keep: (p) => only(p, ['Townhouse']), by: newest },
      apartments: { keep: (p) => p.r === 'Dubai' && p.t.includes('Apartments') && p.b2 >= 1, by: () => 0, mix: true },
      studios: { keep: (p) => p.b1 === 0 && p.b2 === 0, by: newest },
      offices: { keep: (p) => p.t.includes('Office'), by: newest },
    };
    // Picked by Nico (24 Nov 2026): these projects lead their row, in this order, then the row carries on as usual.
    // Ids from data/projects.json. Palm Springs is shown even while Reelly marks it out of stock.
    //   latest: Palm Springs, Kore by Imtiaz, Binghatti Etherea, Sawa Residences, Maybach Ultimate Luxury,
    //           The Edit at d3, Terra Woods, Salva, Albero, Creek Bay, Avarra by Palace
    //   Dubai South (area row): Palm Springs, Terra Woods, then every Dubai South project
    const PINS = { latest: [4189, 4098, 3246, 4016, 3303, 3071, 3283, 3203, 2479, 3101, 3114], 'dubai south': [4189, 3283] };
    // Catalogue card (as on the map page): photo with status + handover, developer logo, name,
    // "District · by Developer", then Price from and Payment plan (with the plan in words on the (i)).
    const SS = { 'Presale (EOI)': 'EOI', 'Out of Stock': 'Sold out' };
    const plate = (p) => {
      const logo = LOGOS[p.dv], own = logo && /assets\/img\/devs\//.test(logo);
      const ho = p.st === 'ready' ? 'Ready' : p.ho || (p.y ? String(p.y) : '');
      return `
        <div class="plate rcard" data-id="${p.id}" tabindex="0" role="button" aria-label="View ${esc(p.n)}">
          <img class="rcard__img" src="${esc(IMG(p.img, 480, 640))}" data-full="${esc(p.img)}" alt="" loading="lazy" decoding="async">
          <span class="rcard__pills"><i>${esc(SS[p.ss] || p.ss || '')}</i>${ho ? `<i>${esc(ho)}</i>` : ''}</span>
          ${logo ? `<span class="rcard__logo${own ? ' rcard__logo--dark' : ''}"><img src="${esc(logo)}" alt="" loading="lazy" decoding="async"></span>` : ''}
          <div class="rcard__body">
            <p class="plate__name">${esc(p.n)}</p>
            <p class="plate__place">${esc([p.a || p.r, p.dv ? 'by ' + p.dv : ''].filter(Boolean).join(' \u2022 '))}</p>
            <span class="rcard__nums">
              <strong class="rcard__price">${p.p1 ? 'From ' + esc(moneyFull(p.p1)) : 'Price on request'}</strong>
              ${p.pp ? `<span class="rcard__plan"><small>Payment plan</small><strong>${esc(p.pp)}${p.ppx ? `<i class="rinfo" tabindex="0" data-tip="${esc(p.ppx)}" aria-label="Payment plan: ${esc(p.ppx)}"><svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 9v4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="6.4" r="1" fill="currentColor"/></svg></i>` : ''}</strong></span>` : ''}
            </span>
          </div>
        </div>`;
    };
    // Home: the same rows in the Curated Inventory style (portrait photo, name, spec, price).
    const bedsOf = (p) => (p.b1 == null ? '' : p.b1 === p.b2 ? (p.b1 === 0 ? 'Studio' : `${p.b1} BR`) : `${p.b1 === 0 ? 'Studio' : p.b1}–${p.b2} BR`);
    const tile = (p) => `
        <div class="tile prow-tile" data-id="${p.id}" tabindex="0" role="button" aria-label="View ${esc(p.n)}">
          <img src="${esc(IMG(p.img, 600, 800))}" data-full="${esc(p.img)}" alt="" loading="lazy" decoding="async">
          <span class="tile__body">
            <span class="tile__place">${esc(p.n)}</span>
            <span class="tile__spec">${esc([p.a || p.r, bedsOf(p)].filter(Boolean).join(' | '))}</span>
            <span class="tile__price">${p.p1 ? 'From AED ' + esc(Math.round(p.p1).toLocaleString('en-US')) : 'Price on request'}</span>
            ${p.pp ? `<span class="tile__plan">Payment plan ${esc(p.pp)}</span>` : ''}
          </span>
        </div>`;
    /* Curated Inventory on Home (rules from Nico, 23 Nov 2026; removed from Buy the same day): four Dubai projects at a time, arrows for more.
       under2m    Under -2 million = starting price under AED 2M
       waterfront Waterfront       = waterfront areas
       villas     Villas & Estates = villas and mansions
       over10m    Over +10 million = starting price from AED 10M */
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
      // Four properties at a time on desktop and tablets, two on phones (Nico, 24 Nov 2026).
      const phone = window.matchMedia('(max-width: 40rem)'); const per = () => (phone.matches ? 2 : 4);
      // Arrows on the left and right edges, same as the rows below.
      const chev = (dd) => `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="${dd}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      wrap.classList.add('tiles--paged');
      wrap.insertAdjacentHTML('beforeend', `<button type="button" class="prow__arrow prow__arrow--prev" data-tiles-prev aria-label="Previous properties">${chev('M15 4l-8 8 8 8')}</button><button type="button" class="prow__arrow prow__arrow--next" data-tiles-next aria-label="More properties">${chev('M9 4l8 8-8 8')}</button>`);
      const aPrev = wrap.querySelector('[data-tiles-prev]'); const aNext = wrap.querySelector('[data-tiles-next]');
      const render = () => {
        const cat = curCat(); const l = lists[cat] || []; const n = per(); const pages = Math.max(1, Math.ceil(l.length / n));
        page = (page + pages) % pages; // wraps round at either end
        wrap.querySelectorAll('.tile').forEach((x) => x.remove());
        wrap.insertAdjacentHTML('afterbegin', l.slice(page * n, page * n + n).map((p) => tile(p).replace('class="tile prow-tile"', `class="tile" data-cats="${cat}"`)).join(''));
        aPrev.hidden = aNext.hidden = pages < 2;
        wrap.dispatchEvent(new Event('tiles:changed'));
      };
      // Slide the new four in from the side they came from.
      const go = (dir) => { page += dir; render(); wrap.classList.remove('is-slide-next', 'is-slide-prev'); void wrap.offsetWidth; wrap.classList.add(dir > 0 ? 'is-slide-next' : 'is-slide-prev'); };
      aPrev.addEventListener('click', () => go(-1));
      aNext.addEventListener('click', () => go(1));
      // Phones and tablets: swipe left or right to see the next or previous four.
      let sx = 0, sy = 0, swiping = false;
      wrap.addEventListener('touchstart', (e) => { const t0 = e.touches[0]; sx = t0.clientX; sy = t0.clientY; swiping = true; }, { passive: true });
      wrap.addEventListener('touchend', (e) => {
        if (!swiping) return; swiping = false;
        const t1 = e.changedTouches[0]; const dx = t1.clientX - sx; const dy = t1.clientY - sy;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3 && !aNext.hidden) { wrap._swiped = Date.now(); go(dx < 0 ? 1 : -1); }
      }, { passive: true });
      tabs.forEach((x) => x.addEventListener('click', () => { page = 0; render(); }));
      phone.addEventListener('change', () => { page = 0; render(); });
      render();
      const open = (e) => { if (wrap._swiped && Date.now() - wrap._swiped < 400) return; const c = e.target.closest('.tile[data-id]'); const p = c && byId(c.dataset.id); if (p) openModal(p); };
      wrap.addEventListener('click', open);
      wrap.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.tile[data-id]')) { e.preventDefault(); open(e); } });
    }
    // Home "Top Developers" row (24 Nov 2026): one tile per developer from Property Finder's UAE list
    // (pages 1-3, data/developers.json), each with the photo of its newest project here and its logo
    // on top. Logos are cropped to the same visible size; clicking opens that developer's projects.
    const devTile = (v) => {
      const [x0, y0, x1, y1] = v.box; const [W, H] = v.size || [256, 256]; const bw = x1 - x0 + 1; const bh = y1 - y0 + 1; const A = 3; // logo box is 3:1
      const k = 0.92 * Math.min(1 / bw, 1 / (A * bh)); // box width = 1; a small margin so no edge is clipped
      const left = (1 - bw * k) / 2 - x0 * k; const top = ((1 / A - bh * k) / 2 - y0 * k) * A;
      const href = 'search.html?' + new URLSearchParams({ dev: v.dv[0] }).toString();
      return `
        <a class="tile prow-tile dtile${v.dark ? ' dtile--dark' : ''}" href="${esc(href)}" aria-label="${esc(v.name)}: ${v.count} projects">
          <img src="${esc(IMG(v.p.img, 600, 800))}" data-full="${esc(v.p.img)}" alt="" loading="lazy" decoding="async">
          ${v.file ? `<span class="dtile__logo dtile__logo--own" aria-hidden="true"><img src="${esc(v.file)}" alt="" loading="lazy" decoding="async"></span>` : `<span class="dtile__logo" aria-hidden="true"><img src="${esc(v.logo)}" alt="" loading="lazy" decoding="async" style="width:${(W * k * 100).toFixed(2)}%;aspect-ratio:${W} / ${H};left:${(left * 100).toFixed(2)}%;top:${(top * 100).toFixed(2)}%"></span>`}
          <span class="tile__body">
            <span class="tile__place">${esc(v.name)}</span>
            <span class="tile__spec">${esc(v.count + (v.count === 1 ? ' project' : ' projects'))}</span>
          </span>
        </a>`;
    };
    function developers(el, d) {
      fetch('data/developers.json', { cache: 'no-cache' }).then((r) => r.json()).then((dd) => {
        const live = d.projects.filter((p) => p.img && p.ss !== 'Out of Stock' && p.p1);
        const used = new Set();
        const list = dd.developers.map((v) => {
          const mine = live.filter((p) => v.dv.includes(p.dv)).sort(newest);
          const p = mine.find((x) => !used.has(x.img)) || mine[0]; if (p) used.add(p.img);
          return Object.assign({}, v, { p, count: mine.length });
        }).filter((v) => v.p);
        el.innerHTML = list.map(devTile).join(''); // each developer once (no endless repeat)
      }).catch(() => { const box = el.closest('.psearch-latest'); if (box) box.hidden = true; });
    }
    function latest(d) {
      curated(d);
      const base = d.projects.filter((p) => p.img && p.ss !== 'Out of Stock' && p.p1);
      rowEls.forEach((el) => {
        if (el.dataset.psearchLatest === 'developers') return developers(el, d);
        // Area rows (Home): data-psearch-latest="area" data-area="Dubai Marina" = projects in that area, newest first.
        const areaName = el.dataset.area && norm(el.dataset.area.replace(/\u00a0/g, ' '));
        const r = areaName ? { keep: (p) => norm((p.a || '').replace(/\u00a0/g, ' ')) === areaName, by: newest } : (ROWS[el.dataset.psearchLatest] || ROWS.latest);
        const tiles = !!el.closest('[data-row-style="tiles"]');
        const n = 48; // a long list per row; the row then repeats it endlessly as you scroll
        let list;
        if (r.mix) {
          // Take turns: a project with 1 bedroom, then 2, 3, 4, 5+, and round again, picked at random.
          const pool = base.filter(r.keep).sort(() => Math.random() - 0.5); const seen = new Set(); list = [];
          for (let round = 0; list.length < n && round < n; round++) {
            [1, 2, 3, 4, 5].forEach((b) => {
              if (list.length >= n) return;
              const p = pool.find((x) => !seen.has(x.id) && x.b1 <= b && (b === 5 ? x.b2 >= 5 : x.b2 >= b));
              if (p) { seen.add(p.id); list.push(p); }
            });
          }
        } else list = base.filter(r.keep).sort(r.by).slice(0, n);
        const pinIds = PINS[areaName || el.dataset.psearchLatest] || [];
        if (pinIds.length) {
          const pins = pinIds.map((id) => d.projects.find((p) => p.id === id)).filter((p) => p && p.img);
          // Projects added after the picks were chosen always come first, then the picks, then the rest.
          const fresh = el.dataset.psearchLatest === 'latest' ? list.filter((p) => p.id > Math.max(...pinIds) && !pinIds.includes(p.id)) : [];
          list = fresh.concat(pins, list.filter((p) => !pinIds.includes(p.id) && !fresh.includes(p))).slice(0, n);
        }
        el._html = list.map(tiles ? tile : plate).join('');
        el.innerHTML = el._html.repeat(Math.max(1, Math.ceil(18 / Math.max(1, list.length)))); // one round to start (lighter page; short lists repeated to fill); more are added near the end
        el.dataset.endless = '1';
      });
    }
    rowEls.forEach((el) => {
      const open = (e) => { const c = e.target.closest('.plate, .prow-tile'); const p = c && byId(c.dataset.id); if (p) openModal(p); };
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('a')) { e.preventDefault(); open(e); } });
      // Endless: when the row gets close to its end, the same list is added again.
      const grow = () => { if (el._html && el.scrollLeft + el.clientWidth > el.scrollWidth - el.clientWidth * 2) el.insertAdjacentHTML('beforeend', el._html); };
      el.addEventListener('scroll', grow, { passive: true });
      const step = (dir) => { if (dir > 0) grow(); el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' }); };
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
  window.ObelumSearch = { localParse, understand, matches, loadData, isSimple, openModal, IMG, money, moneyFull, SHARE_SVG, HEART_SVG, prefs, setPref, loadRates, conv, curNow, isSaved, saved, toggleSaved };
})();
