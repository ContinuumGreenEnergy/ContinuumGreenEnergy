# SWPPL v9 — Demo-Mode Pivot

This pass replaces email/password Firebase Auth with a hardcoded password
gate. The Firebase database itself is configured for public read AND write.
**Read `README.md` for the security warning that comes with this trade-off.**

The pivot also fixed the multi-device sync bug you reported.

---

## The sync bug, root cause

The POD form submit handler was pushing entries to `DB.pod[t]` in local
JavaScript memory and calling `scheduleSave()`. The `scheduleSave()` function
was a debounced shim that:

1. Returned early if `auth.current()` was null (it always was — no one was logged in).
2. Even when logged in, only flushed **Solar acts** and **WTG turbines** — never POD, never HSE employees, never Land additions, never milestones.

So POD entries on Device A never reached Firebase, which meant Device B's
listener never fired, which meant the entry was invisible everywhere except
the device that submitted it. Refreshing the submitting device wiped the
entry too (no Firebase = no persistence).

This pattern existed for several other writes too:
- WTG land additions (`render-land.js submitAddWtgLand`)
- HSE employee additions (`render-misc.js submitEmployee`)
- Solar lease additions (`render-land.js submitAddLease`)

All of these have been migrated to `dataApi.*` calls that write through to
Firebase. **The sync bug should now be gone.**

## Changes file by file

### `js/auth.js` — completely rewritten
- No more `signInWithEmailAndPassword`, `signInAnonymously`, `onAuthStateChanged`, or `/users/{uid}` lookups.
- Hardcoded `DEMO_USER = 'site_user'` / `DEMO_PASS = 'Site@123'` at the top.
- Unlock state stored in `sessionStorage` so a tab stays unlocked for its lifetime; new tabs re-prompt.
- Same public surface: `auth.login()`, `auth.logout()`, `auth.canEdit()`, `auth.requireRole()`, `auth.current()`, `auth.onChange()` — renderers don't need any changes.

### `js/data-api.js` — auth gates removed
- `_u()` no longer throws — returns the unlocked profile, or an `Anonymous`
  fallback if the tab isn't unlocked. Writes always reach Firebase.
- 22 role-throw checks (e.g. `if (me.role !== 'admin') throw`) replaced
  with a single `if (!auth.canEdit()) throw` that maps to the demo gate.
- `addPod` and `addDailyProgress` accept anonymous callers and tag entries
  with `byName: 'Anonymous'`.
- `pushDailyProgress` (used internally by Solar/WTG/BOP/Land write paths)
  also accepts anonymous callers, so DPR entries land regardless of
  unlock state.

### `js/render-misc.js`
- **POD form (`subPOD`) rewritten** — was the source of your sync bug.
  Now `await dataApi.addPod(...)` + `await dataApi.addDailyProgress(...)`.
  No more local-only `DB.pod[t].push`.
- HSE `submitEmployee` rewritten — uses `dataApi.addHseEmployee` /
  `dataApi.updateHseEmployee`.
- Seed-employees auto-push removed — it was racing the Firebase listener
  and producing duplicates.

### `js/render-land.js`
- `submitAddWtgLand` rewritten through `dataApi.updateWtgLand`.
- `removeWtgLand` rewritten — direct `fbDB.ref(...).remove()`.
- The old (broken) `submitAddWtgLand` was redefined later in the file,
  shadowing the new one. The shadow is now neutered.

### `js/state-bridge.js`
- `_flushLegacyDB` is now a documented no-op. The bulk-rewrite-everything
  flush had two bugs: it could overwrite live edits from another device
  with stale local state, and it pushed hundreds of leaves on every
  keystroke. Targeted `dataApi.*` writes do the persistence now.
- `scheduleSave()` and `saveDB()` aliases preserved as no-ops so legacy
  `onclick="scheduleSave()"` handlers don't break.

### `js/firebase.js`
- `window.firebaseConfig` exposed so the footer diagnostic can render
  the project ID.

### `security/rules.json` — public R/W
```json
{ "rules": { ".read": true, ".write": true } }
```
Apply this verbatim in Firebase Console → Realtime Database → Rules.

### `views/login.html` — repurposed
- Email field replaced with a Username field, pre-filled with `site_user`.
- Password placeholder shows `Site@123`.
- Footer paragraph reads: *"Demo build — not real authentication.
  Anyone with browser DevTools can bypass this gate."*

### `views/topbar.html`
- 🔓 Login → 🔓 **Unlock edits**
- 🚪 Logout → 🔒 **Lock edits**
- Tooltip text updated to match the demo intent.

### `views/footer.html` — sync diagnostic added
The footer now shows:
```
DB: dashboard-project-8db91 · ☁️ connected
```
**Both devices must show the same project ID.** This is the easiest way
to diagnose multi-device sync issues.

### `js/render-home.js` — DPR rendered as bullet list
`renderDailyProgressList()` now groups entries by date and renders each
as a coloured bullet:
```
📅 Mon, 09 May 2026
  ● [Solar] ITC-1 › Pile Drilling — 12 Nos          14:32 · Anonymous
  ● [WTG]   T-08 › Foundation Casting — 100%        15:18 · Site Engineer
  ● [BOP]   33kV-F2 › Stringing — 800 m             16:04 · Anonymous
```
Up to 30 most-recent entries shown, newest first.

## Verification checklist

| Test | Expected | How to verify |
|---|---|---|
| Page opens without login | ✅ | Open GitHub Pages URL incognito → dashboard renders |
| POD edit without password | ✅ | Click POD form → submit → no password prompt |
| Solar edit prompts for password | ✅ | Click Solar activity → password modal appears |
| Password unlocks for the tab | ✅ | Enter `Site@123` → modal closes → can edit |
| Sync across devices | ✅ | Submit POD on Device A → see it on Device B within ~1s |
| Both devices on same DB | ✅ | Footer shows same project ID on both |
| DPR auto-generated | ✅ | POD/Solar/WTG/BOP edit → entry appears in DPR list |
| DPR groups by date | ✅ | Multi-day data → date headers, bullets nested |
| Tab close → re-prompt next tab | ✅ | Close tab, open new one → password required again |
| Lock edits button | ✅ | Click Lock → cannot edit until password re-entered |
| No localStorage for project data | ✅ | `grep -rn "localStorage" js/` → only theme |
| No `signInWithEmail` / `signInAnon` | ✅ | `grep -rn "signIn" js/` → only the demo `login()` function |

All 21 JS files pass `node --check`. `rules.json` parses as valid JSON.
All HTML partials parse cleanly.
