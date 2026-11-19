/* Obelum — landing pages: header, galleries and the enquiry form. */
(() => {
  'use strict';
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* --- Header condenses once past the hero, as on the home page --------- */
  const header = $('[data-header]');
  if (header) {
    const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > Math.max(window.innerHeight * 0.6, 260));
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* --- Galleries ------------------------------------------------------- */
  $$('[data-slider]').forEach((slider) => {
    const slides = $$('.lp-slider__stage img', slider);
    const thumbs = $$('[data-thumbs] button', slider);
    let i = 0;
    const go = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
      thumbs.forEach((t, k) => t.setAttribute('aria-current', k === i ? 'true' : 'false'));
      const next = slides[(i + 1) % slides.length];
      if (next) next.loading = 'eager';
    };
    $('[data-prev]', slider).addEventListener('click', () => go(i - 1));
    $('[data-next]', slider).addEventListener('click', () => go(i + 1));
    thumbs.forEach((t, k) => t.addEventListener('click', () => go(k)));
    // Swipe on touch screens.
    let x0 = null;
    const stage = $('.lp-slider__stage', slider);
    stage.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  });

  /* --- Year in the footer --------------------------------------------- */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* --- Image viewer: click any photo or map to enlarge ----------------- */
  // Arrows, swipe and the keyboard move through the other photos of the same
  // section, looping round at either end.
  const box = $('[data-lightbox]');
  if (box && typeof box.showModal === 'function') {
    const big = $('[data-lightbox-img]', box);
    const prevBtn = $('[data-lightbox-prev]', box);
    const nextBtn = $('[data-lightbox-next]', box);
    let group = [];
    let at = 0;
    const show = (n) => {
      at = (n + group.length) % group.length;
      const img = group[at];
      big.src = img.currentSrc || img.src;
      big.alt = img.alt || '';
      big.classList.toggle('lp-tone', img.classList.contains('lp-tone'));
      // Warm up the neighbours so the next swipe is instant.
      [at + 1, at - 1].forEach((k) => {
        const nb = group[(k + group.length) % group.length];
        if (nb) { const pre = new Image(); pre.src = nb.currentSrc || nb.src; }
      });
    };
    const open = (list, index) => {
      group = list;
      const many = list.length > 1;
      prevBtn.hidden = !many;
      nextBtn.hidden = !many;
      show(index);
      box.showModal();
      document.body.classList.add('lp-noscroll');
    };
    const step = (d) => { if (group.length > 1) show(at + d); };

    box.addEventListener('close', () => { document.body.classList.remove('lp-noscroll'); big.src = ''; });
    $('[data-lightbox-close]', box).addEventListener('click', () => box.close());
    prevBtn.addEventListener('click', () => step(-1));
    nextBtn.addEventListener('click', () => step(1));
    // A click on the dark area around the photo closes it too.
    box.addEventListener('click', (e) => { if (e.target === box) box.close(); });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); step(-1); }
    });
    let sx = null, sy = null;
    box.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    box.addEventListener('touchend', (e) => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
      sx = sy = null;
    });

    // Gallery stage: opens whichever slide is showing, with the gallery's photos.
    $$('.lp-slider__stage').forEach((stage) => {
      stage.classList.add('is-zoomable');
      const slides = $$('img', stage);
      stage.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const i = slides.findIndex((img) => img.classList.contains('is-active'));
        open(slides, Math.max(i, 0));
      });
    });
    // Home photos (per card) and the maps (each on its own).
    const groups = [...$$('.lp-pics').map((g) => $$('img', g)), ...$$('.lp-map img').map((img) => [img])];
    groups.forEach((list) => list.forEach((img, i) => {
      img.classList.add('is-zoomable');
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.addEventListener('click', () => open(list, i));
      img.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(list, i); } });
    }));
  }

  /* --- Visa cards preselect the amount in the bottom form ---------------- */
  $$('.lp-visa[data-amount]').forEach((card) => {
    card.addEventListener('click', () => {
      const sel = $('[data-amount-select]');
      if (sel) sel.value = card.dataset.amount;
    });
  });

  /* --- Enquiry forms --------------------------------------------------- */
  // Each posts to the same handler as the home page brief (api/send.php on
  // obelum.ae), which emails obelumgroup@gmail.com. Sent as a "brief" so the
  // handler needs no change: the choice and page go in "Looking to", the page
  // name in "community".
  const INBOX = 'obelumgroup@gmail.com';
  const ENDPOINT = /(^|\.)obelum\.ae$|^localhost$/.test(location.hostname)
    ? '/api/send' : 'https://obelum.ae/api/send';
  const PAGE = 'Central (landing page)';

  const rules = {
    first: (v) => v.trim().length >= 1,
    last:  (v) => v.trim().length >= 1,
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
    phone: (v) => v.replace(/\D/g, '').length >= 6,
  };
  const mark = (input, ok) => {
    const field = input.closest('.field');
    if (field) field.classList.toggle('is-invalid', !ok);
    input.setAttribute('aria-invalid', ok ? 'false' : 'true');
  };

  /* --- Phone country codes: 100 countries, with flags -------------------- */
  // Gulf and the most common markets in Dubai first, then A–Z.
  const TOP_CODES = [
    ['AE','United Arab Emirates','971'],
    ['SA','Saudi Arabia','966'],
    ['QA','Qatar','974'],
    ['KW','Kuwait','965'],
    ['BH','Bahrain','973'],
    ['OM','Oman','968'],
    ['IN','India','91'],
    ['PK','Pakistan','92'],
    ['GB','United Kingdom','44'],
    ['RU','Russia','7'],
    ['CN','China','86'],
    ['EG','Egypt','20'],
    ['PH','Philippines','63'],
    ['LB','Lebanon','961'],
    ['JO','Jordan','962'],
    ['US','United States','1'],
    ['FR','France','33'],
    ['DE','Germany','49'],
    ['IT','Italy','39'],
    ['TR','Turkey','90'],
  ];
  const MORE_CODES = [
    ['AF','Afghanistan','93'],
    ['DZ','Algeria','213'],
    ['AR','Argentina','54'],
    ['AM','Armenia','374'],
    ['AU','Australia','61'],
    ['AT','Austria','43'],
    ['AZ','Azerbaijan','994'],
    ['BD','Bangladesh','880'],
    ['BY','Belarus','375'],
    ['BE','Belgium','32'],
    ['BR','Brazil','55'],
    ['BG','Bulgaria','359'],
    ['CA','Canada','1'],
    ['CL','Chile','56'],
    ['CO','Colombia','57'],
    ['HR','Croatia','385'],
    ['CY','Cyprus','357'],
    ['CZ','Czechia','420'],
    ['DK','Denmark','45'],
    ['EE','Estonia','372'],
    ['ET','Ethiopia','251'],
    ['FI','Finland','358'],
    ['GE','Georgia','995'],
    ['GH','Ghana','233'],
    ['GR','Greece','30'],
    ['HK','Hong Kong','852'],
    ['HU','Hungary','36'],
    ['ID','Indonesia','62'],
    ['IR','Iran','98'],
    ['IQ','Iraq','964'],
    ['IE','Ireland','353'],
    ['IL','Israel','972'],
    ['JP','Japan','81'],
    ['KZ','Kazakhstan','7'],
    ['KE','Kenya','254'],
    ['KG','Kyrgyzstan','996'],
    ['LV','Latvia','371'],
    ['LT','Lithuania','370'],
    ['LU','Luxembourg','352'],
    ['LY','Libya','218'],
    ['MY','Malaysia','60'],
    ['MV','Maldives','960'],
    ['MT','Malta','356'],
    ['MU','Mauritius','230'],
    ['MX','Mexico','52'],
    ['MC','Monaco','377'],
    ['MA','Morocco','212'],
    ['NP','Nepal','977'],
    ['NL','Netherlands','31'],
    ['NZ','New Zealand','64'],
    ['NG','Nigeria','234'],
    ['NO','Norway','47'],
    ['PS','Palestine','970'],
    ['PE','Peru','51'],
    ['PL','Poland','48'],
    ['PT','Portugal','351'],
    ['RO','Romania','40'],
    ['RS','Serbia','381'],
    ['SG','Singapore','65'],
    ['SK','Slovakia','421'],
    ['SI','Slovenia','386'],
    ['ZA','South Africa','27'],
    ['KR','South Korea','82'],
    ['ES','Spain','34'],
    ['LK','Sri Lanka','94'],
    ['SD','Sudan','249'],
    ['SE','Sweden','46'],
    ['CH','Switzerland','41'],
    ['SY','Syria','963'],
    ['TW','Taiwan','886'],
    ['TJ','Tajikistan','992'],
    ['TZ','Tanzania','255'],
    ['TH','Thailand','66'],
    ['TN','Tunisia','216'],
    ['TM','Turkmenistan','993'],
    ['UG','Uganda','256'],
    ['UA','Ukraine','380'],
    ['UZ','Uzbekistan','998'],
    ['VE','Venezuela','58'],
    ['VN','Vietnam','84'],
  ];
  const flag = (iso) => String.fromCodePoint(...[...iso].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65));
  $$('[data-cc]').forEach((sel) => {
    sel.innerHTML = '';
    const add = ([iso, name, code]) => {
      const o = new Option(flag(iso) + '  +' + code + '  ' + name, iso);
      o.dataset.code = '+' + code;
      o.dataset.flag = flag(iso);
      sel.add(o);
    };
    TOP_CODES.forEach(add);
    const d = new Option('──────────', ''); d.disabled = true; sel.add(d);
    MORE_CODES.forEach(add);
    sel.value = 'AE';
  });
  const ccText = (sel) => {
    const o = sel.options[sel.selectedIndex];
    return o ? o.dataset.flag + ' ' + o.dataset.code : '';
  };

  $$('[data-lp-form]').forEach((form) => {
    const note = $('[data-lp-note]', form);
    const submit = $('[data-lp-submit]', form);
    const cc = $('[data-cc]', form);
    const ccLabel = $('[data-cc-label]', form);
    if (cc && ccLabel) {
      const sync = () => { ccLabel.textContent = ccText(cc); };
      cc.addEventListener('change', sync);
      sync();
    }

    const phoneInput = form.elements.phone;
    phoneInput.addEventListener('input', () => {
      const clean = phoneInput.value.replace(/[^\d\s()+.\-]/g, '');
      if (clean !== phoneInput.value) phoneInput.value = clean;
    });
    Object.keys(rules).forEach((name) => {
      const input = form.elements[name];
      input.addEventListener('input', () => {
        if (input.getAttribute('aria-invalid') === 'true') mark(input, rules[name](input.value));
      });
    });
    const consent = form.elements.consent;
    const consentBox = consent.closest('.lp-consent');
    consent.addEventListener('change', () => consentBox.classList.toggle('is-invalid', !consent.checked));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let firstBad = null;
      Object.keys(rules).forEach((name) => {
        const input = form.elements[name];
        const ok = rules[name](input.value);
        mark(input, ok);
        if (!ok && !firstBad) firstBad = input;
      });
      const agreed = consent.checked;
      consentBox.classList.toggle('is-invalid', !agreed);
      if (firstBad || !agreed) {
        (firstBad || consent).focus();
        note.textContent = firstBad ? 'Please complete the highlighted fields.' : 'Please accept the Privacy Policy and Terms & Conditions.';
        return;
      }

      const choice = form.elements.amount
        ? 'Invest — ' + (form.elements.amount.value || 'amount not specified')
        : 'Buy — ' + (form.elements.property.value || 'property not specified');
      const subject = 'Landing page enquiry — ' + PAGE;
      const payload = {
        _form: 'brief',
        _subject: subject,
        _honey: form.elements._honey.value,
        'Looking to': choice + ' (' + PAGE + ')',
        name: (form.elements.first.value.trim() + ' ' + form.elements.last.value.trim()).trim(),
        email: form.elements.email.value.trim(),
        phone: cc.options[cc.selectedIndex].dataset.code + ' ' + phoneInput.value.trim() + ' (WhatsApp)',
        community: PAGE,
      };

      const label = submit.textContent;
      submit.disabled = true;
      submit.textContent = 'Sending…';
      note.textContent = '';
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || String(data.success) !== 'true') throw new Error('status ' + res.status);
        form.reset();
        cc.value = 'AE';
        ccLabel.textContent = ccText(cc);
        note.textContent = 'Thank you. An advisor will contact you today.';
      } catch (err) {
        if (window.console) console.warn('Form send failed:', err);
        note.innerHTML = 'Sorry, that did not send. Please try again, or email <a href="mailto:' + INBOX +
          '?subject=' + encodeURIComponent(subject) + '">' + INBOX + '</a> directly.';
      } finally {
        submit.disabled = false;
        submit.textContent = label;
      }
    });
  });
})();
