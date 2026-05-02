//  MASTER DATA MODEL (exact spec values)
// ═══════════════════════════════════════════════════════════
// ITC Map images (stored as data URLs after upload)
const ITC_MAPS = {
  'ITC-1': null, 'ITC-2': null, 'ITC-3': null,
  'ITC-4': null, 'ITC-5': null, 'ITC-6': null,
};

// ── Global image helpers (robust onerror via JS, not inline HTML) ──
// Usage: _img('turbine.png', 32, '#00e676') → <img ...>
function _img(src, size, glowColor){
  const s=typeof size==='number'?`${size}px`:size;
  const filter=glowColor?`drop-shadow(0 0 4px ${glowColor})`:'none';
  // id lets us target and replace on error
  const uid='img_'+Math.random().toString(36).slice(2,7);
  // Use data-fb attribute so the onerror handler can read the fallback
  const fallbacks={
    'turbine.png':'<span style="font-size:'+s+';line-height:1"></span>',
    'solar.png':'<span style="font-size:'+s+';line-height:1"></span>',
    'bop.png':'<span style="font-size:'+s+';line-height:1">⚙</span>',
    'land.png':'<span style="font-size:'+s+';line-height:1">🌱</span>',
    'continuumlogo.png':'<span style="font-size:'+s+';line-height:1">🌿</span>',
  };
  // Return an img that replaces itself on error with a simple span
  return `<img id="${uid}" src="${src}" style="width:${s};height:${s};object-fit:contain;vertical-align:middle;filter:${filter};" onload="this.style.opacity=1" onerror="(function(el){el.outerHTML='${(fallbacks[src]||'<span>?</span>').replace(/'/g,'&apos;')}`;
}
// Convenience wrappers
function _turbImg(size,col){return _img('turbine.png',size||20,col||'');}
function _solImg(size){return _img('solar.png',size||20,'');}
function _bopImg(size){return _img('bop.png',size||20,'');}
function _landImg(size){return _img('land.png',size||20,'');}
function _logoImg(h){
  // Returns just the img tag, sized by height
  return `<img src="continuumlogo.png" style="height:${h||36}px;object-fit:contain;vertical-align:middle;" onerror="this.style.display='none'">`;
}
// Page logo HTML: top-right corner for all sub-pages
function _pageLogoTR(){
  return `<div class="page-logo-tr">${_logoImg(34)}</div>`;
}

const USERS={solar_user:{pwd:'Solar@123',role:'solar',name:'Solar Engr'},wtg_user:{pwd:'WTG@123',role:'wtg',name:'WTG Engr'},bop_user:{pwd:'BOP@123',role:'bop',name:'BOP Engr'},site_mgr:{pwd:'Site@123',role:'all',name:'Site Manager'}};

// ── SOLAR ACTIVITIES (16 per spec, sub-activities for drilldown) ───────────
const SOL_ACT_DEFS=[
  {n:'Piling',               w:12, col:'#ab47bc', subActs:['Pile Drilling','Casting','Capping'],           subScope:6000},
  {n:'Road',                 w:4,  col:'#6a1b9a', subActs:['Subgrade','WBM','BT/CC'],                     subScope:0},
  {n:'Boundary Wall',        w:3,  col:'#4a148c', subActs:['Excavation','Masonry','Plastering'],           subScope:0},
  {n:'DC 4 Sq.mm',           w:6,  col:'#00c8ff', subActs:['Trench Laying','Cable Pulling','Termination'],subScope:60},
  {n:'DC 400 Sq.mm',         w:8,  col:'#0099cc', subActs:['Trench Laying','Cable Pulling','Termination'],subScope:60},
  {n:'Main Gate',            w:2,  col:'#00acc1', subActs:['Foundation','Fabrication','Erection'],         subScope:0},
  {n:'SCB',                  w:4,  col:'#00bcd4', subActs:['Foundation','Installation','Cabling'],         subScope:0},
  {n:'MMS & Module',         w:14, col:'#ffaa00', subActs:['MMS Erection','Module Fixing','Torque'],       subScope:0},
  {n:'IDT',                  w:5,  col:'#ff8800', subActs:['Foundation','Installation','Testing'],         subScope:0},
  {n:'F INV',                w:6,  col:'#00897b', subActs:['Foundation','Installation','Wiring'],          subScope:0},
  {n:'F Equip Installation', w:5,  col:'#00c853', subActs:['Civil Work','Equipment Fixing','Wiring'],      subScope:0},
  {n:'LA & Earthing',        w:4,  col:'#69f0ae', subActs:['LA Installation','Earth Pit','Continuity Test'],subScope:0},
  {n:'DP Yard',              w:4,  col:'#651fff', subActs:['Foundation','Equipment','Wiring'],              subScope:0},
  {n:'MCR Building',         w:6,  col:'#7c4dff', subActs:['Foundation','Structure','Finishing'],          subScope:0},
  {n:'Pre-Commissioning',    w:10, col:'#b39ddb', subActs:['IR Testing','Loop Testing','SAT'],             subScope:0},
  {n:'HOTO',                 w:7,  col:'#9575cd', subActs:['Documentation','Snag List','Sign-off'],        subScope:0},
];

