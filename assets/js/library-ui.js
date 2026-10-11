/* OpsLog — Task Library screen, package builder, and Ava's pick-from-menu panel. */
(function (WL) {
  'use strict';
  const { U, Store, Categories, Library } = WL;
  const $ = U.$, $$ = U.$$;
  const A = () => WL.AppUI;

  const st = { tab: 'templates', area: '', q: '', cad: '', loc: '', sel: new Set() };
  const CAD_LABEL = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', 'ad-hoc': 'On demand' };
  const MODE_LABEL = { cadence: 'Routine · follows each task’s schedule', days: 'On selected days', manual: 'Manual — run when you need it' };

  /* ---------------- shared bits ---------------- */
  function todayState(t) {
    const inst = Library.instance(t);
    if (inst && inst.status === 'done') return '<span class="badge st-done">Done today</span>';
    if (inst && inst.status !== 'skipped') return '<span class="badge st-open">Assigned</span>';
    if (Library.isDue(t, new Date())) return '<span class="badge due">Due today</span>';
    return '';
  }
  const cadChip = (t) => `<span class="badge cad-${Library.cadence(t)}">${CAD_LABEL[Library.cadence(t)]} · ${U.esc(Library.scheduleLabel(t))}</span>`;

  function filtered() {
    const q = st.q.toLowerCase();
    return Library.all().filter((t) =>
      (!st.area || (st.area === 'due' ? Library.isDue(t, new Date()) : t.area.id === st.area)) &&
      (!st.cad || Library.cadence(t) === st.cad) &&
      (!st.loc || t.location === st.loc) &&
      (!q || `${t.id} ${t.title} ${t.area.name} ${t.location}`.toLowerCase().includes(q)));
  }

  /* ---------------- view ---------------- */
  function view() {
    U.$('#pageSub').textContent = 'Pick tasks from your operations library, or bundle them into routines';
    const tabs = `<div class="seg lib-tabs" role="tablist">
      <button role="tab" class="${st.tab === 'templates' ? 'on' : ''}" data-lib-tab="templates">${U.icon('library')} Templates</button>
      <button role="tab" class="${st.tab === 'packages' ? 'on' : ''}" data-lib-tab="packages">${U.icon('package')} Packages & routines</button></div>`;
    return tabs + (st.tab === 'templates' ? templatesView() : packagesView());
  }

  function templatesView() {
    const areas = Library.areas();
    const today = new Date();
    const dueCount = Library.all().filter((t) => Library.isDue(t, today)).length;
    const areaBtn = (id, name, count, color, extra = '') => `<button class="area-btn ${st.area === id ? 'on' : ''}" data-area="${id}">
      ${color ? `<span class="dot" style="background:${color}"></span>` : U.icon(id === 'due' ? 'clock' : 'library')}
      <span class="ab-name">${U.esc(name)}</span>${extra}<span class="ab-count">${count}</span></button>`;
    const list = filtered();
    const area = areas.find((a) => a.id === st.area);
    const groups = st.area && st.area !== 'due' ? [[area, list]] : areas.map((a) => [a, list.filter((t) => t.area.id === a.id)]).filter(([, l]) => l.length);
    const locs = Library.LOCATIONS;

    return `
      <div class="lib">
        <aside class="lib-areas card" aria-label="Areas">
          <label class="search sm">${U.icon('search')}<input id="libQ" placeholder="Search tasks or IDs (e.g. FGT-07)" value="${U.esc(st.q)}" /></label>
          <div class="area-list">
            ${areaBtn('', 'All areas', Library.all().length)}
            ${areaBtn('due', 'Due today', dueCount)}
            <div class="area-sep">Areas</div>
            ${areas.map((a) => areaBtn(a.id, a.name, a.tasks.length, Categories.get(a.category).color)).join('')}
          </div>
          <button class="btn btn-ghost block" id="newTpl">${U.icon('plus')} New template</button>
        </aside>

        <section class="lib-main">
          ${area ? `<div class="area-head card">
              <div class="ah-title"><span class="dot" style="background:${Categories.get(area.category).color}"></span><h2>${U.esc(area.name)}</h2><span class="muted small">${area.tasks.length} tasks</span></div>
              <p><b>Purpose:</b> ${U.esc(area.purpose)}</p>
              <p class="muted"><b>Scenario:</b> ${U.esc(area.scenario)}</p>
            </div>` : ''}
          <div class="lib-filters">
            <div class="chips">${[['', 'All'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([v, l]) => `<button class="fchip ${st.cad === v ? 'on' : ''}" data-cad="${v}">${l}</button>`).join('')}</div>
            <select id="libLoc" aria-label="Campus"><option value="">All campuses</option>${locs.map((l) => `<option ${st.loc === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <button class="link-btn" id="selAllVisible">Select all shown</button>
          </div>
          ${list.length ? groups.map(([a, l]) => `
            <div class="tpl-group">
              ${groups.length > 1 || st.area === 'due' ? `<h4 class="tpl-group-h"><span class="dot" style="background:${Categories.get(a.category).color}"></span>${U.esc(a.name)} <span class="muted">· ${l.length}</span></h4>` : ''}
              <div class="card tpl-list">${l.map(tplRow).join('')}</div>
            </div>`).join('') : A().empty('No templates match these filters.')}
        </section>
      </div>
      ${selBar()}`;
  }

  function tplRow(t) {
    const checked = st.sel.has(t.id);
    const script = Library.scripts[t.id] || t.script;
    const custom = t.id.startsWith('MY-');
    return `<div class="tpl-row ${checked ? 'sel' : ''}" style="--cat:${Categories.get(t.area.category).color}">
      <input type="checkbox" id="sel-${t.id}" data-sel="${t.id}" ${checked ? 'checked' : ''} aria-label="Select ${t.id}" />
      <label class="tpl-main" for="sel-${t.id}">
        <span class="tpl-top"><span class="badge mono">${t.id}</span>${cadChip(t)}${A().prBadge(Library.PRIORITY[t.priority])}${t.priority === 'medium' || t.priority === 'low' ? `<span class="badge">${t.priority}</span>` : ''}${A().locBadge(t.location)}${todayState(t)}</span>
        <span class="tpl-title">${U.esc(t.title)}</span>
      </label>
      <div class="tpl-actions">
        <button class="btn btn-ghost sm" data-assign="${t.id}" title="Create an open ticket for today">${U.icon('plus')} Assign</button>
        <button class="icon-btn sm ok" data-logdone="${t.id}" title="Log as done today">${U.icon('check')}</button>
        ${script ? `<button class="icon-btn sm" data-script="${t.id}" title="PowerShell script">${U.icon('code')}</button>` : ''}
        ${custom ? `<button class="icon-btn sm" data-edit-tpl="${t.id}" title="Edit template">${U.icon('edit')}</button>` : ''}
      </div>
    </div>`;
  }

  function selBar() {
    const n = st.sel.size;
    return `<div class="sel-bar ${n ? 'show' : ''}" role="region" aria-label="Selection">
      <b>${n} selected</b>
      <button class="btn btn-primary sm" id="selAssign">${U.icon('plus')} Assign to me</button>
      <button class="btn btn-ghost sm" id="selDone">${U.icon('check')} Log as done</button>
      <select id="selPkg" aria-label="Add to package"><option value="">Add to package…</option>${Library.packages().map((p) => `<option value="${p.id}">${U.esc(p.name)}</option>`).join('')}<option value="__new">+ New package from selection</option></select>
      <button class="link-btn" id="selClear">Clear</button>
    </div>`;
  }

  function packagesView() {
    const pk = Library.packages();
    const on = Store.settings.routinesEnabled !== false;
    const today = new Date();
    return `
      <div class="pkg-head">
        <p class="muted">A <b>package</b> is a named bundle of library tasks. Make it a <b>routine</b> and OpsLog assigns its tasks to you automatically on each working day they're due, the same way your old dashboard showed daily, weekly and monthly tickets.</p>
        <div class="btn-row">
          <label class="field check"><input type="checkbox" id="routinesOn" ${on ? 'checked' : ''}/><span>Run routines automatically</span></label>
          <button class="btn btn-primary" id="newPkg">${U.icon('plus')} New package</button>
        </div>
      </div>
      <div class="pkg-grid">${pk.map((p) => {
        const due = Library.dueInPackage(p, today);
        const assigned = due.filter((id) => { const i = Library.instance(Library.get(id)); return i && i.status !== 'skipped'; }).length;
        return `<article class="card pkg">
          <header class="pkg-top"><div><h3>${U.esc(p.name)}</h3><p class="muted small">${MODE_LABEL[p.mode]}${p.mode === 'days' ? ': ' + p.days.map((d) => U.DAYS_SHORT[d]).join(', ') : ''}</p></div>
            ${p.mode !== 'manual' ? `<label class="switch" title="Assign automatically"><input type="checkbox" data-pkg-auto="${p.id}" ${p.auto ? 'checked' : ''}/><span></span><em>${p.auto ? 'Auto' : 'Off'}</em></label>` : ''}</header>
          <div class="pkg-stats"><span><b>${p.templateIds.length}</b> tasks</span><span><b>${p.mode === 'manual' ? p.templateIds.length : due.length}</b> ${p.mode === 'manual' ? 'per run' : 'due today'}</span>${p.mode !== 'manual' && due.length ? `<span><b>${assigned}</b> assigned</span>` : ''}<span class="muted">${p.lastRun ? 'Last run ' + U.relDay(U.parseYmd(p.lastRun)) : 'Never run'}</span></div>
          <div class="pkg-ids">${p.templateIds.slice(0, 14).map((id) => `<span class="badge mono">${id}</span>`).join('')}${p.templateIds.length > 14 ? `<span class="muted small">+${p.templateIds.length - 14} more</span>` : ''}</div>
          <div class="btn-row">
            <button class="btn btn-primary sm" data-run-pkg="${p.id}">${U.icon('package')} ${p.mode === 'manual' ? 'Run now' : 'Assign what’s due'}</button>
            ${p.mode !== 'manual' ? `<button class="btn btn-ghost sm" data-run-all="${p.id}">Assign all now</button>` : ''}
            <button class="icon-btn sm" data-edit-pkg="${p.id}" title="Edit package" aria-label="Edit ${U.esc(p.name)}">${U.icon('edit')}</button>
          </div>
        </article>`;
      }).join('')}</div>`;
  }

  /* ---------------- actions ---------------- */
  function report(res, verb = 'Assigned') {
    const n = res.created.length + (res.updated ? res.updated.length : 0);
    const skip = res.existing.length;
    if (n) U.toast(`${verb} ${n} ticket${n > 1 ? 's' : ''}${skip ? ` · ${skip} already on your list` : ''}`, 'success');
    else if (skip) U.toast(`Already on your list for this period (${skip})`, 'info');
  }

  function after() {
    const v = $('#view');
    v.querySelectorAll('[data-lib-tab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.libTab; WL.App.render(); }));
    if (st.tab === 'templates') afterTemplates(v); else afterPackages(v);
  }

  function afterTemplates(view) {
    const v = $('.lib', view); // re-created on every render, so listeners never pile up
    const q = $('#libQ');
    q.addEventListener('input', U.debounce(() => { st.q = q.value; WL.App.render(); const n = $('#libQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200));
    v.querySelectorAll('[data-area]').forEach((b) => b.addEventListener('click', () => { st.area = b.dataset.area; WL.App.render(); }));
    v.querySelectorAll('[data-cad]').forEach((b) => b.addEventListener('click', () => { st.cad = b.dataset.cad; WL.App.render(); }));
    $('#libLoc').addEventListener('change', (e) => { st.loc = e.target.value; WL.App.render(); });
    $('#selAllVisible').addEventListener('click', () => { filtered().forEach((t) => st.sel.add(t.id)); WL.App.render(); });
    v.addEventListener('change', (e) => {
      const cb = e.target.closest('[data-sel]');
      if (!cb) return;
      if (cb.checked) st.sel.add(cb.dataset.sel); else st.sel.delete(cb.dataset.sel);
      cb.closest('.tpl-row').classList.toggle('sel', cb.checked);
      const bar = $('.sel-bar'); bar.outerHTML = selBar(); wireSelBar();
    });
    v.addEventListener('click', (e) => {
      const a = e.target.closest('[data-assign]');
      if (a) { report(Library.assign([a.dataset.assign])); return; }
      const d = e.target.closest('[data-logdone]');
      if (d) { report(Library.assign([d.dataset.logdone], { status: 'done' }), 'Logged'); return; }
      const s = e.target.closest('[data-script]');
      if (s) { openScript(s.dataset.script); return; }
      const ed = e.target.closest('[data-edit-tpl]');
      if (ed) openTemplate(ed.dataset.editTpl);
    });
    $('#newTpl').addEventListener('click', () => openTemplate(null));
    wireSelBar();
  }

  function wireSelBar() {
    const ids = () => [...st.sel];
    const clear = () => { st.sel.clear(); WL.App.render(); };
    $('#selAssign').addEventListener('click', () => { report(Library.assign(ids())); clear(); });
    $('#selDone').addEventListener('click', () => { report(Library.assign(ids(), { status: 'done' }), 'Logged'); clear(); });
    $('#selClear').addEventListener('click', clear);
    $('#selPkg').addEventListener('change', (e) => {
      const v = e.target.value;
      if (!v) return;
      if (v === '__new') { openPackage(null, ids()); return; }
      const p = Library.packages().find((x) => x.id === v);
      const before = p.templateIds.length;
      p.templateIds = [...new Set([...p.templateIds, ...ids()])];
      Library.savePackage(p);
      U.toast(`Added ${p.templateIds.length - before} task(s) to “${p.name}”`, 'success');
      clear();
    });
  }

  function afterPackages(view) {
    const v = $('.pkg-grid', view);
    $('#routinesOn').addEventListener('change', (e) => {
      Store.saveSettings({ routinesEnabled: e.target.checked });
      if (e.target.checked) { const c = Library.autoRun(); if (c.length) U.toast(`Assigned ${c.length} routine checks for today`, 'success'); }
    });
    $('#newPkg').addEventListener('click', () => openPackage(null));
    v.addEventListener('change', (e) => {
      const t = e.target.closest('[data-pkg-auto]');
      if (!t) return;
      const p = Library.packages().find((x) => x.id === t.dataset.pkgAuto);
      p.auto = t.checked;
      Library.savePackage(p);
      if (p.auto) { const r = Library.runPackage(p); if (r.created.length) U.toast(`Assigned ${r.created.length} due task(s) from “${p.name}”`, 'success'); }
    });
    v.addEventListener('click', (e) => {
      const r = e.target.closest('[data-run-pkg]');
      if (r) { const p = Library.packages().find((x) => x.id === r.dataset.runPkg); report(Library.runPackage(p, { source: p.mode === 'manual' ? 'library' : 'routine' })); return; }
      const ra = e.target.closest('[data-run-all]');
      if (ra) { const p = Library.packages().find((x) => x.id === ra.dataset.runAll); report(Library.runPackage(p, { force: true, source: 'library' })); return; }
      const ed = e.target.closest('[data-edit-pkg]');
      if (ed) openPackage(ed.dataset.editPkg);
    });
  }

  /* ---------------- dialogs ---------------- */
  function openScript(id) {
    const t = Library.get(id);
    const s = Library.scripts[id] || { name: `${id} script`, purpose: '', code: t.script };
    $('#scriptTitle').textContent = s.name;
    $('#scriptBody').innerHTML = `
      ${s.purpose ? `<p>${U.esc(s.purpose)}</p>` : ''}
      <p class="muted small">Run in an elevated PowerShell session on a domain-joined admin workstation with the ActiveDirectory module. Ticket: <span class="badge mono">${id}</span></p>
      <pre class="code" id="scriptCode">${U.esc(s.code)}</pre>
      <div class="btn-row"><button class="btn btn-primary" id="copyScript">Copy script</button><button class="btn btn-ghost" id="scriptAssign">${U.icon('plus')} Assign ${id} to me</button></div>`;
    $('#copyScript').addEventListener('click', () => {
      navigator.clipboard.writeText(s.code).then(() => U.toast('Script copied', 'success'), () => {
        const r = document.createRange(); r.selectNodeContents($('#scriptCode')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
        U.toast('Press Ctrl+C to copy the selected script', 'info');
      });
    });
    $('#scriptAssign').addEventListener('click', () => report(Library.assign([id])));
    $('#scriptDlg').showModal();
  }

  function openTemplate(id) {
    const t = id ? Library.get(id) : null;
    const f = $('#tplForm');
    const areas = Library.areas();
    $('#tplTitle').textContent = t ? `Edit ${t.id}` : 'New template';
    $('#tArea').innerHTML = areas.map((a) => `<option value="${a.id}">${U.esc(a.name)}</option>`).join('');
    $('#tLoc').innerHTML = ['', ...Library.LOCATIONS].map((l) => `<option value="${l}">${l || '—'}</option>`).join('');
    $('#tDay').innerHTML = U.DAYS.map((d, i) => `<option value="${i}">${d}</option>`).join('');
    $('#tWin').innerHTML = Object.entries(Library.WINDOW_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
    const sched = t ? t.sched : 'd';
    $('#tText').value = t ? t.title : '';
    $('#tArea').value = t ? (t.areaId || t.area.id) : 'custom';
    $('#tCad').value = sched === 'd' ? 'd' : sched === 'x' ? 'x' : sched[0];
    $('#tDay').value = sched[0] === 'w' ? sched.slice(1) : '0';
    $('#tWin').value = sched[0] === 'm' ? sched.slice(1) : '1-7';
    $('#tPri').value = t ? t.priority : 'medium';
    $('#tLoc').value = t ? t.location : '';
    $('#tScript').value = t && t.script ? t.script : '';
    $('#tDelete').hidden = !t;
    const sync = () => { $('#tDayWrap').hidden = $('#tCad').value !== 'w'; $('#tWinWrap').hidden = $('#tCad').value !== 'm'; };
    $('#tCad').onchange = sync; sync();
    f.onsubmit = (ev) => {
      ev.preventDefault();
      const c = $('#tCad').value;
      const tpl = { id: t ? t.id : null, areaId: $('#tArea').value, title: $('#tText').value.trim(), priority: $('#tPri').value, location: $('#tLoc').value,
        sched: c === 'd' ? 'd' : c === 'w' ? 'w' + $('#tDay').value : c === 'm' ? 'm' + $('#tWin').value : 'x', script: $('#tScript').value.trim() || undefined };
      if (!tpl.title) return;
      Library.saveTemplate(tpl);
      $('#tplDlg').close();
      U.toast(t ? 'Template updated' : 'Template added to the library', 'success');
    };
    $('#tDelete').onclick = () => { $('#tplDlg').close(); Library.removeTemplate(t.id); U.toast(`Deleted ${t.id}`, 'success'); };
    $('#tplDlg').showModal();
  }

  /* Package builder */
  let draft = null;
  function openPackage(id, preselect = []) {
    const p = id ? Library.packages().find((x) => x.id === id) : null;
    draft = p ? { ...p, templateIds: [...p.templateIds], days: [...p.days] } : { id: null, name: '', mode: 'cadence', days: [0, 1, 2, 3, 4], auto: true, templateIds: [...preselect], lastRun: null };
    $('#pkgTitle').textContent = p ? 'Edit package' : 'New package';
    $('#pName').value = draft.name;
    $$('input[name="pMode"]').forEach((r) => { r.checked = r.value === draft.mode; });
    $('#pAuto').checked = draft.auto;
    $('#pDelete').hidden = !p;
    $('#pQ').value = '';
    renderPkgPicker();
    $('#pkgDlg').showModal();
  }
  function renderPkgPicker() {
    const mode = $$('input[name="pMode"]').find((r) => r.checked).value;
    draft.mode = mode;
    $('#pDays').hidden = mode !== 'days';
    $('#pAutoWrap').hidden = mode === 'manual';
    $('#pDays').innerHTML = U.DAYS_SHORT.map((d, i) => `<button type="button" class="day ${draft.days.includes(i) ? 'on' : ''}" data-pday="${i}">${d}</button>`).join('');
    const q = $('#pQ').value.toLowerCase();
    $('#pCount').textContent = `${draft.templateIds.length} selected`;
    $('#pList').innerHTML = Library.areas().map((a) => {
      const ts = a.tasks.filter((t) => !q || `${t.id} ${t.title}`.toLowerCase().includes(q));
      if (!ts.length) return '';
      const allOn = ts.every((t) => draft.templateIds.includes(t.id));
      return `<div class="pp-group"><label class="pp-area"><input type="checkbox" data-parea="${a.id}" ${allOn ? 'checked' : ''}/> <span class="dot" style="background:${Categories.get(a.category).color}"></span>${U.esc(a.name)}</label>
        ${ts.map((t) => `<label class="pp-item"><input type="checkbox" data-ptpl="${t.id}" ${draft.templateIds.includes(t.id) ? 'checked' : ''}/><span class="badge mono">${t.id}</span><span class="pp-t">${U.esc(t.title)}</span><span class="muted small">${U.esc(Library.scheduleLabel(t))}</span></label>`).join('')}</div>`;
    }).join('');
  }
  function wirePackageDialog() {
    const dlg = $('#pkgDlg');
    $$('input[name="pMode"]').forEach((r) => r.addEventListener('change', renderPkgPicker));
    $('#pQ').addEventListener('input', U.debounce(renderPkgPicker, 120));
    dlg.addEventListener('click', (e) => {
      const d = e.target.closest('[data-pday]');
      if (d) { const n = Number(d.dataset.pday); draft.days = draft.days.includes(n) ? draft.days.filter((x) => x !== n) : [...draft.days, n].sort(); renderPkgPicker(); }
    });
    $('#pList').addEventListener('change', (e) => {
      const t = e.target.closest('[data-ptpl]');
      if (t) { const id = t.dataset.ptpl; draft.templateIds = t.checked ? [...new Set([...draft.templateIds, id])] : draft.templateIds.filter((x) => x !== id); }
      const a = e.target.closest('[data-parea]');
      if (a) {
        const q = $('#pQ').value.toLowerCase();
        const ids = Library.areas().find((x) => x.id === a.dataset.parea).tasks.filter((t) => !q || `${t.id} ${t.title}`.toLowerCase().includes(q)).map((t) => t.id);
        draft.templateIds = a.checked ? [...new Set([...draft.templateIds, ...ids])] : draft.templateIds.filter((x) => !ids.includes(x));
      }
      renderPkgPicker();
    });
    $('#pkgForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      draft.name = $('#pName').value.trim();
      draft.auto = draft.mode !== 'manual' && $('#pAuto').checked;
      if (!draft.name) { $('#pName').focus(); return; }
      if (!draft.templateIds.length) { U.toast('Pick at least one task for the package', 'warn'); return; }
      if (draft.mode === 'days' && !draft.days.length) { U.toast('Choose at least one day', 'warn'); return; }
      Library.savePackage(draft);
      dlg.close();
      st.sel.clear();
      st.tab = 'packages';
      U.toast(`Saved “${draft.name}”`, 'success');
      if (location.hash !== '#/library') location.hash = '#/library'; else WL.App.render();
    });
    $('#pDelete').addEventListener('click', () => { if (draft.id) { Library.removePackage(draft.id); dlg.close(); U.toast('Package deleted', 'success'); } });
  }

  /* ---------------- Ava's pick-from-menu panel (inside the call) ---------------- */
  const pk = { screen: 'home', area: '', sel: new Set() };
  function pickerHost() { return $('#callPicker'); }
  function showPicker(screen = 'home', arg = '') {
    pk.screen = screen; pk.area = arg; pk.sel.clear();
    const h = pickerHost();
    h.hidden = false;
    renderPicker();
  }
  function hidePicker() { const h = pickerHost(); if (h) h.hidden = true; }

  function act(userText, reply, cards) { WL.Agent.pickerAction(userText, reply, cards); }

  function renderPicker() {
    const h = pickerHost();
    const back = `<button class="pk-chip ghost" data-pk="home">${U.icon('chevL')} Menu</button>`;
    const today = new Date();
    let body = '';
    if (pk.screen === 'home') {
      const due = Library.dueToday().length;
      const todays = Library.todays();
      const left = todays.filter((e) => e.status !== 'done').length;
      const open = Store.openTasks().filter((e) => !e.templateId).length;
      body = `<p class="pk-hint">Pick from the menu, or type below.</p><div class="pk-chips">
        <button class="pk-chip" data-pk="areas">${U.icon('library')} Task library</button>
        <button class="pk-chip" data-pk="due">${U.icon('clock')} Due today <b>${due}</b></button>
        <button class="pk-chip" data-pk="packages">${U.icon('package')} Packages</button>
        <button class="pk-chip" data-pk="checks">${U.icon('check')} Today's checks <b>${left}</b></button>
        <button class="pk-chip" data-pk="open">${U.icon('tasks')} My open tasks <b>${open}</b></button>
        <button class="pk-chip ghost" data-pk="close">${U.icon('x')} Hide menu</button></div>`;
    } else if (pk.screen === 'areas') {
      body = `<div class="pk-chips">${back}${Library.areas().filter((a) => a.tasks.length).map((a) => `<button class="pk-chip" data-pk="area" data-arg="${a.id}"><span class="dot" style="background:${Categories.get(a.category).color}"></span>${U.esc(a.name)} <b>${a.tasks.length}</b></button>`).join('')}</div>`;
    } else if (pk.screen === 'area' || pk.screen === 'due') {
      const list = pk.screen === 'due' ? Library.dueToday() : Library.areas().find((a) => a.id === pk.area).tasks.map((t) => Library.get(t.id));
      const title = pk.screen === 'due' ? 'Due today, not yet assigned' : Library.areas().find((a) => a.id === pk.area).name;
      body = `<div class="pk-chips">${pk.screen === 'area' ? `<button class="pk-chip ghost" data-pk="areas">${U.icon('chevL')} Areas</button>` : back}<span class="pk-title">${U.esc(title)}</span>
        ${list.length ? `<button class="pk-chip ghost" data-pk-all>Select all</button>` : ''}</div>
        <div class="pk-list">${list.length ? list.map((t) => `<label class="pk-item"><input type="checkbox" data-pk-sel="${t.id}" ${pk.sel.has(t.id) ? 'checked' : ''}/><span class="badge mono">${t.id}</span><span class="pk-t">${U.esc(t.title)}</span><span class="pk-m">${U.esc(Library.scheduleLabel(t))}${t.location ? ' · ' + U.esc(t.location) : ''}${Library.instance(t, today) ? ' · on your list' : ''}</span></label>`).join('') : '<p class="pk-hint">Everything due today is already on your list.</p>'}</div>
        <div class="pk-actions"><button class="pk-btn primary" data-pk-create ${pk.sel.size ? '' : 'disabled'}>Create ${pk.sel.size || ''} ticket${pk.sel.size === 1 ? '' : 's'}</button><button class="pk-btn" data-pk-done ${pk.sel.size ? '' : 'disabled'}>Log as done</button></div>`;
    } else if (pk.screen === 'packages') {
      body = `<div class="pk-chips">${back}<span class="pk-title">Packages</span></div><div class="pk-list">${Library.packages().map((p) => {
        const n = p.mode === 'manual' ? p.templateIds.length : Library.dueInPackage(p, today).length;
        return `<div class="pk-item row"><span class="pk-t"><b>${U.esc(p.name)}</b><span class="pk-m">${p.mode === 'manual' ? `${n} tasks` : `${n} due today`}${p.auto && p.mode !== 'manual' ? ' · auto' : ''}</span></span><button class="pk-btn primary" data-pk-run="${p.id}" ${n ? '' : 'disabled'}>Run</button></div>`;
      }).join('')}</div>`;
    } else if (pk.screen === 'checks' || pk.screen === 'open') {
      const list = pk.screen === 'checks'
        ? Library.todays().filter((e) => e.status !== 'done').sort((a, b) => A().PR_ORDER[a.priority] - A().PR_ORDER[b.priority])
        : Store.openTasks().filter((e) => !e.templateId);
      body = `<div class="pk-chips">${back}<span class="pk-title">${pk.screen === 'checks' ? "Today's checks — tap to mark done" : 'My open tasks — tap to mark done'}</span></div>
        <div class="pk-list">${list.length ? list.slice(0, 60).map((e) => `<button class="pk-item row btn-like" data-pk-finish="${e.id}">${e.ticket ? `<span class="badge mono">${U.esc(e.ticket)}</span>` : ''}<span class="pk-t">${U.safe(e.title)}</span><span class="pk-m">${e.location ? U.esc(e.location) + ' · ' : ''}${e.priority}</span>${U.icon('check')}</button>`).join('') : '<p class="pk-hint">Nothing open here. Nice work.</p>'}</div>`;
    }
    h.innerHTML = body;
  }

  function wirePicker() {
    const h = pickerHost();
    if (!h) return;
    h.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-pk]');
      if (nav) {
        const to = nav.dataset.pk;
        if (to === 'close') { hidePicker(); return; }
        showPicker(to, nav.dataset.arg || '');
        return;
      }
      if (e.target.closest('[data-pk-all]')) {
        $$('[data-pk-sel]', h).forEach((c) => pk.sel.add(c.dataset.pkSel));
        renderPicker(); return;
      }
      const create = e.target.closest('[data-pk-create]');
      const done = e.target.closest('[data-pk-done]');
      if (create || done) {
        const ids = [...pk.sel];
        const res = Library.assign(ids, { status: done ? 'done' : 'open', source: 'call' });
        const n = res.created.length + res.updated.length;
        const already = res.existing.length;
        let reply = n ? `${done ? 'Logged' : 'Created'} ${n} ticket${n > 1 ? 's' : ''}: ${[...res.created, ...res.updated].map((x) => x.ticket).join(', ')}.` : 'Those are already on your list for today.';
        if (already && n) reply += ` ${already} ${already > 1 ? 'were' : 'was'} already on your list.`;
        reply += done ? ' Nice work. Anything else?' : ' They’re on your board. Anything else?';
        act(`${done ? 'Done' : 'Create tickets'}: ${ids.join(', ')}`, reply, res.created);
        showPicker('home');
        return;
      }
      const run = e.target.closest('[data-pk-run]');
      if (run) {
        const p = Library.packages().find((x) => x.id === run.dataset.pkRun);
        const res = Library.runPackage(p, { source: 'call' });
        const reply = res.created.length ? `Done — “${p.name}” added ${res.created.length} ticket${res.created.length > 1 ? 's' : ''}${res.existing.length ? `, ${res.existing.length} were already assigned` : ''}. Anything else?` : `Everything in “${p.name}” is already on your list for today. Anything else?`;
        act(`Run package: ${p.name}`, reply);
        showPicker('home');
        return;
      }
      const fin = e.target.closest('[data-pk-finish]');
      if (fin) {
        const x = Store.get(fin.dataset.pkFinish);
        Store.update(x.id, { status: 'done' });
        const left = Library.todays().filter((y) => y.status !== 'done').length;
        act(`Done: ${x.ticket || x.title}`, `Marked ${x.ticket || 'that task'} done.${x.templateId ? ` ${left} routine check${left === 1 ? '' : 's'} left today.` : ''} Anything else?`);
        renderPicker();
      }
    });
    h.addEventListener('change', (e) => {
      const c = e.target.closest('[data-pk-sel]');
      if (!c) return;
      if (c.checked) pk.sel.add(c.dataset.pkSel); else pk.sel.delete(c.dataset.pkSel);
      renderPicker();
    });
  }

  function init() { wirePackageDialog(); wirePicker(); }
  document.addEventListener('DOMContentLoaded', init);

  WL.LibraryUI = { view, after, showPicker, hidePicker, openPackage, openTemplate };
})(window.WL);
