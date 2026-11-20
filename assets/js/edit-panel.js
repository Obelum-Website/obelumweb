/* Obelum design panel. Loads only when the page URL contains ?edit.
   Click any element to select it, adjust it with the sliders, then press
   "Copy my changes" and paste the result to Claude. Nothing is saved to the
   live site from here; changes are kept only in this browser. */
(() => {
  const PALETTE = [
    ['Anthracite', '#2D302F'], ['Deep Umber', '#4A3522'], ['Raw Umber', '#7A5938'],
    ['Obelum Gold', '#B39F74'], ['Smoke', '#8E8B85'], ['Timberwolf', '#D7D0C7'],
    ['Chalk White', '#F7F5F1'], ['White', '#FFFFFF'],
  ];
  const KEY = 'obelum-edit:' + location.pathname;
  let changes = {};
  try { changes = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { changes = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(changes)); } catch (e) {} };

  /* ---------- styles ---------- */
  const css = document.createElement('style');
  css.textContent = `
  .ob-ed-hover { outline: 1px dashed #B39F74 !important; outline-offset: 2px; cursor: crosshair !important; }
  .ob-ed-sel { outline: 2px solid #B39F74 !important; outline-offset: 2px; }
  #ob-ed { position: fixed; z-index: 2147483000; top: 80px; right: 16px; width: 300px; max-height: calc(100vh - 100px); overflow: auto;
    background: rgba(28,30,29,.94); color: #F7F5F1; border: 1px solid rgba(247,245,241,.15); border-radius: 14px;
    font: 13px/1.4 system-ui, -apple-system, Segoe UI, sans-serif; box-shadow: 0 20px 50px rgba(0,0,0,.35); backdrop-filter: blur(10px); }
  #ob-ed * { box-sizing: border-box; font-family: inherit; letter-spacing: normal; text-transform: none; }
  #ob-ed header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid rgba(247,245,241,.1); cursor: move; }
  #ob-ed header b { font-weight: 600; color: #B39F74; }
  #ob-ed .ob-body { padding: 12px 14px; display: grid; gap: 12px; }
  #ob-ed .ob-target { padding: 8px 10px; border-radius: 8px; background: rgba(247,245,241,.06); color: #D7D0C7; font-size: 12px; word-break: break-word; }
  #ob-ed label { display: grid; gap: 4px; color: #D7D0C7; font-size: 12px; }
  #ob-ed .ob-row { display: flex; align-items: center; gap: 8px; }
  #ob-ed input[type=range] { flex: 1; accent-color: #B39F74; }
  #ob-ed .ob-val { min-width: 54px; text-align: right; color: #F7F5F1; font-variant-numeric: tabular-nums; }
  #ob-ed .ob-sw { display: grid; grid-template-columns: repeat(8, 1fr); gap: 5px; }
  #ob-ed .ob-sw button { height: 24px; border-radius: 6px; border: 1px solid rgba(247,245,241,.25); cursor: pointer; padding: 0; }
  #ob-ed .ob-sw button.on { outline: 2px solid #B39F74; outline-offset: 1px; }
  #ob-ed input[type=color] { width: 36px; height: 26px; padding: 0; border: 0; background: none; cursor: pointer; }
  #ob-ed .ob-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  #ob-ed button.ob-b { padding: 9px 10px; border-radius: 999px; border: 1px solid rgba(247,245,241,.3); background: transparent; color: #F7F5F1; cursor: pointer; font-size: 12px; }
  #ob-ed button.ob-b.gold { background: #B39F74; border-color: #B39F74; color: #1c1d1c; font-weight: 600; }
  #ob-ed .ob-sec { border-top: 1px solid rgba(247,245,241,.1); padding-top: 10px; display: grid; gap: 10px; }
  #ob-ed .ob-h { color: #B39F74; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; }
  #ob-ed .ob-note { color: #8E8B85; font-size: 11px; }
  #ob-ed .ob-toggle { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #D7D0C7; }
  #ob-ed .ob-min { background: none; border: 0; color: #D7D0C7; cursor: pointer; font-size: 16px; }
  #ob-ed.min .ob-body { display: none; }`;
  document.head.appendChild(css);

  /* ---------- helpers ---------- */
  const rgb2hex = (c) => {
    const m = String(c).match(/\d+(\.\d+)?/g); if (!m) return '#000000';
    return '#' + m.slice(0, 3).map((n) => Math.round(+n).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  const sectionOf = (el) => el.closest('section, header.site-header, footer');
  const sectionName = (sec) => {
    if (!sec) return 'page';
    if (sec.id) return '#' + sec.id;
    const c = [...sec.classList].find((x) => /^(ag-|p|hero|world|listings|cta|soon|login|feed)/.test(x)) || sec.classList[0];
    return c ? '.' + c : sec.tagName.toLowerCase();
  };
  const selectorFor = (el) => {
    const sec = sectionOf(el);
    const parts = [];
    let n = el;
    while (n && n !== sec && n !== document.body) {
      let s = n.tagName.toLowerCase();
      const cls = [...n.classList].filter((c) => !c.startsWith('ob-ed') && !/^(is-|kb$)/.test(c));
      if (cls.length) s += '.' + cls.join('.');
      else if (n.parentElement) {
        const same = [...n.parentElement.children].filter((x) => x.tagName === n.tagName);
        if (same.length > 1) s += `:nth-of-type(${same.indexOf(n) + 1})`;
      }
      parts.unshift(s);
      if (cls.length && document.querySelectorAll((sec ? sectionName(sec) + ' ' : '') + parts.join(' > ')).length === 1) break;
      n = n.parentElement;
    }
    return ((sec ? sectionName(sec) + ' ' : '') + parts.join(' > ')).trim() || sectionName(sec);
  };
  const label = (el) => {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return t ? '"' + (t.length > 60 ? t.slice(0, 60) + '…' : t) + '"' : (el.tagName === 'IMG' ? 'image' : el.tagName.toLowerCase());
  };
  const bgImgOf = (el) => {
    const sec = el.matches('section') ? el : sectionOf(el);
    if (!sec) return null;
    return sec.querySelector(':scope > [class*="__bg"] img, :scope > [class*="__media"] img, :scope [class*="__photo"] img');
  };
  const veilOf = (img) => img && img.parentElement;

  /* ---------- apply stored changes ---------- */
  const applyAll = () => {
    Object.entries(changes).forEach(([sel, props]) => {
      let els; try { els = document.querySelectorAll(sel); } catch (e) { return; }
      els.forEach((el) => {
        Object.entries(props).forEach(([k, v]) => {
          if (k === 'bgOpacity') { const im = bgImgOf(el); if (im) im.style.setProperty('opacity', v, 'important'); }
          else if (k === 'veil') { const im = bgImgOf(el); const p = veilOf(im); if (p) p.style.setProperty('--ob-veil', v); }
          else if (k === 'groupSpace') { [...el.children].forEach((c, i) => { if (i) c.style.setProperty('margin-top', v, 'important'); if (getComputedStyle(c).display === 'inline') c.style.setProperty('display', 'inline-block', 'important'); }); }
          else if (k !== '_label') el.style.setProperty(k, v, 'important');
        });
      });
    });
  };
  const clearAll = () => {
    Object.entries(changes).forEach(([sel, props]) => {
      let els; try { els = document.querySelectorAll(sel); } catch (e) { return; }
      els.forEach((el) => {
        Object.keys(props).forEach((k) => {
          if (k === 'bgOpacity') { const im = bgImgOf(el); if (im) im.style.removeProperty('opacity'); }
          else if (k === 'veil') { const im = bgImgOf(el); const p = veilOf(im); if (p) p.style.removeProperty('--ob-veil'); }
          else if (k === 'groupSpace') { [...el.children].forEach((c) => { c.style.removeProperty('margin-top'); c.style.removeProperty('display'); }); }
          else if (k !== '_label') el.style.removeProperty(k);
        });
      });
    });
  };
  /* undo history */
  const history = [];
  let lastPush = 0;
  const snapshot = () => { const now = Date.now(); if (now - lastPush > 600) { history.push(JSON.stringify(changes)); if (history.length > 100) history.shift(); } lastPush = now; };
  const undo = () => {
    if (!history.length) return;
    clearAll(); changes = JSON.parse(history.pop()); save(); applyAll();
    if (typeof count === 'function') count();
    if (typeof fill === 'function' && sel) fill();
  };
  const veilCss = document.createElement('style');
  veilCss.textContent = '[style*="--ob-veil"]::after { background: rgba(28,30,29,var(--ob-veil)) !important; }';
  document.head.appendChild(veilCss);

  /* ---------- panel ---------- */
  const panel = document.createElement('div');
  panel.id = 'ob-ed';
  panel.innerHTML = `
    <header><b>Obelum design panel</b><button class="ob-min" title="Minimise" data-min>–</button></header>
    <div class="ob-body">
      <label class="ob-toggle"><input type="checkbox" data-pick checked> Select mode (click anything on the page)</label>
      <div class="ob-target" data-target>Nothing selected yet. Click a text, button or section.</div>
      <div data-ctrls hidden>
        <div class="ob-sec"><span class="ob-h">Text colour</span>
          <div class="ob-sw" data-sw></div>
          <div class="ob-row"><input type="color" data-color><span class="ob-val" data-color-v></span><button class="ob-b" data-copyhex style="padding:5px 10px">Copy #</button></div>
        </div>
        <div class="ob-sec"><span class="ob-h">Text</span>
          <label>Size<div class="ob-row"><input type="range" min="8" max="120" step="1" data-k="font-size" data-u="px"><span class="ob-val"></span></div></label>
          <label>Letter spacing<div class="ob-row"><input type="range" min="-0.05" max="0.4" step="0.005" data-k="letter-spacing" data-u="em"><span class="ob-val"></span></div></label>
          <label>Line spacing<div class="ob-row"><input type="range" min="0.8" max="2.4" step="0.02" data-k="line-height" data-u=""><span class="ob-val"></span></div></label>
          <label>Boldness<div class="ob-row"><input type="range" min="100" max="900" step="100" data-k="font-weight" data-u=""><span class="ob-val"></span></div></label>
          <label>Shadow<div class="ob-row"><input type="range" min="0" max="30" step="1" data-shadow><span class="ob-val"></span></div></label>
          <label>Opacity<div class="ob-row"><input type="range" min="0" max="1" step="0.05" data-k="opacity" data-u=""><span class="ob-val"></span></div></label>
          <label>Space between lines/items in this group<div class="ob-row"><input type="range" min="0" max="80" step="1" data-group><span class="ob-val"></span></div></label>
          <div><span style="color:#D7D0C7;font-size:12px">Alignment</span><div class="ob-btns" style="grid-template-columns:repeat(4,1fr);margin-top:4px">
            <button class="ob-b" data-align="left">Left</button><button class="ob-b" data-align="center">Center</button><button class="ob-b" data-align="right">Right</button><button class="ob-b" data-align="justify">Justify</button></div></div>
        </div>
        <div class="ob-sec"><span class="ob-h">Box / button</span>
          <label>Background transparency<div class="ob-row"><input type="range" min="0" max="1" step="0.05" data-bga><span class="ob-val"></span></div></label>
          <label>Box colour<div class="ob-row"><input type="color" data-boxc><span class="ob-val" data-boxc-v></span></div></label>
        </div>
        <div class="ob-sec" data-secctrls><span class="ob-h">Section</span>
          <label>Height (top + bottom padding)<div class="ob-row"><input type="range" min="0" max="200" step="2" data-sk="padding-block" data-u="px"><span class="ob-val"></span></div></label>
          <label data-bgrow>Background photo opacity<div class="ob-row"><input type="range" min="0" max="1" step="0.05" data-bg="bgOpacity"><span class="ob-val"></span></div></label>
          <label data-veilrow>Dark veil over photo<div class="ob-row"><input type="range" min="0" max="0.9" step="0.02" data-bg="veil"><span class="ob-val"></span></div></label>
          <label data-bgcrow>Section background colour<div class="ob-row"><input type="color" data-sbg><span class="ob-val" data-sbg-v></span></div></label>
        </div>
        <div class="ob-btns" style="margin-top:4px"><button class="ob-b" data-undo>Reset this item</button><button class="ob-b" data-parent>Select parent</button></div>
      </div>
      <div class="ob-sec">
        <div class="ob-btns"><button class="ob-b" data-undo-btn>Undo (Cmd/Ctrl+Z)</button><button class="ob-b" data-clear>Reset all</button></div>
        <button class="ob-b gold" data-copy>Copy my changes</button>
        <span class="ob-note" data-count></span>
        <span class="ob-note">Changes only show in your browser. Paste the copied text to Claude to make them real.</span>
      </div>
    </div>`;
  document.body.appendChild(panel);
  const q = (s) => panel.querySelector(s);
  const qa = (s) => [...panel.querySelectorAll(s)];

  const sw = q('[data-sw]');
  PALETTE.forEach(([n, h]) => {
    const b = document.createElement('button'); b.title = n + ' ' + h; b.style.background = h; b.dataset.hex = h; sw.appendChild(b);
  });

  let sel = null; let picking = true;
  const count = () => { q('[data-count]').textContent = Object.keys(changes).length + ' item(s) changed on this page.'; };

  const setProp = (k, v) => {
    if (!sel) return;
    snapshot();
    const s = selectorFor(sel);
    changes[s] = changes[s] || {}; changes[s][k] = v; changes[s]._label = label(sel);
    save(); applyAll(); count();
  };
  const setSecProp = (k, v) => {
    if (!sel) return;
    const sec = sel.matches('section') ? sel : sectionOf(sel); if (!sec) return;
    snapshot();
    const s = sectionName(sec);
    changes[s] = changes[s] || {}; changes[s][k] = v; changes[s]._label = 'section ' + s;
    save(); applyAll(); count();
  };

  const fill = () => {
    if (!sel) return;
    const cs = getComputedStyle(sel);
    q('[data-target]').textContent = label(sel) + '  ·  ' + selectorFor(sel);
    q('[data-ctrls]').hidden = false;
    const hex = rgb2hex(cs.color);
    q('[data-color]').value = hex; q('[data-color-v]').textContent = hex;
    qa('[data-sw] button').forEach((b) => b.classList.toggle('on', b.dataset.hex === hex));
    const fs = parseFloat(cs.fontSize);
    const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) / fs;
    const lh = cs.lineHeight === 'normal' ? 1.2 : parseFloat(cs.lineHeight) / fs;
    const vals = { 'font-size': fs, 'letter-spacing': +ls.toFixed(3), 'line-height': +lh.toFixed(2), opacity: +cs.opacity, 'font-weight': parseInt(cs.fontWeight, 10) || 400 };
    const sh = q('[data-shadow]'); const m = cs.textShadow.match(/(\d+(?:\.\d+)?)px(?=[^,]*$)/); sh.value = cs.textShadow === 'none' ? 0 : (m ? Math.round(+m[1]) : 0); sh.nextElementSibling.textContent = sh.value + 'px';
    const kids = [...sel.children]; const g = q('[data-group]'); g.value = kids[1] ? Math.round(parseFloat(getComputedStyle(kids[1]).marginTop) || 0) : 0; g.nextElementSibling.textContent = g.value + 'px';
    g.closest('label').style.opacity = kids.length > 1 ? 1 : .4;
    const bgm = String(cs.backgroundColor).match(/[\d.]+/g) || [0, 0, 0, 0];
    const a = q('[data-bga]'); a.value = bgm.length > 3 ? bgm[3] : 1; a.nextElementSibling.textContent = Math.round((1 - a.value) * 100) + '% clear';
    q('[data-boxc]').value = rgb2hex(cs.backgroundColor); q('[data-boxc-v]').textContent = rgb2hex(cs.backgroundColor);
    qa('[data-align]').forEach((b) => b.classList.toggle('gold', cs.textAlign === b.dataset.align || (b.dataset.align === 'left' && cs.textAlign === 'start')));
    qa('[data-k]').forEach((r) => { r.value = vals[r.dataset.k]; r.nextElementSibling.textContent = r.value + r.dataset.u; });
    const sec = sel.matches('section') ? sel : sectionOf(sel);
    q('[data-secctrls]').hidden = !sec;
    if (sec) {
      const scs = getComputedStyle(sec);
      const pb = (parseFloat(scs.paddingTop) + parseFloat(scs.paddingBottom)) / 2;
      const r = q('[data-sk]'); r.value = Math.round(pb); r.nextElementSibling.textContent = r.value + 'px';
      const im = bgImgOf(sec);
      q('[data-bgrow]').hidden = q('[data-veilrow]').hidden = !im;
      if (im) {
        const o = q('[data-bg="bgOpacity"]'); o.value = getComputedStyle(im).opacity; o.nextElementSibling.textContent = o.value;
        const v = q('[data-bg="veil"]'); const cur = (changes[sectionName(sec)] || {}).veil; v.value = cur != null ? cur : 0.35; v.nextElementSibling.textContent = v.value;
      }
      const bg = rgb2hex(scs.backgroundColor); q('[data-sbg]').value = bg; q('[data-sbg-v]').textContent = bg;
    }
  };

  /* selection on the page */
  let hover = null;
  const inPanel = (t) => panel.contains(t);
  document.addEventListener('mouseover', (e) => {
    if (!picking || inPanel(e.target)) return;
    if (hover) hover.classList.remove('ob-ed-hover');
    hover = e.target; hover.classList.add('ob-ed-hover');
  }, true);
  document.addEventListener('click', (e) => {
    if (!picking || inPanel(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    if (sel) sel.classList.remove('ob-ed-sel');
    sel = e.target; sel.classList.remove('ob-ed-hover'); sel.classList.add('ob-ed-sel');
    fill();
  }, true);

  /* controls */
  qa('[data-k]').forEach((r) => r.addEventListener('input', () => {
    r.nextElementSibling.textContent = r.value + r.dataset.u; setProp(r.dataset.k, r.value + r.dataset.u);
  }));
  q('[data-sk]').addEventListener('input', (e) => { const r = e.target; r.nextElementSibling.textContent = r.value + 'px'; setSecProp('padding-block', r.value + 'px'); });
  qa('[data-bg]').forEach((r) => r.addEventListener('input', () => { r.nextElementSibling.textContent = r.value; setSecProp(r.dataset.bg, r.value); }));
  q('[data-sbg]').addEventListener('input', (e) => { q('[data-sbg-v]').textContent = e.target.value.toUpperCase(); setSecProp('background', e.target.value.toUpperCase()); });
  q('[data-color]').addEventListener('input', (e) => { const h = e.target.value.toUpperCase(); q('[data-color-v]').textContent = h; setProp('color', h); qa('[data-sw] button').forEach((b) => b.classList.toggle('on', b.dataset.hex === h)); });
  sw.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; q('[data-color]').value = b.dataset.hex; q('[data-color]').dispatchEvent(new Event('input')); });
  q('[data-shadow]').addEventListener('input', (e) => { const v = +e.target.value; e.target.nextElementSibling.textContent = v + 'px'; setProp('text-shadow', v ? `0 2px ${v}px rgba(0,0,0,.55)` : 'none'); });
  q('[data-group]').addEventListener('input', (e) => { e.target.nextElementSibling.textContent = e.target.value + 'px'; setProp('groupSpace', e.target.value + 'px'); });
  qa('[data-align]').forEach((b) => b.addEventListener('click', () => {
    setProp('text-align', b.dataset.align);
    if (b.dataset.align === 'justify') setProp('text-align-last', 'justify'); else setProp('text-align-last', 'auto');
    fill();
  }));
  const setBox = () => {
    const hex = q('[data-boxc]').value; const a = +q('[data-bga]').value;
    const r = parseInt(hex.slice(1, 3), 16), g2 = parseInt(hex.slice(3, 5), 16), b2 = parseInt(hex.slice(5, 7), 16);
    setProp('background-color', `rgba(${r},${g2},${b2},${a})`);
  };
  q('[data-bga]').addEventListener('input', (e) => { e.target.nextElementSibling.textContent = Math.round((1 - e.target.value) * 100) + '% clear'; setBox(); });
  q('[data-boxc]').addEventListener('input', (e) => { q('[data-boxc-v]').textContent = e.target.value.toUpperCase(); setBox(); });
  const copyText = async (txt, btn, done) => {
    try { await navigator.clipboard.writeText(txt); } catch (e) { window.prompt('Copy:', txt); }
    const old = btn.textContent; btn.textContent = done; setTimeout(() => { btn.textContent = old; }, 1400);
  };
  q('[data-copyhex]').addEventListener('click', (e) => copyText(q('[data-color]').value.toUpperCase(), e.target, 'Copied'));
  q('[data-color-v]').style.cursor = 'pointer';
  q('[data-color-v]').addEventListener('click', (e) => copyText(e.target.textContent, q('[data-copyhex]'), 'Copied'));
  q('[data-undo-btn]').addEventListener('click', undo);
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      const t = e.target; if (t && /input|textarea/i.test(t.tagName) && t.type !== 'range' && t.type !== 'color' && !panel.contains(t)) return;
      e.preventDefault(); undo();
    }
  });
  q('[data-pick]').addEventListener('change', (e) => { picking = e.target.checked; if (hover) hover.classList.remove('ob-ed-hover'); });
  q('[data-parent]').addEventListener('click', () => { if (!sel || !sel.parentElement || sel.parentElement === document.body) return; sel.classList.remove('ob-ed-sel'); sel = sel.parentElement; sel.classList.add('ob-ed-sel'); fill(); });
  q('[data-undo]').addEventListener('click', () => {
    if (!sel) return; snapshot(); clearAll(); delete changes[selectorFor(sel)]; save(); applyAll(); count(); fill();
  });
  q('[data-clear]').addEventListener('click', () => { snapshot(); lastPush = 0; clearAll(); changes = {}; save(); count(); if (sel) fill(); });
  q('[data-min]').addEventListener('click', () => panel.classList.toggle('min'));
  q('[data-copy]').addEventListener('click', async () => {
    const names = { 'font-size': 'text size', 'letter-spacing': 'letter spacing', 'line-height': 'line spacing', color: 'colour', opacity: 'opacity', 'padding-block': 'section padding (top and bottom)', bgOpacity: 'background photo opacity', veil: 'dark veil', background: 'section background', 'font-weight': 'boldness', 'text-shadow': 'text shadow', 'text-align': 'alignment', 'text-align-last': 'last-line alignment', groupSpace: 'space between lines/items', 'background-color': 'box colour/transparency' };
    const lines = ['Design panel changes for ' + location.pathname.replace(/^.*\//, '') + ':'];
    Object.entries(changes).forEach(([s, p]) => {
      const bits = Object.entries(p).filter(([k]) => k !== '_label').map(([k, v]) => (names[k] || k) + ' ' + v);
      if (bits.length) lines.push('- ' + (p._label || s) + ' [' + s + ']: ' + bits.join(', '));
    });
    const txt = lines.join('\n');
    try { await navigator.clipboard.writeText(txt); q('[data-copy]').textContent = 'Copied'; }
    catch (e) { window.prompt('Copy this and paste it to Claude:', txt); }
    setTimeout(() => { q('[data-copy]').textContent = 'Copy my changes'; }, 1600);
  });

  /* drag the panel by its header */
  (() => {
    const h = q('header'); let sx, sy, ox, oy, on = false;
    h.addEventListener('mousedown', (e) => { if (e.target.closest('button')) return; on = true; sx = e.clientX; sy = e.clientY; const r = panel.getBoundingClientRect(); ox = r.left; oy = r.top; e.preventDefault(); });
    document.addEventListener('mousemove', (e) => { if (!on) return; panel.style.left = (ox + e.clientX - sx) + 'px'; panel.style.top = (oy + e.clientY - sy) + 'px'; panel.style.right = 'auto'; });
    document.addEventListener('mouseup', () => { on = false; });
  })();

  applyAll(); count();
})();
