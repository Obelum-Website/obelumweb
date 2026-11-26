/* Obelum design panel (v4). Loads only when the page URL contains ?edit.
   Click any element to select it and adjust it. Save keeps the changes in this
   browser and, once a GitHub key is connected, publishes them to the preview
   branch as real CSS (design/<page>.json + assets/css/design/<page>.css, text
   edits written into <page>.html). "Copy my changes" remains as a fallback. */
(() => {
  const PALETTE = [
    ['Anthracite', '#2D302F'], ['Deep Umber', '#4A3522'], ['Raw Umber', '#7A5938'], ['Obelum Gold', '#B39F74'],
    ['Smoke', '#8E8B85'], ['Timberwolf', '#D7D0C7'], ['Chalk White', '#F7F5F1'], ['White', '#FFFFFF'],
  ];
  /* Font menu: the two brand fonts first, then a few extra Google fonts (loaded only when used). */
  const FONTS = [
    ['Gilda Display (brand headings)', '"Gilda Display", Georgia, serif', ''],
    ['Montserrat (brand text)', 'Montserrat, system-ui, sans-serif', ''],
    ['Cormorant Garamond', '"Cormorant Garamond", Georgia, serif', 'Cormorant+Garamond:wght@300;400;500;600'],
    ['Playfair Display', '"Playfair Display", Georgia, serif', 'Playfair+Display:wght@400;500;600'],
    ['Lora', 'Lora, Georgia, serif', 'Lora:wght@400;500;600'],
    ['Inter', 'Inter, system-ui, sans-serif', 'Inter:wght@300;400;500;600'],
    ['Raleway', 'Raleway, system-ui, sans-serif', 'Raleway:wght@300;400;500;600'],
    ['Poppins', 'Poppins, system-ui, sans-serif', 'Poppins:wght@300;400;500;600'],
  ];
  const fontUrl = (fam) => { const f = FONTS.find((x) => x[1] === fam); return f && f[2] ? 'https://fonts.googleapis.com/css2?family=' + f[2] + '&display=swap' : ''; };
  const loadFont = (fam) => { const u = fontUrl(fam); if (u && !document.querySelector('link[href="' + u + '"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = u; document.head.appendChild(l); } };
  /* Button actions: pages a link can go to. */
  const PAGES = [['index.html', 'Home'], ['buy.html', 'Buy'], ['rent.html', 'Rent'], ['sell.html', 'Sell'], ['search.html', 'Property search'], ['agents.html', 'Agents (Cloud Brokerage)'], ['process.html', 'How-to'], ['contact.html', 'Contact us'], ['login.html', 'Log in']];
  const WA = '971586033881';
  /* One change list per page file: /agents, /agents.html and /obelumweb/agents share it. */
  const PAGE = ((location.pathname.split('/').pop() || 'index').replace(/\.html$/, '')) || 'index';
  const KEY = 'obelum-edit4:' + PAGE;
  let PUBLISHED = window.__obPublished || {}; // what was on the preview when this tab opened
  /* Bring over edits saved with the previous panel (v3, stored per address). Not for the agents
     page: Claude built those into the site by hand on Nov 23. */
  try {
    if (PAGE !== 'agents' && !localStorage.getItem(KEY) && !localStorage.getItem(KEY + ':draft') && !localStorage.getItem(KEY + ':migrated') && !Object.keys(PUBLISHED).length) {
      let best = null; let bestAt = '';
      Object.keys(localStorage).forEach((k) => {
        const m = k.match(/^obelum-edit3:(.*?)(:draft)?$/); if (!m || /:at$/.test(k)) return;
        const pg = ((m[1].split('/').pop() || 'index').replace(/\.html$/, '')) || 'index'; if (pg !== PAGE) return;
        const at = m[2] ? 'z' : (localStorage.getItem('obelum-edit3:' + m[1] + ':at') || '');
        if (!best || at > bestAt) { best = k; bestAt = at; }
      });
      if (best) { const old = JSON.parse(localStorage.getItem(best) || '{}'); if (Object.keys(old).length) localStorage.setItem(KEY + ':draft', JSON.stringify(old)); }
      localStorage.setItem(KEY + ':migrated', '1');
    }
  } catch (e) {}
  let changes = {};
  /* Start from what is published. A copy kept in this browser is used only if it is newer than the
     published file; an older one (made before the last publish or fix) would show a different page. */
  let usedDraft = false;
  try {
    const pubAt = Date.parse(window.__obPublishedAt || '') || 0;
    const num = (k) => Number(localStorage.getItem(KEY + k)) || 0;
    const dAt = num(':dat'); const sAt = Date.parse(localStorage.getItem(KEY + ':at') || '') || 0;
    const draft = localStorage.getItem(KEY + ':draft'); const kept = localStorage.getItem(KEY);
    if (draft && dAt > pubAt) { changes = JSON.parse(draft); usedDraft = true; }
    else if (kept && sAt > pubAt) changes = JSON.parse(kept);
    else { changes = JSON.parse(JSON.stringify(PUBLISHED)); if (draft || kept) { localStorage.removeItem(KEY + ':draft'); localStorage.removeItem(KEY); } }
  } catch (e) { changes = JSON.parse(JSON.stringify(PUBLISHED)); }
  var markSave; var publish;
  let dirty = false;
  const save = () => { try { localStorage.setItem(KEY + ':draft', JSON.stringify(changes)); localStorage.setItem(KEY + ':dat', String(Date.now())); } catch (e) {} dirty = true; if (typeof markSave === 'function') markSave(); };
  const saveNow = () => { try { localStorage.setItem(KEY, JSON.stringify(changes)); localStorage.removeItem(KEY + ':draft'); localStorage.setItem(KEY + ':at', new Date().toISOString()); } catch (e) {} dirty = false; markSave(); if (typeof publish === 'function') publish(); };

  /* The panel redraws every published change itself, so switch off the page's
     published design stylesheet: what you see is exactly what Save will write. */
  document.querySelectorAll('link[href*="assets/css/design/"]').forEach((l) => { l.disabled = true; });

  /* ---------------------------------------------------------------- styles */
  const css = document.createElement('style');
  css.textContent = `
  .ob-hov { outline: 1px dashed rgba(179,159,116,.9) !important; outline-offset: 2px; cursor: crosshair !important; }
  .ob-sel { outline: 2px solid #B39F74 !important; outline-offset: 3px; }
  #obr { position: fixed; inset: 0; z-index: 2147482990; pointer-events: none; font: 10px/1 system-ui, -apple-system, "Segoe UI", sans-serif; }
  #obr[hidden] { display: none; }
  #obr canvas { position: absolute; pointer-events: auto; cursor: crosshair; }
  #obr .rx { left: 0; top: 0; height: 20px; width: 100%; cursor: col-resize; }
  #obr .ry { left: 0; top: 0; width: 20px; height: 100%; cursor: row-resize; }
  #obr .corner { position: absolute; left: 0; top: 0; width: 20px; height: 20px; background: #1c1d1c; border-right: 1px solid rgba(247,245,241,.25); border-bottom: 1px solid rgba(247,245,241,.25); z-index: 2; pointer-events: auto; }
  #obr .ln { position: absolute; pointer-events: none; }
  #obr .ln.v { top: 20px; bottom: 0; width: 0; border-left: 1px dashed rgba(179,159,116,.85); }
  #obr .ln.h { left: 20px; right: 0; height: 0; border-top: 1px dashed rgba(179,159,116,.85); }
  #obr .gd { position: absolute; pointer-events: auto; }
  #obr .gd.v { top: 20px; bottom: 0; width: 9px; margin-left: -4px; cursor: col-resize; background: linear-gradient(to right, transparent 4px, #3FB6E0 4px, #3FB6E0 5px, transparent 5px); }
  #obr .gd.h { left: 20px; right: 0; height: 9px; margin-top: -4px; cursor: row-resize; background: linear-gradient(to bottom, transparent 4px, #3FB6E0 4px, #3FB6E0 5px, transparent 5px); }
  #obr .gd span, #obr .tag { position: absolute; background: #1c1d1c; color: #EDEAE4; padding: 3px 5px; border-radius: 4px; white-space: nowrap; pointer-events: none; }
  #obr .gd.v span { top: 6px; left: 8px; } #obr .gd.h span { left: 6px; top: 8px; }
  #obr .tag { color: #1c1d1c; background: #B39F74; font-weight: 600; }
  #obr .gap { position: absolute; pointer-events: none; border-color: #E07A5F; }
  #obr .gap.v { width: 0; border-left: 1px solid #E07A5F; } #obr .gap.h { height: 0; border-top: 1px solid #E07A5F; }
  #obr .gap span { position: absolute; background: #E07A5F; color: #fff; padding: 2px 4px; border-radius: 3px; white-space: nowrap; }
  #obr .gap.v span { left: 4px; top: 50%; transform: translateY(-50%); } #obr .gap.h span { top: 4px; left: 50%; transform: translateX(-50%); }
  #obp { position: fixed; z-index: 2147483000; top: 76px; right: 14px; width: 320px; max-height: calc(100vh - 92px); display: flex; flex-direction: column;
    background: #1c1d1c; color: #EDEAE4; border: 1px solid rgba(247,245,241,.12); border-radius: 14px; box-shadow: 0 24px 60px rgba(0,0,0,.45);
    font: 12px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
  #obp * { box-sizing: border-box; font-family: inherit; letter-spacing: normal; text-transform: none; font-style: normal; }
  #obp .hd { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-bottom: 1px solid rgba(247,245,241,.08); cursor: move; user-select: none; }
  #obp .hd b { flex: 1; font-size: 12.5px; font-weight: 600; color: #B39F74; }
  #obp .ic { width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(247,245,241,.14); background: rgba(247,245,241,.04); color: #EDEAE4; cursor: pointer; display: grid; place-items: center; font-size: 13px; padding: 0; }
  #obp .ic:hover { border-color: #B39F74; }
  #obp .ic:disabled { opacity: .35; cursor: default; }
  #obp .bd { overflow: auto; padding: 2px 0 6px; }
  #obp .sel { margin: 5px 12px; padding: 6px 9px; border-radius: 10px; background: rgba(247,245,241,.05); }
  #obp .sel .t { color: #fff; font-weight: 500; word-break: break-word; }
  #obp .crumbs { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
  #obp .crumbs button { border: 1px solid rgba(247,245,241,.14); background: none; color: #BDB7AE; border-radius: 6px; padding: 2px 6px; font-size: 11px; cursor: pointer; }
  #obp .crumbs button.on { border-color: #B39F74; color: #B39F74; }
  #obp details { border-top: 1px solid rgba(247,245,241,.07); }
  #obp summary { list-style: none; cursor: pointer; padding: 7px 12px; font-size: 11px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: #B39F74; display: flex; justify-content: space-between; }
  #obp summary::-webkit-details-marker { display: none; }
  #obp summary::after { content: "+"; color: #8E8B85; font-weight: 400; }
  #obp details[open] summary::after { content: "–"; }
  #obp .grp { padding: 0 12px 8px; display: grid; gap: 6px; }
  #obp .row { display: grid; grid-template-columns: 88px 1fr 54px; align-items: center; gap: 6px; }
  #obp .row > span { color: #BDB7AE; }
  #obp input[type=range] { width: 100%; accent-color: #B39F74; }
  #obp input[type=number], #obp input[type=text] { all: unset; box-sizing: border-box !important; display: block !important; width: 100% !important; height: 26px !important; padding: 0 6px !important; border-radius: 6px !important; border: 1px solid rgba(247,245,241,.16) !important; background: rgba(247,245,241,.06) !important; color: #fff !important; -webkit-text-fill-color: #fff !important; font: 12px/26px system-ui, -apple-system, sans-serif !important; text-indent: 0 !important; }
  #obp input[type=color] { width: 30px; height: 26px; padding: 0; border: 1px solid rgba(247,245,241,.2); border-radius: 6px; background: none; cursor: pointer; }
  #obp .seg { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid rgba(247,245,241,.16); border-radius: 8px; overflow: hidden; }
  #obp .seg button { padding: 5px 0; background: none; border: 0; border-right: 1px solid rgba(247,245,241,.1); color: #EDEAE4; cursor: pointer; font-size: 12px; }
  #obp .seg button:last-child { border-right: 0; }
  #obp .seg button.on { background: #B39F74; color: #1c1d1c; font-weight: 600; }
  #obp .ticks { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; }
  #obp .ticks label { display: flex; align-items: center; gap: 7px; cursor: pointer; color: #EDEAE4; }
  #obp .ticks input { accent-color: #B39F74; width: 15px; height: 15px; }
  #obp .sw { display: grid; grid-template-columns: repeat(8, 1fr); gap: 5px; }
  #obp .sw button { height: 22px; border-radius: 6px; border: 1px solid rgba(247,245,241,.22); cursor: pointer; padding: 0; }
  #obp .sw button.on { outline: 2px solid #B39F74; outline-offset: 1px; }
  #obp .col { display: flex !important; gap: 8px; align-items: center; }
  #obp .col input[type=color] { flex: 0 0 30px !important; width: 30px !important; }
  #obp .col input[type=text] { flex: 1 1 auto !important; width: auto !important; min-width: 0 !important; }
  #obp .col > .btn, #obp .col > .note { flex: 0 0 auto; }
  #obp .btn { padding: 5px 9px; border-radius: 8px; border: 1px solid rgba(247,245,241,.18); background: rgba(247,245,241,.04); color: #EDEAE4; cursor: pointer; font-size: 12px; }
  #obp .btn:hover { border-color: #B39F74; }
  #obp .btn.gold { background: #B39F74; border-color: #B39F74; color: #1c1d1c; font-weight: 600; }
  #obp .note { color: #8E8B85; font-size: 11px; }
  #obp .list { display: grid; gap: 4px; max-height: 160px; overflow: auto; }
  #obp .list div { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; padding: 5px 7px; border-radius: 6px; background: rgba(247,245,241,.04); }
  #obp .list span { color: #D7D0C7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #obp .list button { background: none; border: 0; color: #8E8B85; cursor: pointer; font-size: 14px; }
  #obp .ft { padding: 8px 12px; border-top: 1px solid rgba(247,245,241,.08); display: grid; gap: 6px; }
  #obp .ft .two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  #obp.min .bd, #obp.min .ft { display: none; }
  #obp .off { opacity: .4; pointer-events: none; }
  #obp textarea { all: unset; box-sizing: border-box !important; display: block !important; width: 100% !important; min-height: 64px; padding: 7px 8px !important; border-radius: 8px !important; border: 1px solid rgba(247,245,241,.18) !important; background: rgba(247,245,241,.06) !important; color: #fff !important; -webkit-text-fill-color: #fff !important; font: 13px/1.45 system-ui, -apple-system, sans-serif !important; white-space: pre-wrap !important; resize: vertical !important; cursor: text !important; }
  #obp textarea:focus { border-color: #B39F74 !important; }
  #obp select { all: unset; box-sizing: border-box !important; display: block !important; width: 100% !important; height: 28px !important; padding: 0 26px 0 8px !important; border-radius: 6px !important; border: 1px solid rgba(247,245,241,.16) !important; color: #fff !important; font: 12px/28px system-ui, -apple-system, sans-serif !important; cursor: pointer !important;
    background: rgba(247,245,241,.06) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23B39F74' stroke-width='1.5'/%3E%3C/svg%3E") no-repeat right 9px center !important; }
  #obp select option { color: #1c1d1c; background: #fff; }
  #obp .note:empty { display: none; }
  #obp .ticks.one { grid-template-columns: 1fr; }
  #obp [hidden] { display: none !important; }`;
  document.head.appendChild(css);
  const veilCss = document.createElement('style');
  veilCss.textContent = '[data-ob-veil]:not(#_o):not(#_o):not(#_o)::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: rgba(28,30,29,var(--ob-veil)) !important; }';
  document.head.appendChild(veilCss);

  /* --------------------------------------------------------------- helpers */
  const toHex = (c) => {
    const m = String(c).match(/[\d.]+/g); if (!m) return '#000000';
    return '#' + m.slice(0, 3).map((n) => Math.round(+n).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const alphaOf = (c) => { const m = String(c).match(/[\d.]+/g); return m && m.length > 3 ? +m[3] : (String(c) === 'transparent' ? 0 : 1); };
  const sectionOf = (el) => el.closest('section, header.site-header, footer, .site-header');
  const secName = (sec) => {
    if (!sec) return 'body';
    if (sec.id) return '#' + sec.id;
    const c = [...sec.classList].find((x) => !x.startsWith('ob-') && x !== 'section') || sec.classList[0];
    return c ? sec.tagName.toLowerCase() + '.' + c : sec.tagName.toLowerCase();
  };
  const own = (n) => [...n.classList].filter((c) => !c.startsWith('ob-') && !/^(is-|kb$|reveal|in$)/.test(c));
  const selectorFor = (el) => {
    const sec = sectionOf(el);
    if (el === sec) return secName(sec);
    const parts = []; let n = el;
    while (n && n !== sec && n !== document.body) {
      let s = n.tagName.toLowerCase();
      const cls = own(n);
      if (cls.length) s += '.' + cls.join('.');
      const p = n.parentElement;
      if (p) { const same = [...p.children].filter((x) => x.tagName === n.tagName && own(x).join('.') === cls.join('.')); if (same.length > 1) s += `:nth-of-type(${[...p.children].filter((x) => x.tagName === n.tagName).indexOf(n) + 1})`; }
      parts.unshift(s);
      const full = (sec ? secName(sec) + ' ' : '') + parts.join(' > ');
      try { if (document.querySelectorAll(full).length === 1) return full; } catch (e) {}
      n = p;
    }
    return ((sec ? secName(sec) + ' ' : '') + parts.join(' > ')).trim();
  };
  const describe = (el) => {
    const t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (el.tagName === 'IMG') return 'Image';
    return t ? '“' + (t.length > 54 ? t.slice(0, 54) + '…' : t) + '”' : '<' + el.tagName.toLowerCase() + '>';
  };
  const bgImgOf = (el) => {
    const sec = el.matches('section') ? el : sectionOf(el); if (!sec) return null;
    return sec.querySelector(':scope > [class*="__bg"] img, :scope > [class*="__media"] img, :scope [class*="__photo"] img, :scope > .phero__bg img')
      // a background photo one level down, e.g. the search page's top area (.psearch-page__head > .psearch-page__bg)
      || sec.querySelector(':scope > * > [class*="__bg"] img');
  };
  const grayImg = (el) => (el.tagName === 'IMG' ? el : bgImgOf(el)); // the picture a section / photo layer / image stands for
  const els = (sel) => { try { return [...document.querySelectorAll(sel)]; } catch (e) { return []; } };

  /* ------------------------------------------------- apply / clear changes */
  /* A full-bleed photo layer (and its <img>) must always fill its section: size, spacing and position
     edits on it are ignored, so a stray edit can never leave a gap between the photo and the footer. */
  const isPhotoLayer = (el) => !!(el && el.matches && (el.matches('[class*="__bg"], [class*="__media"]') || (el.tagName === 'IMG' && el.parentElement && el.parentElement.matches('[class*="__bg"], [class*="__media"]'))));
  const LAYERLOCK = /^(margin|padding|width|height|max-|min-|top$|bottom$|left$|right$|inset|transform|translate|row-gap|column-gap|gap)/;
  const applyProp = (el, k, v) => {
    if (LAYERLOCK.test(k) && isPhotoLayer(el)) return;
    if (k === '_gray') { const im = grayImg(el); if (im) { if (+v) im.style.setProperty('filter', 'grayscale(1)', 'important'); else im.style.removeProperty('filter'); } }
    else if (k === '_bgOpacity') { const im = bgImgOf(el); if (im) im.style.setProperty('opacity', v, 'important'); }
    else if (k === '_veil') { const im = bgImgOf(el); if (im) { im.parentElement.dataset.obVeil = '1'; im.parentElement.style.setProperty('--ob-veil', v); } }
    else if (k === '_itemGap') { [...el.children].forEach((c, i) => { if (i && getComputedStyle(c).display !== 'inline') c.style.setProperty('margin-top', v, 'important'); }); }
    else if (k === '_html') { if (el.querySelector('input, button, select, textarea')) return; /* never replace a control with plain text */ if (el.dataset.obOrig == null) el.dataset.obOrig = el.innerHTML; el.innerHTML = v; }
    else if (k === '_bgPosY') { const im = bgImgOf(el); if (im) { const x = (getComputedStyle(im).objectPosition.split(' ')[0]) || '50%'; im.style.setProperty('object-position', x + ' ' + v, 'important'); } }
    else if (k === '_href') { if (el.dataset.obHref == null) el.dataset.obHref = el.getAttribute('href') || ''; el.setAttribute('href', v); }
    else if (k === '_target') { if (el.dataset.obTarget == null) el.dataset.obTarget = el.getAttribute('target') || ''; if (v) el.setAttribute('target', v); else el.removeAttribute('target'); }
    else if (k === 'font-family') { loadFont(v); el.style.setProperty(k, v, 'important'); }
    else if (k === 'max-width' && el.tagName === 'SECTION') return; // whole sections stay full width
    else if (k[0] !== '_') el.style.setProperty(k, v, 'important');
  };
  const clearProp = (el, k) => {
    if (k === '_gray') { const im = grayImg(el); if (im) im.style.removeProperty('filter'); }
    else if (k === '_bgOpacity') { const im = bgImgOf(el); if (im) im.style.removeProperty('opacity'); }
    else if (k === '_veil') { const im = bgImgOf(el); if (im) { delete im.parentElement.dataset.obVeil; im.parentElement.style.removeProperty('--ob-veil'); } }
    else if (k === '_itemGap') { [...el.children].forEach((c) => c.style.removeProperty('margin-top')); }
    else if (k === '_bgPosY') { const im = bgImgOf(el); if (im) im.style.removeProperty('object-position'); }
    else if (k === '_html') { if (el.dataset.obOrig != null) { el.innerHTML = el.dataset.obOrig; delete el.dataset.obOrig; } }
    else if (k === '_href') { if (el.dataset.obHref != null) { el.setAttribute('href', el.dataset.obHref); delete el.dataset.obHref; } }
    else if (k === '_target') { if (el.dataset.obTarget != null) { if (el.dataset.obTarget) el.setAttribute('target', el.dataset.obTarget); else el.removeAttribute('target'); delete el.dataset.obTarget; } }
    else if (k[0] !== '_') el.style.removeProperty(k);
  };
  /* New text boxes: stored as "_add:<id>" entries ({ _after or _into: selector, _html }). The box is a
     <p class="obx-text obx-<id>">, so it can be selected and styled like anything else. */
  const isAdd = (s) => s.startsWith('_add:');
  const addCls = (s) => 'obx-' + s.slice(5);
  const addEl = (s) => document.querySelector('.' + addCls(s));
  const placeAdds = () => Object.entries(changes).forEach(([s, p]) => {
    if (!isAdd(s)) return;
    let el = addEl(s);
    if (!el) {
      const a = els(p._after || p._into)[0]; if (!a) return;
      el = document.createElement('p'); el.className = 'obx-text ' + addCls(s); el.dataset.obNew = '1';
      if (p._into) a.appendChild(el); else a.insertAdjacentElement('afterend', el);
    }
    if (el.innerHTML !== p._html) el.innerHTML = p._html;
  });
  const dropAdds = () => Object.keys(changes).forEach((s) => { if (isAdd(s)) { const el = addEl(s); if (el) el.remove(); } });
  const addKeyOf = (el) => { const c = el && el.classList && [...el.classList].find((x) => /^obx-(?!text$)/.test(x)); return c ? '_add:' + c.slice(4) : null; };
  /* Sizes, spacing and alignment are published for screens from 60rem up only (see buildCss), so the
     panel replays them only on such screens: on a phone it shows the same page visitors get. */
  const DESKONLY = /^(font-size|line-height|letter-spacing|margin(-top|-bottom|-left|-right)?|padding(-block|-inline|-top|-bottom|-left|-right)?|max-width|width|height|grid-template-columns|row-gap|column-gap|gap|text-align|text-align-last|justify-self|justify-content|justify-items|align-self|align-items|translate|_itemGap)$/;
  const deskOnly = (k) => DESKONLY.test(k);
  const wide = () => window.matchMedia('(min-width: 60rem)').matches;
  const applyAll = () => { placeAdds(); applyRest(); };
  const applyRest = () => Object.entries(changes).forEach(([s, p]) => isAdd(s) || els(s).forEach((el) => { if (p._origHtml != null && el.dataset.obOrig == null) el.dataset.obOrig = p._origHtml; Object.entries(p).forEach(([k, v]) => { if (!wide() && deskOnly(k)) return; applyProp(el, k, v); }); }));
  const clearAll = () => { Object.entries(changes).forEach(([s, p]) => isAdd(s) || els(s).forEach((el) => Object.keys(p).forEach((k) => clearProp(el, k)))); dropAdds(); };

  /* history */
  const past = []; const future = []; let lastPush = 0;
  const snap = (force) => { const now = Date.now(); if (force || now - lastPush > 700) { past.push(JSON.stringify(changes)); if (past.length > 150) past.shift(); future.length = 0; } lastPush = now; };
  const restore = (state) => { clearAll(); changes = JSON.parse(state); save(); applyAll(); refresh(); };
  const undo = () => { if (!past.length) return; future.push(JSON.stringify(changes)); restore(past.pop()); lastPush = 0; };
  const redo = () => { if (!future.length) return; past.push(JSON.stringify(changes)); restore(future.pop()); lastPush = 0; };

  /* set values on the selection */
  let sel = null;
  const put = (el, props, label) => {
    if (isPhotoLayer(el)) props = Object.fromEntries(Object.entries(props).filter(([k]) => !LAYERLOCK.test(k))); if (!Object.keys(props).length) return;
    const s = selectorFor(el); snap();
    els(s).forEach((e) => Object.keys(props).forEach((k) => clearProp(e, k)));
    // The newest setting must win: move changed keys to the end (later keys override earlier ones),
    // and when "Section height" changes, keep the left/right part of an "Inner padding" but drop its top/bottom.
    const cur = changes[s] || {};
    if (props['padding-block'] != null && cur.padding != null) { const sides = String(cur.padding).trim().split(/\s+/); cur['padding-inline'] = sides.length > 1 ? sides[sides.length === 4 ? 3 : 1] : sides[0]; delete cur.padding; els(s).forEach((e) => e.style.removeProperty('padding')); }
    Object.keys(props).forEach((k) => delete cur[k]);
    changes[s] = Object.assign(cur, props, { _label: label || describe(el) });
    Object.keys(props).forEach((k) => { if (props[k] === null) delete changes[s][k]; });
    els(s).forEach((e) => Object.entries(changes[s]).forEach(([k, v]) => applyProp(e, k, v)));
    save(); refresh(false);
  };
  const putSec = (props) => { if (!sel) return; const sec = sel.matches('section') ? sel : sectionOf(sel); if (sec) put(sec, props, 'Section ' + secName(sec)); };

  /* ------------------------------------------------------------------ panel */
  const P = document.createElement('div');
  P.id = 'obp';
  const rng = (key, label, min, max, step, unit) => `<div class="row" data-r="${key}"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><input type="number" min="${min}" max="${max}" step="${step}" data-u="${unit}"></div>`;
  P.innerHTML = `
  <div class="hd"><b>Obelum design panel</b>
    <button class="ic" data-undo title="Undo (Cmd/Ctrl+Z)">↶</button><button class="ic" data-redo title="Redo (Cmd/Ctrl+Shift+Z)">↷</button>
    <button class="ic" data-pick title="Select mode on/off">◎</button><button class="ic" data-rulers title="Rulers and guides on/off. Drag from a ruler to add a guide; drag it back to remove it.">📏</button><button class="ic" data-min title="Minimise">–</button></div>
  <div class="bd">
    <div class="sel"><div class="t" data-name>Click anything on the page to select it.</div><div class="note" data-path></div><div class="crumbs" data-crumbs></div><button class="btn" data-gray hidden style="margin-top:6px;width:100%">Desaturate image (B&amp;W)</button></div>
    <div data-ctrls class="off">
    <details open><summary>Text</summary><div class="grp">
      <div><div class="note" style="margin-bottom:3px">Font</div><select data-font><option value="">Site default</option>${FONTS.map(([n, f]) => `<option value='${f}'>${n}</option>`).join('')}</select></div>
      ${rng('font-size', 'Size', 8, 140, 1, 'px')}
      ${rng('letter-spacing', 'Letter spacing', -0.05, 0.4, 0.005, 'em')}
      ${rng('line-height', 'Line spacing', 0.8, 2.6, 0.02, '')}
      ${rng('_shadow', 'Shadow', 0, 40, 1, 'px')}
      <div class="seg" data-shc style="grid-template-columns:1fr 1fr"><button data-sh="dark" class="on">Dark shadow</button><button data-sh="light">Light glow</button></div>
      ${rng('_textAlpha', 'Text opacity', 0, 1, 0.05, '')}
      <div class="ticks"><label><input type="checkbox" data-tick="bold"> Bold</label><label><input type="checkbox" data-tick="italic"> Italic</label>
        <label><input type="checkbox" data-tick="upper"> Uppercase</label><label><input type="checkbox" data-tick="under"> Underline</label></div>
      <div><div class="note" style="margin-bottom:3px">Text</div>
        <textarea data-txt rows="3" spellcheck="true" placeholder="Select a text on the page"></textarea>
        <div class="note" data-txtnote style="margin-top:4px"></div></div>
      <button class="btn" data-edittext title="Or double-click the text. Esc to finish.">Edit on the page ✎</button>
            <div><div class="note" style="margin-bottom:3px">Alignment</div><div class="seg" data-align><button data-a="left">Left</button><button data-a="center">Center</button><button data-a="right">Right</button><button data-a="justify">Justify</button></div></div>
    </div></details>
    <details open><summary>Colour</summary><div class="grp">
      <div class="sw" data-sw></div>
      <div class="col"><input type="color" data-color><input type="text" data-hexin maxlength="7"><button class="btn" data-copyhex>Copy #</button></div>
      ${rng('opacity', 'Whole item opacity', 0, 1, 0.05, '')}
    </div></details>
    <details open><summary>Spacing</summary><div class="grp">
      ${rng('_itemGap', 'Between items', 0, 120, 1, 'px')}
      <div class="note" data-gapnote></div>
      ${rng('_shiftX', 'Move left / right', -900, 900, 1, 'px')}
      ${rng('_shiftY', 'Move up / down', -600, 600, 1, 'px')}
      ${rng('margin-top', 'Space above', -80, 200, 1, 'px')}
      ${rng('margin-bottom', 'Space below', -80, 200, 1, 'px')}
      ${rng('padding', 'Inner padding', 0, 120, 1, 'px')}
      ${rng('max-width', 'Max width', 0, 1600, 10, 'px')}
    </div></details>
    <details open><summary>Box &amp; button</summary><div class="grp">
      <div class="col"><input type="color" data-boxc><input type="text" data-boxhex maxlength="7"><span class="note">fill</span></div>
      <div class="sw" data-swbox></div>
      ${rng('_bgAlpha', 'Fill opacity', 0, 1, 0.05, '')}
      ${rng('_blur', 'Blur behind', 0, 100, 1, 'px')}
      ${rng('border-radius', 'Rounded corners', 0, 60, 1, 'px')}
      ${rng('_borderAlpha', 'Border opacity', 0, 1, 0.05, '')}
      <div class="col"><input type="color" data-borc><input type="text" data-borhex maxlength="7"><span class="note">border colour</span></div>
      <div class="sw" data-swbor></div>
    </div></details>
    <details open data-btng><summary>Button / link action</summary><div class="grp">
      <div class="note" data-btnnote></div>
      <div data-btnctl>
        <div class="note" style="margin-bottom:3px">When clicked</div>
        <select data-act>
          <option value="page">Go to a page</option><option value="section">Go to a section on this page</option>
          <option value="whatsapp">Open WhatsApp</option><option value="phone">Call a phone number</option>
          <option value="email">Send an email</option><option value="url">Open a web address</option>
        </select>
        <div style="margin-top:5px" data-actp><select data-actpage>${PAGES.map(([f, n]) => `<option value="${f}">${n}</option>`).join('')}</select></div>
        <div style="margin-top:5px" data-acts><select data-actsec></select></div>
        <div style="margin-top:5px" data-actv><input type="text" data-actval></div>
        <div style="margin-top:5px" data-actm><input type="text" data-actmsg placeholder="Message to pre-fill (optional)"></div>
        <div class="ticks one" style="margin-top:5px"><label><input type="checkbox" data-actnew> Open in a new tab</label></div>
        <div class="two" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:5px"><button class="btn gold" data-actapply>Apply action</button><button class="btn" data-actreset>Original action</button></div>
      </div>
    </div></details>
    <details open><summary>Section</summary><div class="grp" data-secg>
      ${rng('padding-block', 'Height (padding)', 0, 240, 2, 'px')}
      <div class="col"><input type="color" data-secc><input type="text" data-sechex maxlength="7"><span class="note">background</span></div>
      <div class="sw" data-swsec></div>
      ${rng('_bgOpacity', 'Photo opacity', 0, 1, 0.05, '')}
      ${rng('_veil', 'Dark veil', 0, 0.95, 0.01, '')}
      ${rng('_bgPosY', 'Photo up / down', 0, 100, 1, '%')}
    </div></details>
    <div style="padding:5px 12px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="btn" data-parent>Select parent ↑</button><button class="btn" data-resetone>Reset this item</button></div>
    <div style="padding:5px 12px 0;display:grid;grid-template-columns:1fr;gap:8px"><button class="btn" data-addtext>+ Add a new text box below the selection</button><button class="btn" data-deltext>Delete this item</button></div>
    </div>
    <details open><summary>Changes <span data-count style="color:#8E8B85;font-weight:400"></span></summary><div class="grp"><div class="list" data-list></div></div></details>
  </div>
  <div class="ft"><div class="two"><button class="btn gold" data-save>Save</button><a class="btn" data-preview target="_blank" rel="noopener" style="text-align:center;text-decoration:none">Preview ↗</a></div>
    <div class="note" data-savenote></div>
    <div class="two"><button class="btn" data-copy>Copy my changes</button><button class="btn" data-resetall>Reset all</button></div>
    <div class="gh" data-gh></div></div>`;
  document.body.appendChild(P);
  const q = (s) => P.querySelector(s); const qa = (s) => [...P.querySelectorAll(s)];
  ['[data-sw]', '[data-swbox]', '[data-swbor]', '[data-swsec]'].forEach((c) => PALETTE.forEach(([n, h]) => { const b = document.createElement('button'); b.title = n + ' ' + h; b.style.background = h; b.dataset.hex = h; q(c).appendChild(b); }));

  /* ------------------------------------------------------- read selection */
  const rowSet = (key, val) => { const r = q(`[data-r="${key}"]`); if (!r) return; const [a, b] = r.querySelectorAll('input'); a.value = val; b.value = val; };
  const groupOf = (el) => (el.children.length > 1 ? el : el.parentElement);
  const refresh = (full = true) => {
    q('[data-undo]').disabled = !past.length; q('[data-redo]').disabled = !future.length;
    const n = Object.keys(changes).length; q('[data-count]').textContent = n ? '(' + n + ')' : '';
    q('[data-list]').innerHTML = Object.entries(changes).map(([s, p]) => `<div><span title="${s}">${(p._label || s).replace(/</g, '&lt;')}</span><button data-del="${encodeURIComponent(s)}" title="Remove">×</button></div>`).join('') || '<span class="note">No changes yet.</span>';
    if (!sel) { q('[data-ctrls]').classList.add('off'); q('[data-name]').textContent = 'Click anything on the page to select it.'; q('[data-path]').textContent = ''; q('[data-crumbs]').innerHTML = ''; return; }
    readSel();
  };
  const readSel = () => {
    const el = sel; const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize);
    q('[data-ctrls]').classList.remove('off');
    q('[data-name]').textContent = describe(el);
    q('[data-path]').textContent = selectorFor(el);
    const chain = []; let n = el; const sec = sectionOf(el);
    while (n && n !== document.body) { chain.unshift(n); if (n === sec) break; n = n.parentElement; }
    const shown = chain.slice(-5);
    q('[data-crumbs]').innerHTML = shown.map((c, i) => `<button data-crumb="${i}" class="${c === el ? 'on' : ''}">${c.tagName.toLowerCase()}${own(c)[0] ? '.' + own(c)[0] : ''}</button>`).join('');
    q('[data-crumbs]')._chain = shown;
    { const gb = q('[data-gray]'); const gi = (el.tagName === 'IMG' || el.matches('section')) ? grayImg(el) : null; gb.hidden = !gi; const on = !!gi && /grayscale/.test(gi.style.filter || ''); gb.classList.toggle('gold', on); gb.textContent = on ? 'Image is B&W — click to restore colour' : 'Desaturate image (B&W)'; }
    rowSet('font-size', Math.round(fs));
    rowSet('letter-spacing', cs.letterSpacing === 'normal' ? 0 : +(parseFloat(cs.letterSpacing) / fs).toFixed(3));
    rowSet('line-height', cs.lineHeight === 'normal' ? 1.2 : +(parseFloat(cs.lineHeight) / fs).toFixed(2));
    const sm = cs.textShadow === 'none' ? null : cs.textShadow.replace(/rgba?\([^)]*\)/g, '').split(',')[0].match(/-?[\d.]+px/g); rowSet('_shadow', sm ? Math.round(parseFloat(sm[sm.length - 1])) : 0);
    if (sm) { const lt = /255, 255, 255|247, 245, 241/.test(cs.textShadow); shTone = lt ? 'light' : 'dark'; } qa('[data-sh]').forEach((b) => b.classList.toggle('on', b.dataset.sh === shTone));
    rowSet('_textAlpha', alphaOf(cs.color));
    q('[data-tick="bold"]').checked = (parseInt(cs.fontWeight, 10) || 400) >= 600;
    q('[data-tick="italic"]').checked = cs.fontStyle === 'italic';
    q('[data-tick="upper"]').checked = cs.textTransform === 'uppercase';
    q('[data-tick="under"]').checked = /underline/.test(cs.textDecorationLine);
    const al = (cs.textAlignLast === 'justify' || cs.textAlign === 'justify') ? 'justify' : ({ start: 'left', end: 'right', '-webkit-center': 'center' }[cs.textAlign] || cs.textAlign);
    qa('[data-a]').forEach((b) => b.classList.toggle('on', b.dataset.a === al));
    if (document.activeElement !== q('[data-txt]')) {
      const kids = [...el.children].filter((c) => c.tagName !== 'BR');
      q('[data-txt]').value = el.innerText.replace(/\n{3,}/g, '\n\n').trim();
      q('[data-txtnote]').textContent = kids.length ? 'Has styled parts: typing here makes it plain. To keep them, double-click it on the page.' : '';
    }
    { const ff = (el.style.getPropertyValue('font-family') || '').trim(); const first = (s) => s.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
      const hit = FONTS.find((f) => first(f[1]) === first(ff || cs.fontFamily)); q('[data-font]').value = ff && hit ? hit[1] : ''; }
    readBtn(el);
    q('[data-deltext]').hidden = /^(html|body|main)$/i.test(el.tagName) || P.contains(el);
    const hex = toHex(cs.color); q('[data-color]').value = hex; q('[data-hexin]').value = hex;
    qa('[data-sw] button').forEach((b) => b.classList.toggle('on', b.dataset.hex === hex));
    rowSet('opacity', +cs.opacity);
    { const tr = (cs.translate || 'none').split(/\s+/); rowSet('_shiftX', Math.round(parseFloat(tr[0]) || 0)); rowSet('_shiftY', Math.round(parseFloat(tr[1]) || 0)); }
    const g = groupOf(el); const k1 = g && g.children[1];
    rowSet('_itemGap', k1 ? Math.round(parseFloat(getComputedStyle(k1).marginTop) || parseFloat(getComputedStyle(g).rowGap) || parseFloat(getComputedStyle(g).columnGap) || 0) : 0);
    q('[data-gapnote]').textContent = g === el ? 'Spaces this group’s items.' : 'No inner items: spaces the parent group.';
    rowSet('margin-top', Math.round(parseFloat(cs.marginTop) || 0)); rowSet('margin-bottom', Math.round(parseFloat(cs.marginBottom) || 0));
    rowSet('padding', Math.round(parseFloat(cs.paddingTop) || 0)); rowSet('max-width', cs.maxWidth === 'none' ? Math.round(el.getBoundingClientRect().width) : Math.round(parseFloat(cs.maxWidth)));
    q('[data-borc]').value = toHex(cs.borderTopColor); q('[data-borhex]').value = toHex(cs.borderTopColor);
    q('[data-boxc]').value = toHex(cs.backgroundColor); q('[data-boxhex]').value = toHex(cs.backgroundColor);
    rowSet('_bgAlpha', alphaOf(cs.backgroundColor)); { const bm = (cs.backdropFilter || cs.webkitBackdropFilter || '').match(/blur\(([\d.]+)px\)/); rowSet('_blur', bm ? Math.round(+bm[1]) : 0); } rowSet('border-radius', Math.round(parseFloat(cs.borderTopLeftRadius) || 0)); rowSet('_borderAlpha', alphaOf(cs.borderTopColor));
    const s2 = el.matches('section') ? el : sectionOf(el);
    q('[data-secg]').classList.toggle('off', !s2);
    if (s2) {
      const scs = getComputedStyle(s2); rowSet('padding-block', Math.round((parseFloat(scs.paddingTop) + parseFloat(scs.paddingBottom)) / 2));
      q('[data-secc]').value = toHex(scs.backgroundColor); q('[data-sechex]').value = toHex(scs.backgroundColor);
      const im = bgImgOf(s2); ['_bgOpacity', '_veil', '_bgPosY'].forEach((k) => q(`[data-r="${k}"]`).classList.toggle('off', !im));
      if (im) { const py = (getComputedStyle(im).objectPosition.split(' ')[1] || '50%'); rowSet('_bgPosY', Math.round(parseFloat(py))); }
      if (im) { rowSet('_bgOpacity', +getComputedStyle(im).opacity); const sv = (changes[secName(s2)] || {})._veil; rowSet('_veil', sv != null ? +sv : 0.35); }
    }
  };

  /* -------------------------------------------------------------- actions */
  const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
  const doAlign = (a) => {
    const el = sel; const cs = getComputedStyle(el); const p = el.parentElement; const pcs = p ? getComputedStyle(p) : null;
    const props = { 'text-align': a, 'text-align-last': a === 'justify' ? 'justify' : a };
    const map = { left: 'start', center: 'center', right: 'end', justify: 'stretch' };
    if (/^inline/.test(cs.display)) { const d = cs.display.replace('inline-', ''); props.display = d === 'inline' ? 'block' : d; props.width = '100%'; }
    if (/grid/.test(cs.display)) props['justify-items'] = map[a];
    if (/flex/.test(cs.display)) props[cs.flexDirection.startsWith('column') ? 'align-items' : 'justify-content'] = a === 'justify' ? 'space-between' : map[a] === 'start' ? 'flex-start' : map[a] === 'end' ? 'flex-end' : 'center';
    if (pcs && /grid/.test(pcs.display)) props['justify-self'] = map[a];
    if (pcs && /flex/.test(pcs.display) && pcs.flexDirection.startsWith('column')) props['align-self'] = a === 'justify' ? 'stretch' : map[a] === 'start' ? 'flex-start' : map[a] === 'end' ? 'flex-end' : 'center';
    put(el, props, describe(el));
  };
  let shTone = 'dark';
  const shadowCss = (v) => {
    if (!v) return 'none';
    const c = shTone === 'light' ? '247,245,241' : '0,0,0';
    const a = shTone === 'light' ? 0.7 : 0.85;
    return `0 ${Math.max(1, Math.round(v / 6))}px ${v}px rgba(${c},${a}), 0 0 ${Math.max(1, Math.round(v / 3))}px rgba(${c},${(a * 0.6).toFixed(2)})`;
  };
  const onRange = (key, v, unit) => {
    if (!sel) return;
    const val = v + (unit || '');
    if (key === 'max-width' && sel.tagName === 'SECTION') {
      // a whole section stays full width; Max width then sizes its content block instead
      const inner = sel.querySelector(':scope > [class*="__inner"], :scope > [class*="__stack"], :scope > .shell, :scope > [class*="__body"]') || [...sel.children].find((c) => !c.matches('[class*="__bg"], [class*="__media"], script, style'));
      if (inner) return put(inner, { 'max-width': val }, describe(inner) + ' (width)');
    }
    if (key === '_shiftX' || key === '_shiftY') {
      // the CSS "translate" property moves the item without touching the layout around it (0 = original place)
      const cur = (getComputedStyle(sel).translate || 'none').split(/\s+/); const px = (i) => (parseFloat(cur[i]) || 0);
      const x = key === '_shiftX' ? +v : px(0); const y = key === '_shiftY' ? +v : px(1);
      return put(sel, { translate: x + 'px ' + y + 'px' }, describe(sel) + ' (moved)');
    }
    if (key === '_shadow') return put(sel, { 'text-shadow': shadowCss(+v) });
    if (key === '_textAlpha') return put(sel, { color: rgba(toHex(getComputedStyle(sel).color), v) });
    if (key === '_itemGap') {
      const g = groupOf(sel); if (!g) return;
      const gcs = getComputedStyle(g);
      if (/flex|grid/.test(gcs.display)) return put(g, { 'row-gap': val, 'column-gap': val }, describe(g) + ' (group)'); // both directions: stacked items and side-by-side items
      const blockKids = [...g.children].filter((c) => getComputedStyle(c).display !== 'inline');
      if (blockKids.length > 1) return put(g, { _itemGap: val }, describe(g) + ' (group)');
      const fs = parseFloat(gcs.fontSize); return put(g, { 'line-height': ((fs * 1.15 + +v) / fs).toFixed(2) }, describe(g) + ' (lines)');
    }
    if (key === '_bgAlpha') return put(sel, { 'background-color': rgba(q('[data-boxc]').value, v) });
    if (key === '_blur') {
      // Blur only shows through a see-through box: a solid fill hides it, so lower a solid fill to 60%.
      const b = +v ? `blur(${+v}px)` : 'none'; const props = { 'backdrop-filter': b, '-webkit-backdrop-filter': b };
      const bg = getComputedStyle(sel).backgroundColor;
      if (+v && alphaOf(bg) >= 0.99) { props['background-color'] = rgba(toHex(bg), 0.6); rowSet('_bgAlpha', 0.6); }
      return put(sel, props);
    }
    if (key === '_borderAlpha') { const c = toHex(getComputedStyle(sel).borderTopColor); return put(sel, { 'border-color': rgba(c, v) }); }
    if (['padding-block', '_bgOpacity', '_veil', '_bgPosY'].includes(key)) return putSec({ [key]: val });
    // An inline bit of text (an italic word inside a heading, say) ignores both width and line spacing:
    // it becomes an inline block, which still flows with the text around it.
    if ((key === 'max-width' || key === 'line-height') && getComputedStyle(sel).display === 'inline') put(sel, { display: 'inline-block' });
    put(sel, { [key]: val });
    if (key === 'max-width') {
      // Past the width of the box it sits in, max width alone does nothing (the box is the limit). Then
      // give the item that width outright, up to what its content needs, so the slider keeps working.
      // Back at or under its normal width, the extra width is removed again.
      {
        const sS = selectorFor(sel); const hadW = changes[sS] && changes[sS].width != null;
        if (hadW) sel.style.removeProperty('width');
        const cur = sel.getBoundingClientRect().width;
        const ghost = sel.cloneNode(true); ghost.classList.remove('ob-sel', 'ob-hov');
        ghost.style.cssText = 'position:absolute!important;visibility:hidden!important;left:-99999px!important;width:max-content!important;max-width:none!important;translate:none!important';
        sel.parentElement.appendChild(ghost); const need = ghost.getBoundingClientRect().width; ghost.remove();
        const want = Math.min(parseFloat(val), Math.ceil(need));
        if (parseFloat(val) > cur + 1 && need > cur + 1) put(sel, { width: want + 'px', 'flex-shrink': '0' }, describe(sel));
        else if (hadW) put(sel, { width: null, 'flex-shrink': null }, describe(sel));
      }
      // a parent's own max width would cap this item (e.g. a 25rem text column): lift it so the whole range works
      for (let a = sel.parentElement; a && !/^(SECTION|MAIN|BODY|HTML)$/.test(a.tagName) && !P.contains(a); a = a.parentElement) {
        const mw = getComputedStyle(a).maxWidth; if (mw !== 'none' && parseFloat(mw) < parseFloat(val)) put(a, { 'max-width': val }, describe(a) + ' (width)');
      }
      // In a side-by-side grid (e.g. text | form) a column caps whatever sits in it, so past the
      // column's own width the slider did nothing. Then give that column the width asked for and let
      // the other columns share what is left; back at or under the normal width, the grid goes back
      // to the site's own columns.
      let cell = sel;
      while (cell.parentElement && !/^(SECTION|MAIN|BODY|HTML)$/.test(cell.parentElement.tagName) && getComputedStyle(cell.parentElement).display.indexOf('grid') < 0) cell = cell.parentElement;
      const grid = cell.parentElement;
      if (grid && !P.contains(grid) && getComputedStyle(grid).display.indexOf('grid') >= 0) {
        const gs = selectorFor(grid); const had = changes[gs] && changes[gs]['grid-template-columns'] != null;
        if (had) grid.style.removeProperty('grid-template-columns');
        const gcs = getComputedStyle(grid); const tracks = gcs.gridTemplateColumns.split(/\s+/).map(parseFloat).filter((n) => !isNaN(n));
        if (tracks.length > 1) {
          const gap = parseFloat(gcs.columnGap) || 0; const left = cell.getBoundingClientRect().left - grid.getBoundingClientRect().left - (parseFloat(gcs.paddingLeft) || 0);
          let i = 0; for (let x = 0; i < tracks.length - 1 && left >= x + tracks[i] + gap / 2; i++) x += tracks[i] + gap;
          if (parseFloat(val) > tracks[i] + 1) put(grid, { 'grid-template-columns': tracks.map((t, j) => j === i ? `minmax(0, ${val})` : 'minmax(0, 1fr)').join(' ') }, describe(grid) + ' (columns)');
          else if (had) put(grid, { 'grid-template-columns': null }, describe(grid) + ' (columns)');
        } else if (had) applyProp(grid, 'grid-template-columns', changes[gs]['grid-template-columns']);
      }
    }
  };
  qa('[data-r]').forEach((row) => {
    const [r, n] = row.querySelectorAll('input'); const key = row.dataset.r; const unit = n.dataset.u;
    r.addEventListener('input', () => { n.value = r.value; onRange(key, r.value, unit); });
    n.addEventListener('change', () => { r.value = n.value; onRange(key, n.value, unit); });
  });
  qa('[data-tick]').forEach((t) => t.addEventListener('change', () => {
    if (!sel) return; const on = t.checked;
    const m = { bold: ['font-weight', on ? '700' : '400'], italic: ['font-style', on ? 'italic' : 'normal'], upper: ['text-transform', on ? 'uppercase' : 'none'], under: ['text-decoration-line', on ? 'underline' : 'none'] }[t.dataset.tick];
    put(sel, { [m[0]]: m[1] });
  }));
  qa('[data-a]').forEach((b) => b.addEventListener('click', () => sel && doAlign(b.dataset.a)));
  const setColor = (h) => { if (!sel || !/^#[0-9a-f]{6}$/i.test(h)) return; const a = alphaOf(getComputedStyle(sel).color); put(sel, { color: a < 1 ? rgba(h, a) : h.toUpperCase() }); };
  q('[data-color]').addEventListener('input', (e) => { q('[data-hexin]').value = e.target.value.toUpperCase(); setColor(e.target.value); });
  q('[data-hexin]').addEventListener('change', (e) => setColor(e.target.value.trim()));
  q('[data-sw]').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setColor(b.dataset.hex); });
  const copy = async (txt, btn) => { try { await navigator.clipboard.writeText(txt); } catch (e) { window.prompt('Copy:', txt); } const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = o; }, 1300); };
  q('[data-copyhex]').addEventListener('click', (e) => copy(q('[data-hexin]').value.toUpperCase(), e.target));
  const setBox = (h) => { if (!sel || !/^#[0-9a-f]{6}$/i.test(h)) return; const a = +q('[data-r="_bgAlpha"] input').value || 1; put(sel, { 'background-color': rgba(h, a) }); };
  q('[data-boxc]').addEventListener('input', (e) => { q('[data-boxhex]').value = e.target.value.toUpperCase(); setBox(e.target.value); });
  q('[data-boxhex]').addEventListener('change', (e) => setBox(e.target.value.trim()));
  const setBorder = (h) => { if (!sel || !/^#[0-9a-f]{6}$/i.test(h)) return; const a = alphaOf(getComputedStyle(sel).borderTopColor); const props = { 'border-color': a < 1 && a > 0 ? rgba(h, a) : h.toUpperCase() }; if (!parseFloat(getComputedStyle(sel).borderTopWidth)) { props['border-width'] = '1px'; props['border-style'] = 'solid'; } put(sel, props); q('[data-borc]').value = h; q('[data-borhex]').value = h.toUpperCase(); };
  q('[data-borc]').addEventListener('input', (e) => setBorder(e.target.value));
  q('[data-borhex]').addEventListener('change', (e) => setBorder(e.target.value.trim()));
  q('[data-swbor]').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setBorder(b.dataset.hex); });
  q('[data-swbox]').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { q('[data-boxc]').value = b.dataset.hex; q('[data-boxhex]').value = b.dataset.hex; setBox(b.dataset.hex); } });
  q('[data-swsec]').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { q('[data-secc]').value = b.dataset.hex; q('[data-sechex]').value = b.dataset.hex; setSecBg(b.dataset.hex); } });
  const setSecBg = (h) => { if (/^#[0-9a-f]{6}$/i.test(h)) putSec({ background: h.toUpperCase() }); };
  q('[data-secc]').addEventListener('input', (e) => { q('[data-sechex]').value = e.target.value.toUpperCase(); setSecBg(e.target.value); });
  q('[data-sechex]').addEventListener('change', (e) => setSecBg(e.target.value.trim()));

  /* font */
  q('[data-font]').addEventListener('change', (e) => { if (!sel) return; const v = e.target.value; put(sel, { 'font-family': v || null }); if (!v) els(selectorFor(sel)).forEach((x) => x.style.removeProperty('font-family')); });

  /* button / link action */
  const linkOf = (el) => el && (el.closest('a') || null);
  const parseHref = (h) => {
    h = h || '';
    if (/wa\.me\//.test(h)) { const u = new URL(h, location.href); return { act: 'whatsapp', val: u.pathname.replace(/\D/g, ''), msg: u.searchParams.get('text') || '' }; }
    if (/^tel:/i.test(h)) return { act: 'phone', val: decodeURIComponent(h.slice(4)) };
    if (/^mailto:/i.test(h)) return { act: 'email', val: decodeURIComponent(h.slice(7).split('?')[0]) };
    if (/^#/.test(h)) return { act: 'section', val: h.slice(1) };
    const pg = PAGES.find(([f]) => h.split('#')[0].split('?')[0].replace(/^\.?\//, '') === f); if (pg) return { act: 'page', val: pg[0], hash: h.split('#')[1] || '' };
    if (h === './' || h === '/' || h === '') return { act: 'page', val: 'index.html' };
    return { act: 'url', val: h };
  };
  const showAct = () => {
    const a = q('[data-act]').value;
    q('[data-actp]').hidden = a !== 'page'; q('[data-acts]').hidden = a !== 'section'; q('[data-actm]').hidden = a !== 'whatsapp';
    q('[data-actv]').hidden = !['whatsapp', 'phone', 'email', 'url'].includes(a);
    q('[data-actval]').placeholder = { whatsapp: 'WhatsApp number, e.g. 971586033881', phone: 'Phone, e.g. +971 58 603 3881', email: 'Email address', url: 'https://…' }[a] || '';
  };
  const readBtn = (el) => {
    const a = linkOf(el); const btn = el.closest('button');
    q('[data-btnctl]').hidden = !a;
    q('[data-btnnote]').textContent = a ? '' : btn ? 'Fixed action (form / feature).' : 'Select a button or link.';
    if (!a) return;
    const secs = [...document.querySelectorAll('section[id], div[id].section, [id].cta, [id].world')].filter((s) => !P.contains(s));
    q('[data-actsec]').innerHTML = secs.map((s) => { const h = s.querySelector('h1,h2,.eyebrow'); return `<option value="${s.id}">${(h ? h.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) : '') || s.id} (#${s.id})</option>`; }).join('');
    const p = parseHref(a.getAttribute('href'));
    q('[data-act]').value = p.act; q('[data-actval]').value = ['whatsapp', 'phone', 'email', 'url'].includes(p.act) ? p.val : '';
    q('[data-actmsg]').value = p.msg || '';
    if (p.act === 'page') q('[data-actpage]').value = p.val; if (p.act === 'section') q('[data-actsec]').value = p.val;
    q('[data-actnew]').checked = a.getAttribute('target') === '_blank';
    showAct();
  };
  q('[data-act]').addEventListener('change', () => { showAct(); if (q('[data-act]').value === 'whatsapp' && !q('[data-actval]').value) q('[data-actval]').value = WA; });
  q('[data-actapply]').addEventListener('click', () => {
    const a = linkOf(sel); if (!a) return;
    const act = q('[data-act]').value; const v = q('[data-actval]').value.trim(); let href = '';
    if (act === 'page') href = q('[data-actpage]').value;
    else if (act === 'section') href = '#' + q('[data-actsec]').value;
    else if (act === 'whatsapp') { const m = q('[data-actmsg]').value.trim(); href = 'https://wa.me/' + (v.replace(/\D/g, '') || WA) + (m ? '?text=' + encodeURIComponent(m) : ''); }
    else if (act === 'phone') { if (!v) return; href = 'tel:' + v.replace(/[^\d+]/g, ''); }
    else if (act === 'email') { if (!v) return; href = 'mailto:' + v; }
    else if (act === 'url') { if (!v) return; href = /^(https?:|\/|#|\.)/.test(v) ? v : 'https://' + v; }
    const s = selectorFor(a); const cur = changes[s] || {};
    const origHref = cur._origHref != null ? cur._origHref : (a.dataset.obHref != null ? a.dataset.obHref : a.getAttribute('href') || '');
    const origTarget = cur._origTarget != null ? cur._origTarget : (a.dataset.obTarget != null ? a.dataset.obTarget : a.getAttribute('target') || '');
    put(a, { _href: href, _target: q('[data-actnew]').checked ? '_blank' : '', _origHref: origHref, _origTarget: origTarget }, describe(a) + ' (action)');
    q('[data-btnnote]').textContent = 'Set ✓ Save to publish.';
  });
  q('[data-actreset]').addEventListener('click', () => {
    const a = linkOf(sel); if (!a) return; const s = selectorFor(a); const cur = changes[s]; if (!cur || cur._href == null) return;
    snap(true); els(s).forEach((e) => { clearProp(e, '_href'); clearProp(e, '_target'); });
    ['_href', '_target', '_origHref', '_origTarget'].forEach((k) => delete cur[k]);
    if (!Object.keys(cur).some((k) => k !== '_label')) delete changes[s];
    save(); refresh();
  });

  /* new text box */
  q('[data-addtext]').addEventListener('click', () => {
    if (!sel) return;
    const into = /^(SECTION|HEADER|FOOTER)$/.test(sel.tagName);
    const anchor = into ? (sel.querySelector(':scope > .shell, :scope > [class*="__inner"]') || sel) : sel;
    const id = Date.now().toString(36); const key = '_add:' + id;
    snap(true);
    changes[key] = { [into ? '_into' : '_after']: selectorFor(anchor), _html: 'New text', _label: 'New text box' };
    placeAdds(); save();
    const el = addEl(key); if (el) { select(el); startEdit(el); const r = document.createRange(); r.selectNodeContents(el); const s1 = getSelection(); s1.removeAllRanges(); s1.addRange(r); }
  });
  const delAdd = (key) => { const el = addEl(key); if (el) { const s = selectorFor(el); if (changes[s]) { els(s).forEach((x) => Object.keys(changes[s]).forEach((k) => clearProp(x, k))); delete changes[s]; } el.remove(); } delete changes[key]; };
  q('[data-deltext]').addEventListener('click', () => {
    if (!sel) return; const key = addKeyOf(sel);
    if (key) { snap(true); delAdd(key); sel = null; save(); refresh(); return; }
    // any other item: hide it (listed under Changes; remove the entry or press undo to bring it back)
    const el = sel; const lbl = 'Deleted: ' + describe(el); select(null); put(el, { display: 'none' }, lbl); save(); refresh();
  });

  const select = (el) => { if (sel) sel.classList.remove('ob-sel'); sel = el; if (sel) { sel.classList.remove('ob-hov'); sel.classList.add('ob-sel'); } refresh(); };
  q('[data-crumbs]').addEventListener('click', (e) => { const b = e.target.closest('[data-crumb]'); if (b) select(q('[data-crumbs]')._chain[+b.dataset.crumb]); });
  q('[data-parent]').addEventListener('click', () => { if (sel && sel.parentElement && sel.parentElement !== document.body) select(sel.parentElement); });
  q('[data-gray]').addEventListener('click', () => { if (!sel) return; const photo = isPhotoLayer(sel) || sel.matches('section'); const tgt = photo ? (sel.matches('section') ? sel : sectionOf(sel)) : sel; const im = grayImg(tgt); if (!im) return; const on = !/grayscale/.test(im.style.filter || ''); put(tgt, { _gray: on ? '1' : '0' }, photo ? 'Section ' + secName(tgt) : 'Image'); refresh(); });
  q('[data-resetone]').addEventListener('click', () => { if (!sel) return; const s = selectorFor(sel); if (!changes[s]) return; snap(true); els(s).forEach((e) => Object.keys(changes[s]).forEach((k) => clearProp(e, k))); delete changes[s]; save(); refresh(); });
  q('[data-list]').addEventListener('click', (e) => { const b = e.target.closest('[data-del]'); if (!b) return; const s = decodeURIComponent(b.dataset.del); if (isAdd(s)) { snap(true); delAdd(s); if (sel && !document.body.contains(sel)) sel = null; save(); refresh(); return; } snap(true); els(s).forEach((x) => Object.keys(changes[s]).forEach((k) => clearProp(x, k))); delete changes[s]; save(); refresh(); });
  q('[data-resetall]').addEventListener('click', () => { if (!Object.keys(changes).length) return; snap(true); clearAll(); changes = {}; save(); refresh(); });
  q('[data-undo]').addEventListener('click', undo); q('[data-redo]').addEventListener('click', redo);
  q('[data-min]').addEventListener('click', () => P.classList.toggle('min'));
  /* Preview: the same page without ?edit, in a new tab (what visitors see once Save has published). */
  /* A fresh address each click, so the browser never shows a cached older copy. */
  const setPreview = () => { const u = new URL(location.href); u.searchParams.delete('edit'); u.searchParams.set('fresh', Date.now().toString(36)); q('[data-preview]').href = u.pathname + u.search + u.hash; };
  setPreview(); q('[data-preview]').addEventListener('mousedown', setPreview); q('[data-preview]').addEventListener('focus', setPreview);
  markSave = () => {
    const b = q('[data-save]'); const n = q('[data-savenote]'); if (!b) return;
    let at = null; try { at = localStorage.getItem(KEY + ':at'); } catch (e) {}
    const t = at ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    b.textContent = dirty ? 'Save' : 'Saved ✓';
    n.textContent = dirty ? 'You have unsaved changes (Cmd/Ctrl+S to save).' : (at ? 'Saved at ' + t + '. They stay on this browser when you come back.' : 'Your saved changes stay on this browser when you come back.');
  };
  dirty = usedDraft;
  q('[data-save]').addEventListener('click', saveNow);
  document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(); } });
  qa('[data-sh]').forEach((b) => b.addEventListener('click', () => {
    shTone = b.dataset.sh; qa('[data-sh]').forEach((x) => x.classList.toggle('on', x === b));
    if (sel) { const v = +q('[data-r="_shadow"] input').value || 12; put(sel, { 'text-shadow': shadowCss(v) }); }
  }));
  markSave();
  q('[data-copy]').addEventListener('click', (e) => {
    const names = { 'font-size': 'size', 'letter-spacing': 'letter spacing', 'line-height': 'line spacing', 'text-shadow': 'shadow', 'font-weight': 'weight', 'font-style': 'style', 'text-transform': 'case', 'text-decoration-line': 'underline', 'text-align': 'alignment', color: 'colour', opacity: 'opacity', 'margin-top': 'space above', 'margin-bottom': 'space below', padding: 'inner padding', 'max-width': 'max width', 'background-color': 'fill', 'border-radius': 'corners', 'border-color': 'border', 'backdrop-filter': 'blur behind', '-webkit-backdrop-filter': 'blur behind (Safari)', 'padding-block': 'section padding', background: 'section background', _bgOpacity: 'photo opacity', _veil: 'dark veil', _bgPosY: 'photo position (0% top, 100% bottom)', _itemGap: 'space between items', 'row-gap': 'space between items' };
    const skip = ['_html', '_origHtml', '_origText', '_newText', 'text-align-last', 'justify-items', 'justify-self', 'align-self', 'justify-content', 'align-items', 'display', 'width'];
    const lines = ['Design panel changes for ' + (location.pathname.split('/').pop() || 'home') + ':'];
    Object.entries(changes).forEach(([s, p]) => {
      const bits = Object.entries(p).filter(([k]) => k !== '_label' && !skip.includes(k)).map(([k, v]) => (names[k] || k) + ' ' + v);
      if (p._newText != null) bits.unshift('text "' + p._origText + '" → "' + p._newText + '"');
      if (bits.length) lines.push('- ' + (p._label || s) + ' [' + s + ']: ' + bits.join(', '));
    });
    copy(lines.join('\n'), e.target);
  });

  /* ---------------------------------------------- text box in the panel */
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  q('[data-txt]').addEventListener('input', (e) => {
    if (!sel) return;
    const el = sel; const ak = addKeyOf(el);
    if (ak && changes[ak]) { snap(); el.innerHTML = esc(e.target.value).replace(/\n/g, '<br>'); changes[ak]._html = el.innerHTML; save(); refresh(false); return; }
    const s3 = selectorFor(el); const prev = changes[s3] || {};
    if (el.dataset.obOrig == null) el.dataset.obOrig = el.innerHTML;
    const tmp = document.createElement('div'); tmp.innerHTML = el.dataset.obOrig;
    const origText = prev._origText || tmp.textContent.replace(/\s+/g, ' ').trim();
    const html = esc(e.target.value).replace(/\n/g, '<br>');
    snap();
    el.innerHTML = html;
    changes[s3] = Object.assign(prev, { _origHtml: prev._origHtml != null ? prev._origHtml : el.dataset.obOrig, _html: html, _origText: origText, _newText: e.target.value.replace(/\s+/g, ' ').trim(), _label: prev._label || '“' + origText.slice(0, 54) + '”' });
    save(); refresh(false);
  });

  /* ------------------------------------------------------- text editing */
  let editing = null; let editStart = '';
  const cleanHtml = (el) => {
    const c = el.cloneNode(true); c.querySelectorAll('.ob-hov,.ob-sel').forEach((n) => n.classList.remove('ob-hov', 'ob-sel')); c.querySelectorAll('[class=""]').forEach((n) => n.removeAttribute('class'));
    // Pressing Enter while editing makes <div> lines; inside a paragraph, heading or link they become line breaks.
    let h = c.innerHTML;
    if (/^(P|H[1-6]|SPAN|A|LI|STRONG|EM|LABEL|BUTTON)$/.test(el.tagName)) h = h.replace(/(&nbsp;|\s)*<div>(<br>)?/g, '<br>').replace(/<\/div>/g, '').replace(/^<br>/, '');
    return h;
  };
  const startEdit = (el) => {
    if (!el || P.contains(el)) return; if (editing) finishEdit();
    if (el !== sel) select(el);
    editing = el; editStart = cleanHtml(el);
    el.setAttribute('contenteditable', 'true'); el.style.setProperty('cursor', 'text', 'important'); el.style.setProperty('outline', '2px dashed #B39F74', 'important');
    el.focus();
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s1 = getSelection(); s1.removeAllRanges(); s1.addRange(r);
    q('[data-edittext]').textContent = 'Done editing ✓';
  };
  const finishEdit = () => {
    if (!editing) return; const el = editing; editing = null;
    el.removeAttribute('contenteditable'); el.style.removeProperty('cursor'); el.style.removeProperty('outline');
    q('[data-edittext]').textContent = 'Edit text ✎';
    const now = cleanHtml(el);
    if (now === editStart) return;
    const ak = addKeyOf(el); if (ak && changes[ak]) { snap(true); changes[ak]._html = now; save(); refresh(); return; }
    const s2 = selectorFor(el); const prev = changes[s2] || {};
    const origHtml = el.dataset.obOrig != null ? el.dataset.obOrig : editStart;
    const tmp = document.createElement('div'); tmp.innerHTML = origHtml; const origText = (prev._origText) || tmp.textContent.replace(/\s+/g, ' ').trim();
    el.dataset.obOrig = origHtml;
    snap(true);
    changes[s2] = Object.assign(prev, { _origHtml: prev._origHtml != null ? prev._origHtml : origHtml, _html: now, _origText: origText, _newText: el.textContent.replace(/\s+/g, ' ').trim(), _label: prev._label || '“' + origText.slice(0, 54) + '”' });
    save(); refresh();
  };
  q('[data-edittext]').addEventListener('click', () => { if (editing) finishEdit(); else if (sel) startEdit(sel); });
  document.addEventListener('dblclick', (e) => { if (!picking || inUi(e.target) || !document.body.contains(P)) return; e.preventDefault(); startEdit(e.target); }, true);
  document.addEventListener('focusout', (e) => { if (editing && e.target === editing) setTimeout(() => { if (editing && document.activeElement !== editing) finishEdit(); }, 0); }, true);

  /* ---------------------------------------------------- page interaction */
  let picking = true; let hov = null;
  const inUi = (t) => P.contains(t) || !!(t && t.closest && t.closest('#obr'));
  q('[data-pick]').addEventListener('click', () => { picking = !picking; q('[data-pick]').style.borderColor = picking ? '#B39F74' : ''; if (hov) hov.classList.remove('ob-hov'); });
  q('[data-pick]').style.borderColor = '#B39F74';
  document.addEventListener('mouseover', (e) => { if (!picking || inUi(e.target)) return; if (hov) hov.classList.remove('ob-hov'); hov = e.target; if (hov !== sel) hov.classList.add('ob-hov'); }, true);
  document.addEventListener('mouseout', (e) => { if (hov && e.target === hov) hov.classList.remove('ob-hov'); }, true);
  document.addEventListener('click', (e) => {
    if (!picking || inUi(e.target) || !document.body.contains(P)) return;
    if (editing && editing.contains(e.target)) { e.preventDefault(); e.stopPropagation(); return; }
    if (editing) finishEdit();
    e.preventDefault(); e.stopPropagation();
    // a click on a full-bleed background wrapper (its veil sits over the photo) selects the photo itself
    let t = e.target; const bw = t.closest && t.closest('[class*="__bg"], [class*="__media"]'); const bi = bw && bw.querySelector(':scope > img, :scope > picture img');
    if (bi && (t === bw || bw.contains(t)) && !t.closest('a, button, h1, h2, h3, p')) t = bi;
    if (e.detail < 2) select(t);
  }, true);
  document.addEventListener('keydown', (e) => {
    if (!document.body.contains(P)) return;
    const t = e.target; const typing = t && (t.isContentEditable || (/input|textarea|select/i.test(t.tagName) && !/range|color|checkbox/.test(t.type)));
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); }
    else if (e.key === 'Escape' && editing) { e.preventDefault(); finishEdit(); }
    else if (e.key === 'Escape' && !typing) select(null);
  });
  (() => { const h = q('.hd'); let sx, sy, ox, oy, on = false;
    h.addEventListener('mousedown', (e) => { if (e.target.closest('button')) return; on = true; sx = e.clientX; sy = e.clientY; const r = P.getBoundingClientRect(); ox = r.left; oy = r.top; e.preventDefault(); });
    document.addEventListener('mousemove', (e) => { if (!on) return; P.style.left = Math.max(0, ox + e.clientX - sx) + 'px'; P.style.top = Math.max(0, oy + e.clientY - sy) + 'px'; P.style.right = 'auto'; });
    document.addEventListener('mouseup', () => { on = false; }); })();

  /* ------------------------------------- publish to the GitHub preview branch */
  (() => {
    const REPO = 'Obelum-Website/obelumweb'; const BRANCH = 'preview'; const API = 'https://api.github.com/repos/' + REPO;
    const TOKEN_KEY = 'obelum-gh-token';
    const getTok = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } };
    const box = q('[data-gh]');
    const status = (t, c) => { const n = q('[data-savenote]'); n.textContent = t; n.style.color = c || ''; };
    const draw = () => {
      box.innerHTML = getTok()
        ? '<div class="note">GitHub connected: Save publishes to the preview (~1–2 min). <button class="btn" data-ghoff style="padding:3px 7px;margin-top:4px">Disconnect</button></div>'
        : '<div class="note" style="margin-bottom:4px">Connect GitHub once: Save then publishes to the preview.</div><div class="col"><input type="text" data-ghtok autocomplete="off" spellcheck="false" placeholder="Paste your GitHub key" style="-webkit-text-security:disc"><button class="btn gold" data-ghon>Connect</button></div>';
    };
    box.addEventListener('click', async (e) => {
      if (e.target.closest('[data-ghoff]')) { try { localStorage.removeItem(TOKEN_KEY); } catch (x) {} draw(); status('GitHub disconnected. Save now keeps changes in this browser only.'); return; }
      if (!e.target.closest('[data-ghon]')) return;
      const t = (q('[data-ghtok]').value || '').trim(); if (!t) return;
      try {
        const r = await fetch(API, { headers: { Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json' } }); const j = await r.json();
        if (!r.ok) throw new Error(j.message || r.status);
        localStorage.setItem(TOKEN_KEY, t); draw(); status('GitHub connected ✓ Press Save to publish to the preview.', '#9BC59D');
      } catch (x) { status('That key did not work (' + x.message + ').', '#E38A7A'); }
    });
    draw();

    const gh = async (path, opt = {}) => {
      const headers = { Authorization: 'Bearer ' + getTok(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
      if (opt.body) headers['Content-Type'] = 'application/json';
      const r = await fetch(API + path, Object.assign({}, opt, { headers, cache: 'no-store' }));
      if (!r.ok) { const er = new Error((await r.text()).slice(0, 160)); er.status = r.status; throw er; }
      return r.json();
    };
    const b64dec = (b) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
    const getFile = async (path, ref) => { try { return b64dec((await gh('/contents/' + path + '?ref=' + ref)).content); } catch (e) { if (e.status === 404) return null; throw e; } };

    /* text edits: replace an element's inner HTML in the page file without touching the rest of the file */
    const norm = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.innerHTML.replace(/\s+/g, ' ').trim(); };
    const textOf = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.replace(/\s+/g, ' ').trim(); };
    const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/;
    const innerRange = (src, tag, idx) => {
      const re = /<!--[\s\S]*?-->|<(script|style|textarea|template)\b[\s\S]*?<\/\1\s*>|<\/?([a-zA-Z][\w-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g;
      let m; let n = -1; let start = -1; let depth = 0;
      while ((m = re.exec(src))) {
        const name = (m[2] || '').toLowerCase(); const close = m[0][1] === '/';
        if (name !== tag) continue;
        if (start < 0) { if (!close && ++n === idx) { start = m.index + m[0].length; depth = 1; if (VOID.test(tag)) return null; } continue; }
        if (close) { if (--depth === 0) return [start, m.index]; } else if (!/\/>$/.test(m[0])) depth++;
      }
      return null;
    };
    /* whole element: [open tag start, open tag end, close tag start, close tag end] */
    const elRange = (src, tag, idx) => {
      const re = /<!--[\s\S]*?-->|<(script|style|textarea|template)\b[\s\S]*?<\/\1\s*>|<\/?([a-zA-Z][\w-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g;
      let m; let n = -1; let os = -1; let oe = -1; let depth = 0;
      while ((m = re.exec(src))) {
        const name = (m[2] || '').toLowerCase(); const close = m[0][1] === '/';
        if (name !== tag) continue;
        if (os < 0) { if (!close && ++n === idx) { os = m.index; oe = m.index + m[0].length; depth = 1; if (VOID.test(tag) || /\/>$/.test(m[0])) return [os, oe, oe, oe]; } continue; }
        if (close) { if (--depth === 0) return [os, oe, m.index, m.index + m[0].length]; } else if (!/\/>$/.test(m[0])) depth++;
      }
      return null;
    };
    const find = (src, sel) => { const doc = new DOMParser().parseFromString(src, 'text/html'); let l; try { l = doc.querySelectorAll(sel); } catch (e) { return null; } if (l.length !== 1) return null; const el = l[0]; const tag = el.tagName.toLowerCase(); return { doc, el, r: elRange(src, tag, [...doc.getElementsByTagName(tag)].indexOf(el)) }; };
    const count = (src) => new DOMParser().parseFromString(src, 'text/html').getElementsByTagName('*').length;
    const attrEsc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const patchAttrs = (src, sel, attrs) => {
      const f = find(src, sel); if (!f || !f.r) return [src, 'link not found in the page file'];
      let open = src.slice(f.r[0], f.r[1]);
      Object.entries(attrs).forEach(([k, v]) => {
        open = open.replace(new RegExp('\\s' + k + '\\s*=\\s*("[^"]*"|\'[^\']*\'|[^\\s>]*)', 'i'), '');
        if (v != null && v !== '') open = open.replace(/\s*(\/?)>$/, ' ' + k + '="' + attrEsc(v) + '"$1>');
      });
      const out = src.slice(0, f.r[0]) + open + src.slice(f.r[1]);
      const g = find(out, sel); if (!g || count(out) !== count(src) || Object.entries(attrs).some(([k, v]) => (g.el.getAttribute(k) || '') !== (v || ''))) return [src, 'safety check failed'];
      return [out, null];
    };
    const insertBox = (src, p, cls) => {
      const f = find(src, p._after || p._into); if (!f || !f.r) return [src, 'place not found in the page file'];
      const at = p._into ? f.r[2] : f.r[3];
      const out = src.slice(0, at) + '\n<p class="obx-text ' + cls + '">' + p._html + '</p>' + src.slice(at);
      if (new DOMParser().parseFromString(out, 'text/html').querySelectorAll('.' + cls).length !== 1) return [src, 'safety check failed'];
      return [out, null];
    };
    const removeBox = (src, cls) => {
      const f = find(src, '.' + cls); if (!f || !f.r) return [src, null];
      let s = f.r[0]; while (s > 0 && /[ \t]/.test(src[s - 1])) s--; if (src[s - 1] === '\n') s--;
      return [src.slice(0, s) + src.slice(f.r[3]), null];
    };
    const patchText = (src, sel, newHtml, expectHtml) => {
      const doc = new DOMParser().parseFromString(src, 'text/html');
      let list; try { list = doc.querySelectorAll(sel); } catch (e) { return [src, 'unknown element']; }
      if (list.length !== 1) return [src, 'element not found in the page file'];
      const el = list[0]; const tag = el.tagName.toLowerCase();
      if (norm(el.innerHTML) === norm(newHtml)) return [src, null];
      if (expectHtml != null && textOf(el.innerHTML) !== textOf(expectHtml)) return [src, 'the text in the file changed meanwhile'];
      const r = innerRange(src, tag, [...doc.getElementsByTagName(tag)].indexOf(el)); if (!r) return [src, 'element not found in the page file'];
      const out = src.slice(0, r[0]) + newHtml + src.slice(r[1]);
      const d2 = new DOMParser().parseFromString(out, 'text/html'); const e2 = d2.querySelectorAll(sel);
      const before = doc.getElementsByTagName('*').length - el.getElementsByTagName('*').length;
      if (e2.length !== 1 || norm(e2[0].innerHTML) !== norm(newHtml) || d2.getElementsByTagName('*').length - e2[0].getElementsByTagName('*').length !== before) return [src, 'safety check failed'];
      return [out, null];
    };

    /* styles: read the final values the panel applied and write them as CSS (beats the site's own rules) */
    const mediaXs = (im) => {
      const out = [];
      const walk = (list, media) => { [...list].forEach((r) => {
        if (r.cssRules && r.media) walk(r.cssRules, r.media.mediaText);
        else if (media && r.style && r.style.objectPosition) { try { if (im.matches(r.selectorText)) out.push([media, r.style.objectPosition.split(' ')[0]]); } catch (e) {} }
      }); };
      [...document.styleSheets].forEach((sh) => { try { if (!/design\//.test(sh.href || '')) walk(sh.cssRules, ''); } catch (e) {} });
      const last = new Map(); out.forEach(([m, x]) => last.set(m, x)); return [...last];
    };
    const buildCss = () => {
      const rules = new Map();
      const add = (sel, prop, val) => { if (!val) return; if (!rules.has(sel)) rules.set(sel, new Map()); rules.get(sel).set(prop, val); };
      const boost = (sel) => sel + ':not(#_o):not(#_o)';
      // Sizes, spacing, widths and alignment are set on a desktop screen in pixels, so they apply from
      // tablet-landscape width up only; phones keep the site's own mobile layout. Colours, fills,
      // photos, fonts and effects apply on every screen.
      const DESK = '@media (min-width: 60rem) { ';
      const SIZE = /^(font-size|line-height|letter-spacing|margin(-top|-bottom|-left|-right)?|padding(-block|-inline|-top|-bottom|-left|-right)?|max-width|width|height|grid-template-columns|row-gap|column-gap|gap|text-align|text-align-last|justify-self|justify-content|justify-items|align-self|align-items|translate)$/;
      const addR = (sel, prop, val) => add(SIZE.test(prop) ? DESK + sel : sel, prop, val);
      Object.entries(changes).forEach(([s, p]) => isAdd(s) || els(s).forEach((el) => Object.keys(p).forEach((k) => {
        if (k === 'max-width' && el.tagName === 'SECTION') return; // whole sections stay full width
        if (k[0] !== '_') addR(boost(selectorFor(el)), k, el.style.getPropertyValue(k) || (deskOnly(k) ? p[k] : ''));
        else if (k === '_itemGap') [...el.children].forEach((c, i) => addR(boost(selectorFor(c)), 'margin-top', c.style.getPropertyValue('margin-top') || (i && !wide() ? p._itemGap : '')));
        else if (k === '_gray') { const im = grayImg(el); if (im && +p._gray) add(boost(selectorFor(im)), 'filter', 'grayscale(1)'); }
        else if (k === '_bgOpacity') { const im = bgImgOf(el); if (im) add(boost(selectorFor(im)), 'opacity', im.style.getPropertyValue('opacity')); }
        else if (k === '_bgPosY') {
          const im = bgImgOf(el); if (!im) return; const sel = boost(selectorFor(im));
          add(sel, 'object-position', im.style.getPropertyValue('object-position'));
          /* keep the site's own left/right crop for other screen sizes; only the up/down value changes */
          mediaXs(im).forEach(([media, x]) => add('@media ' + media + ' { ' + sel, 'object-position', x + ' ' + p._bgPosY));
        }
        else if (k === '_veil') { const im = bgImgOf(el); if (im) { const vs = boost(selectorFor(im.parentElement)) + '::after'; add(vs, 'content', '""'); add(vs, 'position', 'absolute'); add(vs, 'inset', '0'); add(vs, 'background', 'rgba(28,30,29,' + im.parentElement.style.getPropertyValue('--ob-veil') + ')'); } }
      })));
      const imports = [...new Set(Object.values(changes).map((p) => p['font-family'] && fontUrl(p['font-family'])).filter(Boolean))];
      let out = imports.map((u) => '@import url("' + u + '");\n').join('') + '/* Written by the Obelum design panel (?edit) for ' + PAGE + '.html. Do not edit by hand: change it in the panel and Save. */\n';
      rules.forEach((pm, sel) => { out += sel + ' { ' + [...pm].map(([k, v]) => k + ': ' + v + ' !important').join('; ') + (sel.startsWith('@media') ? '; } }\n' : '; }\n'); });
      return out;
    };

    let busy = false; let again = false;
    publish = async () => {
      if (!getTok()) { status('Saved in this browser only. Connect your GitHub key above to publish to the preview.', '#E3B27A'); return; }
      if (busy) { again = true; return; } busy = true;
      status('Publishing to the preview…', '#B39F74');
      try {
        for (let attempt = 0; ; attempt++) {
          const head = (await gh('/git/ref/heads/' + BRANCH)).object.sha;
          const base = (await gh('/git/commits/' + head)).tree.sha;
          const pageFile = PAGE + '.html';
          let html = await getFile(pageFile, head); if (html == null) throw new Error(pageFile + ' is not in the repo');
          const old = (JSON.parse((await getFile('design/' + PAGE + '.json', head)) || '{}').changes) || {};
          // Three-way merge: what you changed in this tab wins; everything you did not touch keeps the
          // newest published value (so an older tab never undoes a later save or one of Claude's fixes).
          const merged = {};
          new Set([...Object.keys(PUBLISHED), ...Object.keys(changes), ...Object.keys(old)]).forEach((sel) => {
            const b = PUBLISHED[sel] || {}; const l = changes[sel] || {}; const o = old[sel] || {}; const m = {};
            new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(o)]).forEach((k) => {
              const v = JSON.stringify(l[k]) === JSON.stringify(b[k]) ? o[k] : l[k];
              if (v !== undefined) m[k] = v;
            });
            if (Object.keys(m).some((k) => k !== '_label')) merged[sel] = m;
          });
          clearAll(); changes = merged; applyAll();
          const problems = [];
          // new text boxes: removed ones first, then add (or update the text of) the rest, in order
          Object.keys(old).forEach((sel) => { if (isAdd(sel) && !changes[sel]) html = removeBox(html, addCls(sel))[0]; });
          Object.entries(changes).forEach(([sel, p]) => {
            if (!isAdd(sel)) return; const cls = addCls(sel);
            const [o, er] = new DOMParser().parseFromString(html, 'text/html').querySelector('.' + cls) ? patchText(html, '.' + cls, p._html, null) : insertBox(html, p, cls);
            if (er) problems.push('New text box: ' + er); else html = o;
          });
          Object.entries(changes).forEach(([sel, p]) => { if (isAdd(sel) || p._html == null) return; const [o, er] = patchText(html, sel, p._html, null); if (er) problems.push((p._label || sel) + ': ' + er); else html = o; });
          Object.entries(old).forEach(([sel, p]) => { if (isAdd(sel) || p._html == null || p._origHtml == null || (changes[sel] && changes[sel]._html != null)) return; const [o, er] = patchText(html, sel, p._origHtml, p._html); if (er) problems.push((p._label || sel) + ' (undo): ' + er); else html = o; });
          // button / link actions
          Object.entries(changes).forEach(([sel, p]) => { if (isAdd(sel) || p._href == null) return; const [o, er] = patchAttrs(html, sel, { href: p._href, target: p._target || null }); if (er) problems.push((p._label || sel) + ': ' + er); else html = o; });
          Object.entries(old).forEach(([sel, p]) => { if (isAdd(sel) || p._href == null || (changes[sel] && changes[sel]._href != null)) return; const [o, er] = patchAttrs(html, sel, { href: p._origHref || '', target: p._origTarget || null }); if (er) problems.push((p._label || sel) + ' (undo): ' + er); else html = o; });
          const href = 'assets/css/design/' + PAGE + '.css'; const v = Date.now().toString(36);
          if (html.includes(href)) html = html.split(href).map((part, i) => (i ? part.replace(/^\?v=\w+/, '') : part)).join(href + '?v=' + v);
          else { const m = html.match(/<link[^>]*styles\.css[^>]*>/); if (!m) throw new Error('styles.css link not found in ' + pageFile); html = html.replace(m[0], m[0] + '\n  <link rel="stylesheet" href="' + href + '?v=' + v + '">'); }
          const tree = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: base, tree: [
            { path: pageFile, mode: '100644', type: 'blob', content: html },
            { path: href, mode: '100644', type: 'blob', content: buildCss() },
            { path: 'design/' + PAGE + '.json', mode: '100644', type: 'blob', content: JSON.stringify({ page: PAGE, updated: new Date().toISOString(), changes }, null, 1) + '\n' },
          ] }) });
          const c = await gh('/git/commits', { method: 'POST', body: JSON.stringify({ message: 'Design panel: ' + PAGE + ' (' + Object.keys(changes).length + ' items)', tree: tree.sha, parents: [head] }) });
          try { await gh('/git/refs/heads/' + BRANCH, { method: 'PATCH', body: JSON.stringify({ sha: c.sha }) }); }
          catch (e) { if (e.status === 422 && attempt < 2) continue; throw e; }
          try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + ':draft'); } catch (e) {}
          PUBLISHED = JSON.parse(JSON.stringify(changes)); refresh();
          status('Published ✓ Wait about 1–2 min, then click Preview ↗.' + (problems.length ? ' Text not changed: ' + problems.join('; ') : ''), problems.length ? '#E3B27A' : '#9BC59D');
          break;
        }
      } catch (e) {
        status('Not published: ' + (e.status === 401 ? 'the GitHub key is invalid or expired.' : (e.status === 403 || e.status === 404) ? 'this GitHub key cannot write to obelumweb.' : e.message) + ' Your changes are saved in this browser.', '#E38A7A');
      }
      busy = false; if (again) { again = false; publish(); }
    };
  })();

  /* ---------------------------------------------------------------- rulers
     Top and left rulers in screen pixels. The selected item shows on both rulers, with dashed
     lines along its four edges across the page (to line it up with anything else), a size tag,
     and red measurements to the edges of the box it sits in. Drag from a ruler to add a blue
     guide (vertical guides stay put on screen, horizontal ones scroll with the page); drag a guide
     back onto its ruler to remove it. Guides are kept per page in this browser. */
  (() => {
    const RKEY = 'obelum-rulers'; const GKEY = 'obelum-guides:' + PAGE;
    const R = document.createElement('div'); R.id = 'obr';
    R.innerHTML = '<canvas class="rx"></canvas><canvas class="ry"></canvas><div class="corner" title="Rulers in screen pixels"></div><div data-lines></div><div data-guides></div>';
    document.body.appendChild(R);
    const cx = R.querySelector('.rx'); const cy = R.querySelector('.ry');
    const linesBox = R.querySelector('[data-lines]'); const guidesBox = R.querySelector('[data-guides]');
    let on = true; try { on = localStorage.getItem(RKEY) !== '0'; } catch (e) {}
    let guides = { v: [], h: [] }; try { guides = Object.assign(guides, JSON.parse(localStorage.getItem(GKEY) || '{}')); } catch (e) {}
    const keep = () => { try { localStorage.setItem(GKEY, JSON.stringify(guides)); } catch (e) {} };
    const btn = q('[data-rulers]');
    const show = () => { R.hidden = !on; btn.style.borderColor = on ? '#B39F74' : ''; last = ''; };
    btn.addEventListener('click', () => { on = !on; try { localStorage.setItem(RKEY, on ? '1' : '0'); } catch (e) {} show(); });

    const drawRuler = (cv, horiz, len, hi, hov) => {
      const dpr = window.devicePixelRatio || 1; const w = horiz ? len : 20; const h = horiz ? 20 : len;
      if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#1c1d1c'; g.fillRect(0, 0, w, h);
      if (hov) { g.fillStyle = 'rgba(179,159,116,.18)'; horiz ? g.fillRect(hov[0], 0, hov[1] - hov[0], 20) : g.fillRect(0, hov[0], 20, hov[1] - hov[0]); }
      if (hi) { g.fillStyle = 'rgba(179,159,116,.45)'; horiz ? g.fillRect(hi[0], 0, hi[1] - hi[0], 20) : g.fillRect(0, hi[0], 20, hi[1] - hi[0]); }
      g.strokeStyle = 'rgba(247,245,241,.55)'; g.fillStyle = 'rgba(247,245,241,.8)'; g.lineWidth = 1; g.font = '9px system-ui, sans-serif';
      g.beginPath();
      for (let p = 0; p <= len; p += 10) {
        const t = p % 100 === 0 ? 20 : p % 50 === 0 ? 10 : 5; const x = Math.round(p) + .5;
        if (horiz) { g.moveTo(x, 20); g.lineTo(x, 20 - t); } else { g.moveTo(20, x); g.lineTo(20 - t, x); }
        if (p % 100 === 0 && p) { if (horiz) g.fillText(String(p), p + 3, 9); else { g.save(); g.translate(9, p - 3); g.rotate(-Math.PI / 2); g.fillText(String(p), 0, 0); g.restore(); } }
      }
      g.stroke();
      // centre of the screen, in gold
      const mid = Math.round(len / 2); g.fillStyle = '#B39F74'; g.beginPath();
      if (horiz) { g.moveTo(mid - 5, 0); g.lineTo(mid + 5, 0); g.lineTo(mid, 7); } else { g.moveTo(0, mid - 5); g.lineTo(0, mid + 5); g.lineTo(7, mid); }
      g.fill();
      g.strokeStyle = 'rgba(247,245,241,.25)'; g.beginPath(); if (horiz) { g.moveTo(0, 19.5); g.lineTo(w, 19.5); } else { g.moveTo(19.5, 0); g.lineTo(19.5, h); } g.stroke();
    };
    const el = (cls, css, txt) => { const d = document.createElement('div'); d.className = cls; Object.assign(d.style, css); if (txt != null) { const s = document.createElement('span'); s.textContent = txt; d.appendChild(s); } return d; };
    const boxOf = (n) => { // the nearest ancestor that is a real box (wider or taller than the item)
      for (let a = n.parentElement; a && a !== document.body; a = a.parentElement) { const r = a.getBoundingClientRect(); const s = n.getBoundingClientRect(); if (r.width > s.width + 1 || r.height > s.height + 1) return a; }
      return null;
    };
    let last = '';
    const frame = () => {
      requestAnimationFrame(frame);
      if (!on || !document.body.contains(P)) { if (!R.hidden && !on) R.hidden = true; return; }
      const W = window.innerWidth; const H = window.innerHeight; const sy = window.scrollY;
      const sr = sel && document.body.contains(sel) ? sel.getBoundingClientRect() : null;
      const hr = hov && hov !== sel && document.body.contains(hov) ? hov.getBoundingClientRect() : null;
      const key = [W, H, sy, sr && [sr.left, sr.top, sr.width, sr.height].map(Math.round), hr && [hr.left, hr.width, hr.top, hr.height].map(Math.round), JSON.stringify(guides)].join('|');
      if (key === last) return; last = key;
      drawRuler(cx, true, W, sr && [sr.left, sr.right], hr && [hr.left, hr.right]);
      drawRuler(cy, false, H, sr && [sr.top, sr.bottom], hr && [hr.top, hr.bottom]);
      linesBox.textContent = '';
      if (sr && sr.width + sr.height > 0) {
        [sr.left, sr.right].forEach((x) => linesBox.appendChild(el('ln v', { left: Math.round(x) + 'px' })));
        [sr.top, sr.bottom].forEach((y) => linesBox.appendChild(el('ln h', { top: Math.round(y) + 'px' })));
        const tag = el('tag', { left: Math.max(24, Math.round(sr.left)) + 'px', top: Math.max(24, Math.round(sr.top) - 22) + 'px' });
        tag.textContent = Math.round(sr.width) + ' × ' + Math.round(sr.height) + '  ·  x ' + Math.round(sr.left) + '  y ' + Math.round(sr.top + sy);
        linesBox.appendChild(tag);
        const box = boxOf(sel);
        if (box) {
          const b = box.getBoundingClientRect(); const midY = Math.round(sr.top + sr.height / 2); const midX = Math.round(sr.left + sr.width / 2);
          const gap = (cls, css, n) => { if (n >= 1) linesBox.appendChild(el('gap ' + cls, css, Math.round(n) + '')); };
          gap('h', { left: b.left + 'px', width: (sr.left - b.left) + 'px', top: midY + 'px' }, sr.left - b.left);
          gap('h', { left: sr.right + 'px', width: (b.right - sr.right) + 'px', top: midY + 'px' }, b.right - sr.right);
          gap('v', { top: b.top + 'px', height: (sr.top - b.top) + 'px', left: midX + 'px' }, sr.top - b.top);
          gap('v', { top: sr.bottom + 'px', height: (b.bottom - sr.bottom) + 'px', left: midX + 'px' }, b.bottom - sr.bottom);
        }
      }
      guidesBox.textContent = '';
      guides.v.forEach((x, i) => { const g = el('gd v', { left: x + 'px' }, x + ''); g.dataset.g = 'v' + i; guidesBox.appendChild(g); });
      guides.h.forEach((y, i) => { const top = y - sy; if (top < 20 || top > H) return; const g = el('gd h', { top: top + 'px' }, y + ''); g.dataset.g = 'h' + i; guidesBox.appendChild(g); });
    };
    // dragging: from a ruler makes a new guide; from a guide moves it; dropped on its ruler removes it
    let drag = null;
    const start = (axis, i) => (e) => { e.preventDefault(); e.stopPropagation(); if (i == null) { guides[axis].push(axis === 'v' ? e.clientX : Math.round(e.clientY + window.scrollY)); i = guides[axis].length - 1; } drag = { axis, i }; last = ''; };
    cx.addEventListener('mousedown', (e) => start('v')(e));
    cy.addEventListener('mousedown', (e) => start('h')(e));
    guidesBox.addEventListener('mousedown', (e) => { const g = e.target.closest('[data-g]'); if (!g) return; start(g.dataset.g[0], +g.dataset.g.slice(1))(e); });
    window.addEventListener('mousemove', (e) => { if (!drag) return; guides[drag.axis][drag.i] = drag.axis === 'v' ? Math.round(e.clientX) : Math.round(e.clientY + window.scrollY); });
    window.addEventListener('mouseup', (e) => {
      if (!drag) return;
      if (drag.axis === 'v' ? e.clientY < 20 : e.clientX < 20) guides[drag.axis].splice(drag.i, 1); // back on the ruler it came from
      drag = null; keep(); last = '';
    });
    R.addEventListener('click', (e) => { e.stopPropagation(); });
    R.querySelector('.corner').addEventListener('dblclick', () => { guides = { v: [], h: [] }; keep(); last = ''; });
    R.querySelector('.corner').title = 'Rulers in screen pixels. Double-click here to clear all guides.';
    show(); requestAnimationFrame(frame);
  })();

  applyAll(); refresh();
})();
