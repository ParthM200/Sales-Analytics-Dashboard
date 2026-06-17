// charts.js — Chart.js configuration and rendering

SalesOS.charts = (() => {
  let trendChart = null;
  let productBarChart = null;
  let productDonutChart = null;
  let forecastEnabled = true;
  let currentRange = 7;

  // Palette — one color per person, must contrast on dark bg
  const PERSON_COLORS = [
    '#EEFF41', // electric lime   (Sarah)
    '#FF4081', // hot pink        (Marcus)
    '#4DFF91', // electric green  (Emma)
    '#40C4FF', // electric blue   (Kai)
    '#FF9B21', // amber           (Alex)
  ];

  const PRODUCT_COLORS = ['#EEFF41', '#FF4081', '#4DFF91', '#40C4FF'];

  const BASE_OPTS = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#8892A0',
          font: { family: "'JetBrains Mono', monospace", size: 11 },
          boxWidth: 10,
          padding: 16,
          filter: item => !item.text.includes('(Forecast)') && !item.text.includes('CI'),
        },
      },
      tooltip: {
        backgroundColor: '#141420',
        borderColor: '#2D2D44',
        borderWidth: 1,
        titleColor: '#EEFF41',
        bodyColor: '#E8ECF1',
        titleFont:  { family: "'JetBrains Mono', monospace", size: 11 },
        bodyFont:   { family: "'JetBrains Mono', monospace", size: 11 },
        callbacks: {
          label: ctx => ` ${ctx.dataset.label}: $${Math.round(ctx.raw || 0).toLocaleString()}`,
        },
      },
    },
    scales: {
      x: {
        grid:  { color: 'rgba(255,255,255,0.03)', drawBorder: false },
        ticks: { color: '#4A5264', font: { family: "'JetBrains Mono', monospace", size: 10 }, maxTicksLimit: 8 },
      },
      y: {
        grid:  { color: 'rgba(255,255,255,0.04)', drawBorder: false },
        ticks: {
          color: '#4A5264',
          font:  { family: "'JetBrains Mono', monospace", size: 10 },
          callback: v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v),
        },
      },
    },
  };

  // ── Trend chart ────────────────────────────────────────────────────────────
  function buildTrendDatasets(state, asOf) {
    const dt     = SalesOS.data;
    const fc     = SalesOS.forecast;
    const logs   = dt.logsUpTo(state, asOf);
    const people = state.salespeople;
    const range  = currentRange;

    const labels    = [];
    const today     = asOf ? new Date(asOf) : new Date();
    today.setHours(0, 0, 0, 0);
    const FORECAST_DAYS = forecastEnabled ? 5 : 0;

    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    for (let i = 1; i <= FORECAST_DAYS; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }

    const datasets = [];

    people.forEach((sp, idx) => {
      const color   = PERSON_COLORS[idx % PERSON_COLORS.length];
      const series  = dt.dailyRevenueByPerson(logs, sp.id, range, asOf);
      const actuals = series.map(d => d.amount);
      const reg     = fc.linearRegression(actuals);

      // Actual line
      datasets.push({
        label: sp.name,
        data:  [...actuals, ...Array(FORECAST_DAYS).fill(null)],
        borderColor:     color,
        backgroundColor: color + '12',
        borderWidth: 2,
        pointRadius:      actuals.map((v, i) => (i === actuals.length - 1 ? 4 : 2)),
        pointBackgroundColor: color,
        tension: 0.35,
        fill: false,
        order: 1,
      });

      if (forecastEnabled && FORECAST_DAYS > 0) {
        // Forecast line
        const fcast = SalesOS.forecast.projectForward(actuals, FORECAST_DAYS + 1);
        const fcastValues = [actuals[actuals.length - 1], ...fcast.map(f => f.value)];
        const upperValues = [actuals[actuals.length - 1], ...fcast.map(f => f.upper)];
        const lowerValues = [actuals[actuals.length - 1], ...fcast.map(f => f.lower)];
        const pad = Array(actuals.length - 1).fill(null);

        datasets.push({
          label: sp.name + ' (Forecast)',
          data: [...pad, ...fcastValues],
          borderColor: color + '88',
          borderDash: [5, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          order: 2,
        });

        // CI band upper
        datasets.push({
          label: sp.name + ' CI Upper',
          data: [...pad, ...upperValues],
          borderColor: 'transparent',
          backgroundColor: color + '0D',
          borderWidth: 0,
          pointRadius: 0,
          fill: '+1',
          order: 3,
        });

        // CI band lower
        datasets.push({
          label: sp.name + ' CI Lower',
          data: [...pad, ...lowerValues],
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          borderWidth: 0,
          pointRadius: 0,
          fill: false,
          order: 3,
        });
      }
    });

    return { labels, datasets };
  }

  function initTrend(state, asOf) {
    const canvas = document.getElementById('trend-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (trendChart) trendChart.destroy();

    const { labels, datasets } = buildTrendDatasets(state, asOf);

    trendChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        ...BASE_OPTS,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          ...BASE_OPTS.plugins,
          annotation: undefined,
        },
        scales: {
          ...BASE_OPTS.scales,
          x: { ...BASE_OPTS.scales.x, ticks: { ...BASE_OPTS.scales.x.ticks, maxTicksLimit: 10 } },
        },
      },
    });
  }

  function updateTrend(state, asOf) {
    if (!trendChart) return initTrend(state, asOf);
    const { labels, datasets } = buildTrendDatasets(state, asOf);
    trendChart.data.labels   = labels;
    trendChart.data.datasets = datasets;
    trendChart.update('active');
  }

  // ── Product bar chart ──────────────────────────────────────────────────────
  function initProductBar(state, asOf) {
    const canvas = document.getElementById('product-bar-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (productBarChart) productBarChart.destroy();

    const logs = SalesOS.data.logsUpTo(state, asOf);
    const rev  = SalesOS.data.revenueByProduct(logs, state.products);

    productBarChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels:   state.products.map(p => p.name),
        datasets: [{
          label: 'Revenue',
          data:  state.products.map(p => rev[p.id] || 0),
          backgroundColor: PRODUCT_COLORS,
          borderColor:     PRODUCT_COLORS.map(c => c + 'CC'),
          borderWidth: 1,
          borderRadius: 2,
        }],
      },
      options: {
        ...BASE_OPTS,
        indexAxis: 'y',
        plugins: {
          ...BASE_OPTS.plugins,
          legend: { display: false },
        },
        scales: {
          x: { ...BASE_OPTS.scales.x, ticks: { ...BASE_OPTS.scales.x.ticks, callback: v => '$' + (v / 1000).toFixed(0) + 'k' } },
          y: { ...BASE_OPTS.scales.y, grid: { display: false }, ticks: { color: '#8892A0', font: { family: "'JetBrains Mono', monospace", size: 11 } } },
        },
      },
    });
  }

  function updateProductBar(state, asOf) {
    if (!productBarChart) return initProductBar(state, asOf);
    const logs = SalesOS.data.logsUpTo(state, asOf);
    const rev  = SalesOS.data.revenueByProduct(logs, state.products);
    productBarChart.data.datasets[0].data = state.products.map(p => rev[p.id] || 0);
    productBarChart.update('active');
  }

  // ── Product donut ──────────────────────────────────────────────────────────
  function initProductDonut(state, asOf) {
    const canvas = document.getElementById('product-donut-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (productDonutChart) productDonutChart.destroy();

    const logs = SalesOS.data.logsUpTo(state, asOf);
    const rev  = SalesOS.data.revenueByProduct(logs, state.products);
    const total = Object.values(rev).reduce((s, v) => s + v, 0);

    document.getElementById('donut-center-val').textContent = state.products.length;

    productDonutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels:   state.products.map(p => p.name),
        datasets: [{
          data:            state.products.map(p => rev[p.id] || 0),
          backgroundColor: PRODUCT_COLORS.map(c => c + 'CC'),
          borderColor:     '#06060A',
          borderWidth: 3,
          hoverBorderColor: PRODUCT_COLORS,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        animation: { duration: 600 },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#8892A0',
              font: { family: "'JetBrains Mono', monospace", size: 10 },
              boxWidth: 8,
              padding: 12,
            },
          },
          tooltip: {
            ...BASE_OPTS.plugins.tooltip,
            callbacks: {
              label: ctx => {
                const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: $${Math.round(ctx.raw).toLocaleString()} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  function updateProductDonut(state, asOf) {
    if (!productDonutChart) return initProductDonut(state, asOf);
    const logs = SalesOS.data.logsUpTo(state, asOf);
    const rev  = SalesOS.data.revenueByProduct(logs, state.products);
    productDonutChart.data.datasets[0].data = state.products.map(p => rev[p.id] || 0);
    productDonutChart.data.labels = state.products.map(p => p.name);
    productDonutChart.update('active');
  }

  // ── Sparkline (raw canvas, not Chart.js) ──────────────────────────────────
  function drawSparkline(canvas, values, color) {
    const ctx    = canvas.getContext('2d');
    const w      = canvas.width;
    const h      = canvas.height;
    const pad    = 2;
    ctx.clearRect(0, 0, w, h);

    if (!values || values.length < 2) return;

    const nonZero = values.filter(v => v > 0);
    const min = Math.min(...nonZero) * 0.9;
    const max = Math.max(...nonZero) * 1.05;
    const range = max - min || 1;

    const toX = i => pad + (i / (values.length - 1)) * (w - pad * 2);
    const toY = v => h - pad - ((v - min) / range) * (h - pad * 2);

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    values.forEach((v, i) => {
      if (i === 0) ctx.moveTo(toX(i), toY(v));
      else ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();

    // Fill under the line
    ctx.lineTo(toX(values.length - 1), h);
    ctx.lineTo(toX(0), h);
    ctx.closePath();
    ctx.fillStyle = color + '22';
    ctx.fill();
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  function initAll(state, asOf) {
    initTrend(state, asOf);
    initProductBar(state, asOf);
    initProductDonut(state, asOf);
  }

  function updateAll(state, asOf) {
    updateTrend(state, asOf);
    updateProductBar(state, asOf);
    updateProductDonut(state, asOf);
  }

  function setRange(r) {
    currentRange = r;
  }

  function setForecast(enabled) {
    forecastEnabled = enabled;
  }

  function getPersonColors() { return PERSON_COLORS; }

  return { initAll, updateAll, initTrend, updateTrend, setRange, setForecast, drawSparkline, getPersonColors };
})();