function mkSolActs(seed){
  const s=seed||{};
  return SOL_ACT_DEFS.map(d=>{
    const done=s[d.n]||0;
    // sub-activity done values (stored as counts when subScope > 0, else %)
    const subDone=d.subActs.map(()=>0);
    return {...d, done, today:0, subDone, subScope:d.subScope||0};
  });
}

// ITC spec per PPT: ITC-1..4 = 13.2MW each, ITC-5..6 = 8.8MW each → 4×13.2 + 2×8.8 = 70.4MW
const DB = {
  solar:{
    totalMW:70.4,
    itcs:{
      'ITC-1':{mw:13.2, pct:9.4, lat:14.832892, lng:76.468903,
        acts:mkSolActs({'Piling':99.5,'Road':45,'Boundary Wall':9,'MMS & Module':51.3,'DC 4 Sq.mm':0,'DC 400 Sq.mm':0.1,'Main Gate':20,'SCB':0,'IDT':25,'F INV':0,'F Equip Installation':0,'LA & Earthing':5,'DP Yard':0,'MCR Building':0,'Pre-Commissioning':0,'HOTO':0})},
      'ITC-2':{mw:13.2, pct:9.4, lat:null, lng:null, acts:mkSolActs({'Piling':30})},
      'ITC-3':{mw:13.2, pct:9.4, lat:null, lng:null, acts:mkSolActs({'Piling – Marking':5})},
      'ITC-4':{mw:13.2, pct:9.4, lat:null, lng:null, acts:mkSolActs({})},
      'ITC-5':{mw:8.8,  pct:6.3, lat:null, lng:null, acts:mkSolActs({})},
      'ITC-6':{mw:8.8,  pct:6.3, lat:null, lng:null, acts:mkSolActs({})},
    }
  },

  // ROW tracking
  rowIssues:[
    {loc:'MKD-258', type:'WTG', issue:'Pathway ROW – Land owner dispute', opened:'2026-03-01'},
    {loc:'MKD-52',  type:'WTG', issue:'Logistic path ROW – Not cleared', opened:'2026-03-10'},
    {loc:'CDP-193', type:'WTG', issue:'Road width restriction', opened:'2026-03-20'},
  ],

  // Planned vs Actual timeline
  schedule:{
    planned:[0,2,5,9,14,20,27,35,43,52,61,70,78,85,91,96,100],
    actual: [0,1,3,7,11,16,22,28,null,null,null,null,null,null,null,null,null],
    labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan27','Feb27','Mar27','Apr27','May27'],
  },

  // WTG: Civil 30% + Mechanical 50% + USS 10% + Supply 10% = 100%
  wtg:{
    totalMW:70.2, count:26,
    civil:   [{n:'Excavation',w:6,col:'#7c4dff'},{n:'PCC',w:5,col:'#651fff'},{n:'Anchor Cage',w:5,col:'#b39ddb'},{n:'Reinforcement',w:7,col:'#9575cd'},{n:'Casting',w:7,col:'#673ab7'}],
    mech:    [{n:'Tower Erection',w:15,col:'#00c8ff'},{n:'Nacelle Install',w:15,col:'#0099cc'},{n:'Blade Assembly',w:12,col:'#00acc1'},{n:'Torque & Final',w:8,col:'#00bcd4'}],
    uss:     [{n:'USS Works',w:10,col:'#00c853'}],
    supply:  [{n:'Supply Complete',w:10,col:'#69f0ae'}],
    turbines:[
      {id:'MBI-12', status:'ready',  lp:true,  pp:true,  civil:[100,100,100,100,100],mech:[0,0,0,0],uss:0,sup:100,notes:'Ready for erection'},
      {id:'MKD-258',status:'row',    lp:true,  pp:false, civil:[100,100,100,100,100],mech:[0,0,0,0],uss:0,sup:0,  notes:'ROW – On hold'},
      {id:'MKD-253',status:'ready',  lp:true,  pp:true,  civil:[100,100,100,100,100],mech:[0,0,0,0],uss:0,sup:100,notes:'Crane arrived'},
      {id:'MOB-403',status:'casting',lp:false, pp:false, civil:[100,100,100,100,100],mech:[0,0,0,0],uss:0,sup:0,  notes:'Backfilling WIP'},
      {id:'KDK-462',status:'wip',    lp:true,  pp:false, civil:[100,100,100,100,0],  mech:[0,0,0,0],uss:0,sup:0,  notes:'Pathway done – casting 05-Apr'},
      {id:'BDK-85', status:'casting',lp:false, pp:false, civil:[100,100,100,100,100],mech:[0,0,0,0],uss:0,sup:0,  notes:'Pipe fixing done'},
      {id:'AMK-264',status:'wip',    lp:false, pp:false, civil:[100,100,100,60,0],   mech:[0,0,0,0],uss:0,sup:0,  notes:'Shuttering 60%'},
      {id:'CDP-221',status:'casting',lp:true,  pp:false, civil:[100,100,100,100,100],mech:[0,0,0,0],uss:0,sup:0,  notes:'Curing done 17-Mar'},
      {id:'MOB-142',status:'wip',    lp:false, pp:false, civil:[100,100,100,100,0],  mech:[0,0,0,0],uss:0,sup:0,  notes:'Casting 03-Apr'},
      {id:'MKD-211',status:'wip',    lp:false, pp:false, civil:[80,50,0,0,0],        mech:[0,0,0,0],uss:0,sup:0,  notes:'GSB supply started'},
      {id:'MKD-52', status:'row',    lp:false, pp:false, civil:[0,0,0,0,0],          mech:[0,0,0,0],uss:0,sup:0,  notes:'ROW – pathway needed'},
      {id:'BDK-25', status:'wip',    lp:false, pp:false, civil:[50,0,0,0,0],         mech:[0,0,0,0],uss:0,sup:0,  notes:'Excavation 50%'},
      ...[13,14,15,16,17,18,19,20,21,22,23,24,25,26].map(n=>({id:`LOC-${String(n).padStart(2,'0')}`,status:'pending',lp:false,pp:false,civil:[0,0,0,0,0],mech:[0,0,0,0],uss:0,sup:0,notes:'Not started'}))
    ]
  },

  // WTG Land: 10 stages each = 100%, 1 WTG = 1.92% of WTG Land
  wtgLand:{
    stages:['Land Agreement','Land Registration','Land Demarcation','Soil Test','DGPS Survey','Permanent Pathway Agreement','Permanent Pathway Dev','Logistic Path Agreement','Logistic Pathway Dev','RFC Approval'],
    locs:[
      ...['MBI-12','MKD-258','MKD-253','MOB-403','KDK-462'].map((id,i)=>({id,svy:`SY.${101+i}/1`,pa:1.2,la:4.2,ls:'Executed',comp:'Paid',stages:[true,true,true,true,true,true,true,true,true,true],notes:''})),
      ...['BDK-85','AMK-264','CDP-221','MOB-142','MKD-211'].map((id,i)=>({id,svy:`SY.${110+i}/2`,pa:1.1,la:4.0,ls:'In Progress',comp:'Partial',stages:[true,true,true,true,false,false,true,true,false,false],notes:''})),
      ...['MKD-52','BDK-25',...[13,14,15,16,17,18,19,20,21,22,23,24,25,26].map(n=>`LOC-${String(n).padStart(2,'0')}`)].map((id,i)=>({id,svy:`SY.${120+i}/3`,pa:1.0,la:3.8,ls:'Pending',comp:'Not Started',stages:new Array(10).fill(false),notes:''}))
    ]
  },

  // Solar Land: 10 activities per block (per spec weights)
  solLand:{
    actDef:[
      {n:'Document Agreement',w:10},{n:'Registration',w:40},{n:'Demarcation',w:5},
      {n:'Leveling',w:5},{n:'Soil Test',w:5},{n:'DGPS Survey',w:5},
      {n:'Permanent Pathway Agreement',w:5},{n:'Permanent Pathway Dev',w:10},
      {n:'Logistic Pathway Agreement',w:5},{n:'Logistic Pathway Dev',w:10},
    ],
    blocks:{
      'ITC-1':{mw:13.2,area:52.5,acts:[100,100,80,50,100,90,30,0,20,0],leases:[{own:'Rameshu',svy:'SY.45/1',dur:'30yr',ls:'Executed',doc:'Complete',reg:'Done',rem:'All clear'}]},
      'ITC-2':{mw:13.2,area:52.5,acts:[100,80,60,0,0,0,50,0,0,0],leases:[]},
      'ITC-3':{mw:13.2,area:52.5,acts:[100,20,0,0,0,0,0,0,0,0],leases:[]},
      'ITC-4':{mw:13.2,area:52.5,acts:[50,0,0,0,0,0,0,0,0,0],leases:[]},
      'ITC-5':{mw:8.8, area:35.0,acts:[30,0,0,0,0,0,0,0,0,0],leases:[]},
      'ITC-6':{mw:8.8, area:35.0,acts:[0,0,0,0,0,0,0,0,0,0],leases:[]},
    }
  },

  // BOP – 33kV: 3 lines with exact km from spec
  // 33kV feeder line details (from user data)
  bop33feeders:[
    {feeder:'1&2',section:'SPDC TAP 1A & 2A', km:13.5,type:'EP',   scope:364,done:352,wip:0,bal:71,pct:96.70},
    {feeder:'1',  section:'END Tapping',        km:2.8, type:'EP',   scope:56, done:6,  wip:0,bal:0, pct:10.71},
    {feeder:'1',  section:'MBI 12',             km:0.2, type:'Dog',  scope:4,  done:0,  wip:0,bal:0, pct:0},
    {feeder:'1',  section:'KDK 462',            km:0.2, type:'Dog',  scope:4,  done:0,  wip:0,bal:0, pct:0},
    {feeder:'1',  section:'MKD 258',            km:1.8, type:'Dog',  scope:36, done:26, wip:0,bal:0, pct:72.22},
    {feeder:'1',  section:'MKD 52',             km:2.2, type:'Dog',  scope:44, done:36, wip:0,bal:0, pct:81.82},
    {feeder:'1',  section:'MKD 211',            km:1.2, type:'Dog',  scope:24, done:14, wip:0,bal:0, pct:58.33},
    {feeder:'1',  section:'MKD 253',            km:1.3, type:'Dog',  scope:26, done:19, wip:0,bal:0, pct:73.08},
    {feeder:'2',  section:'Solar Land WIP',     km:0,   type:'EP',   scope:0,  done:0,  wip:0,bal:0, pct:0},
    {feeder:'3',  section:'TAP 3A',             km:1.5, type:'EP',   scope:30, done:0,  wip:0,bal:0, pct:0},
    {feeder:'3',  section:'Block 2',            km:0.6, type:'Dog',  scope:12, done:0,  wip:0,bal:0, pct:0},
    {feeder:'4',  section:'MOB 142',            km:10,  type:'EP',   scope:200,done:0,  wip:0,bal:0, pct:0},
    {feeder:'4',  section:'CDP-221',            km:2.6, type:'Dog',  scope:52, done:0,  wip:0,bal:0, pct:0},
    {feeder:'4',  section:'AMK 264',            km:0.6, type:'Dog',  scope:12, done:0,  wip:0,bal:0, pct:0},
    {feeder:'4',  section:'MOB 403',            km:1.2, type:'Dog',  scope:24, done:0,  wip:0,bal:0, pct:0},
    {feeder:'4',  section:'BDK 85',             km:6.5, type:'Dog',  scope:130,done:37, wip:0,bal:0, pct:28.46},
    {feeder:'4',  section:'BDK 25',             km:1.2, type:'Dog',  scope:24, done:0,  wip:0,bal:0, pct:0},
  ],

  bop33:{
    lines:[
      // Solar feeders
      {id:'Solar Feeder-1', km:8,  type:'solar', vendor:'TBD', poles:{scope:80, done:30}, stringing:{scope:8, done:0,unit:'km'}, row:1, mp:10, notes:'ITC-1 to ITC-3'},
      {id:'Solar Feeder-2', km:7,  type:'solar', vendor:'TBD', poles:{scope:70, done:15}, stringing:{scope:7, done:0,unit:'km'}, row:0, mp:8,  notes:'ITC-4 to ITC-6'},
      // WTG feeders
      {id:'WTG Feeder-1',   km:13, type:'wtg',   vendor:'TBD', poles:{scope:130,done:45}, stringing:{scope:13,done:0,unit:'km'}, row:3, mp:12, notes:'North WTG cluster'},
      {id:'WTG Feeder-2',   km:9,  type:'wtg',   vendor:'TBD', poles:{scope:90, done:12}, stringing:{scope:9, done:0,unit:'km'}, row:1, mp:8,  notes:'South WTG cluster'},
    ]
  },

  // BOP – 66kV: 1 outgoing feeder (SPDC tower type), total 66 towers
  bop66:{
    totalTowers:66,
    feeders:[
      {id:'SPDC Feeder',   km:12.75, towerType:'SPDC', towers:{scope:66,done:8}, stringing:{scope:12.75,done:0,unit:'km'}, notes:'PSS to GSS | 64 structures'},
    ],
    // legacy vendor structure kept for backward compat
    vendors:[
      {n:'Krishna Electricals', towers:{scope:33,done:5},  stringing:{scope:16.5,done:0,unit:'km'}},
      {n:'Zelvo',               towers:{scope:33,done:3},  stringing:{scope:16.5,done:0,unit:'km'}},
    ]
  },

  // PSS – full activity table data (scope, done, WIP, balance, %)
  pss:{
    mp:0, todayProg:0,
    acts:{
      '66kv Gantry Fdn':          {scope:6,  done:6,  wip:0, bal:0,  col:'#00bcd4',unit:'Nos'},
      '33kv Gantry Fdn':          {scope:20, done:20, wip:0, bal:0,  col:'#00acc1',unit:'Nos'},
      '66kv Equip Fdn':           {scope:35, done:35, wip:0, bal:0,  col:'#0097a7',unit:'Nos'},
      '33kv Equip Fdn':           {scope:73, done:72, wip:0, bal:1,  col:'#006064',unit:'Nos'},
      '66kv Gantry Erection':     {scope:6,  done:6,  wip:0, bal:0,  col:'#4dd0e1',unit:'Nos'},
      '33kv Gantry Erection':     {scope:20, done:20, wip:0, bal:0,  col:'#80deea',unit:'Nos'},
      '66kv Equip Str Erection':  {scope:32, done:32, wip:0, bal:0,  col:'#00e5ff',unit:'Nos'},
      '33kv Equip Str Erection':  {scope:55, done:55, wip:0, bal:0,  col:'#18ffff',unit:'Nos'},
      '66kv Equipment Erection':  {scope:35, done:9,  wip:0, bal:26, col:'#ff9800',unit:'Nos'},
      '33kv Equipment Erection':  {scope:82, done:0,  wip:0, bal:82, col:'#ff6d00',unit:'Nos'},
      'Main Cable Trench':        {scope:100,done:60, wip:0, bal:40, col:'#7c4dff',unit:'%'},
      'PSS Foundation':           {scope:2,  done:2,  wip:0, bal:0,  col:'#b39ddb',unit:'Nos'},
      'PSS Erection':             {scope:2,  done:0,  wip:0, bal:2,  col:'#9575cd',unit:'Nos'},
      'PSS Testing':              {scope:2,  done:0,  wip:0, bal:2,  col:'#7e57c2',unit:'Nos'},
      'PSS Commissioning':        {scope:2,  done:0,  wip:0, bal:2,  col:'#673ab7',unit:'Nos'},
      // MCR Building
      'CRB Foundation Excavation':{scope:100,done:100,wip:0, bal:0,  col:'#66bb6a',unit:'%'},
      'CRB Raft & Column':        {scope:100,done:100,wip:0, bal:0,  col:'#4caf50',unit:'%'},
      'Brick Work (GF)':          {scope:100,done:100,wip:0, bal:0,  col:'#43a047',unit:'%'},
      'Roof Slab (GF)':           {scope:100,done:100,wip:0, bal:0,  col:'#388e3c',unit:'%'},
      'Brick Work (FF)':          {scope:100,done:40, wip:5, bal:60, col:'#2e7d32',unit:'%'},
      'Roof Slab (FF)':           {scope:100,done:0,  wip:0, bal:100,col:'#1b5e20',unit:'%'},
      'Cable Trench (MCR)':       {scope:100,done:0,  wip:0, bal:100,col:'#a5d6a7',unit:'%'},
      'C&R Panel T&C':            {scope:100,done:0,  wip:0, bal:100,col:'#c8e6c9',unit:'%'},
    }
  },

  // GSS – full activity table data
  gss:{
    mp:0, todayProg:0,
    acts:{
      '66kV Bay Foundations':      {scope:19, done:18, wip:0, bal:1,  col:'#8bc34a',unit:'Nos'},
      '66kV Structure Erection':   {scope:17, done:15, wip:0, bal:2,  col:'#689f38',unit:'Nos'},
      '66kV Equip KPTCL Inspection':{scope:19,done:3,  wip:0, bal:16, col:'#558b2f',unit:'Nos'},
      '66kV Equip KPTCL Delivery': {scope:19, done:3,  wip:0, bal:16, col:'#33691e',unit:'Nos'},
      '66kV Equipment Erection':   {scope:17, done:3,  wip:0, bal:14, col:'#aed581',unit:'Nos'},
      '66kV Equipment Testing':    {scope:17, done:0,  wip:0, bal:17, col:'#c5e1a5',unit:'Nos'},
      'Cable Trench':              {scope:100,done:0,  wip:0, bal:100,col:'#dcedc8',unit:'%'},
      'CRB Building':              {scope:100,done:0,  wip:0, bal:0,  col:'#9ccc65',unit:'%'},
      'Commissioning':             {scope:1,  done:0,  wip:0, bal:1,  col:'#f9a825',unit:'Nos'},
    }
  },

  // BOP activity definitions for 33kV and 66kV (matching Solar style)
  bopActDefs:{
    '33kv':[
      {n:'Survey & Design',    w:5,  col:'#9c27b0'},
      {n:'ROW Clearance',      w:8,  col:'#7b1fa2'},
      {n:'Pole Foundation',    w:15, col:'#6a1b9a'},
      {n:'Pole Erection',      w:20, col:'#4a148c'},
      {n:'Stringing',          w:25, col:'#ab47bc'},
      {n:'Insulators & Fittings',w:10,col:'#ce93d8'},
      {n:'Earthing',           w:7,  col:'#e1bee7'},
      {n:'Testing & Commissioning',w:10,col:'#f3e5f5'},
    ],
    '66kv':[
      {n:'Survey & Design',    w:5,  col:'#ff9800'},
      {n:'ROW Clearance',      w:8,  col:'#f57c00'},
      {n:'Tower Foundation',   w:18, col:'#e65100'},
      {n:'Tower Erection',     w:22, col:'#ff6d00'},
      {n:'Stringing',          w:25, col:'#ffb300'},
      {n:'Insulators & Fittings',w:10,col:'#ffd54f'},
      {n:'Earthing',           w:7,  col:'#ffe082'},
      {n:'Testing & Commissioning',w:5,col:'#fff8e1'},
    ],
  },

  // BOP 33kV / 66kV per-line activity progress (seeded)
  bopActs:{
    '33kv':{
      'Solar Feeder-1': [100,60,35,20,0,0,0,0],
      'Solar Feeder-2': [100,40,15,5,0,0,0,0],
      'WTG Feeder-1':   [100,30,20,5,0,0,0,0],
      'WTG Feeder-2':   [100,15,8,2,0,0,0,0],
    },
    '66kv':{
      'SPDC Feeder':         [100,20,8,0,0,0,0,0],
      'Krishna Electricals': [100,20,8,0,0,0,0,0],
      'Zelvo':               [100,15,5,0,0,0,0,0],
    },
  },

  // POD & progress logs
  pod:{s:[],w:[],l:[],b:[]},
  mp:{sol:0,wtg:0,bop:0},

  // Milestones & blockers (editable from dashboard)
  milestones:[
    {date:'2026-04-25',label:'Solar ITC-1 Commissioning',mod:'Solar'},
    {date:'2026-05-15',label:'WTG MBI-12 Erection Start',mod:'WTG'},
    {date:'2026-06-30',label:'33kV Solar Feeder-1 Energisation',mod:'BOP'},
    {date:'2026-09-01',label:'WTG First Power',mod:'WTG'},
    {date:'2026-12-31',label:'Solar Full Commissioning',mod:'Solar'},
    {date:'2027-03-31',label:'SCOD – Final COD',mod:'Overall'},
  ],
  blockers:[
    {code:'MKD-258/52',text:'ROW On Hold – Land dispute',level:'d'},
    {code:'CEIG',      text:'Not Ready – T&C blocked',  level:'w'},
    {code:'MKD-211',   text:'GSB supply started; dewatering done',level:'i'},
  ],

  // Land parcels with lat/lng (editable, reflects on site map)
  landParcels:[],

  _lastSaved: null,
};

// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
//  PERSISTENCE ENGINE (localStorage auto-save/restore)
// ═══════════════════════════════════════════════════════════
const DB_KEY = 'swppl_epc_db_v2';

// Fields we persist (everything mutable — not the structure/defs)
const PERSIST_FIELDS = [
  'pod','mp','milestones','blockers','landParcels','rowIssues',
  // Solar activity progress
  // (stored as flat array per ITC)
];

function saveDB(){
  try{
    const snap = {
      _v: 2,
      _ts: Date.now(),
      pod: DB.pod,
      mp: DB.mp,
      milestones: DB.milestones,
      blockers: DB.blockers,
      landParcels: DB.landParcels,
      rowIssues: DB.rowIssues,
      schedule: DB.schedule,
      // Solar ITC acts (progress values only)
      solarActs: Object.fromEntries(
        Object.entries(DB.solar.itcs).map(([id,d])=>[id, d.acts.map(a=>({done:a.done,today:a.today}))])
      ),
      // WTG turbine progress
      wtgTurbs: DB.wtg.turbines.map(t=>({
        id:t.id,status:t.status,lp:t.lp,pp:t.pp,
        civil:t.civil,mech:t.mech,uss:t.uss,sup:t.sup,notes:t.notes
      })),
      // BOP acts
      bopActs: DB.bopActs,
      pssActs: Object.fromEntries(Object.entries(DB.pss.acts).map(([k,v])=>[k,v.done])),
      gssActs: Object.fromEntries(Object.entries(DB.gss.acts).map(([k,v])=>[k,v.done])),
      // Land progress
      wtgLandStages: DB.wtgLand.locs.map(l=>({id:l.id,stages:l.stages,ls:l.ls,comp:l.comp,notes:l.notes})),
      solLandActs: Object.fromEntries(Object.entries(DB.solLand.blocks).map(([id,b])=>[id,b.acts])),
      // Scope values
      solarTotalMW: DB.solar.totalMW,
      wtgTotalMW: DB.wtg.totalMW,
      wtgCount: DB.wtg.count,
      bop66Towers: DB.bop66.totalTowers,
      itcMW: Object.fromEntries(Object.entries(DB.solar.itcs).map(([id,d])=>[id,d.mw])),
      // ITC maps (base64 images)
      itcMaps: Object.fromEntries(Object.entries(ITC_MAPS).filter(([,v])=>v)),
    };
    localStorage.setItem(DB_KEY, JSON.stringify(snap));
    DB._lastSaved = snap._ts;
    const ts=document.getElementById('last-saved-ts');
    if(ts) ts.textContent='💾 Saved: '+new Date(snap._ts).toLocaleTimeString();
  }catch(e){console.warn('saveDB failed:',e);}
}

