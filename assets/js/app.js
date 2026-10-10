/* OpsLog — views, routing and UI wiring. */
(function (WL) {
  'use strict';
  const { U, Store, Categories, Parser, Reports, Charts, Agent, Voice } = WL;
  const $ = U.$, $$ = U.$$;

  const ROUTES = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'log', label: 'Work Log', icon: 'log' },
    { id: 'tasks', label: 'Tasks & Jobs', icon: 'tasks' },
    { id: 'reports', label: 'Reports', icon: 'reports' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];
  const STATUS = { open: 'Open', 'in-progress': 'In progress', blocked: 'Blocked', done: 'Done' };
  const ui = { route: 'dashboard', report: { kind: 'week', anchor: new Date() }, log: { q: '', cat: '', type: '', status: '', period: 'month' } };

  /* ---------------- helpers ---------------- */
  const chip = (id) => { const c = Categories.get(id); return `<span class="chip" style="--cat:${c.color}">${U.esc(c.name)}</span>`; };
  const prBadge = (p) => (p === 'critical' || p === 'high' ? `<span class="badge badge-${p}">${p}</span>` : '');
  const stBadge = (s) => `<span class="badge st-${s}">${STATUS[s] || s}</span>`;
  const card = (title, body, { cls = '', actions = '' } = {}) => `<article class="card ${cls}"><header class="card-head"><h3>${title}</h3>${actions}</header><div class="card-body">${body}</div></article>`;
  const empty = (msg, cta = '') => `<div class="empty"><div class="empty-ico">${U.icon('spark')}</div><p>${msg}</p>${cta}</div>`;
  const greetWord = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

  function entryRow(e, { showDate = false } = {}) {
    const t = Reports.entryTime(e);
    return `<div class="row-item" data-id="${e.id}">
      <div class="ri-time mono">${showDate ? `${t.getDate()} ${U.MONTHS_SHORT[t.getMonth()]}<br>` : ''}${U.fmtTime(t)}</div>
      <div class="ri-dot" style="--cat:${Categories.get(e.category).color}"></div>
      <div class="ri-main">
        <div class="ri-title">${U.safe(e.title)}</div>
        <div class="ri-meta">${chip(e.category)}${e.type !== 'entry' ? `<span class="badge">${e.type}</span>` : ''}${e.status !== 'done' ? stBadge(e.status) : ''}${prBadge(e.priority)}
          ${e.minutes ? `<span class="meta">${U.icon('clock')}${U.fmtDuration(e.minutes)}</span>` : ''}${e.ticket ? `<span class="meta mono">${U.safe(e.ticket)}</span>` : ''}
          ${e.source === 'call' || e.source === 'voice' ? `<span class="meta" title="Captured by voice">${U.icon('mic')}</span>` : ''}</div>
      </div>
      <div class="ri-actions"><button class="icon-btn sm" data-edit="${e.id}" title="Edit">${U.icon('edit')}</button></div>
    </div>`;
  }

  function taskCard(e) {
    const overdue = e.due && e.due < U.ymd(new Date()) && e.status !== 'done';
    return `<div class="task-card" draggable="true" data-id="${e.id}" style="--cat:${Categories.get(e.category).color}">
      <div class="tc-top">${chip(e.category)}${prBadge(e.priority)}${e.type === 'job' ? '<span class="badge">job</span>' : ''}</div>
      <div class="tc-title" data-edit="${e.id}">${U.safe(e.title)}</div>
      <div class="tc-foot">${e.due ? `<span class="meta ${overdue ? 'overdue' : ''}">${U.icon('clock')}${U.relDay(U.parseYmd(e.due))}</span>` : '<span></span>'}
        ${e.status !== 'done' ? `<button class="icon-btn sm ok" data-done="${e.id}" title="Mark done">${U.icon('check')}</button>` : ''}</div>
    </div>`;
  }

  function streak() {
    const days = new Set(Store.entries.map((e) => U.ymd(new Date(e.when))));
    let n = 0;
    let d = U.startOfDay(new Date());
    if (!days.has(U.ymd(d))) d = U.addDays(d, -1);
    for (let i = 0; i < 800; i++, d = U.addDays(d, -1)) {
      if (!Agent.slotsFor(d).length) continue; // skip non-working days
      if (days.has(U.ymd(d))) n++; else break;
    }
    return n;
  }

  function nextCallText() {
    if (!Store.settings.agentEnabled) return { big: 'Paused', small: 'Check-in calls are off' };
    const n = Agent.nextSlot();
    if (!n) return { big: '—', small: 'No schedule configured' };
    const mins = Math.round((n - new Date()) / 60000);
    const when = U.sameDay(n, new Date()) ? U.fmtTime(n) : `${U.relDay(n) === 'Tomorrow' ? 'Tomorrow' : U.DAYS_SHORT[n.getDay()]} ${U.fmtTime(n)}`;
    const rel = mins < 60 ? `in ${mins} min` : mins < 60 * 24 ? `in ${Math.floor(mins / 60)}h ${mins % 60}m` : `in ${Math.round(mins / 1440)} day(s)`;
    return { big: when, small: rel };
  }

  /* ---------------- shell ---------------- */
  function renderShell() {
    const nav = ROUTES.map((r) => `<a href="#/${r.id}" data-route="${r.id}">${U.icon(r.icon)}<span>${r.label}</span></a>`).join('');
    $('#nav').innerHTML = nav;
    $('#bottomNav').innerHTML = nav;
    $('#btnNew').innerHTML = `${U.icon('plus')}<span class="hide-xs">New entry</span>`;
    $('#btnQuickVoice').innerHTML = `${U.icon('mic')}<span>Dictate</span>`;
    $('#fabCall').innerHTML = U.icon('phone');
    $('#btnAnswer').innerHTML = U.icon('phone');
    $('#btnDecline').innerHTML = U.icon('phoneOff');
    $('#btnSnooze').innerHTML = U.icon('snooze');
    $('#btnEnd').innerHTML = U.icon('phoneOff');
    $('#btnKeyboard').innerHTML = U.icon('keyboard');
    $('#callSend').innerHTML = U.icon('send');
    $('#fMic').innerHTML = U.icon('mic');
    $$('[data-close]').forEach((b) => { if (!b.textContent.trim()) b.innerHTML = U.icon('x'); });
    paintToggles();
  }

  function paintToggles() {
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    $('#btnTheme').innerHTML = U.icon(dark ? 'sun' : 'moon');
    $('#btnShowcase').innerHTML = U.icon(Store.settings.showcase ? 'eyeOff' : 'eye');
    $('#btnShowcase').classList.toggle('active', !!Store.settings.showcase);
  }

  function renderSideNext() {
    const n = nextCallText();
    const working = Agent.isWorkingNow();
    $('#sideNext').innerHTML = `
      <div class="sn-label">${U.icon('bell')} Next check-in call</div>
      <div class="sn-big">${n.big}</div>
      <div class="sn-small">${n.small} · <span class="dot-status ${working ? 'on' : ''}"></span>${working ? 'On shift' : 'Off shift'}</div>
      <button class="btn btn-primary block" data-call>${U.icon('phone')} Call assistant</button>`;
  }

  function setActiveNav() {
    $$('[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === ui.route));
  }

  function route() {
    const id = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'dashboard';
    ui.route = ROUTES.some((r) => r.id === id) ? id : 'dashboard';
    setActiveNav();
    render();
    $('#view').focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }

  function render() {
    const r = ROUTES.find((x) => x.id === ui.route);
    $('#pageTitle').textContent = r.label;
    const v = $('#view');
    const views = { dashboard: viewDashboard, log: viewLog, tasks: viewTasks, reports: viewReports, settings: viewSettings };
    v.innerHTML = views[ui.route]();
    v.className = `view view-${ui.route}`;
    afterRender[ui.route] && afterRender[ui.route]();
    renderSideNext();
  }

  /* ---------------- Dashboard ---------------- */
  function viewDashboard() {
    const s = Store.settings;
    $('#pageSub').textContent = U.fmtDate(new Date());
    const day = Reports.aggregate(Reports.range('day'));
    const week = Reports.aggregate(Reports.range('week'));
    const month = Reports.aggregate(Reports.range('month'));
    const open = Store.openTasks().sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const n = nextCallText();
    const st = streak();
    const rate = week.calls.total ? week.calls.answered / week.calls.total : 0;
    const heat = {};
    Store.entries.forEach((e) => { const k = U.ymd(Reports.entryTime(e)); heat[k] = (heat[k] || 0) + 1; });
    const weekBars = week.buckets.map((b) => ({ label: b.label, value: b.value }));
    const todayIdx = week.buckets.findIndex((b) => U.sameDay(b.start, new Date()));
    const donutData = month.cats.map((c) => ({ label: c.cat.name, value: c.n, color: c.cat.color }));

    return `
      <div class="hero">
        <div class="hero-main">
          <p class="eyebrow">${U.DAYS[new Date().getDay()]} · ${Agent.isWorkingNow() ? '<span class="dot-status on"></span> On shift' : '<span class="dot-status"></span> Off shift'}</p>
          <h2>${greetWord()}${s.name ? ', ' + U.esc(s.name.split(' ')[0]) : ''} 👋</h2>
          <p class="muted">${day.items.length ? `You've logged <b>${day.items.length}</b> item${day.items.length > 1 ? 's' : ''} today${day.minutes ? ` · <b>${U.fmtDuration(day.minutes)}</b> recorded` : ''}.` : 'Nothing logged yet today — tell me what you are working on.'}</p>
          <form class="quick" id="quickForm" autocomplete="off">
            <div class="quick-input">
              <input id="quickText" placeholder="Quick log: e.g. “Traced mail flow for finance, NDR from partner — 20 min”" aria-label="Quick log" />
              <button type="button" class="icon-btn mic-btn" id="quickMic" title="Dictate">${U.icon('mic')}</button>
            </div>
            <button class="btn btn-primary" type="submit">${U.icon('plus')} Log it</button>
          </form>
          <div class="quick-preview" id="quickPreview"></div>
        </div>
        <div class="hero-call">
          <div class="hc-ring">${U.icon('phone')}</div>
          <div><div class="muted small">Next check-in call</div><div class="hc-time">${n.big}</div><div class="muted small">${n.small}</div></div>
          <button class="btn btn-glass" data-call>${U.icon('phone')} Call now</button>
        </div>
      </div>

      <div class="kpis">
        ${kpi('Today', day.items.length, `${day.done} done`, 'log')}
        ${kpi('Time today', U.fmtDuration(day.minutes), 'hands-on time', 'clock')}
        ${kpi('This week', week.items.length, `${week.cats.length} areas`, 'reports')}
        ${kpi('Open tasks', open.length, open.filter((t) => t.due && t.due < U.ymd(new Date())).length + ' overdue', 'tasks')}
        ${kpi('Streak', st + ' day' + (st === 1 ? '' : 's'), 'consecutive workdays', 'flame')}
        <div class="kpi"><div class="kpi-ring">${Charts.ring(rate)}</div><div><div class="kpi-label">Check-ins answered</div><div class="kpi-sub">${week.calls.answered}/${week.calls.total} this week</div></div></div>
      </div>

      <div class="grid-2">
        ${card(`Today's timeline`, day.items.length ? `<div class="timeline">${day.items.slice().reverse().map((e) => entryRow(e)).join('')}</div>` : empty('No entries yet today.', `<button class="btn btn-ghost" data-call>${U.icon('phone')} Log by voice</button>`), { actions: `<a class="link-btn" href="#/log">View log →</a>` })}
        ${card('Open tasks & jobs', open.length ? `<div class="task-list">${open.slice(0, 7).map(taskCard).join('')}</div>` : empty('No open tasks. Say “remind me to…” on a call to add one.'), { actions: `<a class="link-btn" href="#/tasks">Board →</a>` })}
      </div>

      <div class="grid-2">
        ${card('This week', Charts.bars(weekBars, { highlight: todayIdx }), { actions: `<a class="link-btn" href="#/reports" data-report="week">Weekly report →</a>` })}
        ${card(`${U.MONTHS[new Date().getMonth()]} by area`, donutData.length ? `<div class="donut-wrap">${Charts.donut(donutData, { center: String(month.items.length), sub: 'items' })}${Charts.legend(donutData, { max: 7 })}</div>` : empty('Your area breakdown appears once you log work.'), { actions: `<a class="link-btn" href="#/reports" data-report="month">Monthly report →</a>` })}
      </div>

      ${card('Activity — last 12 months', Charts.heatmap(heat), { cls: 'heat-card', actions: `<a class="link-btn" href="#/reports" data-report="year">Yearly report →</a>` })}
      ${!Store.entries.length ? `<div class="banner">${U.icon('spark')}<div><b>Want to see it in action?</b> Load a year of sample IT-ops data to explore the dashboards — you can remove it with one click later.</div><button class="btn btn-ghost" id="btnDemo">Load sample data</button></div>` : ''}
    `;
  }
  function kpi(label, val, sub, icon) {
    return `<div class="kpi"><div class="kpi-ico">${U.icon(icon)}</div><div><div class="kpi-label">${label}</div><div class="kpi-val">${val}</div><div class="kpi-sub">${sub}</div></div></div>`;
  }

  /* ---------------- Log ---------------- */
  function logItems() {
    const f = ui.log;
    let items = Store.entries.slice();
    if (f.period !== 'all') { const r = Reports.range(f.period); items = Store.inRange(r.start, r.end); }
    if (f.cat) items = items.filter((e) => e.category === f.cat);
    if (f.type) items = items.filter((e) => e.type === f.type);
    if (f.status) items = items.filter((e) => e.status === f.status);
    if (f.q) { const q = f.q.toLowerCase(); items = items.filter((e) => `${e.title} ${e.details} ${e.ticket} ${(e.tags || []).join(' ')}`.toLowerCase().includes(q)); }
    return items.sort((a, b) => Reports.entryTime(b) - Reports.entryTime(a));
  }
  function viewLog() {
    $('#pageSub').textContent = 'Everything you have done — searchable';
    const f = ui.log;
    const opt = (v, l, cur) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`;
    return `
      <div class="toolbar">
        <label class="search">${U.icon('search')}<input id="logQ" placeholder="Search title, details, ticket, tag…" value="${U.esc(f.q)}" /></label>
        <select id="logPeriod">${opt('day', 'Today', f.period)}${opt('week', 'This week', f.period)}${opt('month', 'This month', f.period)}${opt('quarter', 'This quarter', f.period)}${opt('year', 'This year', f.period)}${opt('all', 'All time', f.period)}</select>
        <select id="logCat">${opt('', 'All areas', f.cat)}${Categories.list.map((c) => opt(c.id, c.name, f.cat)).join('')}</select>
        <select id="logType">${opt('', 'All types', f.type)}${opt('entry', 'Entries', f.type)}${opt('task', 'Tasks', f.type)}${opt('job', 'Jobs', f.type)}</select>
        <select id="logStatus">${opt('', 'Any status', f.status)}${Object.entries(STATUS).map(([k, v]) => opt(k, v, f.status)).join('')}</select>
        <button class="btn btn-ghost" id="logCsv">${U.icon('download')} CSV</button>
      </div>
      <div id="logList"></div>`;
  }
  function renderLogList() {
    const items = logItems();
    const host = $('#logList');
    if (!items.length) { host.innerHTML = empty('No matching entries.'); return; }
    const groups = new Map();
    items.slice(0, 1500).forEach((e) => { const k = U.ymd(Reports.entryTime(e)); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); });
    host.innerHTML = `<p class="muted small">${items.length} item${items.length > 1 ? 's' : ''} · ${U.fmtDuration(items.reduce((s, e) => s + (e.minutes || 0), 0))} recorded</p>` +
      [...groups.entries()].map(([k, list]) => `<section class="day-group"><h4>${U.relDay(U.parseYmd(k))} <span class="muted">· ${list.length}</span></h4><div class="card list-card">${list.map((e) => entryRow(e)).join('')}</div></section>`).join('');
  }

  /* ---------------- Tasks ---------------- */
  function viewTasks() {
    $('#pageSub').textContent = 'Drag cards between columns to update status';
    const tasks = Store.entries.filter((e) => e.type !== 'entry');
    const weekAgo = U.addDays(new Date(), -7);
    const cols = [
      ['open', 'Open'], ['in-progress', 'In progress'], ['blocked', 'Blocked'], ['done', 'Done (7 days)'],
    ];
    return `
      <form class="quick wide" id="taskForm" autocomplete="off">
        <div class="quick-input"><input id="taskText" placeholder="Add a task or job, e.g. “Renew SSL cert on VPN gateway by Thursday, high priority”" /><button type="button" class="icon-btn mic-btn" id="taskMic">${U.icon('mic')}</button></div>
        <button class="btn btn-primary" type="submit">${U.icon('plus')} Add task</button>
      </form>
      <div class="board">${cols.map(([st, label]) => {
        let list = tasks.filter((t) => t.status === st);
        if (st === 'done') list = list.filter((t) => new Date(t.completedAt || t.updated) >= weekAgo);
        list.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
        return `<div class="col" data-status="${st}"><div class="col-head"><span class="badge st-${st}">${label}</span><span class="muted">${list.length}</span></div>
          <div class="col-body">${list.map(taskCard).join('') || '<div class="col-empty">Drop here</div>'}</div></div>`;
      }).join('')}</div>`;
  }

  /* ---------------- Reports ---------------- */
  function viewReports() {
    const { kind, anchor } = ui.report;
    const r = Reports.range(kind, anchor);
    const a = Reports.aggregate(r);
    $('#pageSub').textContent = r.label;
    const donutData = a.cats.map((c) => ({ label: c.cat.name, value: c.n, color: c.cat.color }));
    const timeData = a.cats.filter((c) => c.minutes).sort((x, y) => y.minutes - x.minutes).map((c) => ({ label: c.cat.name, value: Math.round(c.minutes / 6) / 10, color: c.cat.color, sub: 'hours' }));
    const statusCounts = Object.keys(STATUS).map((k) => ({ k, n: a.items.filter((e) => e.status === k).length }));
    const highlights = a.items.filter((e) => e.priority === 'critical' || e.priority === 'high').slice(-8).reverse();
    const heat = {};
    a.items.forEach((e) => { const k = U.ymd(Reports.entryTime(e)); heat[k] = (heat[k] || 0) + 1; });
    const hmEnd = new Date(Math.min(U.addDays(r.end, -1).getTime(), Date.now()));
    const isCurrent = r.start <= new Date() && new Date() < r.end;

    return `
      <div class="report-bar no-print">
        <div class="seg" role="tablist">${Reports.KINDS.map((k) => `<button role="tab" class="${k === kind ? 'on' : ''}" data-kind="${k}">${U.capitalize(k)}</button>`).join('')}</div>
        <div class="pager">
          <button class="icon-btn" data-shift="-1" title="Previous">${U.icon('chevL')}</button>
          <button class="btn btn-ghost sm" data-shift="0" ${isCurrent ? 'disabled' : ''}>Current</button>
          <button class="icon-btn" data-shift="1" title="Next">${U.icon('chevR')}</button>
        </div>
        <div class="report-actions">
          <button class="btn btn-ghost sm" id="repCopy">Copy summary</button>
          <button class="btn btn-ghost sm" id="repMd">${U.icon('download')} Markdown</button>
          <button class="btn btn-ghost sm" id="repCsv">${U.icon('download')} CSV</button>
          <button class="btn btn-primary sm" id="repPrint">${U.icon('printer')} Print / PDF</button>
        </div>
      </div>

      <div class="report">
        <header class="report-head">
          <div><p class="eyebrow">${U.capitalize(kind)} report</p><h2>${U.esc(r.label)}</h2>
          ${Store.settings.name ? `<p class="muted">${U.esc(Store.settings.name)} · ${U.esc(Store.settings.role)}${Store.settings.org ? ' · ' + U.esc(Store.settings.org) : ''}</p>` : ''}</div>
        </header>
        <div class="narrative">${U.icon('spark')}<p>${U.esc(Reports.narrative(a))}</p></div>

        <div class="kpis">
          ${kpi('Items logged', a.items.length, `${a.activeDays} active day${a.activeDays === 1 ? '' : 's'}`, 'log')}
          ${kpi('Completed', a.done, a.items.length ? Math.round((a.done / a.items.length) * 100) + '% of items' : '—', 'check')}
          ${kpi('Time recorded', U.fmtDuration(a.minutes), a.activeDays ? U.fmtDuration(a.minutes / a.activeDays) + ' / day' : '—', 'clock')}
          ${kpi('High / critical', a.critical, 'priority items', 'flame')}
          ${kpi('Areas covered', a.cats.length, a.cats[0] ? 'Top: ' + a.cats[0].cat.name : '—', 'dashboard')}
          ${kpi('Tickets referenced', a.tickets, `${a.createdTasks} tasks raised`, 'tasks')}
        </div>

        <div class="grid-2">
          ${card('Activity', a.items.length ? Charts.bars(a.buckets, { highlight: kind === 'week' || kind === 'month' ? a.buckets.findIndex((b) => U.sameDay(b.start, new Date())) : -1 }) : empty('No activity in this period.'))}
          ${card('By area', donutData.length ? `<div class="donut-wrap">${Charts.donut(donutData, { center: String(a.items.length), sub: 'items' })}${Charts.legend(donutData, { max: 10 })}</div>` : empty('No data.'))}
        </div>
        <div class="grid-2">
          ${card('Time by area', timeData.length ? Charts.hbars(timeData) : empty('Add “time spent” to entries to see where your hours go.'))}
          ${card('Status & highlights', `<div class="status-row">${statusCounts.map((s) => `<div class="status-pill st-${s.k}"><b>${s.n}</b><span>${STATUS[s.k]}</span></div>`).join('')}</div>
            ${highlights.length ? `<h4 class="sub-h">High-impact work</h4><div class="mini-list">${highlights.map((e) => `<div>${prBadge(e.priority)} ${U.safe(e.title)} <span class="muted small">· ${U.fmtDate(Reports.entryTime(e))}</span></div>`).join('')}</div>` : ''}`)}
        </div>
        ${kind === 'quarter' || kind === 'year' ? card('Daily activity', Charts.heatmap(heat, { weeks: kind === 'year' ? 53 : 14, end: hmEnd }), { cls: 'heat-card' }) : ''}
        ${(() => {
          const cap = { day: 500, week: 500, month: 120, quarter: 40, year: 40 }[kind];
          const list = kind === 'quarter' || kind === 'year' ? a.items.filter((e) => e.priority === 'critical' || e.priority === 'high') : a.items;
          const shown = list.slice().reverse().slice(0, cap);
          const title = kind === 'quarter' || kind === 'year' ? 'Notable work (high / critical)' : 'Detailed log';
          const more = list.length > shown.length ? `<p class="muted small">Showing ${shown.length} of ${list.length}. Full list: <a href="#/log">Work Log</a> or export CSV.</p>` : '';
          return card(`${title} <span class="muted small">(${list.length})</span>`, shown.length ? `<div class="timeline">${shown.map((e) => entryRow(e, { showDate: kind !== 'day' })).join('')}</div>${more}` : empty('Nothing logged in this period.'), { cls: 'log-card' });
        })()}
      </div>`;
  }

  /* ---------------- Settings ---------------- */
  function viewSettings() {
    $('#pageSub').textContent = 'Profile, assistant, schedule and data';
    const s = Store.settings;
    const voices = Voice.voices().filter((v) => v.lang.startsWith('en'));
    const sched = s.schedule.map((w, i) => `
      <div class="sched-row" data-i="${i}">
        <div class="days">${U.DAYS_SHORT.map((d, di) => `<button type="button" class="day ${w.days.includes(di) ? 'on' : ''}" data-day="${di}">${d}</button>`).join('')}</div>
        <label>From <input type="time" data-k="start" value="${w.start}" /></label>
        <label>To <input type="time" data-k="end" value="${w.end}" /></label>
        <button type="button" class="icon-btn sm" data-rm="${i}" title="Remove">${U.icon('trash')}</button>
      </div>`).join('');
    const weekSlots = [0, 1, 2, 3, 4, 5, 6].map((d) => { const dt = U.addDays(U.startOfDay(new Date()), (d - new Date().getDay() + 7) % 7); return { d, n: Agent.slotsFor(dt).length, first: Agent.slotsFor(dt)[0], last: Agent.slotsFor(dt).slice(-1)[0] }; });
    const notif = 'Notification' in window ? Notification.permission : 'unsupported';

    return `
      <div class="settings">
        ${card('Profile', `
          <div class="grid-3">
            <label class="field"><span>Your name</span><input data-set="name" value="${U.esc(s.name)}" placeholder="e.g. Maqbool" /></label>
            <label class="field"><span>Role</span><input data-set="role" value="${U.esc(s.role)}" /></label>
            <label class="field"><span>Organisation / team</span><input data-set="org" value="${U.esc(s.org)}" /></label>
            <label class="field"><span>Week starts on</span><select data-set="weekStart" data-num>${[0, 1, 6].map((d) => `<option value="${d}" ${s.weekStart === d ? 'selected' : ''}>${U.DAYS[d]}</option>`).join('')}</select></label>
            <label class="field"><span>Theme</span><select data-set="theme">${['system', 'dark', 'light'].map((t) => `<option ${s.theme === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            <label class="field check"><input type="checkbox" data-set="showcase" ${s.showcase ? 'checked' : ''}/><span>Showcase mode — mask e-mails and IP addresses on screen and in exports</span></label>
          </div>`)}

        ${card('Check-in assistant', `
          <div class="grid-3">
            <label class="field check"><input type="checkbox" data-set="agentEnabled" ${s.agentEnabled ? 'checked' : ''}/><span>Call me for check-ins</span></label>
            <label class="field"><span>Assistant name</span><input data-set="agentName" value="${U.esc(s.agentName)}" /></label>
            <label class="field"><span>Call every</span><select data-set="interval" data-num>${[15, 20, 30, 45, 60, 90, 120].map((m) => `<option value="${m}" ${Number(s.interval) === m ? 'selected' : ''}>${m} minutes</option>`).join('')}</select></label>
            <label class="field check"><input type="checkbox" data-set="ringtone" ${s.ringtone ? 'checked' : ''}/><span>Ringtone</span></label>
            <label class="field check"><input type="checkbox" data-set="reRingMissed" ${s.reRingMissed ? 'checked' : ''}/><span>Call back once after 5 min if missed</span></label>
            <label class="field check"><input type="checkbox" data-set="autoListen" ${s.autoListen ? 'checked' : ''}/><span>Listen automatically after the assistant speaks</span></label>
            <label class="field"><span>Ring for</span><select data-set="ringSeconds" data-num>${[20, 30, 45, 60, 90].map((m) => `<option value="${m}" ${Number(s.ringSeconds) === m ? 'selected' : ''}>${m} seconds</option>`).join('')}</select></label>
            <label class="field"><span>Assistant voice</span><select data-set="voice"><option value="">Auto (best available)</option>${voices.map((v) => `<option ${s.voice === v.name ? 'selected' : ''}>${U.esc(v.name)}</option>`).join('')}</select></label>
            <label class="field"><span>Speech language</span><select data-set="lang">${['en-US', 'en-GB', 'en-IN', 'en-AU', 'en-IE'].map((l) => `<option ${s.lang === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" id="testCall">${U.icon('phone')} Test incoming call</button>
            <button class="btn btn-ghost" id="testVoice">Test voice</button>
            <button class="btn btn-ghost" id="askNotif" ${notif === 'granted' || notif === 'unsupported' ? 'disabled' : ''}>${U.icon('bell')} ${notif === 'granted' ? 'Notifications enabled' : notif === 'unsupported' ? 'Notifications unsupported' : 'Enable desktop notifications'}</button>
          </div>
          <p class="muted small">Voice input: ${Voice.supported.stt ? '✅ supported in this browser' : '⚠️ not supported here — use Chrome or Edge, or type during calls'} · Voice output: ${Voice.supported.tts ? '✅' : '⚠️ not supported'}</p>`)}

        ${card('Working hours (check-in schedule)', `
          <div id="sched">${sched}</div>
          <div class="btn-row"><button class="btn btn-ghost" id="addWin">${U.icon('plus')} Add time window</button><button class="btn btn-ghost" id="resetWin">Reset to default</button></div>
          <div class="week-preview">${weekSlots.map((w) => `<div class="wp ${w.n ? 'on' : ''}"><b>${U.DAYS_SHORT[w.d]}</b><span>${w.n ? `${w.n} calls` : 'off'}</span><small>${w.n ? U.fmt12(U.fromMin(w.first)) + '–' + U.fmt12(U.fromMin(w.last)) : ''}</small></div>`).join('')}</div>
          <p class="muted small">Calls ring at each interval from the start to the end of each window (inclusive). The last call of the day is the <b>end-of-day wrap-up</b>; on the last working day of a week, month, quarter or year the matching report opens automatically.</p>`)}

        ${card('Ring me even when the browser is closed (Windows)', `
          <p>Browsers can only ring while OpsLog is open (or installed as an app). To get a guaranteed call on your Windows PC, run the PowerShell helper once — it creates scheduled tasks that <b>speak an alert</b> and open OpsLog in "incoming call" mode at every check-in slot.</p>
          <pre class="code">.\\tools\\Register-OpsLogCheckins.ps1 -AppUrl "${U.esc(location.origin + location.pathname)}"</pre>
          <a class="btn btn-ghost" href="tools/Register-OpsLogCheckins.ps1" download>${U.icon('download')} Download script</a>`)}

        ${card('Data & backup', `
          <p class="muted">Your data is stored only in this browser (${Store.entries.length} items, ${Store.calls.length} call records). Export a backup regularly or before clearing browser data.</p>
          <div class="btn-row">
            <button class="btn btn-primary" id="expJson">${U.icon('download')} Export backup (JSON)</button>
            <label class="btn btn-ghost">${U.icon('upload')} Import backup<input type="file" id="impJson" accept="application/json,.json" hidden /></label>
            <button class="btn btn-ghost" id="expCsvAll">${U.icon('download')} Export all (CSV)</button>
          </div>
          <div class="btn-row">
            <button class="btn btn-ghost" id="demoLoad">Load sample data</button>
            <button class="btn btn-ghost" id="demoRemove">Remove sample data</button>
            <button class="btn btn-danger-ghost" id="wipe">Delete everything</button>
          </div>`)}
      </div>`;
  }

  /* ---------------- after-render wiring ---------------- */
  const afterRender = {
    dashboard() {
      const input = $('#quickText');
      const preview = U.debounce(() => {
        const list = Parser.parse(input.value);
        $('#quickPreview').innerHTML = list.map((p) => `<span class="pv">${chip(p.category)} <span>${U.safe(p.title)}</span>${p.type !== 'entry' ? ` <span class="badge">${p.type}</span>` : ''}${p.minutes ? ` <span class="meta">${U.fmtDuration(p.minutes)}</span>` : ''}</span>`).join('');
      }, 150);
      input.addEventListener('input', preview);
      $('#quickForm').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const list = Parser.parse(input.value);
        if (!list.length) return;
        Store.addMany(list);
        U.toast(`Logged ${list.length} item${list.length > 1 ? 's' : ''}`, 'success');
        input.value = '';
      });
      $('#quickMic').addEventListener('click', () => dictateInto(input, $('#quickMic'), preview));
      const demo = $('#btnDemo');
      if (demo) demo.addEventListener('click', () => { const n = WL.Demo.load(); U.toast(`Loaded ${n} sample items`, 'success'); });
    },
    log() {
      const f = ui.log;
      renderLogList();
      $('#logQ').addEventListener('input', U.debounce((e) => { f.q = e.target.value; renderLogList(); }, 150));
      [['#logPeriod', 'period'], ['#logCat', 'cat'], ['#logType', 'type'], ['#logStatus', 'status']].forEach(([sel, k]) => $(sel).addEventListener('change', (e) => { f[k] = e.target.value; renderLogList(); }));
      $('#logCsv').addEventListener('click', () => U.download(`opslog-${U.ymd(new Date())}.csv`, Reports.toCSV(logItems()), 'text/csv'));
    },
    tasks() {
      const input = $('#taskText');
      $('#taskForm').addEventListener('submit', (ev) => {
        ev.preventDefault();
        if (!input.value.trim()) return;
        const p = Parser.parseOne(input.value);
        if (p.type === 'entry') p.type = 'task';
        if (p.status === 'done') p.status = 'open';
        if (!p.due) p.due = Parser.parseOne(input.value + ' need to').due;
        Store.add(p);
        input.value = '';
        U.toast('Task added', 'success');
      });
      $('#taskMic').addEventListener('click', () => dictateInto(input, $('#taskMic')));
      // drag & drop
      let dragId = null;
      $$('.task-card').forEach((c) => {
        c.addEventListener('dragstart', (e) => { dragId = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
        c.addEventListener('dragend', () => c.classList.remove('dragging'));
      });
      $$('.col').forEach((col) => {
        col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
        col.addEventListener('dragleave', () => col.classList.remove('over'));
        col.addEventListener('drop', (e) => { e.preventDefault(); col.classList.remove('over'); if (dragId) Store.update(dragId, { status: col.dataset.status }); dragId = null; });
      });
    },
    reports() {
      const v = $('#view');
      v.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { ui.report.kind = b.dataset.kind; render(); }));
      v.querySelectorAll('[data-shift]').forEach((b) => b.addEventListener('click', () => {
        const d = Number(b.dataset.shift);
        ui.report.anchor = d === 0 ? new Date() : Reports.shift(ui.report.kind, ui.report.anchor, d);
        render();
      }));
      const a = () => Reports.aggregate(Reports.range(ui.report.kind, ui.report.anchor));
      const fname = () => `opslog-${ui.report.kind}-${U.ymd(Reports.range(ui.report.kind, ui.report.anchor).start)}`;
      $('#repCopy').addEventListener('click', () => {
        const x = a();
        const text = `${x.r.label}\n${Reports.narrative(x)}\n\n` + x.cats.map((c) => `• ${c.cat.name}: ${c.n}`).join('\n');
        navigator.clipboard.writeText(text).then(() => U.toast('Summary copied', 'success'), () => U.toast('Copy failed', 'error'));
      });
      $('#repMd').addEventListener('click', () => U.download(fname() + '.md', Reports.toMarkdown(a()), 'text/markdown'));
      $('#repCsv').addEventListener('click', () => U.download(fname() + '.csv', Reports.toCSV(a().items), 'text/csv'));
      $('#repPrint').addEventListener('click', () => window.print());
    },
    settings() {
      const v = $('#view');
      v.querySelectorAll('[data-set]').forEach((inp) => {
        inp.addEventListener('change', () => {
          const k = inp.dataset.set;
          let val = inp.type === 'checkbox' ? inp.checked : inp.value;
          if (inp.hasAttribute('data-num')) val = Number(val);
          Store.saveSettings({ [k]: val });
          if (k === 'theme') applyTheme();
          if (k === 'showcase') paintToggles();
          if (['interval', 'agentEnabled', 'weekStart'].includes(k)) render();
          U.toast('Saved', 'success', 1200);
        });
      });
      const saveSched = (rerender = true) => {
        const rows = $$('.sched-row', v).map((row) => ({
          days: $$('.day.on', row).map((b) => Number(b.dataset.day)),
          start: $('[data-k=start]', row).value, end: $('[data-k=end]', row).value,
        })).filter((w) => w.start && w.end);
        Store.saveSettings({ schedule: rows });
        if (rerender) render();
      };
      $('#sched').addEventListener('click', (e) => {
        const d = e.target.closest('.day');
        if (d) { d.classList.toggle('on'); saveSched(); }
        const rm = e.target.closest('[data-rm]');
        if (rm) { rm.closest('.sched-row').remove(); saveSched(); }
      });
      $('#sched').addEventListener('change', () => saveSched());
      $('#addWin').addEventListener('click', () => { Store.saveSettings({ schedule: [...Store.settings.schedule, { days: [0, 1, 2, 3], start: '09:00', end: '10:00' }] }); render(); });
      $('#resetWin').addEventListener('click', () => { Store.saveSettings({ schedule: JSON.parse(JSON.stringify(Store.DEFAULT_SETTINGS.schedule)), interval: 30 }); render(); });
      $('#testCall').addEventListener('click', () => { U.toast('Ringing in 3 seconds — switch tabs to test the notification.', 'info'); setTimeout(() => Agent.test(), 3000); });
      $('#testVoice').addEventListener('click', () => Voice.speak(`Hi${Store.settings.name ? ' ' + Store.settings.name.split(' ')[0] : ''}, this is ${Store.settings.agentName}. I'll check in with you every ${Store.settings.interval} minutes during your shift.`));
      $('#askNotif').addEventListener('click', () => Notification.requestPermission().then(() => render()));
      $('#expJson').addEventListener('click', () => U.download(`opslog-backup-${U.ymd(new Date())}.json`, Store.exportJSON(), 'application/json'));
      $('#expCsvAll').addEventListener('click', () => U.download(`opslog-all-${U.ymd(new Date())}.csv`, Reports.toCSV(Store.entries.slice().sort((a, b) => new Date(a.when) - new Date(b.when))), 'text/csv'));
      $('#impJson').addEventListener('change', async (e) => {
        const file = e.target.files[0]; if (!file) return;
        try {
          const replace = confirm('Replace all current data with this backup?\n\nOK = replace, Cancel = merge (keep existing and add new items).');
          const n = Store.importJSON(await file.text(), replace ? 'replace' : 'merge');
          U.toast(`Imported ${n} items`, 'success');
        } catch (err) { U.toast('Import failed: ' + err.message, 'error'); }
      });
      $('#demoLoad').addEventListener('click', () => { const n = WL.Demo.load(); U.toast(`Loaded ${n} sample items`, 'success'); });
      $('#demoRemove').addEventListener('click', () => { WL.Demo.remove(); U.toast('Sample data removed', 'success'); });
      $('#wipe').addEventListener('click', () => {
        if (prompt('This permanently deletes all entries and call history in this browser. Type DELETE to confirm.') === 'DELETE') { Store.clearAll(); U.toast('All data deleted', 'success'); }
      });
    },
  };

  /* ---------------- dictation helper (outside calls) ---------------- */
  function dictateInto(input, btn, onDone) {
    if (!Voice.supported.stt) { U.toast('Voice input needs Chrome, Edge or Safari.', 'warn'); return; }
    if (Voice.isListening()) { Voice.stopListening(); return; }
    const base = input.value ? input.value.trim() + ' ' : '';
    btn.classList.add('rec');
    Voice.listen({ onInterim: (t) => { input.value = base + t; } })
      .then((t) => { input.value = (base + t).trim(); input.dispatchEvent(new Event('input')); onDone && onDone(); })
      .catch((e) => U.toast(e.message, 'error'))
      .finally(() => btn.classList.remove('rec'));
  }

  /* ---------------- editor ---------------- */
  let editing = null;
  let touched = new Set();
  function toLocalInput(d) { return `${U.ymd(d)}T${U.hm(d)}`; }
  function openEditor(id = null, { dictate = false } = {}) {
    const dlg = $('#editor');
    editing = id ? Store.get(id) : null;
    touched = new Set(editing ? ['fTitle', 'fCategory', 'fType', 'fStatus', 'fPriority', 'fMinutes', 'fTicket'] : []);
    $('#fCategory').innerHTML = Categories.list.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
    const e = editing || { title: '', details: '', category: 'other', type: 'entry', status: 'done', priority: 'normal', minutes: '', ticket: '', when: new Date().toISOString(), due: '', tags: [] };
    $('#editorTitle').textContent = editing ? 'Edit item' : 'New entry';
    $('#fDetails').value = e.details || '';
    $('#fTitle').value = e.title;
    $('#fCategory').value = e.category;
    $('#fType').value = e.type;
    $('#fStatus').value = e.status;
    $('#fPriority').value = e.priority;
    $('#fMinutes').value = e.minutes || '';
    $('#fTicket').value = e.ticket || '';
    $('#fWhen').value = toLocalInput(new Date(e.when));
    $('#fDue').value = e.due || '';
    $('#fTags').value = (e.tags || []).join(', ');
    $('#fDelete').style.visibility = editing ? 'visible' : 'hidden';
    if (!dlg.open) dlg.showModal();
    setTimeout(() => (editing ? $('#fTitle') : $('#fDetails')).focus(), 30);
    if (dictate) setTimeout(() => $('#fMic').click(), 200);
  }
  function wireEditor() {
    const dlg = $('#editor');
    ['fTitle', 'fCategory', 'fType', 'fStatus', 'fPriority', 'fMinutes', 'fTicket'].forEach((id) => $('#' + id).addEventListener('input', () => touched.add(id)));
    const autofill = () => {
      const p = Parser.parseOne($('#fDetails').value, {});
      if (!$('#fDetails').value.trim()) return;
      const set = (id, v) => { if (!touched.has(id) && v != null && v !== '') $('#' + id).value = v; };
      set('fTitle', p.title); set('fCategory', p.category); set('fType', p.type); set('fStatus', p.status); set('fPriority', p.priority); set('fMinutes', p.minutes); set('fTicket', p.ticket);
      if (p.due && !$('#fDue').value) $('#fDue').value = p.due;
    };
    $('#fDetails').addEventListener('input', U.debounce(autofill, 120));
    $('#fMic').addEventListener('click', () => dictateInto($('#fDetails'), $('#fMic'), autofill));
    $('#editorForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const data = {
        title: $('#fTitle').value.trim() || 'Untitled', details: $('#fDetails').value.trim(), category: $('#fCategory').value,
        type: $('#fType').value, status: $('#fStatus').value, priority: $('#fPriority').value,
        minutes: Number($('#fMinutes').value) || null, ticket: $('#fTicket').value.trim(),
        when: new Date($('#fWhen').value || Date.now()).toISOString(), due: $('#fDue').value || null,
        tags: $('#fTags').value.split(',').map((t) => t.trim()).filter(Boolean),
      };
      if (editing) Store.update(editing.id, data); else Store.add(data);
      U.toast(editing ? 'Updated' : 'Saved', 'success');
      Voice.stopListening();
      dlg.close();
    });
    $('#fDelete').addEventListener('click', () => {
      if (editing && confirm('Delete this item?')) { Store.remove(editing.id); dlg.close(); U.toast('Deleted', 'success'); }
    });
    $$('dialog').forEach((d) => {
      d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) { Voice.stopListening(); d.close(); } });
    });
  }

  /* ---------------- wrap-up modal ---------------- */
  function showWrapUp() {
    const now = new Date();
    const kinds = ['year', 'quarter', 'month', 'week'].filter((k) => Reports.isLastWorkdayOf(k, now));
    const a = Reports.aggregate(Reports.range('day'));
    $('#wrapTitle').textContent = `End of day — ${U.fmtDate(now)}`;
    const tomorrow = Store.openTasks().slice(0, 5);
    $('#wrapBody').innerHTML = `
      <div class="narrative">${U.icon('spark')}<p>${U.esc(Reports.narrative(a))}</p></div>
      <div class="kpis small">${kpi('Items', a.items.length, `${a.done} done`, 'log')}${kpi('Time', U.fmtDuration(a.minutes), 'recorded', 'clock')}${kpi('Areas', a.cats.length, a.cats[0] ? a.cats[0].cat.name : '—', 'dashboard')}</div>
      ${a.cats.length ? Charts.hbars(a.cats.map((c) => ({ label: c.cat.name, value: c.n, color: c.cat.color }))) : ''}
      ${tomorrow.length ? `<h4 class="sub-h">Carry over</h4><div class="mini-list">${tomorrow.map((t) => `<div>${chip(t.category)} ${U.safe(t.title)}</div>`).join('')}</div>` : ''}
      <div class="btn-row">
        <button class="btn btn-primary" data-open-report="day">Open daily report</button>
        ${kinds.map((k) => `<button class="btn btn-ghost" data-open-report="${k}">${U.capitalize(k)} report is ready →</button>`).join('')}
      </div>`;
    $('#wrapBody').querySelectorAll('[data-open-report]').forEach((b) => b.addEventListener('click', () => {
      ui.report = { kind: b.dataset.openReport, anchor: new Date() };
      $('#wrapup').close();
      location.hash = '#/reports';
      if (ui.route === 'reports') render();
    }));
    $('#wrapup').showModal();
  }

  /* ---------------- global wiring ---------------- */
  function applyTheme() {
    const t = Store.settings.theme;
    if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    paintToggles();
  }

  function wireGlobal() {
    window.addEventListener('hashchange', route);
    document.addEventListener('click', (e) => {
      const call = e.target.closest('[data-call]');
      if (call) { e.preventDefault(); Agent.startManual(); return; }
      const ed = e.target.closest('[data-edit]');
      if (ed && !e.target.closest('#callConvo')) { openEditor(ed.dataset.edit); return; }
      const dn = e.target.closest('[data-done]');
      if (dn) { Store.update(dn.dataset.done, { status: 'done' }); U.toast('Nice — marked done ✔', 'success'); return; }
      const rep = e.target.closest('[data-report]');
      if (rep) { ui.report = { kind: rep.dataset.report, anchor: new Date() }; }
    });
    $('#btnNew').addEventListener('click', () => openEditor());
    $('#btnQuickVoice').addEventListener('click', () => openEditor(null, { dictate: true }));
    $('#fabCall').addEventListener('click', () => Agent.startManual());
    $('#btnTheme').addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      Store.saveSettings({ theme: dark ? 'light' : 'dark' });
      applyTheme();
    });
    $('#btnShowcase').addEventListener('click', () => {
      Store.saveSettings({ showcase: !Store.settings.showcase });
      paintToggles();
      U.toast(Store.settings.showcase ? 'Showcase mode on — e-mails & IPs masked' : 'Showcase mode off', 'info');
    });
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea, select') || document.querySelector('dialog[open]') || document.body.classList.contains('in-call')) return;
      if (e.key === 'n') { e.preventDefault(); openEditor(); }
      if (e.key === 'c') { e.preventDefault(); Agent.startManual(); }
    });
    Store.on((what) => { if (what === 'entries' || what === 'settings' || what === 'calls') refresh(); });
    setInterval(renderSideNext, 30000);
  }

  // Re-render the current view without losing focus in an input on that view.
  const refresh = U.debounce(() => {
    const active = document.activeElement;
    if (active && $('#view').contains(active) && active.matches('input, textarea, select') && ui.route !== 'tasks') {
      if (ui.route === 'log') renderLogList();
      renderSideNext();
      return;
    }
    render();
  }, 60);

  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
    }
  }

  function init() {
    renderShell();
    applyTheme();
    wireEditor();
    wireGlobal();
    Agent.init();
    route();
    registerSW();
    if (!Store.settings.name) setTimeout(() => U.toast('Tip: add your name in Settings so your assistant can greet you.', 'info', 5000), 1500);
  }

  WL.App = { init, refresh, openEditor, showWrapUp, render };
  document.addEventListener('DOMContentLoaded', init);
})(window.WL);
