// warroom.js — fullscreen ops mode, confetti, Web Audio chime, countdown

SalesOS.warRoom = (() => {
  let active    = false;
  let countdownTimer = null;
  let confettiParticles = [];
  let confettiAF = null;

  // ── Entry / Exit ────────────────────────────────────────────────────────────
  function enter() {
    active = true;
    document.getElementById('war-room-overlay').classList.remove('hidden');
    document.body.classList.add('war-room-active');
    render();
    startCountdown();
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  function exit() {
    active = false;
    document.getElementById('war-room-overlay').classList.add('hidden');
    document.body.classList.remove('war-room-active');
    stopCountdown();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  // ── Rendering ───────────────────────────────────────────────────────────────
  function render() {
    if (!active) return;
    const state = SalesOS.app.getState();
    const dt    = SalesOS.data;
    const logs  = dt.logsUpTo(state, null);
    const rev   = dt.revenueByPerson(logs, state.salespeople);
    const total = Object.values(rev).reduce((s, v) => s + v, 0);
    const attPct = state.teamGoal > 0 ? (total / state.teamGoal * 100) : 0;

    animateCounter('wr-total-revenue', total, v => '$' + Math.round(v).toLocaleString());
    animateCounter('wr-attainment', attPct, v => v.toFixed(1) + '%');

    const daysLeft = SalesOS.forecast.daysLeftInMonth(null);
    document.getElementById('wr-days-remaining').textContent = daysLeft + (daysLeft === 1 ? ' DAY' : ' DAYS');

    // Leaderboard
    const ranked = state.salespeople
      .map(sp => ({ sp, total: rev[sp.id] || 0 }))
      .sort((a, b) => b.total - a.total);

    const lb = document.getElementById('wr-leaderboard');
    lb.innerHTML = ranked.map((entry, i) => {
      const pct = entry.sp.dailyGoal > 0
        ? Math.min(100, (entry.total / (entry.sp.dailyGoal * 30)) * 100)
        : 0;
      const colors = ['#EEFF41', '#FF4081', '#4DFF91', '#40C4FF', '#FF9B21'];
      const color  = colors[i % colors.length];
      return `
        <div class="wr-row ${i === 0 ? 'wr-row--leader' : ''}">
          <div class="wr-rank" style="color:${color}">${i + 1}</div>
          <div class="wr-name">${entry.sp.name}</div>
          <div class="wr-revenue" style="color:${color}">$${Math.round(entry.total).toLocaleString()}</div>
          <div class="wr-bar-wrap">
            <div class="wr-bar-fill" style="width:${pct.toFixed(1)}%;background:${color}22;border-right:2px solid ${color}"></div>
          </div>
          <div class="wr-pct">${pct.toFixed(0)}%</div>
        </div>`;
    }).join('');
  }

  function animateCounter(id, target, formatter) {
    const el = document.getElementById(id);
    if (!el) return;
    const start   = 0;
    const duration = 1200;
    const t0 = performance.now();
    function step(now) {
      const prog = Math.min(1, (now - t0) / duration);
      const ease = 1 - Math.pow(1 - prog, 3);
      el.textContent = formatter(start + (target - start) * ease);
      if (prog < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ── Countdown to end of month ────────────────────────────────────────────
  function startCountdown() {
    stopCountdown();
    updateCountdown();
    countdownTimer = setInterval(updateCountdown, 1000);
  }

  function stopCountdown() {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  function updateCountdown() {
    const now  = new Date();
    const eom  = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const diff = Math.max(0, eom - now);
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000)  / 60000);
    const s = Math.floor((diff % 60000)    / 1000);
    const el = document.getElementById('wr-countdown-timer');
    if (el) el.textContent = `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  // ── Confetti ────────────────────────────────────────────────────────────────
  function celebrate(personName, amount) {
    if (!active) return;

    // Announcement banner
    showSaleBanner(personName, amount);

    // Sound
    playChime();

    // Confetti
    const canvas = document.getElementById('confetti-canvas');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const colors = ['#EEFF41', '#FF4081', '#4DFF91', '#40C4FF', '#FF9B21', '#ffffff'];

    for (let i = 0; i < 200; i++) {
      confettiParticles.push({
        x:        Math.random() * canvas.width,
        y:        -Math.random() * 60 - 10,
        vx:       (Math.random() - 0.5) * 5,
        vy:       Math.random() * 4 + 2,
        color:    colors[Math.floor(Math.random() * colors.length)],
        w:        Math.random() * 10 + 4,
        h:        Math.random() * 5 + 3,
        rot:      Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.15,
        opacity:  1,
      });
    }

    if (confettiAF) return;
    function animateConfetti() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = confettiParticles.length - 1; i >= 0; i--) {
        const p = confettiParticles[i];
        p.x       += p.vx;
        p.y       += p.vy;
        p.vy      += 0.08;
        p.rot     += p.rotSpeed;
        p.opacity -= 0.008;
        if (p.y > canvas.height || p.opacity <= 0) { confettiParticles.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (confettiParticles.length > 0) confettiAF = requestAnimationFrame(animateConfetti);
      else { confettiAF = null; ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }
    confettiAF = requestAnimationFrame(animateConfetti);
  }

  function showSaleBanner(name, amount) {
    let banner = document.getElementById('wr-sale-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'wr-sale-banner';
      banner.className = 'wr-sale-banner';
      document.getElementById('war-room-overlay').appendChild(banner);
    }
    banner.innerHTML = `<span class="wr-banner-name">${name}</span><span class="wr-banner-amount">+$${Math.round(amount).toLocaleString()}</span>`;
    banner.classList.add('wr-banner-show');
    setTimeout(() => banner.classList.remove('wr-banner-show'), 3500);
  }

  // ── Web Audio chime ─────────────────────────────────────────────────────────
  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6

      notes.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.start(t);
        osc.stop(t + 0.6);
      });
    } catch (_) {}
  }

  // ── Events ──────────────────────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('war-room-toggle').addEventListener('click', enter);
    document.getElementById('war-room-exit').addEventListener('click', exit);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && active) exit(); });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && active) exit(); });
  }

  return { enter, exit, render, celebrate, bindEvents, isActive: () => active };
})();
