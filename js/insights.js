// insights.js — real statistical insight generation (no fake AI, actual math)

SalesOS.insights = (() => {
  const fc = () => SalesOS.forecast;
  const dt = () => SalesOS.data;

  function fmt(n) { return '$' + Math.round(n).toLocaleString(); }
  function pct(n)  { return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'; }

  function generate(state, asOf) {
    const logs     = dt().logsUpTo(state, asOf);
    const people   = state.salespeople;
    const products = state.products;
    const dates    = dt().uniqueDates(logs);
    const nDays    = dates.length || 1;
    const today    = asOf || (dates[dates.length - 1] ?? new Date().toISOString().split('T')[0]);
    const insights = [];

    // ── per-person stats ──────────────────────────────────────────────────────
    const personStats = people.map(sp => {
      const series = dt().dailyRevenueByPerson(logs, sp.id, Math.min(nDays, 30), today);
      const values = series.map(d => d.amount);
      const total  = values.reduce((s, v) => s + v, 0);
      const mom    = fc().momentum7d(values);
      const str    = fc().streak(values.slice(-14), sp.dailyGoal);
      const reg    = fc().linearRegression(values);

      return { sp, values, total, mom, streak: str, reg };
    });

    personStats.sort((a, b) => b.total - a.total);

    // ── team totals ───────────────────────────────────────────────────────────
    const totalRevenue = personStats.reduce((s, ps) => s + ps.total, 0);
    const teamPace     = totalRevenue / nDays;
    const daysInMonth  = 30;
    const projectedPct = fc().teamProjection(totalRevenue, state.teamGoal, nDays, daysInMonth);

    // ── product stats ─────────────────────────────────────────────────────────
    const revByProduct = dt().revenueByProduct(logs, products);
    const productMom   = products.map(p => {
      const recent  = logs.filter(l => l.productId === p.id && l.date >= dates[Math.max(0, dates.length - 4)]);
      const prior   = logs.filter(l => l.productId === p.id && l.date < dates[Math.max(0, dates.length - 4)]);
      const rRev = recent.reduce((s, l) => s + l.amount, 0);
      const pRev  = prior.reduce((s, l) => s + l.amount, 0);
      const mom    = pRev > 0 ? ((rRev - pRev / Math.max(1, dates.length - 4) * 4) / (pRev / Math.max(1, dates.length - 4) * 4)) * 100 : 0;
      return { p, total: revByProduct[p.id] || 0, mom };
    });
    productMom.sort((a, b) => b.total - a.total);

    // ── insight: top performer ────────────────────────────────────────────────
    const top = personStats[0];
    if (top) {
      insights.push({
        type: 'winner',
        icon: '★',
        text: `${top.sp.name} leads with ${fmt(top.total)} — ${((top.total / (totalRevenue || 1)) * 100).toFixed(0)}% of total team revenue.`,
        priority: 10,
      });
    }

    // ── insight: highest momentum person ─────────────────────────────────────
    const rising = [...personStats].sort((a, b) => b.mom - a.mom)[0];
    if (rising && Math.abs(rising.mom) > 5) {
      const dir = rising.mom > 0 ? 'up' : 'down';
      insights.push({
        type: dir === 'up' ? 'up' : 'down',
        icon: dir === 'up' ? '↑' : '↓',
        text: `${rising.sp.name}'s sales are ${dir} ${Math.abs(rising.mom).toFixed(0)}% over the past 7 days — ${dir === 'up' ? 'highest momentum on the team.' : 'needs attention.'}`,
        priority: rising.mom > 15 ? 9 : 6,
      });
    }

    // ── insight: streak ───────────────────────────────────────────────────────
    const bestStreak = [...personStats].sort((a, b) => (b.streak.direction === 'above' ? b.streak.count : -b.streak.count) - (a.streak.direction === 'above' ? a.streak.count : -a.streak.count))[0];
    if (bestStreak && bestStreak.streak.count >= 3 && bestStreak.streak.direction === 'above') {
      insights.push({
        type: 'up',
        icon: '⚡',
        text: `${bestStreak.sp.name} is on a ${bestStreak.streak.count}-day streak above daily goal — strongest consistency this period.`,
        priority: 8,
      });
    }

    // ── insight: struggling person with alert ────────────────────────────────
    const declining = [...personStats].filter(ps => ps.streak.direction === 'below' && ps.streak.count >= 3);
    if (declining.length) {
      const worst = declining.sort((a, b) => b.streak.count - a.streak.count)[0];
      insights.push({
        type: 'alert',
        icon: '⚠',
        text: `${worst.sp.name} has missed daily goal ${worst.streak.count} days in a row. Last ${worst.streak.count}-day average: ${fmt(worst.values.slice(-worst.streak.count).reduce((s, v) => s + v, 0) / worst.streak.count)} vs ${fmt(worst.sp.dailyGoal)} goal.`,
        priority: 9,
      });
    }

    // ── insight: team pace projection ────────────────────────────────────────
    const projStr = projectedPct > 100
      ? `on pace to exceed monthly goal by ${(projectedPct - 100).toFixed(0)}%`
      : `on pace to hit ${projectedPct.toFixed(0)}% of monthly goal`;
    insights.push({
      type: projectedPct >= 100 ? 'up' : 'alert',
      icon: projectedPct >= 100 ? '↑' : '⚠',
      text: `At current pace (${fmt(teamPace * 30)} projected), the team is ${projStr} of ${fmt(state.teamGoal)}.`,
      priority: 7,
    });

    // ── insight: product declining ────────────────────────────────────────────
    const worstProduct = [...productMom].sort((a, b) => a.mom - b.mom)[0];
    if (worstProduct && worstProduct.mom < -10) {
      insights.push({
        type: 'down',
        icon: '↓',
        text: `${worstProduct.p.name} revenue is down ${Math.abs(worstProduct.mom).toFixed(0)}% vs prior period — consider a pricing or positioning review.`,
        priority: 6,
      });
    }

    // ── insight: fastest growing (regression slope) ───────────────────────────
    const fastestGrowing = [...personStats].sort((a, b) => b.reg.slope - a.reg.slope)[0];
    if (fastestGrowing && fastestGrowing.reg.slope > 50) {
      const projEnd = fastestGrowing.reg.predict(daysInMonth - 1) * daysInMonth;
      insights.push({
        type: 'up',
        icon: '↗',
        text: `${fastestGrowing.sp.name} has the steepest growth curve (+${fmt(fastestGrowing.reg.slope)}/day). Regression projects ${fmt(projEnd)} total by period end.`,
        priority: 7,
      });
    }

    return insights.sort((a, b) => b.priority - a.priority).slice(0, 6);
  }

  return { generate };
})();
