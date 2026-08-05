/* ============================================================
 * app.js — Tablero de Facturación Diaria · ALAS
 * ------------------------------------------------------------
 * Reutiliza el shell/base del ecosistema (sidebar, modal, toast).
 * Datos: snapshot-mirror en Supabase (TableroDB). El admin sube el
 * Excel SAP, se procesa acá (parseWB) y se publica el snapshot para
 * que todos vean lo mismo. Feriados compartidos en la nube.
 * ============================================================ */
(function () {
  'use strict';

  /* ── Helpers base ── */
  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  var fmt = function (n) { return (Math.round(n) || 0).toLocaleString('es-PY').replace(/,/g, '.'); };
  var fmtM = function (n) { var a = Math.abs(n); if (a >= 1e9) return (n / 1e9).toLocaleString('es-PY', { maximumFractionDigits: 2 }) + ' MM'; if (a >= 1e6) return (n / 1e6).toLocaleString('es-PY', { maximumFractionDigits: 1 }) + ' M'; return fmt(n); };
  var pct = function (n, d) { return d ? (n / d * 100) : 0; };
  var fp = function (v) { return (v >= 0 ? '+' : '') + v.toLocaleString('es-PY', { maximumFractionDigits: 1 }) + '%'; };
  var chipCls = function (v) { return v > 0.5 ? 'up' : (v < -0.5 ? 'down' : 'flat'); };
  var arrow = function (v) { return v > 0.5 ? '▲' : (v < -0.5 ? '▼' : '●'); };

  function toast(msg, err) {
    var t = el('<div class="toast ' + (err ? 'toast--err' : '') + '">' + esc(msg) + '</div>');
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 3000);
  }

  var IC = {
    check: '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
    upload: '<svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>',
    trash: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>',
    plus: '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    empty: '<svg fill="none" stroke="currentColor" stroke-width="1.4" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 2 4-6"/></svg>'
  };

  /* ── Modal + confirm (base canónica) ── */
  function openModal(title, bodyHtml, okLabel) {
    var bd = el('<div class="modal-bd"><div class="modal-box">' +
      '<div class="modal-hd"><h3>' + esc(title) + '</h3><button class="modal-x" data-close>&times;</button></div>' +
      '<div class="modal-bd_body">' + bodyHtml + '</div>' +
      '<div class="modal-foot"><button class="btn" data-close>Cancelar</button><button class="btn btn--primary" id="mOk">' + esc(okLabel || 'Guardar') + '</button></div></div></div>');
    document.body.appendChild(bd);
    requestAnimationFrame(function () {
      bd.classList.add('open');
      if (window.gsap) { gsap.from(bd, { opacity: 0, duration: .25, ease: 'power2.out' }); gsap.from(bd.querySelector('.modal-box'), { y: 22, scale: .96, opacity: 0, duration: .38, ease: 'back.out(1.5)' }); }
    });
    bd.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { closeModal(bd); }); });
    bd.addEventListener('click', function (e) { if (e.target === bd) closeModal(bd); });
    return bd;
  }
  function closeModal(bd) {
    if (window.gsap) {
      gsap.to(bd.querySelector('.modal-box'), { y: 16, scale: .97, opacity: 0, duration: .2, ease: 'power2.in' });
      gsap.to(bd, { opacity: 0, duration: .24, ease: 'power2.in', onComplete: function () { bd.remove(); } });
    } else { bd.classList.remove('open'); setTimeout(function () { bd.remove(); }, 200); }
  }
  function confirmPro(opts) {
    var bd = el('<div class="modal-bd"><div class="modal-box cpro">' +
      '<div class="cpro__ico ' + (opts.danger ? 'cpro__ico--danger' : '') + '">' + (opts.icon || IC.check) + '</div>' +
      '<h3 class="cpro__t">' + esc(opts.title || '¿Confirmar?') + '</h3>' +
      (opts.text ? '<p class="cpro__tx">' + opts.text + '</p>' : '') +
      '<div class="cpro__foot"><button class="btn" data-close>' + esc(opts.cancelLabel || 'Cancelar') + '</button>' +
      '<button class="btn ' + (opts.danger ? 'btn--danger-solid' : 'btn--primary') + '" id="cproOk">' + esc(opts.okLabel || 'Confirmar') + '</button></div></div></div>');
    document.body.appendChild(bd);
    requestAnimationFrame(function () {
      bd.classList.add('open');
      if (window.gsap) {
        gsap.from(bd, { opacity: 0, duration: .22, ease: 'power2.out' });
        gsap.from(bd.querySelector('.cpro'), { y: 20, scale: .93, opacity: 0, duration: .38, ease: 'back.out(1.7)' });
        gsap.from(bd.querySelector('.cpro__ico'), { scale: .3, rotation: -20, duration: .5, delay: .1, ease: 'back.out(2.2)', clearProps: 'transform' });
      }
    });
    function close() {
      if (window.gsap) {
        gsap.to(bd.querySelector('.cpro'), { y: 14, scale: .96, opacity: 0, duration: .18, ease: 'power2.in' });
        gsap.to(bd, { opacity: 0, duration: .22, ease: 'power2.in', onComplete: function () { bd.remove(); } });
      } else { bd.remove(); }
    }
    bd.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', close); });
    bd.addEventListener('click', function (e) { if (e.target === bd) close(); });
    q('#cproOk', bd).addEventListener('click', function () { close(); if (opts.onOk) opts.onOk(); });
  }

  /* ── Rol / permisos (gate real = SSO) ── */
  function isAdmin() {
    var c = window.AlasAuthClient;
    if (!c || !c.isAuthenticated) return true; // dev / sin SSO: permitir
    var role = (c.getRole && c.getRole() || '').toLowerCase();
    return role === 'admin' || role === 'supervisor';
  }

  /* ============================================================
   * ESTADO
   * ========================================================== */
  var LS_KEY = 'alas_tablero_fact_v3';
  var D = null;                 // snapshot actual
  var holidays = [];            // [{date:'YYYY-MM-DD', name}]
  var hoyOverride = null;
  var SCOPE = 'tot', mesScope = 'tot', pedView = 'almacen';
  var fAlm = 'todos', fEt = 'todos';
  var dataOrigin = 'nube';      // 'nube' | 'guardado' | 'actualizado'
  var updatedInfo = null;
  var charts = {};
  var currentView = 'principal';
  var availableMonths = [];     // [{anio,mes,updated_at}] con snapshot en la nube (asc)

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

  /* ============================================================
   * CÁLCULO (portado del prototipo)
   * ========================================================== */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtHoy(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dOf(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function isHol(y, m, d) { var s = y + '-' + pad(m + 1) + '-' + pad(d); return holidays.some(function (h) { return h.date === s; }); }
  function bdaysMonth(y, m) {
    var tot = 0, days = new Date(y, m + 1, 0).getDate(), fds = 0, fer = 0;
    for (var d = 1; d <= days; d++) { var w = new Date(y, m, d).getDay(); if (w === 0 || w === 6) { fds++; continue; } if (isHol(y, m, d)) { fer++; continue; } tot++; }
    return { tot: tot, days: days, fds: fds, fer: fer };
  }
  function bdaysElapsed(y, m, hoy) {
    var n = 0, days = new Date(y, m + 1, 0).getDate();
    for (var d = 1; d <= days; d++) { var dt = new Date(y, m, d), w = dt.getDay(); if (w === 0 || w === 6) continue; if (isHol(y, m, d)) continue; if (dt <= hoy) n++; }
    return n;
  }
  function bdaysYear(y) { var n = 0, end = new Date(y, 11, 31); for (var dt = new Date(y, 0, 1); dt <= end; dt.setDate(dt.getDate() + 1)) { var w = dt.getDay(); if (w !== 0 && w !== 6) n++; } return n; }
  function bdaysYearElapsed(y, hoy) { var n = 0; for (var dt = new Date(y, 0, 1); dt <= hoy; dt.setDate(dt.getDate() + 1)) { var w = dt.getDay(); if (w !== 0 && w !== 6) n++; } return n; }
  function hoyDate() {
    if (hoyOverride) return hoyOverride;
    if (D.daily && D.daily.length) return dOf(D.daily[D.daily.length - 1][0]);
    return new Date(D.cur_year, D.cur_month - 1, new Date(D.cur_year, D.cur_month, 0).getDate());
  }
  function scoped(sc) {
    if (sc === 'fer') return { v26: D.v2026_fer, v25: D.v2025_fer, meta: D.meta_ldal, daily: D.daily_fer, prev: D.last_bd_prevyear_fer, label: '· Ferretería' };
    if (sc === 'hie') return { v26: D.v2026_hie, v25: D.v2025_hie, meta: D.meta_ldfa, daily: D.daily_hie, prev: D.last_bd_prevyear_hie, label: '· Hierros' };
    return { v26: D.v2026, v25: D.v2025, meta: D.meta_tot, daily: D.daily, prev: D.last_bd_prevyear, label: '' };
  }
  function lastBD(daily, hoy) {
    var bd = daily.filter(function (x) { var d = dOf(x[0]); return d.getDay() !== 0 && d.getDay() !== 6 && d <= hoy; });
    return bd.length ? { val: bd[bd.length - 1][1], date: bd[bd.length - 1][0] } : { val: 0, date: null };
  }
  function kpis(sc) {
    var S = scoped(sc), mi = D.cur_month - 1, y = D.cur_year, hoy = hoyDate();
    var bm = bdaysMonth(y, mi), bd_tot = bm.tot, bd_el = Math.min(bdaysElapsed(y, mi, hoy), bd_tot), bd_rest = bd_tot - bd_el;
    var fact = S.v26[mi], meta = S.meta[mi];
    var proyMes = bd_el > 0 ? fact / bd_el * bd_tot : fact;
    var mesYoY = S.v25[mi], varYoY = pct(fact - mesYoY, mesYoY);
    var lb = lastBD(S.daily, hoy), varDia = pct(lb.val - S.prev, S.prev);
    var metaAnual = S.meta.reduce(function (a, b) { return a + b; }, 0);
    var ytd = 0; for (var i = 0; i <= mi; i++) ytd += S.v26[i];
    var yEl = bdaysYearElapsed(y, hoy), yTot = bdaysYear(y), proyAnio = yEl > 0 ? ytd / yEl * yTot : ytd;
    return { mi: mi, y: y, bd_tot: bd_tot, bd_el: bd_el, bd_rest: bd_rest, fact: fact, meta: meta, proyMes: proyMes, mesYoY: mesYoY, varYoY: varYoY, varDia: varDia, metaAnual: metaAnual, ytd: ytd, proyAnio: proyAnio, daysMonth: bm.days, fds: bm.fds, fer: bm.fer, lastCur: lb.val, lastDate: lb.date, prev: S.prev, label: S.label };
  }
  function pedResumen(sc) {
    var L = D.ped_lines;
    if (sc === 'fer') L = L.filter(function (l) { return l[0] === 'Ferretería'; });
    else if (sc === 'hie') L = L.filter(function (l) { return l[0] === 'Hierros'; });
    var total = 0, peso = 0, docs = {};
    L.forEach(function (l) { total += l[7]; peso += l[6]; docs[l[9]] = 1; });
    return { lineas: L.length, pedidos: Object.keys(docs).length, total: total, peso: peso };
  }
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

  /* ============================================================
   * PARSING del Excel SAP (portado del prototipo)
   * ========================================================== */
  var XALM = { LDAL: 'Ferretería', LDFA: 'Hierros', LDDV: 'Almacén LDDV', LFTD: 'Tienda Fábrica' };
  var PALM = { LDAL: 'Ferretería', LDFA: 'Hierros', LFTD: 'Tienda Fábrica', LDDV: 'Devoluciones' };
  function num(v) { if (typeof v === 'number') return v; if (typeof v === 'string') { var s = v.replace(/PYG/gi, '').replace(/\./g, '').replace(/\s/g, '').replace(/,/g, '.'); var n = parseFloat(s); return isNaN(n) ? 0 : n; } return 0; }
  function asDate(v) { if (v instanceof Date) return v; if (typeof v === 'string') { var m = v.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/); if (m) { var y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); } var d = new Date(v); if (!isNaN(d)) return d; } if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000)); return null; }
  function hourOf(v) { if (v instanceof Date) return v.getHours(); if (typeof v === 'string') { var m = v.match(/(\d{1,2}):/); if (m) return +m[1]; } if (typeof v === 'number' && v < 1) return Math.floor(v * 24); return -1; }
  var keyOf = function (o, name) { var k = Object.keys(o).find(function (x) { return x.trim().toLowerCase() === name.trim().toLowerCase(); }); return k ? o[k] : undefined; };

  function parseWB(wb) {
    var d = JSON.parse(JSON.stringify(EMPTY_SNAP));
    var S = function (n) { return wb.Sheets[wb.SheetNames.find(function (x) { return x.trim().toLowerCase() === n.toLowerCase(); })]; };
    // META
    var ms = S('Presupuesto de ventas (Meta)');
    if (ms) { var a = XLSX.utils.sheet_to_json(ms, { header: 1 }); var mt = [], ml = [], mf = []; for (var i = 0; i < 12; i++) { var r = a[2 + i] || []; ml.push(num(r[1])); mf.push(num(r[2])); mt.push(num(r[3]) || num(r[1]) + num(r[2])); } d.meta_tot = mt; d.meta_ldal = ml; d.meta_ldfa = mf; }
    // HISTORICO (2025 vs 2026 por almacén)
    var hs = S('Facturacion historico');
    var v25 = Array(12).fill(0), v26 = Array(12).fill(0), v25f = Array(12).fill(0), v26f = Array(12).fill(0), v25h = Array(12).fill(0), v26h = Array(12).fill(0);
    var hrows = [];
    if (hs) {
      hrows = XLSX.utils.sheet_to_json(hs);
      hrows.forEach(function (r) {
        var dt = asDate(keyOf(r, 'Fecha de facturacion')); if (!dt) return;
        var mo = num(keyOf(r, 'Monto')), y = dt.getFullYear(), m = dt.getMonth();
        var code = (keyOf(r, 'Almacen_codigo') || '').toString().trim();
        var g = code === 'Alas' ? 'fer' : (code === 'Alas Dep. Fabric' ? 'hie' : null);
        if (y === 2025) { v25[m] += mo; if (g === 'fer') v25f[m] += mo; else if (g === 'hie') v25h[m] += mo; }
        else if (y === 2026) { v26[m] += mo; if (g === 'fer') v26f[m] += mo; else if (g === 'hie') v26h[m] += mo; }
      });
      d.v2025 = v25; d.v2026 = v26; d.v2025_fer = v25f; d.v2026_fer = v26f; d.v2025_hie = v25h; d.v2026_hie = v26h;
    }
    // X MONTO (facturación diaria del mes en curso)
    var xs = S('x monto de fc fecha');
    if (xs) {
      var rows = XLSX.utils.sheet_to_json(xs);
      var daily = {}, dailyf = {}, dailyh = {}, alm = {}, curM = null, curY = null, mc = {};
      var dev = 0, bruta = 0, DEVCF = ['ZDEV', 'ZDCS', 'ZNCV'], DEVCD = ['DG', 'DI', 'DK'];
      rows.forEach(function (r) { var dt = asDate(keyOf(r, 'Fecha de documento')); if (!dt) return; mc[dt.getMonth()] = (mc[dt.getMonth()] || 0) + 1; });
      curM = +Object.entries(mc).sort(function (a, b) { return b[1] - a[1]; })[0][0];
      rows.forEach(function (r) {
        var dt = asDate(keyOf(r, 'Fecha de documento')); if (!dt || dt.getMonth() !== curM) return; curY = dt.getFullYear();
        var mo = num(keyOf(r, 'Monto Gs')), ds = fmtHoy(dt), aa = keyOf(r, 'Almacen');
        daily[ds] = (daily[ds] || 0) + mo;
        if (aa === 'LDAL') dailyf[ds] = (dailyf[ds] || 0) + mo; else if (aa === 'LDFA') dailyh[ds] = (dailyh[ds] || 0) + mo;
        var cf = (keyOf(r, 'Clase Factura') || '').toString().trim().toUpperCase();
        var cd = (keyOf(r, 'Clase de documento') || '').toString().trim().toUpperCase();
        if (DEVCF.indexOf(cf) >= 0 || DEVCD.indexOf(cd) >= 0) dev += mo; else bruta += mo;
        var an = XALM[aa] || aa || 'Otros'; alm[an] = (alm[an] || 0) + mo;
      });
      d.cur_month = curM + 1; d.cur_year = curY;
      var srt = function (o) { return Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }); };
      d.daily = srt(daily); d.daily_fer = srt(dailyf); d.daily_hie = srt(dailyh);
      d.fact_almacen = alm; d.devoluciones = dev; d.fact_bruta = bruta;
      d.v2026[curM] = d.daily.reduce(function (a, x) { return a + x[1]; }, 0);
      d.v2026_fer[curM] = d.daily_fer.reduce(function (a, x) { return a + x[1]; }, 0);
      d.v2026_hie[curM] = d.daily_hie.reduce(function (a, x) { return a + x[1]; }, 0);
      var lastb = function (lst) { var b = lst.filter(function (x) { var w = dOf(x[0]).getDay(); return w !== 0 && w !== 6; }); return b.length ? b[b.length - 1] : null; };
      var lb = lastb(d.daily); if (lb) { d.last_bd_cur = lb[1]; d.last_bd_date = lb[0]; }
      // año anterior mismo mes, último día hábil, por grupo
      var pd = { tot: {}, fer: {}, hie: {} };
      hrows.forEach(function (r) {
        var dt = asDate(keyOf(r, 'Fecha de facturacion')); if (!dt) return;
        if (dt.getFullYear() === curY - 1 && dt.getMonth() === curM) {
          var ds = fmtHoy(dt), mo = num(keyOf(r, 'Monto')), code = (keyOf(r, 'Almacen_codigo') || '').toString().trim();
          pd.tot[ds] = (pd.tot[ds] || 0) + mo;
          if (code === 'Alas') pd.fer[ds] = (pd.fer[ds] || 0) + mo; else if (code === 'Alas Dep. Fabric') pd.hie[ds] = (pd.hie[ds] || 0) + mo;
        }
      });
      var lastPrev = function (o) { var b = Object.keys(o).sort().filter(function (ds) { var w = dOf(ds).getDay(); return w !== 0 && w !== 6; }); return b.length ? o[b[b.length - 1]] : 0; };
      d.last_bd_prevyear = lastPrev(pd.tot); d.last_bd_prevyear_fer = lastPrev(pd.fer); d.last_bd_prevyear_hie = lastPrev(pd.hie);
    }
    // PEDIDOS
    var ps = S('BASE PEDIDOS PEND. DE FACTURAR');
    if (ps) {
      var prows = XLSX.utils.sheet_to_json(ps).filter(function (r) { return keyOf(r, 'Doc.vtas.') != null && keyOf(r, 'Doc.vtas.') !== ''; });
      var lines = [];
      prows.forEach(function (r) {
        var doc = String(keyOf(r, 'Doc.vtas.'));
        var fe = asDate(keyOf(r, 'Fecha Entrega')), fes = fe ? fmtHoy(fe) : '';
        var alm2 = PALM[keyOf(r, 'Almacén')] || 'Sin asignar';
        var hh = hourOf(keyOf(r, 'Hora Creac. De Ped.'));
        var total = num(keyOf(r, 'Total')), peso = num(keyOf(r, 'Peso'));
        var vext = (keyOf(r, 'Nombre Ext') || 'Sin asignar').toString();
        var vint = (keyOf(r, 'Nombre Int') || 'Sin asignar').toString();
        var et = (keyOf(r, 'Etapa del pedido') || 'Sin etapa').toString().trim();
        var mp = (keyOf(r, 'Material de produccion') || '').toString().trim().toUpperCase();
        var prod = mp === 'ALAS' ? 'Producción Alas' : (mp === 'IMPORTADO' ? 'Importados' : 'Sin clasificar');
        lines.push([alm2, et, vext, vint, fes, hh, peso, total, prod, doc]);
      });
      d.ped_lines = lines;
    }
    d._stamp = Date.now();
    return d;
  }

  /* ============================================================
   * GRÁFICOS
   * ========================================================== */
  var AZ = '#1466B0', AZ2 = '#3B8FD4', GRAY = '#B8C4D0';
  function chartsReady() { return typeof Chart !== 'undefined'; }
  function mk(id, cfg) { if (!chartsReady()) return; if (charts[id]) charts[id].destroy(); var c = document.getElementById(id); if (c) charts[id] = new Chart(c, cfg); }
  function killCharts() { Object.keys(charts).forEach(function (k) { try { charts[k].destroy(); } catch (e) {} }); charts = {}; }
  if (chartsReady()) { Chart.defaults.font.family = "'Inter',system-ui,sans-serif"; Chart.defaults.font.size = 11; Chart.defaults.color = '#5B6B7C'; }
  var gsTick = { callback: function (v) { return fmtM(v); } };

  /* ============================================================
   * NAV / ROUTER
   * ========================================================== */
  function setNav(v) {
    qa('[data-nav]').forEach(function (b) {
      var on = b.dataset.nav === v, was = b.classList.contains('is-active');
      b.classList.toggle('is-active', on);
      if (on && !was && window.gsap) { var ic = b.querySelector('.nav-btn__ico'); if (ic) gsap.fromTo(ic, { scale: .7 }, { scale: 1, duration: .4, ease: 'back.out(2.2)', clearProps: 'transform' }); }
    });
  }
  function go(view) {
    currentView = view; setNav(view); killCharts();
    if (!D) { renderEmpty(); return; }
    if (view === 'principal') renderPrincipal();
    else if (view === 'mesames') renderMesAMes();
    else if (view === 'pedidos') renderPedidos();
    else if (view === 'config') renderConfig();
    var stage = q('#stage');
    if (window.gsap && stage) gsap.from(stage.children, { opacity: 0, y: 12, duration: .38, stagger: .05, ease: 'power2.out', clearProps: 'all' });
  }

  /* ── Navegador de mes (solo meses con snapshot en la nube) ── */
  function monthsList() { return availableMonths.length ? availableMonths : [{ anio: D.cur_year, mes: D.cur_month }]; }
  function monthNavHtml() {
    var months = monthsList();
    var idx = months.findIndex(function (m) { return m.anio === D.cur_year && m.mes === D.cur_month; });
    if (idx < 0) idx = months.length - 1;
    return '<div class="mnav">' +
      '<button class="mnav__btn" id="mnPrev"' + (idx > 0 ? '' : ' disabled') + ' title="Mes anterior">‹</button>' +
      '<span class="mnav__cur">' + esc(MESES[D.cur_month - 1] + ' ' + D.cur_year) + '</span>' +
      '<button class="mnav__btn" id="mnNext"' + (idx < months.length - 1 ? '' : ' disabled') + ' title="Mes siguiente">›</button></div>';
  }
  function wireMonthNav(scope) {
    var months = monthsList();
    var idx = months.findIndex(function (m) { return m.anio === D.cur_year && m.mes === D.cur_month; });
    var p = q('#mnPrev', scope), n = q('#mnNext', scope);
    if (p) p.addEventListener('click', function () { if (idx > 0) gotoMonth(months[idx - 1]); });
    if (n) n.addEventListener('click', function () { if (idx < months.length - 1) gotoMonth(months[idx + 1]); });
  }
  function gotoMonth(m) {
    if (!m || (m.anio === D.cur_year && m.mes === D.cur_month)) return;
    if (!(window.TableroDB && TableroDB.ready)) { toast('Sin conexión para cambiar de mes', true); return; }
    TableroDB.pullSnapshotFor(m.anio, m.mes).then(function (row) {
      if (!row || !row.snapshot) { toast('No hay datos de ese mes', true); return; }
      D = row.snapshot; dataOrigin = 'nube'; updatedInfo = { updated_at: row.updated_at, updated_by: row.updated_by };
      hoyOverride = null; renderPrincipal();
    }).catch(function () { toast('No se pudo cargar el mes', true); });
  }

  /* ── Barra de acciones (estado + actualizar) reutilizable ── */
  function actionsHtml() {
    var estado = dataOrigin === 'actualizado' ? 'Base actualizada' : (dataOrigin === 'guardado' ? 'Datos guardados (local)' : 'Datos en la nube');
    if (updatedInfo && updatedInfo.updated_at) { var dt = new Date(updatedInfo.updated_at); estado += ' · ' + pad(dt.getDate()) + '/' + pad(dt.getMonth() + 1) + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()); }
    var h = '<span class="estado-chip ' + (dataOrigin === 'guardado' ? 'warn' : '') + '"><span class="dot"></span>' + esc(estado) + '</span>';
    if (isAdmin()) h += '<button class="btn btn--primary btn--sm" id="btnActualizar">' + IC.upload + ' Actualizar base</button>';
    return h;
  }
  function wireActions(scope) {
    var b = q('#btnActualizar', scope);
    if (b) b.addEventListener('click', function () { q('#fileBase').click(); });
  }

  /* ============================================================
   * VISTA: vacío
   * ========================================================== */
  function renderEmpty() {
    q('#stage').innerHTML =
      '<div class="view-hd"><div class="hd-titlewrap"><h2>Tablero de Facturación Diaria</h2><span class="sub">Sin datos cargados todavía</span></div><span class="spacer"></span>' + actionsHtml() + '</div>' +
      '<div class="empty">' + IC.empty +
      '<h3>Todavía no hay una base cargada</h3>' +
      '<p>' + (isAdmin() ? 'Subí la planilla SAP (Excel) para generar el tablero. Se publicará para todo el equipo.' : 'Pedile a un administrador que cargue la base de facturación.') + '</p>' +
      (isAdmin() ? '<button class="btn btn--primary" id="btnActualizar2">' + IC.upload + ' Subir base (Excel)</button>' : '') +
      '</div>';
    wireActions(q('#stage'));
    var b2 = q('#btnActualizar2'); if (b2) b2.addEventListener('click', function () { q('#fileBase').click(); });
  }

  /* ============================================================
   * VISTA: PRINCIPAL
   * ========================================================== */
  function renderPrincipal() {
    var k = kpis(SCOPE), S = scoped(SCOPE);
    var av = pct(k.fact, k.meta), falta = k.meta - k.fact;
    var pv = pct(k.proyMes, k.meta), av2 = pct(k.proyAnio, k.metaAnual);
    var g = pedResumen(SCOPE);
    var kcard = function (h, v, sub, chip) {
      return '<div class="kcard"><div class="kcard__h">' + esc(h) + '</div>' +
        '<div class="kcard__v"><span class="u">₲</span>' + v + '</div>' +
        (chip ? '<span class="chip ' + chip.cls + '">' + chip.txt + '</span>' : '') +
        (sub ? '<div class="kcard__sub">' + sub + '</div>' : '') + '</div>';
    };
    q('#stage').innerHTML =
      '<div class="view-hd"><div class="hd-titlewrap"><h2>Facturación diaria</h2><span class="sub">' + esc(D.meses[k.mi] + ' ' + k.y + ' ' + k.label) + '</span></div>' +
      monthNavHtml() +
      '<span class="segset" id="scopeSeg"><button class="segset__btn' + (SCOPE === 'tot' ? ' on' : '') + '" data-s="tot">Total</button><button class="segset__btn' + (SCOPE === 'fer' ? ' on' : '') + '" data-s="fer">Ferretería</button><button class="segset__btn' + (SCOPE === 'hie' ? ' on' : '') + '" data-s="hie">Hierros</button></span>' +
      '<span class="spacer"></span>' + actionsHtml() + '</div>' +
      // meta hero
      '<div class="metahero"><div class="gauge-wrap"><canvas id="gauge" width="170" height="170"></canvas><div class="gpct"><b>' + av.toFixed(1) + '%</b><span>de la meta</span></div></div>' +
      '<div class="metahero__r"><h3>Meta del mes</h3><div class="metahero__meta">₲ ' + fmt(k.meta) + '</div>' +
      '<div class="mbar"><span style="width:' + Math.min(av, 100) + '%"></span></div>' +
      '<div class="metahero__foot"><span>Facturado ₲ ' + fmt(k.fact) + '</span><span>' + (falta > 0 ? 'Falta ₲ ' + fmt(falta) : 'Superada +₲ ' + fmt(-falta)) + '</span></div></div></div>' +
      // KPI grid
      '<div class="kgrid" style="margin-top:16px">' +
      kcard('Proyección fin de mes', fmt(k.proyMes), 'Ritmo diario × días hábiles', { cls: (pv >= 100 ? 'up' : pv >= 90 ? 'flat' : 'down'), txt: arrow(pv - 100) + ' ' + pv.toFixed(1) + '% de la meta' }) +
      kcard('Último día hábil', fmt(k.lastCur), 'Año anterior: ₲ ' + fmt(k.prev) + (k.lastDate ? ' · ' + k.lastDate : ''), { cls: chipCls(k.varDia), txt: arrow(k.varDia) + ' ' + fp(k.varDia) }) +
      kcard('Facturado ' + D.meses[k.mi], fmt(k.fact), D.meses[k.mi] + ' ' + (k.y - 1) + ': ₲ ' + fmt(k.mesYoY), { cls: chipCls(k.varYoY), txt: arrow(k.varYoY) + ' ' + fp(k.varYoY) + ' interanual' }) +
      kcard('Proyección fin de año', fmt(k.proyAnio), 'Meta anual ₲ ' + fmt(k.metaAnual), { cls: (av2 >= 100 ? 'up' : av2 >= 90 ? 'flat' : 'down'), txt: arrow(av2 - 100) + ' ' + av2.toFixed(1) + '%' }) +
      '<div class="kcard"><div class="kcard__h">Días hábiles</div><div class="kcard__v">' + k.bd_el + ' <span class="u">/</span>' + k.bd_tot + '</div><div class="kcard__sub">Faltan ' + k.bd_rest + ' días hábiles</div></div>' +
      '<div class="kcard kcard--brand"><div class="kcard__h">Pedidos pendientes</div><div class="kcard__v"><span class="u">₲</span>' + fmt(g.total) + '</div><div class="kcard__sub">' + fmt(g.pedidos) + ' pedidos · ' + fmt(g.lineas) + ' líneas</div></div>' +
      '</div>' +
      // detalle
      '<div class="grid g2" style="margin-top:16px">' +
      '<div class="panel"><h3 class="panel__h">Facturación diaria del mes</h3><div class="tbl-scroll" id="dailyTbl"></div></div>' +
      '<div class="panel"><h3 class="panel__h">Facturación por almacén</h3><div id="almBox"></div></div>' +
      '</div>';

    // gauge
    mk('gauge', { type: 'doughnut', data: { datasets: [{ data: [Math.min(av, 100), Math.max(0, 100 - av)], backgroundColor: ['#fff', 'rgba(255,255,255,.22)'], borderWidth: 0, circumference: 360, cutout: '78%' }] }, options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { animateRotate: true } } });

    // daily table
    var UMBRAL = 2e9, h = '<table class="dtable"><thead><tr><th>Día</th><th class="r">Facturación ₲</th></tr></thead><tbody>', tt = 0;
    S.daily.forEach(function (x) { var ds = x[0], v = x[1]; tt += v; var wd = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'][dOf(ds).getDay()]; h += '<tr class="' + (v >= UMBRAL ? 'green' : '') + '"><td>' + ds.slice(8) + '/' + ds.slice(5, 7) + ' · ' + wd + '</td><td class="r">' + fmt(v) + '</td></tr>'; });
    h += '<tr class="tot"><td>Total del mes</td><td class="r">' + fmt(tt) + '</td></tr></tbody></table>';
    q('#dailyTbl').innerHTML = h;

    // almacén bars
    var ab = q('#almBox'), entries = Object.keys(D.fact_almacen).map(function (kk) { return [kk, D.fact_almacen[kk]]; });
    var pos = entries.filter(function (e) { return e[1] >= 0; }).sort(function (a, b) { return b[1] - a[1]; });
    var negSum = entries.filter(function (e) { return e[1] < 0; }).reduce(function (a, e) { return a + e[1]; }, 0);
    var rws = pos.slice(); if (negSum < 0) rws.push(['Devoluciones (depósitos)', negSum]);
    var maxA = Math.max.apply(null, rws.map(function (e) { return Math.abs(e[1]); }).concat([1]));
    var ah = '';
    rws.forEach(function (e) { var n = e[0], v = e[1], w = Math.abs(v) / maxA * 100; ah += '<div class="almrow"><div class="almrow__top"><span>' + esc(n) + '</span><b style="color:' + (v < 0 ? 'var(--neg)' : 'var(--alas-text-1)') + '">₲ ' + fmt(v) + '</b></div><div class="almbar"><span class="' + (v < 0 ? 'neg' : '') + '" style="width:' + w + '%"></span></div></div>'; });
    var neta = entries.reduce(function (a, e) { return a + e[1]; }, 0);
    ah += '<div class="alm-foot"><div class="r"><b>Facturación neta</b><b>₲ ' + fmt(neta) + '</b></div><div class="r" style="color:var(--alas-text-3)"><span>Incluye NC/devol. facturadas (ZDEV·ZDCS·ZNCV)</span><span style="color:var(--neg);font-weight:700">₲ ' + fmt(D.devoluciones || 0) + '</span></div></div>';
    ab.innerHTML = ah;

    // wiring
    wireActions(q('#stage'));
    wireMonthNav(q('#stage'));
    qa('#scopeSeg .segset__btn').forEach(function (b) { b.addEventListener('click', function () { if (SCOPE === b.dataset.s) return; SCOPE = b.dataset.s; renderPrincipal(); }); });
  }

  /* ============================================================
   * VISTA: MES A MES
   * ========================================================== */
  function renderMesAMes() {
    q('#stage').innerHTML =
      '<div class="view-hd"><div class="hd-titlewrap"><h2>Mes a mes &amp; tendencias</h2><span class="sub">2025 vs 2026 · metas</span></div>' +
      '<span class="segset" id="mmScope"><button class="segset__btn' + (mesScope === 'tot' ? ' on' : '') + '" data-s="tot">Total</button><button class="segset__btn' + (mesScope === 'fer' ? ' on' : '') + '" data-s="fer">Ferretería</button><button class="segset__btn' + (mesScope === 'hie' ? ' on' : '') + '" data-s="hie">Hierros</button></span></div>' +
      '<div class="grid g2"><div class="panel"><h3 class="panel__h">Facturación mensual</h3><div class="chartbox"><canvas id="chTrend"></canvas></div></div>' +
      '<div class="panel"><h3 class="panel__h">Acumulado del año</h3><div class="chartbox"><canvas id="chAcum"></canvas></div></div></div>' +
      '<div class="panel" style="margin-top:16px"><h3 class="panel__h">Detalle acumulado por mes</h3><div class="tbl-scroll"><table class="dtable" id="tblMM"><thead><tr><th>Mes</th><th class="r">Acum. 2025</th><th class="r">Acum. 2026</th><th class="r">Var.</th><th class="r">Meta mes</th><th class="r">Cumpl.</th></tr></thead><tbody></tbody></table></div></div>';

    var S = scoped(mesScope), meses3 = D.meses.map(function (m) { return m.slice(0, 3); });
    var v25 = S.v25, v26 = S.v26.map(function (v) { return v || null; });
    mk('chTrend', { type: 'line', data: { labels: meses3, datasets: [
      { label: '2025', data: v25, borderColor: GRAY, backgroundColor: 'transparent', borderWidth: 2, tension: .35, pointRadius: 2, borderDash: [5, 4] },
      { label: '2026', data: v26, borderColor: AZ, backgroundColor: 'rgba(20,102,176,.08)', borderWidth: 3, fill: true, tension: .35, pointRadius: 3 }
    ] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ₲ ' + fmt(c.raw); } } } }, scales: { y: { ticks: gsTick, grid: { color: '#EEF2F7' } }, x: { grid: { display: false } } } } });
    var a25 = 0, a26 = 0, ac25 = [], ac26 = [];
    for (var i = 0; i < 12; i++) { a25 += v25[i]; ac25.push(a25); if (v26[i] != null) { a26 += v26[i]; ac26.push(a26); } else ac26.push(null); }
    mk('chAcum', { type: 'line', data: { labels: meses3, datasets: [
      { label: 'Acum. 2025', data: ac25, borderColor: GRAY, borderWidth: 2, tension: .3, pointRadius: 0, borderDash: [5, 4] },
      { label: 'Acum. 2026', data: ac26, borderColor: AZ, backgroundColor: 'rgba(20,102,176,.10)', fill: true, borderWidth: 3, tension: .3, pointRadius: 2 }
    ] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ₲ ' + fmt(c.raw); } } } }, scales: { y: { ticks: gsTick, grid: { color: '#EEF2F7' } }, x: { grid: { display: false } } } } });

    var meta = S.meta, tb = q('#tblMM tbody'), html = ''; a25 = 0; a26 = 0;
    for (var j = 0; j < 12; j++) {
      var has = v26[j] != null; a25 += v25[j]; if (has) a26 += v26[j];
      var va = has ? pct(a26 - a25, a25) : null, cu = has ? pct(v26[j], meta[j]) : null;
      html += '<tr><td>' + D.meses[j] + '</td><td class="r">' + fmt(a25) + '</td><td class="r">' + (has ? fmt(a26) : '–') + '</td>' +
        '<td class="r ' + (va > 0 ? 'pos' : 'neg') + '">' + (has ? fp(va) : '–') + '</td><td class="r mini">' + fmt(meta[j]) + '</td>' +
        '<td class="r ' + (cu >= 100 ? 'pos' : cu >= 90 ? '' : 'neg') + '">' + (has ? cu.toFixed(0) + '%' : '–') + '</td></tr>';
    }
    var totM = meta.reduce(function (a, b) { return a + b; }, 0);
    html += '<tr class="tot"><td>TOTAL</td><td class="r">' + fmt(a25) + '</td><td class="r">' + fmt(a26) + '</td><td class="r">' + fp(pct(a26 - a25, a25)) + '</td><td class="r">' + fmt(totM) + '</td><td class="r">' + pct(a26, totM).toFixed(0) + '%</td></tr>';
    tb.innerHTML = html;

    qa('#mmScope .segset__btn').forEach(function (b) { b.addEventListener('click', function () { if (mesScope === b.dataset.s) return; mesScope = b.dataset.s; renderMesAMes(); }); });
  }

  /* ============================================================
   * VISTA: PEDIDOS
   * ========================================================== */
  function renderPedidos() {
    var alms = D.ped_lines.reduce(function (a, l) { if (a.indexOf(l[0]) < 0) a.push(l[0]); return a; }, []);
    var ets = D.ped_lines.reduce(function (a, l) { if (a.indexOf(l[1]) < 0) a.push(l[1]); return a; }, []);
    var views = [['almacen', 'Por almacén'], ['vext', 'Vendedor externo'], ['vint', 'Vendedor interno'], ['prod', 'Prod./Import'], ['fecha', 'Por fecha'], ['hora', 'Por hora'], ['peso', 'Por peso'], ['etapa', 'Por etapa']];
    q('#stage').innerHTML =
      '<div class="view-hd"><div class="hd-titlewrap"><h2>Pedidos pendientes de facturar</h2><span class="sub" id="pedSub"></span></div></div>' +
      '<div class="kgrid" style="margin-bottom:16px">' +
      '<div class="kcard"><div class="kcard__h">Líneas</div><div class="kcard__v" id="p2Lin">–</div></div>' +
      '<div class="kcard"><div class="kcard__h">Pedidos</div><div class="kcard__v" id="p2Ped">–</div></div>' +
      '<div class="kcard kcard--brand"><div class="kcard__h">Monto total</div><div class="kcard__v"><span class="u">₲</span><span id="p2Tot">–</span></div></div>' +
      '<div class="kcard"><div class="kcard__h">Peso total</div><div class="kcard__v" id="p2Peso">–<span class="u"> kg</span></div></div></div>' +
      '<div class="view-hd" style="margin-bottom:14px"><div class="pillset" id="pedPills">' + views.map(function (v) { return '<button class="pill' + (pedView === v[0] ? ' on' : '') + '" data-v="' + v[0] + '">' + v[1] + '</button>'; }).join('') + '</div>' +
      '<span class="spacer"></span>' +
      '<select class="sel" id="fAlm" style="height:34px"></select><select class="sel" id="fEt" style="height:34px"></select></div>' +
      '<div class="grid g2"><div class="panel"><h3 class="panel__h" id="pedChTitle"></h3><div class="chartbox"><canvas id="chPed"></canvas></div></div>' +
      '<div class="panel"><h3 class="panel__h" id="pedTblTitle"></h3><div class="tbl-scroll" id="pedTblBox"></div></div></div>';

    var fa = q('#fAlm'), fe = q('#fEt');
    fa.innerHTML = '<option value="todos">Todos los almacenes</option>' + alms.map(function (a) { return '<option value="' + esc(a) + '">' + esc(a) + '</option>'; }).join('');
    fe.innerHTML = '<option value="todos">Todas las etapas</option>' + ets.map(function (e) { return '<option value="' + esc(e) + '">' + esc(e) + '</option>'; }).join('');
    fa.value = fAlm; fe.value = fEt;
    fa.addEventListener('change', function (e) { fAlm = e.target.value; fillPedidos(); });
    fe.addEventListener('change', function (e) { fEt = e.target.value; fillPedidos(); });
    qa('#pedPills .pill').forEach(function (b) { b.addEventListener('click', function () { if (pedView === b.dataset.v) return; qa('#pedPills .pill').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); pedView = b.dataset.v; fillPedidos(); }); });
    fillPedidos();
  }
  function fillPedidos() {
    var L = pedFiltered(), total = 0, peso = 0, docs = {};
    L.forEach(function (l) { total += l[7]; peso += l[6]; docs[l[9]] = 1; });
    q('#pedSub').textContent = fmt(L.length) + ' líneas · ' + fmt(Object.keys(docs).length) + ' pedidos';
    q('#p2Lin').textContent = fmt(L.length); q('#p2Ped').textContent = fmt(Object.keys(docs).length);
    q('#p2Tot').textContent = fmt(total); q('#p2Peso').firstChild.textContent = fmt(peso);
    var cfg = pedDef[pedView], rows = cfg.rows(L);
    q('#pedChTitle').textContent = cfg.title;
    q('#pedTblTitle').textContent = 'Detalle · ' + cfg.title.toLowerCase();
    var labels = rows.map(function (r) { return r[0]; }), vals = rows.map(function (r) { return r[1]; });
    if (cfg.bar) {
      mk('chPed', { type: 'bar', data: { labels: labels, datasets: [{ data: vals, backgroundColor: AZ, borderRadius: 3 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return '₲ ' + fmt(c.raw); } } } }, scales: { y: { ticks: gsTick, grid: { color: '#EEF2F7' } }, x: { grid: { display: false }, ticks: { maxRotation: 60, autoSkip: true, maxTicksLimit: 16 } } } } });
    } else {
      var pal = ['#1466B0', '#E8833A', '#2BA84A', '#C0392B', '#8E5FBF', '#0FA3A3', '#D64C8B', '#8C9440', '#E0B33A', '#4A90D9', '#B5651D', '#3FA796', '#9B4DCA', '#DE6449', '#6C7A89', '#0B4F8A'];
      mk('chPed', { type: 'doughnut', data: { labels: labels, datasets: [{ data: vals.map(function (v) { return Math.abs(v); }), backgroundColor: pal, borderWidth: 2, borderColor: '#fff' }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 11, font: { size: 11 } } }, tooltip: { callbacks: { label: function (c) { return c.label + ': ₲ ' + fmt(c.raw); } } } }, cutout: '55%' } });
    }
    var hh = '<table class="dtable"><thead><tr>' + cfg.cols.map(function (c) { return '<th class="' + (c && c !== cfg.cols[0] ? 'r' : '') + '">' + c + '</th>'; }).join('') + '</tr></thead><tbody>', tt = 0, tp = 0, tl = 0;
    rows.forEach(function (r) { tt += r[1] || 0; tp += r[2] || 0; tl += r[3] || 0; hh += '<tr><td>' + esc(r[0]) + '</td><td class="r">' + fmt(r[1]) + '</td><td class="r">' + (r[2] == null ? '' : fmt(r[2])) + '</td><td class="r">' + fmt(r[3]) + '</td></tr>'; });
    hh += '<tr class="tot"><td>TOTAL</td><td class="r">' + fmt(tt) + '</td><td class="r">' + (cfg.cols[2] ? fmt(tp) : '') + '</td><td class="r">' + fmt(tl) + '</td></tr></tbody></table>';
    q('#pedTblBox').innerHTML = hh;
  }

  /* ============================================================
   * VISTA: CONFIG (días hábiles & feriados)
   * ========================================================== */
  function renderConfig() {
    var k = kpis('tot'), admin = isAdmin();
    q('#stage').innerHTML =
      '<div class="view-hd"><div class="hd-titlewrap"><h2>Días hábiles &amp; feriados</h2><span class="sub">' + esc(D.meses[k.mi] + ' ' + k.y) + '</span></div></div>' +
      '<div class="grid g2">' +
      '<div class="panel"><h3 class="panel__h">Días hábiles del mes</h3>' +
      '<div class="stat-row"><span class="k">Días del mes</span><span class="v">' + k.daysMonth + '</span></div>' +
      '<div class="stat-row"><span class="k">Fines de semana</span><span class="v">' + k.fds + ' días</span></div>' +
      '<div class="stat-row"><span class="k">Feriados</span><span class="v">' + k.fer + ' días</span></div>' +
      '<div class="stat-row"><span class="k">Días hábiles</span><span class="v">' + k.bd_tot + ' días</span></div>' +
      '<div class="stat-row"><span class="k">Transcurridos</span><span class="v">' + k.bd_el + ' días</span></div>' +
      '<div class="stat-row"><span class="k">Faltan</span><span class="v">' + k.bd_rest + ' días</span></div>' +
      '<div class="field" style="margin-top:16px"><label>Simular fecha de referencia (proyecciones)</label><div style="display:flex;gap:8px"><input type="date" class="inp" id="hoyInput" value="' + fmtHoy(hoyDate()) + '" style="flex:1"><button class="btn" id="btnHoy">Aplicar</button><button class="btn" id="btnHoyReset">Hoy</button></div></div>' +
      '</div>' +
      '<div class="panel"><h3 class="panel__h">Feriados' + (admin ? '' : ' (solo lectura)') + '</h3>' +
      (admin ? '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap"><div class="field" style="flex:1;min-width:130px"><label>Fecha</label><input type="date" class="inp" id="ferDate"></div><div class="field" style="flex:2;min-width:150px"><label>Descripción (opcional)</label><input type="text" class="inp" id="ferName" placeholder="Ej: Día del trabajador"></div><button class="btn btn--primary" id="btnAddFer">' + IC.plus + ' Agregar</button></div>' : '') +
      '<div class="fer-tags" id="ferList"></div>' +
      '<div class="note" style="margin-top:14px">Los feriados se descuentan de los días hábiles y recalculan las proyecciones para todo el equipo.</div>' +
      '</div></div>';

    renderFerList(admin);
    q('#btnHoy').addEventListener('click', function () { var v = q('#hoyInput').value; if (!v) { toast('Elegí una fecha', true); return; } hoyOverride = dOf(v); toast('Fecha de referencia aplicada'); renderConfig(); });
    q('#btnHoyReset').addEventListener('click', function () { hoyOverride = null; toast('Volviendo a la última fecha con datos'); renderConfig(); });
    if (admin) q('#btnAddFer').addEventListener('click', addFer);
  }
  function renderFerList(admin) {
    var list = q('#ferList'); if (!list) return;
    list.innerHTML = holidays.length ? holidays.map(function (h) {
      return '<span class="tag">' + esc(h.date) + (h.name ? ' · ' + esc(h.name) : '') + (admin ? ' <button data-delfer="' + esc(h.date) + '">×</button>' : '') + '</span>';
    }).join('') : '<span class="mini">Sin feriados cargados.</span>';
    qa('[data-delfer]', list).forEach(function (b) { b.addEventListener('click', function () { delFer(b.dataset.delfer); }); });
  }
  function addFer() {
    var d = q('#ferDate').value; if (!d) { toast('Elegí una fecha', true); return; }
    var n = q('#ferName').value.trim();
    if (holidays.some(function (h) { return h.date === d; })) { toast('Ese feriado ya está cargado', true); return; }
    holidays.push({ date: d, name: n }); holidays.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    renderConfig();
    if (window.TableroDB && TableroDB.ready) TableroDB.addFeriado(d, n).then(function () { toast('Feriado agregado'); }).catch(function () { toast('Guardado local (sin conexión)', true); });
    else toast('Feriado agregado (local)');
  }
  function delFer(fecha) {
    confirmPro({
      title: 'Quitar feriado', text: 'Se quitará <b>' + esc(fecha) + '</b> y se recalcularán las proyecciones.', danger: true, okLabel: 'Quitar', icon: IC.trash,
      onOk: function () {
        holidays = holidays.filter(function (h) { return h.date !== fecha; });
        renderConfig();
        if (window.TableroDB && TableroDB.ready) TableroDB.delFeriado(fecha).then(function () { toast('Feriado quitado'); }).catch(function () { toast('Error al quitar en la nube', true); });
        else toast('Feriado quitado');
      }
    });
  }

  /* ============================================================
   * CARGA DEL EXCEL (admin)
   * ========================================================== */
  function onFile(ev) {
    var f = ev.target.files[0]; if (!f) return;
    if (typeof XLSX === 'undefined') { toast('No se pudo cargar el lector de Excel', true); return; }
    var r = new FileReader();
    r.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        D = parseWB(wb);
        dataOrigin = 'actualizado'; updatedInfo = { updated_at: new Date().toISOString() };
        if (!availableMonths.some(function (m) { return m.anio === D.cur_year && m.mes === D.cur_month; })) {
          availableMonths.push({ anio: D.cur_year, mes: D.cur_month });
          availableMonths.sort(function (a, b) { return a.anio - b.anio || a.mes - b.mes; });
        }
        cacheSave();
        var user = (window.AlasAuthClient && AlasAuthClient.getCurrentUser && AlasAuthClient.getCurrentUser()) || null;
        if (window.TableroDB && TableroDB.ready) {
          TableroDB.pushSnapshot(D, user).then(function () { toast('Base actualizada y publicada · ' + MESES[D.cur_month - 1] + ' ' + D.cur_year); })
            .catch(function (err) { console.error(err); toast('Actualizada local, pero no se pudo publicar', true); });
        } else { toast('Base actualizada (local) · ' + MESES[D.cur_month - 1] + ' ' + D.cur_year); }
        go(currentView);
      } catch (err) { console.error(err); toast('No se pudo leer el archivo. Verificá que sea la planilla correcta.', true); }
    };
    r.readAsArrayBuffer(f); ev.target.value = '';
  }

  /* ── Cache local ── */
  function cacheSave() { try { localStorage.setItem(LS_KEY, JSON.stringify({ stamp: D._stamp || Date.now(), data: D })); } catch (e) {} }
  function cacheLoad() { try { var raw = localStorage.getItem(LS_KEY); if (raw) { var o = JSON.parse(raw); if (o && o.data) return o.data; } } catch (e) {} return null; }

  /* ============================================================
   * BOOT
   * ========================================================== */
  var _booted = false;
  function boot() {
    if (_booted) return; _booted = true;
    var fb = q('#fileBase'); if (fb) fb.addEventListener('change', onFile);
    qa('[data-nav]').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.nav); }); });

    var ready = window.TableroDB && TableroDB.ready;
    var feriadosP = ready ? TableroDB.pullFeriados() : Promise.resolve([]);
    var snapP = ready ? TableroDB.pullSnapshot() : Promise.resolve(null);
    var monthsP = ready ? TableroDB.listMonths() : Promise.resolve([]);

    Promise.all([feriadosP, snapP, monthsP]).then(function (res) {
      var fer = res[0] || [], snap = res[1];
      availableMonths = res[2] || [];
      holidays = fer.map(function (r) { return { date: r.fecha, name: r.descripcion || '' }; });
      if (snap && snap.snapshot) { D = snap.snapshot; dataOrigin = 'nube'; updatedInfo = { updated_at: snap.updated_at, updated_by: snap.updated_by }; }
      else { var c = cacheLoad(); if (c) { D = c; dataOrigin = 'guardado'; } }
    }).catch(function (e) { console.error('[Tablero] boot', e); var c = cacheLoad(); if (c) { D = c; dataOrigin = 'guardado'; } })
      .then(function () { go('principal'); });
  }

  window.__initTablero = boot;
  // Arranque idempotente: index.html también lo llama tras el SSO; el que gane, gana.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
