'use strict';
// =============================================================
//  ui-live.js — makes realtime updates VISIBLE
//
//  The dashboard already re-renders on every Firebase tick; this
//  module makes those updates perceptible: any KPI value (.kv),
//  status chip or progress text that changes gets a brief glow
//  pulse (.val-flash, see ui-polish.css), so users can literally
//  see live data landing without hunting for what changed.
//
//  Implementation: a single MutationObserver on #ct watching
//  characterData + childList. Old text per element is remembered
//  in a WeakMap; when the rendered text differs, the flash class
//  is re-triggered. Cheap (no polling) and renderer-agnostic.
// =============================================================

(function (global) {

  const WATCH_SELECTOR = '.kv, .wt-status-chip, .wt-progress-text, .fds-v, .ms b';
  const prev = new WeakMap();
  let scheduled = false;

  function _scan(root) {
    root.querySelectorAll(WATCH_SELECTOR).forEach(elm => {
      const txt = elm.textContent;
      const old = prev.get(elm);
      if (old !== undefined && old !== txt) {
        elm.classList.remove('val-flash');
        // force reflow so the animation can restart
        void elm.offsetWidth;
        elm.classList.add('val-flash');
      }
      prev.set(elm, txt);
    });
  }

  function _schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const ct = document.getElementById('ct');
      if (ct) _scan(ct);
    });
  }

  function _boot() {
    const ct = document.getElementById('ct');
    if (!ct) { setTimeout(_boot, 300); return; }
    _scan(ct);
    new MutationObserver(_schedule).observe(ct, { subtree: true, childList: true, characterData: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();

})(window);
