/* Obelum design panel (v3). Loads only when the page URL contains ?edit.
   Click any element to select it, adjust it, then press "Copy my changes"
   and paste the result to Claude. Changes live only in this browser until
   Claude applies them to the site. */
(() => {
  const PALETTE = [
    ['Anthracite', '#2D302F'], ['Deep Umber', '#4A3522'], ['Raw Umber', '#7A5938'], ['Obelum Gold', '#B39F74'],
    ['Smoke', '#8E8B85'], ['Timberwolf', '#D7D0C7'], ['Chalk White', '#F7F5F1'], ['White', '#FFFFFF'],
  ];
  const KEY = 'obelum-edit3:' + location.pathname;
  let changes = {};
  try { changes = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { changes = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(changes)); } catch (e) {} };

  /* ---------------------------------------------------------------- styles */
  const css = document.createElement('style');
  css.textContent = `
  .ob-hov { outline: 1px dashed rgba(179,159,116,.9) !important; outline-offset: 2px; cursor: crosshair !important; }
  .ob-sel { outline: 2px solid #B39F74 !important; outline-offset: 3px; }
  #obp { position: fixed; z-index: 2147483000; top: 76px; right: 14px; width: 320px; max-height: calc(100vh - 92px); display: flex; flex-direction: column;
    background: #1c1d1c; color: #EDEAE4; border: 1px solid rgba(247,245,241,.12); border-radius: 14px; box-shadow: 0 24px 60px rgba(0,0,0,.45);
    font: 12px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
  #obp * { box-sizing: border-box; font-family: inherit; letter-spacing: normal; text-transform: none; font-style: normal; }
  #obp .hd { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid rgba(247,245,241,.08); cursor: move; user-select: none; }
  #obp .hd b { flex: 1; font-size: 12.5px; font-weight: 600; color: #B39F74; }
  #obp .ic { width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(247,245,241,.14); background: rgba(247,245,241,.04); color: #EDEAE4; cursor: pointer; display: grid; place-items: center; font-size: 13px; padding: 0; }
  #obp .ic:hover { border-color: #B39F74; }
  #obp .ic:disabled { opacity: .35; cursor: default; }
  #obp .bd { overflow: auto; padding: 4px 0 8px; }
  #obp .sel { margin: 8px 12px; padding: 9px 10px; border-radius: 10px; background: rgba(247,245,241,.05); }
  #obp .sel .t { color: #fff; font-weight: 500; word-break: break-word; }
  #obp .crumbs { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
  #obp .crumbs button { border: 1px solid rgba(247,245,241,.14); background: none; color: #BDB7AE; border-radius: 6px; padding: 2px 6px; font-size: 11px; cursor: pointer; }
  #obp .crumbs button.on { border-color: #B39F74; color: #B39F74; }
  #obp details { border-top: 1px solid rgba(247,245,241,.07); }
  #obp summary { list-style: none; cursor: pointer; padding: 10px 12px; font-size: 11px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: #B39F74; display: flex; justify-content: space-between; }
  #obp summary::-webkit-details-marker { display: none; }
  #obp summary::after { content: "+"; color: #8E8B85; font-weight: 400; }
  #obp details[open] summary::after { content: "–"; }
  #obp .grp { padding: 0 12px 12px; display: grid; gap: 10px; }
  #obp .row { display: grid; grid-template-columns: 92px 1fr 58px; align-items: center; gap: 8px; }
  #obp .row > span { color: #BDB7AE; }
  #obp input[type=range] { width: 100%; accent-color: #B39F74; }
  #obp input[type=number], #obp input[type=text] { all: unset; box-sizing: border-box !important; display: block !important; width: 100% !important; height: 26px !important; padding: 0 6px !important; border-radius: 6px !important; border: 1px solid rgba(247,245,241,.16) !important; background: rgba(247,245,241,.06) !important; color: #fff !important; -webkit-text-fill-color: #fff !important; font: 12px/26px system-ui, -apple-system, sans-serif !important; text-indent: 0 !important; }
  #obp input[type=color] { width: 30px; height: 26px; padding: 0; border: 1px solid rgba(247,245,241,.2); border-radius: 6px; background: none; cursor: pointer; }
  #obp .seg { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid rgba(247,245,241,.16); border-radius: 8px; overflow: hidden; }
  #obp .seg button { padding: 7px 0; background: none; border: 0; border-right: 1px solid rgba(247,245,241,.1); color: #EDEAE4; cursor: pointer; font-size: 12px; }
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
  #obp .btn { padding: 7px 10px; border-radius: 8px; border: 1px solid rgba(247,245,241,.18); background: rgba(247,245,241,.04); color: #EDEAE4; cursor: pointer; font-size: 12px; }
  #obp .btn:hover { border-color: #B39F74; }
  #obp .btn.gold { background: #B39F74; border-color: #B39F74; color: #1c1d1c; font-weight: 600; }
  #obp .note { color: #8E8B85; font-size: 11px; }
  #obp .list { display: grid; gap: 4px; max-height: 160px; overflow: auto; }
  #obp .list div { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; padding: 5px 7px; border-radius: 6px; background: rgba(247,245,241,.04); }
  #obp .list span { color: #D7D0C7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #obp .list button { background: none; border: 0; color: #8E8B85; cursor: pointer; font-size: 14px; }
  #obp .ft { padding: 10px 12px; border-top: 1px solid rgba(247,245,241,.08); display: grid; gap: 8px; }
  #obp .ft .two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  #obp.min .bd, #obp.min .ft { display: none; }
  #obp .off { opacity: .4; pointer-events: none; }`;
  document.head.appendChild(css);
  const veilCss = document.createElement('style');
  veilCss.textContent = '[data-ob-veil]::after { background: rgba(28,30,29,var(--ob-veil)) !important; }';
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
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (el.tagName === 'IMG') return 'Image';
    return t ? '“' + (t.length > 54 ? t.slice(0, 54) + '…' : t) + '”' : '<' + el.tagName.toLowerCase() + '>';
  };
  const bgImgOf = (el) => {
    const sec = el.matches('section') ? el : sectionOf(el); if (!sec) return null;
    return sec.querySelector(':scope > [class*="__bg"] img, :scope > [class*="__media"] img, :scope [class*="__photo"] img, :scope > .phero__bg img');
  };
  const els = (sel) => { try { return [...document.querySelectorAll(sel)]; } catch (e) { return []; } };

  /* ------------------------------------------------- apply / clear changes */
  const applyProp = (el, k, v) => {
    if (k === '_bgOpacity') { const im = bgImgOf(el); if (im) im.style.setProperty('opacity', v, 'important'); }
    else if (k === '_veil') { const im = bgImgOf(el); if (im) { im.parentElement.dataset.obVeil = '1'; im.parentElement.style.setProperty('--ob-veil', v); } }
    else if (k === '_itemGap') { [...el.children].forEach((c, i) => { if (i && getComputedStyle(c).display !== 'inline') c.style.setProperty('margin-top', v, 'important'); }); }
    else if (k === '_bgPosY') { const im = bgImgOf(el); if (im) { const x = (getComputedStyle(im).objectPosition.split(' ')[0]) || '50%'; im.style.setProperty('object-position', x + ' ' + v, 'important'); } }
    else if (k[0] !== '_') el.style.setProperty(k, v, 'important');
  };
  const clearProp = (el, k) => {
    if (k === '_bgOpacity') { const im = bgImgOf(el); if (im) im.style.removeProperty('opacity'); }
    else if (k === '_veil') { const im = bgImgOf(el); if (im) { delete im.parentElement.dataset.obVeil; im.parentElement.style.removeProperty('--ob-veil'); } }
    else if (k === '_itemGap') { [...el.children].forEach((c) => c.style.removeProperty('margin-top')); }
    else if (k === '_bgPosY') { const im = bgImgOf(el); if (im) im.style.removeProperty('object-position'); }
    else if (k[0] !== '_') el.style.removeProperty(k);
  };
  const applyAll = () => Object.entries(changes).forEach(([s, p]) => els(s).forEach((el) => Object.entries(p).forEach(([k, v]) => applyProp(el, k, v))));
  const clearAll = () => Object.entries(changes).forEach(([s, p]) => els(s).forEach((el) => Object.keys(p).forEach((k) => clearProp(el, k))));

  /* history */
  const past = []; const future = []; let lastPush = 0;
  const snap = (force) => { const now = Date.now(); if (force || now - lastPush > 700) { past.push(JSON.stringify(changes)); if (past.length > 150) past.shift(); future.length = 0; } lastPush = now; };
  const restore = (state) => { clearAll(); changes = JSON.parse(state); save(); applyAll(); refresh(); };
  const undo = () => { if (!past.length) return; future.push(JSON.stringify(changes)); restore(past.pop()); lastPush = 0; };
  const redo = () => { if (!future.length) return; past.push(JSON.stringify(changes)); restore(future.pop()); lastPush = 0; };

  /* set values on the selection */
  let sel = null;
  const put = (el, props, label) => {
    const s = selectorFor(el); snap();
    els(s).forEach((e) => Object.keys(props).forEach((k) => clearProp(e, k)));
    changes[s] = Object.assign(changes[s] || {}, props, { _label: label || describe(el) });
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
    <button class="ic" data-pick title="Select mode on/off">◎</button><button class="ic" data-min title="Minimise">–</button></div>
  <div class="bd">
    <div class="sel"><div class="t" data-name>Click anything on the page to select it.</div><div class="note" data-path></div><div class="crumbs" data-crumbs></div></div>
    <div data-ctrls class="off">
    <details open><summary>Text</summary><div class="grp">
      ${rng('font-size', 'Size', 8, 140, 1, 'px')}
      ${rng('letter-spacing', 'Letter spacing', -0.05, 0.4, 0.005, 'em')}
      ${rng('line-height', 'Line spacing', 0.8, 2.6, 0.02, '')}
      ${rng('_shadow', 'Shadow', 0, 40, 1, 'px')}
      <div class="ticks"><label><input type="checkbox" data-tick="bold"> Bold</label><label><input type="checkbox" data-tick="italic"> Italic</label>
        <label><input type="checkbox" data-tick="upper"> Uppercase</label><label><input type="checkbox" data-tick="under"> Underline</label></div>
      <div><div class="note" style="margin-bottom:5px">Alignment</div><div class="seg" data-align><button data-a="left">Left</button><button data-a="center">Center</button><button data-a="right">Right</button><button data-a="justify">Justify</button></div></div>
    </div></details>
    <details open><summary>Colour</summary><div class="grp">
      <div class="sw" data-sw></div>
      <div class="col"><input type="color" data-color><input type="text" data-hexin maxlength="7"><button class="btn" data-copyhex>Copy #</button></div>
      ${rng('opacity', 'Opacity', 0, 1, 0.05, '')}
    </div></details>
    <details><summary>Spacing</summary><div class="grp">
      ${rng('_itemGap', 'Between items', 0, 120, 1, 'px')}
      <div class="note" data-gapnote>Spaces the lines/items inside the selected group (or its parent group).</div>
      ${rng('margin-top', 'Space above', -80, 200, 1, 'px')}
      ${rng('margin-bottom', 'Space below', -80, 200, 1, 'px')}
      ${rng('padding', 'Inner padding', 0, 120, 1, 'px')}
      ${rng('max-width', 'Max width', 0, 1600, 10, 'px')}
    </div></details>
    <details><summary>Box &amp; button</summary><div class="grp">
      <div class="col"><input type="color" data-boxc><input type="text" data-boxhex maxlength="7"><span class="note">fill</span></div>
      ${rng('_bgAlpha', 'Fill opacity', 0, 1, 0.05, '')}
      ${rng('border-radius', 'Rounded corners', 0, 60, 1, 'px')}
      ${rng('_borderAlpha', 'Border opacity', 0, 1, 0.05, '')}
    </div></details>
    <details><summary>Section</summary><div class="grp" data-secg>
      ${rng('padding-block', 'Height (padding)', 0, 240, 2, 'px')}
      <div class="col"><input type="color" data-secc><input type="text" data-sechex maxlength="7"><span class="note">background</span></div>
      ${rng('_bgOpacity', 'Photo opacity', 0, 1, 0.05, '')}
      ${rng('_veil', 'Dark veil', 0, 0.95, 0.01, '')}
      ${rng('_bgPosY', 'Photo up / down', 0, 100, 1, '%')}
    </div></details>
    <div style="padding:8px 12px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="btn" data-parent>Select parent ↑</button><button class="btn" data-resetone>Reset this item</button></div>
    </div>
    <details><summary>Changes <span data-count style="color:#8E8B85;font-weight:400"></span></summary><div class="grp"><div class="list" data-list></div></div></details>
  </div>
  <div class="ft"><button class="btn gold" data-copy>Copy my changes</button>
    <div class="two"><button class="btn" data-resetall>Reset all</button><button class="btn" data-close>Close panel</button></div>
    <div class="note">Only you see these changes. Paste the copied text to Claude to make them real.</div></div>`;
  document.body.appendChild(P);
  const q = (s) => P.querySelector(s); const qa = (s) => [...P.querySelectorAll(s)];
  PALETTE.forEach(([n, h]) => { const b = document.createElement('button'); b.title = n + ' ' + h; b.style.background = h; b.dataset.hex = h; q('[data-sw]').appendChild(b); });

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
    rowSet('font-size', Math.round(fs));
    rowSet('letter-spacing', cs.letterSpacing === 'normal' ? 0 : +(parseFloat(cs.letterSpacing) / fs).toFixed(3));
    rowSet('line-height', cs.lineHeight === 'normal' ? 1.2 : +(parseFloat(cs.lineHeight) / fs).toFixed(2));
    const sm = cs.textShadow.match(/(\d+(?:\.\d+)?)px(?=[^)]*$)/); rowSet('_shadow', cs.textShadow === 'none' ? 0 : (sm ? Math.round(+sm[1]) : 0));
    q('[data-tick="bold"]').checked = (parseInt(cs.fontWeight, 10) || 400) >= 600;
    q('[data-tick="italic"]').checked = cs.fontStyle === 'italic';
    q('[data-tick="upper"]').checked = cs.textTransform === 'uppercase';
    q('[data-tick="under"]').checked = /underline/.test(cs.textDecorationLine);
    const al = (cs.textAlignLast === 'justify' || cs.textAlign === 'justify') ? 'justify' : ({ start: 'left', end: 'right', '-webkit-center': 'center' }[cs.textAlign] || cs.textAlign);
    qa('[data-a]').forEach((b) => b.classList.toggle('on', b.dataset.a === al));
    const hex = toHex(cs.color); q('[data-color]').value = hex; q('[data-hexin]').value = hex;
    qa('[data-sw] button').forEach((b) => b.classList.toggle('on', b.dataset.hex === hex));
    rowSet('opacity', +cs.opacity);
    const g = groupOf(el); const k1 = g && g.children[1];
    rowSet('_itemGap', k1 ? Math.round(parseFloat(getComputedStyle(k1).marginTop) || parseFloat(getComputedStyle(g).rowGap) || 0) : 0);
    q('[data-gapnote]').textContent = g === el ? 'Spaces the items inside this group.' : 'This item has no inner items, so this spaces its parent group.';
    rowSet('margin-top', Math.round(parseFloat(cs.marginTop) || 0)); rowSet('margin-bottom', Math.round(parseFloat(cs.marginBottom) || 0));
    rowSet('padding', Math.round(parseFloat(cs.paddingTop) || 0)); rowSet('max-width', cs.maxWidth === 'none' ? Math.round(el.getBoundingClientRect().width) : Math.round(parseFloat(cs.maxWidth)));
    q('[data-boxc]').value = toHex(cs.backgroundColor); q('[data-boxhex]').value = toHex(cs.backgroundColor);
    rowSet('_bgAlpha', alphaOf(cs.backgroundColor)); rowSet('border-radius', Math.round(parseFloat(cs.borderTopLeftRadius) || 0)); rowSet('_borderAlpha', alphaOf(cs.borderTopColor));
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
  const onRange = (key, v, unit) => {
    if (!sel) return;
    const val = v + (unit || '');
    if (key === '_shadow') return put(sel, { 'text-shadow': +v ? `0 2px ${v}px rgba(0,0,0,.55)` : 'none' });
    if (key === '_itemGap') {
      const g = groupOf(sel); if (!g) return;
      const gcs = getComputedStyle(g);
      if (/flex|grid/.test(gcs.display)) return put(g, { 'row-gap': val }, describe(g) + ' (group)');
      const blockKids = [...g.children].filter((c) => getComputedStyle(c).display !== 'inline');
      if (blockKids.length > 1) return put(g, { _itemGap: val }, describe(g) + ' (group)');
      const fs = parseFloat(gcs.fontSize); return put(g, { 'line-height': ((fs * 1.15 + +v) / fs).toFixed(2) }, describe(g) + ' (lines)');
    }
    if (key === '_bgAlpha') return put(sel, { 'background-color': rgba(q('[data-boxc]').value, v) });
    if (key === '_borderAlpha') { const c = toHex(getComputedStyle(sel).borderTopColor); return put(sel, { 'border-color': rgba(c, v) }); }
    if (['padding-block', '_bgOpacity', '_veil', '_bgPosY'].includes(key)) return putSec({ [key]: val });
    put(sel, { [key]: val });
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
  const setColor = (h) => { if (!sel || !/^#[0-9a-f]{6}$/i.test(h)) return; put(sel, { color: h.toUpperCase() }); };
  q('[data-color]').addEventListener('input', (e) => { q('[data-hexin]').value = e.target.value.toUpperCase(); setColor(e.target.value); });
  q('[data-hexin]').addEventListener('change', (e) => setColor(e.target.value.trim()));
  q('[data-sw]').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setColor(b.dataset.hex); });
  const copy = async (txt, btn) => { try { await navigator.clipboard.writeText(txt); } catch (e) { window.prompt('Copy:', txt); } const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = o; }, 1300); };
  q('[data-copyhex]').addEventListener('click', (e) => copy(q('[data-hexin]').value.toUpperCase(), e.target));
  const setBox = (h) => { if (!sel || !/^#[0-9a-f]{6}$/i.test(h)) return; const a = +q('[data-r="_bgAlpha"] input').value || 1; put(sel, { 'background-color': rgba(h, a) }); };
  q('[data-boxc]').addEventListener('input', (e) => { q('[data-boxhex]').value = e.target.value.toUpperCase(); setBox(e.target.value); });
  q('[data-boxhex]').addEventListener('change', (e) => setBox(e.target.value.trim()));
  const setSecBg = (h) => { if (/^#[0-9a-f]{6}$/i.test(h)) putSec({ background: h.toUpperCase() }); };
  q('[data-secc]').addEventListener('input', (e) => { q('[data-sechex]').value = e.target.value.toUpperCase(); setSecBg(e.target.value); });
  q('[data-sechex]').addEventListener('change', (e) => setSecBg(e.target.value.trim()));

  const select = (el) => { if (sel) sel.classList.remove('ob-sel'); sel = el; if (sel) { sel.classList.remove('ob-hov'); sel.classList.add('ob-sel'); } refresh(); };
  q('[data-crumbs]').addEventListener('click', (e) => { const b = e.target.closest('[data-crumb]'); if (b) select(q('[data-crumbs]')._chain[+b.dataset.crumb]); });
  q('[data-parent]').addEventListener('click', () => { if (sel && sel.parentElement && sel.parentElement !== document.body) select(sel.parentElement); });
  q('[data-resetone]').addEventListener('click', () => { if (!sel) return; const s = selectorFor(sel); if (!changes[s]) return; snap(true); els(s).forEach((e) => Object.keys(changes[s]).forEach((k) => clearProp(e, k))); delete changes[s]; save(); refresh(); });
  q('[data-list]').addEventListener('click', (e) => { const b = e.target.closest('[data-del]'); if (!b) return; const s = decodeURIComponent(b.dataset.del); snap(true); els(s).forEach((x) => Object.keys(changes[s]).forEach((k) => clearProp(x, k))); delete changes[s]; save(); refresh(); });
  q('[data-resetall]').addEventListener('click', () => { if (!Object.keys(changes).length) return; snap(true); clearAll(); changes = {}; save(); refresh(); });
  q('[data-undo]').addEventListener('click', undo); q('[data-redo]').addEventListener('click', redo);
  q('[data-min]').addEventListener('click', () => P.classList.toggle('min'));
  q('[data-close]').addEventListener('click', () => { picking = false; if (sel) sel.classList.remove('ob-sel'); P.remove(); });
  q('[data-copy]').addEventListener('click', (e) => {
    const names = { 'font-size': 'size', 'letter-spacing': 'letter spacing', 'line-height': 'line spacing', 'text-shadow': 'shadow', 'font-weight': 'weight', 'font-style': 'style', 'text-transform': 'case', 'text-decoration-line': 'underline', 'text-align': 'alignment', color: 'colour', opacity: 'opacity', 'margin-top': 'space above', 'margin-bottom': 'space below', padding: 'inner padding', 'max-width': 'max width', 'background-color': 'fill', 'border-radius': 'corners', 'border-color': 'border', 'padding-block': 'section padding', background: 'section background', _bgOpacity: 'photo opacity', _veil: 'dark veil', _bgPosY: 'photo position (0% top, 100% bottom)', _itemGap: 'space between items', 'row-gap': 'space between items' };
    const skip = ['text-align-last', 'justify-items', 'justify-self', 'align-self', 'justify-content', 'align-items', 'display', 'width'];
    const lines = ['Design panel changes for ' + (location.pathname.split('/').pop() || 'home') + ':'];
    Object.entries(changes).forEach(([s, p]) => {
      const bits = Object.entries(p).filter(([k]) => k !== '_label' && !skip.includes(k)).map(([k, v]) => (names[k] || k) + ' ' + v);
      if (bits.length) lines.push('- ' + (p._label || s) + ' [' + s + ']: ' + bits.join(', '));
    });
    copy(lines.join('\n'), e.target);
  });

  /* ---------------------------------------------------- page interaction */
  let picking = true; let hov = null;
  q('[data-pick]').addEventListener('click', () => { picking = !picking; q('[data-pick]').style.borderColor = picking ? '#B39F74' : ''; if (hov) hov.classList.remove('ob-hov'); });
  q('[data-pick]').style.borderColor = '#B39F74';
  document.addEventListener('mouseover', (e) => { if (!picking || P.contains(e.target)) return; if (hov) hov.classList.remove('ob-hov'); hov = e.target; if (hov !== sel) hov.classList.add('ob-hov'); }, true);
  document.addEventListener('mouseout', (e) => { if (hov && e.target === hov) hov.classList.remove('ob-hov'); }, true);
  document.addEventListener('click', (e) => { if (!picking || P.contains(e.target) || !document.body.contains(P)) return; e.preventDefault(); e.stopPropagation(); select(e.target); }, true);
  document.addEventListener('keydown', (e) => {
    if (!document.body.contains(P)) return;
    const t = e.target; const typing = t && (t.isContentEditable || (/input|textarea|select/i.test(t.tagName) && !/range|color|checkbox/.test(t.type)));
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); }
    else if (e.key === 'Escape' && !typing) select(null);
  });
  (() => { const h = q('.hd'); let sx, sy, ox, oy, on = false;
    h.addEventListener('mousedown', (e) => { if (e.target.closest('button')) return; on = true; sx = e.clientX; sy = e.clientY; const r = P.getBoundingClientRect(); ox = r.left; oy = r.top; e.preventDefault(); });
    document.addEventListener('mousemove', (e) => { if (!on) return; P.style.left = Math.max(0, ox + e.clientX - sx) + 'px'; P.style.top = Math.max(0, oy + e.clientY - sy) + 'px'; P.style.right = 'auto'; });
    document.addEventListener('mouseup', () => { on = false; }); })();

  applyAll(); refresh();
})();
