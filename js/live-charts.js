'use strict';
// =============================================================
//  live-charts.js — Incoming-data visualisation (home screen)
//
//  Everything here re-renders automatically: the Firebase
//  listeners (state-bridge.js) refresh DB.* and call the active
//  renderer, which calls renderLiveCharts(). No buttons, no
//  manual refresh — the charts move as data arrives.
//
//  Panels:
//   1. Cumulative plan vs actual — per module, planned dashed /
//      actual solid, built from POD planned qty and progress.
//   2. Daily activity bars — submitted vs completed per day for
//      the last 7 days (from /pod + /dailyProgress).
//   3. Manpower trend — Σ mp per day for the last 7 days from
//      POD entries.
//   4. Photo badges — photos uploaded this week per module
//      (POD photoURL + HSE observation photoURL).
// =============================================================

(function (global) {

  function _iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function _last7() {
    const out = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push(_iso(d)); }
    return out;
  }
  function _short(iso) { return iso.slice(8) + '/' + iso.slice(5,7); }

  function _allPod() {
    const out = [];
    ['s','w','b','l'].forEach(m => ((DB.pod && DB.pod[m]) || []).forEach(p => out.push(Object.assign({ _m: m }, p))));
    return out;
  }

  const MODS = [
    { k:'s', label:'Solar', col:'#ffca28' },
    { k:'w', label:'WTG',   col:'#4fc3f7' },
    { k:'b', label:'BOP',   col:'#ab47bc' },
    { k:'l', label:'Land',  col:'#66bb6a' }
  ];

  function renderLiveCharts() {
    const wrap = document.getElementById('home-live-viz');
    if (!wrap || typeof Chart === 'undefined' || typeof mkC !== 'function') return;

    const days = _last7();
    const pods = _allPod();

    // ── 1. Cumulative plan vs actual per module ──
    // planned = cumulative Σ planned qty from POD entries per day (dashed)
    // actual  = cumulative Σ progress/final qty from the same entries (solid)
    const datasets = [];
    MODS.forEach(m => {
      let cumP = 0, cumA = 0;
      const planned = [], actual = [];
      days.forEach(d => {
        pods.filter(p => p._m === m.k && p.date === d).forEach(p => {
          cumP += (+p.qty || 0);
          cumA += p.status === 'done' ? (+p.progress || +p.qty || 0)
               :  p.status === 'wip'  ? (+p.progress || 0) : 0;
        });
        planned.push(cumP); actual.push(cumA);
      });
      if (cumP > 0 || cumA > 0) {
        datasets.push({ label: m.label + ' Planned', data: planned, borderColor: m.col, borderDash: [6,4],
                        borderWidth: 1.6, pointRadius: 0, fill: false, tension: .25 });
        datasets.push({ label: m.label + ' Actual',  data: actual,  borderColor: m.col,
                        borderWidth: 2.4, pointRadius: 2, fill: false, tension: .25 });
      }
    });
    const cumEmpty = document.getElementById('lv-cum-empty');
    if (datasets.length) {
      if (cumEmpty) cumEmpty.style.display = 'none';
      mkC('ch-live-cum', { type: 'line',
        data: { labels: days.map(_short), datasets },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { boxWidth: 14, font: { size: 8 } } } },
          scales: { y: { beginAtZero: true } } } });
    } else if (cumEmpty) {
      cumEmpty.style.display = 'flex';
      if (CH['ch-live-cum']) { CH['ch-live-cum'].destroy(); delete CH['ch-live-cum']; }
    }

    // ── 2. Daily activity bars — submitted vs completed (7 days) ──
    const submitted = days.map(d => pods.filter(p => p.date === d).length);
    const completed = days.map(d => pods.filter(p => p.date === d && p.status === 'done').length);
    // /dailyProgress entries also count as activity submissions
    const dpPerDay = days.map(d => (DB.dailyProgress || []).filter(e => e.ts && _iso(new Date(e.ts)) === d).length);
    mkC('ch-live-daily', { type: 'bar',
      data: { labels: days.map(_short), datasets: [
        { label: 'Submitted (POD)',   data: submitted, backgroundColor: 'rgba(79,195,247,.7)',  borderRadius: 4 },
        { label: 'Completed',         data: completed, backgroundColor: 'rgba(0,230,118,.7)',   borderRadius: 4 },
        { label: 'Progress entries',  data: dpPerDay,  backgroundColor: 'rgba(255,202,40,.55)', borderRadius: 4 }
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { boxWidth: 14, font: { size: 8 } } } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });

    // ── 3. Manpower trend — Σ mp per day ──
    const mpPerDay = days.map(d => pods.filter(p => p.date === d).reduce((s, p) => s + (+p.mp || 0), 0));
    mkC('ch-live-mp', { type: 'line',
      data: { labels: days.map(_short), datasets: [{
        label: 'Total manpower deployed', data: mpPerDay,
        borderColor: '#1565c0', backgroundColor: 'rgba(21,101,192,.15)',
        fill: true, tension: .3, pointRadius: 3, borderWidth: 2.2
      }]},
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });

    // ── 4. Photo count badges — this week, per module ──
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const badges = document.getElementById('lv-photo-badges');
    if (badges) {
      const counts = { s: 0, w: 0, b: 0, l: 0, hse: 0 };
      pods.forEach(p => {
        if (p.photoURL && (p.ts || 0) >= weekAgo && counts[p._m] !== undefined) counts[p._m]++;
      });
      ((typeof HSE_DB !== 'undefined' && HSE_DB.observations) || []).forEach(o => {
        if ((o.photoURL || o.photo) && (!o.ts || o.ts >= weekAgo)) counts.hse++;
      });
      const items = [
        ['☀️ Solar', counts.s], ['⚡ WTG', counts.w], ['🔌 BOP', counts.b],
        ['🌍 Land', counts.l], ['🦺 HSE', counts.hse]
      ];
      mount(badges, items.map(([lbl, n]) =>
        el('div', { class: 'live-photo-badge' }, lbl + ' photos this week:', el('b', String(n)))));
    }
  }

  global.renderLiveCharts = renderLiveCharts;

})(window);
