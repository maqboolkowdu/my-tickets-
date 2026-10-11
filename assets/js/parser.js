/* OpsLog — turns a free-text / dictated update into structured entries. */
(function (WL) {
  'use strict';
  const { U, Categories } = WL;

  const WORDNUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, fifty: 50, ninety: 90 };

  function parseDuration(t) {
    let min = 0;
    const s = t.toLowerCase();
    if (/\bhalf an hour\b/.test(s)) min += 30;
    if (/\b(an|one) hour and a half\b|\b1\.5 ?h/.test(s)) min += 90;
    else {
      const h = s.match(/\b(\d+(?:\.\d+)?|an?|one|two|three|four|five|six|seven|eight)\s*(?:hours?|hrs?|h)\b/);
      if (h) min += Math.round((WORDNUM[h[1]] ?? parseFloat(h[1])) * 60);
    }
    const m = s.match(/\b(\d+|five|ten|fifteen|twenty|thirty|forty|forty-five|fifty|ninety)\s*(?:minutes?|mins?|m)\b/);
    if (m) min += WORDNUM[m[1]] ?? parseInt(m[1], 10);
    return min || null;
  }

  function parseStatusAndType(t) {
    const s = t.toLowerCase();
    let type = 'entry', status = 'done';
    if (/\b(need to|needs to|have to|has to|to do|todo|follow[- ]?up|remind me|plan to|planning to|going to|will need|schedule[d]? for|tomorrow|next week|pending)\b/.test(s)) { type = 'task'; status = 'open'; }
    if (/\b(working on|in progress|ongoing|still|started|starting|continuing)\b/.test(s)) status = 'in-progress';
    if (/\b(blocked (on|by)|i'?m blocked|we'?re blocked|it'?s blocked|waiting on|waiting for|awaiting|on hold|escalated to)\b/.test(s)) status = 'blocked';
    if (/\b(project|migration|rollout|roll-out|implementation|deployment|upgrade project|refresh project)\b/.test(s)) type = 'job';
    if (type === 'entry' && status !== 'done') type = 'task';
    if (/\b(done|completed|complete|finished|resolved|fixed|closed)\b/.test(s) && !/\bnot (done|completed|finished|resolved|fixed)\b/.test(s)) status = 'done';
    return { type, status };
  }

  function parsePriority(t) {
    const s = t.toLowerCase();
    if (/\b(p1|sev ?1|critical|major outage|outage|down for everyone|campus[- ]wide)\b/.test(s)) return 'critical';
    if (/\b(p2|urgent|asap|high priority|vip|dean|president|executive)\b/.test(s)) return 'high';
    if (/\b(low priority|whenever|nice to have|p4)\b/.test(s)) return 'low';
    return 'normal';
  }

  function parseTicket(t) {
    const m = t.match(/\b((?:INC|REQ|RITM|CHG|TASK|SR|PRB)\d{3,})\b/i) || t.match(/\bticket\s*(?:number|no\.?|#)?\s*(\d{3,})\b/i) || t.match(/#(\d{3,})\b/);
    return m ? m[1].toUpperCase() : '';
  }

  function parseLocation(t) {
    const m = t.match(/\b(HQ|COE|SOFS|COM)\b/) || t.match(/\b(rustaq)\b/i);
    return m ? (m[1].toLowerCase() === 'rustaq' ? 'Rustaq' : m[1]) : '';
  }

  function parseTags(t) {
    const tags = new Set();
    (t.match(/#[a-z][\w-]{1,30}/gi) || []).forEach((x) => tags.add(x.slice(1).toLowerCase()));
    return [...tags];
  }

  function parseWhen(t, base) {
    const s = t.toLowerCase();
    const d = new Date(base || Date.now());
    if (/\byesterday\b/.test(s) && !/\b(need to|tomorrow)\b/.test(s)) d.setDate(d.getDate() - 1);
    const m = s.match(/\bat (\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/);
    if (m && /\b(this morning|earlier|at \d)/.test(s) && !/\b(need to|tomorrow|will)\b/.test(s)) {
      let h = parseInt(m[1], 10);
      const ap = (m[3] || '').replace(/\./g, '');
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      if (!ap && h < 7) h += 12;
      if (h <= 23) d.setHours(h, parseInt(m[2] || '0', 10), 0, 0);
    }
    return d;
  }

  function parseDue(t) {
    const s = t.toLowerCase();
    const today = U.startOfDay(new Date());
    if (/\btomorrow\b/.test(s)) return U.ymd(U.addDays(today, 1));
    if (/\bnext week\b/.test(s)) return U.ymd(U.addDays(today, 7));
    const dn = U.DAYS.findIndex((d) => new RegExp(`\\b(by|on|this|next) ${d.toLowerCase()}\\b`).test(s));
    if (dn >= 0) { let diff = (dn - today.getDay() + 7) % 7 || 7; return U.ymd(U.addDays(today, diff)); }
    if (/\b(today|end of day|eod)\b/.test(s)) return U.ymd(today);
    return null;
  }

  function makeTitle(text) {
    let s = text.trim()
      .replace(/^(so|ok|okay|um+|uh+|well|right|yeah|alright)[, ]+/i, '')
      .replace(/^(i|we)\s+(have\s+|had\s+|just\s+)?/i, '')
      .replace(/\s+/g, ' ');
    const first = s.split(/(?<=[.!?])\s+/)[0];
    s = first.length > 12 ? first : s;
    s = s.replace(/[.!?]+$/, '');
    if (s.length > 90) s = s.slice(0, 87).replace(/\s+\S*$/, '') + '…';
    return U.capitalize(s);
  }

  /** Split one dictated message into multiple jobs when the user chains them. */
  function splitSegments(text) {
    const parts = text
      .split(/(?:[.;]\s+|,\s*|\s+)(?:also|another thing(?: is)?|next(?: one)?|after that|then i|and then|apart from that|besides that|secondly|thirdly|lastly|finally)[,:]?\s+/i)
      .map((s) => s.trim())
      .filter(Boolean);
    const merged = [];
    for (const p of parts) {
      if (merged.length && p.length < 18) merged[merged.length - 1] += ' ' + p;
      else merged.push(p);
    }
    return merged.length ? merged : [text];
  }

  function parseOne(text, opts = {}) {
    const clean = text.trim();
    const { type, status } = parseStatusAndType(clean);
    const when = parseWhen(clean, opts.when);
    return {
      title: makeTitle(clean),
      details: clean,
      category: Categories.classify(clean),
      type,
      status,
      priority: parsePriority(clean),
      minutes: parseDuration(clean),
      ticket: parseTicket(clean),
      location: parseLocation(clean),
      tags: parseTags(clean),
      due: type !== 'entry' && status !== 'done' ? parseDue(clean) : null,
      when: when.toISOString(),
      source: opts.source || 'manual',
    };
  }

  function parse(text, opts = {}) {
    if (!text || !text.trim()) return [];
    const segs = opts.split === false ? [text] : splitSegments(text);
    return segs.map((s) => parseOne(s, opts));
  }

  WL.Parser = { parse, parseOne, parseDuration, splitSegments };
})(window.WL);
