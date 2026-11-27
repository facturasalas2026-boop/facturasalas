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
    fecha: { title: 'Por fecha de entrega', cols: ['Fecha', 'Monto ₲', 'Peso (kg)', 'Líneas'], bar: true, rows: function (L) { var o = grp(L, function (l) { return l[4] || 'Sin fecha'; }); return Object.keys(o).map(function (k) { return [k, o[k][0], o[k][1], o[k][2]]; }).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }); } },
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
    // año en curso = el más frecuente en la hoja diaria (antes estaba fijo en 2026)
    var Y0 = (function () {
      var xs0 = S('x monto de fc fecha'), cnt = {};
      if (xs0) XLSX.utils.sheet_to_json(xs0).forEach(function (r) { var dt = asDate(keyOf(r, 'Fecha de documento')); if (dt) cnt[dt.getFullYear()] = (cnt[dt.getFullYear()] || 0) + 1; });
      var ks = Object.keys(cnt); return ks.length ? +ks.sort(function (a, b) { return cnt[b] - cnt[a]; })[0] : new Date().getFullYear();
    })();
    var hs = S('Facturacion historico');
    var v25 = Array(12).fill(0), v26 = Array(12).fill(0), v25f = Array(12).fill(0), v26f = Array(12).fill(0), v25h = Array(12).fill(0), v26h = Array(12).fill(0), hrows = [];
    if (hs) {
      hrows = XLSX.utils.sheet_to_json(hs);
      hrows.forEach(function (r) { var dt = asDate(keyOf(r, 'Fecha de facturacion')); if (!dt) return; var mo = num(keyOf(r, 'Monto')), y = dt.getFullYear(), m = dt.getMonth(); var code = (keyOf(r, 'Almacen_codigo') || '').toString().trim(); var g = code === 'Alas' ? 'fer' : (code === 'Alas Dep. Fabric' ? 'hie' : null); if (y === Y0 - 1) { v25[m] += mo; if (g === 'fer') v25f[m] += mo; else if (g === 'hie') v25h[m] += mo; } else if (y === Y0) { v26[m] += mo; if (g === 'fer') v26f[m] += mo; else if (g === 'hie') v26h[m] += mo; } });
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
    '<div class="p4" id="p4">' +
    '<div class="p4-l">' +
    '<div class="card hero"><h3 class="h-hd">Meta mensual · avance <span id="hScope" style="font-weight:600"></span></h3><div class="gaugewrap"><div class="gauge"><canvas id="gauge"></canvas><div class="pc"><div><div class="v" id="gPct">–</div><div class="l">de la meta</div></div></div></div><div style="flex:1;min-width:180px" class="barwrap"><div class="mini" style="color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.6px;font-size:11.5px;font-weight:700">Meta del mes</div><div class="med" id="hMeta" style="margin:2px 0 10px">–</div><div class="bar"><span id="hBar" style="width:0%"></span></div><div class="lbls"><span id="hFact">Facturado –</span><span id="hFalta">Falta –</span></div></div></div></div>' +
    '<div class="card accent" id="cardDia">' +
    '<div class="dz">' +
      '<div class="dz-hd"><div class="dz-date"><span>Facturación del día</span><i>·</i><span class="dz-f" id="kDiaFecha">—</span></div>' +
        '<div class="dz-compare"><span class="acc-trend flat" id="kDiaVar" title="">—</span><span class="dz-vs">vs año pasado · ₲ <b id="kDiaPrev">–</b></span></div></div>' +
      '<div class="dz-body">' +
        '<div class="dz-ring" role="img" aria-label="Avance del objetivo diario"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="bg" cx="32" cy="32" r="27"/><circle class="fg" id="kDiaRing" cx="32" cy="32" r="27" stroke-dasharray="169.65" stroke-dashoffset="169.65"/></svg><div class="dz-ring-center"><b id="kDiaObjPct">–</b><span>del objetivo</span></div></div>' +
        '<div class="dz-main"><span class="dz-main-lbl">Facturación del día</span><div class="acc-num"><span class="u">₲</span><span id="kDia">–</span></div>' +
          '<div class="dz-bar-head"><div class="dz-days">faltan <b><span id="kDiaObjDays">–</span> <span id="kDiaObjDaysUnit">días hábiles</span></b></div></div>' +
          '<div class="acc-obj-bar" id="kDiaObjProgress" role="progressbar" aria-label="Avance del objetivo diario" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="kDiaObjBar"></span></div>' +
          '<div class="dz-objectives"><span class="dz-target">Objetivo <b>₲ <span id="kDiaObj">–</span></b></span><span class="dz-gap" id="kDiaObjGap"><span id="kDiaObjGapLabel">Faltan</span> <b>₲ <span id="kDiaObjResta">–</span></b></span></div></div>' +
      '</div>' +
    '</div>' +
    '<div class="acc-pending"><span class="acc-pending-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M9 14.5h6"/></svg></span><div class="acc-pending-t">Sin registros de hoy</div><div class="acc-pending-s">Cargá la planilla del <b id="accPendDate">—</b> para ver la facturación del día</div></div>' +
    '</div>' +
    '<div class="p2-tiles p2-tiles--s p2-tiles--g">' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/><path d="M15 8h3v3"/></svg></i><span>Cierre estimado del mes</span><em class="p2-c" id="stProy"></em></div><b class="p2-big" id="kProyPct">–</b><div class="p2-tbar"><span id="kProyBar"></span></div><small>₲ <span id="kProy">–</span> de la meta</small></div>' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/></svg></i><span>Contra el año pasado</span><em class="p2-c" id="stMes"></em></div><b class="p2-big" id="kMesVar">–</b><div class="p2-tbar p2-tbar--x"></div><small id="kMesPrevL">–</small></div>' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></i><span>Meta del año a hoy</span><em class="p2-c" id="stYtd"></em></div><b class="p2-big" id="kYtdPct">–</b><div class="p2-tbar"><span id="kYtdBar"></span></div><small>₲ <span id="kYtd">–</span> facturado</small></div>' +
      '<div class="p2-t p2-t--ped"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16l-1.5 11a2 2 0 01-2 1.7H7.5a2 2 0 01-2-1.7z"/><path d="M9 7V5a3 3 0 016 0v2"/></svg></i><span>Pedidos pendientes <b id="pScope"></b></span><em class="p2-c" id="stCob"></em></div>' +
        '<b class="p2-big">₲ <span id="pgTot">–</span></b><div class="p2-tbar"><span id="kCobBar"></span></div>' +
        '<div class="p2-ped__f"><small><b id="kCob">–</b> de lo que falta · <span id="pgPed">–</span> pedidos</small>' +
        '<a href="#" class="p2-go" data-go="pedidos">Ver pedidos <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div></div>' +
    '</div>' +
        '<div class="card p2-alm"><div class="p2-h"><h3>Facturado por almacén</h3></div><div id="almBox"></div></div>' +
    '</div>' +
    '<div class="p4-r">' +
      '<div class="card p2-daily"><div class="p2-h"><h3>Facturación día por día <span id="dScope"></span></h3><span class="p2-leg"><i></i>superó el objetivo del día</span></div><div class="p2-dl" id="dailyTbl"></div></div>' +
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
      '<div class="card"><div class="p2-h"><h3>Facturación por mes</h3><span class="mm-leg"><span><i class="b"></i><span class="yA">año</span></span><span><i class="g"></i><span class="yB">año anterior</span></span><span><i class="m"></i>Meta</span></span></div><div class="chartbox mm-box"><canvas id="chTrend"></canvas></div></div>' +
      '<div class="card"><div class="p2-h"><h3>Acumulado del año</h3><span class="mm-leg"><span><i class="b"></i><span class="yA">año</span></span><span><i class="g"></i><span class="yB">año anterior</span></span><span><i class="m"></i>Meta</span></span></div><div class="chartbox mm-box"><canvas id="chAcum"></canvas></div></div>' +
    '</div>' +
    '<div class="card"><div class="p2-h"><h3>Mes a mes</h3><span class="p2-leg"><i></i>alcanzó la meta del mes</span></div><div class="mm-tbl"><table id="tblMM"><thead><tr><th>Mes</th><th class="r yA">año</th><th class="r yB">año anterior</th><th class="r">Var. vs <span class="yB">año anterior</span></th><th class="r">Meta</th><th>Cumplimiento</th><th class="r">Acumulado <span class="yA">año</span></th></tr></thead><tbody></tbody></table></div></div>' +
    '</section>' +

    '<section class="page" id="pedidos">' +
    '<div class="p2-tiles">' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M16.5 7.5c0-1.9-2-3-4.5-3S7.5 5.6 7.5 7.5 9.5 10.4 12 11s4.5 1.6 4.5 3.5-2 3-4.5 3-4.5-1.1-4.5-3"/></svg></i><span>Monto pendiente</span><em class="p2-c" id="pqCob">–</em></div><b class="p2-t__v">₲ <span id="p2Tot">–</span></b><small id="pqCobS">–</small></div>' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg></i><span>Pedidos</span></div><b class="p2-t__v" id="p2Ped">–</b><small>esperando facturar</small></div>' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg></i><span>Líneas</span></div><b class="p2-t__v" id="p2Lin">–</b><small>artículos en esos pedidos</small></div>' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8L12 3.5 20.5 8v8L12 20.5 3.5 16z"/><path d="M3.5 8L12 12.5 20.5 8M12 12.5v8"/></svg></i><span>Peso</span></div><b class="p2-t__v"><span id="p2Peso">–</span> kg</b><small>de los artículos con peso cargado</small></div>' +
    '</div>' +
    '<div class="pq-top">' +
      '<div class="card pq-rt"><div class="p2-h"><h3>¿Dónde está lo pendiente?</h3><small class="cf-n">tocá una etapa para filtrar</small></div><div class="pq-rt__w" id="pqRt"></div></div>' +
      '<div class="card pq-age-c"><div class="p2-h"><h3>¿Hace cuánto espera?</h3><small class="cf-n">por fecha de entrega</small></div><div id="pqAge"></div></div>' +
    '</div>' +
    '<div class="card pq-card">' +
      '<div class="pq-bar">' +
        '<div class="pq-f"><span>Almacén</span><div class="pq-seg" id="pqAlm"></div></div>' +
        '<div class="pq-f"><span>Etapa</span><div class="pq-seg" id="pqEt"></div></div>' +
      '</div>' +
      '<div class="pq-views"><div class="pq-seg pq-seg--v" id="pedPills">' +
        '<button class="pill on" data-v="almacen">Por almacén</button><button class="pill" data-v="vext">Vendedor externo</button><button class="pill" data-v="vint">Vendedor interno</button><button class="pill" data-v="prod">Producción / Importados</button><button class="pill" data-v="fecha">Por fecha de entrega</button><button class="pill" data-v="etapa">Por etapa</button>' +
      '</div></div>' +
      '<div class="pq-head"><span id="pedChTitle">–</span><span class="pq-cols"><span>Monto ₲</span><span>Parte</span><span>Kg</span><span>Líneas</span></span></div>' +
      '<div class="pq-list" id="pedTblBox"></div>' +
    '</div>' +
    '</section>' +

    '<section class="page" id="config">' +
    '<div class="p2-tiles">' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></i><span>Días hábiles del mes</span></div><b class="p2-t__v" id="cfHab">–</b><small>lunes a sábado, sin feriados · <span id="cfMes">–</span></small></div>' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></i><span>Transcurridos</span></div><b class="p2-t__v" id="cfTrans">–</b><div class="p2-tbar"><span id="cfBar"></span></div><small>hasta la última fecha con datos</small></div>' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg></i><span>Faltan</span></div><b class="p2-t__v" id="cfFalt">–</b><small><span id="cfFds">–</span> domingos · <span id="cfFer">–</span> feriados en el mes</small></div>' +
      '<div class="p2-t"><div class="p2-t__h"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16"/><path d="M7 15v-4M12 15V8M17 15v-6"/></svg></i><span>Valor del sábado</span></div><b class="p2-t__v" id="cfSab">–</b><small>de un día de semana, según lo facturado</small></div>' +
    '</div>' +
    '<div class="cf-grid">' +
      '<div class="card"><div class="p2-h"><h3>Calendario del mes</h3><span class="cf-leg"><span><i class="h"></i>hábil</span><span><i class="p"></i>transcurrido</span><span><i class="s"></i>sábado</span><span><i class="f"></i>feriado</span></span></div><div class="cf-cal" id="cfCal"></div></div>' +
      '<div class="card"><div class="p2-h"><h3>Feriados</h3><small class="cf-n" id="cfFerN">–</small></div>' +
        '<div class="cf-add" id="ferAddRow"><input type="date" id="ferDate"><input type="text" id="ferName" placeholder="Descripción (opcional)"><button class="btn cf-btn" id="btnAddFer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg> Agregar</button></div>' +
        '<div class="cf-fer" id="ferList"></div>' +
        '<div class="cf-note">Los feriados se descuentan de los días hábiles y recalculan las proyecciones para todo el equipo.</div>' +
      '</div>' +
    '<div class="card cf-ref"><div class="p2-h"><h3>Fecha de referencia</h3><small class="cf-n">para simular proyecciones</small></div><div class="cf-add"><input type="date" id="hoyInput"><button class="btn cf-btn" id="btnHoy">Aplicar</button><button class="btn" id="btnHoyReset">Volver a la última fecha con datos</button></div></div>' +
    '</div>' +
    '</section>';

  /* ── Filtro de segmento (Almacén) para la toolbar ── */
  var SCOPES = [['tot', 'Total', 'grid', '#0B4F8A'], ['fer', 'Ferretería', 'deposito', '#0E7490'], ['hie', 'Hierros', 'fabrica', '#475569']];
  function scopeBarHtml() {
    return '<div class="seg3" id="scopeSeg" role="tablist" aria-label="Almacén"><span class="seg3__pill"></span>' +
      SCOPES.map(function (x) { return '<button type="button" class="seg3__btn scopebtn' + (SCOPE === x[0] ? ' on' : '') + '" data-s="' + x[0] + '" style="--c:' + x[3] + '">' + IC[x[2]] + '<span>' + x[1] + '</span></button>'; }).join('') + '</div>';
  }
  function moverPillScope(anim) {
    var seg = q('#scopeSeg'); if (!seg) return;
    var b = q('[data-s="' + SCOPE + '"]', seg), pill = q('.seg3__pill', seg); if (!b || !pill) return;
    var col = (SCOPES.filter(function (x) { return x[0] === SCOPE; })[0] || SCOPES[0])[3];
    qa('.seg3__btn', seg).forEach(function (x) { x.classList.toggle('on', x === b); });
    if (window.gsap && anim) gsap.to(pill, { x: b.offsetLeft - 4, width: b.offsetWidth, backgroundColor: col, duration: .45, ease: 'back.out(1.5)' });
    else { pill.style.transform = 'translateX(' + (b.offsetLeft - 4) + 'px)'; pill.style.width = b.offsetWidth + 'px'; pill.style.backgroundColor = col; }
  }

  /* ── Selector de mes: grilla de 12 meses (los que tienen datos se pueden elegir) ── */
  var IC_CAL = '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
  var IC_CHEV = '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  var MP_ANIO = null;
  function mesPickHtml() { return '<div class="mpick" id="mPick"><button type="button" class="mpick__btn" id="mPickBtn" aria-haspopup="true">' + IC_CAL + '<span>' + esc(MESES[D.cur_month - 1] + ' ' + D.cur_year) + '</span>' + IC_CHEV + '</button></div>'; }
  function cerrarMeses() {
    var pop = q('#mPick .mpick__pop'); if (!pop) return;
    q('#mPick').classList.remove('open');
    document.removeEventListener('click', fueraMeses); document.removeEventListener('keydown', escMeses);
    if (window.gsap) gsap.to(pop, { opacity: 0, y: -6, scale: .97, duration: .16, ease: 'power1.in', onComplete: function () { pop.remove(); } }); else pop.remove();
  }
  function fueraMeses(e) { var mp = q('#mPick'); if (mp && !mp.contains(e.target)) cerrarMeses(); }
  function escMeses(e) { if (e.key === 'Escape') cerrarMeses(); }
  function toggleMeses() {
    if (q('#mPick .mpick__pop')) { cerrarMeses(); return; }
    MP_ANIO = D.cur_year;
    var pop = el('<div class="mpick__pop" role="dialog" aria-label="Elegir mes"><div class="mpick__hd"><button type="button" class="mpick__yr" data-d="-1" aria-label="Año anterior">‹</button><b id="mpAnio"></b><button type="button" class="mpick__yr" data-d="1" aria-label="Año siguiente">›</button></div><div class="mpick__grid" id="mpGrid"></div><div class="mpick__ft"><i></i>con datos cargados</div></div>');
    q('#mPick').appendChild(pop); q('#mPick').classList.add('open');
    qa('.mpick__yr', pop).forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); MP_ANIO += +b.dataset.d; pintarMeses(+b.dataset.d); }); });
    pintarMeses(0);
    if (window.gsap) gsap.fromTo(pop, { opacity: 0, y: -8, scale: .96, transformOrigin: '100% 0%' }, { opacity: 1, y: 0, scale: 1, duration: .32, ease: 'back.out(1.6)' });
    setTimeout(function () { document.addEventListener('click', fueraMeses); document.addEventListener('keydown', escMeses); }, 0);
  }
  function pintarMeses(dir) {
    var grid = q('#mpGrid'); if (!grid) return;
    var ms = monthsList(), anios = ms.map(function (m) { return m.anio; }), aMin = Math.min.apply(null, anios.concat([MP_ANIO])), aMax = Math.max.apply(null, anios.concat([MP_ANIO]));
    q('#mpAnio').textContent = MP_ANIO;
    qa('.mpick__yr').forEach(function (b) { b.disabled = (+b.dataset.d < 0 && MP_ANIO <= aMin) || (+b.dataset.d > 0 && MP_ANIO >= aMax); });
    grid.innerHTML = MESES.map(function (n, i) {
      var has = ms.some(function (m) { return m.anio === MP_ANIO && m.mes === i + 1; }), on = MP_ANIO === D.cur_year && i + 1 === D.cur_month;
      return '<button type="button" class="mpick__m' + (has ? ' has' : '') + (on ? ' on' : '') + '" data-m="' + (i + 1) + '"' + (has ? '' : ' disabled') + '>' + n + '</button>';
    }).join('');
    qa('.mpick__m.has', grid).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var m = { anio: MP_ANIO, mes: +b.dataset.m };
        if (m.anio === D.cur_year && m.mes === D.cur_month) { cerrarMeses(); return; }
        qa('.mpick__m', grid).forEach(function (x) { x.classList.toggle('on', x === b); });
        if (window.gsap) gsap.fromTo(b, { scale: .9 }, { scale: 1, duration: .35, ease: 'back.out(2.5)' });
        setTimeout(function () { cerrarMeses(); gotoMonth(m); }, 160);
      });
    });
    if (window.gsap) gsap.from(qa('.mpick__m', grid), { opacity: 0, x: dir ? dir * 10 : 0, y: dir ? 0 : 4, duration: .26, stagger: .018, ease: 'power2.out', clearProps: 'transform,opacity' });
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
    var who = (updatedInfo.updated_by || '').toString().trim();
    var person = who
      ? '<span class="upd-tip__person"><small>Cargada por</small><strong>' + esc(who) + '</strong></span>'
      : '<span class="upd-tip__unknown">Usuario no registrado</span>';
    return '<span class="upd-chip upd-tip" tabindex="0" aria-describedby="updTipPanel" aria-label="Última actualización ' + esc(s) + (who ? ', cargada por ' + esc(who) : '') + '"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg><span class="upd-chip__label">Última actualización</span> <b>' + esc(s) + '</b>' +
      '<span class="upd-tip__panel" id="updTipPanel" role="tooltip"><span class="upd-tip__eyebrow">Última carga</span>' + person +
        '<span class="upd-tip__time">' + esc(s) + '</span></span></span>';
  }

  function gotoMonth(m) {
    if (!m || (m.anio === D.cur_year && m.mes === D.cur_month)) return;
    if (!(window.TableroDB && TableroDB.ready)) { toast('Sin conexión para cambiar de mes', true); return; }
    TableroDB.pullSnapshotFor(m.anio, m.mes).then(function (row) {
      if (!row || !row.snapshot) { toast('No hay datos de ese mes', true); return; }
      var dir = (m.anio * 12 + m.mes) > (D.cur_year * 12 + D.cur_month) ? 1 : -1;
      D = row.snapshot; dataOrigin = 'nube'; updatedInfo = { updated_at: row.updated_at, updated_by: row.updated_by }; hoyOverride = null;
      transicion(function () { sinEntrada(renderShell); }, dir);
    }).catch(function () { toast('No se pudo cargar el mes', true); });
  }

  /* ── Título/subtítulo por vista ── */
  function toolbarInfo(v) {
    var per = MESES[D.cur_month - 1] + ' ' + D.cur_year;
    if (v === 'mesames') return { t: 'Mes a mes & tendencias', s: 'Comparativa ' + D.cur_year + ' vs ' + (D.cur_year - 1) + ' · metas' };
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
      '</div>' +
      '<div class="empty">' + IC.empty + '<h3>Todavía no hay una base cargada</h3><p>' + (isAdmin() ? 'Usá <b>Actualizar datos</b> en la barra lateral para subir la planilla SAP. Se publicará para todo el equipo.' : 'Pedile a un administrador que cargue la base de facturación.') + '</p></div>';
    var b = q('#btnActualizar'); if (b) b.addEventListener('click', function () { q('#fileBase').click(); });
  }

  function renderShell() {
    if (currentView === 'cargar') { renderCargar(false); return; }
    if (!D) { renderEmpty(); return; }
    killCharts();
    var scopeApplies = currentView === 'principal' || currentView === 'mesames';
    q('#stage').innerHTML =
      '<div class="tbd-toolbar tb3"><div class="tbd-title"><h2 id="tbdTitle"></h2><span class="sub" id="tbdSub"></span></div>' +
      '<div class="tb3__mid" id="scopeSlot"' + (scopeApplies ? '' : ' style="visibility:hidden"') + '>' + scopeBarHtml() + '</div>' +
      '<div class="tb3__right">' +
      mesPickHtml() +
      updChipHtml() +
      '<button class="refresh-btn" id="btnRefresh" type="button" title="Refrescar datos" aria-label="Refrescar datos">' + IC.refresh + '</button>' +
      '</div></div><div class="tbd">' + SECTIONS_HTML + '</div>';
    qa('#stage .tbd .page').forEach(function (s) { s.classList.toggle('on', s.id === currentView); });
    setToolbarTitle(currentView);
    wireShell();
    renderPage(currentView);
    if (window.gsap) {
      gsap.from('#stage .tbd-toolbar', { opacity: 0, y: -8, duration: .35, ease: 'power2.out', clearProps: 'all' });
      var sb = q('#scopeSlot');
      if (sb && sb.style.visibility !== 'hidden') gsap.from(sb.querySelector('.seg3'), { opacity: 0, y: -10, scale: .96, duration: .45, ease: 'back.out(1.6)', clearProps: 'transform,opacity', delay: .05 });
    }
  }

  function wireShell() {
    var mpb = q('#mPickBtn'); if (mpb) mpb.addEventListener('click', function (e) { e.stopPropagation(); toggleMeses(); });
    requestAnimationFrame(function () { moverPillScope(false); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moverPillScope(false); });
    var ba = q('#btnActualizar'); if (ba) ba.addEventListener('click', function () { q('#fileBase').click(); });
    var rb = q('#btnRefresh'); if (rb) rb.addEventListener('click', refreshData);
    qa('#scopeSeg .scopebtn').forEach(function (b) { b.addEventListener('click', function () { if (SCOPE === b.dataset.s) return; SCOPE = b.dataset.s; moverPillScope(true); if (window.gsap) { var ic = b.querySelector('svg'); if (ic) gsap.fromTo(ic, { rotate: -18, scale: .7 }, { rotate: 0, scale: 1, duration: .5, ease: 'back.out(2.6)', clearProps: 'transform' }); } var pg = q('#stage .page.on'); if (window.gsap && pg) { gsap.to(pg, { opacity: .35, duration: .12, ease: 'power1.in', onComplete: function () { sinEntrada(function () { renderPage(currentView); }); gsap.to(pg, { opacity: 1, duration: .3, ease: 'power2.out', clearProps: 'opacity' }); } }); } else renderPage(currentView); }); });
    qa('#pedPills .pill').forEach(function (b) { b.addEventListener('click', function () { if (pedView === b.dataset.v) return; pedView = b.dataset.v; qa('#pedPills .pill').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); renderPedidos(); }); });
    var fa = q('#fAlm'), fe = q('#fEt');
    if (fa) fa.addEventListener('change', function (e) { fAlm = e.target.value; renderPedidos(); });
    if (fe) fe.addEventListener('change', function (e) { fEt = e.target.value; renderPedidos(); });
    var addRow = q('#ferAddRow'); if (addRow && !isAdmin()) addRow.style.display = 'none';
    var af = q('#btnAddFer'); if (af) af.addEventListener('click', addFer);
    var bh = q('#btnHoy'); if (bh) bh.addEventListener('click', function () { var v = q('#hoyInput').value; if (!v) { toast('Elegí una fecha', true); return; } hoyOverride = dOf(v); toast('Fecha de referencia aplicada'); renderShell(); });
    var br = q('#btnHoyReset'); if (br) br.addEventListener('click', function () { hoyOverride = null; toast('Volviendo a la última fecha con datos'); renderShell(); });
  }

  // Corre fn sin las animaciones de entrada (gsap.from): para refrescos de datos en la misma pantalla
  function sinEntrada(fn) {
    if (!window.gsap) { fn(); return; }
    var f0 = gsap.from; gsap.from = function (t, v) { return gsap.set(t, { clearProps: (v && v.clearProps) || '' }); };
    try { fn(); } finally { gsap.from = f0; }
  }
  // Fundido corto de la zona de contenido, ejecuta el cambio y vuelve a entrar
  function transicion(fn, dir) {
    var st = q('#stage .tbd') || q('#stage');
    if (!window.gsap || !st) { fn(); return; }
    gsap.killTweensOf(st);
    gsap.to(st, { opacity: 0, y: dir ? 0 : 8, x: dir ? -14 * dir : 0, duration: .16, ease: 'power2.in', onComplete: function () {
      fn();
      var n = q('#stage .tbd') || q('#stage');
      gsap.fromTo(n, { opacity: 0, y: dir ? 0 : 10, x: dir ? 18 * dir : 0 }, { opacity: 1, y: 0, x: 0, duration: .38, ease: 'power3.out', clearProps: 'transform,opacity' });
    } });
  }
  function go(v) {
    if (currentView !== v && window.gsap && q('#stage .tbd') && !go._t) { go._t = 1; transicion(function () { go._t = 0; goNow(v); }); return; }
    goNow(v);
  }
  function goNow(v) {
    currentView = v; setNav(v);
    if (v === 'cargar') { if (_regUnsub) { _regUnsub(); _regUnsub = null; } renderCargar(true); return; }
    if (v === 'registro') { renderRegistro(); return; }
    if (_regUnsub) { _regUnsub(); _regUnsub = null; }  // saliendo del registro: cortar realtime
    if (!D) { renderEmpty(); return; }
    if (!q('#stage .tbd') || q('#stage .tbd.up-page')) { renderShell(); return; }   // reconstruir si venías de registro, vacío o Actualizar datos
    qa('#stage .tbd .page').forEach(function (s) { s.classList.toggle('on', s.id === v); });
    var ss = q('#scopeSlot'); if (ss) ss.style.visibility = (v === 'principal' || v === 'mesames') ? '' : 'hidden';
    setToolbarTitle(v);
    renderPage(v);
    var pg = q('#stage #' + v); if (window.gsap && pg) gsap.from(pg.children, { opacity: 0, y: 10, duration: .34, stagger: .04, ease: 'power2.out', clearProps: 'transform,opacity' });
  }
  function renderPage(v) { if (v === 'principal') renderPrincipal(); else if (v === 'mesames') renderMesAMes(); else if (v === 'pedidos') renderPedidos(); else if (v === 'config') renderConfig(); }

  /* ── RENDER: PRINCIPAL ── */
  // Principal a una sola vista: el bloque ocupa el alto que queda; cada columna desplaza adentro si hace falta
  function ajustarP4() {
    var p = q('#p4'), st = q('#stage'); if (!p || !st) return;
    if (window.innerWidth <= 1100) { p.style.height = ''; p.classList.remove('fit'); return; }
    p.classList.add('fit');
    var top = p.getBoundingClientRect().top - st.getBoundingClientRect().top + st.scrollTop;
    var pb = parseFloat(getComputedStyle(st).paddingBottom) || 0;
    p.style.height = Math.max(560, st.clientHeight - top - pb - 2) + 'px';
  }
  window.addEventListener('resize', function () { if (currentView === 'principal') ajustarP4(); });
  function renderPrincipal() {
    var k = kpis(SCOPE), S = scoped(SCOPE);
    T('hScope', k.label); T('dScope', k.label); T('pScope', k.label);
    var av = pct(k.fact, k.meta);
    mk('gauge', { type: 'doughnut', data: { datasets: [{ data: [Math.min(av, 100), Math.max(0, 100 - av)], backgroundColor: ['#fff', 'rgba(255,255,255,.22)'], borderWidth: 0, circumference: 360, cutout: '78%' }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { animateRotate: true } } });
    // Meta mensual · avance — animado con GSAP
    if (window.gsap) gsap.fromTo('#principal .hero .gauge', { scale: .88, opacity: 0 }, { scale: 1, opacity: 1, duration: .6, ease: 'back.out(1.6)', clearProps: 'all' });
    animCount(q('#gPct'), av, function (v) { return v.toFixed(1) + '%'; }, 1);
    animCount(q('#hMeta'), k.meta, function (v) { return '₲ ' + fmt(v); }, 1.1);
    var hb = q('#hBar');
    if (hb) { if (window.gsap) { hb.style.transition = 'none'; gsap.fromTo(hb, { width: '0%' }, { width: Math.min(av, 100) + '%', duration: 1.1, ease: 'power2.out', delay: .2 }); } else hb.style.width = Math.min(av, 100) + '%'; }
    animCount(q('#hFact'), k.fact, function (v) { return 'Facturado ₲ ' + fmt(v); }, 1.1);
    animCount(q('#hFalta'), Math.max(0, k.meta - k.fact), function (v) { return 'Falta ₲ ' + fmt(v); }, 1.1);
    var pvH = pct(k.proyMes, k.meta), stH = av >= 100 ? ['ok', 'Meta cumplida'] : pvH >= 100 ? ['ok', 'En camino a la meta'] : pvH >= 90 ? ['warn', 'Cerca de la meta'] : ['bad', 'Por debajo del ritmo'];
    var hS = q('#hSt'); if (hS) { hS.className = 'h-st ' + stH[0]; hS.innerHTML = '<i></i>' + stH[1]; }
    var hP = q('#hPr'); if (hP) hP.innerHTML = 'Proyección <b>' + pvH.toFixed(1).replace('.', ',') + '%</b>';
    var hM = q('#hMk'); if (hM) { hM.style.left = Math.min(pvH, 100) + '%'; if (window.gsap) gsap.fromTo(hM, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: .45, delay: 1, ease: 'back.out(2)' }); }
    ajustarP4();
    if (window.gsap) {
      gsap.from('#principal .p4-l > *, #principal .p2-tiles--g > *', { opacity: 0, y: 14, duration: .45, stagger: .07, delay: .08, ease: 'power3.out', clearProps: 'transform,opacity' });
      gsap.from('#principal .p4-r > *', { opacity: 0, x: 18, duration: .5, stagger: .08, delay: .12, ease: 'power3.out', clearProps: 'transform,opacity' });
      gsap.from('#principal .card.hero .gauge', { scale: .85, opacity: 0, duration: .6, delay: .15, ease: 'back.out(1.6)', clearProps: 'transform,opacity' });
      gsap.from('#principal .h-st, #principal .h-pr', { opacity: 0, x: -8, duration: .4, stagger: .08, delay: .35, ease: 'power2.out', clearProps: 'transform,opacity' });
      gsap.from('#principal .card.hero', { opacity: 0, y: 14, duration: .5, ease: 'power3.out', clearProps: 'transform,opacity' });
      gsap.from('#principal .card.hero .med, #principal .card.hero .lbls span', { opacity: 0, y: 8, duration: .4, stagger: .06, delay: .15, ease: 'power2.out', clearProps: 'transform,opacity' });
      gsap.from('#cardDia', { opacity: 0, y: 14, duration: .5, delay: .06, ease: 'power3.out', clearProps: 'transform,opacity' });
    }
    animCount(q('#kFact'), k.fact, function (v) { return fmt(v); }, 1); animCount(q('#kMeta'), k.meta, function (v) { return '₲ ' + fmt(v); }, 1);
    var falta = k.meta - k.fact, cf = q('#kFalta'); if (cf) { cf.textContent = falta > 0 ? 'Falta ₲ ' + fmt(falta) : 'Meta superada +₲ ' + fmt(-falta); cf.className = 'chip ' + (falta > 0 ? 'flat' : 'up'); }
    animCount(q('#kProy'), k.proyMes, function (v) { return fmt(v); }, 1); var pp = q('#kProyPct'), pv = pct(k.proyMes, k.meta); if (pp) { pp.textContent = arrow(pv - 100) + ' ' + pv.toFixed(1) + '%'; pp.className = 'chip ' + (pv >= 100 ? 'up' : pv >= 90 ? 'flat' : 'down'); }
    // KPI destacado: Facturación del día — estado "sin registros de hoy" si el día hábil no está cargado
    var _pend = todayPending(), _cd0 = q('#cardDia'); if (_cd0) _cd0.classList.toggle('is-pending', _pend);
    if (_pend) { var _n = hoyOverride ? new Date(hoyOverride.getTime()) : new Date(); T('accPendDate', pad(_n.getDate()) + '/' + pad(_n.getMonth() + 1) + '/' + _n.getFullYear()); if (window.gsap) gsap.from('#cardDia .acc-pending', { opacity: 0, y: 10, scale: .96, duration: .5, ease: 'back.out(1.5)', clearProps: 'all' }); }
    animCount(q('#kDia'), k.lastCur, function (v) { return fmt(v); }, 1.1);
    T('kDiaFecha', k.lastDate ? ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dOf(k.lastDate).getDay()] + ' ' + k.lastDate.slice(8) + '/' + k.lastDate.slice(5, 7) : '—');
    animCount(q('#kDiaPrev'), k.prev, function (v) { return fmt(v); }, 1.1);
    // Objetivo del día DINÁMICO: ritmo requerido = meta restante ÷ días hábiles que faltan
    var remMeta = Math.max(0, k.meta - k.fact), remDays = Math.max(0, k.bd_rest);
    var reqDaily = remDays > 0 ? remMeta / remDays : remMeta;
    var pctObj = remMeta <= 0 ? 100 : pct(k.lastCur, reqDaily);
    var objGap = reqDaily - k.lastCur, objGapDone = remMeta <= 0 || objGap <= 0;
    T('kDiaObjGapLabel', remMeta <= 0 ? 'Meta mensual cumplida' : objGap > 0 ? 'Faltan' : objGap < 0 ? 'Superó por' : 'Objetivo cumplido');
    animCount(q('#kDiaObjResta'), remMeta <= 0 ? 0 : Math.abs(objGap), function (v) { return fmt(v); }, 1.1);
    var gapNode = q('#kDiaObjGap'); if (gapNode) { gapNode.classList.toggle('is-met', objGapDone); gapNode.classList.toggle('is-month-done', remMeta <= 0); }
    animCount(q('#kDiaObjPct'), pctObj, function (v) { return Math.round(v) + '%'; }, 1.1);
    animCount(q('#kDiaObj'), reqDaily, function (v) { return fmt(v); }, 1.1);
    animCount(q('#kDiaObjDays'), remDays, function (v) { return Math.round(v); }, .8);
    T('kDiaObjDaysUnit', remDays === 1 ? 'día hábil' : 'días hábiles');
    var pctFill = Math.max(0, Math.min(pctObj, 100)), dr = q('#kDiaRing'), drOff = 169.65 * (1 - pctFill / 100), cdR = q('#cardDia');
    if (cdR) cdR.classList.toggle('dz-ok', pctObj >= 100);
    if (dr) { if (window.gsap) gsap.fromTo(dr, { attr: { 'stroke-dashoffset': 169.65 } }, { attr: { 'stroke-dashoffset': drOff }, duration: 1.1, delay: .2, ease: 'power3.out' }); else dr.setAttribute('stroke-dashoffset', drOff); }
    var ob = q('#kDiaObjBar'), op = q('#kDiaObjProgress'); if (op) op.setAttribute('aria-valuenow', pctFill.toFixed(0)); if (ob) { if (ob.parentNode) ob.parentNode.classList.toggle('over', pctObj >= 100); if (window.gsap) { ob.style.transition = 'none'; gsap.fromTo(ob, { width: '0%' }, { width: pctFill + '%', duration: 1.1, ease: 'power2.out', delay: .2 }); } else ob.style.width = pctFill + '%'; }
    var dv = q('#kDiaVar'); if (dv) { var _cls = chipCls(k.varDia); dv.className = 'acc-trend ' + _cls; dv.innerHTML = trendArrow(_cls) + fp(k.varDia); if (window.gsap) gsap.fromTo(dv, { scale: .7, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'back.out(2)', delay: .4, clearProps: 'all' }); }
    if (window.gsap) { var cd = q('#cardDia'); if (cd) { gsap.from(cd.querySelector('.dz-hd'), { x: -10, opacity: 0, duration: .5, ease: 'power2.out', clearProps: 'all' }); gsap.from(cd.querySelector('.dz-main .acc-num'), { y: 8, opacity: 0, duration: .5, delay: .1, ease: 'power2.out', clearProps: 'all' }); gsap.from(cd.querySelector('.dz-bar-head'), { y: 5, opacity: 0, duration: .4, delay: .2, ease: 'power2.out', clearProps: 'all' }); } }
    // ── Tarjetas: un dato grande, una barra, una línea ──
    var G = !!window.gsap, P = function (v) { return v.toFixed(1).replace('.', ',') + '%'; };
    var est = function (p) { return p >= 100 ? 'ok' : p >= 90 ? 'warn' : 'bad'; };
    var big = function (id, v, cls, fmtF) { var e3 = q('#' + id); if (!e3) return; e3.className = 'p2-big ' + cls; animCount(e3, v, fmtF || P, 1); };
    var pv2 = pct(k.proyMes, k.meta);
    big('kProyPct', pv2, est(pv2)); animCount(q('#kProy'), k.proyMes, fmt, 1);
    var pb = q('#kProyBar'); if (pb) { pb.className = est(pv2); pb.dataset.w = Math.min(pv2, 100); }
    big('kMesVar', k.varYoY, k.varYoY >= 0.5 ? 'ok' : k.varYoY <= -0.5 ? 'bad' : '', function (v) { return fp(v); });
    T('kMesPrevL', '₲ ' + fmt(k.fact) + ' vs ₲ ' + fmt(k.mesYoY));
    var mpl = q('#kMesPrevL'); if (mpl) mpl.title = D.meses[k.mi] + ' ' + (k.y - 1) + ' al mismo día hábil' + (k.yoyExacto ? '' : ' (estimado)') + ' · mes completo ₲ ' + fmt(k.mesYoYFull);
    big('kYtdPct', k.cumplYtd, est(k.cumplYtd)); animCount(q('#kYtd'), k.ytd, fmt, 1);
    var yb = q('#kYtdBar'); if (yb) { yb.className = est(k.cumplYtd); yb.dataset.w = Math.min(k.cumplYtd, 100); }
    var cbr = q('#kCobBar');
    if (k.cobertura == null) { T('kCob', '100%'); if (cbr) { cbr.className = 'ok'; cbr.dataset.w = 100; } }
    else { var cv = k.cobertura; animCount(q('#kCob'), cv, function (v) { return Math.round(v) + '%'; }, 1); if (cbr) { cbr.className = cv >= 100 ? 'ok' : cv >= 60 ? 'warn' : 'bad'; cbr.dataset.w = Math.min(cv, 100); } }
    animCount(q('#kCobFalta'), k.faltaMes, fmt, 1); animCount(q('#kCobPend'), k.pend, fmt, 1);
    var chip = function (id, cls, txt) { var c2 = q('#' + id); if (c2) { c2.className = 'p2-c ' + cls; c2.innerHTML = '<i></i>' + txt; } };
    var TX = { ok: 'En meta', warn: 'Cerca', bad: 'Por debajo' };
    chip('stProy', est(pv2), TX[est(pv2)]);
    chip('stMes', k.varYoY >= 0.5 ? 'ok' : k.varYoY <= -0.5 ? 'bad' : 'na', k.varYoY >= 0.5 ? 'Arriba' : k.varYoY <= -0.5 ? 'Abajo' : 'Igual');
    chip('stYtd', est(k.cumplYtd), TX[est(k.cumplYtd)]);
    chip('stCob', k.cobertura == null || k.cobertura >= 100 ? 'ok' : k.cobertura >= 60 ? 'warn' : 'bad', k.cobertura == null || k.cobertura >= 100 ? 'Alcanza' : 'No alcanza');
    qa('#principal .p2-tbar span').forEach(function (sp) { if (G) gsap.fromTo(sp, { width: '0%' }, { width: sp.dataset.w + '%', duration: 1, delay: .25, ease: 'power3.out' }); else sp.style.width = sp.dataset.w + '%'; });

    // ── Día por día: barra + marca del objetivo del día (meta ÷ días hábiles, sábado ponderado) ──
    var objBase = k.bd_tot > 0 ? k.meta / k.bd_tot : 0, maxD = Math.max.apply(null, S.daily.map(function (x) { return x[1]; }).concat([objBase, 1])), tt = 0, h = '';
    var WD = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    S.daily.forEach(function (x) {
      var dt = dOf(x[0]), v = x[1], obj = objBase, ok = obj > 0 && v >= obj; tt += v;
      h += '<div class="p2-d' + (ok ? ' ok' : '') + '" title="Objetivo del día ₲ ' + fmt(obj) + '"><span class="p2-d__f"><b>' + x[0].slice(8) + '</b>' + WD[dt.getDay()] + '</span>' +
        '<span class="p2-d__b"><i data-w="' + (Math.max(0, v) / maxD * 100).toFixed(1) + '"></i><em style="left:' + Math.min(100, obj / maxD * 100).toFixed(1) + '%"></em></span>' +
        '<span class="p2-d__v">' + fmt(v) + '</span></div>';
    });
    h += '<div class="p2-d tot"><span class="p2-d__f"><b>Total</b></span><span></span><span class="p2-d__v">' + fmt(tt) + '</span></div>';
    H('dailyTbl', h);
    var dbars = qa('#dailyTbl .p2-d__b i'); dbars.forEach(function (i) { i.style.width = i.dataset.w + '%'; });
    if (G) gsap.fromTo(dbars, { scaleX: 0 }, { scaleX: 1, transformOrigin: '0% 50%', duration: .7, stagger: .02, delay: .2, ease: 'power3.out', clearProps: 'transform' });

    // ── Por almacén: dos bloques + pie con neta, otros y devoluciones ──
    var fa = D.fact_almacen || {}, fer = fa['Ferretería'] || 0, hie = fa['Hierros'] || 0, otros = 0;
    Object.keys(fa).forEach(function (kk) { if (kk !== 'Ferretería' && kk !== 'Hierros') otros += fa[kk]; });
    var neta = fer + hie + otros, ah = '<div class="al-g">';
    [['Ferretería', fer, 'fer', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/></svg>'], ['Hierros', hie, 'hie', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V10l6 3V10l6 3V7l6 3v11z"/><path d="M7 17h2M12 17h2M17 17h2"/></svg>']].forEach(function (e) {
      var pc = neta ? e[1] / neta * 100 : 0;
      ah += '<div class="al al--' + e[2] + '"><div class="al__h"><i>' + e[3] + '</i><span>' + e[0] + '</span><em>' + P(pc) + '</em></div><b>₲ ' + fmt(e[1]) + '</b><div class="p2-a__b"><span data-w="' + Math.min(100, Math.abs(pc)).toFixed(1) + '"></span></div></div>';
    });
    var dev = Math.abs(D.devoluciones || 0), bru = D.fact_bruta || 0;
    ah += '</div><div class="al-f"><div><span>Facturación neta</span><b>₲ ' + fmt(neta) + '</b></div><div><span>Otros almacenes</span><b>₲ ' + fmt(otros) + '</b></div><div class="neg"><span>Devoluciones · ' + (bru ? P(dev / bru * 100) : '0%') + '</span><b>₲ ' + fmt(dev) + '</b></div></div>';
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
    qa('#mesames .yA').forEach(function (e) { e.textContent = k.y; }); qa('#mesames .yB').forEach(function (e) { e.textContent = k.y - 1; });
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
      { type: 'bar', label: String(k.y), data: v26, backgroundColor: barCol, borderRadius: 7, maxBarThickness: 34, order: 3 },
      { type: 'line', label: String(k.y - 1), data: v25, borderColor: '#B8C4D0', borderWidth: 2, borderDash: [5, 4], pointRadius: 2, tension: .35, order: 2 },
      { type: 'line', label: 'Meta', data: meta, borderColor: '#0B4F8A', borderWidth: 0, pointStyle: 'line', pointRadius: 11, pointBorderWidth: 3, pointBorderColor: '#0B4F8A', showLine: false, order: 1 }
    ] }, options: { maintainAspectRatio: false, animation: { duration: 900, easing: 'easeOutQuart' }, plugins: { legend: { display: false }, tooltip: tip }, scales: { x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, font: { size: 10 } } }, y: { beginAtZero: true, ticks: gsTick, grid: { color: '#EEF2F7' } } } } });
    // Acumulado: 2026 vs 2025 vs meta
    var a25 = [], a26 = [], am = [], s25 = 0, s26 = 0, sm = 0;
    for (var m = 0; m < 12; m++) { s25 += v25[m] || 0; sm += meta[m] || 0; a25.push(s25); am.push(sm); if (v26[m] != null) { s26 += v26[m]; a26.push(s26); } else a26.push(null); }
    mk('chAcum', { type: 'line', data: { labels: labels, datasets: [
      { label: String(k.y), data: a26, borderColor: '#1466B0', backgroundColor: 'rgba(20,102,176,.10)', fill: true, borderWidth: 3, tension: .3, pointRadius: 3, pointBackgroundColor: '#1466B0' },
      { label: String(k.y - 1), data: a25, borderColor: '#B8C4D0', borderWidth: 2, borderDash: [5, 4], tension: .3, pointRadius: 0 },
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
  // Pastilla deslizante para los segmentos
  function segPill(seg, anim) {
    if (!seg) return; var on = q('.on', seg); if (!on) return;
    var p = q('.pq-pill', seg); if (!p) { p = el('<span class="pq-pill"></span>'); seg.insertBefore(p, seg.firstChild); }
    var x = on.offsetLeft, w = on.offsetWidth, y = on.offsetTop, h = on.offsetHeight;
    if (window.gsap && anim) gsap.to(p, { x: x, y: y, width: w, height: h, duration: .38, ease: 'power3.out' }); else { p.style.transform = 'translate(' + x + 'px,' + y + 'px)'; p.style.width = w + 'px'; p.style.height = h + 'px'; }
  }
  function renderPedidos() {
    var G = !!window.gsap, P = function (v) { return v.toFixed(1).replace('.', ',') + '%'; };
    // filtros (almacén y etapa) como segmentos
    var mkSeg = function (id, vals, cur, todos, set) {
      var box = q('#' + id); if (!box) return;
      if (!box.dataset.ok) {
        box.dataset.ok = '1';
        box.innerHTML = [['todos', todos]].concat(vals.map(function (v) { return [v, v]; })).map(function (o) { return '<button type="button" data-v="' + esc(o[0]) + '"' + (o[0] === cur ? ' class="on"' : '') + '>' + esc(o[1]) + '</button>'; }).join('');
        qa('button', box).forEach(function (bt) { bt.addEventListener('click', function () { if (bt.classList.contains('on')) return; qa('button', box).forEach(function (x) { x.classList.toggle('on', x === bt); }); segPill(box, true); set(bt.dataset.v); renderPedidos(); }); });
        requestAnimationFrame(function () { segPill(box, false); });
      }
    };
    var uniq = function (i) { var o = {}; D.ped_lines.forEach(function (l) { o[l[i]] = (o[l[i]] || 0) + l[7]; }); return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }); };
    mkSeg('pqAlm', uniq(0), fAlm, 'Todos', function (v) { fAlm = v; });
    mkSeg('pqEt', uniq(1), fEt, 'Todas', function (v) { fEt = v; });
    var pv = q('#pedPills'); if (pv && !pv.dataset.p) { pv.dataset.p = '1'; qa('.pill', pv).forEach(function (x) { x.classList.toggle('on', x.dataset.v === pedView); }); requestAnimationFrame(function () { segPill(pv, false); }); pv.addEventListener('click', function () { setTimeout(function () { segPill(pv, true); }, 0); }); }

    var L = pedFiltered(), total = 0, peso = 0, docs = {};
    L.forEach(function (l) { total += l[7]; peso += l[6]; docs[l[9]] = 1; });
    animCount(q('#p2Lin'), L.length, fmt, .9); animCount(q('#p2Ped'), Object.keys(docs).length, fmt, .9); animCount(q('#p2Tot'), total, fmt, .9); animCount(q('#p2Peso'), peso, fmt, .9);
    // cobertura de lo que falta para la meta del mes (total, sin filtros)
    var k = kpis('tot'), cobE = q('#pqCob');
    if (cobE) { if (k.faltaMes > 0) { var cv = pct(total, k.faltaMes); cobE.textContent = Math.round(cv) + '% de lo que falta'; cobE.className = 'p2-c ' + (cv >= 100 ? 'ok' : cv >= 60 ? 'warn' : 'bad'); T('pqCobS', 'para la meta faltan ₲ ' + fmt(k.faltaMes)); } else { cobE.textContent = 'Meta cumplida'; cobE.className = 'p2-c ok'; T('pqCobS', 'la meta del mes ya se alcanzó'); } }

    // ranking con barras
    var cfg = pedDef[pedView], rows = cfg.rows(L), sum = rows.reduce(function (a, r) { return a + (r[1] || 0); }, 0) || 1;
    var max = Math.max.apply(null, rows.map(function (r) { return Math.abs(r[1] || 0); }).concat([1]));
    T('pedChTitle', cfg.title + ' · ' + rows.length);
    var fechaV = pedView === 'fecha', hoyS = fmtHoy(hoyDate());
    var html = rows.map(function (r, i) {
      var nm = r[0], lbl = esc(nm);
      if (fechaV && /^\d{4}-\d{2}-\d{2}$/.test(nm)) { var dd = dOf(nm), dias = Math.round((dOf(hoyS) - dd) / 864e5); lbl = '<b>' + nm.slice(8) + '/' + nm.slice(5, 7) + '</b> ' + ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dd.getDay()] + (dias > 0 ? ' <em class="pq-age' + (dias > 7 ? ' old' : '') + '">hace ' + dias + (dias === 1 ? ' día' : ' días') + '</em>' : ''); }
      return '<div class="pq-r"><span class="pq-r__n">' + (fechaV ? '' : '<i class="pq-rk' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</i>') + '<span>' + lbl + '</span></span>' +
        '<span class="pq-r__b"><i data-w="' + (Math.abs(r[1] || 0) / max * 100).toFixed(1) + '"></i></span>' +
        '<span class="pq-r__v">' + fmt(r[1]) + '</span><span class="pq-r__p">' + P((r[1] || 0) / sum * 100) + '</span><span class="pq-r__k">' + (r[2] == null ? '–' : fmt(r[2])) + '</span><span class="pq-r__l">' + fmt(r[3]) + '</span></div>';
    }).join('') || '<div class="pq-empty">No hay pedidos pendientes con estos filtros.</div>';
    var tl = rows.reduce(function (a, r) { return a + (r[3] || 0); }, 0), tp = rows.reduce(function (a, r) { return a + (r[2] || 0); }, 0);
    if (rows.length) html += '<div class="pq-r tot"><span class="pq-r__n"><span><b>Total</b></span></span><span></span><span class="pq-r__v">' + fmt(sum) + '</span><span class="pq-r__p">100%</span><span class="pq-r__k">' + fmt(tp) + '</span><span class="pq-r__l">' + fmt(tl) + '</span></div>';
    H('pedTblBox', html);
    var bars = qa('#pedTblBox .pq-r__b i'); bars.forEach(function (i2) { i2.style.width = i2.dataset.w + '%'; });
    if (G) {
      gsap.fromTo(bars, { scaleX: 0 }, { scaleX: 1, transformOrigin: '0% 50%', duration: .7, stagger: .02, ease: 'power3.out', clearProps: 'transform' });
      gsap.from(qa('#pedTblBox .pq-r').slice(0, 14), { opacity: 0, y: 6, duration: .28, stagger: .025, ease: 'power2.out', clearProps: 'transform,opacity' });
    }
    // ── Recorrido: No preparado → En control → Controlado → Facturar ──
    var ETS = [['No Preparado', 'No preparado', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8L12 3.5 20.5 8v8L12 20.5 3.5 16z"/><path d="M3.5 8L12 12.5 20.5 8M12 12.5v8"/></svg>'], ['En control', 'En control', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="M20.5 20.5l-4.6-4.6"/></svg>'], ['Controlado', 'Controlado', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>']];
    var LA = D.ped_lines.filter(function (l) { return fAlm === 'todos' || l[0] === fAlm; });
    var porEt = ETS.map(function (e) { var m = 0, d = {}; LA.forEach(function (l) { if (String(l[1]).trim().toLowerCase() === e[0].toLowerCase()) { m += l[7]; d[l[9]] = 1; } }); return { k: e[0], n: e[1], ico: e[2], m: m, p: Object.keys(d).length }; });
    var tRt = porEt.reduce(function (a, x) { return a + x.m; }, 0) || 1, mxRt = porEt.reduce(function (a, x) { return x.m > a.m ? x : a; }, porEt[0]);
    var rt = q('#pqRt');
    if (rt) {
      rt.innerHTML = '<div class="pq-rt__line"><span></span></div>' + porEt.map(function (x) {
        var on = fEt !== 'todos' && fEt.toLowerCase() === x.k.toLowerCase(), mx = x === mxRt && x.m > 0;
        return '<button type="button" class="pq-n' + (mx ? ' is-max' : '') + (on ? ' on' : '') + '" data-et="' + esc(x.k) + '"><span class="pq-n__i">' + x.ico + '</span><b>' + x.n + '</b><strong>₲ ' + fmt(x.m) + '</strong><small>' + fmt(x.p) + ' pedidos · ' + Math.round(x.m / tRt * 100) + '%</small>' + (mx ? '<em>Donde más se acumula</em>' : '') + '</button>';
      }).join('') + '<div class="pq-n pq-n--fin"><span class="pq-n__i"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg></span><b>Facturar</b><small>siguiente paso</small></div>';
      qa('.pq-n[data-et]', rt).forEach(function (bt) {
        bt.addEventListener('click', function () {
          var v = fEt.toLowerCase() === bt.dataset.et.toLowerCase() ? 'todos' : bt.dataset.et;
          var seg = q('#pqEt'), target = seg && qa('button', seg).filter(function (x) { return x.dataset.v.toLowerCase() === v.toLowerCase(); })[0];
          if (target) target.click(); else { fEt = v; renderPedidos(); }
        });
      });
      if (G) {
        gsap.fromTo('#pqRt .pq-rt__line span', { scaleX: 0 }, { scaleX: 1, transformOrigin: '0% 50%', duration: .9, ease: 'power2.inOut' });
        gsap.from('#pqRt .pq-n__i', { scale: 0, rotate: -20, duration: .45, stagger: .12, delay: .1, ease: 'back.out(2.2)', clearProps: 'transform' });
        gsap.from('#pqRt .pq-n > b, #pqRt .pq-n > strong, #pqRt .pq-n > small, #pqRt .pq-n > em', { opacity: 0, y: 6, duration: .3, stagger: .03, delay: .25, ease: 'power2.out', clearProps: 'transform,opacity' });
      }
    }
    // ── Antigüedad por fecha de entrega ──
    var hoyA = dOf(fmtHoy(hoyDate())), BK = [['0 a 2 días', 0, 2, 'ok'], ['3 a 7 días', 3, 7, 'mid'], ['8 a 15 días', 8, 15, 'warn'], ['Más de 15 días', 16, 1e9, 'bad']];
    var LF = pedFiltered(), ag = BK.map(function (b2) { return { n: b2[0], c: b2[3], m: 0, d: {} }; });
    LF.forEach(function (l) { if (!l[4]) return; var dd = Math.round((hoyA - dOf(l[4])) / 864e5); for (var i = 0; i < BK.length; i++) if (dd >= BK[i][1] && dd <= BK[i][2]) { ag[i].m += l[7]; ag[i].d[l[9]] = 1; break; } });
    var tAg = ag.reduce(function (a, x) { return a + x.m; }, 0) || 1, mxAg = Math.max.apply(null, ag.map(function (x) { return x.m; }).concat([1]));
    H('pqAge', ag.map(function (x) {
      return '<div class="pq-ag"><span class="pq-ag__n"><i class="' + x.c + '"></i>' + x.n + '</span><span class="pq-ag__b"><i class="' + x.c + '" data-w="' + (x.m / mxAg * 100).toFixed(1) + '"></i></span><b>₲ ' + fmt(x.m) + '</b><small>' + Object.keys(x.d).length + ' ped. · ' + Math.round(x.m / tAg * 100) + '%</small></div>';
    }).join(''));
    qa('#pqAge .pq-ag__b i').forEach(function (i2) { i2.style.width = i2.dataset.w + '%'; });
    if (G) gsap.fromTo('#pqAge .pq-ag__b i', { scaleX: 0 }, { scaleX: 1, transformOrigin: '0% 50%', duration: .8, stagger: .07, delay: .15, ease: 'power3.out', clearProps: 'transform' });
  }

  /* ── RENDER: CONFIG ── */
  function renderConfig() {
    var k = kpis('tot'), G = !!window.gsap, y = k.y, m = k.mi, hoy = hoyDate();
    T('cfMes', D.meses[m] + ' ' + y);
    var _d = function (v) { return Math.round(v) + (Math.round(v) === 1 ? ' día' : ' días'); };
    animCount(q('#cfHab'), k.bd_tot, _d, .8); animCount(q('#cfTrans'), k.bd_el, _d, .8); animCount(q('#cfFalt'), k.bd_rest, _d, .8);
    T('cfFds', k.fds); T('cfFer', k.fer); T('cfSab', Math.round(k.ps * 100) + ' %');
    var cb = q('#cfBar'); if (cb) { var w = k.bd_tot ? k.bd_el / k.bd_tot * 100 : 0; if (G) gsap.fromTo(cb, { width: '0%' }, { width: w + '%', duration: 1, delay: .2, ease: 'power3.out' }); else cb.style.width = w + '%'; }
    // calendario
    var cal = q('#cfCal');
    if (cal) {
      var first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), off = (first.getDay() + 6) % 7, h = '';
      ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].forEach(function (n) { h += '<span class="cf-dn">' + n + '</span>'; });
      for (var i = 0; i < off; i++) h += '<span class="cf-d vac"></span>';
      var fac = {}; (D.daily || []).forEach(function (x) { fac[x[0]] = x[1]; });
      for (var dd = 1; dd <= days; dd++) {
        var dt = new Date(y, m, dd), wd = dt.getDay(), ds = fmtHoy(dt), fer = isHol(y, m, dd), cls = 'cf-d';
        if (wd === 0) cls += ' dom'; else if (fer) cls += ' fer'; else { cls += ' hab'; if (wd === 6) cls += ' sab'; if (dt <= hoy) cls += ' pas'; }
        if (ds === fmtHoy(hoy)) cls += ' hoy';
        var hol = fer ? holidays.filter(function (x) { return x.date === ds; })[0] : null;
        h += '<span class="' + cls + '" title="' + (hol ? 'Feriado' + (hol.name ? ': ' + esc(hol.name) : '') : fac[ds] != null ? 'Facturado ₲ ' + fmt(fac[ds]) : '') + '"><b>' + dd + '</b>' + (fac[ds] != null && wd !== 0 ? '<em>₲ ' + fmt(fac[ds]) + '</em>' : fer ? '<em>feriado</em>' : '') + '</span>';
      }
      cal.innerHTML = h;
      if (G) gsap.from(qa('.cf-d:not(.vac)', cal), { opacity: 0, scale: .85, duration: .3, stagger: .012, ease: 'back.out(1.8)', clearProps: 'transform,opacity' });
    }
    renderFerList();
    var hi = q('#hoyInput'); if (hi) hi.value = fmtHoy(hoyDate());
    if (G) { gsap.from('#config .p2-t', { opacity: 0, y: 12, duration: .45, stagger: .06, ease: 'power3.out', clearProps: 'transform,opacity' }); gsap.from('#config .p2-t__h i', { scale: 0, rotate: -20, duration: .5, stagger: .06, delay: .1, ease: 'back.out(2.4)', clearProps: 'transform' }); }
  }
  function renderFerList() {
    var list = q('#ferList'); if (!list) return; var admin = isAdmin();
    var MES3 = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'], DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    var hs = holidays.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }), hoyS = fmtHoy(new Date());
    var prox = (hs.filter(function (h) { return h.date >= hoyS; })[0] || {}).date;
    T('cfFerN', hs.length + (hs.length === 1 ? ' cargado' : ' cargados'));
    list.innerHTML = hs.length ? hs.map(function (h) {
      var dt = dOf(h.date), pas = h.date < hoyS;
      return '<div class="cf-fd' + (pas ? ' pas' : '') + (h.date === prox ? ' prox' : '') + '"><div class="cf-fd__c"><span>' + MES3[dt.getMonth()] + '</span><b>' + pad(dt.getDate()) + '</b></div><div class="cf-fd__t"><b>' + esc(h.name || DIAS[dt.getDay()]) + '</b><small>' + (h.date === prox ? 'Próximo feriado' : DIAS[dt.getDay()] + ' ' + dt.getFullYear()) + '</small></div>' + (admin ? '<button class="cf-fd__x" data-delfer="' + esc(h.date) + '" title="Quitar">×</button>' : '') + '</div>';
    }).join('') : '<div class="pq-empty">Sin feriados cargados.</div>';
    qa('[data-delfer]', list).forEach(function (b) { b.addEventListener('click', function () { delFer(b.dataset.delfer); }); });
    if (window.gsap) gsap.from(qa('.cf-fd', list), { opacity: 0, y: 8, duration: .3, stagger: .03, ease: 'power2.out', clearProps: 'transform,opacity' });
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

  /* ── APARTADO: ACTUALIZAR DATOS (solo admin) ── */
  function renderCargar(anim) {
    killCharts();
    var G = !!window.gsap && anim !== false;
    var hist = (availableMonths || []).slice().sort(function (a, b) { return b.anio - a.anio || b.mes - a.mes; });
    var fh = function (iso) { if (!iso) return '—'; var d = new Date(iso); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' · ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
    q('#stage').innerHTML =
      '<div class="tbd-toolbar"><div class="tbd-title"><h2>Actualizar datos</h2><span class="sub">Cargá la planilla de facturación de SAP tal como se exporta</span></div><span class="spacer"></span>' + updChipHtml() + '</div>' +
      '<div class="tbd up-page">' +
        '<div class="up-drop" id="upDrop" tabindex="0" role="button">' +
          '<div class="up-drop__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg></div>' +
          '<b>Arrastrá el Excel acá</b><span>o hacé clic para elegirlo · .xlsx</span>' +
          '<em class="up-drop__btn">Elegir archivo</em>' +
        '</div>' +
        '<div class="up-side">' +
          '<div class="card up-rules"><div class="p2-h"><h3>Qué se revisa antes de publicar</h3></div>' +
            '<ul>' +
              '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg><span>Que tenga las 4 hojas: <b>x monto de fc fecha</b>, <b>Facturacion historico</b>, <b>BASE PEDIDOS PEND. DE FACTURAR</b> y <b>Presupuesto de ventas (Meta)</b></span></li>' +
              '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg><span>Que la hoja diaria traiga facturación con fecha</span></li>' +
              '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg><span>Que los pedidos pendientes no vengan todos en 0 (fórmulas sin calcular)</span></li>' +
              '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg><span>Si el mes ya estaba cargado, se reemplaza y te muestro qué cambió</span></li>' +
            '</ul></div>' +
          '<div class="card up-hist"><div class="p2-h"><h3>Meses cargados</h3><small class="cf-n">' + hist.length + '</small></div>' +
            (hist.length ? hist.map(function (m) { var cur = D && m.anio === D.cur_year && m.mes === D.cur_month; return '<div class="up-h' + (cur ? ' cur' : '') + '"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></i><b>' + MESES[m.mes - 1] + ' ' + m.anio + '</b><small>' + fh(m.updated_at) + '</small></div>'; }).join('') : '<div class="pq-empty">Todavía no hay meses cargados.</div>') +
          '</div>' +
        '</div>' +
      '</div>';
    var dz = q('#upDrop');
    var elegir = function () { q('#fileBase').click(); };
    dz.addEventListener('click', elegir);
    dz.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(); } });
    ['dragenter', 'dragover'].forEach(function (t) { dz.addEventListener(t, function (e) { e.preventDefault(); dz.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { dz.addEventListener(t, function (e) { e.preventDefault(); dz.classList.remove('over'); }); });
    dz.addEventListener('drop', function (e) { var f2 = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f2) onFile({ target: { files: [f2] } }); });
    if (G) {
      gsap.from('#stage .tbd-toolbar', { opacity: 0, y: -8, duration: .35, ease: 'power2.out', clearProps: 'all' });
      gsap.from('.up-drop', { opacity: 0, y: 18, scale: .98, duration: .55, ease: 'power3.out', clearProps: 'transform,opacity' });
      gsap.from('.up-drop__ico', { scale: 0, rotate: -20, duration: .6, delay: .15, ease: 'back.out(2.2)', clearProps: 'transform' });
      gsap.from('.up-side > *', { opacity: 0, x: 18, duration: .5, stagger: .08, delay: .1, ease: 'power3.out', clearProps: 'transform,opacity' });
      gsap.from('.up-rules li, .up-h', { opacity: 0, x: 10, duration: .3, stagger: .04, delay: .3, ease: 'power2.out', clearProps: 'transform,opacity' });
    }
  }
  // Al terminar de cargar: transición a Facturación diaria
  function irAFacturacion() {
    var st = q('#stage'); currentView = 'principal'; setNav('principal');
    if (!window.gsap || !st) { renderShell(); return; }
    gsap.to(st, { opacity: 0, y: 14, scale: .985, duration: .3, ease: 'power2.in', onComplete: function () {
      st.scrollTop = 0; renderShell();
      gsap.fromTo(st, { opacity: 0, y: -12, scale: .99 }, { opacity: 1, y: 0, scale: 1, duration: .6, ease: 'power3.out', clearProps: 'transform,opacity' });
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
      var btn = document.createElement('button'); btn.className = 'btn btn--primary upl-close upl-go'; btn.innerHTML = 'Ver facturación diaria <span class="upl-cd"></span>';
      var irYa = function () { clearInterval(tmr); if (!q('#uplOv')) return; closeUpload(); setTimeout(irAFacturacion, 120); };
      btn.addEventListener('click', irYa);
      card.appendChild(btn);
      if (window.gsap) { gsap.from(card.querySelectorAll('.upl-diff, .upl-close'), { opacity: 0, y: 10, duration: .4, stagger: .08, ease: 'power2.out', clearProps: 'transform,opacity' }); gsap.fromTo(card, { scale: .97 }, { scale: 1, duration: .45, ease: 'back.out(1.8)' }); }
      var seg = 4, cd = card.querySelector('.upl-cd'); if (cd) cd.textContent = '· ' + seg;
      var tmr = setInterval(function () { seg--; if (cd) cd.textContent = '· ' + seg; if (seg <= 0) irYa(); }, 1000);
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
          var pl = newSnap.ped_lines || [];
          if (pl.length && !pl.some(function (l) { return l[7] > 0; })) { failUpload('Los pedidos pendientes vienen todos con monto 0. Abrí el Excel, dejá que calcule las fórmulas (o guardalo de nuevo) y volvé a subirlo.'); return; }
          if (!newSnap.daily || !newSnap.daily.length) { failUpload('La hoja «x monto de fc fecha» no tiene facturación con fecha. Revisá que sea la planilla del día.'); return; }
          setProg(60, 'Comparando con lo cargado…');
          var anio = newSnap.cur_year, mes = newSnap.cur_month;
          var user = (window.AlasAuthClient && AlasAuthClient.getCurrentUser && AlasAuthClient.getCurrentUser()) || null;
          var oldP = (window.TableroDB && TableroDB.ready) ? TableroDB.pullSnapshotFor(anio, mes) : Promise.resolve((D && D.cur_year === anio && D.cur_month === mes) ? { snapshot: D } : null);
          oldP.then(function (row) {
            var oldSnap = row && row.snapshot ? row.snapshot : null, diff = diffSnapshots(oldSnap, newSnap);
            setProg(82, 'Publicando…');
            var pushP = (window.TableroDB && TableroDB.ready) ? TableroDB.pushSnapshot(newSnap, user) : Promise.resolve();
            return pushP.then(function () { return diff; });
          }).then(function (diff) {
            D = newSnap; dataOrigin = 'actualizado'; updatedInfo = { updated_at: new Date().toISOString(), updated_by: user };
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
    var nc = q('#navCargar'); if (nc) nc.hidden = !isAdmin();

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
