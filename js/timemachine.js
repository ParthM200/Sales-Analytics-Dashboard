// timemachine.js — date scrubber, play/pause replay

SalesOS.timeMachine = (() => {
  let playing   = false;
  let playTimer = null;
  let allDates  = [];

  function init(state) {
    const dt = SalesOS.data;
    allDates = dt.uniqueDates(state.logs);
    if (!allDates.length) return;

    const scrubber = document.getElementById('tm-scrubber');
    scrubber.min   = 0;
    scrubber.max   = allDates.length - 1;
    scrubber.value = allDates.length - 1;

    document.getElementById('tm-date-start').textContent = fmtDate(allDates[0]);
    document.getElementById('tm-date-end').textContent   = fmtDate(allDates[allDates.length - 1]);
    setDisplay(allDates[allDates.length - 1], true);
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  }

  function setDisplay(isoDate, isLive) {
    const el = document.getElementById('tm-current-display');
    if (isLive) {
      el.textContent  = 'LIVE';
      el.classList.add('tm-live');
    } else {
      el.textContent  = fmtDate(isoDate);
      el.classList.remove('tm-live');
    }
  }

  function scrubTo(index) {
    const isoDate   = allDates[index];
    const isLive    = index === allDates.length - 1;
    const scrubber  = document.getElementById('tm-scrubber');
    scrubber.value  = index;
    setDisplay(isoDate, isLive);

    // Tell the app to re-render at this date
    SalesOS.app.renderAtDate(isLive ? null : isoDate);

    // Show/hide replay indicator
    document.getElementById('time-machine-bar').classList.toggle('tm-replaying', !isLive);
  }

  function play() {
    if (playing) return;
    playing = true;
    document.getElementById('tm-play').textContent = '⏸';

    // If we're already at end, reset to start
    const scrubber = document.getElementById('tm-scrubber');
    if (parseInt(scrubber.value) >= allDates.length - 1) {
      scrubber.value = 0;
    }

    playTimer = setInterval(() => {
      const scrubber = document.getElementById('tm-scrubber');
      const next     = parseInt(scrubber.value) + 1;
      if (next >= allDates.length) {
        pause();
        return;
      }
      scrubTo(next);
    }, 600);
  }

  function pause() {
    playing = false;
    clearInterval(playTimer);
    playTimer = null;
    document.getElementById('tm-play').textContent = '▶';
  }

  function goLive() {
    pause();
    const scrubber = document.getElementById('tm-scrubber');
    scrubTo(allDates.length - 1);
  }

  function bindEvents() {
    const scrubber = document.getElementById('tm-scrubber');
    scrubber.addEventListener('input', () => {
      if (playing) pause();
      scrubTo(parseInt(scrubber.value));
    });

    document.getElementById('tm-play').addEventListener('click', () => {
      playing ? pause() : play();
    });

    document.getElementById('tm-rewind').addEventListener('click', () => {
      pause();
      scrubTo(0);
    });

    document.getElementById('tm-forward').addEventListener('click', () => {
      pause();
      scrubTo(allDates.length - 1);
    });

    document.getElementById('tm-reset').addEventListener('click', goLive);
  }

  return { init, bindEvents, goLive };
})();
