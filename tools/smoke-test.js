// smoke-test.js — boots the SWPPL dashboard headlessly in jsdom with a
// stubbed Firebase, verifies the inline-template loader, navigation,
// POD rendering, notifications UI, and live charts hook.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

// Run from the project: cd <project> && npm i jsdom && node tools/smoke-test.js
const ROOT = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Strip external <script src="http…"> and <link> tags (no network in test)
html = html.replace(/<script src="https?:\/\/[^"]+"><\/script>/g, '');
const localScripts = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);

const vc = new VirtualConsole();
const logs = [];
vc.on('error', e => logs.push(['error', String(e)]));
vc.on('warn',  (...a) => logs.push(['warn', a.join(' ')]));
vc.on('log',   (...a) => logs.push(['log', a.join(' ')]));
vc.on('jsdomError', e => logs.push(['jsdomError', String(e && e.message)]));

// Inject a stub-setup inline script BEFORE the first local script so the
// firebase/Chart/Leaflet globals exist when firebase.js etc. run.
html = html.replace('<script src="js/firebase.js"></script>',
  '<script>window.__installStubs && window.__installStubs(window);</script>\n<script src="js/firebase.js"></script>');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + ROOT + '/index.html',
  virtualConsole: vc,
  pretendToBeVisual: true,
  beforeParse(window) {
    window.__installStubs = installStubs;
  }
});
const { window } = dom;
const fails = [];
const ok = (cond, msg) => { if (cond) console.log('  ✓', msg); else { console.log('  ✗', msg); fails.push(msg); } };

// ── Stub Firebase compat SDK ──
function installStubs(window) {
const dbStore = {};
function mkSnap(val, key) {
  return {
    key, val: () => val, exists: () => val != null,
    numChildren: () => (val && typeof val === 'object') ? Object.keys(val).length : 0,
    forEach: (cb) => { if (val && typeof val === 'object') Object.entries(val).forEach(([k, v]) => cb(mkSnap(v, k))); }
  };
}
window.__writes = [];
const writes = window.__writes;
function mkRef(p) {
  return {
    _path: p,
    push: (v) => { const key = 'k' + Math.random().toString(36).slice(2, 8); const r = mkRef(p + '/' + key); r.key = key;
      if (v !== undefined) { writes.push([p + '/' + key, v]); return { catch: () => {} }; } return r; },
    set: async (v) => { writes.push([p, v]); },
    update: async (v) => { writes.push([p + ' (update)', v]); },
    remove: async () => { writes.push([p, null]); },
    get: async () => mkSnap(null, null),
    on: (evt, cb) => cb && undefined,
    off: () => {},
    orderByChild: () => mkRef(p),
    limitToLast: () => mkRef(p),
    toString: () => 'stub://' + p,
    child: (c) => mkRef(p + '/' + c)
  };
}
window.firebase = {
  initializeApp: () => {},
  apps: [],
  database: Object.assign(() => ({ ref: (p) => mkRef(p || '') }), { ServerValue: { TIMESTAMP: { '.sv': 'timestamp' } } }),
  storage: () => ({ ref: (p) => ({ put: () => ({ on: (e, a, b, c) => c && c() }), getDownloadURL: async () => 'https://x/y.jpg', delete: async () => {} }) })
};
// Chart.js + Leaflet stubs
function ChartStub(c, cfg) { this.destroy = () => {}; this.update = () => {}; this.config = cfg; }
ChartStub.register = () => {};
window.Chart = ChartStub;
window.L = { map: () => ({ setView() { return this; }, remove() {}, invalidateSize() {}, on() {}, fitBounds() {} }),
  tileLayer: () => ({ addTo: () => {} }), marker: () => ({ bindPopup() { return this; }, addTo() { return this; } }),
  layerGroup: () => ({ addTo() { return this; }, clearLayers() {}, addLayer() {} }),
  divIcon: () => ({}), icon: () => ({}), polyline: () => ({ addTo() { return this; } }), control: { layers: () => ({ addTo: () => {} }) },
  circleMarker: () => ({ bindPopup() { return this; }, addTo() { return this; } }), latLngBounds: () => ({}) };
window.localStorage.setItem('x', 'y'); // sanity

// canvas getContext stub
window.HTMLCanvasElement.prototype.getContext = () => ({ canvas: {}, clearRect() {}, save() {}, restore() {} });
}

console.log('\n1.', localScripts.length, 'local scripts load via <script> tags (classic global semantics)');

window.addEventListener('error', e => logs.push(['werror', String(e.message)]));

