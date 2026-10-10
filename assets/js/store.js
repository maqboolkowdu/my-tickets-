/* OpsLog — local persistence (browser localStorage) + settings. */
(function (WL) {
  'use strict';
  const { U } = WL;

  const K_DATA = 'opslog:entries:v1';
  const K_SET = 'opslog:settings:v1';
  const K_CALLS = 'opslog:calls:v1';
  const K_FIRED = 'opslog:fired:v1';

  const DEFAULT_SETTINGS = {
    name: '',
    role: 'Network & Systems Engineer',
    org: 'Campus IT',
    theme: 'system',
    showcase: false,
    weekStart: 0, // 0 = Sunday
    interval: 30,
    schedule: [
      { days: [0, 1, 2, 3], start: '08:00', end: '14:00' },
      { days: [0, 1, 2, 3], start: '15:00', end: '16:00' },
      { days: [4], start: '08:00', end: '15:00' },
    ],
    agentEnabled: true,
    agentName: 'Ava',
    ringtone: true,
    ringSeconds: 45,
    reRingMissed: true,
    voice: '',
    voiceRate: 1.02,
    lang: 'en-US',
    autoListen: true,
    notifications: true,
  };

  const read = (k, fallback) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  };
  const write = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { console.error(e); U.toast('Could not save — browser storage is full or blocked', 'error'); return false; }
  };

  const listeners = new Set();
  const emit = (what) => listeners.forEach((fn) => { try { fn(what); } catch (e) { console.error(e); } });

  const Store = {
    entries: read(K_DATA, []),
    settings: Object.assign({}, DEFAULT_SETTINGS, read(K_SET, {})),
    calls: read(K_CALLS, []),
    DEFAULT_SETTINGS,

    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    persist() { write(K_DATA, this.entries); emit('entries'); },

    make(data) {
      const now = new Date().toISOString();
      const e = Object.assign({
        id: U.uid(), when: now, created: now, updated: now, title: '', details: '', category: 'other',
        type: 'entry', status: 'done', priority: 'normal', minutes: null, ticket: '', tags: [], due: null, source: 'manual',
      }, data);
      if (e.status === 'done' && !e.completedAt) e.completedAt = e.type === 'entry' ? e.when : now;
      return e;
    },

    add(data) { const e = this.make(data); this.entries.push(e); this.persist(); return e; },

    addMany(list) { const out = list.map((d) => this.make(d)); this.entries.push(...out); this.persist(); return out; },

    update(id, patch) {
      const e = this.entries.find((x) => x.id === id);
      if (!e) return null;
      const wasDone = e.status === 'done';
      Object.assign(e, patch, { updated: new Date().toISOString() });
      if (e.status === 'done' && !wasDone) e.completedAt = new Date().toISOString();
      if (e.status !== 'done') e.completedAt = null;
      this.persist();
      return e;
    },

    remove(id) { this.entries = this.entries.filter((x) => x.id !== id); this.persist(); },

    get(id) { return this.entries.find((x) => x.id === id); },

    /** Entries whose work date (or completion date for tasks) falls in [start, end). */
    inRange(start, end) {
      const s = start.getTime(), en = end.getTime();
      return this.entries.filter((e) => {
        const t = new Date(e.status === 'done' && e.completedAt && e.type !== 'entry' ? e.completedAt : e.when).getTime();
        return t >= s && t < en;
      });
    },

    openTasks() { return this.entries.filter((e) => e.type !== 'entry' && e.status !== 'done'); },

    saveSettings(patch) {
      Object.assign(this.settings, patch);
      write(K_SET, this.settings);
      emit('settings');
    },

    logCall(rec) {
      this.calls.push(Object.assign({ ts: new Date().toISOString() }, rec));
      if (this.calls.length > 5000) this.calls = this.calls.slice(-5000);
      write(K_CALLS, this.calls);
      emit('calls');
    },

    /* Slots that already rang (so multiple tabs / reloads don't ring twice). */
    wasFired(key) { return read(K_FIRED, []).includes(key); },
    markFired(key) {
      const today = U.ymd(U.addDays(new Date(), -2));
      const list = read(K_FIRED, []).filter((k) => k.slice(0, 10) >= today);
      if (!list.includes(key)) list.push(key);
      write(K_FIRED, list);
    },

    exportJSON() {
      return JSON.stringify({ app: 'OpsLog', version: 1, exported: new Date().toISOString(), settings: this.settings, entries: this.entries, calls: this.calls }, null, 2);
    },

    importJSON(text, mode = 'merge') {
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.entries)) throw new Error('Not an OpsLog backup file');
      if (mode === 'replace') { this.entries = data.entries; this.calls = data.calls || []; }
      else {
        const ids = new Set(this.entries.map((e) => e.id));
        data.entries.forEach((e) => { if (!ids.has(e.id)) this.entries.push(e); });
        (data.calls || []).forEach((c) => this.calls.push(c));
      }
      if (data.settings && mode === 'replace') this.saveSettings(data.settings);
      write(K_CALLS, this.calls);
      this.persist();
      return data.entries.length;
    },

    clearAll() { this.entries = []; this.calls = []; write(K_CALLS, []); this.persist(); },
  };

  WL.Store = Store;
})(window.WL);
