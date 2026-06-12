'use strict';
// =============================================================
//  solar-field.js — Live Solar Field visualisation
//
//  The solar counterpart of the WTG farm scene: an SVG strip at
//  the top of the Solar view with
//   • an animated SUN — slowly rotating rays + breathing glow
//   • each ITC drawn as a tilted SOLAR PANEL ARRAY whose cells
//     fill bottom-up with live progress (calcITCProg) and carry
//     a moving light-sheen while the ITC is active
//   • animated energy-flow lines from every active ITC into a
//     pulsing INVERTER/PSS node ("⚡ n/6 generating")
//   • hover → tooltip (id, MW, %, status); click → opens the
//     full ITC drill-down (existing openITC flow)
//  Re-rendered on every Firebase tick from rndrSolar, so panels
//  visibly fill up as progress is entered on any device.
// =============================================================

(function (global) {

  function _pct(id) {
    if (typeof calcITCProg === 'function') { try { return Math.max(0, Math.min(100, Math.round(calcITCProg(id)))); } catch (e) {} }
    return 0;
  }

  // One ITC as a tilted solar array: frame, 4×3 cell grid, progress fill.
  function _itcSVG(id, d, x, y) {
    const p = _pct(id);
    const active = d && d.active === true;
    const col = active ? (p >= 100 ? '#00e676' : p > 0 ? '#ffca28' : '#4fc3f7') : '#56657a';
    const sid = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const PW = 78, PH = 46;            // panel face size
    const cols = 4, rows = 3;
    // cells: filled bottom-up by progress
    const totalCells = cols * rows;
    const lit = Math.round(totalCells * p / 100);
    let cells = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // bottom row first
        const idx = (rows - 1 - r) * cols + c;
        const isLit = idx < lit;
        cells += `<rect x="${c * (PW / cols) + 1.4}" y="${r * (PH / rows) + 1.4}"
                  width="${PW / cols - 2.8}" height="${PH / rows - 2.8}" rx="1.6"
                  fill="${isLit ? 'url(#sf-cell-lit)' : 'url(#sf-cell-dim)'}"
                  ${isLit ? '' : 'opacity=".75"'}/>`;
      }
    }
    return `
    <g class="sitc ${active ? '' : 'coming'}" id="sitc-${sid}" data-itc="${esc(id)}" transform="translate(${x},${y})">
      <!-- legs -->
      <path d="M 12 12 L 6 30 M ${PW - 12} 12 L ${PW - 6} 30" stroke="#5c6f88" stroke-width="2.6" fill="none"/>
      <ellipse cx="${PW / 2}" cy="31" rx="${PW / 2 + 4}" ry="4" fill="${col}" opacity=".12"/>
      <!-- tilted panel -->
      <g transform="skewX(-12)">
        <rect x="-2" y="-${PH + 2}" width="${PW + 4}" height="${PH + 4}" rx="4" fill="#0d1b2e" stroke="${col}" stroke-width="1.6"/>
        <g transform="translate(0,-${PH})">${cells}</g>
        <rect class="panel-shine" x="-2" y="-${PH + 2}" width="${PW + 4}" height="${PH + 4}" rx="4" fill="url(#sf-sheen)"/>
      </g>
      <!-- labels -->
      <text x="${PW / 2 - 6}" y="44" text-anchor="middle" font-size="8" font-weight="800"
            fill="var(--t1,#ddeeff)" style="font-family:var(--f2,inherit);">${esc(id)}</text>
      <text x="${PW / 2 - 6}" y="54" text-anchor="middle" font-size="7" font-weight="800" fill="${col}">
        ${active ? p + '%' : 'Coming Soon'}</text>
      <text x="${PW / 2 - 6}" y="63" text-anchor="middle" font-size="6" fill="var(--t3,#4a6a8a)">${esc((d && d.mw) || 0)} MW</text>
    </g>`;
  }

  function renderSolarField() {
    const host = document.getElementById('solar-field');
    if (!host) return;
    const itcs = Object.entries((DB.solar && DB.solar.itcs) || {});
    if (!itcs.length) { host.innerHTML = ''; return; }

    const N = itcs.length;
    const W = Math.max(880, N * 128 + 320), H = 190;
    const startX = 140, gapX = (W - 420) / Math.max(1, N - 1);
    const baseY = 112;
    const invX = W - 96, invY = 96;

    let panels = '', flows = '', generating = 0;
    itcs.forEach(([id, d], i) => {
      const x = startX + i * gapX, y = baseY;
      const p = _pct(id);
      const active = d && d.active === true;
      if (active && p > 0) generating++;
      const col = active ? (p >= 100 ? '#00e676' : '#ffca28') : 'var(--b2,#24406a)';
      flows += `<path class="flow-path ${active && p > 0 ? '' : 'off'}"
        d="M ${x + 36} ${y + 30} C ${x + 90} ${y + 58}, ${invX - 130} ${invY + 52}, ${invX - 30} ${invY + 16}"
        stroke="${col}" stroke-width="${active && p > 0 ? 1.8 : 1}"/>`;
      panels += _itcSVG(id, d, x, y);
    });

    host.innerHTML = `
    <div class="farm-scene" style="position:relative;">
      <svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto;" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="sf-sun-core" cx=".5" cy=".5" r=".5">
            <stop offset="0" stop-color="#fff6d8"/><stop offset=".55" stop-color="#ffd54f"/><stop offset="1" stop-color="#ffa726"/>
          </radialGradient>
          <radialGradient id="sf-sun-halo" cx=".5" cy=".5" r=".5">
            <stop offset="0" stop-color="#ffca28" stop-opacity=".5"/><stop offset="1" stop-color="#ffca28" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="sf-cell-lit" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#2f6fed"/><stop offset="1" stop-color="#123c8f"/>
          </linearGradient>
          <linearGradient id="sf-cell-dim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#1b2a40"/><stop offset="1" stop-color="#101e30"/>
          </linearGradient>
          <linearGradient id="sf-sheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#ffffff" stop-opacity="0"/>
            <stop offset=".5" stop-color="#ffffff" stop-opacity=".35"/>
            <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="sf-inv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#19324f"/><stop offset="1" stop-color="#0c1c30"/>
          </linearGradient>
        </defs>

        <!-- SUN: rotating rays + breathing halo -->
        <g transform="translate(64,52)">
          <circle class="sun-glow" r="40" fill="url(#sf-sun-halo)"/>
          <g class="sun-rays">
            ${Array.from({ length: 12 }, (_, i) =>
              `<rect x="-2.1" y="-40" width="4.2" height="13" rx="2.1" fill="#ffca28" opacity=".85"
                     transform="rotate(${i * 30})"/>`).join('')}
          </g>
          <circle r="21" fill="url(#sf-sun-core)"/>
          <circle r="21" fill="none" stroke="#ffb300" stroke-width="1.4" opacity=".7"/>
        </g>

        <line x1="0" y1="${baseY + 32}" x2="${W}" y2="${baseY + 32}" stroke="var(--b1,#1a2e4a)" stroke-width="1" opacity=".6"/>
        ${flows}

        <!-- INVERTER / PSS node -->
        <g transform="translate(${invX},${invY})">
          <circle class="farm-pss-pulse" r="32" fill="none" stroke="#ffca28" stroke-width="1.6"/>
          <rect x="-28" y="-18" width="56" height="38" rx="6" fill="url(#sf-inv)" stroke="#ffca28" stroke-width="1.4"/>
          <text x="0" y="-3" text-anchor="middle" font-size="8.6" font-weight="800" fill="#ffd54f">INVERTER</text>
          <text x="0" y="8" text-anchor="middle" font-size="5.6" fill="var(--t2,#8aaccf)">DC → AC · 33 kV</text>
          <text x="0" y="32" text-anchor="middle" font-size="6.4" font-weight="700" fill="#00e676">⚡ ${generating}/${N} generating</text>
        </g>
        <path class="flow-path ${generating ? '' : 'off'}" d="M ${invX + 30} ${invY} L ${W - 6} ${invY}" stroke="#ffca28" stroke-width="2.2"/>
        <text x="${W - 8}" y="${invY - 9}" text-anchor="end" font-size="6.4" fill="var(--t3,#4a6a8a)">→ PSS</text>

        ${panels}
      </svg>
      <div class="farm-tip" id="solar-tip"></div>
    </div>
    <div class="farm-legend">
      <span style="font-weight:800;color:var(--t1);">Live field:</span>
      <span><span class="fl-dot" style="background:#00e676;"></span>Complete</span>
      <span><span class="fl-dot" style="background:#ffca28;"></span>In progress</span>
      <span><span class="fl-dot" style="background:#4fc3f7;"></span>Active · 0%</span>
      <span><span class="fl-dot" style="background:#56657a;"></span>Coming soon</span>
      <span style="margin-left:auto;color:var(--t3);">Panel cells fill with live progress · click an ITC to open its full activity detail</span>
    </div>`;

    // interactions
    const scene = host.querySelector('.farm-scene');
    const tip = host.querySelector('#solar-tip');
    host.querySelectorAll('.sitc').forEach(g => {
      const id = g.getAttribute('data-itc');
      g.addEventListener('mousemove', ev => {
        const d = DB.solar.itcs[id]; if (!d) return;
        const p = _pct(id);
        tip.innerHTML = `<b>${esc(id)}</b> · ${esc(d.mw || 0)} MW · `
          + (d.active === true
              ? `<span style="color:${p >= 100 ? '#00e676' : '#ffca28'};font-weight:800;">${p}%</span>`
              : `<span style="color:#8aa0ba;">Coming Soon</span>`);
        const r = scene.getBoundingClientRect();
        tip.style.left = (ev.clientX - r.left) + 'px';
        tip.style.top = (ev.clientY - r.top - 6) + 'px';
        tip.classList.add('show');
      });
      g.addEventListener('mouseleave', () => tip.classList.remove('show'));
      g.addEventListener('click', () => { if (typeof openITC === 'function') openITC(id); });
    });
  }

  global.renderSolarField = renderSolarField;

})(window);
