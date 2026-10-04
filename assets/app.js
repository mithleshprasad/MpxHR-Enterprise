(function () {
    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
    function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

    // mobile menu
    var burger = $('.burger'), nav = $('.nav');
    if (burger) burger.addEventListener('click', function () { nav.classList.toggle('open'); burger.setAttribute('aria-expanded', nav.classList.contains('open')); });

    // language (EN / HI)
    var dict = window.__I18N || {};
    function setLang(l) {
        document.documentElement.lang = l === 'hi' ? 'hi' : 'en';
        $$('[data-i18n]').forEach(function (el) {
            var k = el.getAttribute('data-i18n');
            if (el.__en === undefined) el.__en = el.innerHTML;
            if (l === 'hi' && dict[k]) el.innerHTML = dict[k]; else el.innerHTML = el.__en;
        });
        var b = $('#langbtn'); if (b) b.textContent = l === 'hi' ? 'English' : 'हिंदी';
        store('mpx_lang', l);
    }
    var lb = $('#langbtn');
    if (lb) lb.addEventListener('click', function () { setLang(document.documentElement.lang === 'hi' ? 'en' : 'hi'); });
    if (store('mpx_lang') === 'hi') setLang('hi');

    // image lightbox
    var box = document.createElement('div'); box.className = 'lb'; box.innerHTML = '<img alt="">'; document.body.appendChild(box);
    box.addEventListener('click', function () { box.classList.remove('on'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.classList.remove('on'); });
    $$('[data-zoom]').forEach(function (el) {
        el.addEventListener('click', function () { var i = $('img', el) || el; box.firstChild.src = i.getAttribute('data-full') || i.src; box.firstChild.alt = i.alt; box.classList.add('on'); });
    });

    // docs: sidebar filter + active section
    var q = $('#docsearch');
    if (q) {
        var links = $$('.side a[href^="#"]'), secs = $$('.doc > section');
        q.addEventListener('input', function () {
            var t = q.value.trim().toLowerCase();
            secs.forEach(function (s) { var hit = !t || s.textContent.toLowerCase().indexOf(t) > -1; s.classList.toggle('hidden', !hit); });
            links.forEach(function (a) { var s = document.getElementById(a.getAttribute('href').slice(1)); a.style.display = s && s.classList.contains('hidden') ? 'none' : ''; });
        });
        if ('IntersectionObserver' in window) {
            var io = new IntersectionObserver(function (es) {
                es.forEach(function (e) { if (e.isIntersecting) links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id); }); });
            }, { rootMargin: '-90px 0px -70% 0px' });
            secs.forEach(function (s) { io.observe(s); });
        }
    }

    // contact form -> opens WhatsApp / mail with the typed text (no server needed)
    var f = $('#contactform');
    if (f) f.addEventListener('submit', function (e) {
        e.preventDefault();
        var d = new FormData(f);
        var msg = 'Hello, I am ' + d.get('name') + (d.get('company') ? ' from ' + d.get('company') : '') + '.\nInterested in: ' + d.get('topic') + '\nPhone: ' + d.get('phone') + '\n' + (d.get('message') || '');
        window.open('https://wa.me/' + f.getAttribute('data-wa') + '?text=' + encodeURIComponent(msg), '_blank');
    });
})();

