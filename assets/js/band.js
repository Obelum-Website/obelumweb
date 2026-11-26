/* Pinned band (desktop, Buy and Home): a slim dark band under the photo header that sticks under the
 * site menu as you scroll: [AI search, once pinned] [Map | Catalogue] [Saved | Share] [AED | sq ft].
 * Moved out of buy-view.js (26 Nov 2026) so Home has it too. On Buy the Map switch opens the map
 * on the page (buy-view.js); on Home it goes to the Buy map. Styles: assets/css/band.css.
 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const S = () => window.ObelumSearch || {};
  const ON_BUY = !!$('[data-view-switch]');
  const HERO = $('section.soon') || $('section.hero--home');
  const BUY = ON_BUY ? location.pathname : 'buy';
  const SHARE_TITLE = ON_BUY ? 'Buy property in Dubai — Obelum' : document.title;
  const ICONS = {
    'ic-map': '<svg class="ic ic-map" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17.6s-5.4-5.4-5.4-9.4a5.4 5.4 0 0 1 10.8 0c0 4-5.4 9.4-5.4 9.4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="10" cy="8.2" r="1.9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    'ic-cat': '<svg class="ic ic-cat" viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="5.6" height="5.6" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="11.4" y="3" width="5.6" height="5.6" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="3" y="11.4" width="5.6" height="5.6" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="11.4" y="11.4" width="5.6" height="5.6" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  };
  /* Desktop catalogue: a slim dark band under the photo header (sticks under the site menu) with the map's top controls, in this order:
     [Map | switch | Catalogue]  [Saved | Share]  [AED | sq ft]. Same colour as the project rows. */
  const CURRENCIES = [['AED', 'UAE dirham'], ['USD', 'US dollar'], ['EUR', 'Euro'], ['GBP', 'British pound'], ['RUB', 'Russian rouble'], ['CNY', 'Chinese yuan'], ['INR', 'Indian rupee'], ['SAR', 'Saudi riyal']];
  function addTopBar() {
    const hd = $('.site-header'), sec = $('#property-search'); if (!HERO || $('.btbar')) return;
    if (ON_BUY && !sec) return;
    const ic = (cls) => ICONS[cls] || '';
    const bar = document.createElement('div'); bar.className = 'btbar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Catalogue view');
    bar.innerHTML = `<div class="btbar__in">
      <form class="btbar__ai" role="search" aria-label="AI search" novalidate>
        <svg class="btbar__spark" viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6z M15.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill="currentColor"/></svg>
        <input type="search" name="q" autocomplete="off" placeholder="Ask Obie: 2-bed in Business Bay under 3M" aria-label="Describe what you are looking for" tabindex="-1">
        <button type="button" class="psearch__mic" aria-label="Speak your search" aria-pressed="false" tabindex="-1" hidden>${S().MIC_SVG || ''}</button>
        <button type="submit" class="psearch__go" aria-label="AI search" tabindex="-1">${S().AI_GLASS_SVG || 'AI'}</button>
      </form>
      <button type="button" class="btbox" aria-label="Show the projects on the map"><span class="btbox__lbl btbox__lbl--map">Map</span><span class="btbox__track" aria-hidden="true">${ic('ic-map')}${ic('ic-cat')}<span class="btbox__knob">${ic('ic-map')}${ic('ic-cat')}</span></span><span class="btbox__lbl btbox__lbl--cat">Catalogue</span></button>
      <div class="btbar__group">
        <button type="button" class="btbar__btn" data-bt-saved title="Projects you saved with ♡"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 16.5s-6.2-3.7-6.2-8.2A3.4 3.4 0 0 1 10 6.4a3.4 3.4 0 0 1 6.2 1.9c0 4.5-6.2 8.2-6.2 8.2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span>Saved</span><em></em></button>
        <button type="button" class="btbar__btn" data-share data-share-title="${SHARE_TITLE}"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 13V3M6 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 10v6.5h12V10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Share</span></button>
      </div>
      <div class="btbar__group btbar__group--pref">
        <button type="button" class="btbar__btn" data-bt-cur aria-haspopup="listbox" aria-expanded="false" aria-label="Currency"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><rect x="2.5" y="5" width="15" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 5V4h9" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="13.5" cy="10.5" r="1.2" fill="currentColor"/></svg><span data-bt-cur-label>AED</span></button>
        <button type="button" class="btbar__btn" data-bt-unit aria-label="Switch between square feet and square metres"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M3 17L17 3M3 17v-4M3 17h4M17 3h-4M17 3v4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><b data-bt-unit-label>sq ft</b></button>
        <ul class="btbar__menu" role="listbox" aria-label="Currency" hidden></ul>
      </div>
    </div>`;
    // Under the photo header, above the first row; once scrolled to, it stays under the site menu
    // while you browse the rows.
    // Home: right under the hero photo (its results section starts hidden, so not inside it).
    if (ON_BUY) sec.insertBefore(bar, sec.firstChild);
    else { let top = HERO; while (top.parentElement && top.parentElement.tagName !== 'MAIN' && top.parentElement !== document.body) top = top.parentElement; top.after(bar); } // straight in <main>, so it can stick the whole way down
    // The photo header grows by the band's height and the band (solid) sits along its bottom edge.
    const soon = HERO;
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
      const hero = HERO.querySelector('form.psearch__form');
      if (!hero) { location.href = 'search?q=' + encodeURIComponent(text); return; }
      hero.elements.q.value = text;
      window.__obBandSearch = true;
      const go = hero.querySelector('.psearch__go');
      if (hero.requestSubmit) hero.requestSubmit(go || undefined); else go.click();
      ai.elements.q.blur();
    });
    if (S().voice) S().voice(ai);
    const place = () => { if (hd) bar.style.top = hd.offsetHeight + 'px'; pinned(); };
    place(); addEventListener('resize', place); addEventListener('scroll', pinned, { passive: true });
    if (hd && window.ResizeObserver) new ResizeObserver(place).observe(hd);

    const box = $('.btbox', bar);
    box.addEventListener('click', () => { box.classList.add('is-going'); setTimeout(() => { if (window.ObelumBuyView) window.ObelumBuyView.showMap(); else location.href = 'buy?view=map'; box.classList.remove('is-going'); }, 320); });
    const menu = $('.btbar__menu', bar), curB = $('[data-bt-cur]', bar);
    const render = () => {
      const s = S(); const n = s.saved ? s.saved.size : 0;
      $('[data-bt-saved] em', bar).textContent = n ? n : '';
      $('[data-bt-cur-label]', bar).textContent = s.curNow ? s.curNow() : 'AED';
      $('[data-bt-unit-label]', bar).innerHTML = s.prefs && s.prefs.unit === 'm2' ? 'm<sup>2</sup>' : 'sq ft';
      // Share: with saved projects, a link that opens just those on the map; otherwise this page.
      const sh = $('[data-share]', bar), lbl = $('span', sh);
      if (n) { const u = new URL(BUY, location.href); u.searchParams.set('view', 'map'); u.searchParams.set('ids', [...s.saved].join('.')); sh.dataset.shareUrl = u.href; sh.dataset.shareTitle = `My property shortlist (${n} ${n === 1 ? 'project' : 'projects'})`; lbl.textContent = `Share saved (${n})`; }
      else { delete sh.dataset.shareUrl; sh.dataset.shareTitle = SHARE_TITLE; lbl.textContent = 'Share'; }
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
        if (e.target.closest('[data-saved-map]')) { location.href = BUY + '?view=map&saved=1'; return; }
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
      if (n) { const u = new URL(BUY, location.href); u.searchParams.set('view', 'map'); u.searchParams.set('ids', ids.join('.')); sh.dataset.shareUrl = u.href; sh.dataset.shareTitle = `My property shortlist (${n} ${n === 1 ? 'project' : 'projects'})`; sh.hidden = false; }
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
})();
