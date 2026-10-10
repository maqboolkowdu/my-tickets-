/* OpsLog — dependency-free SVG/CSS charts (work offline, theme-aware). */
(function (WL) {
  'use strict';
  const { U } = WL;

  /** Donut chart. data: [{label, value, color}] */
  function donut(data, { size = 180, thickness = 26, center = '', sub = '' } = {}) {
    const total = data.reduce((s, d) => s + d.value, 0);
    const r = (size - thickness) / 2, c = 2 * Math.PI * r, cx = size / 2;
    let off = 0;
    const arcs = total ? data.map((d) => {
      const len = (d.value / total) * c;
      const seg = `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${thickness}" stroke-dasharray="${Math.max(len - 2, 0.01)} ${c}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cx})"><title>${U.esc(d.label)}: ${d.value}</title></circle>`;
      off += len;
      return seg;
    }).join('') : '';
    return `<svg class="donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${U.esc(center)} ${U.esc(sub)}">
      <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${thickness}"/>
      ${arcs}
      <text x="50%" y="48%" text-anchor="middle" class="donut-num">${U.esc(center)}</text>
      <text x="50%" y="62%" text-anchor="middle" class="donut-sub">${U.esc(sub)}</text>
    </svg>`;
  }

  function legend(data, { max = 8, showPct = true } = {}) {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    return `<ul class="legend">${data.slice(0, max).map((d) => `
      <li><span class="dot" style="background:${d.color}"></span><span class="lg-label">${U.esc(d.label)}</span>
      <span class="lg-val">${d.value}${showPct ? ` <small>${Math.round((d.value / total) * 100)}%</small>` : ''}</span></li>`).join('')}</ul>`;
  }

  /** Vertical bars. data: [{label, value}] */
  function bars(data, { height = 160, highlight = -1, unit = 'items' } = {}) {
    const max = Math.max(1, ...data.map((d) => d.value));
    const dense = data.length > 16;
    return `<div class="bars ${dense ? 'dense' : ''}" style="--h:${height}px">${data.map((d, i) => `
      <div class="bar-col ${i === highlight ? 'hl' : ''}" title="${U.esc(d.label)}: ${d.value} ${unit}">
        <div class="bar-track"><div class="bar" style="height:${(d.value / max) * 100}%"><span class="bar-val">${d.value || ''}</span></div></div>
        <div class="bar-label">${dense && i % 2 && data.length > 20 ? '' : U.esc(d.label)}</div>
      </div>`).join('')}</div>`;
  }

  /** Horizontal ranked bars. data: [{label, value, color, sub}] */
  function hbars(data) {
    const max = Math.max(1, ...data.map((d) => d.value));
    return `<div class="hbars">${data.map((d) => `
      <div class="hbar-row">
        <div class="hbar-head"><span><span class="dot" style="background:${d.color}"></span>${U.esc(d.label)}</span><span class="muted">${d.value}${d.sub ? ' · ' + U.esc(d.sub) : ''}</span></div>
        <div class="hbar-track"><div class="hbar" style="width:${(d.value / max) * 100}%;background:${d.color}"></div></div>
      </div>`).join('')}</div>`;
  }

  /** GitHub-style calendar heatmap for the last `weeks` weeks ending today. counts: {ymd: n} */
  function heatmap(counts, { weeks = 53, end = new Date() } = {}) {
    const ws = WL.Store.settings.weekStart || 0;
    const last = U.startOfDay(end);
    const start = U.addDays(last, -((last.getDay() - ws + 7) % 7) - (weeks - 1) * 7);
    const max = Math.max(1, ...Object.values(counts));
    const cols = [];
    let monthLabels = '';
    for (let w = 0; w < weeks; w++) {
      const cells = [];
      for (let d = 0; d < 7; d++) {
        const day = U.addDays(start, w * 7 + d);
        if (day > last) { cells.push('<i class="hm-cell empty"></i>'); continue; }
        const n = counts[U.ymd(day)] || 0;
        const lvl = n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4));
        cells.push(`<i class="hm-cell l${lvl}" title="${U.fmtDate(day)}: ${n} item${n === 1 ? '' : 's'}"></i>`);
        if (d === 0 && day.getDate() <= 7) monthLabels += `<span style="grid-column:${w + 1}">${U.MONTHS_SHORT[day.getMonth()]}</span>`;
      }
      cols.push(`<div class="hm-col">${cells.join('')}</div>`);
    }
    const dayLabels = [0, 1, 2, 3, 4, 5, 6].map((i) => (i % 2 ? `<span>${U.DAYS_SHORT[(i + ws) % 7]}</span>` : '<span></span>')).join('');
    return `<div class="heatmap"><div class="hm-days">${dayLabels}</div><div class="hm-main"><div class="hm-months" style="grid-template-columns:repeat(${weeks},1fr)">${monthLabels}</div><div class="hm-grid">${cols.join('')}</div></div></div>
      <div class="hm-legend"><span>Less</span><i class="hm-cell l0"></i><i class="hm-cell l1"></i><i class="hm-cell l2"></i><i class="hm-cell l3"></i><i class="hm-cell l4"></i><span>More</span></div>`;
  }

  function ring(pct, { size = 64, label = '' } = {}) {
    const r = 26, c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(1, pct));
    return `<svg class="ring" viewBox="0 0 64 64" width="${size}" height="${size}" aria-label="${Math.round(p * 100)}%">
      <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--track)" stroke-width="7"/>
      <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${p * c} ${c}" transform="rotate(-90 32 32)"/>
      <text x="50%" y="56%" text-anchor="middle" class="ring-txt">${label || Math.round(p * 100) + '%'}</text></svg>`;
  }

  WL.Charts = { donut, legend, bars, hbars, heatmap, ring };
})(window.WL);