function loadDB(){
  try{
    const raw=localStorage.getItem(DB_KEY);
    if(!raw) return false;
    const snap=JSON.parse(raw);
    if(!snap||snap._v!==2) return false;

    // Restore mutable fields
    if(snap.pod) DB.pod=snap.pod;
    if(snap.mp)  DB.mp=snap.mp;
    if(snap.milestones) DB.milestones=snap.milestones;
    if(snap.blockers)   DB.blockers=snap.blockers;
    if(snap.landParcels) DB.landParcels=snap.landParcels;
    if(snap.rowIssues)  DB.rowIssues=snap.rowIssues;
    if(snap.schedule)   DB.schedule=snap.schedule;

    // Solar acts
    if(snap.solarActs){
      Object.entries(snap.solarActs).forEach(([id,acts])=>{
        if(DB.solar.itcs[id]) acts.forEach((a,i)=>{
          if(DB.solar.itcs[id].acts[i]){
            DB.solar.itcs[id].acts[i].done=a.done||0;
            DB.solar.itcs[id].acts[i].today=a.today||0;
          }
        });
      });
    }
    // WTG turbines
    if(snap.wtgTurbs){
      snap.wtgTurbs.forEach(st=>{
        const t=DB.wtg.turbines.find(x=>x.id===st.id);
        if(t) Object.assign(t,st);
      });
    }
    // BOP acts
    if(snap.bopActs) DB.bopActs=snap.bopActs;
    if(snap.pssActs) Object.entries(snap.pssActs).forEach(([k,v])=>{ if(DB.pss.acts[k]) DB.pss.acts[k].done=v; });
    if(snap.gssActs) Object.entries(snap.gssActs).forEach(([k,v])=>{ if(DB.gss.acts[k]) DB.gss.acts[k].done=v; });

    // Land
    if(snap.wtgLandStages){
      snap.wtgLandStages.forEach(st=>{
        const l=DB.wtgLand.locs.find(x=>x.id===st.id);
        if(l) Object.assign(l,st);
      });
    }
    if(snap.solLandActs){
      Object.entries(snap.solLandActs).forEach(([id,acts])=>{
        if(DB.solLand.blocks[id]) DB.solLand.blocks[id].acts=acts;
      });
    }
    // Scope
    if(snap.solarTotalMW) DB.solar.totalMW=snap.solarTotalMW;
    if(snap.wtgTotalMW)   DB.wtg.totalMW=snap.wtgTotalMW;
    if(snap.wtgCount)     DB.wtg.count=snap.wtgCount;
    if(snap.bop66Towers)  DB.bop66.totalTowers=snap.bop66Towers;
    if(snap.itcMW)        Object.entries(snap.itcMW).forEach(([id,mw])=>{ if(DB.solar.itcs[id]) DB.solar.itcs[id].mw=mw; });
    // ITC maps
    if(snap.itcMaps)      Object.entries(snap.itcMaps).forEach(([id,v])=>{ ITC_MAPS[id]=v; });

    DB._lastSaved=snap._ts;
    console.log('[DB] Loaded from localStorage, saved:',new Date(snap._ts).toLocaleString());
    return true;
  }catch(e){console.warn('loadDB failed:',e);return false;}
}

