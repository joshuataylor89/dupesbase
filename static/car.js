(function () {
  document.querySelectorAll('[data-car]').forEach(function (c) {
    var slides = c.querySelectorAll('.car-s'), dots = c.querySelectorAll('.car-d'), i = 0, timer = null, held = false;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function show(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('on', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('on', k === i); d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    }
    function start() { stop(); if (!reduce && !held && !document.hidden) timer = setInterval(function () { show(i + 1); }, 3500); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    c.querySelector('.car-prev').addEventListener('click', function () { show(i - 1); start(); });
    c.querySelector('.car-next').addEventListener('click', function () { show(i + 1); start(); });
    dots.forEach(function (d, k) { d.addEventListener('click', function () { show(k); start(); }); });
    c.addEventListener('mouseenter', function () { held = true; stop(); });
    c.addEventListener('mouseleave', function () { held = false; start(); });
    c.addEventListener('focusin', function () { held = true; stop(); });
    c.addEventListener('focusout', function () { held = false; start(); });
    var x0 = null;
    c.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    c.addEventListener('touchend', function (e) { if (x0 != null) { var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1)); x0 = null; } start(); });
    c.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') { show(i - 1); start(); } else if (e.key === 'ArrowRight') { show(i + 1); start(); } });
    c.querySelector('.car-view').addEventListener('click', function (e) {
      var img = e.target.closest('.car-s.on img'); if (!img || img.closest('.car-s') === slides[0]) return;
      var o = document.createElement('div'); o.className = 'lb'; o.innerHTML = '<img src="' + img.src + '" alt="">';
      function close() { o.remove(); document.removeEventListener('keydown', k); }
      function k(ev) { if (ev.key === 'Escape') close(); }
      o.addEventListener('click', close); document.addEventListener('keydown', k); document.body.appendChild(o);
    });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    start();
  });
})();
