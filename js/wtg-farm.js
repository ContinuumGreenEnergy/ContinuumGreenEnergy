'use strict';
// =============================================================
//  wtg-farm.js — Interactive live wind-farm visualisation
//
//  An SVG "industrial monitoring" scene rendered at the top of
//  the WTG view (host: #wtg-farm). Each of the 26 turbines is a
//  vector turbine with a CSS-animated rotor whose spin speed is
//  driven by live progress/status from Firebase:
//      ready   → fast spin, green ring, energy flowing
//      casting → medium spin, blue ring
//      wip     → slow spin, amber ring
//      pending → stopped, grey ring
//      row     → stopped, red pulsing ring (ROW issue)
//  Animated dashed "energy flow" paths run from every active
//  turbine into the PSS bus, and from the PSS toward the GSS —
//  the whole scene re-renders on every Firebase tick, so rotors
//  speed up / flows light up live as progress is entered.
//
//  Interactions:
//   • hover  — turbine tilts up (CSS scale) + tooltip with id,
//              status and progress
//   • click  — a detail card ZOOMS OUT of the clicked turbine
//              (transform-origin at the turbine) showing MW,
//              status, civil/mech/USS/supply bars, notes, and a
//              button that opens the full turbine drill-down
//              (existing selectTurbine flow).
// =============================================================

