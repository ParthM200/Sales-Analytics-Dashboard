// app.js — orchestrator: state, rendering, tab management, form handlers

SalesOS.app = (() => {
  let state       = null;
  let currentDate = null; // null = live

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  function init() {
    state = SalesOS.data.init();
    bindTabs();
    bindForms();
    bindChartControls();
    SalesOS.timeMachine.bindEvents();
    SalesOS.warRoom.bindEvents();
    SalesOS.aiCoach.bindEvents();
    renderAll();
    SalesOS.timeMachine.init(state);
    setTodayDate();
    populateSelects();
  }

  function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    const el = document.getElementById('sale-date');
    if (el) el.value = today;
  }

  // ── Core render ───────────────────────────────────────────────────────────
  function renderAll() {
    renderKPIs();
    renderLeaderboard();
    renderInsights();
    renderProductTable();
    SalesOS.charts.initAll(state, currentDate);
  }

  function renderAtDate(isoDate) {
    currentDate = isoDate;
    renderKPIs();
    renderLeaderboard();
    renderInsights();
    SalesOS.charts.updateAll(state, currentDate);
  }

  // ── KPI Strip ─────────────────────────────────────────────────────────────
  function renderKPIs() {
    const dt     = SalesOS.data;
    const fc     = SalesOS.forecast;
    const logs   = dt.logsUpTo(state, currentDate);
    const dates  = dt.uniqueDates(logs);
    const nDays  = dates.length || 1;

    // Total revenue
    const total = logs.reduce((s, l) => s + l.amount, 0);
    animateValue('kpi-revenue-val', total, v => '$' + Math.round(v).toLocaleString());
    document.getElementById('kpi-revenue-sub').textContent = `over ${nDays} day${nDays !== 1 ? 's' : ''}`;

    // Top performer
    const rev = dt.revenueByPerson(logs, state.salespeople);
    const topEntry = state.salespeople.map(sp => ({ sp, total: rev[sp.id] || 0 })).sort((a, b) => b.total - a.total)[0];
    if (topEntry) {
      document.getElementById('kpi-top-val').textContent = topEntry.sp.name.split(' ')[0];
      document.getElementById('kpi-top-sub').textContent = `$${Math.round(topEntry.total).toLocaleString()} in sales`;
    }

    // Goal attainment
    const attPct = state.teamGoal > 0 ? Math.min(150, (total / state.teamGoal) * 100) : 0;
    animateValue('kpi-attainment-val', attPct, v => v.toFixed(1) + '%');
    const bar = document.getElementById('kpi-attainment-bar');
    if (bar) {
      bar.style.width = Math.min(100, attPct) + '%';
      bar.style.background = attPct >= 100 ? 'var(--green)' : attPct >= 70 ? 'var(--accent)' : 'var(--red)';
    }

    // Avg close rate (avg daily per person vs their daily goal)
    const rates = state.salespeople.map(sp => {
      const spTotal = rev[sp.id] || 0;
      const spGoal  = sp.dailyGoal * nDays;
      return spGoal > 0 ? (spTotal / spGoal) * 100 : 0;
    });
    const avgRate = rates.reduce((s, v) => s + v, 0) / Math.max(1, rates.length);
    animateValue('kpi-closerate-val', avgRate, v => v.toFixed(0) + '%');

    // Close rate trend vs prior 7 days
    const today    = currentDate || (dates[dates.length - 1] ?? new Date().toISOString().split('T')[0]);
    const priorLogs = state.logs.filter(l => {
      const d = new Date(l.date + 'T00:00:00');
      const t = new Date(today  + 'T00:00:00');
      const diff = (t - d) / 86400000;
      return diff > 7 && diff <= 14;
    });
    const recentLogs = logs.filter(l => {
      const d = new Date(l.date + 'T00:00:00');
      const t = new Date(today  + 'T00:00:00');
      return (t - d) / 86400000 <= 7;
    });
    const priorTotal  = priorLogs.reduce((s, l) => s + l.amount, 0) / 7;
    const recentTotal = recentLogs.reduce((s, l) => s + l.amount, 0) / 7;
    const trend = priorTotal > 0 ? ((recentTotal - priorTotal) / priorTotal) * 100 : 0;
    const subEl = document.getElementById('kpi-closerate-sub');
    if (subEl) {
      subEl.textContent = (trend >= 0 ? '▲ +' : '▼ ') + Math.abs(trend).toFixed(1) + '% vs prior 7d';
      subEl.style.color = trend >= 0 ? 'var(--green)' : 'var(--red)';
    }
  }

  let animTimers = {};
  let animCurrent = {};
  function animateValue(id, target, formatter) {
    const el = document.getElementById(id);
    if (!el) return;
    cancelAnimationFrame(animTimers[id]);
    // Transition from whatever's currently displayed, not always from 0
    const start    = animCurrent[id] ?? 0;
    const duration = 500;
    const t0       = performance.now();
    function step(now) {
      const prog = Math.min(1, (now - t0) / duration);
      const ease = 1 - Math.pow(1 - prog, 3);
      const val  = start + (target - start) * ease;
      animCurrent[id] = val;
      el.textContent = formatter(val);
      if (prog < 1) animTimers[id] = requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ── Leaderboard ───────────────────────────────────────────────────────────
  function renderLeaderboard() {
    const dt      = SalesOS.data;
    const fc      = SalesOS.forecast;
    const logs    = dt.logsUpTo(state, currentDate);
    const dates   = dt.uniqueDates(logs);
    const nDays   = dates.length || 1;
    const today   = currentDate || (dates[dates.length - 1] ?? new Date().toISOString().split('T')[0]);
    const rev     = dt.revenueByPerson(logs, state.salespeople);
    const colors  = SalesOS.charts.getPersonColors();

    const ranked = state.salespeople
      .map((sp, idx) => {
        const series = dt.dailyRevenueByPerson(logs, sp.id, Math.min(nDays, 14), today);
        const vals   = series.map(d => d.amount);
        const mom    = fc.momentum7d(vals);
        const total  = rev[sp.id] || 0;
        const score  = total * 0.6 + (mom > 0 ? mom * 20 : 0);
        return { sp, total, vals, mom, score, color: colors[idx % colors.length] };
      })
      .sort((a, b) => b.total - a.total);

    const lb = document.getElementById('leaderboard-list');
    lb.innerHTML = ranked.map((entry, i) => {
      const attPct = entry.sp.dailyGoal > 0
        ? Math.min(100, (entry.total / (entry.sp.dailyGoal * nDays)) * 100)
        : 0;
      const momStr  = (entry.mom >= 0 ? '▲ +' : '▼ ') + Math.abs(entry.mom).toFixed(1) + '%';
      const momCls  = entry.mom >= 0 ? 'trend-up' : 'trend-down';

      return `
        <div class="lb-row ${i === 0 ? 'lb-row--leader' : ''}">
          <div class="lb-rank">${i + 1}</div>
          <div class="lb-info">
            <div class="lb-name">${entry.sp.name}</div>
            <div class="lb-goal-bar">
              <div class="lb-goal-fill" style="width:${attPct.toFixed(1)}%;background:${entry.color}44;border-right:1px solid ${entry.color}"></div>
            </div>
          </div>
          <canvas class="lb-spark" width="80" height="24" id="spark-${entry.sp.id}"></canvas>
          <div class="lb-mom ${momCls}">${momStr}</div>
          <div class="lb-total" style="color:${entry.color}">$${Math.round(entry.total).toLocaleString()}</div>
        </div>`;
    }).join('');

    // Draw sparklines after DOM update
    requestAnimationFrame(() => {
      ranked.forEach(entry => {
        const canvas = document.getElementById(`spark-${entry.sp.id}`);
        if (canvas) SalesOS.charts.drawSparkline(canvas, entry.vals, entry.color);
      });
    });

    document.getElementById('leaderboard-date').textContent =
      currentDate ? `AS OF ${currentDate}` : 'ALL TIME';
  }

  // ── Insights ──────────────────────────────────────────────────────────────
  function renderInsights() {
    const list     = document.getElementById('insights-list');
    const insights = SalesOS.insights.generate(state, currentDate);

    list.innerHTML = insights.map((ins, i) => `
      <div class="insight-card insight-${ins.type}" style="animation-delay:${i * 80}ms">
        <span class="insight-icon">${ins.icon}</span>
        <span class="insight-text">${ins.text}</span>
      </div>`).join('');
  }

  // ── Product table ─────────────────────────────────────────────────────────
  function renderProductTable() {
    const container = document.getElementById('product-table');
    if (!container) return;

    container.innerHTML = `
      <div class="dt-header">
        <span>PRODUCT</span><span>PRICE</span><span>STOCK</span>
      </div>
      ${state.products.map(p => `
        <div class="dt-row">
          <span>${p.name}</span>
          <span>$${p.price.toLocaleString()}</span>
          <span>${p.stock}</span>
        </div>`).join('')}`;
  }

  // ── Populate selects ──────────────────────────────────────────────────────
  function populateSelects() {
    const pSelect = document.getElementById('sale-person');
    const prSelect = document.getElementById('sale-product');
    if (pSelect) {
      pSelect.innerHTML = state.salespeople.map(sp =>
        `<option value="${sp.id}">${sp.name}</option>`).join('');
    }
    if (prSelect) {
      prSelect.innerHTML = state.products.map(p =>
        `<option value="${p.id}">${p.name}</option>`).join('');
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function toast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.textContent = msg;
    container.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast-show'));
    setTimeout(() => {
      t.classList.remove('toast-show');
      setTimeout(() => t.remove(), 400);
    }, 3000);
  }

  // ── Tab management ────────────────────────────────────────────────────────
  function bindTabs() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        const tab = document.getElementById('tab-' + btn.dataset.tab);
        if (tab) tab.classList.add('active');
      });
    });
  }

  // ── Chart controls ────────────────────────────────────────────────────────
  function bindChartControls() {
    document.querySelectorAll('.chart-btn:not(.forecast-toggle)').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chart-btn:not(.forecast-toggle)').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        SalesOS.charts.setRange(parseInt(btn.dataset.range));
        SalesOS.charts.updateTrend(state, currentDate);
      });
    });

    const fBtn = document.querySelector('.forecast-toggle');
    if (fBtn) {
      fBtn.addEventListener('click', () => {
        fBtn.classList.toggle('active');
        SalesOS.charts.setForecast(fBtn.classList.contains('active'));
        SalesOS.charts.updateTrend(state, currentDate);
      });
    }
  }

  // ── Forms ─────────────────────────────────────────────────────────────────
  function bindForms() {
    // Log sale
    document.getElementById('log-sale-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const personId  = document.getElementById('sale-person').value;
      const productId = document.getElementById('sale-product').value;
      const amount    = parseFloat(document.getElementById('sale-amount').value);
      const date      = document.getElementById('sale-date').value;

      if (!personId || !productId || !amount || !date) return toast('Fill in all fields.', 'error');
      if (amount <= 0) return toast('Amount must be positive.', 'error');

      SalesOS.data.addLog(state, { personId, productId, amount, date });

      // War room celebration
      if (SalesOS.warRoom.isActive()) {
        const person = state.salespeople.find(s => s.id === Number(personId));
        SalesOS.warRoom.celebrate(person?.name || 'Team', amount);
        SalesOS.warRoom.render();
      }

      SalesOS.timeMachine.init(state);
      renderAll();
      populateSelects();
      setTodayDate();
      document.getElementById('sale-amount').value = '';
      toast(`Sale logged — $${amount.toLocaleString()}`);
    });

    // Add salesperson
    document.getElementById('add-person-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const name  = document.getElementById('person-name').value.trim();
      const goal  = parseFloat(document.getElementById('person-goal').value);
      if (!name || !goal) return toast('Fill in all fields.', 'error');
      SalesOS.data.addPerson(state, { name, dailyGoal: goal });
      renderAll();
      populateSelects();
      e.target.reset();
      toast(`${name} added to team.`);
    });

    // Add product
    document.getElementById('add-product-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const name  = document.getElementById('product-name').value.trim();
      const price = parseFloat(document.getElementById('product-price').value);
      const stock = parseInt(document.getElementById('product-stock').value);
      if (!name || !price) return toast('Fill in all fields.', 'error');
      SalesOS.data.addProduct(state, { name, price, stock: stock || 0 });
      renderAll();
      populateSelects();
      e.target.reset();
      toast(`${name} added.`);
    });

    // Team goal
    document.getElementById('team-goal-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const goal = parseFloat(document.getElementById('team-goal-input').value);
      if (!goal) return toast('Enter a valid goal.', 'error');
      SalesOS.data.updateTeamGoal(state, goal);
      renderAll();
      toast(`Team goal set to $${goal.toLocaleString()}.`);
    });

    // Pre-fill team goal
    const goalInput = document.getElementById('team-goal-input');
    if (goalInput && state.teamGoal) goalInput.value = state.teamGoal;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  function getState() { return state; }
  function getCurrentDate() { return currentDate; }

  document.addEventListener('DOMContentLoaded', init);

  return { getState, getCurrentDate, renderAll, renderAtDate };
})();