// Auto-save on every mutation — call saveDB() after any data change
// Also save every 60 seconds as a safety net
let _autoSaveTimer=null;
function scheduleSave(){
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer=setTimeout(saveDB,1500); // debounce 1.5s
}

// Land parcel management (with lat/lng → reflects on site map)
function addLandParcel(module,name,lat,lng,area,notes){
  DB.landParcels.push({id:'LP-'+Date.now(),module,name,lat:+lat,lng:+lng,area:+area,notes,added:new Date().toISOString().slice(0,10)});
  saveDB();
  // Refresh map if it's open
  if(mapInst) rndrMap();
  showToast('✅ Land parcel added: '+name,'ok');
}
function removeLandParcel(id){
  DB.landParcels=DB.landParcels.filter(p=>p.id!==id);
  saveDB();
  if(mapInst) rndrMap();
}

// Per-activity scope entry — call this to update scope of any activity
function setActivityScope(module, entityId, actIdx, newScope){
  // module = 'solar' | 'wtg' | 'bop33' | 'bop66' | 'pss' | 'gss' | 'wtgLand' | 'solLand'
  if(module==='solar'){
    const itc=DB.solar.itcs[entityId];
    if(itc&&itc.acts[actIdx]) itc.acts[actIdx].scope=newScope;
  }
  // WTG, BOP etc. scopes stored on the line/feeder objects
  scheduleSave();
}

