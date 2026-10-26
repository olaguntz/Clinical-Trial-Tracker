// A small stand-in for the dashboard runtime: loads the data files that the
// weekly GitHub job publishes in ./data and hands them to app.js.
(function () {
  const FILES = {
    summary: 'data/summary.json',
    refreshed: 'data/refreshed.json',
    by_status: 'data/by_status.csv',
    by_phase: 'data/by_phase.csv',
    by_year: 'data/by_year.csv',
    by_sponsor: 'data/by_sponsor.csv',
    by_country: 'data/by_country.csv',
    by_condition: 'data/by_condition.csv',
    new_week: 'data/new_week.csv',
    status_changes: 'data/status_changes.csv',
    open_trials_1: 'data/open_trials_1.csv',
    open_trials_2: 'data/open_trials_2.csv',
    open_trials_3: 'data/open_trials_3.csv',
    open_trials_4: 'data/open_trials_4.csv',
    open_trials_5: 'data/open_trials_5.csv',
  };
  const state = {};   // id -> {status, data}
  const calcs = {};   // id -> {inputs, fn}
  const listeners = [];
  let pending = false;

  function notify() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); });
  }

  function load(id) {
    if (state[id]) return;
    state[id] = { status: 'loading', data: [] };
    const url = FILES[id];
    fetch(url, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(r.status + ' ' + url); return url.endsWith('.json') ? r.json() : r.text(); })
      .then((body) => {
        let data;
        if (typeof body === 'string') data = d3.csvParse(body);
        else data = Array.isArray(body) ? body : (body.rows || body.data || body.results || []);
        state[id] = { status: 'ok', data };
        notify();
      })
      .catch((e) => { console.error(e); state[id] = { status: 'error', data: [], message: String(e) }; notify(); });
  }

  function data(id) {
    if (calcs[id]) {
      const c = calcs[id];
      const parts = c.inputs.map((i) => data(i));
      if (parts.some((p) => p.status === 'error')) return { status: 'error', data: [] };
      if (parts.some((p) => p.status !== 'ok')) return { status: 'loading', data: [] };
      if (!c.cache || c.cacheKey.some((d, i) => d !== parts[i].data)) {
        c.cacheKey = parts.map((p) => p.data);
        c.cache = c.fn(...c.cacheKey);
      }
      return { status: 'ok', data: c.cache };
    }
    if (!FILES[id]) return { status: 'missing', data: [] };
    load(id);
    return state[id];
  }

  let lastW = 0;
  window.addEventListener('resize', () => { const w = window.innerWidth; if (w !== lastW) { lastW = w; notify(); } });

  window.dash = {
    data,
    calc: (id, { inputs, fn }) => { calcs[id] = { inputs, fn }; },
    onData: (fn) => { listeners.push(fn); fn(); },
    setLink: (name) => { if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name); },
    colors: ['#2f6fdb', '#d9822b', '#2e9e6b', '#a855f7', '#e0457b', '#0ea5a4', '#8a8f98', '#c2a313'],
  };
})();
