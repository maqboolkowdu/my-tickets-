/* OpsLog — the check-in agent: work-hours scheduler + "phone call" conversation. */
(function (WL) {
  'use strict';
  const { U, Store, Voice, Parser, Categories, Reports } = WL;

  const GRACE_MIN = 10; // ring if the tab wakes up within 10 min of a missed slot
  const S = {
    phase: 'idle', // idle | ringing | active
    mode: null, // scheduled | wrapup | manual | retry
    slotMin: null,
    ringTimeout: null,
    snoozeTimer: null,
    retryTimer: null,
    startedAt: null,
    clock: null,
    savedThisCall: [],
    pending: null, // resolver for the user's next turn
    micOn: true,
    lastAsked: null,
  };

  /* ===================== Scheduler ===================== */

  function slotsFor(date) {
    const s = Store.settings;
    const dow = date.getDay();
    const step = Math.max(5, Number(s.interval) || 30);
    const set = new Set();
    for (const w of s.schedule || []) {
      if (!w.days.includes(dow) || !w.start || !w.end) continue;
      for (let m = U.toMin(w.start); m <= U.toMin(w.end); m += step) set.add(m);
    }
    return [...set].sort((a, b) => a - b);
  }

  function nextSlot(from = new Date()) {
    const nowMin = from.getHours() * 60 + from.getMinutes();
    for (let i = 0; i < 8; i++) {
      const d = U.addDays(U.startOfDay(from), i);
      const slots = slotsFor(d).filter((m) => i > 0 || m > nowMin || (m === nowMin && from.getSeconds() < 5));
      if (slots.length) { const t = new Date(d); t.setHours(0, slots[0], 0, 0); return t; }
    }
    return null;
  }

  function prevSlotLabel(now = new Date()) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const earlier = slotsFor(now).filter((m) => m < nowMin - 1);
    return earlier.length ? U.fmt12(U.fromMin(earlier[earlier.length - 1])) : null;
  }

  function isWorkingNow(now = new Date()) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const dow = now.getDay();
    return (Store.settings.schedule || []).some((w) => w.days.includes(dow) && nowMin >= U.toMin(w.start) && nowMin <= U.toMin(w.end));
  }

  function tick() {
    if (!Store.settings.agentEnabled || S.phase !== 'idle') return;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const slots = slotsFor(now);
    const due = slots.filter((m) => m <= nowMin && nowMin - m <= GRACE_MIN).pop();
    if (due === undefined) return;
    const key = `${U.ymd(now)}@${U.fromMin(due)}`;
    if (Store.wasFired(key)) return;
    Store.markFired(key);
    const isLast = due === slots[slots.length - 1];
    ring({ mode: isLast ? 'wrapup' : 'scheduled', slotMin: due });
  }

  /* ===================== Call UI ===================== */
  const el = (id) => document.getElementById(id);

  function showOverlay(phase) {
    const o = el('call');
    o.classList.remove('hidden');
    o.dataset.phase = phase;
    document.body.classList.add('in-call');
  }

  function setStatus(txt) { el('callStatus').textContent = txt; }

  function bubble(who, text, extra = '') {
    const c = el('callConvo');
    const b = document.createElement('div');
    b.className = `bubble ${who}`;
    b.innerHTML = `${U.esc(text)}${extra}`;
    c.appendChild(b);
    c.scrollTop = c.scrollHeight;
    return b;
  }

  function live(text) {
    const l = el('callLive');
    l.textContent = text || '';
    l.classList.toggle('show', !!text);
  }

  function setListeningUI(on) {
    el('call').classList.toggle('listening', !!on);
    el('btnMic').classList.toggle('off', !S.micOn);
    el('btnMic').innerHTML = U.icon(S.micOn ? 'mic' : 'micOff');
  }

  function notify(title, body, data = {}) {
    if (!Store.settings.notifications || !('Notification' in window) || Notification.permission !== 'granted') return;
    const opts = {
      body, tag: 'opslog-call', renotify: true, requireInteraction: true, icon: 'assets/icons/icon-192.png', badge: 'assets/icons/icon-192.png',
      vibrate: [400, 200, 400, 200, 400], data,
      actions: [{ action: 'answer', title: 'Answer' }, { action: 'snooze', title: 'Snooze 10 min' }],
    };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, opts)).catch(() => {});
    } else {
      try { const n = new Notification(title, opts); n.onclick = () => { window.focus(); answer(); n.close(); }; } catch { /* noop */ }
    }
  }
  function closeNotifications() {
    if (navigator.serviceWorker) navigator.serviceWorker.ready.then((reg) => reg.getNotifications({ tag: 'opslog-call' }).then((ns) => ns.forEach((n) => n.close()))).catch(() => {});
  }

  function ring({ mode = 'scheduled', slotMin = null, retry = false } = {}) {
    if (S.phase !== 'idle') return;
    if (!retry) S.retried = false;
    S.phase = 'ringing'; S.mode = mode; S.slotMin = slotMin;
    const agent = Store.settings.agentName || 'Ava';
    el('callTitle').textContent = `${agent} · OpsLog Assistant`;
    const t = slotMin != null ? U.fmt12(U.fromMin(slotMin)) : U.fmtTime(new Date());
    el('callSub').textContent = mode === 'wrapup' ? `End-of-day wrap-up · ${t}` : mode === 'manual' ? `Quick log · ${t}` : `Work check-in · ${t}`;
    el('callConvo').innerHTML = '';
    el('callTimer').textContent = '';
    live('');
    setStatus('Incoming call…');
    showOverlay('ringing');
    Voice.startRing();
    if (document.hidden || !document.hasFocus()) notify(`📞 ${agent} is calling`, mode === 'wrapup' ? 'End-of-day wrap-up — tell me what you finished today.' : `${t} check-in — what have you been working on?`, { mode, slotMin });
    document.title = '📞 Incoming check-in — OpsLog';
    clearTimeout(S.ringTimeout);
    S.ringTimeout = setTimeout(missed, (Store.settings.ringSeconds || 45) * 1000);
  }

  function stopRinging() {
    clearTimeout(S.ringTimeout);
    Voice.stopRing();
    closeNotifications();
    document.title = 'OpsLog — Work Journal';
  }

  function hide() {
    WL.LibraryUI && WL.LibraryUI.hidePicker();
    el('call').classList.add('hidden');
    document.body.classList.remove('in-call');
    S.phase = 'idle';
  }

  function missed() {
    if (S.phase !== 'ringing') return;
    stopRinging();
    hide();
    Store.logCall({ kind: S.mode, slot: S.slotMin, outcome: 'missed' });
    U.toast('Missed check-in call — tap the phone button to log your update.', 'warn', 6000);
    notify('Missed check-in', 'Tap to log what you have been working on.', {});
    if (Store.settings.reRingMissed && !S.retried) {
      S.retried = true;
      clearTimeout(S.retryTimer);
      const mode = S.mode === 'wrapup' ? 'wrapup' : 'retry', slotMin = S.slotMin;
      S.retryTimer = setTimeout(() => ring({ mode, slotMin, retry: true }), 5 * 60 * 1000);
    }
    WL.App && WL.App.refresh();
  }

  function decline() {
    if (S.phase !== 'ringing') return;
    stopRinging(); hide();
    Store.logCall({ kind: S.mode, slot: S.slotMin, outcome: 'declined' });
    U.toast('Call declined. I will check in at the next slot.', 'info');
    WL.App && WL.App.refresh();
  }

  function snooze(mins = 10) {
    if (S.phase !== 'ringing') return;
    stopRinging(); hide();
    Store.logCall({ kind: S.mode, slot: S.slotMin, outcome: 'snoozed' });
    const mode = S.mode, slotMin = S.slotMin;
    clearTimeout(S.snoozeTimer);
    S.snoozeTimer = setTimeout(() => ring({ mode, slotMin, retry: true }), mins * 60 * 1000);
    U.toast(`Snoozed — I'll call back in ${mins} minutes.`, 'info');
  }

  function answer() {
    if (S.phase !== 'ringing') return;
    stopRinging();
    startCall(S.mode, S.slotMin);
  }

  /** Start an outgoing call (user taps the phone button). */
  function startManual() {
    if (S.phase === 'active') return;
    if (S.phase === 'ringing') return answer();
    el('callTitle').textContent = `${Store.settings.agentName || 'Ava'} · OpsLog Assistant`;
    el('callSub').textContent = 'You called · ' + U.fmtTime(new Date());
    el('callConvo').innerHTML = '';
    startCall('manual', null);
  }

  function startCall(mode, slotMin) {
    S.phase = 'active'; S.mode = mode; S.slotMin = slotMin;
    S.savedThisCall = [];
    S.micOn = Voice.supported.stt && Store.settings.autoListen;
    showOverlay('active');
    setListeningUI(false);
    Voice.chime('up');
    S.startedAt = Date.now();
    clearInterval(S.clock);
    S.clock = setInterval(() => {
      const s = Math.floor((Date.now() - S.startedAt) / 1000);
      el('callTimer').textContent = `${U.pad(Math.floor(s / 60))}:${U.pad(s % 60)}`;
    }, 1000);
    setStatus('Connected');
    el('callForm').classList.toggle('show', !Voice.supported.stt || !S.micOn);
    if (!Voice.supported.stt || !S.micOn) setTimeout(() => WL.LibraryUI && WL.LibraryUI.showPicker('home'), 50); else WL.LibraryUI && WL.LibraryUI.hidePicker();
    conversation(mode).catch((e) => { console.error(e); endCall(); });
  }

  function endCall(silent = false) {
    if (S.phase !== 'active') return;
    S.phase = 'ending';
    Voice.stopSpeaking();
    Voice.stopListening();
    clearInterval(S.clock);
    if (S.pending) { const p = S.pending; S.pending = null; p(null); }
    const n = S.savedThisCall.length;
    Store.logCall({ kind: S.mode, slot: S.slotMin, outcome: 'answered', entries: n, seconds: Math.round((Date.now() - S.startedAt) / 1000) });
    if (!silent) Voice.chime('end');
    setStatus('Call ended');
    const mode = S.mode;
    setTimeout(() => {
      hide();
      if (n) U.toast(`Saved ${n} item${n > 1 ? 's' : ''} from the call.`, 'success');
      WL.App && WL.App.refresh();
      if (mode === 'wrapup') WL.App && WL.App.showWrapUp();
    }, 700);
  }

  /* ===================== Conversation ===================== */

  async function say(text) {
    if (S.phase !== 'active') return;
    bubble('agent', text);
    setStatus('Speaking…');
    await Voice.speak(text);
    if (S.phase === 'active') setStatus('Connected');
  }

  /** Waits for the next user turn: voice (if mic on) or typed text, whichever comes first. */
  function userTurn() {
    return new Promise((resolve) => {
      if (S.phase !== 'active') return resolve(null);
      let settled = false;
      const finish = (v) => { if (settled) return; settled = true; S.pending = null; setListeningUI(false); live(''); resolve(v); };
      S.pending = finish;
      if (S.micOn && Voice.supported.stt) {
        setListeningUI(true);
        setStatus('Listening…');
        Voice.listen({ onInterim: (t) => live(t) })
          .then((t) => { if (!settled && S.micOn) finish(t); })
          .catch((err) => {
            S.micOn = false; setListeningUI(false);
            el('callForm').classList.add('show');
            U.toast(err.message + ' — type your update instead.', 'warn');
            setStatus('Type your update');
          });
      } else {
        setStatus('Type your update');
        setTimeout(() => el('callText') && el('callText').focus(), 50);
      }
    });
  }

  /** Switch the call to typing: mic off, text box and Ava's pick-from-menu panel open. */
  function showTyping() {
    if (S.phase !== 'active') return;
    S.micOn = false;
    Voice.stopListening();
    setListeningUI(false);
    el('callForm').classList.add('show');
    WL.LibraryUI && WL.LibraryUI.showPicker('home');
    setStatus('Type or pick from the menu');
    setTimeout(() => el('callText').focus(), 30);
  }

  /** A choice made in the pick-from-menu panel counts as the user's turn. */
  function pickerAction(userText, reply, cards = []) {
    if (S.phase !== 'active') return;
    S.savedThisCall.push(...cards);
    const turn = { action: true, userText, reply, cards };
    if (S.pending) S.pending(turn);
    else { bubble('user', userText); renderSavedCards(cards); say(reply); }
  }

  function submitTyped(text) {
    if (!text.trim()) return;
    Voice.stopListening();
    if (S.pending) S.pending(text.trim());
  }

  function toggleMic() {
    if (!Voice.supported.stt) { U.toast('Voice input needs Chrome, Edge or Safari. You can type instead.', 'warn'); return; }
    S.micOn = !S.micOn;
    setListeningUI(false);
    if (!S.micOn) {
      el('callForm').classList.add('show');
      Voice.stopListening();
      setStatus('Mic muted — type your update');
    } else if (S.pending) {
      // restart listening for the current turn
      const p = S.pending; S.pending = null;
      userTurn().then(p);
    }
  }

  const END_RX = /^(no|nope|nah|nothing( else)?|no thanks?|that'?s (all|it|everything)|i'?m (done|good|fine)|all done|done|bye|goodbye|good ?bye|end( the)? call|hang up|that will be all|not now|later)\b[ .!,]*(thanks?( you)?|bye)?[ .!]*$/i;
  const NOTHING_RX = /^(nothing( new| to report)?|no updates?|same( as before)?|still (on|working on) the same|no new work)\b/i;

  function greeting(mode) {
    const name = Store.settings.name ? Store.settings.name.split(' ')[0] : '';
    const hi = name ? `Hi ${name}` : 'Hi';
    const since = prevSlotLabel();
    if (mode === 'wrapup') {
      const a = Reports.aggregate(Reports.range('day'));
      return `${hi}, it's ${S.agentName()} with your end-of-day wrap-up. So far today you've logged ${a.items.length} item${a.items.length === 1 ? '' : 's'}. Is there anything else you finished or want to carry over to tomorrow?`;
    }
    if (mode === 'manual') return `${hi}, ${S.agentName()} here. What would you like to log?`;
    if (mode === 'retry') return `${hi}, it's ${S.agentName()} again — I missed you earlier. What have you been working on?`;
    const left = WL.Library ? WL.Library.todays().filter((e) => e.status !== 'done').length : 0;
    return `${hi}, it's ${S.agentName()}. Time for your check-in. What have you worked on${since ? ' since ' + since : ' so far'}?${left ? ` You still have ${left} routine check${left > 1 ? 's' : ''} open today; tap the keyboard to tick them off.` : ''}`;
  }
  S.agentName = () => Store.settings.agentName || 'Ava';

  function periodWord(t) {
    if (/\byesterday\b/.test(t)) return { kind: 'day', anchor: U.addDays(new Date(), -1), word: 'yesterday' };
    if (/\b(this|the) week|weekly|week\b/.test(t)) return { kind: 'week', anchor: new Date(), word: 'this week' };
    if (/\bmonth\b/.test(t)) return { kind: 'month', anchor: new Date(), word: 'this month' };
    if (/\bquarter\b/.test(t)) return { kind: 'quarter', anchor: new Date(), word: 'this quarter' };
    if (/\byear\b/.test(t)) return { kind: 'year', anchor: new Date(), word: 'this year' };
    return { kind: 'day', anchor: new Date(), word: 'today' };
  }

  function summarySpeech(kind, anchor, word) {
    const a = Reports.aggregate(Reports.range(kind, anchor));
    if (!a.items.length) return `Nothing logged ${word} yet.`;
    const top = a.cats.slice(0, 3).map((c) => `${c.cat.name} with ${c.n}`).join(', ');
    return `${U.capitalize(word)} you've logged ${a.items.length} items, ${a.done} completed${a.minutes ? ', about ' + U.fmtDuration(a.minutes).replace('h', ' hours').replace('m', ' minutes') : ''}. Top areas: ${top}.`;
  }

  function findTask(text) {
    const words = text.toLowerCase().replace(/\b(mark|set|the|task|as|done|complete|completed|finished|close|closed|is|it|that|for)\b/g, ' ').split(/\W+/).filter((w) => w.length > 2);
    let best = null, bestScore = 0;
    for (const t of Store.openTasks()) {
      const hay = (t.title + ' ' + t.details).toLowerCase();
      const score = words.filter((w) => hay.includes(w)).length;
      if (score > bestScore) { best = t; bestScore = score; }
    }
    return bestScore ? best : null;
  }

  /** Decide how to respond to one user utterance. Returns {reply, end}. */
  function handle(text) {
    const t = text.toLowerCase().trim();

    if (END_RX.test(t) && t.length < 45) return { end: true };
    if (NOTHING_RX.test(t) && t.length < 60) {
      Store.logCall({ kind: 'note', outcome: 'no-update' });
      return { end: true, reply: 'No problem. Keep at it.' };
    }
    if (/^(help|what can you do|options)\b/.test(t)) {
      return { reply: 'Just tell me what you did, like "reset MFA for a student and revoked sessions, took 10 minutes". You can also say "what did I do today", "open tasks", "library", "run daily checks", a ticket ID like "FGT-07 done", or tap the keyboard to pick from a menu. Say "that\'s all" to hang up.' };
    }
    // Task library: ticket IDs, packages, menu
    const Lib = WL.Library;
    const ids = Lib ? Lib.idsIn(text) : [];
    if (ids.length) {
      const done = /\b(done|completed|complete|finished|resolved|checked|ok|all good|green)\b/.test(t);
      const res = Lib.assign(ids, { status: done ? 'done' : 'open', source: 'call' });
      const changed = [...res.created, ...res.updated];
      S.savedThisCall.push(...changed);
      renderSavedCards(res.created);
      const same = res.existing.map((x) => x.ticket);
      const sameTxt = same.length ? `${same.join(', ')} ${same.length > 1 ? 'were' : 'was'} already ${done ? 'done' : 'on your list'}.` : '';
      if (!changed.length) return { reply: `${sameTxt} Anything else?` };
      return { reply: `${done ? 'Marked' : 'Created'} ${changed.map((x) => x.ticket).join(', ')}${done ? ' as done' : ''}. ${sameTxt} Anything else?`.replace('  ', ' ') };
    }
    if (Lib && /^(run|start|assign|kick off)\b/.test(t) && Lib.findPackage(t)) {
      const p = Lib.findPackage(t);
      const res = Lib.runPackage(p, { source: 'call' });
      S.savedThisCall.push(...res.created);
      return { reply: res.created.length ? `Running “${p.name}”: ${res.created.length} ticket${res.created.length > 1 ? 's' : ''} added to your list. Anything else?` : `Everything in “${p.name}” is already on your list. Anything else?` };
    }
    if (Lib && /\b(library|templates?|pick (a )?task|menu)\b/.test(t)) {
      WL.LibraryUI.showPicker('areas');
      return { reply: 'Here’s your task library. Pick an area, tick the tasks, then create the tickets.' };
    }
    if (Lib && /\b(packages?|routines?)\b/.test(t)) {
      WL.LibraryUI.showPicker('packages');
      return { reply: 'Here are your packages. Tap Run on the one you want.' };
    }
    if (Lib && /\b(due today|what'?s due|today'?s (checks|tasks|routine))\b/.test(t)) {
      const left = Lib.todays().filter((e) => e.status !== 'done');
      WL.LibraryUI.showPicker(left.length ? 'checks' : 'due');
      return { reply: left.length ? `You have ${left.length} routine check${left.length > 1 ? 's' : ''} open today. Tap one to mark it done, or say its ID, like “AD-01 done”.` : 'Your routine checks are all done. Here’s anything else due today.' };
    }
    if (/\b(what did i do|summary|summarise|summarize|recap|how many|how much|report)\b/.test(t) && !/\b(fixed|reset|created|configured)\b/.test(t)) {
      const p = periodWord(t);
      return { reply: summarySpeech(p.kind, p.anchor, p.word) + ' Anything else?' };
    }
    if (/\b(open|pending|outstanding|my) (tasks|jobs|items)\b|\bwhat'?s (pending|open|left)\b/.test(t)) {
      const all = Store.openTasks();
      const open = all.filter((x) => !x.templateId).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
      const routine = all.length - open.length;
      const extra = routine ? ` Plus ${routine} routine check${routine > 1 ? 's' : ''}.` : '';
      if (!open.length) return { reply: `You have no open tasks of your own.${extra} Anything else?` };
      const list = open.slice(0, 3).map((x) => x.title).join('; ');
      return { reply: `You have ${open.length} open task${open.length > 1 ? 's' : ''}. ${open.length > 3 ? 'The top three are' : 'They are'}: ${list}.${extra} Anything else?` };
    }
    if (/^(mark|set|close|complete)\b.*\b(done|complete|completed|finished|closed)?\b/.test(t) && /\b(done|complete|completed|finished|close|closed)\b/.test(t)) {
      const task = findTask(t);
      if (task) {
        Store.update(task.id, { status: 'done' });
        S.savedThisCall.push(task);
        return { reply: `Marked "${task.title}" as done. Anything else?` };
      }
      return { reply: "I couldn't find a matching open task. Tell me what you did and I'll log it." };
    }

    const parsed = Parser.parse(text, { source: S.mode === 'manual' ? 'voice' : 'call' });
    if (!parsed.length) return { reply: "Sorry, I didn't get that. Could you say it again?" };
    const saved = Store.addMany(parsed);
    S.savedThisCall.push(...saved);
    renderSavedCards(saved);
    const desc = saved.map((e) => {
      const cat = Categories.get(e.category).name;
      const kind = e.type === 'entry' ? '' : e.status === 'done' ? ' (done)' : ` as an open ${e.type}`;
      return `${cat}${kind}`;
    });
    const missingTime = saved.some((e) => !e.minutes && e.type === 'entry');
    const lead = saved.length === 1 ? `Got it — logged under ${desc[0]}.` : `Got it — logged ${saved.length} items: ${desc.join(', ')}.`;
    S.lastAsked = missingTime && saved.length === 1 ? { kind: 'duration', id: saved[0].id } : null;
    return { reply: `${lead} ${S.lastAsked ? 'Roughly how long did it take? Or tell me the next thing.' : 'Anything else?'}` };
  }

  function renderSavedCards(list) {
    list.forEach((e) => {
      const c = Categories.get(e.category);
      bubble('saved', '', `<div class="saved-card" data-id="${e.id}" style="--cat:${c.color}">
        <span class="chip" style="--cat:${c.color}">${U.esc(c.name)}</span>
        <strong>${U.safe(e.title)}</strong>
        <small>${e.type !== 'entry' ? U.esc(e.type) + ' · ' : ''}${U.esc(e.status)}${e.minutes ? ' · ' + U.fmtDuration(e.minutes) : ''}${e.ticket ? ' · ' + U.esc(e.ticket) : ''}</small>
        <button class="link-btn" data-edit="${e.id}">Edit</button></div>`);
    });
  }

  async function conversation(mode) {
    await say(greeting(mode));
    let misses = 0;
    while (S.phase === 'active') {
      const text = await userTurn();
      if (S.phase !== 'active' || text === null) break;
      if (typeof text === 'object') {
        misses = 0;
        bubble('user', text.userText);
        renderSavedCards(text.cards || []);
        await say(text.reply);
        continue;
      }
      if (!text) {
        const picker = document.getElementById('callPicker');
        if (picker && !picker.hidden) continue;
        misses++;
        if (misses >= 2) { await say(`I'll let you get back to it. You can tap the phone button anytime to log something.`); break; }
        await say("Sorry, I didn't catch that. Go ahead — or type it below.");
        el('callForm').classList.add('show');
        continue;
      }
      misses = 0;
      bubble('user', text);

      // Follow-up answer to "how long did it take?"
      if (S.lastAsked && S.lastAsked.kind === 'duration') {
        const mins = Parser.parseDuration(text);
        const id = S.lastAsked.id;
        S.lastAsked = null;
        if (mins && text.split(/\s+/).length <= 8) {
          Store.update(id, { minutes: mins });
          await say(`Noted, ${U.fmtDuration(mins).replace('h', ' hours').replace('m', ' minutes')}. Anything else?`);
          continue;
        }
      }

      const res = handle(text);
      if (res.end) {
        const n = S.savedThisCall.length;
        const next = nextSlot(new Date(Date.now() + 60000));
        let bye = res.reply ? res.reply + ' ' : '';
        bye += n ? `Thanks — ${n} item${n > 1 ? 's' : ''} saved.` : 'Okay.';
        if (S.mode === 'wrapup') {
          bye += ' ' + summarySpeech('day', new Date(), 'today');
          const flags = ['week', 'month', 'quarter', 'year'].filter((k) => Reports.isLastWorkdayOf(k, new Date()));
          if (flags.length) bye += ` It's also the end of the ${flags.join(', the ')}, so your ${flags[flags.length - 1]}ly report is ready on screen.`;
          bye += ' Have a good evening!';
        } else if (next) {
          bye += ` I'll check in again ${U.sameDay(next, new Date()) ? 'at ' + U.fmtTime(next) : U.relDay(next).toLowerCase() === 'tomorrow' ? 'tomorrow at ' + U.fmtTime(next) : 'on ' + U.DAYS[next.getDay()] + ' at ' + U.fmtTime(next)}.`;
        }
        await say(bye.replace('yearly', 'annual').replace('dayly', 'daily'));
        break;
      }
      await say(res.reply);
    }
    endCall();
  }

  /* ===================== Wiring ===================== */
  function init() {
    el('btnAnswer').addEventListener('click', answer);
    el('btnDecline').addEventListener('click', decline);
    el('btnSnooze').addEventListener('click', () => snooze(10));
    el('btnEnd').addEventListener('click', () => endCall());
    el('btnMic').addEventListener('click', toggleMic);
    el('btnKeyboard').addEventListener('click', () => {
      const picker = document.getElementById('callPicker');
      if (el('callForm').classList.contains('show') && picker && !picker.hidden) { WL.LibraryUI.hidePicker(); return; }
      showTyping();
    });
    el('callForm').addEventListener('submit', (ev) => { ev.preventDefault(); const v = el('callText').value; el('callText').value = ''; submitTyped(v); });
    el('callConvo').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-edit]');
      if (b) WL.App.openEditor(b.dataset.edit);
    });
    document.addEventListener('keydown', (ev) => {
      if (S.phase === 'ringing' && ev.key === 'Enter') answer();
      if (S.phase === 'ringing' && ev.key === 'Escape') decline();
    });

    // Messages from the service worker (notification actions)
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (ev) => {
        const d = ev.data || {};
        if (d.type === 'answer') { window.focus(); if (S.phase === 'ringing') answer(); else startManual(); }
        if (d.type === 'snooze') snooze(10);
      });
    }

    // Launched by the Windows scheduled task / notification: ?call=1
    const params = new URLSearchParams(location.search);
    if (params.has('call')) {
      history.replaceState(null, '', location.pathname + location.hash);
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const slots = slotsFor(now);
      const due = slots.filter((m) => m <= nowMin && nowMin - m <= GRACE_MIN).pop();
      if (due !== undefined) Store.markFired(`${U.ymd(now)}@${U.fromMin(due)}`);
      const isLast = due !== undefined && due === slots[slots.length - 1];
      const want = params.get('call');
      const mode = want === 'manual' ? 'manual' : want === 'wrapup' || isLast ? 'wrapup' : 'scheduled';
      setTimeout(() => ring({ mode, slotMin: mode === 'manual' ? null : due ?? null }), 600);
    }

    setInterval(tick, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    setTimeout(tick, 2000);
  }

  WL.Agent = { init, slotsFor, nextSlot, isWorkingNow, ring, startManual, endCall, pickerAction, showTyping, state: S, test: () => ring({ mode: 'scheduled', slotMin: null }) };
})(window.WL);
