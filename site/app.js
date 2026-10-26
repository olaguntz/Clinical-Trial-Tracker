(function () {
  const I = window.CT_I18N;
  const L = window.CT_LABELS;
  const LANGS = ['en', 'es', 'fr'];
  const OPEN = ['RECRUITING', 'NOT_YET_RECRUITING', 'ENROLLING_BY_INVITATION'];
  const PHASES = ['Early phase 1', 'Phase 1', 'Phase 1 / Phase 2', 'Phase 2', 'Phase 2 / Phase 3', 'Phase 3', 'Phase 4', 'Not applicable', 'Observational / other'];
  const PAGE_SIZE = 100;
  const root = document.querySelector('.ct');
  let lang = 'en';
  let tab = 'overview';
  let finderMounted = false;

  // The open-studies list is published in five parts; this joins them.
  dash.calc('open_trials', {
    inputs: ['open_trials_1', 'open_trials_2', 'open_trials_3', 'open_trials_4', 'open_trials_5'],
    fn: (open_trials_1, open_trials_2, open_trials_3, open_trials_4, open_trials_5) =>
      [].concat(open_trials_1, open_trials_2, open_trials_3, open_trials_4, open_trials_5),
    title: 'Open studies, all parts',
    description: 'The five parts of the list of studies open to new participants, joined into one list.',
  });

  // ---------- helpers ----------
  const tr = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), I[lang]);
  const lab = (kind, code) => { const e = L[kind][code]; return e ? e[LANGS.indexOf(lang)] : code; };
  const fmt = (n) => new Intl.NumberFormat(lang).format(Number(n));
  const fmtCompact = (n) => new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n));
  const fmtDate = (d) => { const x = new Date(String(d).slice(0, 10) + 'T00:00:00Z'); return isNaN(x) ? String(d || '') : x.toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const studyUrl = (id) => 'https://clinicaltrials.gov/study/' + encodeURIComponent(id);
  const get = (id) => dash.data(id);
  const rowsOf = (id) => { const d = get(id); return d.status === 'ok' && Array.isArray(d.data) ? d.data : []; };

  function failed(box) { box.replaceChildren(el('div', 'ct-fail', 'Failed to load')); }

  function applyText(scope) {
    scope.querySelectorAll('[data-t]').forEach((n) => {
      const v = tr(n.dataset.t);
      if (typeof v === 'string') n.textContent = v;
    });
  }

  // ---------- header ----------
  function drawHeader() {
    root.querySelector('#ct-title').textContent = tr('title');
    root.querySelector('#ct-disclaimer').textContent = tr('disclaimer');
    root.querySelector('.ct-lang-label').textContent = tr('lang_label');
    const parts = tr('takeaway')({ total: '\u0001', open: '\u0001', countries: '\u0001' }).split('\u0001');
    ['a', 'b', 'c', 'd'].forEach((k, i) => { root.querySelector('.ct-tk-' + k).textContent = parts[i] || ''; });
    const rf = tr('refreshed')('\u0001').split('\u0001');
    root.querySelector('.ct-rf-a').textContent = rf[0] || '';
    root.querySelector('.ct-rf-b').textContent = rf[1] || '';
    const r = get('refreshed');
    const dateEl = root.querySelector('.ct-rf-date');
    dateEl.textContent = r.status === 'ok' && r.data[0] ? fmtDate(r.data[0].refreshed) : '—';
    root.querySelectorAll('.ct-tab').forEach((b) => {
      b.textContent = tr('tabs.' + b.dataset.tab);
      b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    });
  }

  // ---------- summary numbers ----------
  function drawSummary() {
    const s = get('summary');
    root.querySelectorAll('[data-source="summary"][data-where]').forEach((n) => {
      const metric = n.dataset.where.split('=')[1];
      if (s.status === 'ok') {
        const row = s.data.find((r) => r.metric === metric);
        n.textContent = row ? fmt(row.value) : '—';
        n.classList.remove('dash-skeleton');
      } else if (s.status === 'error') {
        n.textContent = '—';
        n.classList.remove('dash-skeleton');
      } else {
        n.textContent = '—';
      }
    });
  }

  // ---------- charts ----------
  function tipFor(box) {
    let tip = box.querySelector('.ct-tip');
    if (!tip) { tip = el('div', 'ct-tip'); tip.hidden = true; box.appendChild(tip); }
    return tip;
  }
  function showTip(box, tip, event, head, lines) {
    tip.replaceChildren(el('div', 'ct-tip-h', head));
    lines.forEach(([color, name, value]) => {
      const line = el('div');
      if (color) { const sw = el('span'); sw.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:${color}`; line.appendChild(sw); }
      line.appendChild(document.createTextNode((name ? name + ': ' : '') + value));
      tip.appendChild(line);
    });
    tip.hidden = false;
    const b = box.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = event.clientX - b.left + 12, y = event.clientY - b.top - th - 8;
    if (x + tw > b.width) x = Math.max(0, event.clientX - b.left - tw - 12);
    if (y < 0) y = event.clientY - b.top + 16;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }

  function textWidth(svg, s) {
    const n = svg.append('text').text(s);
    const w = n.node().getComputedTextLength();
    n.remove();
    return w;
  }
  function fitText(svg, s, max) {
    if (textWidth(svg, s) <= max) return s;
    let lo = 0, hi = s.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (textWidth(svg, s.slice(0, mid) + '…') <= max) lo = mid; else hi = mid - 1; }
    return s.slice(0, lo) + '…';
  }

  // Horizontal bars. items: [{label, value, value2?}] — value2 is drawn over value.
  function hbar(box, items, names) {
    box.replaceChildren();
    const W = Math.max(260, box.clientWidth);
    const barH = 20, gap = 10, H = items.length * (barH + gap);
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const maxLab = d3.max(items, (d) => textWidth(svg, d.label)) || 0;
    const labW = Math.min(maxLab + 10, W * 0.55);
    const maxV = d3.max(items, (d) => d.value) || 1;
    const valW = textWidth(svg, fmtCompact(maxV)) + 12;
    const x = d3.scaleLinear([0, maxV], [0, Math.max(20, W - labW - valW)]);
    const two = items.some((d) => d.value2 != null);
    const c0 = dash.colors[0];
    const rows = svg.selectAll('g.ct-row').data(items).join('g').attr('class', 'ct-row')
      .attr('transform', (d, i) => `translate(0,${i * (barH + gap)})`);
    rows.append('text').attr('class', 'ct-lbl').attr('x', labW - 10).attr('y', barH / 2).attr('dy', '0.35em')
      .attr('text-anchor', 'end').text((d) => fitText(svg, d.label, labW - 10));
    rows.append('rect').attr('x', labW).attr('y', 0).attr('height', barH).attr('rx', 4)
      .attr('width', (d) => Math.max(2, x(d.value)))
      .style('fill', two ? 'var(--cds-chart-muted)' : c0);
    if (two) {
      rows.append('rect').attr('x', labW).attr('y', 0).attr('height', barH).attr('rx', 4)
        .attr('width', (d) => (d.value2 ? Math.max(2, x(d.value2)) : 0)).style('fill', c0);
    }
    rows.append('text').attr('x', (d) => labW + Math.max(2, x(d.value)) + 6).attr('y', barH / 2).attr('dy', '0.35em')
      .text((d) => fmtCompact(d.value));
    rows.append('rect').attr('x', 0).attr('y', -gap / 2).attr('width', W).attr('height', barH + gap).style('fill', 'transparent')
      .on('mousemove', (event, d) => {
        const lines = two
          ? [['var(--cds-chart-muted)', names[0], fmt(d.value)], [c0, names[1], fmt(d.value2 || 0)]]
          : [[null, null, fmt(d.value) + ' ' + tr('tip_trials')]];
        showTip(box, tipFor(box), event, d.label, lines);
      })
      .on('mouseleave', () => { tipFor(box).hidden = true; });
  }

  // Vertical bars by year.
  function vbar(box, items) {
    box.replaceChildren();
    const W = Math.max(260, box.clientWidth), H = 220;
    const svg = d3.select(box).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const maxV = d3.max(items, (d) => d.value) || 1;
    const y = d3.scaleLinear([0, maxV], [H - 24, 8]).nice();
    const ticks = y.ticks(4);
    const left = d3.max(ticks, (t) => textWidth(svg, fmtCompact(t))) + 8;
    const x = d3.scaleBand(items.map((d) => d.label), [left, W - 4]).padding(0.25);
    svg.append('g').selectAll('line').data(ticks).join('line')
      .attr('x1', left).attr('x2', W - 4).attr('y1', (t) => y(t)).attr('y2', (t) => y(t))
      .style('stroke', 'var(--cds-chart-grid)');
    svg.append('g').selectAll('text').data(ticks).join('text')
      .attr('x', left - 6).attr('y', (t) => y(t)).attr('dy', '0.35em').attr('text-anchor', 'end').text((t) => fmtCompact(t));
    const step = Math.ceil(items.length / Math.max(2, Math.floor((W - left) / 44)));
    svg.append('g').selectAll('text').data(items.filter((d, i) => (items.length - 1 - i) % step === 0)).join('text')
      .attr('x', (d) => x(d.label) + x.bandwidth() / 2).attr('y', H - 6).attr('text-anchor', 'middle').text((d) => d.label);
    svg.append('g').selectAll('rect').data(items).join('rect')
      .attr('x', (d) => x(d.label)).attr('width', x.bandwidth()).attr('y', (d) => y(d.value))
      .attr('height', (d) => Math.max(0, y(0) - y(d.value))).attr('rx', 3).style('fill', dash.colors[0]);
    svg.append('g').selectAll('rect').data(items).join('rect')
      .attr('x', (d) => x(d.label) - (x.step() * x.padding()) / 2).attr('width', x.step()).attr('y', 0).attr('height', H)
      .style('fill', 'transparent')
      .on('mousemove', (event, d) => showTip(box, tipFor(box), event, d.label, [[null, null, fmt(d.value) + ' ' + tr('tip_trials')]]))
      .on('mouseleave', () => { tipFor(box).hidden = true; });
  }

  function chart(id, datasetId, draw) {
    const box = root.querySelector('#' + id);
    const d = get(datasetId);
    if (d.status === 'ok') draw(box, d.data);
    else if (d.status === 'error') failed(box);
    else box.replaceChildren();
  }

  function drawOverview() {
    chart('chart-status', 'by_status', (box, rows) =>
      hbar(box, rows.map((r) => ({ label: lab('status', r.status), value: Number(r.trials) }))));
    chart('chart-phase', 'by_phase', (box, rows) =>
      hbar(box, rows.map((r) => ({ label: lab('phase', r.phase), value: Number(r.trials) }))));
    chart('chart-year', 'by_year', (box, rows) =>
      vbar(box, rows.map((r) => ({ label: String(r.year), value: Number(r.trials) }))));
    chart('chart-sponsor', 'by_sponsor', (box, rows) =>
      hbar(box, rows.filter((r) => Number(r.trials) > 0).map((r) => ({ label: lab('sponsor', r.sponsor_type), value: Number(r.trials) }))));
  }

  // ---------- tables ----------
  function fillTable(table, rows, cells, limit) {
    const tbody = table.querySelector('tbody');
    const frag = document.createDocumentFragment();
    rows.slice(0, limit).forEach((r) => {
      const trEl = el('tr');
      cells.forEach((c) => {
        const td = el('td', c.cls || '');
        c.fill(td, r);
        trEl.appendChild(td);
      });
      frag.appendChild(trEl);
    });
    tbody.replaceChildren(frag);
  }
  const idCell = { fill: (td, r) => { const a = el('a', null, r.id); a.href = studyUrl(r.id); a.target = '_blank'; a.rel = 'noopener'; a.title = tr('view_registry'); td.appendChild(a); } };
  const textCell = (k, cls) => ({ cls, fill: (td, r) => { td.textContent = r[k] || ''; } });
  const numCell = (k) => ({ cls: 'ct-num', fill: (td, r) => { td.textContent = fmt(r[k]); } });
  const statusCell = (k) => ({ fill: (td, r) => { const p = el('span', 'ct-pill' + (OPEN.includes(r[k]) ? ' ct-open' : ''), lab('status', r[k])); td.appendChild(p); } });
  const titleCell = { fill: (td, r) => { td.appendChild(el('div', 'ct-t', r.title)); } };

  function searchFilter(rows, input, keys) {
    const q = (input.value || '').trim().toLowerCase();
    if (!q) return rows;
    const words = q.split(/\s+/);
    return rows.filter((r) => { const h = keys.map((k) => String(r[k] || '')).join(' ').toLowerCase(); return words.every((w) => h.includes(w)); });
  }

  function drawPlaces() {
    chart('chart-countries', 'by_country', (box, rows) =>
      hbar(box, rows.slice(0, 20).map((r) => ({ label: r.country, value: Number(r.trials), value2: Number(r.open_trials) })),
        [tr('col.trials'), tr('col.open_trials')]));
    const ct = root.querySelector('.ct-country-table');
    const cs = root.querySelector('.ct-search-country');
    cs.placeholder = tr('f.search_table');
    fillTable(ct, searchFilter(rowsOf('by_country'), cs, ['country']), [textCell('country'), numCell('trials'), numCell('open_trials')], 400);
    const dt = root.querySelector('.ct-condition-table');
    const ds = root.querySelector('.ct-search-condition');
    ds.placeholder = tr('f.search_table');
    fillTable(dt, searchFilter(rowsOf('by_condition'), ds, ['condition']), [textCell('condition'), numCell('trials'), numCell('open_trials')], 400);
  }

  function drawWeek() {
    const ns = root.querySelector('.ct-search-new');
    ns.placeholder = tr('f.search_table');
    fillTable(root.querySelector('.ct-new-table'), searchFilter(rowsOf('new_week'), ns, ['id', 'title', 'conditions']),
      [idCell, titleCell, statusCell('status'), { cls: 'ct-hide-narrow', fill: (td, r) => { td.textContent = fmtDate(r.first_posted); } }], 2000);
    const s = get('summary');
    const compared = s.status === 'ok' && (s.data.find((r) => r.metric === 'compared') || {}).value;
    root.querySelector('.ct-changes-first').hidden = !(s.status === 'ok' && !compared);
    root.querySelector('.ct-changes-wrap').hidden = s.status === 'ok' && !compared;
    fillTable(root.querySelector('.ct-changes-table'), rowsOf('status_changes'),
      [idCell, titleCell, statusCell('from_status'), statusCell('to_status')], 2000);
  }

  function drawLearn() {
    const box = root.querySelector('#card-learn');
    box.replaceChildren();
    tr('learn').forEach(([kind, v]) => {
      if (kind === 'h') box.appendChild(el('h2', null, v));
      else if (kind === 'p') box.appendChild(el('p', null, v));
      else { const ul = el('ul'); v.forEach((x) => ul.appendChild(el('li', null, x))); box.appendChild(ul); }
    });
    box.appendChild(el('p', 'ct-note', tr('disclaimer')));
  }

  // ---------- trial finder ----------
  const F = { q: '', country: '', status: '', phase: '', age: '', sex: '', hv: false, limit: PAGE_SIZE };
  let fSrc = null, fIdx = [];
  const ageYears = (s) => {
    const m = /([\d.]+)\s*(year|month|week|day|hour|minute)/i.exec(s || '');
    if (!m) return null;
    const n = Number(m[1]), u = m[2].toLowerCase();
    return u === 'year' ? n : u === 'month' ? n / 12 : u === 'week' ? n / 52 : u === 'day' ? n / 365 : n / 8760;
  };
  function prep(rows) {
    if (fSrc === rows) return;
    fSrc = rows;
    fIdx = rows.map((r) => ({
      r,
      h: (r.title + ' ' + r.conditions + ' ' + r.id).toLowerCase(),
      c: '; ' + r.countries + ';',
      amin: ageYears(r.min_age),
      amax: ageYears(r.max_age),
    }));
  }
  function matchRows() {
    const words = F.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const age = F.age === '' ? null : Number(F.age);
    const cc = F.country ? '; ' + F.country + ';' : '';
    return fIdx.filter((x) => {
      const r = x.r;
      if (F.status && r.status !== F.status) return false;
      if (F.phase && r.phase !== F.phase) return false;
      if (F.sex && r.sex !== 'ALL' && r.sex !== F.sex) return false;
      if (F.hv && r.healthy_volunteers !== 'Yes') return false;
      if (cc && !x.c.includes(cc)) return false;
      if (age != null && !isNaN(age)) {
        if (x.amin != null && age < x.amin) return false;
        if (x.amax != null && age > x.amax) return false;
      }
      return words.every((w) => x.h.includes(w));
    }).map((x) => x.r);
  }

  function mountFinder() {
    const page = root.querySelector('#page-finder');
    page.appendChild(root.querySelector('#tpl-finder').content.cloneNode(true));
    finderMounted = true;
    const $ = (s) => page.querySelector(s);
    let timer = null;
    $('.ct-f-q').addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { F.q = e.target.value; F.limit = PAGE_SIZE; drawFinder(); }, 200); });
    $('.ct-f-country').addEventListener('change', (e) => { F.country = e.target.value; F.limit = PAGE_SIZE; drawFinder(); });
    $('.ct-f-status').addEventListener('change', (e) => { F.status = e.target.value; F.limit = PAGE_SIZE; drawFinder(); });
    $('.ct-f-phase').addEventListener('change', (e) => { F.phase = e.target.value; F.limit = PAGE_SIZE; drawFinder(); });
    $('.ct-f-sex').addEventListener('change', (e) => { F.sex = e.target.value; F.limit = PAGE_SIZE; drawFinder(); });
    $('.ct-f-hv').addEventListener('change', (e) => { F.hv = e.target.checked; F.limit = PAGE_SIZE; drawFinder(); });
    $('.ct-f-age').addEventListener('change', (e) => {
      const v = e.target.value;
      F.age = v !== '' && e.target.validity.valid ? v : '';
      F.limit = PAGE_SIZE; drawFinder();
    });
    $('.ct-f-more').addEventListener('click', () => { F.limit += PAGE_SIZE; drawFinder(); });
    $('.ct-f-reset').addEventListener('click', () => {
      Object.assign(F, { q: '', country: '', status: '', phase: '', age: '', sex: '', hv: false, limit: PAGE_SIZE });
      $('.ct-f-q').value = ''; $('.ct-f-age').value = ''; $('.ct-f-hv').checked = false;
      drawFinder();
    });
  }

  function setOptions(sel, opts, value) {
    sel.replaceChildren(...opts.map(([v, text]) => new Option(text, v)));
    sel.value = value;
  }

  function drawFinder() {
    if (!finderMounted) return;
    const page = root.querySelector('#page-finder');
    const $ = (s) => page.querySelector(s);
    applyText(page);
    $('.ct-f-q').placeholder = tr('f.search');
    const countries = rowsOf('by_country').filter((r) => Number(r.open_trials) > 0).map((r) => r.country).sort((a, b) => a.localeCompare(b));
    setOptions($('.ct-f-country'), [['', tr('f.any_country')], ...countries.map((c) => [c, c])], F.country);
    setOptions($('.ct-f-status'), [['', tr('f.any_status')], ...OPEN.map((s) => [s, lab('status', s)])], F.status);
    setOptions($('.ct-f-phase'), [['', tr('f.any_phase')], ...PHASES.map((p) => [p, lab('phase', p)])], F.phase);
    setOptions($('.ct-f-sex'), [['', tr('f.any_sex')], ['FEMALE', tr('sex.FEMALE')], ['MALE', tr('sex.MALE')]], F.sex);

    const all = 'https://clinicaltrials.gov/search?' + new URLSearchParams(Object.assign({}, F.q.trim() ? { term: F.q.trim() } : {}, F.country ? { country: F.country } : {})).toString();
    $('.ct-f-all').href = all;

    const d = get('open_trials');
    const table = $('.ct-finder-table');
    const count = $('.ct-f-count');
    const more = $('.ct-f-more');
    if (d.status !== 'ok') {
      table.querySelector('tbody').replaceChildren();
      more.hidden = true;
      if (d.status === 'error') { count.replaceChildren(el('span', 'ct-fail', 'Failed to load')); }
      else count.textContent = tr('loading_finder');
      return;
    }
    prep(d.data);
    const rows = matchRows();
    const shown = Math.min(rows.length, F.limit);
    count.textContent = rows.length ? tr('matches')(fmt(rows.length), fmt(shown), shown < rows.length) : tr('no_match');
    more.hidden = shown >= rows.length;
    fillTable(table, rows, [
      idCell,
      { fill: (td, r) => { td.appendChild(el('div', 'ct-t', r.title)); } },
      statusCell('status'),
      { cls: 'ct-hide-narrow', fill: (td, r) => { td.textContent = lab('phase', r.phase); } },
      { cls: 'ct-hide-narrow', fill: (td, r) => { const div = el('div', null, r.countries); div.style.cssText = 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:22rem'; td.appendChild(div); } },
    ], shown);
  }

  // ---------- tabs and language ----------
  function showTab(name) {
    if (!['overview', 'finder', 'places', 'week', 'learn'].includes(name)) return;
    tab = name;
    root.querySelectorAll('.ct-page').forEach((p) => { p.hidden = p.dataset.page !== name; });
    if (name === 'finder' && !finderMounted) mountFinder();
    dash.setLink(name);
    draw();
  }
  root.querySelectorAll('.ct-tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  root.querySelector('.ct-lang-select').addEventListener('change', (e) => {
    lang = LANGS.includes(e.target.value) ? e.target.value : 'en';
    root.setAttribute('lang', lang);
    document.documentElement.lang = lang;
    draw();
  });
  ['.ct-search-country', '.ct-search-condition', '.ct-search-new'].forEach((s) =>
    root.querySelector(s).addEventListener('input', () => draw()));

  function draw() {
    applyText(root);
    drawHeader();
    drawSummary();
    if (tab === 'overview') drawOverview();
    if (tab === 'places') drawPlaces();
    if (tab === 'week') drawWeek();
    if (tab === 'learn') drawLearn();
    if (tab === 'finder') drawFinder();
  }

  // Start in the visitor's browser language when it is Spanish or French.
  const pref = (navigator.language || 'en').slice(0, 2).toLowerCase();
  if (LANGS.includes(pref)) { lang = pref; root.querySelector('.ct-lang-select').value = pref; document.documentElement.lang = pref; }

  dash.onData(draw);
  const named = (location.hash || '').slice(1);
  if (named) showTab(named);
})();
