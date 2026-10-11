/* OpsLog — period maths, aggregation, narrative summaries and exports. */
(function (WL) {
  'use strict';
  const { U, Store, Categories } = WL;

  const KINDS = ['day', 'week', 'month', 'quarter', 'year'];

  function range(kind, anchor = new Date()) {
    const a = U.startOfDay(anchor);
    let start, end, label;
    if (kind === 'day') {
      start = a; end = U.addDays(a, 1); label = U.fmtDate(a);
    } else if (kind === 'week') {
      const ws = Store.settings.weekStart || 0;
      start = U.addDays(a, -((a.getDay() - ws + 7) % 7)); end = U.addDays(start, 7);
      const last = U.addDays(end, -1);
      label = `Week of ${start.getDate()} ${U.MONTHS_SHORT[start.getMonth()]} – ${last.getDate()} ${U.MONTHS_SHORT[last.getMonth()]} ${last.getFullYear()}`;
    } else if (kind === 'month') {
      start = new Date(a.getFullYear(), a.getMonth(), 1); end = new Date(a.getFullYear(), a.getMonth() + 1, 1);
      label = `${U.MONTHS[a.getMonth()]} ${a.getFullYear()}`;
    } else if (kind === 'quarter') {
      const q = Math.floor(a.getMonth() / 3);
      start = new Date(a.getFullYear(), q * 3, 1); end = new Date(a.getFullYear(), q * 3 + 3, 1);
      label = `Q${q + 1} ${a.getFullYear()} (${U.MONTHS_SHORT[q * 3]} – ${U.MONTHS_SHORT[q * 3 + 2]})`;
    } else {
      start = new Date(a.getFullYear(), 0, 1); end = new Date(a.getFullYear() + 1, 0, 1); label = `Year ${a.getFullYear()}`;
    }
    return { kind, start, end, label };
  }

  function shift(kind, anchor, dir) {
    const d = new Date(anchor);
    if (kind === 'day') d.setDate(d.getDate() + dir);
    else if (kind === 'week') d.setDate(d.getDate() + 7 * dir);
    else if (kind === 'month') d.setMonth(d.getMonth() + dir, 1);
    else if (kind === 'quarter') d.setMonth(d.getMonth() + 3 * dir, 1);
    else d.setFullYear(d.getFullYear() + dir, 0, 1);
    return d;
  }

  /** Time buckets used for the activity chart of a period. */
  function buckets(r) {
    const out = [];
    if (r.kind === 'day') {
      for (let h = 7; h <= 18; h++) {
        const s = new Date(r.start); s.setHours(h);
        const e = new Date(r.start); e.setHours(h + 1);
        out.push({ label: h % 12 === 0 ? '12' : String(h % 12) + (h < 12 ? 'a' : 'p'), start: s, end: e });
      }
    } else if (r.kind === 'week' || r.kind === 'month') {
      for (let d = new Date(r.start); d < r.end; d = U.addDays(d, 1)) {
        out.push({ label: r.kind === 'week' ? U.DAYS_SHORT[d.getDay()] : String(d.getDate()), start: d, end: U.addDays(d, 1) });
      }
    } else if (r.kind === 'quarter') {
      let i = 1;
      for (let d = new Date(r.start); d < r.end; d = U.addDays(d, 7)) {
        const e = U.addDays(d, 7);
        out.push({ label: `W${i++}`, start: d, end: e < r.end ? e : r.end });
      }
    } else {
      for (let m = 0; m < 12; m++) out.push({ label: U.MONTHS_SHORT[m], start: new Date(r.start.getFullYear(), m, 1), end: new Date(r.start.getFullYear(), m + 1, 1) });
    }
    return out;
  }

  const entryTime = (e) => new Date(e.status === 'done' && e.completedAt && e.type !== 'entry' ? e.completedAt : e.when);

  function aggregate(r) {
    // Assigned-but-unfinished library/routine tickets are a to-do list, not logged work.
    const items = Store.inRange(r.start, r.end).filter((e) => e.status !== 'skipped' && !(e.templateId && e.status !== 'done')).sort((a, b) => entryTime(a) - entryTime(b));
    const byCat = {};
    const minutesByCat = {};
    let minutes = 0, done = 0, critical = 0;
    const days = new Set();
    for (const e of items) {
      byCat[e.category] = (byCat[e.category] || 0) + 1;
      minutesByCat[e.category] = (minutesByCat[e.category] || 0) + (e.minutes || 0);
      minutes += e.minutes || 0;
      if (e.status === 'done') done++;
      if (e.priority === 'critical' || e.priority === 'high') critical++;
      days.add(U.ymd(entryTime(e)));
    }
    const cats = Object.entries(byCat).map(([id, n]) => ({ id, n, minutes: minutesByCat[id], cat: Categories.get(id) })).sort((a, b) => b.n - a.n);
    const bk = buckets(r).map((b) => ({ ...b, value: items.filter((e) => { const t = entryTime(e); return t >= b.start && t < b.end; }).length }));
    const busiest = bk.reduce((m, b) => (b.value > (m?.value || 0) ? b : m), null);
    const createdTasks = Store.entries.filter((e) => e.type !== 'entry' && new Date(e.created) >= r.start && new Date(e.created) < r.end).length;
    const calls = Store.calls.filter((c) => { const t = new Date(c.ts); return t >= r.start && t < r.end; });
    const answered = calls.filter((c) => c.outcome === 'answered').length;
    const scheduled = calls.filter((c) => c.kind !== 'manual').length;
    return {
      r, items, cats, buckets: bk, busiest, minutes, done, critical, activeDays: days.size, createdTasks,
      open: Store.openTasks().length,
      tickets: items.filter((e) => e.ticket).length,
      calls: { total: scheduled, answered: calls.filter((c) => c.outcome === 'answered' && c.kind !== 'manual').length, all: answered },
    };
  }

  function narrative(a) {
    const n = a.items.length;
    const name = Store.settings.name ? Store.settings.name.split(' ')[0] : 'You';
    const period = { day: 'today', week: 'this week', month: 'this month', quarter: 'this quarter', year: 'this year' }[a.r.kind];
    if (!n) return `No work has been logged for ${a.r.label} yet.`;
    const top = a.cats.slice(0, 3).map((c) => `${c.cat.name} (${c.n})`).join(', ');
    let s = `${name === 'You' ? 'You' : name} logged ${n} item${n > 1 ? 's' : ''} ${a.r.kind === 'day' ? 'on ' + a.r.label : a.r.kind === 'week' ? 'in the ' + a.r.label.replace('Week', 'week') : 'in ' + a.r.label}`;
    s += `, completing ${a.done}`;
    if (a.minutes) s += ` and recording ${U.fmtDuration(a.minutes)} of hands-on time`;
    s += `. Work spanned ${a.cats.length} area${a.cats.length > 1 ? 's' : ''}, led by ${top}.`;
    if (a.critical) s += ` ${a.critical} item${a.critical > 1 ? 's were' : ' was'} high-priority or critical.`;
    if (a.r.kind !== 'day' && a.busiest && a.busiest.value) s += ` The busiest ${a.r.kind === 'year' ? 'month' : a.r.kind === 'quarter' ? 'week' : 'day'} was ${a.busiest.label} with ${a.busiest.value} items.`;
    if (a.calls.total) s += ` Check-in calls answered ${period}: ${a.calls.answered}/${a.calls.total}.`;
    return s;
  }

  function toMarkdown(a) {
    const L = [];
    const s = Store.settings;
    L.push(`# Work Report — ${a.r.label}`);
    L.push('');
    if (s.name) L.push(`**${s.name}** · ${s.role}${s.org ? ' · ' + s.org : ''}`, '');
    L.push(`> ${narrative(a)}`, '');
    L.push('## Key figures', '');
    L.push(`| Metric | Value |`, `|---|---|`);
    L.push(`| Items logged | ${a.items.length} |`, `| Completed | ${a.done} |`, `| Time recorded | ${U.fmtDuration(a.minutes)} |`, `| Active days | ${a.activeDays} |`, `| High / critical | ${a.critical} |`, `| Open tasks (now) | ${a.open} |`);
    L.push('', '## By area', '', '| Area | Items | Time |', '|---|---|---|');
    a.cats.forEach((c) => L.push(`| ${c.cat.name} | ${c.n} | ${U.fmtDuration(c.minutes)} |`));
    L.push('', '## Activity log', '');
    let lastDay = '';
    a.items.forEach((e) => {
      const t = entryTime(e);
      const d = U.fmtDate(t);
      if (d !== lastDay) { L.push('', `### ${d}`); lastDay = d; }
      const meta = [Categories.get(e.category).name, e.status !== 'done' ? e.status : null, e.minutes ? U.fmtDuration(e.minutes) : null, e.ticket || null].filter(Boolean).join(' · ');
      L.push(`- **${U.fmtTime(t)}** — ${U.mask(e.title)} _(${meta})_`);
    });
    L.push('', `_Generated by OpsLog on ${U.fmtDate(new Date())}_`);
    return L.join('\n');
  }

  function toCSV(items) {
    const cols = ['when', 'title', 'category', 'type', 'status', 'priority', 'minutes', 'ticket', 'location', 'tags', 'due', 'completedAt', 'source', 'details'];
    const rows = [cols.join(',')];
    items.forEach((e) => rows.push(cols.map((c) => {
      let v = e[c];
      if (c === 'category') v = Categories.get(v).name;
      if (c === 'tags') v = (v || []).join(' ');
      if (c === 'title' || c === 'details') v = U.mask(v);
      return U.csvCell(v);
    }).join(',')));
    return rows.join('\n');
  }

  /** True if `date` is the last scheduled work day inside the period that contains it. */
  function isLastWorkdayOf(kind, date) {
    const r = range(kind, date);
    for (let d = U.addDays(U.startOfDay(date), 1); d < r.end; d = U.addDays(d, 1)) {
      if (WL.Agent && WL.Agent.slotsFor(d).length) return false;
    }
    return true;
  }

  WL.Reports = { KINDS, range, shift, buckets, aggregate, narrative, toMarkdown, toCSV, entryTime, isLastWorkdayOf };
})(window.WL);
