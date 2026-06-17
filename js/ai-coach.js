// ai-coach.js — Claude API integration
// API key: set window.CLAUDE_API_KEY in js/config.js (gitignored).
// See js/config.example.js for setup instructions.

SalesOS.aiCoach = (() => {
  const MODEL  = 'claude-sonnet-4-6';
  const APIURL = 'https://api.anthropic.com/v1/messages';

  let open = false;

  // ── Panel toggle ─────────────────────────────────────────────────────────
  function toggle() {
    open = !open;
    document.getElementById('ai-coach-panel').classList.toggle('ai-coach-open', open);
    document.getElementById('ai-coach-toggle').classList.toggle('active', open);
    if (open) document.getElementById('ai-coach-input').focus();
  }

  function close() {
    open = false;
    document.getElementById('ai-coach-panel').classList.remove('ai-coach-open');
    document.getElementById('ai-coach-toggle').classList.remove('active');
  }

  // ── Context builder ──────────────────────────────────────────────────────
  function buildContext(state, asOf) {
    const dt       = SalesOS.data;
    const fc       = SalesOS.forecast;
    const logs     = dt.logsUpTo(state, asOf);
    const dates    = dt.uniqueDates(logs);
    const nDays    = dates.length || 1;
    const today    = asOf || (dates[dates.length - 1] ?? new Date().toISOString().split('T')[0]);
    const revByP   = dt.revenueByPerson(logs, state.salespeople);
    const revByPrd = dt.revenueByProduct(logs, state.products);
    const total    = Object.values(revByP).reduce((s, v) => s + v, 0);
    const attPct   = state.teamGoal > 0 ? (total / state.teamGoal * 100).toFixed(1) : '0';
    const daysLeft = fc.daysLeftInMonth(today);

    const peopleCtx = state.salespeople.map(sp => {
      const series = dt.dailyRevenueByPerson(logs, sp.id, Math.min(nDays, 30), today);
      const vals   = series.map(d => d.amount);
      const mom    = fc.momentum7d(vals);
      const str    = fc.streak(vals.slice(-14), sp.dailyGoal);
      const reg    = fc.linearRegression(vals);
      const proj   = reg.predict(29) * 30;
      return `- ${sp.name}: $${Math.round(revByP[sp.id] || 0).toLocaleString()} total | Goal $${sp.dailyGoal.toLocaleString()}/day | 7-day trend: ${mom >= 0 ? '+' : ''}${mom.toFixed(1)}% | Streak: ${str.count} days ${str.direction} goal | Projected period total: $${Math.round(proj).toLocaleString()}`;
    }).join('\n');

    const productsCtx = state.products.map(p =>
      `- ${p.name}: $${Math.round(revByPrd[p.id] || 0).toLocaleString()} revenue`
    ).join('\n');

    return `SALES TEAM ANALYTICS SNAPSHOT (as of ${today})

TEAM:
- Monthly Goal: $${state.teamGoal.toLocaleString()}
- Revenue to Date: $${Math.round(total).toLocaleString()} (${attPct}% attained)
- Days into Period: ${nDays} | Days Remaining: ${daysLeft}

TEAM MEMBERS:
${peopleCtx}

PRODUCTS:
${productsCtx}

You are an expert sales coach with deep knowledge of sales performance analytics. Answer the user's question using the data above. Be concise (2-4 sentences), specific to the numbers, and actionable. If you reference a trend or projection, cite the actual figure.`;
  }

  // ── Message rendering ─────────────────────────────────────────────────────
  function appendMessage(role, text) {
    const container = document.getElementById('ai-coach-messages');
    const div       = document.createElement('div');
    div.className   = role === 'user' ? 'ai-message ai-message--user' : 'ai-message ai-message--coach';

    if (role === 'coach') {
      div.innerHTML = `<div class="ai-avatar">⬡</div><div class="ai-text"></div>`;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
      typewrite(div.querySelector('.ai-text'), text);
    } else {
      div.innerHTML = `<div class="ai-text">${escHtml(text)}</div>`;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }
  }

  function appendThinking() {
    const container = document.getElementById('ai-coach-messages');
    const div       = document.createElement('div');
    div.className   = 'ai-message ai-message--coach ai-message--thinking';
    div.id          = 'ai-thinking';
    div.innerHTML   = '<div class="ai-avatar">⬡</div><div class="ai-dots"><span></span><span></span><span></span></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function removeThinking() {
    const el = document.getElementById('ai-thinking');
    if (el) el.remove();
  }

  function typewrite(el, text, i = 0) {
    if (i < text.length) {
      el.textContent += text[i];
      el.closest('.ai-coach-messages').scrollTop = 9999;
      setTimeout(() => typewrite(el, text, i + 1), 12);
    }
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function showError(msg) {
    const container = document.getElementById('ai-coach-messages');
    const div = document.createElement('div');
    div.className = 'ai-message ai-message--error';
    div.innerHTML = `<div class="ai-avatar">!</div><div class="ai-text">${escHtml(msg)}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  // ── API call ──────────────────────────────────────────────────────────────
  async function ask(question) {
    const key = window.CLAUDE_API_KEY || '';
    if (!key) {
      showError('No API key configured. Add your Anthropic API key to js/config.js — see config.example.js for instructions.');
      return;
    }

    const state = SalesOS.app.getState();
    const asOf  = SalesOS.app.getCurrentDate();
    const systemPrompt = buildContext(state, asOf);

    appendMessage('user', question);
    appendThinking();

    const input = document.getElementById('ai-coach-input');
    input.disabled = true;
    document.getElementById('ai-coach-send').disabled = true;

    try {
      const res = await fetch(APIURL, {
        method: 'POST',
        headers: {
          'Content-Type':            'application/json',
          'x-api-key':               key,
          'anthropic-version':       '2023-06-01',
          'anthropic-dangerous-request-proxy': 'true',
        },
        body: JSON.stringify({
          model:      MODEL,
          max_tokens: 512,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: question }],
        }),
      });

      removeThinking();

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const text = data?.content?.[0]?.text || 'No response.';
      appendMessage('coach', text);

    } catch (err) {
      removeThinking();
      showError(`Coach unavailable: ${err.message}`);
    } finally {
      input.disabled = false;
      document.getElementById('ai-coach-send').disabled = false;
      input.focus();
    }
  }

  // ── Events ───────────────────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('ai-coach-toggle').addEventListener('click', toggle);
    document.getElementById('ai-coach-close').addEventListener('click', close);

    const input  = document.getElementById('ai-coach-input');
    const sendBtn = document.getElementById('ai-coach-send');

    async function submit() {
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      await ask(q);
    }

    sendBtn.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

    // Suggested prompts
    document.querySelectorAll('.ai-suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = btn.dataset.q;
        submit();
      });
    });
  }

  return { toggle, close, bindEvents };
})();