(function (global) {

  const ST = {
    ready:   { col: '#00e676', label: 'Ready',     spin: 'spin-fast' },
    casting: { col: '#4fc3f7', label: 'Casting',   spin: 'spin-med'  },
    wip:     { col: '#ffca28', label: 'WIP',       spin: 'spin-slow' },
    pending: { col: '#7c8ba1', label: 'Pending',   spin: 'spin-off'  },
    row:     { col: '#ff5252', label: 'ROW Issue', spin: 'spin-off'  }
  };

  let _selected = null;

  function _avg(arr) {
    if (!Array.isArray(arr) || !arr.length) return 0;
    return arr.reduce((s, v) => s + (+v || 0), 0) / arr.length;
  }
  function _prog(t) {
    if (typeof calcTurbProg === 'function') { try { return Math.round(calcTurbProg(t)); } catch (e) {} }
    return Math.round((_avg(t.civil) + _avg(t.mech)) / 2);
  }
  function _stKey(t) { return ST[t.status] ? t.status : 'pending'; }

  // One vector turbine. Pure SVG string; ids are sanitized turbine ids.
  function _turbSVG(t, x, y, scale) {
    const k = _stKey(t), st = ST[k], p = _prog(t);
    const id = String(t.id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const active = (k === 'ready' || k === 'casting');
    return `
    <g class="fturb st-${k} ${st.spin}" id="fturb-${id}" data-turb="${esc(t.id)}"
       transform="translate(${x},${y}) scale(${scale})">
      <!-- status ring on the ground -->
      <ellipse class="ft-ring" cx="0" cy="2" rx="15" ry="4.5" fill="none"
               stroke="${st.col}" stroke-width="1.6" opacity=".8"/>
      <ellipse cx="0" cy="2" rx="15" ry="4.5" fill="${st.col}" opacity=".10"/>
      <!-- tower -->
      <path d="M -2.1 0 L -1.1 -34 L 1.1 -34 L 2.1 0 Z" fill="url(#fg-tower)"/>
      <!-- nacelle -->
      <rect x="-3.4" y="-37.4" width="6.8" height="4.6" rx="1.6" fill="#b9c8da"/>
      <!-- rotor (3 blades) — CSS-animated rotation -->
      <g class="ft-rotor" style="transform-origin:0px -35px;">
        <g transform="translate(0,-35)">
          ${[0, 120, 240].map(a =>
            `<path d="M 0 0 L 1.7 -3 L 0.6 -19 L -0.6 -19 L -1.7 -3 Z"
                   fill="url(#fg-blade)" transform="rotate(${a})"/>`).join('')}
          <circle r="2.3" fill="#e8f1fa" stroke="#9fb4cc" stroke-width=".7"/>
        </g>
      </g>
      <!-- active glow at hub -->
      ${active ? `<circle cx="0" cy="-35" r="6.5" fill="${st.col}" opacity=".14"/>` : ''}
      <!-- id label -->
      <text x="0" y="13" text-anchor="middle" font-size="6.6" font-weight="700"
            fill="var(--t2,#8aaccf)" style="font-family:var(--f2,inherit);letter-spacing:.4px;">${esc(t.id)}</text>
      <text x="0" y="20" text-anchor="middle" font-size="5.6" font-weight="800"
            fill="${st.col}">${p}%</text>
    </g>`;
  }

  function renderWtgFarm() {
    const host = document.getElementById('wtg-farm');
    if (!host) return;
    const turbines = (DB.wtg && DB.wtg.turbines) || [];
    if (!turbines.length) { host.innerHTML = ''; return; }

    // layout: 2 staggered rows flowing toward the PSS on the right
    const N = turbines.length;
    const perRow = Math.ceil(N / 2);
    const W = Math.max(900, perRow * 64 + 220), H = 240;
    const rowY = [118, 196];
    const startX = 46, gapX = (W - 250) / Math.max(1, perRow - 1);

    const pssX = W - 92, pssY = 128;
    const counts = { ready: 0, casting: 0, wip: 0, pending: 0, row: 0 };
    let flows = '', turbs = '';

    turbines.forEach((t, i) => {
      const r = i % 2, c = Math.floor(i / 2);
      const x = startX + c * gapX + (r ? gapX * 0.42 : 0);
      const y = rowY[r];
      const k = _stKey(t); counts[k]++;
      const active = (k === 'ready' || k === 'casting');
      const col = ST[k].col;
      // energy flow: smooth curve from turbine base into the PSS bus
      flows += `<path class="flow-path ${active ? '' : 'off'}"
        d="M ${x} ${y + 2} C ${x + (pssX - x) * .35} ${y + 26}, ${pssX - 110} ${pssY + 38}, ${pssX - 26} ${pssY + 14}"
        stroke="${active ? col : 'var(--b2,#24406a)'}" stroke-width="${active ? 1.7 : 1}" opacity="${active ? .8 : 1}"/>`;
      turbs += _turbSVG(t, x, y, 1.18);
    });

    const totalActive = counts.ready + counts.casting;
    host.innerHTML = `
    <div class="farm-scene" style="position:relative;">
      <svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto;" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="fg-tower" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#8aa0ba"/><stop offset=".5" stop-color="#dfe9f4"/><stop offset="1" stop-color="#7e94ae"/>
          </linearGradient>
          <linearGradient id="fg-blade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f2f7fc"/><stop offset="1" stop-color="#aebfd4"/>
          </linearGradient>
          <linearGradient id="fg-pss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#19324f"/><stop offset="1" stop-color="#0c1c30"/>
          </linearGradient>
        </defs>
        <!-- ground line -->
        <line x1="0" y1="${rowY[1] + 4}" x2="${W}" y2="${rowY[1] + 4}" stroke="var(--b1,#1a2e4a)" stroke-width="1" opacity=".6"/>
        ${flows}
        <!-- PSS substation node -->
        <g id="farm-pss" transform="translate(${pssX},${pssY})">
          <circle class="farm-pss-pulse" r="30" fill="none" stroke="#00bcd4" stroke-width="1.6"/>
          <rect x="-26" y="-16" width="52" height="34" rx="6" fill="url(#fg-pss)" stroke="#00bcd4" stroke-width="1.4"/>
          <text x="0" y="-2" text-anchor="middle" font-size="9" font-weight="800" fill="#00e5ff">PSS</text>
          <text x="0" y="9" text-anchor="middle" font-size="5.6" fill="var(--t2,#8aaccf)">33/220 kV</text>
          <text x="0" y="30" text-anchor="middle" font-size="6.4" font-weight="700" fill="#00e676">⚡ ${totalActive}/${turbines.length} feeding</text>
        </g>
        <!-- PSS → GSS export flow -->
        <path class="flow-path ${totalActive ? '' : 'off'}" d="M ${pssX + 28} ${pssY} L ${W - 8} ${pssY}"
              stroke="#00bcd4" stroke-width="2.2"/>
        <text x="${W - 10}" y="${pssY - 8}" text-anchor="end" font-size="6.4" fill="var(--t3,#4a6a8a)">→ GSS export</text>
        ${turbs}
      </svg>
      <div class="farm-tip" id="farm-tip"></div>
    </div>
    <div class="farm-legend">
      <span style="font-weight:800;color:var(--t1);">Live status:</span>
      ${Object.entries(ST).map(([k, s]) =>
        `<span><span class="fl-dot" style="background:${s.col};"></span>${s.label} <b>${counts[k]}</b></span>`).join('')}
      <span style="margin-left:auto;color:var(--t3);">Hover a turbine for quick stats · click to zoom into details · rotors &amp; energy flow are live from Firebase</span>
    </div>`;

    // ── interactions ──
    const scene = host.querySelector('.farm-scene');
    const tip = host.querySelector('#farm-tip');
    host.querySelectorAll('.fturb').forEach(g => {
      const tid = g.getAttribute('data-turb');
      g.addEventListener('mousemove', (ev) => {
        const t = turbines.find(x => x.id === tid); if (!t) return;
        const k = _stKey(t);
        tip.innerHTML = `<b>${esc(t.id)}</b> · <span style="color:${ST[k].col};font-weight:800;">${ST[k].label}</span>`
          + ` · ${_prog(t)}%` + (t.mw ? ` · ${esc(t.mw)} MW` : '');
        const r = scene.getBoundingClientRect();
        tip.style.left = (ev.clientX - r.left) + 'px';
        tip.style.top = (ev.clientY - r.top - 6) + 'px';
        tip.classList.add('show');
      });
      g.addEventListener('mouseleave', () => tip.classList.remove('show'));
      g.addEventListener('click', (ev) => {
        ev.stopPropagation();
        _openDetail(tid, g, scene, turbines);
      });
    });
    scene.addEventListener('click', _closeDetail);

    // restore selection highlight after re-render
    if (_selected) {
      const g = host.querySelector(`.fturb[data-turb="${CSS.escape(_selected)}"]`);
      if (g) g.classList.add('selected');
    }
  }

  function _closeDetail() {
    const old = document.getElementById('farm-detail');
    if (old) {
      old.classList.add('closing');
      setTimeout(() => old.remove(), 260);
    }
    document.querySelectorAll('.fturb.selected').forEach(g => g.classList.remove('selected'));
    _selected = null;
  }

  function _bar(label, val, col) {
    const v = Math.max(0, Math.min(100, Math.round(val)));
    return `<div class="fd-stat">
      <div class="fds-l">${label}</div>
      <div class="fds-v" style="color:${col};">${v}%</div>
      <div class="fd-bar"><div style="width:${v}%;background:${col};"></div></div>
    </div>`;
  }

  function _openDetail(tid, g, scene, turbines) {
    _closeDetail();
    const t = turbines.find(x => x.id === tid); if (!t) return;
    const k = _stKey(t), st = ST[k];
    _selected = tid;
    g.classList.add('selected');

    // position: anchored near the turbine, zooming out of it
    const sr = scene.getBoundingClientRect();
    const gr = g.getBoundingClientRect();
    const cx = gr.left - sr.left + gr.width / 2;
    const onRight = cx > sr.width / 2;

    const card = document.createElement('div');
    card.className = 'farm-detail';
    card.id = 'farm-detail';
    const left = onRight ? Math.max(8, cx - 340) : Math.min(sr.width - 340, cx + 18);
    card.style.left = left + 'px';
    card.style.top = '12px';
    card.style.setProperty('--fd-ox', (cx - left) + 'px');
    card.style.setProperty('--fd-oy', (gr.top - sr.top + gr.height / 2 - 12) + 'px');

    const civil = _avg(t.civil), mech = _avg(t.mech);
    const uss = +t.uss || 0, sup = +t.sup || 0;
    // Large animated turbine — same rotor animation as the farm, scaled up,
    // spin speed + colours driven by live status.
    const bigTurb = `
      <div class="fd-turb-visual ${st.spin}">
        <svg viewBox="-46 -96 92 110" width="128" height="150">
          <defs>
            <radialGradient id="fdt-glow" cx=".5" cy=".4" r=".6">
              <stop offset="0" stop-color="${st.col}" stop-opacity=".35"/>
              <stop offset="1" stop-color="${st.col}" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <circle cx="0" cy="-58" r="42" fill="url(#fdt-glow)"/>
          <ellipse cx="0" cy="6" rx="26" ry="7" fill="${st.col}" opacity=".14"/>
          <ellipse cx="0" cy="6" rx="26" ry="7" fill="none" stroke="${st.col}" stroke-width="2" opacity=".8"/>
          <path d="M -4 4 L -2 -56 L 2 -56 L 4 4 Z" fill="url(#fg-tower)"/>
          <rect x="-6.2" y="-62.4" width="12.4" height="8.4" rx="2.8" fill="#b9c8da"/>
          <g class="ft-rotor" style="transform-origin:0px -58px;">
            <g transform="translate(0,-58)">
              ${[0, 120, 240].map(a =>
                `<path d="M 0 0 L 3 -5.4 L 1.1 -34 L -1.1 -34 L -3 -5.4 Z"
                       fill="url(#fg-blade)" stroke="#8fa6c0" stroke-width=".4" transform="rotate(${a})"/>`).join('')}
              <circle r="4.2" fill="#e8f1fa" stroke="#9fb4cc" stroke-width="1.1"/>
            </g>
          </g>
        </svg>
      </div>`;
    card.innerHTML = `
      <div class="fd-head">
        <div class="fd-title">🌀 ${esc(t.id)}</div>
        <span class="fd-status-chip" style="color:${st.col};">${st.label}</span>
        <button class="fd-x" title="Close">✕</button>
      </div>
      ${bigTurb}
      <div style="display:flex;gap:10px;align-items:center;justify-content:center;">
        <div style="font-size:26px;font-weight:800;color:${st.col};font-variant-numeric:tabular-nums;">${_prog(t)}%</div>
        <div style="font-size:9px;color:var(--t3);line-height:1.5;">Overall progress<br>${t.mw ? '<b style="color:var(--t1);">' + esc(t.mw) + ' MW</b> Senvion' : ''}</div>
      </div>
      <div class="fd-grid">
        ${_bar('Civil', civil, '#ffca28')}
        ${_bar('Mechanical', mech, '#4fc3f7')}
        ${_bar('USS', uss, '#ab47bc')}
        ${_bar('Supply', sup, '#00e676')}
      </div>
      ${t.notes ? `<div style="font-size:9px;color:var(--t3);background:var(--card3);border-radius:7px;padding:7px 9px;margin-bottom:9px;">📝 ${esc(t.notes)}</div>` : ''}
      <button class="btn btwt" style="width:100%;font-size:10px;" id="fd-open-full">🔍 Open full turbine detail</button>`;
    card.addEventListener('click', ev => ev.stopPropagation());
    card.querySelector('.fd-x').addEventListener('click', _closeDetail);
    card.querySelector('#fd-open-full').addEventListener('click', () => {
      _closeDetail();
      if (typeof selectTurbine === 'function') {
        selectTurbine(tid);
        const el = document.getElementById('tcard-' + tid);
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    scene.appendChild(card);
  }

  global.renderWtgFarm = renderWtgFarm;

})(window);
