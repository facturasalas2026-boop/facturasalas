/**
 * alas-auth-client.js — Cliente SSO para Items Borrados
 *
 * Verifica el token firmado emitido por el Launcher ALAS.
 * A diferencia de otros proyectos: NO redirige al launcher si no hay sesión,
 * ya que el proyecto tiene su propio login local como fallback.
 *
 * IMPORTANTE: SSO_SECRET debe ser idéntico al VITE_SSO_SECRET del Launcher.
 */
(function () {
  'use strict';

  var _cfg         = window.ALAS_SSO_CONFIG || {};
  var LAUNCHER_URL = _cfg.launcherUrl || 'https://launcher-tawny.vercel.app';
  var SESSION_KEY  = 'alas.sso.session';

  // Verificación server-side: el secreto vive solo en Supabase, nunca en el cliente.
  var VERIFY_URL    = 'https://xkgumqztscqcwamtimuh.supabase.co/functions/v1/verify-sso-token';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrZ3VtcXp0c2NxY3dhbXRpbXVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDc0MjEsImV4cCI6MjA5NTg4MzQyMX0.ncD9XUgR6VDhKiShPAwdNgp3tRoKWIlt4JFEq8audX8';

  /* ── Verificación remota via Edge Function ───────────────── */
  async function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    try {
      var res  = await fetch(VERIFY_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
        body:    JSON.stringify({ token: token }),
      });
      var data = await res.json();
      if (!data.valid) {
        console.warn('[ALAS SSO] Token rechazado por el servidor.');
        return null;
      }
      return data.payload;
    } catch (e) {
      console.warn('[ALAS SSO] Error al verificar token:', e.message);
      return null;
    }
  }

  /* ── Sesión en localStorage ──────────────────────────────── */
  function saveSession(payload) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(payload)); } catch (e) {}
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || Date.now() > s.exp) { localStorage.removeItem(SESSION_KEY); return null; }
      return s;
    } catch (e) { return null; }
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  /* ── Sesión en sessionStorage formato app.js ────────────── */
  function saveCriSession(payload) {
    try {
      sessionStorage.setItem('cri_user', JSON.stringify({
        user: {
          nombre: payload.name  || payload.email || 'Operador',
          rol:    payload.role  || 'visor',
          id:     payload.userId,
          email:  payload.email,
        },
        exp: Date.now() + 8 * 60 * 60 * 1000,
      }));
    } catch (e) {}
  }

  /* ── BroadcastChannel — sincroniza logout entre pestañas del mismo origen ── */
  var _bc = null;
  try {
    _bc = new BroadcastChannel('alas-session');
    _bc.onmessage = function (e) {
      if (e.data === 'logout') {
        clearSession();
        window.location.replace(LAUNCHER_URL);
      }
    };
  } catch (_) {}

  /* ── API pública ─────────────────────────────────────────── */
  function buildAuthClient(session) {
    window.AlasAuthClient = {
      isAuthenticated: true,
      user: session,
      getCurrentUser: function () { return session.name || session.email || 'Operador'; },
      getRole:        function () { return session.role; },
      hasPermission:  function (key) { return Array.isArray(session.permissions) && session.permissions.indexOf(key) !== -1; },
      logout: function () {
        try { if (_bc) _bc.postMessage('logout'); } catch (_) {}
        clearSession();
        window.location.replace(LAUNCHER_URL);
      }
    };
  }

  /* ── Init ────────────────────────────────────────────────── */
  async function init() {
    var params   = new URLSearchParams(window.location.search);
    var rawToken = params.get('alas_token');

    if (rawToken) {
      // Limpiar token de la URL
      params.delete('alas_token');
      var cleanSearch = params.toString() ? '?' + params.toString() : '';
      window.history.replaceState({}, '', window.location.pathname + cleanSearch);

      var payload = await verifyToken(decodeURIComponent(rawToken));
      if (payload) {
        saveSession(payload);
        saveCriSession(payload);
        buildAuthClient(payload);
        console.info('[ALAS SSO] Sesión establecida. Usuario:', payload.name, '| Rol:', payload.role);
        return;
      }
      console.warn('[ALAS SSO] Token inválido. Verificando sesión guardada...');
    }

    var stored = loadSession();
    if (stored) {
      saveCriSession(stored); // sincrónico — app.js lo lee antes de mostrar login
      buildAuthClient(stored);
      console.info('[ALAS SSO] Sesión restaurada. Usuario:', stored.name);
      return;
    }

    // Sin sesión SSO — el login local de la app toma el control
    window.AlasAuthClient = { isAuthenticated: false };
    console.info('[ALAS SSO] Sin sesión SSO. Mostrando login local.');
  }

  // Exponer la promesa para que el bypass script pueda esperarla
  window.__alasAuthReady = init().catch(function (e) {
    console.error('[ALAS SSO] Error crítico:', e.message);
    window.AlasAuthClient = { isAuthenticated: false };
  });

})();
