# Sales OS — Analytics Dashboard

> Started as a Java console app to learn data structures and OOP. Rebuilt as a full web analytics platform with real statistical forecasting, time-series replay, and AI coaching.

**[Live Demo](https://parthm200.github.io/Sales-Analytics-Dashboard)**

---

## Features

### Core Dashboard
- **KPI strip** — total revenue, top performer, goal attainment %, avg close rate with trend vs prior 7 days
- **Team leaderboard** — ranked with 7-day sparklines, momentum indicators (▲/▼), and per-person goal attainment bars
- **Sales trend chart** — multi-line with 7/14/30-day range selector
- **Product analytics** — revenue donut + horizontal bar breakdown
- **Live Insights** — 6 auto-generated statistical observations (real math: streak detection, trend regression, z-score anomaly, pace projection)
- **localStorage persistence** — data survives page refresh, no backend needed

### Forecast Engine
Linear regression (`y = mx + b`) over each salesperson's daily data, projecting forward 5 days with ±1 std dev confidence band. Toggle on/off via the **FORECAST ↗** button. Also powers the "pace car" calculations in the Insights panel.

### Time Machine
A scrubber bar fixed at the bottom of the screen. Drag it left to rewind history — the entire dashboard (leaderboard, KPIs, charts, insights) updates to show the state at that date. Hit ▶ to watch the data animate forward in real time. The leaderboard reshuffles as rankings change.

### War Room Mode
One click goes fullscreen with a giant ops display — designed to run on a TV. Shows animated revenue counters, goal attainment, a countdown to end-of-month, and the full leaderboard. When a sale is logged, confetti drops and a chime fires.

### AI Coach
A slide-in chat panel powered by the Claude API. Sends your full sales context (all KPIs, per-person trends, product performance, pace projections) with every query. Ask anything: *"Why is Sarah underperforming?"* or *"What should I push this week?"* — gets actual LLM reasoning over real data, not canned responses.

---

## Setup

```bash
git clone https://github.com/yourusername/sales-analytics-dashboard
cd sales-analytics-dashboard
open index.html   # or serve with any static server
```

No build step. No npm. No framework. Pure HTML/CSS/JS + Chart.js CDN.

### AI Coach setup
Copy `js/config.example.js` to `js/config.js` and add your Anthropic API key. `config.js` is gitignored. See the example file for GitHub Actions deployment instructions.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Charts | Chart.js 4.4 |
| Fonts | JetBrains Mono + Barlow Condensed |
| Persistence | localStorage |
| Forecasting | Vanilla JS (OLS linear regression) |
| AI | Anthropic Claude API (claude-sonnet-4-6) |
| Confetti | Canvas API (no library) |
| Sound | Web Audio API (no library) |
| Hosting | GitHub Pages |

---

## Origin

The original Java version tracked salesperson performance using fixed arrays and console menus. Data structures covered: arrays, ArrayList, class encapsulation. The web rebuild keeps the same domain model (salespeople with daily goals, products with inventory) but adds persistent time-series data, statistical analytics, and a real-time ops interface on top.

See [`/java-original`](./java-original) for the source.
