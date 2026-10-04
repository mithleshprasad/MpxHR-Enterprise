/* "Ask AI" assistant: a floating button that opens a small chat. Calls the serverless endpoint set in site-config (aiEndpoint). */
(function () {
    var cfg = window.MPXHR_AI;
    if (!cfg || !cfg.endpoint) return;
    var history = [], busy = false;

    var btn = document.createElement('button');
    btn.className = 'ai-float'; btn.type = 'button'; btn.setAttribute('aria-label', 'Ask the MpxHR assistant'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M21 5h-4M5 17v4M7 19H3"/></svg><span>Ask AI</span>';

    var panel = document.createElement('section');
    panel.className = 'ai-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'MpxHR assistant');
    panel.innerHTML =
        '<header><div><b>MpxHR Assistant</b><small>Ask about features, plans or setup</small></div><button type="button" class="ai-x" aria-label="Close">&times;</button></header>' +
        '<div class="ai-log" id="ai-log" aria-live="polite"></div>' +
        '<div class="ai-chips" id="ai-chips"></div>' +
        '<form class="ai-form" id="ai-form"><input id="ai-input" type="text" maxlength="300" placeholder="Type your question (English or Hindi)" autocomplete="off" aria-label="Your question"><button type="submit" aria-label="Send">&#10148;</button></form>' +
        '<footer>AI can make mistakes. For exact prices or legal rules please confirm on <a href="' + cfg.wa + '" target="_blank" rel="noopener">WhatsApp</a>.</footer>';

    document.body.appendChild(btn); document.body.appendChild(panel);
    var log = panel.querySelector('#ai-log'), form = panel.querySelector('#ai-form'), input = panel.querySelector('#ai-input'), chips = panel.querySelector('#ai-chips');

    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function fmt(text) {
        var out = '', list = false;
        esc(text).split(/\n/).forEach(function (line) {
            var li = /^\s*[-*•]\s+(.*)/.exec(line);
            if (li) { if (!list) { out += '<ul>'; list = true; } out += '<li>' + li[1] + '</li>'; return; }
            if (list) { out += '</ul>'; list = false; }
            if (line.trim()) out += '<p>' + line + '</p>';
        });
        if (list) out += '</ul>';
        return out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    }
    function add(role, html) {
        var d = document.createElement('div'); d.className = 'ai-msg ' + role; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
    }
    function open(v) {
        panel.hidden = !v; btn.setAttribute('aria-expanded', String(v)); btn.classList.toggle('on', v);
        if (v) { if (!log.children.length) greet(); setTimeout(function () { input.focus(); }, 50); }
    }
    function greet() {
        add('bot', '<p>Hi! I can answer questions about MpxHR: features, plans, setup, attendance and payroll. What would you like to know?</p>');
        ['What does MpxHR cost?', 'Does it work offline?', 'How do I start the free trial?', 'PF aur ESI kaise calculate hota hai?'].forEach(function (q) {
            var c = document.createElement('button'); c.type = 'button'; c.textContent = q; c.addEventListener('click', function () { ask(q); }); chips.appendChild(c);
        });
    }
    async function ask(q) {
        q = (q || '').trim(); if (!q || busy) return;
        busy = true; chips.hidden = true; input.value = '';
        add('me', '<p>' + esc(q) + '</p>');
        var wait = add('bot typing', '<span></span><span></span><span></span>');
        try {
            var r = await fetch(cfg.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, history: history.slice(-4) }) });
            var data = {}; try { data = await r.json(); } catch (e) { /* not json */ }
            wait.remove();
            if (!r.ok || !data.answer) throw new Error(data.error || 'The assistant is busy. Please try again.');
            add('bot', fmt(data.answer));
            history.push({ role: 'user', content: q }, { role: 'assistant', content: data.answer.slice(0, 300) });
        } catch (e) {
            wait.remove();
            add('bot err', '<p>' + esc(e.message || 'Something went wrong.') + '</p><p><a href="' + cfg.wa + '" target="_blank" rel="noopener">Ask on WhatsApp instead</a></p>');
        }
        busy = false; input.focus();
    }
    btn.addEventListener('click', function () { open(panel.hidden); });
    panel.querySelector('.ai-x').addEventListener('click', function () { open(false); btn.focus(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { open(false); btn.focus(); } });
})();