/* 3D + motion: floating spheres, hero parallax, card tilt, scroll reveal, count-up */
(function () {
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var wide = window.innerWidth > 900;
    var hero = document.querySelector('.hero');
    var shot = hero && hero.querySelector('img.shot');
    var orbs = [];
    if (hero && wide && !reduce) {
        ['<i class="orb o1"></i>', '<i class="orb o2"></i>', '<i class="orb o3"></i>', '<i class="ring"></i>'].forEach(function (h) {
            var d = document.createElement('div'); d.innerHTML = h; var el = d.firstChild; hero.appendChild(el); orbs.push(el);
        });
        hero.addEventListener('mousemove', function (ev) {
            var r = hero.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
            hero.classList.add('tilting');
            if (shot) shot.style.transform = 'rotateY(' + (-12 + x * 18) + 'deg) rotateX(' + (5 - y * 14) + 'deg)';
            orbs.forEach(function (o, i) { var k = (i + 1) * 14; o.style.transform = 'translate(' + (-x * k) + 'px,' + (-y * k) + 'px)'; });
        });
        hero.addEventListener('mouseleave', function () {
            hero.classList.remove('tilting'); if (shot) shot.style.transform = '';
            orbs.forEach(function (o) { o.style.transform = ''; });
        });
    }
    if (wide && !reduce) {
        document.querySelectorAll('.card, .plan').forEach(function (c) {
            if (c.querySelector('form, input, select, textarea')) return;
            c.addEventListener('mousemove', function (ev) {
                var r = c.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
                c.style.setProperty('--ry', ((x - 0.5) * 12).toFixed(2) + 'deg');
                c.style.setProperty('--rx', ((0.5 - y) * 10).toFixed(2) + 'deg');
                c.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
                c.classList.add('tilt');
            });
            c.addEventListener('mouseleave', function () { c.classList.remove('tilt'); });
        });
    }
    var sel = '.card, .plan, .split, .sec-head, .band, details, .tut, .rel, table.cmp, .gal figure';
    var els = Array.prototype.slice.call(document.querySelectorAll('main ' + sel)).filter(function (e) { return !e.closest('.hero'); });
    if (!reduce && 'IntersectionObserver' in window) {
        els.forEach(function (e, i) { e.classList.add('rv'); e.style.setProperty('--d', ((i % 4) * 0.08) + 's'); });
        var io = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }); }, { threshold: 0.05 });
        els.forEach(function (e) { io.observe(e); });
        var t;
        var sweep = function () { document.querySelectorAll('.rv:not(.in)').forEach(function (e) { if (e.getBoundingClientRect().top < window.innerHeight) e.classList.add('in'); }); };
        window.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(sweep, 150); }, { passive: true });
        window.addEventListener('hashchange', function () { setTimeout(sweep, 250); });
        setTimeout(sweep, 600);
    }
    if (!reduce && 'IntersectionObserver' in window) document.querySelectorAll('.stat b').forEach(function (b) {
        var m = b.textContent.match(/^(\d+)(.*)$/); if (!m) return;
        var n = +m[1], suf = m[2], t0 = null;
        var go = function (ts) { t0 = t0 || ts; var p = Math.min(1, (ts - t0) / 900); b.textContent = Math.round(n * p) + suf; if (p < 1) requestAnimationFrame(go); };
        var o = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { o.disconnect(); requestAnimationFrame(go); } }); o.observe(b);
    });
})();

/* Download form: starts the installer download and sends the visitor's details to WhatsApp */
(function () {
    var f = document.getElementById('dlform'); if (!f) return;
    f.addEventListener('submit', function (e) {
        e.preventDefault();
        var d = new FormData(f), url = f.getAttribute('data-url');
        var msg = 'Hello, I ' + (url ? 'downloaded' : 'want') + ' MpxHR Enterprise v' + f.getAttribute('data-ver') + '.\nName: ' + d.get('name') + '\nMobile: ' + d.get('phone') +
            (d.get('email') ? '\nEmail: ' + d.get('email') : '') + (d.get('company') ? '\nCompany: ' + d.get('company') : '') + '\nSize: ' + d.get('size') + (url ? '' : '\nPlease send me the installer.');
        if (url) {
            var a = document.createElement('a'); a.href = url; a.setAttribute('download', ''); document.body.appendChild(a); a.click(); a.remove();
            var n = document.getElementById('dlnote'); if (n) n.textContent = 'Your download has started. If it did not, use this link: ' + url;
            setTimeout(function () { window.open('https://wa.me/' + f.getAttribute('data-wa') + '?text=' + encodeURIComponent(msg), '_blank'); }, 600);
        } else {
            window.open('https://wa.me/' + f.getAttribute('data-wa') + '?text=' + encodeURIComponent(msg), '_blank');
        }
    });
})();
