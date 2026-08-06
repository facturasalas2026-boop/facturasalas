/* ============================================================
 * tablero-login.js — Login directo con usuario/contraseña del Launcher
 * ------------------------------------------------------------
 * Autentica contra el MISMO proyecto Supabase Auth del Launcher
 * (xkgumqztscqcwamtimuh), con la convención usuario→email del RPC
 * get_email_by_username. Verifica que el usuario esté activo y que
 * tenga permiso al módulo "control-facturas" (get_allowed_modules).
 *
 * Convive con el SSO por token del Launcher: si viene con ?alas_token
 * y tiene permiso, no pide login. Si no, muestra la pantalla de login.
 * Expone window.__tableroAuthReady (Promise) que resuelve al autorizar.
 * NUNCA usa service_role; solo la anon key (pública).
 * ========================================================== */
(function () {
  'use strict';

  var AUTH_URL = 'https://xkgumqztscqcwamtimuh.supabase.co';
  var AUTH_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrZ3VtcXp0c2NxY3dhbXRpbXVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDc0MjEsImV4cCI6MjA5NTg4MzQyMX0.ncD9XUgR6VDhKiShPAwdNgp3tRoKWIlt4JFEq8audX8';
  var MODULE_KEY = 'control-facturas';

  var auth = null;
  try {
    if (window.supabase) auth = window.supabase.createClient(AUTH_URL, AUTH_ANON, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'alas-tablero-auth' } });
  } catch (e) { console.error('[TableroLogin] no se pudo crear el cliente de auth', e); }

  var _resolveGate = null, gateEl = null;

  function setAuthClient(p) {
    window.AlasAuthClient = {
      isAuthenticated: true,
      user: p,
      getCurrentUser: function () { return p.full_name || p.username || 'Usuario'; },
      getRole: function () { return p.role || 'operador'; },
      hasPermission: function () { return true; },
      logout: function () { if (auth) auth.auth.signOut().finally(function () { location.reload(); }); else location.reload(); }
    };
    try { localStorage.setItem('alas.current_user', JSON.stringify({ name: p.full_name || p.username, role: p.role })); } catch (_) {}
  }

  var REASON_MSG = { blocked: 'Tu usuario está inactivo o bloqueado.', module: 'Tu usuario no tiene acceso a este módulo.', error: 'No se pudo validar el usuario.' };

  // Devuelve { profile } si está OK, o { reason } si se rechaza.
  // El permiso al módulo NO bloquea si el sistema de permisos está vacío o no responde.
  function authorize(user) {
    if (!auth || !user) return Promise.resolve({ reason: 'error' });
    var basic = { id: user.id, username: (user.email || '').split('@')[0], full_name: (user.email || '').split('@')[0], role: 'operador' };
    return auth.from('profiles').select('id,username,full_name,role,is_active,is_blocked').eq('id', user.id).single()
      .then(function (r) { return r.data || basic; }, function () { return basic; })
      .then(function (p) {
        if (p && (p.is_active === false || p.is_blocked === true)) return { reason: 'blocked' };
        return auth.rpc('get_allowed_modules').then(function (rr) {
          var allowed = (rr && rr.data) || [];
          if (allowed.length && !allowed.some(function (m) { return m && m.key === MODULE_KEY; })) return { reason: 'module' };
          return { profile: p };
        }, function () { return { profile: p }; });
      });
  }

  function tryRestore() {
    if (!auth) return Promise.resolve(false);
    return auth.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) return false;
      return authorize(s.user).then(function (res) { if (res.profile) { setAuthClient(res.profile); return true; } auth.auth.signOut(); return false; });
    }).catch(function () { return false; });
  }

  function doLogin(username, password) {
    if (!auth) return Promise.resolve({ ok: false, msg: 'Sin conexión con el servidor.' });
    return auth.rpc('get_email_by_username', { p_username: (username || '').trim() }).then(function (r) {
      if (r.error || !r.data) return { ok: false, msg: 'Usuario o contraseña incorrectos.' };
      return auth.auth.signInWithPassword({ email: r.data, password: password }).then(function (r2) {
        if (r2.error) return { ok: false, msg: 'Usuario o contraseña incorrectos.' };
        return authorize(r2.data.user).then(function (res) {
          if (!res.profile) return auth.auth.signOut().then(function () { return { ok: false, msg: REASON_MSG[res.reason] || 'Sin acceso.' }; });
          setAuthClient(res.profile);
          try { auth.rpc('register_login'); } catch (_) {}
          return { ok: true };
        });
      });
    }).catch(function () { return { ok: false, msg: 'No se pudo iniciar sesión. Reintentá.' }; });
  }

  function showGate() {
    var l = document.getElementById('loader'); if (l) l.classList.add('loader--hidden');
    gateEl = document.createElement('div');
    gateEl.className = 'login-gate';
    gateEl.innerHTML =
      '<form class="login-card" id="loginForm" autocomplete="on">' +
        '<div class="login-brand"><img src="logo-icon.png" alt="ALAS"></div>' +
        '<h1>Tablero de Facturación Diaria</h1>' +
        '<p class="login-sub">Ingresá con tu usuario de ALAS</p>' +
        '<label class="login-field"><span>Usuario</span><input type="text" id="lgUser" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>' +
        '<label class="login-field"><span>Contraseña</span><input type="password" id="lgPass" autocomplete="current-password" required></label>' +
        '<div class="login-err" id="lgErr"></div>' +
        '<button type="submit" class="login-btn" id="lgBtn">Ingresar</button>' +
      '</form>';
    document.body.appendChild(gateEl);
    requestAnimationFrame(function () { gateEl.classList.add('show'); });
    if (window.gsap) gsap.from('.login-card', { y: 24, opacity: 0, scale: .96, duration: .5, ease: 'back.out(1.5)' });
    setTimeout(function () { var u = document.getElementById('lgUser'); if (u) u.focus(); }, 120);

    gateEl.querySelector('#loginForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var u = gateEl.querySelector('#lgUser').value, p = gateEl.querySelector('#lgPass').value;
      var btn = gateEl.querySelector('#lgBtn'), err = gateEl.querySelector('#lgErr');
      err.textContent = ''; btn.disabled = true; btn.classList.add('is-loading'); btn.textContent = 'Ingresando…';
      doLogin(u, p).then(function (res) {
        if (res.ok) {
          gateEl.classList.add('done');
          setTimeout(function () { if (gateEl && gateEl.parentNode) gateEl.remove(); if (_resolveGate) _resolveGate(); }, 350);
        } else {
          err.textContent = res.msg || 'Error al ingresar.';
          btn.disabled = false; btn.classList.remove('is-loading'); btn.textContent = 'Ingresar';
          if (window.gsap) gsap.fromTo('.login-card', { x: -9 }, { x: 0, duration: .45, ease: 'elastic.out(1,0.4)' });
        }
      });
    });
    return new Promise(function (resolve) { _resolveGate = resolve; });
  }

  function whenDomReady() { return new Promise(function (res) { if (document.body) return res(); document.addEventListener('DOMContentLoaded', function () { res(); }, { once: true }); }); }

  function ensureAuth() {
    return whenDomReady().then(function () { return Promise.resolve(window.__alasAuthReady || null); }).then(function () {
      var c = window.AlasAuthClient;
      if (c && c.isAuthenticated && (!c.hasPermission || c.hasPermission(MODULE_KEY))) return true; // SSO válido con permiso
      return tryRestore().then(function (ok) { return ok ? true : showGate(); });
    }).catch(function () { return showGate(); });
  }

  window.__tableroAuthReady = ensureAuth();
})();
