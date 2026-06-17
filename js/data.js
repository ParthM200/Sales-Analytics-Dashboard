// data.js — localStorage persistence, sample data generation, CRUD

const SalesOS = window.SalesOS || {};
window.SalesOS = SalesOS;

SalesOS.data = (() => {
  const STORAGE_KEY = 'salesos_v1';

  const DEFAULT_SALESPEOPLE = [
    { id: 1, name: 'Sarah Chen',       dailyGoal: 5200 },
    { id: 2, name: 'Marcus Johnson',   dailyGoal: 4800 },
    { id: 3, name: 'Emma Rodriguez',   dailyGoal: 5000 },
    { id: 4, name: 'Kai Nakamura',     dailyGoal: 4500 },
    { id: 5, name: 'Alex Thompson',    dailyGoal: 3500 },
  ];

  const DEFAULT_PRODUCTS = [
    { id: 1, name: 'Apex Pro Suite',         price: 2999, stock: 45  },
    { id: 2, name: 'Nexus Basic',            price:  499, stock: 200 },
    { id: 3, name: 'Shield Security Add-on', price:  899, stock: 120 },
    { id: 4, name: 'Data Vault Enterprise',  price: 1999, stock:  30 },
  ];

  const DEFAULT_TEAM_GOAL = 625000;

  // Stable seeded RNG so sample data looks the same every fresh install
  function seededRng(seed) {
    const x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
  }

  function pickWeighted(items, weights, rand) {
    let cumulative = 0;
    for (let i = 0; i < items.length; i++) {
      cumulative += weights[i];
      if (rand <= cumulative) return items[i];
    }
    return items[items.length - 1];
  }

  function generateSampleLogs() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const logs = [];
    let logId = 1;

    // Each profile: { id, base, trend, variance, productWeights }
    // base = starting daily revenue (day 0), trend = $/day growth, variance = random spread
    const profiles = [
      { id: 1, base: 4100, trend: 78,  variance: 550,  prods: [0.45, 0.20, 0.18, 0.17] }, // Sarah: trending up
      { id: 2, base: 5100, trend: -25, variance: 2100, prods: [0.22, 0.38, 0.25, 0.15] }, // Marcus: volatile
      { id: 3, base: 4850, trend:  12, variance: 180,  prods: [0.28, 0.28, 0.24, 0.20] }, // Emma: rock-steady
      { id: 4, base: 6600, trend: -95, variance: 480,  prods: [0.52, 0.10, 0.18, 0.20] }, // Kai: was elite, declining
      { id: 5, base: 1400, trend:  88, variance: 520,  prods: [0.08, 0.62, 0.20, 0.10] }, // Alex: new, ramping
    ];

    for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
      const date = new Date(today);
      date.setDate(date.getDate() - daysAgo);
      const dateStr = date.toISOString().split('T')[0];
      const dayIdx = 29 - daysAgo; // 0 = oldest, 29 = today

      profiles.forEach(p => {
        const seed = p.id * 1000 + dayIdx;
        const revenue = Math.max(400,
          p.base + p.trend * dayIdx + (seededRng(seed) - 0.5) * p.variance
        );

        const numSales = seededRng(seed + 100) > 0.4 ? 2 : 1;

        if (numSales === 1) {
          const prodId = pickWeighted([1, 2, 3, 4], p.prods, seededRng(seed + 200));
          logs.push({ id: logId++, date: dateStr, personId: p.id, productId: prodId, amount: Math.round(revenue) });
        } else {
          const split = 0.35 + seededRng(seed + 300) * 0.3;
          const p1 = pickWeighted([1, 2, 3, 4], p.prods, seededRng(seed + 400));
          const p2 = pickWeighted([1, 2, 3, 4], p.prods, seededRng(seed + 500));
          logs.push({ id: logId++, date: dateStr, personId: p.id, productId: p1, amount: Math.round(revenue * split) });
          logs.push({ id: logId++, date: dateStr, personId: p.id, productId: p2, amount: Math.round(revenue * (1 - split)) });
        }
      });
    }

    return logs;
  }

  // ── persistence ────────────────────────────────────────────────────────────

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function init() {
    let state = load();
    if (!state) {
      state = {
        salespeople: DEFAULT_SALESPEOPLE,
        products: DEFAULT_PRODUCTS,
        logs: generateSampleLogs(),
        teamGoal: DEFAULT_TEAM_GOAL,
        nextLogId: 1000,
        nextPersonId: 10,
        nextProductId: 10,
      };
      save(state);
    }
    return state;
  }

  // ── derived queries ────────────────────────────────────────────────────────

  function logsUpTo(state, isoDate) {
    if (!isoDate) return state.logs;
    return state.logs.filter(l => l.date <= isoDate);
  }

  function revenueByPerson(logs, salespeople) {
    const map = {};
    salespeople.forEach(sp => { map[sp.id] = 0; });
    logs.forEach(l => { map[l.personId] = (map[l.personId] || 0) + l.amount; });
    return map;
  }

  function revenueByProduct(logs, products) {
    const map = {};
    products.forEach(p => { map[p.id] = 0; });
    logs.forEach(l => { map[l.productId] = (map[l.productId] || 0) + l.amount; });
    return map;
  }

  function dailyRevenueByPerson(logs, personId, nDays, asOf) {
    const end = asOf ? new Date(asOf) : new Date();
    end.setHours(0, 0, 0, 0);
    const series = [];
    for (let i = nDays - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const total = logs
        .filter(l => l.personId === personId && l.date === dateStr)
        .reduce((s, l) => s + l.amount, 0);
      series.push({ date: dateStr, amount: total });
    }
    return series;
  }

  function dateRange(logs) {
    if (!logs.length) return { start: null, end: null };
    const dates = logs.map(l => l.date).sort();
    return { start: dates[0], end: dates[dates.length - 1] };
  }

  function uniqueDates(logs) {
    return [...new Set(logs.map(l => l.date))].sort();
  }

  // ── mutations ──────────────────────────────────────────────────────────────

  function addLog(state, { personId, productId, amount, date }) {
    const log = {
      id: state.nextLogId++,
      date,
      personId: Number(personId),
      productId: Number(productId),
      amount: Number(amount),
    };
    state.logs.push(log);
    save(state);
    return log;
  }

  function addPerson(state, { name, dailyGoal }) {
    const person = { id: state.nextPersonId++, name, dailyGoal: Number(dailyGoal) };
    state.salespeople.push(person);
    save(state);
    return person;
  }

  function addProduct(state, { name, price, stock }) {
    const product = { id: state.nextProductId++, name, price: Number(price), stock: Number(stock) };
    state.products.push(product);
    save(state);
    return product;
  }

  function updateTeamGoal(state, goal) {
    state.teamGoal = Number(goal);
    save(state);
  }

  function reset(state) {
    const fresh = {
      salespeople: DEFAULT_SALESPEOPLE,
      products: DEFAULT_PRODUCTS,
      logs: generateSampleLogs(),
      teamGoal: DEFAULT_TEAM_GOAL,
      nextLogId: 1000,
      nextPersonId: 10,
      nextProductId: 10,
    };
    Object.assign(state, fresh);
    save(state);
  }

  return {
    init, save,
    logsUpTo, revenueByPerson, revenueByProduct,
    dailyRevenueByPerson, dateRange, uniqueDates,
    addLog, addPerson, addProduct, updateTeamGoal, reset,
  };
})();
