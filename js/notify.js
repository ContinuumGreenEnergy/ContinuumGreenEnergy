'use strict';
// =============================================================
//  notify.js — WhatsApp-style notification layer
//
//  • dataApi writers push records to /notifications (push ids):
//      { module, action, desc, byName, ts, readBy:{uid:true} }
//  • This file renders a 🔔 bell in the topbar with a live
//    unread badge, and a slide-in panel listing the last 50
//    notifications newest-first, styled like a WhatsApp chat
//    list (module colour stripe | description | time).
//  • child_added / child_changed listeners → new notifications
//    appear at the top of the panel instantly, on every device.
//  • Role filtering: admins see everything; module-scoped users
//    (solar / wtg / bop / land) see their module + general + hse.
//  • "Mark as read" writes readBy/{uid}=true to Firebase, and a
//    localStorage mirror keeps the badge correct for anonymous
//    viewers (who share the 'anon' uid).
// =============================================================

(function (global) {

  const MAX_ITEMS = 50;
  const _items = new Map();       // id -> record
  let _panelOpen = false;
  let _started = false;
  const LS_KEY = 'swppl_notif_read_v1';

  // ── local read-state mirror (works even for anonymous users) ──
  function _localRead() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { return {}; }
  }
  function _markLocalRead(id) {
    try {
      const m = _localRead(); m[id] = 1;
      const keys = Object.keys(m);
      if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(k => delete m[k]);
      localStorage.setItem(LS_KEY, JSON.stringify(m));
    } catch (e) {}
  }

  function _me()  { return (global.auth && auth.current && auth.current()) || { uid: 'anon', name: 'Anonymous', role: 'viewer' }; }
  function _role(){ return (_me().role || 'viewer').toLowerCase(); }
  function _uid() { return _me().uid || 'anon'; }

  // Which modules this role is allowed to see
  function _visible(rec) {
    const r = _role();
    if (r === 'admin' || r === 'viewer' || r === 'manager') return true;     // admins + read-only viewers see all
    const m = (rec.module || 'general').toLowerCase();
    if (m === 'general' || m === 'hse') return true;                          // safety + general are everyone's business
    return m === r;                                                           // solar/wtg/bop/land scoped
  }

  function _isRead(rec, id) {
    if (rec.readBy && rec.readBy[_uid()]) return true;
    return !!_localRead()[id];
  }

  const MOD_COLOR = {
    solar: 'var(--sol,#ffca28)', wtg: 'var(--wtg,#4fc3f7)', bop: 'var(--bop,#ab47bc)',
    land:  'var(--ok,#66bb6a)',  hse: 'var(--er,#ff5252)',  general: 'var(--ac,#1565c0)'
  };
  const MOD_LABEL = { solar:'Solar', wtg:'WTG', bop:'BOP', land:'Land', hse:'HSE', general:'General' };

  function _fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts), now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return hm;
    return d.toLocaleDateString([], { day: '2-digit', month: 'short' }) + ' ' + hm;
  }

  // ── badge ──
  function _refreshBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    let unread = 0;
    _items.forEach((rec, id) => { if (_visible(rec) && !_isRead(rec, id)) unread++; });
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }

  // ── panel ──
  function _renderPanel() {
    const list = document.getElementById('notif-list');
    if (!list) return;
    const rows = [...(_items.entries())]
      .filter(([id, rec]) => _visible(rec))
      .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0))
      .slice(0, MAX_ITEMS);

    if (!rows.length) {
      mount(list, el('div', { class: 'notif-empty' }, 'No notifications yet. POD submissions, progress updates, HSE observations and blockers will appear here live.'));
      return;
    }

    const nodes = rows.map(([id, rec]) => {
      const read = _isRead(rec, id);
      const col = MOD_COLOR[(rec.module || 'general').toLowerCase()] || MOD_COLOR.general;
      const row = el('div', { class: 'notif-item' + (read ? '' : ' unread') },
        el('div', { class: 'notif-stripe', style: { background: col } }),
        el('div', { class: 'notif-body' },
          el('div', { class: 'notif-top' },
            el('span', { class: 'notif-mod', style: { color: col } }, MOD_LABEL[(rec.module || 'general').toLowerCase()] || rec.module),
            el('span', { class: 'notif-action' }, rec.action || ''),
            el('span', { class: 'notif-time' }, _fmtTime(rec.ts))
          ),
          el('div', { class: 'notif-desc' }, rec.desc || ''),
          el('div', { class: 'notif-by' }, '👤 ' + (rec.byName || 'Anonymous'),
            read ? null : el('button', {
              class: 'notif-read-btn',
              onclick: (e) => { e.stopPropagation(); markRead(id); }
            }, '✓ Mark as read'))
        )
      );
      if (!read) row.addEventListener('click', () => markRead(id));
      return row;
    });
    mount(list, nodes);
  }

  function markRead(id) {
    _markLocalRead(id);
    try { fbDB.ref('notifications/' + id + '/readBy/' + _uid()).set(true).catch(() => {}); } catch (e) {}
    const rec = _items.get(id);
    if (rec) { rec.readBy = rec.readBy || {}; rec.readBy[_uid()] = true; }
    _refreshBadge(); _renderPanel();
  }

  function markAllRead() {
    _items.forEach((rec, id) => { if (_visible(rec) && !_isRead(rec, id)) markRead(id); });
  }

  function togglePanel(force) {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    _panelOpen = force !== undefined ? !!force : !_panelOpen;
    panel.classList.toggle('open', _panelOpen);
    if (_panelOpen) _renderPanel();
  }

  // ── DOM bootstrap: bell + panel (injected so topbar.html stays slim) ──
  function _injectUI() {
    if (document.getElementById('notif-bell')) return;
    const tbr = document.querySelector('#tb .tbr');
    if (!tbr) return;

    const bell = el('button', {
      id: 'notif-bell', class: 'btn bts', 'data-tt': 'Live notifications — POD, progress, HSE, blockers',
      onclick: () => togglePanel()
    }, '🔔', el('span', { id: 'notif-badge', class: 'notif-badge', style: { display: 'none' } }, '0'));
    tbr.insertBefore(bell, tbr.firstChild);

    const panel = el('div', { id: 'notif-panel' },
      el('div', { class: 'notif-head' },
        el('span', { style: { fontWeight: '800', fontSize: '12px' } }, '🔔 Live Notifications'),
        el('div', { style: { display: 'flex', gap: '6px' } },
          el('button', { class: 'btn bts', style: { fontSize: '9px' }, onclick: markAllRead }, '✓✓ Mark all read'),
          el('button', { class: 'btn bts', style: { fontSize: '9px' }, onclick: () => togglePanel(false) }, '✕')
        )
      ),
      el('div', { id: 'notif-list', class: 'notif-list' })
    );
    document.body.appendChild(panel);

    // click-outside closes
    document.addEventListener('click', (e) => {
      if (!_panelOpen) return;
      const p = document.getElementById('notif-panel');
      const b = document.getElementById('notif-bell');
      if (p && !p.contains(e.target) && b && !b.contains(e.target)) togglePanel(false);
    });
  }

  // ── Rotating notification carousel (live ticker) ──────────
  // A persistent slim bar docked at the bottom of the viewport that
  // cycles through the latest notifications SEQUENTIALLY and LOOPS
  // continuously — updates stay visible instead of vanishing like
  // toasts. Behaviour:
  //   • shows one notification at a time, sliding up every 4.2 s
  //   • loops back to the newest after the oldest (max 15 items)
  //   • pauses while hovered; click → opens the bell panel + marks read
  //   • a genuinely NEW event (post-backlog) jumps to the front with a
  //     flash so it is seen immediately
  //   • can be minimised to a small "LIVE" chip and restored
  let _bootAt = Date.now();
  let _backlogDone = false;
  setTimeout(() => { _backlogDone = true; }, 4000);

  const TICKER_MAX = 15, TICKER_STEP_MS = 4200;
  let _tickIdx = 0, _tickTimer = null, _tickPaused = false, _tickMin = false;

  function _tickerItems() {
    return [...(_items.entries())]
      .filter(([id, rec]) => _visible(rec))
      .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0))
      .slice(0, TICKER_MAX);
  }

  function _tickerEnsure() {
    if (document.getElementById('notif-ticker')) return;
    const bar = el('div', { id: 'notif-ticker' },
      el('div', { class: 'nt-live' }, el('span', { class: 'nt-live-dot' }), 'LIVE'),
      el('div', { class: 'nt-viewport' }, el('div', { id: 'nt-item', class: 'nt-item' })),
      el('div', { class: 'nt-count', id: 'nt-count' }, ''),
      el('button', { class: 'nt-btn', 'data-tt': 'Open full notification history', onclick: () => togglePanel(true) }, '🔔'),
      el('button', { class: 'nt-btn', id: 'nt-min', 'data-tt': 'Minimise ticker', onclick: _tickerToggleMin }, '▾')
    );
    bar.addEventListener('mouseenter', () => { _tickPaused = true; });
    bar.addEventListener('mouseleave', () => { _tickPaused = false; });
    document.body.appendChild(bar);

    const chip = el('div', { id: 'notif-ticker-chip', style: { display: 'none' }, onclick: _tickerToggleMin },
      el('span', { class: 'nt-live-dot' }), 'LIVE', el('span', { id: 'nt-chip-n', class: 'nt-chip-n' }, ''));
    document.body.appendChild(chip);

    _tickTimer = setInterval(() => {
      if (_tickPaused || _tickMin) return;
      _tickerAdvance(1);
    }, TICKER_STEP_MS);
    _tickerRender(true);
  }

  function _tickerToggleMin() {
    _tickMin = !_tickMin;
    const bar = document.getElementById('notif-ticker');
    const chip = document.getElementById('notif-ticker-chip');
    if (bar) bar.classList.toggle('min', _tickMin);
    if (chip) chip.style.display = _tickMin ? 'flex' : 'none';
  }

  function _tickerAdvance(dir) {
    const items = _tickerItems();
    if (!items.length) return;
    _tickIdx = (_tickIdx + dir + items.length) % items.length;   // continuous loop
    _tickerRender();
  }

  function _tickerRender(instant, flash) {
    const slot = document.getElementById('nt-item');
    const cnt = document.getElementById('nt-count');
    const chipN = document.getElementById('nt-chip-n');
    if (!slot) return;
    const items = _tickerItems();
    if (chipN) {
      let unread = 0; _items.forEach((rec, id) => { if (_visible(rec) && !_isRead(rec, id)) unread++; });
      chipN.textContent = unread ? String(unread) : '';
    }
    if (!items.length) {
      mount(slot, el('span', { class: 'nt-empty' }, 'Waiting for live site updates — POD, progress, HSE and blockers will rotate here.'));
      if (cnt) cnt.textContent = '';
      return;
    }
    if (_tickIdx >= items.length) _tickIdx = 0;
    const [id, rec] = items[_tickIdx];
    const col = MOD_COLOR[(rec.module || 'general').toLowerCase()] || MOD_COLOR.general;
    const node = el('div', { class: 'nt-msg' + (flash ? ' flash' : '') },
      el('span', { class: 'nt-mod', style: { color: col, borderColor: col } },
        MOD_LABEL[(rec.module || 'general').toLowerCase()] || rec.module),
      el('span', { class: 'nt-act' }, rec.action || ''),
      el('span', { class: 'nt-desc' }, rec.desc || ''),
      el('span', { class: 'nt-meta' }, '👤 ' + (rec.byName || 'Anonymous') + ' · ' + _fmtTime(rec.ts)));
    node.addEventListener('click', () => { togglePanel(true); markRead(id); });
    if (instant) { mount(slot, node); }
    else {
      slot.classList.remove('roll'); void slot.offsetWidth;   // restart animation
      mount(slot, node); slot.classList.add('roll');
    }
    if (cnt) cnt.textContent = (_tickIdx + 1) + ' / ' + items.length;
  }

  // A genuinely new event: jump the carousel to it with a flash.
  function _tickerOnNew(id, rec) {
    if (!_backlogDone) { _tickerRender(true); return; }   // backlog replay: just hydrate
    if (rec.ts && rec.ts < _bootAt - 60000) return;
    if (!_visible(rec)) return;
    _tickIdx = 0;                                          // newest is index 0
    _tickerRender(false, true);
    const bar = document.getElementById('notif-ticker');
    if (bar) { bar.classList.remove('ping'); void bar.offsetWidth; bar.classList.add('ping'); }
  }

  // ── Firebase listeners ──
  function _startListeners() {
    if (_started || typeof fbDB === 'undefined') return;
    _started = true;
    const ref = fbDB.ref('notifications').orderByChild('ts').limitToLast(MAX_ITEMS);
    ref.on('child_added', s => {
      const rec = s.val() || {};
      _items.set(s.key, rec);
      _refreshBadge();
      if (_panelOpen) _renderPanel();
      _tickerOnNew(s.key, rec);    // rotating carousel — loops continuously
    });
    ref.on('child_changed', s => {
      _items.set(s.key, s.val() || {});
      _refreshBadge();
      if (_panelOpen) _renderPanel();
    });
    ref.on('child_removed', s => {
      _items.delete(s.key);
      _refreshBadge();
      if (_panelOpen) _renderPanel();
    });
  }

  function _boot() {
    // topbar mounts asynchronously via loader.js — poll briefly
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (document.querySelector('#tb .tbr')) {
        clearInterval(t);
        _injectUI();
        _tickerEnsure();
        _startListeners();
      } else if (tries > 100) clearInterval(t);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();

  global.notify = { togglePanel, markRead, markAllRead, refresh: () => { _refreshBadge(); _renderPanel(); } };

})(window);
