// forecast.js — linear regression engine, pace-car calculations

SalesOS.forecast = (() => {
  // Ordinary least squares: y = mx + b
  function linearRegression(values) {
    const n = values.length;
    if (n < 2) return { slope: 0, intercept: values[0] || 0, r2: 0, stdErr: 0 };

    const sumX  = (n * (n - 1)) / 2;
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    const sumY  = values.reduce((s, v) => s + v, 0);
    const sumXY = values.reduce((s, v, i) => s + i * v, 0);

    const slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // R²
    const yMean    = sumY / n;
    const ssTot    = values.reduce((s, v) => s + (v - yMean) ** 2, 0);
    const ssRes    = values.reduce((s, v, i) => s + (v - (slope * i + intercept)) ** 2, 0);
    const r2       = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

    // Standard error of residuals (for confidence interval)
    const stdErr = Math.sqrt(ssRes / Math.max(1, n - 2));

    return { slope, intercept, r2, stdErr, predict: x => slope * x + intercept };
  }

  // Project forward `days` from the end of values
  function projectForward(values, days) {
    const model = linearRegression(values);
    const n = values.length;
    return Array.from({ length: days }, (_, i) => ({
      value:  model.predict(n + i),
      upper:  model.predict(n + i) + model.stdErr * 1.0,
      lower:  Math.max(0, model.predict(n + i) - model.stdErr * 1.0),
    }));
  }

  // Momentum: % change between first half and second half of a window
  function momentum7d(values) {
    if (values.length < 4) return 0;
    const recent = values.slice(-4);
    const prior  = values.slice(-8, -4);
    if (!prior.length) return 0;
    const avgRecent = recent.reduce((s, v) => s + v, 0) / recent.length;
    const avgPrior  = prior.reduce((s, v) => s + v, 0)  / prior.length;
    if (avgPrior === 0) return 0;
    return ((avgRecent - avgPrior) / avgPrior) * 100;
  }

  // Consecutive-days streak above or below a threshold
  function streak(values, threshold) {
    if (!values.length) return { count: 0, direction: 'neutral' };
    let count = 0;
    const dir = values[values.length - 1] >= threshold ? 'above' : 'below';
    for (let i = values.length - 1; i >= 0; i--) {
      const isAbove = values[i] >= threshold;
      if ((dir === 'above') === isAbove) count++;
      else break;
    }
    return { count, direction: dir };
  }

  // Days remaining in the current calendar month
  function daysLeftInMonth(asOf) {
    const d   = asOf ? new Date(asOf) : new Date();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const diff = Math.ceil((end - d) / 86400000);
    return Math.max(0, diff);
  }

  // "Pace car" — how much does each person need per remaining day to hit their period goal?
  function paceRequired(earnedSoFar, dailyGoal, daysElapsed, daysTotal) {
    const daysRemaining = daysTotal - daysElapsed;
    if (daysRemaining <= 0) return 0;
    const totalGoal  = dailyGoal * daysTotal;
    const remaining  = totalGoal - earnedSoFar;
    return Math.max(0, remaining / daysRemaining);
  }

  // Project team attainment at current pace
  function teamProjection(totalRevenueSoFar, teamGoal, daysElapsed, daysTotal) {
    if (daysElapsed === 0) return 100;
    const pace = totalRevenueSoFar / daysElapsed;
    const projected = pace * daysTotal;
    return (projected / teamGoal) * 100;
  }

  return { linearRegression, projectForward, momentum7d, streak, daysLeftInMonth, paceRequired, teamProjection };
})();