setTimeout(() => {
  try {
    const d = window.document;
    ok(d.querySelectorAll('template[data-partial]').length >= 24, 'inline templates present (' + d.querySelectorAll('template[data-partial]').length + ')');
    ok(d.getElementById('view-home') && d.getElementById('view-home').innerHTML.length > 500, 'home view injected from inline template');
    ok(d.getElementById('view-pod'), 'POD view injected');
    ok(d.getElementById('home-live-viz'), 'live data visualisation section present');
    ok(d.getElementById('ch-live-cum') && d.getElementById('ch-live-mp'), 'live chart canvases present');
    ok(typeof window.fetchPartial === 'function', 'fetchPartial defined on window');
    ok(typeof window.dataApi === 'object' && typeof window.dataApi.addPod === 'function', 'dataApi surface available');
    ok(typeof window.dataApi.addSolLease === 'function' && typeof window.dataApi.removeSolLease === 'function', 'lease writers exposed');
    ok(typeof window.dataApi.deleteHseEmployee === 'function', 'deleteHseEmployee exposed');
    ok(typeof window.dataApi.notify === 'function', 'notification writer exposed');
    ok(typeof window.renderLiveCharts === 'function', 'renderLiveCharts defined');
    ok(typeof window.podSetStatus === 'function' && typeof window.podSaveProgress === 'function', 'POD status handlers defined');
    ok(typeof window.podPhotoSelected === 'function' && typeof window.hsePhotoSelected === 'function', 'instant photo handlers defined');

    // navigate to POD and render Land tab
    console.log('\n3. POD view — Land tab + status buttons…');
    window.nav('pod');
    ok(d.getElementById('ptb-l') && d.getElementById('ptb-l').style.display !== 'none', 'Land tab visible');
    window.podTab('l');
    ok(d.getElementById('pod-ct').innerHTML.includes('Submit Land POD'), 'Land POD submit button rendered');
    // open the Land form and check extra activities
    window.openPODForm('l');
    ok(d.getElementById('p-b').innerHTML.includes('Survey &amp; Demarcation') || d.getElementById('p-b').innerHTML.includes('Survey & Demarcation'), 'Land activity list present');
    window.openPODForm('s');
    const sf = d.getElementById('p-b').innerHTML;
    ok(sf.includes('Pile Rectification') && sf.includes('SCADA Sensor Installation'), 'Solar extra activities present');
    ok(sf.includes('pf-photo'), 'Solar POD photo field present');
    window.openPODForm('w');
    ok(d.getElementById('p-b').innerHTML.includes('Nacelle Lifting'), 'WTG extra activities present');
    window.openPODForm('b');
    const bf = d.getElementById('p-b').innerHTML;
    ok(bf.includes('Disc Insulator Stringing') && bf.includes('Substation Commissioning'), 'BOP extra activities present');

    // XSS check: inject a hostile POD entry and render it
    console.log('\n4. XSS safety — hostile POD entry…');
    window.DB.pod.s.push({ id: 'x1', date: window.dataApi.todayISO(), activity: 'ITC-1 › <img src=x onerror=alert(1)>', qty: 5, mp: 3,
      by: '<script>evil()</script>', time: '10:00', contractor: '"><svg onload=1>', notes: '<b onmouseover=x>n</b>', status: 'wip', progress: 2, remark: '<i>r</i>', resources: [] });
    window.podTab('s');
    const podHtml = d.getElementById('pod-ct').innerHTML;
    ok(!podHtml.includes('<img src=x onerror'), 'activity escaped in POD list');
    ok(!podHtml.includes('<script>evil'), 'byName escaped in POD list');
    ok(podHtml.includes('&lt;script&gt;') || podHtml.includes('&lt;'), 'escaped entities present');
    ok(podHtml.includes('pod-sbtn'), 'status buttons rendered');
    ok(podHtml.includes('Completed') && podHtml.includes('WIP'), 'three status states present');

    // home work table with land + hostile entry
    console.log('\n5. Home work table + live charts…');
    window.nav('home');
    const wt = d.getElementById('home-work-table');
    ok(wt && wt.innerHTML.includes('Land'), 'work table includes Land module row');
    ok(!wt.innerHTML.includes('<img src=x onerror'), 'work table escapes activity');
    ok(d.getElementById('lv-photo-badges') && d.getElementById('lv-photo-badges').children.length === 5, 'photo badges rendered (5 modules)');

    // notifications UI
    console.log('\n6. Notifications…');
    ok(d.getElementById('notif-bell'), 'bell injected in topbar');
    ok(d.getElementById('notif-panel'), 'slide-in panel present');
    window.notify.togglePanel(true);
    ok(d.getElementById('notif-panel').classList.contains('open'), 'panel opens');
    // simulate a write → check a notification record was attempted
    window.auth && window.auth.current; // no-op
    window.dataApi.notify('solar', 'POD submitted', 'test desc');
    const notifWrites = window.__writes.filter(w => w[0].startsWith('notifications/'));
    ok(notifWrites.length >= 1, 'notification record written to /notifications (' + notifWrites.length + ')');

    // ── UI layer v10.4 ──
    console.log('\n6b. Topbar carousel + removals + POD date filter…');
    // carousel must live INSIDE the topbar, not docked at the bottom
    const tick = d.getElementById('notif-ticker');
    ok(!!tick && tick.closest('#tb'), 'notification carousel sits inside the topbar');
    ok(tick && tick.querySelector('#nt-item'), 'carousel viewport present');
    ok(!d.getElementById('notif-ticker-chip'), 'old minimise chip removed');
    // farm + solar field removed
    window.nav('wtg');
    setTimeout(() => {
    ok(!d.getElementById('wtg-farm') && !d.getElementById('wtg-farm-wrap'), 'WTG farm animation removed');
    ok(typeof window.renderWtgFarm === 'undefined', 'wtg-farm.js no longer loaded');
    window.nav('solar');
    setTimeout(() => {
    ok(!d.getElementById('solar-field') && !d.getElementById('solar-field-wrap'), 'Solar field animation removed');
    ok(typeof window.renderSolarField === 'undefined', 'solar-field.js no longer loaded');
    const itcCards = d.getElementById('itc-cards');
    ok(itcCards && !itcCards.innerHTML.includes('Major Ongoing Activities'), 'Major Ongoing Activities box removed');
    ok(itcCards && itcCards.querySelector('.itc-cards-strip'), 'ITC card strip still renders');
    // PBI sub-activity chart still intact
    try {
      const htmlC = window.eval(`(function(){
        const itcId = Object.keys(DB.solar.itcs).find(k => DB.solar.itcs[k].active === true) || Object.keys(DB.solar.itcs)[0];
        const itc = DB.solar.itcs[itcId];
        if (typeof solInitActs === 'function') solInitActs(itc);
        const sec = Object.keys(SOL_STRUCTURE)[0];
        const act = solGetActivities(sec)[0];
        _solChartSel[itcId] = { section: sec, actKey: act.key };
        return _solRndrClusterChart(itc, itcId);
      })()`);
      ok(/conic-gradient/.test(htmlC) && /#118DFF|#E66C37|#1AAB40/.test(htmlC), 'PBI sub-activity chart intact');
    } catch (e) { ok(false, 'PBI chart — ' + e.message); }

    // POD date filter
    window.nav('pod');
    setTimeout(() => {
    window.podTab('s');
    ok(!!d.getElementById('pod-date-filter'), 'POD date filter input present');
    const today = window.dataApi.todayISO();
    // hostile+today entry already exists from section 4; add a yesterday entry
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yIso = y.getFullYear() + '-' + String(y.getMonth()+1).padStart(2,'0') + '-' + String(y.getDate()).padStart(2,'0');
    window.DB.pod.s.push({ id: 'yent1', date: yIso, activity: 'ITC-1 › Yesterday Pile Work', qty: 9, mp: 4, by: 'Tester', time: '09:00', status: 'done', progress: 9, resources: [] });
    window.podTab('s');
    let podHtml2 = d.getElementById('pod-ct').innerHTML;
    ok(!podHtml2.includes('Yesterday Pile Work'), "today's filter hides yesterday's entries");
    window.podFilterChange(yIso);
    podHtml2 = d.getElementById('pod-ct').innerHTML;
    ok(podHtml2.includes('Yesterday Pile Work'), 'selected date shows only that date');
    ok(podHtml2.includes('↩ Today'), 'return-to-today shortcut shown');
    window.podFilterChange(today);
    // live-viz empty overlays exist in the home view
    ok(!!d.getElementById('lv-daily-empty') && !!d.getElementById('lv-mp-empty'), 'live-chart empty-state overlays present');
    ok(d.querySelectorAll('link[href="css/ui-polish.css"]').length === 1, 'ui-polish.css linked');

    // single-file: fetchPartial must resolve from template without fetch
    console.log('\n7. Single-file loader…');
    window.fetchPartial('views/view-pod.html').then(htmlStr => {
      ok(htmlStr.includes('view-pod'), 'fetchPartial reads inline template (no network)');
      const errors = logs.filter(l => l[0] === 'error' && !/Could not load img|canvas|Not implemented/.test(l[1]));
      ok(errors.length === 0, 'no runtime errors during boot' + (errors.length ? ' — ' + errors[0][1].slice(0, 200) : ''));
      console.log('\n' + (fails.length ? '❌ FAILURES: ' + fails.length : '✅ ALL SMOKE TESTS PASSED'));
      process.exit(fails.length ? 1 : 0);
    });
    }, 250);   // pod nav settle
    }, 250);   // solar nav settle
    }, 250);   // wtg nav settle
  } catch (e) {
    console.error('TEST HARNESS ERROR:', e);
    process.exit(1);
  }
}, 2500);
