'use strict';
// =============================================================
//  auth.js  —  Real authentication (Firebase Auth + role lookup)
//
//  Replaces v8's hardcoded USERS{} object and client-side login.
//
//  Public surface (window.auth):
//    auth.signIn(email, password)        → Promise<userProfile>
//    auth.signOut()                      → Promise<void>
//    auth.current()                      → {uid, email, role, name} | null
//    auth.requireRole(allowedRoles, cb)  → calls cb() if user has role,
//                                          else shows login modal
//    auth.onChange(handler)              → handler({user|null}) on
//                                          every login/logout/role load
// =============================================================

(function (global) {

  let _profile = null;          // {uid, email, role, name}
  const _listeners = new Set(); // registered onChange handlers

  function _notify() { _listeners.forEach(fn => { try { fn(_profile); } catch(e) { console.warn(e); } }); }

  // -----------------------------------------------------------
  // The single source of truth for who the user is.
  // Fires whenever Firebase decides login state changed
  // (page reload, sign-in, sign-out, token refresh).
  // -----------------------------------------------------------
  fbAuth.onAuthStateChanged(async user => {
    if (!user) {
      _profile = null;
      _notify();
      return;
    }
    // Fetch role from /users/{uid}. Rules guarantee the user
    // can read their own node.
    let role = 'viewer', name = user.email || '';
    try {
      const snap = await fbDB.ref('users/' + user.uid).get();
      if (snap.exists()) {
        const u = snap.val();
        role = u.role || 'viewer';
        name = u.name || name;
      } else {
        console.warn('[auth] No /users/' + user.uid + ' node — defaulting to viewer.');
      }
    } catch (e) {
      console.error('[auth] Could not load role:', e);
    }
    _profile = { uid: user.uid, email: user.email, role, name };
    console.log('[auth] Signed in:', _profile);
    _notify();
  });

  // -----------------------------------------------------------
  // signIn / signOut wrap Firebase Auth.
  // signIn returns the loaded profile (waits for role lookup)
  // so callers can `await auth.signIn(...)` and immediately use
  // the role.
  // -----------------------------------------------------------
  async function signIn(email, password) {
    await fbAuth.signInWithEmailAndPassword(email, password);
    // wait for onAuthStateChanged to populate _profile
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Login timed out loading role.')), 8000);
      const off = onChange(p => {
        if (p) { clearTimeout(t); off(); resolve(p); }
      });
    });
  }

  function signOut() {
    return fbAuth.signOut();
  }

  function current() { return _profile; }

  function onChange(fn) {
    _listeners.add(fn);
    // fire once with current state so callers don't race the first event
    queueMicrotask(() => { try { fn(_profile); } catch(e){} });
    return () => _listeners.delete(fn);
  }

  // -----------------------------------------------------------
  // requireRole(roles, cb) — UI-side gate.
  //
  // If the current user is in `roles` (or is admin), runs cb()
  // immediately. Otherwise shows the login modal; if the user
  // signs in successfully and now matches, runs cb().
  //
  // ⚠️  This is a UX convenience only. The actual security
  // boundary is /security/rules.json on the database.
  // -----------------------------------------------------------
  function requireRole(roles, cb) {
    if (!Array.isArray(roles)) roles = [roles];
    const allowed = ['admin'].concat(roles);

    const ok = () => _profile && allowed.includes(_profile.role);
    if (ok()) { cb(); return; }

    _showLogin(allowed, () => { if (ok()) cb(); else _showLoginError('Your role cannot perform this action.'); });
  }

  // -----------------------------------------------------------
  // Login modal interaction.
  // -----------------------------------------------------------
  let _pendingCb = null;
  function _showLogin(allowed, cb) {
    _pendingCb = cb;
    const modal = document.getElementById('lw');
    if (!modal) { alert('Login modal not loaded.'); return; }
    const t = document.getElementById('l-t');
    const s = document.getElementById('l-s');
    const e = document.getElementById('l-e');
    if (t) t.textContent = 'Sign In';
    if (s) s.textContent = 'Allowed roles: ' + allowed.join(', ');
    if (e) e.textContent = '';
    const u = document.getElementById('l-u'); if (u) u.value = '';
    const p = document.getElementById('l-p'); if (p) p.value = '';
    modal.style.display = 'flex';
  }
  function _showLoginError(msg) {
    const e = document.getElementById('l-e');
    if (e) e.textContent = '❌ ' + msg;
  }
  function _closeLogin() {
    const modal = document.getElementById('lw');
    if (modal) modal.style.display = 'none';
  }

  // The login form submits via this global (wired in views/login.html
  // and in legacy-shim.js for the old onclick="doLogin()" attribute).
  async function doLoginForm() {
    const email = (document.getElementById('l-u') || {}).value || '';
    const pass  = (document.getElementById('l-p') || {}).value || '';
    if (!email.includes('@')) { _showLoginError('Use your email address (not username).'); return; }
    if (pass.length < 6)      { _showLoginError('Password too short.'); return; }
    try {
      await signIn(email.trim(), pass);
      _closeLogin();
      const cb = _pendingCb; _pendingCb = null;
      if (cb) cb();
    } catch (e) {
      console.warn('[auth] Sign-in failed:', e.code, e.message);
      _showLoginError(_friendlyAuthError(e));
    }
  }

  function _friendlyAuthError(e) {
    switch ((e && e.code) || '') {
      case 'auth/invalid-email':       return 'Invalid email format.';
      case 'auth/user-disabled':       return 'This account is disabled.';
      case 'auth/user-not-found':      return 'No such account.';
      case 'auth/wrong-password':      return 'Wrong password.';
      case 'auth/invalid-credential':  return 'Invalid email or password.';
      case 'auth/too-many-requests':   return 'Too many attempts. Wait a minute and try again.';
      case 'auth/network-request-failed': return 'No network connection.';
      default: return (e && e.message) || 'Sign-in failed.';
    }
  }

  global.auth = {
    signIn, signOut, current, onChange, requireRole,
    doLoginForm, closeLogin: _closeLogin
  };

})(window);
