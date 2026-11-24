/* Runs in <head> before the page paints: a ?view=map link starts with the catalogue hidden and a
   loading screen, so it never flashes the catalogue or an unstyled map (assets/js/buy-view.js). */
if (/[?&]view=map\b/.test(location.search)) document.documentElement.classList.add('bt-early-map');
