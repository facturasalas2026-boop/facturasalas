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
    fabrica: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M4 21V11l5 3V11l5 3V8l5 3v10"/><path d="M8 21v-4h3v4"/></svg>'
  };

  /* ── Rol / permisos (gate real = SSO) ── */
  function isAdmin() {
    var c = window.AlasAuthClient;
    if (!c || !c.isAuthenticated) return true; // dev / sin SSO
    var role = (c.getRole && c.getRole() || '').toLowerCase();
    return role === 'admin' || role === 'supervisor';
  }
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
  function bdaysMonth(y, m) { var tot = 0, days = new Date(y, m + 1, 0).getDate(), fds = 0, fer = 0; for (var d = 1; d <= days; d++) { var w = new Date(y, m, d).getDay(); if (w === 0 || w === 6) { fds++; continue; } if (isHol(y, m, d)) { fer++; continue; } tot++; } return { tot: tot, days: days, fds: fds, fer: fer }; }
  function bdaysElapsed(y, m, hoy) { var n = 0, days = new Date(y, m + 1, 0).getDate(); for (var d = 1; d <= days; d++) { var dt = new Date(y, m, d), w = dt.getDay(); if (w === 0 || w === 6) continue; if (isHol(y, m, d)) continue; if (dt <= hoy) n++; } return n; }
  function bdaysYear(y) { var n = 0, end = new Date(y, 11, 31); for (var dt = new Date(y, 0, 1); dt <= end; dt.setDate(dt.getDate() + 1)) { var w = dt.getDay(); if (w !== 0 && w !== 6) n++; } return n; }
  function bdaysYearElapsed(y, hoy) { var n = 0; for (var dt = new Date(y, 0, 1); dt <= hoy; dt.setDate(dt.getDate() + 1)) { var w = dt.getDay(); if (w !== 0 && w !== 6) n++; } return n; }
  function hoyDate() { if (hoyOverride) return hoyOverride; if (D.daily && D.daily.length) return dOf(D.daily[D.daily.length - 1][0]); return new Date(D.cur_year, D.cur_month - 1, new Date(D.cur_year, D.cur_month, 0).getDate()); }
  function scoped(sc) {
    if (sc === 'fer') return { v26: D.v2026_fer, v25: D.v2025_fer, meta: D.meta_ldal, daily: D.daily_fer, prev: D.last_bd_prevyear_fer, label: '· Ferretería' };
    if (sc === 'hie') return { v26: D.v2026_hie, v25: D.v2025_hie, meta: D.meta_ldfa, daily: D.daily_hie, prev: D.last_bd_prevyear_hie, label: '· Hierros' };
    return { v26: D.v2026, v25: D.v2025, meta: D.meta_tot, daily: D.daily, prev: D.last_bd_prevyear, label: '' };
  }
  function lastBD(daily, hoy) { var bd = daily.filter(function (x) { var d = dOf(x[0]); return d.getDay() !== 0 && d.getDay() !== 6 && d <= hoy; }); return bd.length ? { val: bd[bd.length - 1][1], date: bd[bd.length - 1][0] } : { val: 0, date: null }; }
  function kpis(sc) {
    var S = scoped(sc), mi = D.cur_month - 1, y = D.cur_year, hoy = hoyDate();
    var bm = bdaysMonth(y, mi), bd_tot = bm.tot, bd_el = Math.min(bdaysElapsed(y, mi, hoy), bd_tot), bd_rest = bd_tot - bd_el;
    var fact = S.v26[mi], meta = S.meta[mi], proyMes = bd_el > 0 ? fact / bd_el * bd_tot : fact;
    var mesYoY = S.v25[mi], varYoY = pct(fact - mesYoY, mesYoY);
    var lb = lastBD(S.daily, hoy), varDia = pct(lb.val - S.prev, S.prev);
    var metaAnual = S.meta.reduce(function (a, b) { return a + b; }, 0);
    var ytd = 0; for (var i = 0; i <= mi; i++) ytd += S.v26[i];
    var yEl = bdaysYearElapsed(y, hoy), yTot = bdaysYear(y), proyAnio = yEl > 0 ? ytd / yEl * yTot : ytd;
    return { mi: mi, y: y, bd_tot: bd_tot, bd_el: bd_el, bd_rest: bd_rest, fact: fact, meta: meta, proyMes: proyMes, mesYoY: mesYoY, varYoY: varYoY, varDia: varDia, metaAnual: metaAnual, ytd: ytd, proyAnio: proyAnio, daysMonth: bm.days, fds: bm.fds, fer: bm.fer, lastCur: lb.val, lastDate: lb.date, prev: S.prev, label: S.label };
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
      var lastb = function (lst) { var b = lst.filter(function (x) { var w = dOf(x[0]).getDay(); return w !== 0 && w !== 6; }); return b.length ? b[b.length - 1] : null; };
      var lb = lastb(d.daily); if (lb) { d.last_bd_cur = lb[1]; d.last_bd_date = lb[0]; }
      var pd = { tot: {}, fer: {}, hie: {} };
      hrows.forEach(function (r) { var dt = asDate(keyOf(r, 'Fecha de facturacion')); if (!dt) return; if (dt.getFullYear() === curY - 1 && dt.getMonth() === curM) { var ds = fmtHoy(dt), mo = num(keyOf(r, 'Monto')), code = (keyOf(r, 'Almacen_codigo') || '').toString().trim(); pd.tot[ds] = (pd.tot[ds] || 0) + mo; if (code === 'Alas') pd.fer[ds] = (pd.fer[ds] || 0) + mo; else if (code === 'Alas Dep. Fabric') pd.hie[ds] = (pd.hie[ds] || 0) + mo; } });
      var lastPrev = function (o) { var b = Object.keys(o).sort().filter(function (ds) { var w = dOf(ds).getDay(); return w !== 0 && w !== 6; }); return b.length ? o[b[b.length - 1]] : 0; };
      d.last_bd_prevyear = lastPrev(pd.tot); d.last_bd_prevyear_fer = lastPrev(pd.fer); d.last_bd_prevyear_hie = lastPrev(pd.hie);
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
    '<div class="card hero"><h3>Meta mensual · avance <span id="hScope" style="font-weight:600"></span></h3><div class="gaugewrap"><div class="gauge"><canvas id="gauge"></canvas><div class="pc"><div><div class="v" id="gPct">–</div><div class="l">de la meta</div></div></div></div><div style="flex:1;min-width:180px" class="barwrap"><div class="mini" style="color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.6px;font-size:11.5px;font-weight:700">Meta del mes</div><div class="med" id="hMeta" style="margin:2px 0 10px">–</div><div class="bar"><span id="hBar" style="width:0%"></span></div><div class="lbls"><span id="hFact">Facturado –</span><span id="hFalta">Falta –</span></div></div></div></div>' +
    '<div class="card accent" id="cardDia">' +
    '<div class="acc-top"><span class="acc-ico"><svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2.5"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/></svg></span><div class="acc-topx"><span class="acc-lbl">Facturación del día</span><span class="acc-sub" id="kDiaFecha">—</span></div></div>' +
    '<div class="acc-num"><span class="u">₲</span><span id="kDia">–</span></div>' +
    '<div class="acc-foot"><span class="acc-trend flat" id="kDiaVar">—</span><span class="acc-vs">vs mismo día hábil del año anterior · <b>₲ <span id="kDiaPrev">–</span></b></span></div>' +
    '</div>' +
    '</div>' +
    '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr));margin-bottom:18px">' +
    '<div class="card"><h3>Facturado acumulado</h3><div class="big"><span class="u">₲</span><span id="kFact">–</span></div><div class="sub2">Meta: <b id="kMeta">–</b></div><div style="margin-top:9px"><span class="chip flat" id="kFalta">–</span></div></div>' +
    '<div class="card"><h3>Proyección fin de mes</h3><div class="big"><span class="u">₲</span><span id="kProy">–</span></div><div class="sub2">Ritmo diario × días hábiles del mes</div><div style="margin-top:9px"><span class="chip" id="kProyPct">–</span> <span class="mini">vs meta</span></div></div>' +
    '<div class="card"><h3>Mes actual vs mismo mes año pasado</h3><div class="big"><span class="u">₲</span><span id="kMes">–</span></div><div class="sub2" id="kMesPrevL">–</div><div style="margin-top:9px"><span class="chip" id="kMesVar">–</span></div></div>' +
    '<div class="card"><h3>Proyección fin de año</h3><div class="big"><span class="u">₲</span><span id="kAnio">–</span></div><div class="sub2">Acum. año + ritmo meses restantes</div><div style="margin-top:9px"><span class="chip" id="kAnioPct">–</span> <span class="mini">de meta anual</span></div></div>' +
    '<div class="card"><h3>Días hábiles del mes</h3><div class="big"><span id="kBdEl">–</span><span class="u" style="font-size:16px"> / </span><span id="kBdTot">–</span></div><div class="sub2">Transcurridos / totales (L-V, sin feriados)</div><div style="margin-top:9px"><span class="chip flat" id="kBdRest">–</span></div></div>' +
    '</div>' +
    '<div class="grid g2" style="margin-bottom:16px">' +
    '<div class="card"><h3>Facturación diaria del mes <span id="dScope" style="font-weight:600;color:var(--gris)"></span></h3><div class="scrolltbl" id="dailyTbl"></div><div class="legend-tiny"><span><i style="background:var(--pos-bg);border:1px solid #bfe6d1"></i>Día con ₲ 2.000 millones o más</span></div></div>' +
    '<div class="card"><h3>Facturado por almacén</h3><div id="almBox"></div></div>' +
    '</div>' +
    '<div class="card"><h3>Pedidos pendientes de facturar · resumen <span id="pScope" style="font-weight:600;color:var(--gris)"></span></h3><div class="grid g4"><div class="stat-row" style="border:none;flex-direction:column;align-items:flex-start"><span class="k">Líneas</span><span class="v" id="pgLin">–</span></div><div class="stat-row" style="border:none;flex-direction:column;align-items:flex-start"><span class="k">Pedidos</span><span class="v" id="pgPed">–</span></div><div class="stat-row" style="border:none;flex-direction:column;align-items:flex-start"><span class="k">Monto total ₲</span><span class="v" id="pgTot">–</span></div><div class="stat-row" style="border:none;flex-direction:column;align-items:flex-start"><span class="k">Peso total (kg)</span><span class="v" id="pgPeso">–</span></div></div></div>' +
    '</section>' +

    '<section class="page" id="mesames">' +
    '<div class="grid g2" style="margin-bottom:16px"><div class="card"><h3>Facturación mensual · 2026 vs 2025</h3><div class="chartbox"><canvas id="chTrend"></canvas></div></div><div class="card"><h3>Acumulado del año · 2026 vs 2025</h3><div class="chartbox"><canvas id="chAcum"></canvas></div></div></div>' +
    '<div class="card"><h3>Facturación mes a mes · acumulado vs año pasado</h3><div style="overflow-x:auto"><table id="tblMM"><thead><tr><th>Mes</th><th>Acum. 2025</th><th>Acum. 2026</th><th>Var. acum. %</th><th>Meta 2026 (mes)</th><th>Cumpl. mes</th></tr></thead><tbody></tbody></table></div></div>' +
    '</section>' +

    '<section class="page" id="pedidos">' +
    '<div class="pedfilters"><div class="fld"><label>Almacén</label><select id="fAlm"></select></div><div class="fld"><label>Etapa del pedido</label><select id="fEt"></select></div></div>' +
    '<div class="grid g4" style="margin-bottom:16px"><div class="card"><h3>Líneas pendientes</h3><div class="big" id="p2Lin">–</div></div><div class="card"><h3>Pedidos</h3><div class="big" id="p2Ped">–</div></div><div class="card"><h3>Monto total</h3><div class="big"><span class="u">₲</span><span id="p2Tot">–</span></div></div><div class="card"><h3>Peso total</h3><div class="big"><span id="p2Peso">–</span><span class="u" style="font-size:14px"> kg</span></div></div></div>' +
    '<div class="pill-row" id="pedPills"><button class="pill on" data-v="almacen">Por almacén</button><button class="pill" data-v="vext">Por vendedor externo</button><button class="pill" data-v="vint">Por vendedor interno</button><button class="pill" data-v="prod">Prod./Import</button><button class="pill" data-v="fecha">Por fecha de autorización</button><button class="pill" data-v="hora">Por hora de creación</button><button class="pill" data-v="peso">Por peso</button><button class="pill" data-v="etapa">Por etapa</button></div>' +
    '<div class="grid g2"><div class="card"><h3 id="pedChTitle">Distribución</h3><div class="chartbox"><canvas id="chPed"></canvas></div></div><div class="card"><h3 id="pedTblTitle">Detalle</h3><div class="scrolltbl" style="max-height:360px" id="pedTblBox"></div></div></div>' +
    '</section>' +

    '<section class="page" id="config">' +
    '<div class="grid g2" style="margin-bottom:16px">' +
    '<div class="card"><h3>Cálculo de días hábiles</h3><div class="stat-row"><span class="k">Mes analizado</span><span class="v" id="cfMes">–</span></div><div class="stat-row"><span class="k">Días del mes</span><span class="v" id="cfDias">–</span></div><div class="stat-row"><span class="k">Fines de semana</span><span class="v" id="cfFds">–</span></div><div class="stat-row"><span class="k">Feriados cargados</span><span class="v" id="cfFer">–</span></div><div class="stat-row"><span class="k">Días hábiles (L-V, netos)</span><span class="v" id="cfHab">–</span></div><div class="stat-row"><span class="k">Transcurridos hasta hoy</span><span class="v" id="cfTrans">–</span></div><div class="stat-row"><span class="k">Que faltan</span><span class="v" id="cfFalt">–</span></div></div>' +
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
    Promise.all([TableroDB.pullFeriados(), TableroDB.pullSnapshotFor(D.cur_year, D.cur_month), TableroDB.listMonths(), minD])
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
    if (!D) return;
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
    mk('gauge', { type: 'doughnut', data: { datasets: [{ data: [Math.min(av, 100), Math.max(0, 100 - av)], backgroundColor: ['#fff', 'rgba(255,255,255,.22)'], borderWidth: 0, circumference: 360, cutout: '78%' }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { animateRotate: true } } });
    // Meta mensual · avance — animado con GSAP
    if (window.gsap) gsap.fromTo('#principal .hero .gauge', { scale: .88, opacity: 0 }, { scale: 1, opacity: 1, duration: .6, ease: 'back.out(1.6)', clearProps: 'all' });
    animCount(q('#gPct'), av, function (v) { return v.toFixed(1) + '%'; }, 1);
    animCount(q('#hMeta'), k.meta, function (v) { return '₲ ' + fmt(v); }, 1.1);
    var hb = q('#hBar');
    if (hb) { if (window.gsap) { hb.style.transition = 'none'; gsap.fromTo(hb, { width: '0%' }, { width: Math.min(av, 100) + '%', duration: 1.1, ease: 'power2.out' }); } else hb.style.width = Math.min(av, 100) + '%'; }
    animCount(q('#hFact'), k.fact, function (v) { return 'Facturado ₲ ' + fmt(v); }, 1.1);
    animCount(q('#hFalta'), Math.max(0, k.meta - k.fact), function (v) { return 'Falta ₲ ' + fmt(v); }, 1.1);
    T('kFact', fmt(k.fact)); T('kMeta', '₲ ' + fmt(k.meta));
    var falta = k.meta - k.fact, cf = q('#kFalta'); if (cf) { cf.textContent = falta > 0 ? 'Falta ₲ ' + fmt(falta) : 'Meta superada +₲ ' + fmt(-falta); cf.className = 'chip ' + (falta > 0 ? 'flat' : 'up'); }
    T('kProy', fmt(k.proyMes)); var pp = q('#kProyPct'), pv = pct(k.proyMes, k.meta); if (pp) { pp.textContent = arrow(pv - 100) + ' ' + pv.toFixed(1) + '%'; pp.className = 'chip ' + (pv >= 100 ? 'up' : pv >= 90 ? 'flat' : 'down'); }
    // KPI destacado: Facturación del día (count-up + pop del chip + entrada de la card)
    animCount(q('#kDia'), k.lastCur, function (v) { return fmt(v); }, 1.1);
    T('kDiaFecha', 'Último día hábil · ' + (k.lastDate ? k.lastDate.split('-').reverse().join('/') : '—'));
    animCount(q('#kDiaPrev'), k.prev, function (v) { return fmt(v); }, 1.1);
    var dv = q('#kDiaVar'); if (dv) { var _cls = chipCls(k.varDia); dv.className = 'acc-trend ' + _cls; dv.innerHTML = trendArrow(_cls) + fp(k.varDia); if (window.gsap) gsap.fromTo(dv, { scale: .7, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'back.out(2)', delay: .4, clearProps: 'all' }); }
    if (window.gsap) { var cd = q('#cardDia'); if (cd) { gsap.from(cd.querySelector('.acc-top'), { x: -10, opacity: 0, duration: .5, ease: 'power2.out', clearProps: 'all' }); gsap.from(cd.querySelector('.acc-num'), { y: 8, opacity: 0, duration: .5, delay: .1, ease: 'power2.out', clearProps: 'all' }); gsap.from(cd.querySelector('.acc-foot'), { y: 10, opacity: 0, duration: .5, delay: .22, ease: 'power2.out', clearProps: 'all' }); } }
    T('kMes', fmt(k.fact)); T('kMesPrevL', D.meses[k.mi] + ' ' + (k.y - 1) + ': ₲ ' + fmt(k.mesYoY));
    var mv = q('#kMesVar'); if (mv) { mv.textContent = arrow(k.varYoY) + ' ' + fp(k.varYoY); mv.className = 'chip ' + chipCls(k.varYoY); }
    T('kAnio', fmt(k.proyAnio)); var ap = q('#kAnioPct'), av2 = pct(k.proyAnio, k.metaAnual); if (ap) { ap.textContent = arrow(av2 - 100) + ' ' + av2.toFixed(1) + '%'; ap.className = 'chip ' + (av2 >= 100 ? 'up' : av2 >= 90 ? 'flat' : 'down'); }
    T('kBdEl', k.bd_el); T('kBdTot', k.bd_tot); var br = q('#kBdRest'); if (br) { br.textContent = 'Faltan ' + k.bd_rest + ' días hábiles'; br.className = 'chip flat'; }
    // tabla diaria
    var UMBRAL = 2e9, h = '<table><thead><tr><th>Día</th><th>Facturación ₲</th></tr></thead><tbody>', tt = 0;
    S.daily.forEach(function (x) { var ds = x[0], v = x[1]; tt += v; var wd = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'][dOf(ds).getDay()]; h += '<tr class="' + (v >= UMBRAL ? 'green' : '') + '"><td>' + ds.slice(8) + '/' + ds.slice(5, 7) + ' · ' + wd + '</td><td>' + fmt(v) + '</td></tr>'; });
    h += '<tr class="tot"><td>Total del mes</td><td>' + fmt(tt) + '</td></tr></tbody></table>';
    H('dailyTbl', h);
    // por almacén
    var entries = Object.keys(D.fact_almacen).map(function (kk) { return [kk, D.fact_almacen[kk]]; });
    var pos = entries.filter(function (e) { return e[1] >= 0; }).sort(function (a, b) { return b[1] - a[1]; });
    var negSum = entries.filter(function (e) { return e[1] < 0; }).reduce(function (a, e) { return a + e[1]; }, 0);
    var rws = pos.slice(); if (negSum < 0) rws.push(['Devoluciones (depósitos)', negSum]);
    var maxA = Math.max.apply(null, rws.map(function (e) { return Math.abs(e[1]); }).concat([1])), ah = '';
    rws.forEach(function (e) { var n = e[0], v = e[1], w = Math.abs(v) / maxA * 100; ah += '<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px"><span style="font-weight:600">' + esc(n) + '</span><span style="font-weight:700;color:' + (v < 0 ? 'var(--neg)' : 'var(--tinta)') + '">₲ ' + fmt(v) + '</span></div><div class="bar" style="background:#EEF2F7;height:10px"><span style="width:' + w + '%;background:' + (v < 0 ? 'var(--neg)' : 'linear-gradient(90deg,#1466B0,#3B8FD4)') + '"></span></div></div>'; });
    var neta = entries.reduce(function (a, e) { return a + e[1]; }, 0);
    ah += '<div style="border-top:1px solid #E2E8F0;margin-top:4px;padding-top:10px;font-size:12.5px"><div style="display:flex;justify-content:space-between"><span style="font-weight:700">Facturación neta</span><span style="font-weight:800">₲ ' + fmt(neta) + '</span></div><div style="display:flex;justify-content:space-between;margin-top:6px;color:var(--gris)"><span>Incluye NC/devol. facturadas (ZDEV·ZDCS·ZNCV)</span><span style="color:var(--neg);font-weight:600">₲ ' + fmt(D.devoluciones || 0) + '</span></div></div>';
    H('almBox', ah);
    // resumen pedidos
    var g = pedResumen(SCOPE); T('pgLin', fmt(g.lineas)); T('pgPed', fmt(g.pedidos)); T('pgTot', fmt(g.total)); T('pgPeso', fmt(g.peso));
  }

  /* ── RENDER: MES A MES ── */
  function renderMesAMes() {
    var meses3 = D.meses.map(function (m) { return m.slice(0, 3); }), S = scoped(SCOPE);
    var v25 = S.v25, v26 = S.v26.map(function (v) { return v || null; });
    mk('chTrend', { type: 'line', data: { labels: meses3, datasets: [{ label: '2025', data: v25, borderColor: GRAY, backgroundColor: 'transparent', borderWidth: 2, tension: .35, pointRadius: 2, borderDash: [5, 4] }, { label: '2026', data: v26, borderColor: AZ, backgroundColor: 'rgba(20,102,176,.08)', borderWidth: 3, fill: true, tension: .35, pointRadius: 3 }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ₲ ' + fmt(c.raw); } } } }, scales: { y: { ticks: gsTick, grid: { color: '#EEF2F7' } }, x: { grid: { display: false } } } } });
    var a25 = 0, a26 = 0, ac25 = [], ac26 = [];
    for (var i = 0; i < 12; i++) { a25 += v25[i]; ac25.push(a25); if (v26[i] != null) { a26 += v26[i]; ac26.push(a26); } else ac26.push(null); }
    mk('chAcum', { type: 'line', data: { labels: meses3, datasets: [{ label: 'Acum. 2025', data: ac25, borderColor: GRAY, borderWidth: 2, tension: .3, pointRadius: 0, borderDash: [5, 4] }, { label: 'Acum. 2026', data: ac26, borderColor: AZ, backgroundColor: 'rgba(20,102,176,.10)', fill: true, borderWidth: 3, tension: .3, pointRadius: 2 }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ₲ ' + fmt(c.raw); } } } }, scales: { y: { ticks: gsTick, grid: { color: '#EEF2F7' } }, x: { grid: { display: false } } } } });
    var meta = S.meta, tb = q('#tblMM tbody'); if (!tb) return; var html = ''; a25 = 0; a26 = 0;
    for (var j = 0; j < 12; j++) { var has = v26[j] != null; a25 += v25[j]; if (has) a26 += v26[j]; var va = has ? pct(a26 - a25, a25) : null, cu = has ? pct(v26[j], meta[j]) : null; html += '<tr><td>' + D.meses[j] + '</td><td>' + fmt(a25) + '</td><td>' + (has ? fmt(a26) : '–') + '</td><td class="' + (va > 0 ? 'pos' : 'neg') + '">' + (has ? fp(va) : '–') + '</td><td class="mini">' + fmt(meta[j]) + '</td><td class="' + (cu >= 100 ? 'pos' : cu >= 90 ? '' : 'neg') + '">' + (has ? cu.toFixed(0) + '%' : '–') + '</td></tr>'; }
    var totM = meta.reduce(function (a, b) { return a + b; }, 0);
    html += '<tr class="tot"><td>TOTAL</td><td>' + fmt(a25) + '</td><td>' + fmt(a26) + '</td><td class="' + (a26 > a25 ? 'pos' : 'neg') + '">' + fp(pct(a26 - a25, a25)) + '</td><td>' + fmt(totM) + '</td><td>' + pct(a26, totM).toFixed(0) + '%</td></tr>';
    tb.innerHTML = html;
  }

  /* ── RENDER: PEDIDOS ── */
  function renderPedidos() {
    var fa = q('#fAlm'), fe = q('#fEt');
    if (fa && !fa.options.length) { var alms = D.ped_lines.reduce(function (a, l) { if (a.indexOf(l[0]) < 0) a.push(l[0]); return a; }, []); fa.innerHTML = '<option value="todos">Todos los almacenes</option>' + alms.map(function (a) { return '<option value="' + esc(a) + '">' + esc(a) + '</option>'; }).join(''); fa.value = fAlm; }
    if (fe && !fe.options.length) { var ets = D.ped_lines.reduce(function (a, l) { if (a.indexOf(l[1]) < 0) a.push(l[1]); return a; }, []); fe.innerHTML = '<option value="todos">Todas las etapas</option>' + ets.map(function (e) { return '<option value="' + esc(e) + '">' + esc(e) + '</option>'; }).join(''); fe.value = fEt; }
    var L = pedFiltered(), total = 0, peso = 0, docs = {};
    L.forEach(function (l) { total += l[7]; peso += l[6]; docs[l[9]] = 1; });
    T('p2Lin', fmt(L.length)); T('p2Ped', fmt(Object.keys(docs).length)); T('p2Tot', fmt(total)); T('p2Peso', fmt(peso));
    var cfg = pedDef[pedView], rows = cfg.rows(L);
    T('pedChTitle', cfg.title); T('pedTblTitle', 'Detalle · ' + cfg.title.toLowerCase());
    var labels = rows.map(function (r) { return r[0]; }), vals = rows.map(function (r) { return r[1]; });
    if (cfg.bar) { mk('chPed', { type: 'bar', data: { labels: labels, datasets: [{ data: vals, backgroundColor: AZ, borderRadius: 3 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return '₲ ' + fmt(c.raw); } } } }, scales: { y: { ticks: gsTick, grid: { color: '#EEF2F7' } }, x: { grid: { display: false }, ticks: { maxRotation: 60, autoSkip: true, maxTicksLimit: 16 } } } } }); }
    else { var pal = ['#1466B0', '#E8833A', '#2BA84A', '#C0392B', '#8E5FBF', '#0FA3A3', '#D64C8B', '#8C9440', '#E0B33A', '#4A90D9', '#B5651D', '#3FA796', '#9B4DCA', '#DE6449', '#6C7A89', '#0B4F8A']; mk('chPed', { type: 'doughnut', data: { labels: labels, datasets: [{ data: vals.map(function (v) { return Math.abs(v); }), backgroundColor: pal, borderWidth: 2, borderColor: '#fff' }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 11, font: { size: 11 } } }, tooltip: { callbacks: { label: function (c) { return c.label + ': ₲ ' + fmt(c.raw); } } } }, cutout: '55%' } }); }
    var hh = '<table><thead><tr>' + cfg.cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>', tt = 0, tp = 0, tl = 0;
    rows.forEach(function (r) { tt += r[1] || 0; tp += r[2] || 0; tl += r[3] || 0; hh += '<tr><td>' + esc(r[0]) + '</td><td>' + fmt(r[1]) + '</td><td>' + (r[2] == null ? '' : fmt(r[2])) + '</td><td>' + fmt(r[3]) + '</td></tr>'; });
    hh += '<tr class="tot"><td>TOTAL</td><td>' + fmt(tt) + '</td><td>' + (cfg.cols[2] ? fmt(tp) : '') + '</td><td>' + fmt(tl) + '</td></tr></tbody></table>';
    H('pedTblBox', hh);
  }

  /* ── RENDER: CONFIG ── */
  function renderConfig() {
    var k = kpis('tot');
    T('cfMes', D.meses[k.mi] + ' ' + k.y); T('cfDias', k.daysMonth); T('cfFds', k.fds + ' días'); T('cfFer', k.fer + ' días'); T('cfHab', k.bd_tot + ' días'); T('cfTrans', k.bd_el + ' días'); T('cfFalt', k.bd_rest + ' días');
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
  function failUpload(msg) { closeUpload(); toast(msg, true); }
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
            cacheSave(); finishUpload(diff);
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

  /* ── BOOT ── */
  var _booted = false;
  function boot() {
    if (_booted) return; _booted = true;
    var fb = q('#fileBase'); if (fb) fb.addEventListener('change', onFile);
    qa('[data-nav]').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.nav); }); });
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
      .then(function () { if (D) renderShell(); else renderEmpty(); });
  }

  window.__initTablero = boot;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