// ═══════════════════════════════════════════════════════════
//  HSE DATA MODEL
// ═══════════════════════════════════════════════════════════
const HSE_DB = {
  month: 'April - 2026',
  kpis: { raised:1, open:1, closed:0, avgCloseTime:'3 Hrs' },
  // Pyramid levels: color-coded
  pyramid: [
    {level:'Fatality',      color:'#b71c1c', count:0},
    {level:'Lost Time Injury', color:'#c62828', count:0},
    {level:'Minor Injury / First Aid', color:'#f9a825', count:0},
    {level:'Near Miss',     color:'#ff8f00', count:0},
    {level:'Unsafe Act / Condition', color:'#1565c0', count:0},
    {level:'No Observation', color:'#2e7d32', count:1},
  ],
  // Observation log
  observations: [
    {loc:'MBI-12', obs:'Not Wearing Safety Shoe', photo:'', vendor:'HML', raisedDate:'25-04-2026', raisedBy:'Mastan ali', status:'Closed', closedBy:'Laxman', closedPhoto:'', avgTime:'3Hrs', risk:'Unsafe Act'},
  ],
  // Locations in the system
  locations: ['MBI-12','MKD-258','MKD-253','Solar-01','PSS','EHV','33KV','GSS'],
  // Employee leaderboard
  employees: [
    {code:'SW-01', name:'AA', score:53, photo:''},
    {code:'SW-02', name:'BB', score:56, photo:''},
    {code:'SW-03', name:'CC', score:71, photo:''},
    {code:'SW-04', name:'DD', score:45, photo:''},
    {code:'SW-05', name:'EE', score:81, photo:''},
    {code:'SW-06', name:'AA', score:53, photo:''},
    {code:'SW-07', name:'BB', score:56, photo:''},
    {code:'SW-08', name:'CC', score:71, photo:''},
    {code:'SW-09', name:'DiiD', score:45, photo:''},
    {code:'SW-10', name:'EkE', score:91, photo:''},
  ],
};
