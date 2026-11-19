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

  /* --- Enquiry form ---------------------------------------------------- */
  // Posts to the same handler as the home page brief (api/send.php on
  // obelum.ae), which emails obelumgroup@gmail.com. Sent as a "brief" so the
  // handler needs no change: the property type and page go in "Looking to",
  // the page name in "community".
  const INBOX = 'obelumgroup@gmail.com';
  const ENDPOINT = /(^|\.)obelum\.ae$|^localhost$/.test(location.hostname)
    ? '/api/send' : 'https://obelum.ae/api/send';
  const PAGE = 'Central (landing page)';

  const form = $('[data-lp-form]');
  if (!form) return;
  const note = $('[data-lp-note]', form);
  const submit = $('[data-lp-submit]', form);

  const cc = $('[data-cc]', form);
  const ccLabel = $('[data-cc-label]', form);
  if (cc && ccLabel) cc.addEventListener('change', () => { ccLabel.textContent = cc.value; });

  const phoneInput = form.elements.phone;
  phoneInput.addEventListener('input', () => {
    const clean = phoneInput.value.replace(/[^\d\s()+.\-]/g, '');
    if (clean !== phoneInput.value) phoneInput.value = clean;
  });

  const rules = {
    first: (v) => v.trim().length >= 1,
    last:  (v) => v.trim().length >= 1,
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
    phone: (v) => v.replace(/\D/g, '').length >= 6,
  };
  const mark = (input, ok) => {
    const box = input.closest('.field');
    if (box) box.classList.toggle('is-invalid', !ok);
    input.setAttribute('aria-invalid', ok ? 'false' : 'true');
  };
  Object.keys(rules).forEach((name) => {
    const input = form.elements[name];
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') mark(input, rules[name](input.value));
    });
  });
  const consent = form.elements.consent;
  consent.addEventListener('change', () => consent.closest('.lp-consent').classList.toggle('is-invalid', !consent.checked));

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
    consent.closest('.lp-consent').classList.toggle('is-invalid', !agreed);
    if (firstBad || !agreed) {
      (firstBad || consent).focus();
      note.textContent = firstBad ? 'Please complete the highlighted fields.' : 'Please accept the Privacy Policy and Terms & Conditions.';
      return;
    }

    const type = form.elements.property.value || 'Not specified';
    const subject = 'Landing page enquiry — ' + PAGE;
    const payload = {
      _form: 'brief',
      _subject: subject,
      _honey: form.elements._honey.value,
      'Looking to': 'Buy — ' + type + ' (' + PAGE + ')',
      name: (form.elements.first.value.trim() + ' ' + form.elements.last.value.trim()).trim(),
      email: form.elements.email.value.trim(),
      phone: cc.value + ' ' + phoneInput.value.trim() + ' (WhatsApp)',
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
      ccLabel.textContent = cc.value;
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
})();
