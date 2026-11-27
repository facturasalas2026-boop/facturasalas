/* ============================================================
 * app.js — Tablero de Facturación Diaria · ALAS
 * ------------------------------------------------------------
 * Shell del ecosistema (sidebar + modal) + diseño del prototipo
 * embebido en #stage. Datos: snapshot-mirror en Supabase.
 * Al actualizar: overlay 0→100% + check azul + detección de cambios.
 * ============================================================ */
(function () {
  'use strict';

  /* ── Helpers base ── */
  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function T(id, txt) { var e = document.getElementById(id); if (e) e.textContent = txt; }
  function H(id, html) { var e = document.getElementById(id); if (e) e.innerHTML = html; }
  // Conteo animado (GSAP) con formateo por frame; mata el tween previo del elemento
  function animCount(el, to, fmtFn, dur) {
    if (!el) return; to = to || 0;
    if (!window.gsap) { el.textContent = fmtFn(to); return; }
    if (el._ct) el._ct.kill();
    var o = { v: 0 };
    el._ct = gsap.to(o, { v: to, duration: dur || .9, ease: 'power2.out', onUpdate: function () { el.textContent = fmtFn(o.v); }, onComplete: function () { el.textContent = fmtFn(to); } });
  }
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  var fmt = function (n) { return (Math.round(n) || 0).toLocaleString('es-PY').replace(/,/g, '.'); };
  var fmtM = function (n) { var a = Math.abs(n); if (a >= 1e9) return (n / 1e9).toLocaleString('es-PY', { maximumFractionDigits: 2 }) + ' MM'; if (a >= 1e6) return (n / 1e6).toLocaleString('es-PY', { maximumFractionDigits: 1 }) + ' M'; return fmt(n); };
  var pct = function (n, d) { return d ? (n / d * 100) : 0; };
  var fp = function (v) { return (v >= 0 ? '+' : '') + v.toLocaleString('es-PY', { maximumFractionDigits: 1 }) + '%'; };
  var chipCls = function (v) { return v > 0.5 ? 'up' : (v < -0.5 ? 'down' : 'flat'); };
  var arrow = function (v) { return v > 0.5 ? '▲' : (v < -0.5 ? '▼' : '●'); };
  function trendArrow(cls) {
    if (cls === 'up') return '<svg fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';
    if (cls === 'down') return '<svg fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>';
    return '<svg fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" stroke-linecap="round"><path d="M5 12h14"/></svg>';
  }

  function toast(msg, err) {
    var t = el('<div class="toast ' + (err ? 'toast--err' : '') + '">' + esc(msg) + '</div>');
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 3000);
  }

  var IC = {
    upload: '<svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>',
    empty: '<svg fill="none" stroke="currentColor" stroke-width="1.4" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 2 4-6"/></svg>',
    grid: '<svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/></svg>',
    refresh: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>',
    deposito: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V9.5l7-4 7 4V21"/><path d="M9 21v-6h6v6"/><path d="M9 11.5h6"/></svg>',
    fabrica: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M4 21V11l5 3V11l5 3V8l5 3v10"/><path d="M8 21v-4h3v4"/></svg>',
    scan: '<svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/><path d="M7 8v8M10 8v8M13 8v8M17 8v8"/></svg>',
    userIco: '<svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    clock: '<svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    check: '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    search: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>',
    clearX: '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    alert: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>'
  };

  /* ── Rol / permisos (gate real = SSO) ── */
  function isAdmin() {
    var c = window.AlasAuthClient;
    if (!c || !c.isAuthenticated) return true; // dev / sin SSO
    var role = (c.getRole && c.getRole() || '').toLowerCase();
    return role === 'admin' || role === 'supervisor';
  }
  function userRole() { var c = window.AlasAuthClient; return (c && c.getRole && c.getRole() || '').toLowerCase(); }
  function userName() { var c = window.AlasAuthClient; return (c && c.getCurrentUser && c.getCurrentUser()) || '—'; }
  function userId() { var c = window.AlasAuthClient; var u = c && c.user; return (u && (u.id || u.userId)) || null; }
  // Rol restringido: solo ve "Control de facturas" y entra directo ahí.
  function isRegistroOnly() { return userRole() === 'registro'; }
  function confirmPro(opts) {
    var bd = el('<div class="modal-bd"><div class="modal-box cpro">' +
      '<div class="cpro__ico ' + (opts.danger ? 'cpro__ico--danger' : '') + '"><svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></div>' +
      '<h3 class="cpro__t">' + esc(opts.title || '¿Confirmar?') + '</h3>' +
      (opts.text ? '<p class="cpro__tx">' + opts.text + '</p>' : '') +
      '<div class="cpro__foot"><button class="btn" data-close>' + esc(opts.cancelLabel || 'Cancelar') + '</button>' +
      '<button class="btn ' + (opts.danger ? 'btn--danger-solid' : 'btn--primary') + '" id="cproOk">' + esc(opts.okLabel || 'Confirmar') + '</button></div></div></div>');
    document.body.appendChild(bd);
    requestAnimationFrame(function () {
      bd.classList.add('open');
      if (window.gsap) { gsap.from(bd, { opacity: 0, duration: .22 }); gsap.from(bd.querySelector('.cpro'), { y: 20, scale: .93, opacity: 0, duration: .38, ease: 'back.out(1.7)' }); }
    });
    function close() { if (window.gsap) { gsap.to(bd, { opacity: 0, duration: .2, onComplete: function () { bd.remove(); } }); } else bd.remove(); }
    bd.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', close); });
    bd.addEventListener('click', function (e) { if (e.target === bd) close(); });
    q('#cproOk', bd).addEventListener('click', function () { close(); if (opts.onOk) opts.onOk(); });
  }

  /* ── ESTADO ── */
  var LS_KEY = 'alas_tablero_fact_v3';
  var D = null, holidays = [], hoyOverride = null;
  var MT = {};   // 'anio-mes' -> {t,f,h}: total de cada mes según su propio snapshot
  function cargarMT() {
    if (!(window.TableroDB && TableroDB.ready && TableroDB.monthTotals)) return Promise.resolve();
    return TableroDB.monthTotals().then(function (rows) { MT = {}; rows.forEach(function (r) { MT[r.anio + '-' + r.mes] = r; }); }).catch(function () {});
  }
  // Facturación 2026 por mes: histórico del Excel + meses cerrados guardados en la nube
  function v26Completo(arr, campo) {
    var out = (arr || []).slice(), y = D.cur_year;
    for (var i = 0; i < 12; i++) {
      if (i === D.cur_month - 1) continue;                    // el mes en curso sale del propio snapshot
      if (i > D.cur_month - 1) { out[i] = out[i] || 0; continue; }
      var m = MT[y + '-' + (i + 1)];
      if ((!out[i] || Math.abs(out[i]) < 1) && m && m[campo]) out[i] = m[campo];
    }
    return out;
  }
  var SCOPE = 'tot', pedView = 'almacen', fAlm = 'todos', fEt = 'todos';
  var dataOrigin = 'nube', updatedInfo = null, charts = {}, currentView = 'principal';
  var availableMonths = [];

  var EMPTY_SNAP = {
    cur_month: new Date().getMonth() + 1, cur_year: new Date().getFullYear(), meses: MESES,
    meta_tot: Array(12).fill(0), meta_ldal: Array(12).fill(0), meta_ldfa: Array(12).fill(0),
    v2025: Array(12).fill(0), v2026: Array(12).fill(0),
    v2025_fer: Array(12).fill(0), v2026_fer: Array(12).fill(0),
    v2025_hie: Array(12).fill(0), v2026_hie: Array(12).fill(0),
    daily: [], daily_fer: [], daily_hie: [], fact_almacen: {}, devoluciones: 0, fact_bruta: 0,
    last_bd_cur: 0, last_bd_prevyear: 0, last_bd_prevyear_fer: 0, last_bd_prevyear_hie: 0,
    last_bd_date: null, ped_lines: [], _stamp: 0
  };

  /* ── CÁLCULO (portado del prototipo) ── */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtHoy(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dOf(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function isHol(y, m, d) { var s = y + '-' + pad(m + 1) + '-' + pad(d); return holidays.some(function (h) { return h.date === s; }); }
  // Cuánto "vale" un sábado frente a un día de semana, según lo que se factura de verdad.
  // Con pocos datos usa 0,25 (promedio real ago–nov 2026: 26 %).
  function pesoSabado(daily) {
    var sa = [], se = [];
    (daily || []).forEach(function (x) { var w = dOf(x[0]).getDay(); if (w === 6) sa.push(x[1]); else if (w !== 0) se.push(x[1]); });
    if (sa.length < 2 || se.length < 5) return 0.25;
    var av = function (a) { return a.reduce(function (p, c) { return p + c; }, 0) / a.length; };
    var f = av(sa) / av(se);
    return Math.max(0.1, Math.min(1, f));
  }
  function pesoDia(dt, ps) { return dt.getDay() === 6 ? ps : 1; }
  // días hábiles PONDERADOS (el sábado cuenta como fracción) — para proyecciones y ritmo
  function bdW(y, m, hoy, ps) {
    var tot = 0, el = 0, days = new Date(y, m + 1, 0).getDate();
    for (var d = 1; d <= days; d++) { var dt = new Date(y, m, d), w = dt.getDay(); if (w === 0 || isHol(y, m, d)) continue; var p = pesoDia(dt, ps); tot += p; if (hoy && dt <= hoy) el += p; }
    return { tot: tot, el: el };
  }
  function bdaysMonth(y, m) { var tot = 0, days = new Date(y, m + 1, 0).getDate(), fds = 0, fer = 0; for (var d = 1; d <= days; d++) { var w = new Date(y, m, d).getDay(); if (w === 0) { fds++; continue; } if (isHol(y, m, d)) { fer++; continue; } tot++; } return { tot: tot, days: days, fds: fds, fer: fer }; }
  function bdaysElapsed(y, m, hoy) { var n = 0, days = new Date(y, m + 1, 0).getDate(); for (var d = 1; d <= days; d++) { var dt = new Date(y, m, d), w = dt.getDay(); if (w === 0) continue; if (isHol(y, m, d)) continue; if (dt <= hoy) n++; } return n; }
  function bdaysYear(y) { var n = 0, end = new Date(y, 11, 31); for (var dt = new Date(y, 0, 1); dt <= end; dt.setDate(dt.getDate() + 1)) { var w = dt.getDay(); if (w !== 0) n++; } return n; }
  function bdaysYearElapsed(y, hoy) { var n = 0; for (var dt = new Date(y, 0, 1); dt <= hoy; dt.setDate(dt.getDate() + 1)) { var w = dt.getDay(); if (w !== 0) n++; } return n; }
  function hoyDate() { if (hoyOverride) return hoyOverride; if (D.daily && D.daily.length) return dOf(D.daily[D.daily.length - 1][0]); return new Date(D.cur_year, D.cur_month - 1, new Date(D.cur_year, D.cur_month, 0).getDate()); }
  // ¿Hoy es día hábil del mes en curso y todavía no hay datos cargados de hoy?
  function todayPending() {
    if (!D) return false;
    var now = hoyOverride ? new Date(hoyOverride.getTime()) : new Date(); now.setHours(0, 0, 0, 0);
    if (D.cur_year !== now.getFullYear() || D.cur_month !== now.getMonth() + 1) return false;
    var w = now.getDay(); if (w === 0) return false;
    if (isHol(now.getFullYear(), now.getMonth(), now.getDate())) return false;
    var last = (D.daily && D.daily.length) ? dOf(D.daily[D.daily.length - 1][0]) : null;
    if (!last) return true; last.setHours(0, 0, 0, 0);
    return last.getTime() < now.getTime();
  }
  function scoped(sc) {
    if (sc === 'fer') return { v26: v26Completo(D.v2026_fer, 'f'), v25: D.v2025_fer, meta: D.meta_ldal, daily: D.daily_fer, dprev: D.daily_prev_fer, prev: D.last_bd_prevyear_fer, label: '· Ferretería' };
    if (sc === 'hie') return { v26: v26Completo(D.v2026_hie, 'h'), v25: D.v2025_hie, meta: D.meta_ldfa, daily: D.daily_hie, dprev: D.daily_prev_hie, prev: D.last_bd_prevyear_hie, label: '· Hierros' };
    return { v26: v26Completo(D.v2026, 't'), v25: D.v2025, meta: D.meta_tot, daily: D.daily, dprev: D.daily_prev, prev: D.last_bd_prevyear, label: '' };
  }
  function lastBD(daily, hoy) { var bd = daily.filter(function (x) { var d = dOf(x[0]); return d.getDay() !== 0 && d <= hoy; }); return bd.length ? { val: bd[bd.length - 1][1], date: bd[bd.length - 1][0] } : { val: 0, date: null }; }
  function kpis(sc) {
    var S = scoped(sc), mi = D.cur_month - 1, y = D.cur_year, hoy = hoyDate();
    var bm = bdaysMonth(y, mi), bd_tot = bm.tot, bd_el = Math.min(bdaysElapsed(y, mi, hoy), bd_tot), bd_rest = bd_tot - bd_el;
    var ps = pesoSabado(S.daily), w = bdW(y, mi, hoy, ps);
    var fact = S.v26[mi], meta = S.meta[mi], proyMes = w.el > 0 ? fact / w.el * w.tot : fact;
    // 2) Mes vs 2025 AL MISMO DÍA HÁBIL (no contra el mes completo)
    var mesYoYFull = S.v25[mi], mesYoY, yoyExacto = false;
    if (S.dprev && S.dprev.length) {
      var bdPrev = S.dprev.filter(function (x) { return dOf(x[0]).getDay() !== 0; }), n = Math.min(bd_el, bdPrev.length);
      mesYoY = 0; for (var bi = 0; bi < n; bi++) mesYoY += bdPrev[bi][1];
      // días no hábiles intercalados (domingos con alguna factura) hasta esa fecha
      var lim = n ? bdPrev[n - 1][0] : null; if (lim) S.dprev.forEach(function (x) { if (dOf(x[0]).getDay() === 0 && x[0] <= lim) mesYoY += x[1]; });
      yoyExacto = true;
    } else {
      // snapshot viejo sin el diario de 2025: se estima con la misma proporción de días hábiles
      mesYoY = w.tot > 0 ? mesYoYFull * w.el / w.tot : mesYoYFull;
    }
    var varYoY = pct(fact - mesYoY, mesYoY);
    var lb = lastBD(S.daily, hoy), varDia = pct(lb.val - S.prev, S.prev);
    var metaAnual = S.meta.reduce(function (a, b) { return a + b; }, 0);
    var ytd = 0; for (var i = 0; i <= mi; i++) ytd += S.v26[i] || 0;
    // 4) Meta acumulada a hoy: meses cerrados completos + el mes en curso según días transcurridos
    var metaYtd = 0; for (var j = 0; j < mi; j++) metaYtd += S.meta[j] || 0;
    metaYtd += w.tot > 0 ? (S.meta[mi] || 0) * w.el / w.tot : 0;
    var cumplYtd = pct(ytd, metaYtd);
    // 1) Proyección fin de año: lo facturado + metas que faltan × cumplimiento del año
    var metaResto = (S.meta[mi] || 0) * (w.tot > 0 ? (w.tot - w.el) / w.tot : 0); for (var r = mi + 1; r < 12; r++) metaResto += S.meta[r] || 0;
    var proyAnio = ytd + metaResto * (metaYtd > 0 ? ytd / metaYtd : 1);
    // 4) Cobertura: lo que falta para la meta del mes vs lo que ya está en pedidos pendientes
    var pend = pedResumen(sc).total, faltaMes = Math.max(0, meta - fact);
    return { ps: ps, wTot: w.tot, wEl: w.el, mesYoYFull: mesYoYFull, yoyExacto: yoyExacto, metaYtd: metaYtd, cumplYtd: cumplYtd, pend: pend, faltaMes: faltaMes, cobertura: faltaMes > 0 ? pct(pend, faltaMes) : null,
      mi: mi, y: y, bd_tot: bd_tot, bd_el: bd_el, bd_rest: bd_rest, fact: fact, meta: meta, proyMes: proyMes, mesYoY: mesYoY, varYoY: varYoY, varDia: varDia, metaAnual: metaAnual, ytd: ytd, proyAnio: proyAnio, daysMonth: bm.days, fds: bm.fds, fer: bm.fer, lastCur: lb.val, lastDate: lb.date, prev: S.prev, label: S.label };
  }
  function pedResumen(sc) { var L = D.ped_lines; if (sc === 'fer') L = L.filter(function (l) { return l[0] === 'Ferretería'; }); else if (sc === 'hie') L = L.filter(function (l) { return l[0] === 'Hierros'; }); var total = 0, peso = 0, docs = {}; L.forEach(function (l) { total += l[7]; peso += l[6]; docs[l[9]] = 1; }); return { lineas: L.length, pedidos: Object.keys(docs).length, total: total, peso: peso }; }
  function pedFiltered() { return D.ped_lines.filter(function (l) { return (fAlm === 'todos' || l[0] === fAlm) && (fEt === 'todos' || l[1] === fEt); }); }
  function grp(L, keyfn) { var o = {}; L.forEach(function (l) { var k = keyfn(l); if (k == null) return; (o[k] = o[k] || [0, 0, 0]); o[k][0] += l[7]; o[k][1] += l[6]; o[k][2]++; }); return o; }
  function arrSort(o) { return Object.keys(o).map(function (k) { return [k, o[k][0], o[k][1], o[k][2]]; }).sort(function (a, b) { return b[1] - a[1]; }); }
  var pesoLbl = ['0–50 kg', '50–200 kg', '200–500 kg', '500–1.000 kg', '1.000–5.000 kg', '+5.000 kg'];
  var pesoEdges = [0, 50, 200, 500, 1000, 5000, 1e12];
  function pesoBucket(pe) { var bi = pesoEdges.findIndex(function (e, i) { return pe >= e && pe < pesoEdges[i + 1]; }); return bi < 0 ? pesoLbl.length - 1 : bi; }
  var esExt = function (l) { return (l[3] || '').trim().toLowerCase() === 'venta normal'; };
  var pedDef = {
    almacen: { title: 'Distribución por almacén', cols: ['Almacén', 'Monto ₲', 'Peso (kg)', 'Líneas'], bar: false, rows: function (L) { return arrSort(grp(L, function (l) { return l[0]; })); } },
    vext: { title: 'Top vendedores externos', cols: ['Vendedor externo', 'Monto ₲', 'Peso (kg)', 'Líneas'], bar: false, rows: function (L) { return arrSort(grp(L.filter(esExt), function (l) { return l[2]; })).slice(0, 15); } },
    vint: { title: 'Vendedor interno / call center', cols: ['Vendedor interno', 'Monto ₲', 'Peso (kg)', 'Líneas'], bar: false, rows: function (L) { return arrSort(grp(L.filter(function (l) { return !esExt(l) && l[3] !== 'Sin asignar'; }), function (l) { return l[3]; })).slice(0, 15); } },
    prod: { title: 'Producción / Importados', cols: ['Origen', 'Monto ₲', 'Peso (kg)', 'Líneas'], bar: false, rows: function (L) { return arrSort(grp(L, function (l) { return l[8]; })); } },
    fecha: { title: 'Por fecha de autorización', cols: ['Fecha', 'Monto ₲', 'Peso (kg)', 'Líneas'], bar: true, rows: function (L) { var o = grp(L, function (l) { return l[4] || 'Sin fecha'; }); return Object.keys(o).map(function (k) { return [k, o[k][0], o[k][1], o[k][2]]; }).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }); } },
    hora: { title: 'Por hora de creación del pedido', cols: ['Hora', 'Monto ₲', '', 'Líneas'], bar: true, rows: function (L) { var o = grp(L, function (l) { return l[5] >= 0 ? l[5] : null; }); return Object.keys(o).map(function (k) { return [String(k).padStart(2, '0') + ':00', o[k][0], null, o[k][2]]; }).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }); } },
    peso: { title: 'Por rango de peso', cols: ['Rango', 'Monto ₲', 'Peso (kg)', 'Líneas'], bar: false, rows: function (L) { var b = {}; pesoLbl.forEach(function (l) { b[l] = [0, 0, 0]; }); L.forEach(function (l) { var bi = pesoBucket(l[6]); b[pesoLbl[bi]][0] += l[7]; b[pesoLbl[bi]][1] += l[6]; b[pesoLbl[bi]][2]++; }); return pesoLbl.map(function (l) { return [l, b[l][0], b[l][1], b[l][2]]; }); } },
    etapa: { title: 'Por etapa del pedido', cols: ['Etapa', 'Monto ₲', 'Peso (kg)', 'Líneas'], bar: false, rows: function (L) { return arrSort(grp(L, function (l) { return l[1]; })); } }
  };

  /* ── PARSING del Excel SAP ── */
  var XALM = { LDAL: 'Ferretería', LDFA: 'Hierros', LDDV: 'Almacén LDDV', LFTD: 'Tienda Fábrica' };
  var PALM = { LDAL: 'Ferretería', LDFA: 'Hierros', LFTD: 'Tienda Fábrica', LDDV: 'Devoluciones' };
  function num(v) { if (typeof v === 'number') return v; if (typeof v === 'string') { var s = v.replace(/PYG/gi, '').replace(/\./g, '').replace(/\s/g, '').replace(/,/g, '.'); var n = parseFloat(s); return isNaN(n) ? 0 : n; } return 0; }
  function asDate(v) { if (v instanceof Date) return v; if (typeof v === 'string') { var m = v.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/); if (m) { var y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); } var d = new Date(v); if (!isNaN(d)) return d; } if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000)); return null; }
  function hourOf(v) { if (v instanceof Date) return v.getHours(); if (typeof v === 'string') { var m = v.match(/(\d{1,2}):/); if (m) return +m[1]; } if (typeof v === 'number' && v < 1) return Math.floor(v * 24); return -1; }
  var keyOf = function (o, name) { var k = Object.keys(o).find(function (x) { return x.trim().toLowerCase() === name.trim().toLowerCase(); }); return k ? o[k] : undefined; };
  // Valida que el Excel subido SEA la planilla SAP de facturación (hojas + columnas clave).
  // Devuelve {ok:true} o {ok:false, reason:'...'} para NO dejar cargar un archivo equivocado.
  function validateWB(wb) {
    if (!wb || !wb.SheetNames || !wb.SheetNames.length) return { ok: false, reason: 'El archivo no tiene hojas. ¿Es un Excel válido?' };
    var find = function (n) { var k = wb.SheetNames.find(function (x) { return String(x).trim().toLowerCase() === n.trim().toLowerCase(); }); return k ? wb.Sheets[k] : null; };
    // Hojas que debe tener la planilla de facturación diaria
    var REQ = ['x monto de fc fecha', 'Facturacion historico', 'BASE PEDIDOS PEND. DE FACTURAR', 'Presupuesto de ventas (Meta)'];
    var missing = REQ.filter(function (n) { return !find(n); });
    if (missing.length) return { ok: false, reason: 'Esta no parece la planilla de facturación SAP. Falta(n) la(s) hoja(s): «' + missing.join('», «') + '».' };
    // Columnas clave de la hoja diaria (por si es un Excel distinto con una hoja de nombre parecido)
    var colsOf = function (ws) { var set = {}; XLSX.utils.sheet_to_json(ws, { defval: null }).slice(0, 40).forEach(function (r) { Object.keys(r).forEach(function (k) { set[String(k).trim().toLowerCase()] = 1; }); }); return set; };
    var has = function (set, name) { return !!set[name.trim().toLowerCase()]; };
    var xc = colsOf(find('x monto de fc fecha'));
    var need = ['Fecha de documento', 'Monto Gs', 'Almacen'];
    var faltan = need.filter(function (c) { return !has(xc, c); });
    if (faltan.length) return { ok: false, reason: 'La hoja «x monto de fc fecha» no tiene la(s) columna(s): ' + faltan.join(' · ') + '. Revisá que sea la planilla correcta.' };
    return { ok: true };
  }

  function parseWB(wb) {
    var d = JSON.parse(JSON.stringify(EMPTY_SNAP));
    var S = function (n) { return wb.Sheets[wb.SheetNames.find(function (x) { return x.trim().toLowerCase() === n.toLowerCase(); })]; };
    var ms = S('Presupuesto de ventas (Meta)');
    if (ms) { var a = XLSX.utils.sheet_to_json(ms, { header: 1 }); var mt = [], ml = [], mf = []; for (var i = 0; i < 12; i++) { var r = a[2 + i] || []; ml.push(num(r[1])); mf.push(num(r[2])); mt.push(num(r[3]) || num(r[1]) + num(r[2])); } d.meta_tot = mt; d.meta_ldal = ml; d.meta_ldfa = mf; }
    var hs = S('Facturacion historico');
    var v25 = Array(12).fill(0), v26 = Array(12).fill(0), v25f = Array(12).fill(0), v26f = Array(12).fill(0), v25h = Array(12).fill(0), v26h = Array(12).fill(0), hrows = [];
    if (hs) {
      hrows = XLSX.utils.sheet_to_json(hs);
      hrows.forEach(function (r) { var dt = asDate(keyOf(r, 'Fecha de facturacion')); if (!dt) return; var mo = num(keyOf(r, 'Monto')), y = dt.getFullYear(), m = dt.getMonth(); var code = (keyOf(r, 'Almacen_codigo') || '').toString().trim(); var g = code === 'Alas' ? 'fer' : (code === 'Alas Dep. Fabric' ? 'hie' : null); if (y === 2025) { v25[m] += mo; if (g === 'fer') v25f[m] += mo; else if (g === 'hie') v25h[m] += mo; } else if (y === 2026) { v26[m] += mo; if (g === 'fer') v26f[m] += mo; else if (g === 'hie') v26h[m] += mo; } });
      d.v2025 = v25; d.v2026 = v26; d.v2025_fer = v25f; d.v2026_fer = v26f; d.v2025_hie = v25h; d.v2026_hie = v26h;
    }
    var xs = S('x monto de fc fecha');
    if (xs) {
      var rows = XLSX.utils.sheet_to_json(xs);
      var daily = {}, dailyf = {}, dailyh = {}, alm = {}, curM = null, curY = null, mc = {}, dev = 0, bruta = 0, DEVCF = ['ZDEV', 'ZDCS', 'ZNCV'], DEVCD = ['DG', 'DI', 'DK'];
      rows.forEach(function (r) { var dt = asDate(keyOf(r, 'Fecha de documento')); if (!dt) return; mc[dt.getMonth()] = (mc[dt.getMonth()] || 0) + 1; });
      curM = +Object.entries(mc).sort(function (a, b) { return b[1] - a[1]; })[0][0];
      rows.forEach(function (r) { var dt = asDate(keyOf(r, 'Fecha de documento')); if (!dt || dt.getMonth() !== curM) return; curY = dt.getFullYear(); var mo = num(keyOf(r, 'Monto Gs')), ds = fmtHoy(dt), aa = keyOf(r, 'Almacen'); daily[ds] = (daily[ds] || 0) + mo; if (aa === 'LDAL') dailyf[ds] = (dailyf[ds] || 0) + mo; else if (aa === 'LDFA') dailyh[ds] = (dailyh[ds] || 0) + mo; var cf = (keyOf(r, 'Clase Factura') || '').toString().trim().toUpperCase(), cd = (keyOf(r, 'Clase de documento') || '').toString().trim().toUpperCase(); if (DEVCF.indexOf(cf) >= 0 || DEVCD.indexOf(cd) >= 0) dev += mo; else bruta += mo; var an = XALM[aa] || aa || 'Otros'; alm[an] = (alm[an] || 0) + mo; });
      d.cur_month = curM + 1; d.cur_year = curY;
      var srt = function (o) { return Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }); };
      d.daily = srt(daily); d.daily_fer = srt(dailyf); d.daily_hie = srt(dailyh); d.fact_almacen = alm; d.devoluciones = dev; d.fact_bruta = bruta;
      d.v2026[curM] = d.daily.reduce(function (a, x) { return a + x[1]; }, 0);
      d.v2026_fer[curM] = d.daily_fer.reduce(function (a, x) { return a + x[1]; }, 0);
      d.v2026_hie[curM] = d.daily_hie.reduce(function (a, x) { return a + x[1]; }, 0);
      var lastb = function (lst) { var b = lst.filter(function (x) { var w = dOf(x[0]).getDay(); return w !== 0; }); return b.length ? b[b.length - 1] : null; };
      var lb = lastb(d.daily); if (lb) { d.last_bd_cur = lb[1]; d.last_bd_date = lb[0]; }
      var pd = { tot: {}, fer: {}, hie: {} };
      hrows.forEach(function (r) { var dt = asDate(keyOf(r, 'Fecha de facturacion')); if (!dt) return; if (dt.getFullYear() === curY - 1 && dt.getMonth() === curM) { var ds = fmtHoy(dt), mo = num(keyOf(r, 'Monto')), code = (keyOf(r, 'Almacen_codigo') || '').toString().trim(); pd.tot[ds] = (pd.tot[ds] || 0) + mo; if (code === 'Alas') pd.fer[ds] = (pd.fer[ds] || 0) + mo; else if (code === 'Alas Dep. Fabric') pd.hie[ds] = (pd.hie[ds] || 0) + mo; } });
      // Nº de día hábil (L-S) del mes que corresponde al último día con datos
      var Nbd = 0;
      if (d.last_bd_date) { var _lb = dOf(d.last_bd_date), _y = _lb.getFullYear(), _m = _lb.getMonth(); for (var _dd = 1; _dd <= _lb.getDate(); _dd++) { var _w = new Date(_y, _m, _dd).getDay(); if (_w !== 0) Nbd++; } }
      // mismo Nº de día hábil del año anterior (no el último del mes)
      var nthPrevBD = function (o) { var b = Object.keys(o).sort().filter(function (ds) { var w = dOf(ds).getDay(); return w !== 0; }); if (!b.length) return 0; var i = Nbd > 0 ? Math.min(Nbd, b.length) - 1 : b.length - 1; return o[b[i]]; };
      d.last_bd_prevyear = nthPrevBD(pd.tot); d.last_bd_prevyear_fer = nthPrevBD(pd.fer); d.last_bd_prevyear_hie = nthPrevBD(pd.hie);
      d.daily_prev = srt(pd.tot); d.daily_prev_fer = srt(pd.fer); d.daily_prev_hie = srt(pd.hie);   // 2025 día a día del mismo mes
    }
    var ps = S('BASE PEDIDOS PEND. DE FACTURAR');
    if (ps) {
      var prows = XLSX.utils.sheet_to_json(ps).filter(function (r) { return keyOf(r, 'Doc.vtas.') != null && keyOf(r, 'Doc.vtas.') !== ''; });
      var lines = [];
      prows.forEach(function (r) { var doc = String(keyOf(r, 'Doc.vtas.')); var fe = asDate(keyOf(r, 'Fecha Entrega')), fes = fe ? fmtHoy(fe) : ''; var alm2 = PALM[keyOf(r, 'Almacén')] || 'Sin asignar'; var hh = hourOf(keyOf(r, 'Hora Creac. De Ped.')); var total = num(keyOf(r, 'Total')), peso = num(keyOf(r, 'Peso')); var vext = (keyOf(r, 'Nombre Ext') || 'Sin asignar').toString(); var vint = (keyOf(r, 'Nombre Int') || 'Sin asignar').toString(); var et = (keyOf(r, 'Etapa del pedido') || 'Sin etapa').toString().trim(); var mp = (keyOf(r, 'Material de produccion') || '').toString().trim().toUpperCase(); var prod = mp === 'ALAS' ? 'Producción Alas' : (mp === 'IMPORTADO' ? 'Importados' : 'Sin clasificar'); lines.push([alm2, et, vext, vint, fes, hh, peso, total, prod, doc]); });
      d.ped_lines = lines;
    }
    d._stamp = Date.now();
    return d;
  }

  /* ── GRÁFICOS ── */
  var AZ = '#1466B0', GRAY = '#B8C4D0';
  function chartsReady() { return typeof Chart !== 'undefined'; }
  function mk(id, cfg) { if (!chartsReady()) return; if (charts[id]) { try { charts[id].destroy(); } catch (e) {} } var c = document.getElementById(id); if (c) charts[id] = new Chart(c, cfg); }
  function killCharts() { Object.keys(charts).forEach(function (k) { try { charts[k].destroy(); } catch (e) {} }); charts = {}; }
  if (chartsReady()) { Chart.defaults.font.family = "'Inter',system-ui,sans-serif"; Chart.defaults.font.size = 11; Chart.defaults.color = '#5B6B7C'; }
  var gsTick = { callback: function (v) { return fmtM(v); } };

  /* ── MARKUP de las 4 secciones (diseño del prototipo) ── */
  var SECTIONS_HTML =
    '<section class="page on" id="principal">' +
    '<div class="grid g2" style="margin-bottom:18px">' +
    '<div class="p3-hero" id="p3Hero">' +
      '<div class="p3-lbl"><span>Meta mensual · avance <b id="hScope"></b></span><em class="p3-st" id="p3St"></em><em class="p3-gap" id="p3Gap"></em></div>' +
      '<div class="p3-body">' +
        '<div class="p3-ring"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="50"/><circle class="fg" id="p3Ring" cx="60" cy="60" r="50" stroke-dasharray="314.16" stroke-dashoffset="314.16"/></svg><div class="p3-ring__c"><b id="gPct">–</b><span>de la meta</span></div></div>' +
        '<div class="p3-main">' +
          '<span class="p3-k">Meta del mes</span>' +
          '<b class="p3-meta"><span class="u">₲</span><span id="hMeta">–</span></b>' +
          '<div class="p3-bar"><span id="hBar"></span><i id="p3Mk" title="Proyección de fin de mes"><em>proyección</em></i></div>' +
          '<div class="p3-bl"><span>Facturado <b id="hFact">–</b></span><span>Falta <b id="hFalta">–</b></span></div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="card accent" id="cardDia">' +
    '<div class="acc-top"><span class="acc-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h3"/></svg></span><div class="acc-topx"><span class="acc-lbl">Facturación del día</span><span class="acc-sub" id="kDiaFecha">—</span></div></div>' +
    '<div class="acc-num"><span class="u">₲</span><span id="kDia">–</span></div>' +
    '<div class="acc-obj"><div class="acc-obj-hd"><span>Objetivo del día hábil</span><b id="kDiaObjPct">–</b></div><div class="acc-obj-bar"><span id="kDiaObjBar"></span></div><div class="acc-obj-sub">Necesario ₲ <span id="kDiaObj">–</span>/día en los <span id="kDiaObjDays">–</span> días hábiles que faltan</div></div>' +
    '<div class="acc-foot"><span class="acc-trend flat" id="kDiaVar">—</span><span class="acc-vs">vs mismo día hábil del año anterior · <b>₲ <span id="kDiaPrev">–</span></b></span></div>' +
    '<div class="acc-pending"><span class="acc-pending-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M9 14.5h6"/></svg></span><div class="acc-pending-t">Sin registros de hoy</div><div class="acc-pending-s">Cargá la planilla del <b id="accPendDate">—</b> para ver la facturación del día</div></div>' +
    '</div>' +
    '</div>' +
    '<div class="p2-tiles">' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/><path d="M15 8h3v3"/></svg></i><span>Proyección fin de mes</span><em class="p2-c" id="kProyPct">–</em></div><b class="p2-t__v">₲ <span id="kProy">–</span></b><div class="p2-tbar"><span id="kProyBar"></span><i id="kProyMk"></i></div><small>Al ritmo actual · sábado = <span id="kPs">–</span> de un día</small></div>' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/></svg></i><span>Mes vs año pasado</span><em class="p2-c" id="kMesVar">–</em></div><b class="p2-t__v">₲ <span id="kMes">–</span></b><div class="p2-t__s">contra ₲ <span id="kMesPrev">–</span></div><small id="kMesPrevL">–</small></div>' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></i><span>Cumplimiento del año</span><em class="p2-c" id="kYtdPct">–</em></div><b class="p2-t__v">₲ <span id="kYtd">–</span></b><div class="p2-tbar"><span id="kYtdBar"></span></div><small>Meta a hoy ₲ <span id="kYtdMeta">–</span> · cierre estimado ₲ <span id="kAnio">–</span></small></div>' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16l-1.5 11a2 2 0 01-2 1.7H7.5a2 2 0 01-2-1.7z"/><path d="M9 7V5a3 3 0 016 0v2"/></svg></i><span>Lo que falta vs pendientes</span><em class="p2-c" id="kCob">–</em></div><b class="p2-t__v">₲ <span id="kCobPend">–</span></b><div class="p2-tbar"><span id="kCobBar"></span></div><small>en pedidos, de ₲ <span id="kCobFalta">–</span> que faltan · <a href="#" class="p2-link" data-go="pedidos">ver pedidos</a></small></div>' +
    '</div>' +
    '<div class="p2-row">' +
      '<div class="card p2-daily"><div class="p2-h"><h3>Facturación día por día <span id="dScope"></span></h3><span class="p2-leg"><i></i>superó el objetivo del día</span></div><div class="p2-dl" id="dailyTbl"></div></div>' +
      '<div class="p2-col">' +
        '<div class="card"><div class="p2-h"><h3>Facturado por almacén</h3></div><div id="almBox"></div></div>' +
        '<div class="card p2-ped"><div class="p2-h"><h3>Pedidos pendientes de facturar <span id="pScope"></span></h3><a href="#" class="p2-link" data-go="pedidos">Ver detalle →</a></div>' +
          '<div class="p2-ped__g"><div><b id="pgTot">–</b><span>monto ₲</span></div><div><b id="pgPed">–</b><span>pedidos</span></div><div><b id="pgLin">–</b><span>líneas</span></div><div><b id="pgPeso">–</b><span>kg</span></div></div></div>' +
      '</div>' +
    '</div>' +
    '</section>' +

    '<section class="page" id="mesames">' +
    '<div class="p2-tiles mm-tiles">' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/></svg></i><span>Acumulado vs año pasado</span><em class="p2-c" id="mmVar">–</em></div><b class="p2-t__v">₲ <span id="mmYtd">–</span></b><div class="p2-t__s">contra ₲ <span id="mmYtd25">–</span></div><small id="mmYtdL">–</small></div>' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/></svg></i><span>Cumplimiento del año</span><em class="p2-c" id="mmCum">–</em></div><b class="p2-t__v">₲ <span id="mmMetaYtd">–</span></b><div class="p2-tbar"><span id="mmCumBar"></span></div><small>meta a hoy · meta anual ₲ <span id="mmMetaAn">–</span></small></div>' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/></svg></i><span>Mejor mes del año</span><em class="p2-c ok" id="mmBestP">–</em></div><b class="p2-t__v" id="mmBest">–</b><small id="mmBestS">–</small></div>' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2.6 17.3A2 2 0 004.3 20h15.4a2 2 0 001.7-2.7L13.7 3.9a2 2 0 00-3.4 0z"/></svg></i><span>Mes más flojo</span><em class="p2-c bad" id="mmWorstP">–</em></div><b class="p2-t__v" id="mmWorst">–</b><small id="mmWorstS">–</small></div>' +
    '</div>' +
    '<div class="mm-charts">' +
      '<div class="card"><div class="p2-h"><h3>Facturación por mes</h3><span class="mm-leg"><span><i class="b"></i>2026</span><span><i class="g"></i>2025</span><span><i class="m"></i>Meta</span></span></div><div class="chartbox mm-box"><canvas id="chTrend"></canvas></div></div>' +
      '<div class="card"><div class="p2-h"><h3>Acumulado del año</h3><span class="mm-leg"><span><i class="b"></i>2026</span><span><i class="g"></i>2025</span><span><i class="m"></i>Meta</span></span></div><div class="chartbox mm-box"><canvas id="chAcum"></canvas></div></div>' +
    '</div>' +
    '<div class="card"><div class="p2-h"><h3>Mes a mes</h3><span class="p2-leg"><i></i>alcanzó la meta del mes</span></div><div class="mm-tbl"><table id="tblMM"><thead><tr><th>Mes</th><th class="r">2026</th><th class="r">2025</th><th class="r">Var. vs 2025</th><th class="r">Meta</th><th>Cumplimiento</th><th class="r">Acumulado 2026</th></tr></thead><tbody></tbody></table></div></div>' +
    '</section>' +

    '<section class="page" id="pedidos">' +
    '<div class="pedfilters"><div class="fld"><label>Almacén</label><select id="fAlm"></select></div><div class="fld"><label>Etapa del pedido</label><select id="fEt"></select></div></div>' +
    '<div class="grid g4" style="margin-bottom:16px"><div class="card"><h3>Líneas pendientes</h3><div class="big" id="p2Lin">–</div></div><div class="card"><h3>Pedidos</h3><div class="big" id="p2Ped">–</div></div><div class="card"><h3>Monto total</h3><div class="big"><span class="u">₲</span><span id="p2Tot">–</span></div></div><div class="card"><h3>Peso total</h3><div class="big"><span id="p2Peso">–</span><span class="u" style="font-size:14px"> kg</span></div></div></div>' +
    '<div class="pill-row" id="pedPills"><button class="pill on" data-v="almacen">Por almacén</button><button class="pill" data-v="vext">Por vendedor externo</button><button class="pill" data-v="vint">Por vendedor interno</button><button class="pill" data-v="prod">Prod./Import</button><button class="pill" data-v="fecha">Por fecha de autorización</button><button class="pill" data-v="hora">Por hora de creación</button><button class="pill" data-v="peso">Por peso</button><button class="pill" data-v="etapa">Por etapa</button></div>' +
    '<div class="grid g2"><div class="card"><h3 id="pedChTitle">Distribución</h3><div class="chartbox"><canvas id="chPed"></canvas></div></div><div class="card"><h3 id="pedTblTitle">Detalle</h3><div class="scrolltbl" style="max-height:360px" id="pedTblBox"></div></div></div>' +
    '</section>' +

    '<section class="page" id="config">' +
    '<div class="grid g2" style="margin-bottom:16px">' +
    '<div class="card"><h3>Cálculo de días hábiles</h3><div class="stat-row"><span class="k">Mes analizado</span><span class="v" id="cfMes">–</span></div><div class="stat-row"><span class="k">Días del mes</span><span class="v" id="cfDias">–</span></div><div class="stat-row"><span class="k">Domingos</span><span class="v" id="cfFds">–</span></div><div class="stat-row"><span class="k">Feriados cargados</span><span class="v" id="cfFer">–</span></div><div class="stat-row"><span class="k">Días hábiles (L-S, netos)</span><span class="v" id="cfHab">–</span></div><div class="stat-row"><span class="k">Transcurridos hasta hoy</span><span class="v" id="cfTrans">–</span></div><div class="stat-row"><span class="k">Que faltan</span><span class="v" id="cfFalt">–</span></div></div>' +
    '<div class="card"><h3>Feriados (excepciones manuales)</h3><div class="holiday-in" id="ferAddRow"><div class="fld"><label>Fecha del feriado</label><input type="date" id="ferDate"></div><div class="fld"><label>Descripción (opcional)</label><input type="text" id="ferName" placeholder="Ej: Día del trabajador"></div><button class="btn" id="btnAddFer" style="background:var(--azul);color:#fff">+ Agregar</button></div><div id="ferList"></div><div class="note" style="margin-top:14px">Los feriados se descuentan de los días hábiles y recalculan las proyecciones para todo el equipo.</div></div>' +
    '</div>' +
    '<div class="card"><h3>Fecha de referencia ("hoy")</h3><div class="holiday-in" style="margin-bottom:0"><div class="fld"><label>Simular fecha (para proyecciones)</label><input type="date" id="hoyInput"></div><button class="btn" id="btnHoy" style="background:var(--azul-tenue);color:var(--azul)">Aplicar</button><button class="btn" id="btnHoyReset" style="background:#eef1f5;color:var(--gris)">Volver a la última fecha con datos</button></div></div>' +
    '</section>';

  /* ── Filtro de segmento (Almacén) para la toolbar ── */
  function scopeBarHtml() {
    function b(s, ico, lbl) { return '<button class="scopebtn' + (SCOPE === s ? ' on' : '') + '" data-s="' + s + '">' + ico + lbl + '</button>'; }
    return '<div class="scopebar" id="scopeSeg">' + b('tot', IC.grid, 'Total') + b('fer', IC.deposito, 'Ferretería') + b('hie', IC.fabrica, 'Hierros') + '</div>';
  }

  /* ── Navegador de mes ── */
  function monthsList() { return availableMonths.length ? availableMonths : [{ anio: D.cur_year, mes: D.cur_month }]; }
  function monthNavHtml() {
    var months = monthsList(), idx = months.findIndex(function (m) { return m.anio === D.cur_year && m.mes === D.cur_month; });
    if (idx < 0) idx = months.length - 1;
    return '<div class="mnav"><button class="mnav__btn" id="mnPrev"' + (idx > 0 ? '' : ' disabled') + ' title="Mes anterior">‹</button><span class="mnav__cur">' + esc(MESES[D.cur_month - 1] + ' ' + D.cur_year) + '</span><button class="mnav__btn" id="mnNext"' + (idx < months.length - 1 ? '' : ' disabled') + ' title="Mes siguiente">›</button></div>';
  }
  function wireMonthNav(scope) {
    var months = monthsList(), idx = months.findIndex(function (m) { return m.anio === D.cur_year && m.mes === D.cur_month; });
    var p = q('#mnPrev', scope), n = q('#mnNext', scope);
    if (p) p.addEventListener('click', function () { if (idx > 0) gotoMonth(months[idx - 1]); });
    if (n) n.addEventListener('click', function () { if (idx < months.length - 1) gotoMonth(months[idx + 1]); });
  }
  /* ── Refrescar datos desde la nube (con spin GSAP) ── */
  function refreshData() {
    if (!(window.TableroDB && TableroDB.ready)) { toast('Sin conexión para refrescar', true); return; }
    if (!D) { boot(); return; }
    var btn = q('#btnRefresh'), icon = btn ? btn.querySelector('svg') : null, spin = null;
    if (btn) btn.classList.add('is-busy');
    if (window.gsap && icon) { gsap.set(icon, { transformOrigin: '50% 50%' }); spin = gsap.to(icon, { rotation: '+=360', duration: .8, ease: 'none', repeat: -1 }); }
    var minD = new Promise(function (r) { setTimeout(r, 700); });
    Promise.all([TableroDB.pullFeriados(), TableroDB.pullSnapshotFor(D.cur_year, D.cur_month), TableroDB.listMonths(), minD, cargarMT()])
      .then(function (res) {
        holidays = (res[0] || []).map(function (r) { return { date: r.fecha, name: r.descripcion || '' }; });
        availableMonths = res[2] || [];
        var row = res[1];
        if (row && row.snapshot) { D = row.snapshot; dataOrigin = 'nube'; updatedInfo = { updated_at: row.updated_at, updated_by: row.updated_by }; }
        if (spin) spin.kill();
        renderShell();
        toast('Datos actualizados');
      })
      .catch(function (e) { console.error(e); if (spin) spin.kill(); if (btn) btn.classList.remove('is-busy'); toast('No se pudo refrescar', true); });
  }

  /* ── Chip de última actualización (última carga del Excel) ── */
  function updChipHtml() {
    if (!updatedInfo || !updatedInfo.updated_at) return '';
    var d = new Date(updatedInfo.updated_at);
    if (isNaN(d)) return '';
    var s = pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' · ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    return '<span class="upd-chip" title="Última carga del Excel' + (updatedInfo.updated_by ? ' · ' + esc(updatedInfo.updated_by) : '') + '"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg><span>Última actualización</span> <b>' + s + '</b></span>';
  }

  function gotoMonth(m) {
    if (!m || (m.anio === D.cur_year && m.mes === D.cur_month)) return;
    if (!(window.TableroDB && TableroDB.ready)) { toast('Sin conexión para cambiar de mes', true); return; }
    TableroDB.pullSnapshotFor(m.anio, m.mes).then(function (row) {
      if (!row || !row.snapshot) { toast('No hay datos de ese mes', true); return; }
      D = row.snapshot; dataOrigin = 'nube'; updatedInfo = { updated_at: row.updated_at, updated_by: row.updated_by }; hoyOverride = null;
      renderShell();
    }).catch(function () { toast('No se pudo cargar el mes', true); });
  }

  /* ── Título/subtítulo por vista ── */
  function toolbarInfo(v) {
    var per = MESES[D.cur_month - 1] + ' ' + D.cur_year;
    if (v === 'mesames') return { t: 'Mes a mes & tendencias', s: 'Comparativa 2026 vs 2025 · metas' };
    if (v === 'pedidos') return { t: 'Pedidos pendientes', s: 'Agrupá y filtrá lo pendiente de facturar' };
    if (v === 'config') return { t: 'Días hábiles & feriados', s: 'Cálculo del mes · ' + per };
    return { t: 'Facturación diaria', s: '' };
  }
  function setToolbarTitle(v) { var info = toolbarInfo(v); T('tbdTitle', info.t); T('tbdSub', info.s); }

  /* ── SHELL / render ── */
  function setNav(v) { qa('[data-nav]').forEach(function (b) { var on = b.dataset.nav === v, was = b.classList.contains('is-active'); b.classList.toggle('is-active', on); if (on && !was && window.gsap) { var ic = b.querySelector('.nav-btn__ico'); if (ic) gsap.fromTo(ic, { scale: .7 }, { scale: 1, duration: .4, ease: 'back.out(2.2)', clearProps: 'transform' }); } }); }
  function popScope(b) { if (!window.gsap) return; var ic = b.querySelector('svg'); gsap.fromTo(b, { scale: .92 }, { scale: 1, duration: .4, ease: 'back.out(2.4)', clearProps: 'transform' }); if (ic) gsap.fromTo(ic, { rotate: -18, scale: .7 }, { rotate: 0, scale: 1, duration: .5, ease: 'back.out(2.6)', clearProps: 'transform' }); }

  function renderEmpty() {
    killCharts();
    q('#stage').innerHTML =
      '<div class="tbd-toolbar"><div class="tbd-title"><h2>Tablero de Facturación Diaria</h2><span class="sub">Sin datos cargados todavía</span></div><span class="spacer"></span>' +
      (isAdmin() ? '<button class="btn btn--primary btn--hero" id="btnActualizar">' + IC.upload + ' Actualizar base</button>' : '') + '</div>' +
      '<div class="empty">' + IC.empty + '<h3>Todavía no hay una base cargada</h3><p>' + (isAdmin() ? 'Usá <b>Actualizar base</b> (arriba) para subir la planilla SAP. Se publicará para todo el equipo.' : 'Pedile a un administrador que cargue la base de facturación.') + '</p></div>';
    var b = q('#btnActualizar'); if (b) b.addEventListener('click', function () { q('#fileBase').click(); });
  }

  function renderShell() {
    if (!D) { renderEmpty(); return; }
    killCharts();
    var scopeApplies = currentView === 'principal' || currentView === 'mesames';
    q('#stage').innerHTML =
      '<div class="tbd-toolbar"><div class="tbd-title"><h2 id="tbdTitle"></h2><span class="sub" id="tbdSub"></span></div>' +
      '<div id="scopeSlot"' + (scopeApplies ? '' : ' style="display:none"') + '>' + scopeBarHtml() + '</div>' +
      '<span class="spacer"></span>' +
      updChipHtml() +
      monthNavHtml() +
      '<button class="refresh-btn" id="btnRefresh" type="button" title="Refrescar datos" aria-label="Refrescar datos">' + IC.refresh + '</button>' +
      (isAdmin() ? '<button class="btn btn--primary btn--hero" id="btnActualizar">' + IC.upload + ' Actualizar base</button>' : '') +
      '</div><div class="tbd">' + SECTIONS_HTML + '</div>';
    qa('#stage .tbd .page').forEach(function (s) { s.classList.toggle('on', s.id === currentView); });
    setToolbarTitle(currentView);
    wireShell();
    renderPage(currentView);
    if (window.gsap) {
      gsap.from('#stage .tbd-toolbar', { opacity: 0, y: -8, duration: .35, ease: 'power2.out', clearProps: 'all' });
      var sb = q('#scopeSlot');
      if (sb && sb.style.display !== 'none') gsap.from(sb.querySelectorAll('.scopebtn'), { opacity: 0, y: -10, scale: .9, duration: .42, stagger: .07, ease: 'back.out(1.8)', clearProps: 'all', delay: .08 });
    }
  }

  function wireShell() {
    wireMonthNav(q('#stage'));
    var ba = q('#btnActualizar'); if (ba) ba.addEventListener('click', function () { q('#fileBase').click(); });
    var rb = q('#btnRefresh'); if (rb) rb.addEventListener('click', refreshData);
    qa('#scopeSeg .scopebtn').forEach(function (b) { b.addEventListener('click', function () { if (SCOPE === b.dataset.s) return; SCOPE = b.dataset.s; qa('#scopeSeg .scopebtn').forEach(function (x) { x.classList.toggle('on', x === b); }); popScope(b); renderPage(currentView); }); });
    qa('#pedPills .pill').forEach(function (b) { b.addEventListener('click', function () { if (pedView === b.dataset.v) return; pedView = b.dataset.v; qa('#pedPills .pill').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); renderPedidos(); }); });
    var fa = q('#fAlm'), fe = q('#fEt');
    if (fa) fa.addEventListener('change', function (e) { fAlm = e.target.value; renderPedidos(); });
    if (fe) fe.addEventListener('change', function (e) { fEt = e.target.value; renderPedidos(); });
    var addRow = q('#ferAddRow'); if (addRow && !isAdmin()) addRow.style.display = 'none';
    var af = q('#btnAddFer'); if (af) af.addEventListener('click', addFer);
    var bh = q('#btnHoy'); if (bh) bh.addEventListener('click', function () { var v = q('#hoyInput').value; if (!v) { toast('Elegí una fecha', true); return; } hoyOverride = dOf(v); toast('Fecha de referencia aplicada'); renderShell(); });
    var br = q('#btnHoyReset'); if (br) br.addEventListener('click', function () { hoyOverride = null; toast('Volviendo a la última fecha con datos'); renderShell(); });
  }

  function go(v) {
    currentView = v; setNav(v);
    if (v === 'registro') { renderRegistro(); return; }
    if (_regUnsub) { _regUnsub(); _regUnsub = null; }  // saliendo del registro: cortar realtime
    if (!D) { renderEmpty(); return; }
    if (!q('#stage .tbd')) { renderShell(); return; }   // el shell no está montado (venías del registro/empty)
    qa('#stage .tbd .page').forEach(function (s) { s.classList.toggle('on', s.id === v); });
    var ss = q('#scopeSlot'); if (ss) ss.style.display = (v === 'principal' || v === 'mesames') ? '' : 'none';
    setToolbarTitle(v);
    renderPage(v);
    var pg = q('#stage #' + v); if (window.gsap && pg) gsap.from(pg.children, { opacity: 0, y: 10, duration: .34, stagger: .04, ease: 'power2.out', clearProps: 'transform,opacity' });
  }
  function renderPage(v) { if (v === 'principal') renderPrincipal(); else if (v === 'mesames') renderMesAMes(); else if (v === 'pedidos') renderPedidos(); else if (v === 'config') renderConfig(); }

  /* ── RENDER: PRINCIPAL ── */
  function renderPrincipal() {
    var k = kpis(SCOPE), S = scoped(SCOPE);
    T('hScope', k.label); T('dScope', k.label); T('pScope', k.label);
    var av = pct(k.fact, k.meta);
    var G0 = !!window.gsap, pvH = pct(k.proyMes, k.meta);
    var stH = av >= 100 ? ['ok', 'Meta cumplida'] : pvH >= 100 ? ['ok', 'En camino a la meta'] : pvH >= 90 ? ['warn', 'Cerca de la meta'] : ['bad', 'Por debajo del ritmo'];
    var hero = q('#p3Hero'); if (hero) hero.className = 'p3-hero st-' + stH[0];
    var stE = q('#p3St'); if (stE) { stE.className = 'p3-st ' + stH[0]; stE.innerHTML = '<i></i>' + stH[1]; }
    var gp = q('#p3Gap'); if (gp) gp.innerHTML = 'Proyección <b>' + pvH.toFixed(1).replace('.', ',') + '%</b>';
    var rg = q('#p3Ring'), offH = 314.16 * (1 - Math.min(av, 100) / 100);
    if (rg) { if (G0) gsap.fromTo(rg, { attr: { 'stroke-dashoffset': 314.16 } }, { attr: { 'stroke-dashoffset': offH }, duration: 1.2, ease: 'power3.out' }); else rg.setAttribute('stroke-dashoffset', offH); }
    animCount(q('#gPct'), av, function (v) { return v.toFixed(1).replace('.', ',') + '%'; }, 1.1);
    animCount(q('#hMeta'), k.meta, fmt, 1.1);
    var hb = q('#hBar'); if (hb) { if (G0) gsap.fromTo(hb, { width: '0%' }, { width: Math.min(av, 100) + '%', duration: 1.1, delay: .15, ease: 'power3.out' }); else hb.style.width = Math.min(av, 100) + '%'; }
    var mk3 = q('#p3Mk'); if (mk3) { mk3.style.left = Math.min(pvH, 100) + '%'; if (G0) gsap.from(mk3, { opacity: 0, y: -6, duration: .4, delay: .9, ease: 'power2.out', clearProps: 'transform,opacity' }); }
    animCount(q('#hFact'), k.fact, function (v) { return '₲ ' + fmt(v); }, 1.1);
    animCount(q('#hFalta'), Math.max(0, k.meta - k.fact), function (v) { return '₲ ' + fmt(v); }, 1.1);
    if (G0) { gsap.from('#p3Hero', { opacity: 0, y: 14, duration: .5, ease: 'power3.out', clearProps: 'transform,opacity' }); gsap.from('#p3Hero .p3-ring', { scale: .85, opacity: 0, duration: .6, delay: .1, ease: 'back.out(1.6)', clearProps: 'transform,opacity' }); gsap.from('#cardDia .acc-ico', { scale: 0, rotate: -20, duration: .5, delay: .2, ease: 'back.out(2.4)', clearProps: 'transform' }); }
    animCount(q('#kFact'), k.fact, function (v) { return fmt(v); }, 1); animCount(q('#kMeta'), k.meta, function (v) { return '₲ ' + fmt(v); }, 1);
    var falta = k.meta - k.fact, cf = q('#kFalta'); if (cf) { cf.textContent = falta > 0 ? 'Falta ₲ ' + fmt(falta) : 'Meta superada +₲ ' + fmt(-falta); cf.className = 'chip ' + (falta > 0 ? 'flat' : 'up'); }
    animCount(q('#kProy'), k.proyMes, function (v) { return fmt(v); }, 1); var pp = q('#kProyPct'), pv = pct(k.proyMes, k.meta); if (pp) { pp.textContent = arrow(pv - 100) + ' ' + pv.toFixed(1) + '%'; pp.className = 'chip ' + (pv >= 100 ? 'up' : pv >= 90 ? 'flat' : 'down'); }
    // KPI destacado: Facturación del día — estado "sin registros de hoy" si el día hábil no está cargado
    var _pend = todayPending(), _cd0 = q('#cardDia'); if (_cd0) _cd0.classList.toggle('is-pending', _pend);
    if (_pend) { var _n = hoyOverride ? new Date(hoyOverride.getTime()) : new Date(); T('accPendDate', pad(_n.getDate()) + '/' + pad(_n.getMonth() + 1) + '/' + _n.getFullYear()); if (window.gsap) gsap.from('#cardDia .acc-pending', { opacity: 0, y: 10, scale: .96, duration: .5, ease: 'back.out(1.5)', clearProps: 'all' }); }
    animCount(q('#kDia'), k.lastCur, function (v) { return fmt(v); }, 1.1);
    T('kDiaFecha', 'Último día hábil · ' + (k.lastDate ? k.lastDate.split('-').reverse().join('/') : '—'));
    animCount(q('#kDiaPrev'), k.prev, function (v) { return fmt(v); }, 1.1);
    // Objetivo del día DINÁMICO: ritmo requerido = meta restante ÷ días hábiles que faltan
    var remMeta = Math.max(0, k.meta - k.fact), remDays = Math.max(0, k.bd_rest), remW = Math.max(0, k.wTot - k.wEl);
    var reqDaily = remW > 0 ? remMeta / remW : remMeta;   // por día de semana completo
    var ultSab = k.lastDate && dOf(k.lastDate).getDay() === 6;
    var pctObj = remMeta <= 0 ? 100 : pct(k.lastCur, ultSab ? reqDaily * k.ps : reqDaily);
    animCount(q('#kDiaObjPct'), pctObj, function (v) { return Math.round(v) + '%'; }, 1.1);
    animCount(q('#kDiaObj'), reqDaily, function (v) { return fmt(v); }, 1.1);
    animCount(q('#kDiaObjDays'), remDays, function (v) { return Math.round(v); }, .8);
    var ob = q('#kDiaObjBar'); if (ob) { if (ob.parentNode) ob.parentNode.classList.toggle('over', pctObj >= 100); if (window.gsap) { ob.style.transition = 'none'; gsap.fromTo(ob, { width: '0%' }, { width: Math.min(pctObj, 100) + '%', duration: 1.1, ease: 'power2.out', delay: .2 }); } else ob.style.width = Math.min(pctObj, 100) + '%'; }
    var dv = q('#kDiaVar'); if (dv) { var _cls = chipCls(k.varDia); dv.className = 'acc-trend ' + _cls; dv.innerHTML = trendArrow(_cls) + fp(k.varDia); if (window.gsap) gsap.fromTo(dv, { scale: .7, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'back.out(2)', delay: .4, clearProps: 'all' }); }
    if (window.gsap) { var cd = q('#cardDia'); if (cd) { gsap.from(cd.querySelector('.acc-top'), { x: -10, opacity: 0, duration: .5, ease: 'power2.out', clearProps: 'all' }); gsap.from(cd.querySelector('.acc-num'), { y: 8, opacity: 0, duration: .5, delay: .1, ease: 'power2.out', clearProps: 'all' }); gsap.from(cd.querySelector('.acc-foot'), { y: 10, opacity: 0, duration: .5, delay: .22, ease: 'power2.out', clearProps: 'all' }); } }
    // ── Tarjetas (diseño nuevo) ──
    var G = !!window.gsap, P = function (v) { return v.toFixed(1).replace('.', ',') + '%'; };
    var est = function (p) { return p >= 100 ? 'ok' : p >= 90 ? 'warn' : 'bad'; };
    var pv2 = pct(k.proyMes, k.meta), ppc = q('#kProyPct'); if (ppc) { ppc.textContent = P(pv2) + ' de la meta'; ppc.className = 'p2-c ' + est(pv2); }
    var pb = q('#kProyBar'); if (pb) { pb.className = est(pv2); pb.dataset.w = Math.min(pv2, 100); }
    T('kPs', Math.round(k.ps * 100) + ' %');
    var mv = q('#kMesVar'); if (mv) { mv.textContent = fp(k.varYoY); mv.className = 'p2-c ' + (k.varYoY >= 0.5 ? 'ok' : k.varYoY <= -0.5 ? 'bad' : 'na'); }
    animCount(q('#kMes'), k.fact, fmt, 1); animCount(q('#kMesPrev'), k.mesYoY, fmt, 1);
    T('kMesPrevL', D.meses[k.mi] + ' ' + (k.y - 1) + ' al día hábil ' + k.bd_el + (k.yoyExacto ? '' : ' (estimado)') + ' · mes completo ₲ ' + fmt(k.mesYoYFull));
    var yp = q('#kYtdPct'); if (yp) { yp.textContent = P(k.cumplYtd) + ' de la meta'; yp.className = 'p2-c ' + est(k.cumplYtd); }
    var yb = q('#kYtdBar'); if (yb) { yb.className = est(k.cumplYtd); yb.dataset.w = Math.min(k.cumplYtd, 100); }
    animCount(q('#kYtd'), k.ytd, fmt, 1); animCount(q('#kYtdMeta'), k.metaYtd, fmt, 1); animCount(q('#kAnio'), k.proyAnio, fmt, 1);
    var cbp = q('#kCob'), cbr = q('#kCobBar');
    if (k.cobertura == null) { if (cbp) { cbp.textContent = 'Meta cumplida'; cbp.className = 'p2-c ok'; } if (cbr) { cbr.className = 'ok'; cbr.dataset.w = 100; } }
    else { if (cbp) { cbp.textContent = Math.round(k.cobertura) + '% cubierto'; cbp.className = 'p2-c ' + (k.cobertura >= 100 ? 'ok' : k.cobertura >= 60 ? 'warn' : 'bad'); } if (cbr) { cbr.className = k.cobertura >= 100 ? 'ok' : k.cobertura >= 60 ? 'warn' : 'bad'; cbr.dataset.w = Math.min(k.cobertura, 100); } }
    animCount(q('#kCobFalta'), k.faltaMes, fmt, 1); animCount(q('#kCobPend'), k.pend, fmt, 1);
    qa('#principal .p2-tbar span').forEach(function (sp) { if (G) gsap.fromTo(sp, { width: '0%' }, { width: sp.dataset.w + '%', duration: 1, delay: .25, ease: 'power3.out' }); else sp.style.width = sp.dataset.w + '%'; });

    // ── Día por día: barra + marca del objetivo del día (meta ÷ días hábiles, sábado ponderado) ──
    var objBase = k.wTot > 0 ? k.meta / k.wTot : 0, maxD = Math.max.apply(null, S.daily.map(function (x) { return x[1]; }).concat([objBase, 1])), tt = 0, h = '';
    var WD = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    S.daily.forEach(function (x) {
      var dt = dOf(x[0]), v = x[1], obj = dt.getDay() === 6 ? objBase * k.ps : objBase, ok = obj > 0 && v >= obj; tt += v;
      h += '<div class="p2-d' + (ok ? ' ok' : '') + '" title="Objetivo del día ₲ ' + fmt(obj) + '"><span class="p2-d__f"><b>' + x[0].slice(8) + '</b>' + WD[dt.getDay()] + '</span>' +
        '<span class="p2-d__b"><i data-w="' + (Math.max(0, v) / maxD * 100).toFixed(1) + '"></i><em style="left:' + Math.min(100, obj / maxD * 100).toFixed(1) + '%"></em></span>' +
        '<span class="p2-d__v">' + fmt(v) + '</span></div>';
    });
    h += '<div class="p2-d tot"><span class="p2-d__f"><b>Total</b></span><span></span><span class="p2-d__v">' + fmt(tt) + '</span></div>';
    H('dailyTbl', h);
    var dbars = qa('#dailyTbl .p2-d__b i'); dbars.forEach(function (i) { i.style.width = i.dataset.w + '%'; });
    if (G) gsap.fromTo(dbars, { scaleX: 0 }, { scaleX: 1, transformOrigin: '0% 50%', duration: .7, stagger: .02, delay: .2, ease: 'power3.out', clearProps: 'transform' });

    // ── Por almacén: Ferretería, Hierros y Otros ──
    var fa = D.fact_almacen || {}, fer = fa['Ferretería'] || 0, hie = fa['Hierros'] || 0, otros = 0;
    Object.keys(fa).forEach(function (kk) { if (kk !== 'Ferretería' && kk !== 'Hierros') otros += fa[kk]; });
    var neta = fer + hie + otros, maxA = Math.max(Math.abs(fer), Math.abs(hie), Math.abs(otros), 1), ah = '';
    [['Ferretería', fer, 'var(--azul-3)'], ['Hierros', hie, 'var(--azul)'], ['Otros', otros, '#94A3B8']].forEach(function (e) {
      ah += '<div class="p2-a"><div class="p2-a__h"><span><i style="background:' + e[2] + '"></i>' + e[0] + '</span><b>₲ ' + fmt(e[1]) + '</b><em>' + (neta ? P(e[1] / neta * 100) : '0%') + '</em></div><div class="p2-a__b"><span data-w="' + (Math.abs(e[1]) / maxA * 100).toFixed(1) + '" style="background:' + e[2] + '"></span></div></div>';
    });
    var dev = Math.abs(D.devoluciones || 0), bru = D.fact_bruta || 0;
    ah += '<div class="p2-a__t"><span>Facturación neta</span><b>₲ ' + fmt(neta) + '</b></div><div class="p2-a__d"><span>Devoluciones incluidas</span><b>₲ ' + fmt(dev) + ' · ' + (bru ? P(dev / bru * 100) : '0%') + ' del bruto</b></div>';
    H('almBox', ah);
    qa('#almBox .p2-a__b span').forEach(function (sp) { if (G) gsap.fromTo(sp, { width: '0%' }, { width: sp.dataset.w + '%', duration: .9, delay: .2, ease: 'power3.out' }); else sp.style.width = sp.dataset.w + '%'; });

    // ── Pendientes ──
    var g = pedResumen(SCOPE); animCount(q('#pgLin'), g.lineas, fmt, .9); animCount(q('#pgPed'), g.pedidos, fmt, .9); animCount(q('#pgTot'), g.total, fmt, .9); animCount(q('#pgPeso'), g.peso, fmt, .9);
    qa('#principal [data-go]').forEach(function (a2) { a2.onclick = function (e) { e.preventDefault(); go(a2.dataset.go); }; });

    if (G) {
      gsap.from('#principal .p2-t', { opacity: 0, y: 12, duration: .45, stagger: .06, delay: .1, ease: 'power3.out', clearProps: 'transform,opacity' });
      gsap.from('#principal .p2-t__h i', { scale: 0, rotate: -20, duration: .5, stagger: .06, delay: .2, ease: 'back.out(2.4)', clearProps: 'transform' });
      gsap.from('#principal .p2-row > *', { opacity: 0, y: 14, duration: .45, stagger: .08, delay: .2, ease: 'power3.out', clearProps: 'transform,opacity' });
    }
  }

  /* ── RENDER: MES A MES ── */
  function renderMesAMes() {
    var S = scoped(SCOPE), k = kpis(SCOPE), mi = k.mi, G = !!window.gsap;
    var P = function (v) { return v.toFixed(1).replace('.', ',') + '%'; };
    var est = function (p) { return p >= 100 ? 'ok' : p >= 90 ? 'warn' : 'bad'; };
    var v25 = S.v25, meta = S.meta, v26 = S.v26.map(function (v, i) { return i <= mi ? (v || 0) : null; });
    // Acumulado vs 2025 en el MISMO período (meses cerrados completos + mes en curso al mismo día hábil)
    var y25 = k.mesYoY; for (var i = 0; i < mi; i++) y25 += v25[i] || 0;
    var vv = pct(k.ytd - y25, y25), ve = q('#mmVar'); if (ve) { ve.textContent = fp(vv); ve.className = 'p2-c ' + (vv >= 0.5 ? 'ok' : vv <= -0.5 ? 'bad' : 'na'); }
    animCount(q('#mmYtd'), k.ytd, fmt, 1); animCount(q('#mmYtd25'), y25, fmt, 1);
    T('mmYtdL', 'enero a ' + D.meses[mi].toLowerCase() + ' ' + (k.y - 1) + ' al mismo día hábil' + (k.yoyExacto ? '' : ' (estimado)'));
    var ce = q('#mmCum'); if (ce) { ce.textContent = P(k.cumplYtd) + ' de la meta'; ce.className = 'p2-c ' + est(k.cumplYtd); }
    animCount(q('#mmMetaYtd'), k.metaYtd, fmt, 1); animCount(q('#mmMetaAn'), k.metaAnual, fmt, 1);
    var cb = q('#mmCumBar'); if (cb) { cb.className = est(k.cumplYtd); cb.dataset.w = Math.min(k.cumplYtd, 100); }
    // mejor y peor mes cerrado según cumplimiento de su meta
    var cer = []; for (var j = 0; j < mi; j++) if (v26[j] && meta[j]) cer.push({ i: j, p: pct(v26[j], meta[j]) });
    cer.sort(function (a, b) { return b.p - a.p; });
    if (cer.length) {
      var be = cer[0], wo = cer[cer.length - 1];
      T('mmBest', D.meses[be.i]); T('mmBestP', P(be.p) + ' de la meta'); T('mmBestS', '₲ ' + fmt(v26[be.i]) + ' de ₲ ' + fmt(meta[be.i]));
      T('mmWorst', D.meses[wo.i]); T('mmWorstP', P(wo.p) + ' de la meta'); T('mmWorstS', '₲ ' + fmt(v26[wo.i]) + ' de ₲ ' + fmt(meta[wo.i]));
      var bp = q('#mmBestP'); if (bp) bp.className = 'p2-c ' + est(be.p); var wp = q('#mmWorstP'); if (wp) wp.className = 'p2-c ' + est(wo.p);
    }
    qa('#mesames .p2-tbar span').forEach(function (sp) { if (G) gsap.fromTo(sp, { width: '0%' }, { width: sp.dataset.w + '%', duration: 1, delay: .2, ease: 'power3.out' }); else sp.style.width = sp.dataset.w + '%'; });

    // Gráfico por mes: barras 2026 (color según la meta), línea 2025 y meta
    var COL = { ok: '#16A34A', warn: '#D97706', bad: '#DC2626', cur: '#1466B0' };
    var barCol = v26.map(function (v, i) { if (v == null) return 'transparent'; if (i === mi) return COL.cur; return COL[est(pct(v, meta[i]))]; });
    var labels = D.meses.slice();
    var tip = { callbacks: { label: function (c) { return c.dataset.label + ': ₲ ' + fmt(c.parsed.y); } } };
    mk('chTrend', { type: 'bar', data: { labels: labels, datasets: [
      { type: 'bar', label: '2026', data: v26, backgroundColor: barCol, borderRadius: 7, maxBarThickness: 34, order: 3 },
      { type: 'line', label: '2025', data: v25, borderColor: '#B8C4D0', borderWidth: 2, borderDash: [5, 4], pointRadius: 2, tension: .35, order: 2 },
      { type: 'line', label: 'Meta', data: meta, borderColor: '#0B4F8A', borderWidth: 0, pointStyle: 'line', pointRadius: 11, pointBorderWidth: 3, pointBorderColor: '#0B4F8A', showLine: false, order: 1 }
    ] }, options: { maintainAspectRatio: false, animation: { duration: 900, easing: 'easeOutQuart' }, plugins: { legend: { display: false }, tooltip: tip }, scales: { x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, font: { size: 10 } } }, y: { beginAtZero: true, ticks: gsTick, grid: { color: '#EEF2F7' } } } } });
    // Acumulado: 2026 vs 2025 vs meta
    var a25 = [], a26 = [], am = [], s25 = 0, s26 = 0, sm = 0;
    for (var m = 0; m < 12; m++) { s25 += v25[m] || 0; sm += meta[m] || 0; a25.push(s25); am.push(sm); if (v26[m] != null) { s26 += v26[m]; a26.push(s26); } else a26.push(null); }
    mk('chAcum', { type: 'line', data: { labels: labels, datasets: [
      { label: '2026', data: a26, borderColor: '#1466B0', backgroundColor: 'rgba(20,102,176,.10)', fill: true, borderWidth: 3, tension: .3, pointRadius: 3, pointBackgroundColor: '#1466B0' },
      { label: '2025', data: a25, borderColor: '#B8C4D0', borderWidth: 2, borderDash: [5, 4], tension: .3, pointRadius: 0 },
      { label: 'Meta', data: am, borderColor: '#0B4F8A', borderWidth: 1.5, borderDash: [2, 3], tension: .3, pointRadius: 0 }
    ] }, options: { maintainAspectRatio: false, animation: { duration: 900, easing: 'easeOutQuart' }, plugins: { legend: { display: false }, tooltip: tip }, scales: { x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, font: { size: 10 } } }, y: { ticks: gsTick, grid: { color: '#EEF2F7' } } } } });

    // Tabla
    var tb = q('#tblMM tbody'); if (!tb) return;
    var html = '', ac = 0;
    for (var r = 0; r < 12; r++) {
      var has = v26[r] != null, cur = r === mi;
      if (has) ac += v26[r];
      var cmp = cur ? k.mesYoY : v25[r], va = has ? pct(v26[r] - cmp, cmp) : null, cu = has && meta[r] ? pct(v26[r], meta[r]) : null;
      html += '<tr class="' + (cur ? 'cur' : '') + (has ? '' : ' fut') + '"><td><b>' + D.meses[r] + '</b>' + (cur ? '<em class="mm-cur">en curso</em>' : '') + '</td>' +
        '<td class="r b">' + (has ? fmt(v26[r]) : '–') + '</td><td class="r">' + fmt(v25[r]) + '</td>' +
        '<td class="r">' + (va == null ? '–' : '<em class="p2-c ' + (va >= 0.5 ? 'ok' : va <= -0.5 ? 'bad' : 'na') + '">' + fp(va) + '</em>' + (cur ? '<small class="mm-n">al día ' + k.bd_el + '</small>' : '')) + '</td>' +
        '<td class="r">' + fmt(meta[r]) + '</td>' +
        '<td>' + (cu == null ? '–' : '<div class="mm-cu"><span class="mm-cu__b"><i class="' + (cur ? 'cur' : est(cu)) + '" data-w="' + Math.min(cu, 100).toFixed(1) + '"></i></span><b class="' + (cur ? '' : est(cu)) + '">' + P(cu) + '</b></div>') + '</td>' +
        '<td class="r">' + (has ? fmt(ac) : '–') + '</td></tr>';
    }
    var totM = meta.reduce(function (x, y) { return x + y; }, 0), tot25 = v25.reduce(function (x, y) { return x + y; }, 0);
    html += '<tr class="tot"><td><b>Total del año</b></td><td class="r b">' + fmt(ac) + '</td><td class="r">' + fmt(tot25) + '</td><td></td><td class="r">' + fmt(totM) + '</td><td><b>' + P(pct(ac, totM)) + '</b> <small class="mm-n">de la meta anual</small></td><td></td></tr>';
    tb.innerHTML = html;
    qa('#tblMM .mm-cu__b i').forEach(function (i2) { if (G) gsap.fromTo(i2, { width: '0%' }, { width: i2.dataset.w + '%', duration: .9, delay: .2, ease: 'power3.out' }); else i2.style.width = i2.dataset.w + '%'; });
    if (G) {
      gsap.from(qa('#tblMM tbody tr'), { opacity: 0, y: 6, duration: .3, stagger: .025, delay: .15, ease: 'power2.out', clearProps: 'transform,opacity' });
      gsap.from('#mesames .p2-t', { opacity: 0, y: 12, duration: .45, stagger: .06, ease: 'power3.out', clearProps: 'transform,opacity' });
      gsap.from('#mesames .p2-t__h i', { scale: 0, rotate: -20, duration: .5, stagger: .06, delay: .1, ease: 'back.out(2.4)', clearProps: 'transform' });
    }
  }

  /* ── RENDER: PEDIDOS ── */
  function renderPedidos() {
    var fa = q('#fAlm'), fe = q('#fEt');
    if (fa && !fa.options.length) { var alms = D.ped_lines.reduce(function (a, l) { if (a.indexOf(l[0]) < 0) a.push(l[0]); return a; }, []); fa.innerHTML = '<option value="todos">Todos los almacenes</option>' + alms.map(function (a) { return '<option value="' + esc(a) + '">' + esc(a) + '</option>'; }).join(''); fa.value = fAlm; }
    if (fe && !fe.options.length) { var ets = D.ped_lines.reduce(function (a, l) { if (a.indexOf(l[1]) < 0) a.push(l[1]); return a; }, []); fe.innerHTML = '<option value="todos">Todas las etapas</option>' + ets.map(function (e) { return '<option value="' + esc(e) + '">' + esc(e) + '</option>'; }).join(''); fe.value = fEt; }
    var L = pedFiltered(), total = 0, peso = 0, docs = {};
    L.forEach(function (l) { total += l[7]; peso += l[6]; docs[l[9]] = 1; });
    animCount(q('#p2Lin'), L.length, function (v) { return fmt(v); }, .9); animCount(q('#p2Ped'), Object.keys(docs).length, function (v) { return fmt(v); }, .9); animCount(q('#p2Tot'), total, function (v) { return fmt(v); }, .9); animCount(q('#p2Peso'), peso, function (v) { return fmt(v); }, .9);
    var cfg = pedDef[pedView], rows = cfg.rows(L);
    T('pedChTitle', cfg.title); T('pedTblTitle', 'Detalle · ' + cfg.title.toLowerCase());
    var labels = rows.map(function (r) { return r[0]; }), vals = rows.map(function (r) { return r[1]; });
    if (cfg.bar) { mk('chPed', { type: 'bar', data: { labels: labels, datasets: [{ data: vals, backgroundColor: AZ, borderRadius: 3 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return '₲ ' + fmt(c.raw); } } } }, scales: { y: { ticks: gsTick, grid: { color: '#EEF2F7' } }, x: { grid: { display: false }, ticks: { maxRotation: 60, autoSkip: true, maxTicksLimit: 16 } } } } }); }
    else { var pal = ['#1466B0', '#E8833A', '#2BA84A', '#C0392B', '#8E5FBF', '#0FA3A3', '#D64C8B', '#8C9440', '#E0B33A', '#4A90D9', '#B5651D', '#3FA796', '#9B4DCA', '#DE6449', '#6C7A89', '#0B4F8A']; mk('chPed', { type: 'doughnut', data: { labels: labels, datasets: [{ data: vals.map(function (v) { return Math.abs(v); }), backgroundColor: pal, borderWidth: 2, borderColor: '#fff' }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 11, font: { size: 11 } } }, tooltip: { callbacks: { label: function (c) { return c.label + ': ₲ ' + fmt(c.raw); } } } }, cutout: '55%' } }); }
    var hh = '<table><thead><tr>' + cfg.cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>', tt = 0, tp = 0, tl = 0;
    rows.forEach(function (r) { tt += r[1] || 0; tp += r[2] || 0; tl += r[3] || 0; hh += '<tr><td>' + esc(r[0]) + '</td><td>' + fmt(r[1]) + '</td><td>' + (r[2] == null ? '' : fmt(r[2])) + '</td><td>' + fmt(r[3]) + '</td></tr>'; });
    hh += '<tr class="tot"><td>TOTAL</td><td>' + fmt(tt) + '</td><td>' + (cfg.cols[2] ? fmt(tp) : '') + '</td><td>' + fmt(tl) + '</td></tr></tbody></table>';
    H('pedTblBox', hh);
    if (window.gsap) gsap.from(qa('#pedTblBox tbody tr'), { opacity: 0, x: -8, duration: .3, stagger: .025, ease: 'power2.out', clearProps: 'all' });
  }

  /* ── RENDER: CONFIG ── */
  function renderConfig() {
    var k = kpis('tot');
    T('cfMes', D.meses[k.mi] + ' ' + k.y);
    var _d = function (v) { return Math.round(v) + ' días'; };
    animCount(q('#cfDias'), k.daysMonth, function (v) { return Math.round(v); }, .8); animCount(q('#cfFds'), k.fds, _d, .8); animCount(q('#cfFer'), k.fer, _d, .8); animCount(q('#cfHab'), k.bd_tot, _d, .8); animCount(q('#cfTrans'), k.bd_el, _d, .8); animCount(q('#cfFalt'), k.bd_rest, _d, .8);
    renderFerList();
    var hi = q('#hoyInput'); if (hi) hi.value = fmtHoy(hoyDate());
  }
  function renderFerList() {
    var list = q('#ferList'); if (!list) return; var admin = isAdmin();
    list.innerHTML = holidays.length ? holidays.map(function (h) { return '<span class="tag">' + esc(h.date) + (h.name ? ' · ' + esc(h.name) : '') + (admin ? ' <button data-delfer="' + esc(h.date) + '">×</button>' : '') + '</span>'; }).join('') : '<span class="mini">Sin feriados cargados.</span>';
    qa('[data-delfer]', list).forEach(function (b) { b.addEventListener('click', function () { delFer(b.dataset.delfer); }); });
  }
  function addFer() {
    var d = q('#ferDate').value; if (!d) { toast('Elegí una fecha', true); return; }
    var n = q('#ferName').value.trim();
    if (holidays.some(function (h) { return h.date === d; })) { toast('Ese feriado ya está cargado', true); return; }
    holidays.push({ date: d, name: n }); holidays.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    q('#ferDate').value = ''; q('#ferName').value = '';
    renderConfig();
    if (window.TableroDB && TableroDB.ready) TableroDB.addFeriado(d, n).then(function () { toast('Feriado agregado'); }).catch(function () { toast('Guardado local (sin conexión)', true); });
    else toast('Feriado agregado (local)');
  }
  function delFer(fecha) {
    confirmPro({ title: 'Quitar feriado', text: 'Se quitará <b>' + esc(fecha) + '</b> y se recalcularán las proyecciones.', danger: true, okLabel: 'Quitar', onOk: function () {
      holidays = holidays.filter(function (h) { return h.date !== fecha; }); renderConfig();
      if (window.TableroDB && TableroDB.ready) TableroDB.delFeriado(fecha).then(function () { toast('Feriado quitado'); }).catch(function () { toast('Error al quitar en la nube', true); });
      else toast('Feriado quitado');
    } });
  }

  /* ── OVERLAY de carga (0→100% + check azul) ── */
  var UPL_C = 345.6, uplCur = 0, uplTarget = 0, uplRAF = null;
  function showUpload() {
    var old = q('#uplOv'); if (old) old.remove();
    uplCur = 0; uplTarget = 0; if (uplRAF) { cancelAnimationFrame(uplRAF); uplRAF = null; }
    var ov = el('<div class="upl-ov" id="uplOv"><div class="upl-card">' +
      '<div class="upl-ring"><svg width="132" height="132" viewBox="0 0 132 132"><circle class="rbg" cx="66" cy="66" r="55"/><circle class="rfg" id="uplFg" cx="66" cy="66" r="55" stroke-dasharray="345.6" stroke-dashoffset="345.6"/></svg><div class="upl-pct"><span id="uplNum">0</span><small>%</small></div></div>' +
      '<svg class="upl-check" viewBox="0 0 132 132"><circle cx="66" cy="66" r="49"/><path d="M44 68 l14 15 l30 -34"/></svg>' +
      '<div class="upl-title" id="uplTitle">Actualizando base…</div><div class="upl-msg" id="uplMsg">Preparando</div></div></div>');
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('show'); });
  }
  function setProg(t, label) { uplTarget = t; if (label) T('uplMsg', label); if (!uplRAF) uplRAF = requestAnimationFrame(uplTick); }
  function uplTick() { uplCur += (uplTarget - uplCur) * 0.16; if (Math.abs(uplTarget - uplCur) < 0.4) uplCur = uplTarget; var n = q('#uplNum'), fg = q('#uplFg'); if (n) n.textContent = Math.round(uplCur); if (fg) fg.style.strokeDashoffset = (UPL_C * (1 - uplCur / 100)).toFixed(1); if (uplCur !== uplTarget) uplRAF = requestAnimationFrame(uplTick); else uplRAF = null; }
  function closeUpload() { var ov = q('#uplOv'); if (!ov) return; ov.classList.remove('show'); setTimeout(function () { if (ov.parentNode) ov.remove(); }, 300); }
  function failUpload(msg) {
    var ov = q('#uplOv'); if (!ov) { toast(msg, true); return; }
    var card = ov.querySelector('.upl-card');
    var p = card.querySelector('.upl-check path'); if (p) p.setAttribute('d', 'M48 48 L84 84 M84 48 L48 84'); // check → X
    ov.classList.add('done', 'fail');
    T('uplTitle', 'No se pudo cargar');
    T('uplMsg', msg);
    if (!card.querySelector('.upl-close')) {
      var btn = document.createElement('button'); btn.className = 'btn upl-close'; btn.textContent = 'Cerrar';
      btn.addEventListener('click', function () { closeUpload(); });
      card.appendChild(btn);
    }
  }
  function finishUpload(diff) {
    setProg(100, 'Listo');
    setTimeout(function () {
      var ov = q('#uplOv'); if (!ov) return;
      ov.classList.add('done');
      T('uplTitle', diff.changed ? '¡Base actualizada!' : 'Sin cambios');
      H('uplMsg', diff.summary);
      var card = ov.querySelector('.upl-card');
      if (diff.rows && diff.rows.length) { var box = document.createElement('div'); box.className = 'upl-diff'; box.innerHTML = diff.rows.map(function (r) { return '<div class="row"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b></div>'; }).join(''); card.appendChild(box); }
      var btn = document.createElement('button'); btn.className = 'btn btn--primary upl-close'; btn.textContent = 'Entendido';
      btn.addEventListener('click', function () { closeUpload(); renderShell(); });
      card.appendChild(btn);
    }, 650);
  }

  /* ── Detección de cambios ── */
  function diffSnapshots(oldSnap, newSnap) {
    var mesLbl = MESES[newSnap.cur_month - 1] + ' ' + newSnap.cur_year, mi = newSnap.cur_month - 1;
    if (!oldSnap) {
      return { changed: true, summary: 'Primera carga de <b>' + mesLbl + '</b>.', rows: [['Días cargados', newSnap.daily.length], ['Facturado del mes', '₲ ' + fmt((newSnap.v2026 || [])[mi] || 0)], ['Pedidos pendientes', fmt(newSnap.ped_lines.length) + ' líneas']] };
    }
    var om = {}; (oldSnap.daily || []).forEach(function (x) { om[x[0]] = x[1]; });
    var newDays = [], changedDays = 0;
    (newSnap.daily || []).forEach(function (x) { if (!(x[0] in om)) newDays.push(x[0]); else if (Math.round(om[x[0]]) !== Math.round(x[1])) changedDays++; });
    var oldTot = (oldSnap.v2026 || [])[mi] || 0, newTot = (newSnap.v2026 || [])[mi] || 0, totDelta = newTot - oldTot;
    var oldPed = (oldSnap.ped_lines || []).length, newPed = (newSnap.ped_lines || []).length;
    var changed = newDays.length > 0 || changedDays > 0 || Math.round(totDelta) !== 0 || oldPed !== newPed;
    var rows = [];
    if (newDays.length) rows.push(['Días nuevos', newDays.map(function (d) { return d.slice(8) + '/' + d.slice(5, 7); }).join(', ')]);
    if (changedDays) rows.push(['Días corregidos', changedDays]);
    if (Math.round(totDelta) !== 0) rows.push(['Δ facturación', (totDelta >= 0 ? '+' : '') + '₲ ' + fmt(totDelta)]);
    if (oldPed !== newPed) rows.push(['Pedidos pendientes', fmt(oldPed) + ' → ' + fmt(newPed)]);
    var summary = changed
      ? 'Se actualizó <b>' + mesLbl + '</b>' + (newDays.length ? ' con <b class="tagnew">' + newDays.length + ' día' + (newDays.length > 1 ? 's' : '') + ' nuevo' + (newDays.length > 1 ? 's' : '') + '</b>' : '') + '.'
      : 'La base de <b>' + mesLbl + '</b> ya estaba al día. No se agregó información nueva.';
    return { changed: changed, summary: summary, rows: rows };
  }

  /* ── Carga del Excel (admin) ── */
  function onFile(ev) {
    var f = ev.target.files[0]; if (!f) return;
    if (typeof XLSX === 'undefined') { toast('No se pudo cargar el lector de Excel', true); return; }
    showUpload(); setProg(10, 'Leyendo archivo…');
    var r = new FileReader();
    r.onload = function (e) {
      setProg(28, 'Procesando planilla…');
      setTimeout(function () {
        try {
          var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
          var vld = validateWB(wb);
          if (!vld.ok) { failUpload(vld.reason); return; }
          var newSnap = parseWB(wb);
          setProg(60, 'Comparando con lo cargado…');
          var anio = newSnap.cur_year, mes = newSnap.cur_month;
          var oldP = (window.TableroDB && TableroDB.ready) ? TableroDB.pullSnapshotFor(anio, mes) : Promise.resolve((D && D.cur_year === anio && D.cur_month === mes) ? { snapshot: D } : null);
          oldP.then(function (row) {
            var oldSnap = row && row.snapshot ? row.snapshot : null, diff = diffSnapshots(oldSnap, newSnap);
            setProg(82, 'Publicando…');
            var user = (window.AlasAuthClient && AlasAuthClient.getCurrentUser && AlasAuthClient.getCurrentUser()) || null;
            var pushP = (window.TableroDB && TableroDB.ready) ? TableroDB.pushSnapshot(newSnap, user) : Promise.resolve();
            return pushP.then(function () { return diff; });
          }).then(function (diff) {
            D = newSnap; dataOrigin = 'actualizado'; updatedInfo = { updated_at: new Date().toISOString() };
            if (!availableMonths.some(function (m) { return m.anio === anio && m.mes === mes; })) { availableMonths.push({ anio: anio, mes: mes }); availableMonths.sort(function (a, b) { return a.anio - b.anio || a.mes - b.mes; }); }
            cacheSave(); cargarMT().then(function () { finishUpload(diff); });
          }).catch(function (err) { console.error(err); failUpload('No se pudo publicar en la nube'); });
        } catch (err) { console.error(err); failUpload('No se pudo leer el archivo. Verificá que sea la planilla correcta.'); }
      }, 80);
    };
    r.onerror = function () { failUpload('No se pudo leer el archivo'); };
    r.readAsArrayBuffer(f); ev.target.value = '';
  }

  /* ── Cache local ── */
  function cacheSave() { try { localStorage.setItem(LS_KEY, JSON.stringify({ stamp: D._stamp || Date.now(), data: D })); } catch (e) {} }
  function cacheLoad() { try { var raw = localStorage.getItem(LS_KEY); if (raw) { var o = JSON.parse(raw); if (o && o.data) return o.data; } } catch (e) {} return null; }

  /* ── RENDER: CONTROL DE FACTURAS (registro de entregas por escaneo) ── */
  var registros = [];
  var _regUnsub = null;
  var regMonth = { y: 0, m: 0 };  // mes en vista (filtro)
  var regSearch = '';             // término del buscador (filtra la tabla, no el contador)
  var regUser = '';               // filtro por usuario (registrado_por); '' = todos

  function _norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); }
  function regMatch(r, term) { var t = _norm(term); return _norm(r.entrega).indexOf(t) >= 0 || _norm(r.registrado_por).indexOf(t) >= 0; }

  function curYM() { var d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; }
  function isCurMonth() { var c = curYM(); return regMonth.y === c.y && regMonth.m === c.m; }
  function inMonth(iso, y, m) { var d = new Date(iso); return !isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() === m; }
  function regFiltered() { return registros.filter(function (r) { return inMonth(r.created_at, regMonth.y, regMonth.m); }); }
  function regMonthLabel() { return MESES[regMonth.m] + ' ' + regMonth.y; }

  function fmtFechaHora(iso) {
    var d = new Date(iso); if (isNaN(d.getTime())) return '—';
    var f = d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
    var h = d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false });
    return f + ' · ' + h + ' hs';
  }
  function normEntrega(v) { return String(v == null ? '' : v).trim().toUpperCase().replace(/\s+/g, ' '); }
  function avInitial(s) { return (String(s || '—').trim().charAt(0) || '—').toUpperCase(); }

  function regRowHtml(r) {
    return '<tr data-id="' + esc(r.id) + '">' +
      '<td class="reg-ent">' + esc(r.entrega) + '</td>' +
      '<td><span class="reg-chip">' + IC.check + ' Registrado</span></td>' +
      '<td><span class="reg-user"><span class="reg-uav">' + esc(avInitial(r.registrado_por)) + '</span>' + esc(r.registrado_por || '—') + '</span></td>' +
      '<td class="reg-when">' + esc(fmtFechaHora(r.created_at)) + '</td>' +
      '</tr>';
  }

  function renderRegistro() {
    killCharts();
    regMonth = curYM();
    regSearch = ''; regUser = '';
    q('#stage').innerHTML =
      '<div class="tbd-toolbar"><div class="tbd-title"><h2>Control de facturas</h2><span class="sub">Registro de entregas por código de barra</span></div><span class="spacer"></span></div>' +
      '<div class="reg-wrap">' +
        '<div class="reg-monthbar">' +
          '<button class="reg-mbtn" id="regPrev" type="button" aria-label="Mes anterior"><svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>' +
          '<div class="reg-mlabel"><span id="regMonthLbl">—</span><small id="regMonthSub">0 registradas</small></div>' +
          '<button class="reg-mbtn" id="regNext" type="button" aria-label="Mes siguiente"><svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>' +
        '</div>' +
        '<div class="reg-scan" id="regScan">' +
          '<div class="reg-scan__ico">' + IC.scan + '</div>' +
          '<form id="regForm" class="reg-scan__form" autocomplete="off">' +
            '<label class="reg-scan__field"><span>Escaneá el código de barra de la entrega</span>' +
            '<input type="text" id="regInput" placeholder="Escaneá el N° de entrega…" autocomplete="off" autocapitalize="characters" spellcheck="false" /></label>' +
            '<button type="submit" class="btn btn--primary reg-scan__btn">' + IC.check + ' Registrar</button>' +
          '</form>' +
          '<div class="reg-alert" id="regAlert" hidden></div>' +
        '</div>' +
        '<div class="reg-tablecard">' +
          '<div class="reg-tablehead"><span class="reg-tablehead__t">' + IC.clock + ' Entregas registradas</span>' +
          '<span class="reg-by">' + IC.userIco + ' Registra: <b>' + esc(userName()) + '</b></span></div>' +
          '<div class="reg-search" id="regSearchBar">' +
            '<div class="reg-search__box">' +
              '<span class="reg-search__ico">' + IC.search + '</span>' +
              '<input type="text" id="regSearchInput" placeholder="Buscar entrega o responsable…" autocomplete="off" spellcheck="false" />' +
              '<button type="button" class="reg-search__clear" id="regSearchClear" aria-label="Limpiar búsqueda" hidden>' + IC.clearX + '</button>' +
            '</div>' +
            '<div class="reg-ufilter" id="regUserFilter">' +
              '<button type="button" class="reg-ufilter__btn" id="regUserBtn" aria-haspopup="listbox" aria-expanded="false">' +
                '<span class="reg-ufilter__ico">' + IC.userIco + '</span>' +
                '<span class="reg-ufilter__lbl" id="regUserLbl">Todos</span>' +
                '<span class="reg-ufilter__caret"><svg fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>' +
              '</button>' +
              '<div class="reg-ufilter__menu" id="regUserMenu" role="listbox" hidden></div>' +
            '</div>' +
            '<span class="reg-search__count" id="regSearchCount" hidden></span>' +
          '</div>' +
          '<div class="reg-tablewrap">' +
            '<div class="reg-tablescroll"><table class="reg-table"><thead><tr>' +
              '<th>Entrega</th><th>Estado</th><th>Registrado por</th><th>Fecha y hora</th>' +
            '</tr></thead><tbody id="regBody"></tbody></table>' +
            '<div class="reg-empty" id="regEmpty" hidden>' + IC.scan + '<p>Todavía no hay entregas registradas este mes. Escaneá la primera factura.</p></div>' +
            '</div>' +
            '<div class="reg-loader" id="regLoader"><span class="reg-spin"></span></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    if (window.gsap) {
      gsap.from('#stage .tbd-toolbar', { opacity: 0, y: -8, duration: .35, ease: 'power2.out', clearProps: 'all' });
      gsap.from('.reg-monthbar', { opacity: 0, y: -6, duration: .38, ease: 'power2.out', clearProps: 'all', delay: .04 });
      gsap.from('#regScan', { opacity: 0, y: 12, duration: .42, ease: 'power2.out', clearProps: 'all', delay: .09 });
      gsap.from('.reg-tablecard', { opacity: 0, y: 16, duration: .46, ease: 'power2.out', clearProps: 'all', delay: .15 });
      gsap.from('#regSearchBar', { opacity: 0, y: 14, duration: .44, ease: 'back.out(1.4)', clearProps: 'all', delay: .26 });
    }
    wireRegistro();
    loadRegistros();
  }

  function wireRegistro() {
    var form = q('#regForm'), input = q('#regInput');
    if (form) form.addEventListener('submit', function (ev) { ev.preventDefault(); registrar(input ? input.value : ''); });
    if (input) {
      input.focus();
      // Auto-registro al escanear: los escáneres tipean muy rápido y suelen
      // no mandar Enter. Si el burst fue veloz, registramos solo al terminar.
      var burst = { t0: 0, n: 0 };
      input.addEventListener('input', function () {
        if (burst.n === 0) burst.t0 = Date.now();
        burst.n++;
        clearTimeout(input._scanT);
        input._scanT = setTimeout(function () {
          var fast = (Date.now() - burst.t0) / Math.max(1, burst.n) < 45;
          var val = input.value.trim();
          burst = { t0: 0, n: 0 };
          if (val && fast) registrar(val);
        }, 150);
      });
      // Foco permanente estilo escáner (salvo modal/login/buscador enfocado)
      input.addEventListener('blur', function () {
        setTimeout(function () {
          var ae = document.activeElement;
          var enBuscador = ae && ae.closest && ae.closest('.reg-search');
          if (currentView === 'registro' && document.body.contains(input) && !enBuscador && !document.querySelector('.modal-bd') && !document.querySelector('.login-gate') && !document.querySelector('.reg-flash')) input.focus();
        }, 80);
      });
    }
    // Buscador PRO: filtra la tabla en vivo (no toca el contador del mes)
    var sInput = q('#regSearchInput'), sClear = q('#regSearchClear'), _searchT = null;
    if (sInput) {
      sInput.addEventListener('input', function () {
        regSearch = sInput.value;
        if (sClear) sClear.hidden = !regSearch;           // toggle inmediato del ✕
        showRegLoader();                                   // se mantiene mientras tipeás
        clearTimeout(_searchT);                            // debounce: filtra al frenar de tipear
        _searchT = setTimeout(function () { paintRegistros(false); hideRegLoader(); }, 140);
      });
      sInput.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && regSearch) { ev.preventDefault(); clearBuscador(); } });
    }
    if (sClear) sClear.addEventListener('click', clearBuscador);
    function clearBuscador() {
      clearTimeout(_searchT); hideRegLoader();
      regSearch = ''; if (sInput) sInput.value = ''; if (sClear) sClear.hidden = true;
      paintRegistros(false); if (sInput) sInput.focus();
    }

    // Filtro de usuarios PRO (dropdown con avatar + cantidad por persona)
    var uBtn = q('#regUserBtn'), uMenu = q('#regUserMenu'), uWrap = q('#regUserFilter');
    function setUserLbl() {
      var lbl = q('#regUserLbl'); if (lbl) lbl.textContent = regUser || 'Todos';
      if (uBtn) uBtn.classList.toggle('is-active', !!regUser);
    }
    function buildUserMenu() {
      if (!uMenu) return;
      var monthRows = regFiltered();
      var map = {}, order = [];
      monthRows.forEach(function (r) {
        var name = r.registrado_por || '—', k = _norm(name);
        if (!map[k]) { map[k] = { name: name, n: 0 }; order.push(k); }
        map[k].n++;
      });
      order.sort(function (a, b) { return map[b].n - map[a].n; });
      var html = '<button type="button" class="reg-uopt' + (regUser ? '' : ' is-sel') + '" data-user="">' +
        '<span class="reg-uopt__all">' + IC.userIco + '</span><span class="reg-uopt__name">Todos los usuarios</span>' +
        '<span class="reg-uopt__n">' + monthRows.length + '</span></button>';
      order.forEach(function (k) {
        var u = map[k], sel = _norm(regUser) === k ? ' is-sel' : '';
        html += '<button type="button" class="reg-uopt' + sel + '" data-user="' + esc(u.name) + '">' +
          '<span class="reg-uav">' + esc(avInitial(u.name)) + '</span>' +
          '<span class="reg-uopt__name">' + esc(u.name) + '</span>' +
          '<span class="reg-uopt__n">' + u.n + '</span></button>';
      });
      uMenu.innerHTML = html;
    }
    function onDocUser(ev) { if (uWrap && !uWrap.contains(ev.target)) closeUserMenu(); }
    function onEscUser(ev) { if (ev.key === 'Escape') closeUserMenu(); }
    function openUserMenu() {
      if (!uMenu) return;
      buildUserMenu();
      uMenu.hidden = false;
      if (uBtn) uBtn.setAttribute('aria-expanded', 'true');
      if (uWrap) uWrap.classList.add('is-open');
      document.addEventListener('click', onDocUser, true);
      document.addEventListener('keydown', onEscUser, true);
      if (window.gsap) gsap.fromTo(uMenu, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: .18, ease: 'power2.out' });
    }
    function closeUserMenu() {
      if (!uMenu || uMenu.hidden) return;
      uMenu.hidden = true;
      if (uBtn) uBtn.setAttribute('aria-expanded', 'false');
      if (uWrap) uWrap.classList.remove('is-open');
      document.removeEventListener('click', onDocUser, true);
      document.removeEventListener('keydown', onEscUser, true);
    }
    if (uBtn) uBtn.addEventListener('click', function (ev) { ev.stopPropagation(); if (uMenu && uMenu.hidden) openUserMenu(); else closeUserMenu(); });
    if (uMenu) uMenu.addEventListener('click', function (ev) {
      var opt = ev.target.closest ? ev.target.closest('.reg-uopt') : null; if (!opt) return;
      regUser = opt.getAttribute('data-user') || '';
      setUserLbl(); closeUserMenu(); paintRegistros(false);
    });

    var prev = q('#regPrev'), next = q('#regNext');
    if (prev) prev.addEventListener('click', function () { stepMonth(-1); });
    if (next) next.addEventListener('click', function () { stepMonth(1); });

    if (_regUnsub) { _regUnsub(); _regUnsub = null; }
    if (window.TableroDB && TableroDB.onRegistroInsert) {
      _regUnsub = TableroDB.onRegistroInsert(function (row) {
        if (!row || registros.some(function (r) { return String(r.id) === String(row.id) || normEntrega(r.entrega) === normEntrega(row.entrega); })) return;
        registros.unshift(row);
        if (isCurMonth() && inMonth(row.created_at, regMonth.y, regMonth.m)) {
          if (regSearch.trim() || regUser) paintRegistros(false);   // con filtro activo, re-filtra sin animar
          else prependRegRow(row, true);
        }
        updRegCount(); updMonthLbl();
      });
    }
  }

  function stepMonth(delta) {
    var m = regMonth.m + delta, y = regMonth.y;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    var c = curYM();
    if (y > c.y || (y === c.y && m > c.m)) return; // sin futuro
    regMonth = { y: y, m: m };
    registros = [];              // cada mes se carga de su propio rango en el servidor
    regUser = '';                // el filtro de usuarios es por mes; reset al cambiar
    var lbl = q('#regUserLbl'); if (lbl) lbl.textContent = 'Todos';
    var uBtnEl = q('#regUserBtn'); if (uBtnEl) uBtnEl.classList.remove('is-active');
    loadRegistros();
    if (window.gsap) gsap.fromTo('#regMonthLbl', { y: delta > 0 ? 8 : -8, opacity: .25 }, { y: 0, opacity: 1, duration: .3, ease: 'power2.out' });
  }

  function showRegLoader() { var l = q('#regLoader'); if (l) l.classList.add('is-on'); }
  function hideRegLoader() { var l = q('#regLoader'); if (l) l.classList.remove('is-on'); }

  var _regLoadSeq = 0;
  function loadRegistros() {
    if (!(window.TableroDB && TableroDB.listRegistrosMes)) { registros = []; paintRegistros(); return; }
    var seq = ++_regLoadSeq;                 // evita que una carga vieja pise a una nueva
    var body = q('#regBody');
    if (body && !registros.length) body.innerHTML = '';   // sin parpadeo si ya hay datos
    showRegLoader();
    TableroDB.listRegistrosMes(regMonth.y, regMonth.m).then(function (rows) {
      if (seq !== _regLoadSeq) return;        // cambió de mes mientras cargaba → descartar
      registros = rows || [];
      paintRegistros();
      hideRegLoader();
    }).catch(function () { if (seq === _regLoadSeq) hideRegLoader(); });
  }

  function paintRegistros(animate) {
    if (animate === undefined) animate = true;
    var body = q('#regBody'); if (!body) return;
    var monthRows = regFiltered();
    var term = regSearch.trim();
    var byUser = regUser ? monthRows.filter(function (r) { return _norm(r.registrado_por) === _norm(regUser); }) : monthRows;
    var rows = term ? byUser.filter(function (r) { return regMatch(r, term); }) : byUser;
    var filtro = !!(term || regUser);
    body.innerHTML = rows.map(regRowHtml).join('');
    var empty = q('#regEmpty');
    if (empty) {
      empty.hidden = rows.length > 0;
      var p = empty.querySelector('p');
      if (p) {
        if (filtro && monthRows.length > 0) p.textContent = term ? ('Sin coincidencias para «' + term + '».') : 'Sin entregas para el filtro aplicado.';
        else p.textContent = isCurMonth() ? 'Todavía no hay entregas registradas este mes. Escaneá la primera factura.' : 'No hay entregas registradas en ' + regMonthLabel() + '.';
      }
    }
    var sc = q('#regSearchCount');
    if (sc) {
      if (filtro) { sc.hidden = false; sc.textContent = rows.length + (rows.length === 1 ? ' coincidencia' : ' coincidencias'); }
      else sc.hidden = true;
    }
    updRegCount(); updMonthLbl();
    // La animación con stagger solo al abrir la vista / cambiar de mes, nunca por tecla:
    // animar 500 filas en cada keystroke era lo que trababa el buscador.
    if (animate && window.gsap && rows.length) {
      var n = Math.min(rows.length, 40); // solo las primeras filas visibles
      gsap.from('#regBody tr:nth-child(-n+' + n + ')', { opacity: 0, y: 8, duration: .3, stagger: .03, ease: 'power2.out', clearProps: 'transform,opacity' });
    }
  }

  function prependRegRow(row, fromOther) {
    var body = q('#regBody'); if (!body) return;
    var empty = q('#regEmpty'); if (empty) empty.hidden = true;
    var tr = el(regRowHtml(row)); body.insertBefore(tr, body.firstChild);
    if (window.gsap) gsap.fromTo(tr,
      { opacity: 0, y: -10, backgroundColor: fromOther ? 'rgba(11,95,141,.10)' : 'rgba(20,102,176,.16)' },
      { opacity: 1, y: 0, backgroundColor: 'rgba(0,0,0,0)', duration: .55, ease: 'power2.out', clearProps: 'transform,opacity,background-color' });
  }

  function updRegCount() {}
  function updMonthLbl() {
    T('regMonthLbl', regMonthLabel());
    var n = regFiltered().length;
    H('regMonthSub', '<b>' + n + '</b> ' + (n === 1 ? 'registrada' : 'registradas'));
    var next = q('#regNext'); if (next) next.disabled = isCurMonth();
  }

  var _regBusy = false;
  function registrar(raw) {
    var input = q('#regInput');
    if (input && input._scanT) { clearTimeout(input._scanT); input._scanT = null; }
    var entrega = normEntrega(raw);
    if (!entrega) { if (input) input.focus(); return; }
    if (_regBusy) return;
    hideRegAlert();
    // Chequeo instantáneo en cliente
    if (registros.some(function (r) { return normEntrega(r.entrega) === entrega; })) {
      showDupAlert(entrega); if (input) { input.value = ''; input.focus(); } return;
    }
    if (!(window.TableroDB && TableroDB.ready)) { toast('Sin conexión con la base', true); return; }
    _regBusy = true;
    var btn = q('.reg-scan__btn'); if (btn) btn.disabled = true;
    TableroDB.addRegistro(entrega, userName(), userId()).then(function (res) {
      _regBusy = false;
      if (btn) btn.disabled = false;
      if (res.duplicate) {
        showDupAlert(entrega);
        if (!registros.some(function (r) { return normEntrega(r.entrega) === entrega; })) loadRegistros();
      } else if (res.row) {
        if (!isCurMonth()) { regMonth = curYM(); loadRegistros(); }
        else { registros.unshift(res.row); prependRegRow(res.row, false); updRegCount(); updMonthLbl(); }
        okPulse();
        flashRegistrado(entrega);
      }
      if (input) { input.value = ''; input.focus(); }
    }).catch(function (e) {
      _regBusy = false;
      if (btn) btn.disabled = false; console.error('[registro]', e);
      toast('No se pudo registrar. Reintentá.', true); if (input) input.focus();
    });
  }

  // Modal PRO centrado: "REGISTRADO" con check azul (aparece y desaparece rápido)
  function flashRegistrado(entrega) {
    var ov = el('<div class="reg-flash"><div class="reg-flash__card">' +
      '<div class="reg-flash__badge"><svg viewBox="0 0 52 52" class="reg-flash__svg"><circle class="rf-ring" cx="26" cy="26" r="24"/><path class="rf-tick" d="M15 27l7 7 15-16"/></svg></div>' +
      '<div class="reg-flash__txt">REGISTRADO</div>' +
      (entrega ? '<div class="reg-flash__ent">' + esc(entrega) + '</div>' : '') +
      '</div></div>');
    document.body.appendChild(ov);
    if (window.gsap) {
      var tl = gsap.timeline({ onComplete: function () { ov.remove(); } });
      tl.fromTo(ov, { opacity: 0 }, { opacity: 1, duration: .14, ease: 'power2.out' });
      tl.fromTo(ov.querySelector('.reg-flash__card'), { scale: .6, y: 10 }, { scale: 1, y: 0, duration: .34, ease: 'back.out(2.4)' }, 0);
      var tick = ov.querySelector('.rf-tick');
      if (tick) { var L = tick.getTotalLength ? tick.getTotalLength() : 40; gsap.set(tick, { strokeDasharray: L, strokeDashoffset: L }); tl.to(tick, { strokeDashoffset: 0, duration: .3, ease: 'power2.out' }, .14); }
      tl.to(ov.querySelector('.reg-flash__card'), { scale: 1.05, duration: .12, yoyo: true, repeat: 1, ease: 'power1.inOut' }, .44);
      tl.to(ov, { opacity: 0, duration: .22, ease: 'power2.in' }, '+=0.34');
    } else {
      setTimeout(function () { ov.remove(); }, 900);
    }
  }

  function okPulse() {
    var s = q('#regScan'); if (s && window.gsap) gsap.fromTo(s,
      { boxShadow: '0 0 0 0 rgba(22,163,74,.45)' },
      { boxShadow: '0 0 0 7px rgba(22,163,74,0)', duration: .6, ease: 'power2.out', clearProps: 'box-shadow' });
  }

  function showDupAlert(entrega) {
    var a = q('#regAlert'); if (!a) return;
    a.innerHTML = '<span class="reg-alert__ico">' + IC.alert + '</span>' +
      '<span class="reg-alert__txt"><b>Entrega ya registrada</b>Esta factura con el N° de entrega <b>' + esc(entrega) + '</b> ya ha sido registrada.</span>';
    a.hidden = false;
    if (window.gsap) {
      gsap.killTweensOf(a);
      gsap.fromTo(a, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: .28, ease: 'power2.out' });
      gsap.fromTo(a, { x: -11 }, { x: 0, duration: .5, ease: 'elastic.out(1,0.35)', delay: .04 });
    }
    if (navigator.vibrate) { try { navigator.vibrate(120); } catch (_) {} }
    clearTimeout(a._t); a._t = setTimeout(hideRegAlert, 5000);
  }
  function hideRegAlert() {
    var a = q('#regAlert'); if (!a || a.hidden) return;
    if (window.gsap) gsap.to(a, { opacity: 0, y: -6, duration: .2, onComplete: function () { a.hidden = true; a.style.opacity = ''; a.style.transform = ''; } });
    else a.hidden = true;
  }

  /* ── BOOT ── */
  var _booted = false;
  function boot() {
    if (_booted) return; _booted = true;
    var fb = q('#fileBase'); if (fb) fb.addEventListener('change', onFile);
    qa('[data-nav]').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.nav); }); });

    // Rol restringido "registro": solo ve Control de facturas y entra directo.
    if (isRegistroOnly()) {
      qa('[data-nav]').forEach(function (b) { if (b.dataset.nav !== 'registro') b.style.display = 'none'; });
      currentView = 'registro'; setNav('registro'); renderRegistro();
      return;
    }

    var ready = window.TableroDB && TableroDB.ready;
    Promise.all([
      ready ? TableroDB.pullFeriados() : Promise.resolve([]),
      ready ? TableroDB.pullSnapshot() : Promise.resolve(null),
      ready ? TableroDB.listMonths() : Promise.resolve([])
    ]).then(function (res) {
      holidays = (res[0] || []).map(function (r) { return { date: r.fecha, name: r.descripcion || '' }; });
      availableMonths = res[2] || [];
      var snap = res[1];
      if (snap && snap.snapshot) { D = snap.snapshot; dataOrigin = 'nube'; updatedInfo = { updated_at: snap.updated_at, updated_by: snap.updated_by }; }
      else { var c = cacheLoad(); if (c) { D = c; dataOrigin = 'guardado'; } }
    }).catch(function (e) { console.error('[Tablero] boot', e); var c = cacheLoad(); if (c) { D = c; dataOrigin = 'guardado'; } })
      .then(cargarMT)
      .then(function () { if (D) renderShell(); else renderEmpty(); });
  }

  window.__initTablero = boot;
  // NO auto-arranca: el boot lo dispara index.html SOLO después de autorizar (login/SSO),
  // así el tablero no se renderiza ni baja datos sin sesión válida.
})();
