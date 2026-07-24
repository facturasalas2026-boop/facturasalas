/* ============================================================
   Control de Facturas — app.js
   PROTOTIPO LOCAL: datos de prueba + localStorage (sin SQL todavía).
   Cuando la lógica esté validada, se conecta a Supabase.
   ============================================================ */
(function () {
  'use strict';

  /* ── Datos de prueba (flota, repartidores, zonas) ──────── */
  var SEED_TS = [
    { id: 1, n: 'ALAS', trucks: ['ALAS HYUNDAI', 'ALAS Mercedes Benz 1315 BBH909B', 'ALAS Mercedes Benz 709 AADX129', 'ALAS Mercedes Benz 711 AOZ758', 'ALAS FUSO AADP885', 'ALAS Furgon-Foton'] },
    { id: 2, n: 'SL', trucks: ['SL MB814 AAVG562 (SIMPLE)', 'SL MB 914 HDJ075 CELESTE', 'SL MB814 BXC396 BLANCO (RAMPA)', 'SL SCANIA DOBLE EJE'] },
    { id: 3, n: 'BG', trucks: ['BG MOVIL 08 HFH-440', 'BG MOVIL 09 AYE-466', 'BG MOVIL 10 AAFI-477', 'BG MOVIL 11 BOZ-074', 'BG MOVIL 13 AAFL-766', 'BG MOVIL 14 XBL-816', 'BG MOVIL 21 BRX-972', 'BG MOVIL 25 AASI-849', 'BG MOVIL 26 AASM-682'] },
    { id: 4, n: 'CR', trucks: ['CR Scania 05 AAN498', 'CR Scania 06 HFR039', 'CR Scania 07 BRF403'] },
    { id: 5, n: 'TRANSMAQ ORTEGA', trucks: ['TRANSMAQ VOLKSWAGEN AHN624', 'TRANSMAQ-SEMI'] },
    { id: 6, n: 'ANTONIO BAEZ', trucks: ['Mercedes Benz Atego 815', 'ANTONIO BAEZ Scania HEU859 VERDE'] }
  ];
  (function () { var tid = 100; SEED_TS.forEach(function (t) { t.trucks = t.trucks.map(function (d) { return { id: ++tid, d: d }; }); }); })();

  var REPARTIDORES = ['TERCERIZADO', 'Adilson Galeano', 'Alberto Britez', 'Alejandro Alvarenga', 'Alexis Gimenez', 'Amilcar Garcia', 'Angel Zorrilla', 'Axel Mendieta', 'Candido Diaz', 'Carlos Barreto', 'Carlos Galeano', 'Carlos Penayo', 'Celso Gamarra', 'Cristhian Santa cruz', 'Cristhofer Castillo', 'Cristian Santacruz', 'Enrrique Arza', 'Francisco del Puerto', 'Francisco Rivas', 'Guillermo Mencia', 'Gustavo Benitez', 'Joel Benitez', 'Jorge Estigarribia', 'Juan Balmori', 'Julio Velilla', 'Lisandro Lopez', 'Lucas Maqueda', 'Maicol Benitez', 'Manuel Martinez', 'Marcos Aveiro', 'Nahuel Castillo', 'Nestor Miranda', 'Pedro Riveros', 'Reinaldo Ferreira', 'Sebastian Baez', 'Tomas Quiñonez', 'Tomas Bernal', 'Eugenio Villar', 'Angel Denis', 'JOSE SEGOVIA', 'JESUS ESCOBAR', 'ENZO RUFINELI', 'SERGIO AGUILERA', 'Denis GONZALEZ'];

  var ZONAS = [
    ['PR1 Asunción', 'Local'], ['PR2 Luque', 'Local'], ['PR3 San Lorenzo', 'Local'], ['PR4 Capiatá', 'Local'], ['PR5 Itauguá', 'Local'], ['PR5 Ypacaraí', 'Local'], ['PR6 Augusto Saldívar', 'Local'], ['PR6 Itá', 'Local'], ['PR7 Areguá', 'Local'], ['PR8 Limpio', 'Local'], ['PR8 Loma Pytá', 'Local'], ['PR8 M.R.A.', 'Local'], ['PR9 San Antonio', 'Local'], ['PR9 Ypané', 'Local'], ['PR9 Ñemby', 'Local'], ['PR10 Nueva Italia', 'Local'], ['PR10 Guarambaré', 'Local'], ['PR10 Villeta', 'Local'], ['PR11 Fernando de la Mora', 'Local'], ['PR11 Villa Elisa', 'Local'], ['PR12 Lambaré', 'Local'], ['PR13 Cordillera', 'Local'], ['PR14 Nanawa', 'Local'], ['PR14 Villa Hayes', 'Local'], ['PR15 Paraguarí', 'Local'],
    ['NORTE', 'Interior'], ['ESTE', 'Interior'], ['SUR', 'Interior'], ['CAAGUAZU', 'Interior'], ['CAAZAPA', 'Interior'], ['VILLARRICA', 'Interior'], ['CHACO', 'Interior']
  ].map(function (z) { return { nombre: z[0], categoria: z[1] }; });

  var TIPOS = ['CAPITAL', 'INTERIOR', 'SERVICIOS ADICIONALES'];
  var TIPO_ORDER = { 'CAPITAL': 0, 'INTERIOR': 1, 'SERVICIOS ADICIONALES': 2 };
  var TIPO_CAT = { 'CAPITAL': 'Local', 'INTERIOR': 'Interior' };

  /* ── Store local (localStorage) ────────────────────────── */
  var KEY = 'cf_store_v1';
  var DB = loadDB();
  function loadDB() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  function initDB() { if (!DB) DB = { seq: 1, planillas: [], repartos: [], facturas: [] }; if (!DB.facturas) DB.facturas = []; if (!DB.audit) DB.audit = []; }
  function saveLocal() { localStorage.setItem(KEY, JSON.stringify(DB)); }
  // save() = cache local inmediato + espejo en Supabase (si está disponible).
  function save() { saveLocal(); if (window.CFDB && CFDB.available) CFDB.sync(DB); }
  function nid() { return DB.seq++; }

  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  function curMonthKey() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function monthKey(iso) { return iso ? String(iso).slice(0, 7) : null; }
  function mesLabel(key) { var p = key.split('-'); return MESES[+p[1] - 1] + ' ' + p[0]; }
  function shiftMonth(key, delta) { var p = key.split('-'), d = new Date(+p[0], +p[1] - 1 + delta, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function curWeekKey() { return dISO(mondayOf(new Date())); }
  function weekEnd(mondayIso) { var p = mondayIso.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2] + 6); return dISO(d); }
  function weeksOfMonth(mesKey) {
    var p = mesKey.split('-'), y = +p[0], mo = +p[1] - 1, last = new Date(y, mo + 1, 0), weeks = [];
    for (var d = mondayOf(new Date(y, mo, 1)); d <= last; d.setDate(d.getDate() + 7)) {
      var s = dISO(d); weeks.push({ key: s, desde: s, hasta: weekEnd(s) });
    }
    return weeks;
  }
  function matchesFilter(iso) { if (!iso) return false; if (S.semana) return iso >= S.semana && iso <= weekEnd(S.semana); return monthKey(iso) === S.mes; }

  var S = { current: null, editReparto: null, step: 1, isNew: false, tsSel: null, mes: curMonthKey(), semana: curWeekKey(), facSearch: '', dashDim: 'transportista', dashYearMetric: 'precio', _view: null, _dir: 0, _animHd: true };

  /* ── Animación central (GSAP) ─────────────────────────── */
  // Entrada orquestada del encabezado de vista (solo al cambiar de apartado, no en re-renders internos)
  function animHeader(scope) {
    if (!S._animHd) return; S._animHd = false;
    if (!window.gsap) return;
    var hd = scope.querySelector('.view-hd');
    if (hd) gsap.from(hd.children, { opacity: 0, y: -14, duration: .42, stagger: .05, ease: 'power3.out', clearProps: 'all' });
    var chips = scope.querySelectorAll('.wkbar > *');
    if (chips.length) gsap.from(chips, { opacity: 0, y: 8, scale: .92, duration: .32, stagger: .025, delay: .1, ease: 'back.out(1.6)', clearProps: 'all' });
  }
  function animEmpty(host) { if (window.gsap && host.firstElementChild) gsap.from(host.firstElementChild, { opacity: 0, y: 12, scale: .98, duration: .4, ease: 'power2.out', clearProps: 'all' }); }
  // Números que cuentan hacia su valor (marcar con data-n y opcional data-pre)
  function countUp(elm, n, pre) {
    if (!window.gsap || !(n > 0)) { elm.textContent = (pre || '') + fmtGs(n); return; }
    var o = { v: 0 };
    gsap.to(o, { v: n, duration: .7, ease: 'power2.out', onUpdate: function () { elm.textContent = (pre || '') + fmtGs(Math.round(o.v)); } });
  }
  function countUpAll(scope) { (scope || document).querySelectorAll('[data-n]').forEach(function (b) { countUp(b, +b.dataset.n || 0, b.dataset.pre || ''); }); }
  function byTipo(a, b) { return (TIPO_ORDER[a] == null ? 9 : TIPO_ORDER[a]) - (TIPO_ORDER[b] == null ? 9 : TIPO_ORDER[b]); }
  // Solo se puede editar hasta que entra en auditoría (proceso/conciliada/diferencia son editables)
  function esEditable(p) { return !p || p.estado !== 'auditoria'; }
  // Estado guardado: 'abierta' | 'auditoria'. El estado MOSTRADO se deriva de la factura:
  //   proceso (sin factura) → conciliada (vinculada y coincide) → auditoria (enviada)
  //   diferencia = vinculada pero NO coincide (bloquea el envío a auditoría)
  function planillaStatus(p) {
    if (!p) return 'proceso';
    if (p.estado === 'auditoria') return 'auditoria';
    if (!p.factura_id) return 'proceso';
    var f = DB.facturas.find(function (x) { return x.id === p.factura_id; });
    if (!f) return 'proceso';
    return (Number(f.monto) || 0) === planillaTotals(p.id).precio ? 'conciliada' : 'diferencia';
  }
  var ST_LBL = { proceso: 'En proceso · cargando repartos', conciliada: 'Conciliada · lista para auditoría', diferencia: 'Con diferencia · revisá repartos o factura', auditoria: 'En auditoría · cerrada' };
  var ST_SHORT = { proceso: 'En proceso', conciliada: 'Conciliada', diferencia: 'Con diferencia', auditoria: 'En auditoría' };
  var ST_CLS = { proceso: 'st-open', conciliada: 'st-conc', diferencia: 'st-diff', auditoria: 'st-audit' };
  var ST_CHIP = { proceso: 'chip--open', conciliada: 'chip--lime', diferencia: 'chip--diff', auditoria: 'chip--dgreen' };
  var ST_PROG = {
    proceso:    { pct: 50,  cls: 'pg-blue',   label: 'En proceso' },
    conciliada: { pct: 75,  cls: 'pg-lime',   label: 'Conciliada', done: true },
    diferencia: { pct: 75,  cls: 'pg-red',    label: 'Con diferencia' },
    auditoria:  { pct: 100, cls: 'pg-dgreen', label: 'En auditoría', done: true }
  };

  /* ══════════ Auditoría + notificaciones (patrón Inventario) ══════════ */
  var ACC = {
    crear_planilla:   { dot: '#64748b', bg: '#f1f5f9', color: '#475569', label: 'Creó planilla' },
    add_reparto:      { dot: '#2563eb', bg: '#dbeafe', color: '#1d4ed8', label: 'Agregó reparto' },
    edit_reparto:     { dot: '#d97706', bg: '#fef3c7', color: '#b45309', label: 'Editó reparto' },
    del_reparto:      { dot: '#dc2626', bg: '#fee2e2', color: '#b91c1c', label: 'Borró reparto' },
    enviar_auditoria: { dot: '#4f46e5', bg: '#eef2ff', color: '#4338ca', label: 'Envió a auditoría' },
    factura_ok:       { dot: '#16a34a', bg: '#dcfce7', color: '#15803d', label: 'Factura conciliada' },
    factura_diff:     { dot: '#dc2626', bg: '#fee2e2', color: '#b91c1c', label: 'Factura con diferencia' },
    reabrir:          { dot: '#d97706', bg: '#fef3c7', color: '#b45309', label: 'Reabrió planilla' },
    borrar_planilla:  { dot: '#dc2626', bg: '#fee2e2', color: '#b91c1c', label: 'Borró planilla' },
    del_factura:      { dot: '#dc2626', bg: '#fee2e2', color: '#b91c1c', label: 'Eliminó factura' }
  };
  function currentUser() { try { var c = window.AlasAuthClient; if (c && c.isAuthenticated && c.getCurrentUser) return c.getCurrentUser() || 'Operador'; } catch (e) {} return 'Operador'; }
  function logAudit(accion, detalle, chips, planillaId) {
    DB.audit.push({ id: nid(), ts: new Date().toISOString(), accion: accion, usuario: currentUser(), detalle: detalle || '', chips: chips || [], planilla_id: planillaId || null });
    save(); refreshNotifBadge();
  }
  function timeAgo(iso) { if (!iso) return ''; var s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000); if (s < 60) return 'recién'; var m = Math.floor(s / 60); if (m < 60) return 'hace ' + m + ' min'; var h = Math.floor(m / 60); if (h < 24) return 'hace ' + h + ' h'; var d = Math.floor(h / 24); return 'hace ' + d + ' día' + (d > 1 ? 's' : ''); }
  function fmtHora(iso) { var d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  var NOTIF = { key: 'cf_notif_seen', open: false };
  function unseenCount() { var seen = localStorage.getItem(NOTIF.key) || ''; return DB.audit.filter(function (a) { return a.ts > seen; }).length; }
  function refreshNotifBadge() {
    var b = document.getElementById('notifBadge'); if (!b) return;
    var n = unseenCount();
    if (n > 0) {
      var txt = n > 9 ? '9+' : String(n), changed = b.hidden || b.textContent !== txt;
      b.textContent = txt; b.hidden = false;
      if (changed && window.gsap) gsap.fromTo(b, { scale: .4 }, { scale: 1, duration: .45, ease: 'back.out(2.6)', clearProps: 'transform' });
    } else { b.hidden = true; }
  }
  function notifItemHtml(a) {
    var c = ACC[a.accion] || { dot: '#94a3b8', bg: '#f1f5f9', color: '#475569', label: a.accion };
    return '<div class="notif-item"><span class="notif-dot" style="background:' + c.dot + '"></span>' +
      '<div class="notif-item__body"><div class="notif-item__txt"><b>' + esc(a.usuario) + '</b> · ' + esc(a.detalle || c.label) + '</div>' +
      '<div class="notif-meta"><span class="notif-tag" style="background:' + c.bg + ';color:' + c.color + '">' + esc(c.label) + '</span>' +
      '<span class="notif-time">' + timeAgo(a.ts) + '</span></div></div></div>';
  }
  function ensureNotifDD() {
    var dd = document.getElementById('notifDD'); if (dd) return dd;
    dd = el('<div class="notif-dd" id="notifDD"><div class="notif-dd__hd">Notificaciones</div><div class="notif-dd__body" id="notifBody"></div></div>');
    document.body.appendChild(dd);
    document.addEventListener('click', function (e) { if (NOTIF.open && !e.target.closest('#notifDD') && !e.target.closest('#btnNotif')) closeNotif(); });
    return dd;
  }
  function toggleNotif() { if (NOTIF.open) closeNotif(); else openNotif(); }
  function openNotif() {
    var dd = ensureNotifDD(), btn = document.getElementById('btnNotif');
    var body = document.getElementById('notifBody');
    var list = DB.audit.slice().sort(function (a, b) { return b.ts.localeCompare(a.ts); }).slice(0, 30);
    body.innerHTML = list.length ? list.map(notifItemHtml).join('') : '<div class="notif-empty">Sin actividad todavía</div>';
    var r = btn.getBoundingClientRect(), w = 340;
    dd.style.left = Math.max(12, r.right - w) + 'px'; dd.style.top = (r.bottom + 8) + 'px'; dd.style.bottom = 'auto';
    dd.classList.add('is-open'); NOTIF.open = true;
    localStorage.setItem(NOTIF.key, new Date().toISOString()); refreshNotifBadge();
    if (window.gsap) {
      gsap.fromTo(dd, { opacity: 0, y: -8, scale: .98 }, { opacity: 1, y: 0, scale: 1, duration: .24, ease: 'back.out(1.5)', clearProps: 'transform' });
      gsap.from(dd.querySelectorAll('.notif-item'), { opacity: 0, x: -10, duration: .26, stagger: .03, delay: .08, ease: 'power2.out', clearProps: 'all' });
    }
  }
  function closeNotif() {
    var dd = document.getElementById('notifDD'); NOTIF.open = false;
    if (!dd) return;
    if (window.gsap) gsap.to(dd, { opacity: 0, y: -6, scale: .98, duration: .16, ease: 'power2.in', onComplete: function () { dd.classList.remove('is-open'); gsap.set(dd, { clearProps: 'all' }); } });
    else dd.classList.remove('is-open');
  }

  /* ── Vista AUDITORÍA (timeline por día) ── */
  function renderAuditoria() {
    var stage = q('#stage');
    var list = DB.audit.slice().sort(function (a, b) { return b.ts.localeCompare(a.ts); });
    stage.innerHTML = '<div class="view-hd"><h2>Auditoría</h2><span class="count-badge">' + list.length + '</span><div class="spacer"></div>' + bellHtml() + '</div><div id="auditHost"></div>';
    wireBell();
    animHeader(stage);
    var host = q('#auditHost');
    if (!list.length) { host.innerHTML = '<div class="empty-mini">' + IC.doc + '<div>Sin acciones registradas.<br>Las acciones (crear planilla, agregar repartos, enviar a auditoría, registrar facturas) aparecen acá.</div></div>'; animEmpty(host); return; }
    var groups = {}, order = [];
    list.forEach(function (a) { var d = a.ts.slice(0, 10); if (!groups[d]) { groups[d] = []; order.push(d); } groups[d].push(a); });
    var html = order.map(function (d) {
      var evs = groups[d].map(function (a) {
        var c = ACC[a.accion] || { dot: '#94a3b8', bg: '#f1f5f9', color: '#475569', label: a.accion };
        return '<div class="audit-ev"><div class="audit-ev__time">' + fmtHora(a.ts) + '</div>' +
          '<div class="audit-ev__mk"><span class="audit-ev__dot" style="background:' + c.dot + '"></span></div>' +
          '<div class="audit-ev__body"><div class="audit-ev__line">' +
          '<span class="audit-ev__tag" style="background:' + c.bg + ';color:' + c.color + '">' + esc(c.label) + '</span>' +
          '<span class="audit-ev__obj">' + esc(a.detalle || '') + '</span>' +
          (a.chips && a.chips.length ? '<span class="audit-ev__meta">' + a.chips.map(esc).join(' · ') + '</span>' : '') + '</div>' +
          '<div class="audit-ev__sub">' + esc(a.usuario) + '</div></div></div>';
      }).join('');
      return '<div class="audit-day"><div class="audit-day__head"><span class="cal-ic">' + IC.cal + '</span>' + isoToDisp(d) + '<span class="date-count">' + groups[d].length + '</span></div><div class="audit-tl">' + evs + '</div></div>';
    }).join('');
    host.innerHTML = html;
    if (window.gsap) {
      gsap.from('#auditHost .audit-day__head', { opacity: 0, x: -16, duration: .38, stagger: .1, ease: 'power3.out', clearProps: 'all' });
      gsap.from('#auditHost .audit-ev', { opacity: 0, x: -10, duration: .32, stagger: .025, delay: .1, ease: 'power2.out', clearProps: 'all' });
      gsap.from('#auditHost .audit-ev__dot', { scale: 0, duration: .35, stagger: .025, delay: .18, ease: 'back.out(2.5)', clearProps: 'transform' });
    }
  }

  /* ── Modal de confirmación PRO (check azul) ── */
  function confirmPro(opts) {
    var bd = el('<div class="modal-bd cpro-bd"><div class="modal-box cpro">' +
      '<div class="cpro__ico ' + (opts.danger ? 'cpro__ico--danger' : '') + '">' + (opts.icon || IC.check) + '</div>' +
      '<h3 class="cpro__t">' + esc(opts.title || '¿Confirmar?') + '</h3>' +
      (opts.text ? '<p class="cpro__tx">' + opts.text + '</p>' : '') +
      '<div class="cpro__foot"><button class="btn" data-close>' + esc(opts.cancelLabel || 'Cancelar') + '</button>' +
      '<button class="btn ' + (opts.danger ? 'btn--danger-solid' : 'btn--primary') + '" id="cproOk">' + (opts.okIcon || '') + esc(opts.okLabel || 'Confirmar') + '</button></div></div></div>');
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
      } else { bd.classList.remove('open'); setTimeout(function () { bd.remove(); }, 180); }
    }
    bd.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', close); });
    bd.addEventListener('click', function (e) { if (e.target === bd) close(); });
    q('#cproOk', bd).addEventListener('click', function () { close(); if (opts.onOk) opts.onOk(); });
  }
  /* ── Flash de éxito (check azul animado) ── */
  function successFlash(msg, cb) {
    var ov = el('<div class="sflash"><div class="sflash__card"><div class="sflash__ring"><svg viewBox="0 0 52 52" class="sflash__check"><circle cx="26" cy="26" r="24" fill="none"/><path fill="none" d="M14 27l8 8 16-16"/></svg></div><div class="sflash__msg">' + esc(msg || 'Listo') + '</div></div></div>');
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('show'); });
    setTimeout(function () { ov.classList.remove('show'); setTimeout(function () { ov.remove(); if (cb) cb(); }, 240); }, 1050);
  }

  /* ── Navegador de mes (‹ Julio 2026 › + volver al actual) ── */
  function monthNavHtml() {
    var esActual = S.mes === curMonthKey();
    return '<div class="mnav">' +
      '<button class="mnav__btn" data-mnav="prev" title="Mes anterior">' + IC.arrowL + '</button>' +
      '<button class="mnav__cur' + (esActual ? '' : ' off') + '" data-mnav="today" title="Ir al mes actual"><span class="mnav__ico">' + IC.cal + '</span>' + mesLabel(S.mes) + '</button>' +
      '<button class="mnav__btn" data-mnav="next" title="Mes siguiente">' + IC.arrowR + '</button></div>';
  }
  function wireMonthNav(scope, rerender) {
    scope.querySelectorAll('[data-mnav]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.dataset.mnav;
        if (a === 'prev') { S.mes = shiftMonth(S.mes, -1); S.semana = null; S._dir = -1; }
        else if (a === 'next') { S.mes = shiftMonth(S.mes, 1); S.semana = null; S._dir = 1; }
        else { S.mes = curMonthKey(); S.semana = curWeekKey(); S._dir = 0; }
        rerender();
      });
    });
  }
  /* ── Chips de semana (semana actual por defecto + “Mes completo”) ── */
  function weekChipsHtml() {
    var chips = '<button class="wkchip' + (S.semana == null ? ' on' : '') + '" data-wk="all">Mes completo</button>';
    weeksOfMonth(S.mes).forEach(function (w) {
      var lbl = isoToDisp(w.desde).slice(0, 5) + '–' + isoToDisp(w.hasta).slice(0, 5);
      var esActual = w.key === curWeekKey();
      chips += '<button class="wkchip' + (S.semana === w.key ? ' on' : '') + (esActual ? ' now' : '') + '" data-wk="' + w.key + '" title="Semana ' + isoToDisp(w.desde) + ' al ' + isoToDisp(w.hasta) + '">' + lbl + '</button>';
    });
    return '<div class="wkbar"><span class="wkbar__lbl">' + IC.cal + 'Semana</span>' + chips + '</div>';
  }
  function wireWeekChips(scope, rerender) {
    scope.querySelectorAll('[data-wk]').forEach(function (b) {
      b.addEventListener('click', function () { S.semana = b.dataset.wk === 'all' ? null : b.dataset.wk; rerender(); });
    });
  }

  /* ── Helpers ─────────────────────────────────────────── */
  function q(sel, root) { return (root || document).querySelector(sel); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtGs(n) { return Math.round(n || 0).toLocaleString('es-PY'); }
  function parseMoney(s) { return parseInt(String(s).replace(/[^\d]/g, ''), 10) || 0; }
  // Fecha ISO a partir de componentes LOCALES (evita el corrimiento de día por UTC en Paraguay UTC-3)
  function dISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function todayISO() { return dISO(new Date()); }
  function isoToDisp(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }
  function tipoChipCls(t) { return t === 'SERVICIOS ADICIONALES' ? 'SERVICIOS' : t; }
  function mondayOf(d) { d = new Date(d); var day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d; }
  function tsById(id) { return SEED_TS.find(function (t) { return t.id === id; }); }
  function repsOf(planillaId) { return DB.repartos.filter(function (r) { return r.planilla_id === planillaId; }).sort(function (a, b) { return (a.orden || 0) - (b.orden || 0) || a.id - b.id; }); }
  var _tip = null;
  function showTip(anchor, text) {
    if (!_tip) { _tip = el('<div class="tip"></div>'); document.body.appendChild(_tip); }
    _tip.textContent = text; _tip.style.display = 'block';
    var r = anchor.getBoundingClientRect();
    _tip.style.left = (r.left + r.width / 2) + 'px'; _tip.style.top = (r.top - 9) + 'px';
    requestAnimationFrame(function () { _tip.classList.add('show'); });
  }
  function hideTip() { if (_tip) { _tip.classList.remove('show'); _tip.style.display = 'none'; } }
  function toast(msg, type) {
    var t = el('<div class="toast ' + (type === 'err' ? 'toast--err' : '') + '">' + esc(msg) + '</div>');
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2400);
  }

  /* ── Router / nav ────────────────────────────────────── */
  function setNav(v) {
    document.querySelectorAll('[data-nav]').forEach(function (b) {
      var on = b.dataset.nav === v, was = b.classList.contains('is-active');
      b.classList.toggle('is-active', on);
      if (on && !was && window.gsap) { var ic = b.querySelector('.nav-btn__ico'); if (ic) gsap.fromTo(ic, { scale: .7 }, { scale: 1, duration: .4, ease: 'back.out(2.2)', clearProps: 'transform' }); }
    });
  }
  function go(view, arg) {
    S._animHd = view !== S._view; S._view = view;
    if (view === 'dashboard') { setNav('dashboard'); renderDashboard(); }
    else if (view === 'planillas') { setNav('planillas'); renderPlanillas(); }
    else if (view === 'planilla') { setNav('planillas'); openPlanilla(arg); }
    else if (view === 'facturas') { setNav('facturas'); renderFacturas(arg); }
    else if (view === 'auditoria') { setNav('auditoria'); renderAuditoria(); }
  }

  /* ══════════ DASHBOARD ══════════ */
  function plById(id) { return DB.planillas.find(function (p) { return p.id === id; }); }
  // Repartos de un mes (por la fecha del reparto)
  function repartosInMonth(mesKey) { return DB.repartos.filter(function (r) { return monthKey(r.fecha) === mesKey; }); }
  function sumP(list) { return list.reduce(function (s, x) { return s + (Number(x.precio) || 0); }, 0); }
  function sumK(list) { return list.reduce(function (s, x) { return s + (Number(x.km) || 0); }, 0); }
  // Agrupa una lista de repartos por una clave y devuelve [{key,n,precio,km}] ordenado por precio desc
  function aggBy(list, keyFn) {
    var m = {};
    list.forEach(function (r) { var k = keyFn(r) || '—'; if (!m[k]) m[k] = { key: k, n: 0, precio: 0, km: 0 }; m[k].n++; m[k].precio += Number(r.precio) || 0; m[k].km += Number(r.km) || 0; });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.precio - a.precio || b.n - a.n; });
  }
  function dimKeyFn(dim) {
    if (dim === 'transportista') return function (r) { var p = plById(r.planilla_id); return p ? p.transportadora_nombre : '—'; };
    if (dim === 'repartidor') return function (r) { return r.repartidor || 'Sin repartidor'; };
    if (dim === 'camion') return function (r) { return r.camion_desc || '—'; };
    return function (r) { return r.tipo || '—'; }; // tipo
  }
  // Facturado del mes (por fecha de la factura)
  function facturadoMes(mesKey) { return DB.facturas.filter(function (f) { return monthKey(f.fecha) === mesKey; }).reduce(function (s, f) { return s + (Number(f.monto) || 0); }, 0); }
  function deltaHtml(cur, prev) {
    if (prev === 0) return cur > 0 ? '<span class="delta delta--new">nuevo</span>' : '<span class="delta delta--flat">—</span>';
    var d = cur - prev, pct = Math.round(d / prev * 100);
    if (d === 0) return '<span class="delta delta--flat">= igual</span>';
    var up = d > 0;
    return '<span class="delta ' + (up ? 'delta--up' : 'delta--down') + '">' + (up ? IC.up : IC.down) + Math.abs(pct) + '%</span>';
  }

  function renderDashboard() {
    var stage = q('#stage');
    var cur = repartosInMonth(S.mes), prevMes = shiftMonth(S.mes, -1), prev = repartosInMonth(prevMes);
    var curP = sumP(cur), prevP = sumP(prev), curK = sumK(cur), prevK = sumK(prev);
    var fact = facturadoMes(S.mes), factPrev = facturadoMes(prevMes);
    // KPIs
    function kcard(cls, ico, lbl, valHtml, deltaH, sub) {
      return '<div class="dkpi ' + cls + '"><div class="dkpi__ic">' + ico + '</div><div class="dkpi__b">' +
        '<span class="dkpi__lbl">' + lbl + '</span><div class="dkpi__row"><b class="dkpi__val">' + valHtml + '</b>' + (deltaH || '') + '</div>' +
        '<span class="dkpi__sub">' + sub + '</span></div></div>';
    }
    var kpis = '<div class="dkpi-grid">' +
      kcard('k-brand', IC.doc, 'Repartos', '<span data-n="' + cur.length + '">' + fmtGs(cur.length) + '</span>', deltaHtml(cur.length, prev.length), 'mes ant.: ' + fmtGs(prev.length)) +
      kcard('k-money', IC.receipt, 'Precio total', '<span data-n="' + curP + '" data-pre="Gs. ">Gs. ' + fmtGs(curP) + '</span>', deltaHtml(curP, prevP), 'mes ant.: Gs. ' + fmtGs(prevP)) +
      kcard('k-km', IC.km, 'KM total', '<span data-n="' + curK + '">' + fmtGs(curK) + '</span>', deltaHtml(curK, prevK), 'mes ant.: ' + fmtGs(prevK)) +
      kcard('k-fact', IC.check, 'Facturado', '<span data-n="' + fact + '" data-pre="Gs. ">Gs. ' + fmtGs(fact) + '</span>', deltaHtml(fact, factPrev), 'mes ant.: Gs. ' + fmtGs(factPrev)) +
      '</div>';

    // ── Barra de control (todos los botones arriba) ──
    var dim = S.dashDim, metric = S.dashYearMetric;
    var dimIco = { transportista: IC.truck, repartidor: IC.user, camion: IC.truck, tipo: IC.tag };
    var dimSeg = '<div class="dseg">' +
      [['transportista', 'Transportistas'], ['repartidor', 'Repartidores'], ['camion', 'Camiones'], ['tipo', 'Tipos']].map(function (d) {
        return '<button class="dseg__b' + (dim === d[0] ? ' on' : '') + '" data-dim="' + d[0] + '">' + (dimIco[d[0]] || '') + d[1] + '</button>';
      }).join('') + '</div>';
    var metricSeg = '<div class="dseg dseg--sm"><button class="dseg__b' + (metric === 'precio' ? ' on' : '') + '" data-ym="precio">Precio</button><button class="dseg__b' + (metric === 'repartos' ? ' on' : '') + '" data-ym="repartos">Repartos</button></div>';
    var dbar = '<div class="dbar">' +
      '<div class="dbar__grp"><span class="dbar__lbl">Analizar por</span>' + dimSeg + '</div>' +
      '<div class="dbar__grp"><span class="dbar__lbl">Métrica</span>' + metricSeg + '</div></div>';

    // ── Gráfico anual + Ranking (2 columnas) ──
    var year = S.mes.split('-')[0];
    var yearData = MESES.map(function (nm, i) {
      var mk = year + '-' + String(i + 1).padStart(2, '0'), rs = repartosInMonth(mk);
      return { mes: nm, mk: mk, n: rs.length, precio: sumP(rs) };
    });
    var yearChart = '<div class="dcard"><div class="dcard__hd"><div><h3 class="dcard__t">Evolución ' + year + '</h3>' +
      '<span class="dcard__sub">' + (metric === 'precio' ? 'Precio total por mes' : 'Repartos por mes') + '</span></div></div>' +
      barsYearSvg(yearData, metric) + '</div>';

    var agg = aggBy(cur, dimKeyFn(dim));
    var rankTitle = { transportista: 'Por transportista', repartidor: 'Por repartidor', camion: 'Camiones más usados', tipo: 'Por tipo' }[dim];
    var rankBody = agg.length ? rankRowsHtml(agg) : '<div class="empty-mini">' + IC.doc + '<div>Sin repartos en ' + mesLabel(S.mes) + '.</div></div>';
    var rank = '<div class="dcard"><div class="dcard__hd"><div><h3 class="dcard__t">' + rankTitle + '</h3>' +
      '<span class="dcard__sub">' + mesLabel(S.mes) + ' · ' + agg.length + ' ' + (agg.length === 1 ? 'ítem' : 'ítems') + '</span></div></div>' +
      '<div class="drank" id="drank">' + rankBody + '</div></div>';

    stage.innerHTML = '<div class="view-hd"><h2>Dashboard</h2>' + monthNavHtml() + '<div class="spacer"></div>' + bellHtml() + '</div>' +
      kpis + dbar + '<div class="dgrid2">' + yearChart + rank + '</div>';
    wireMonthNav(stage, renderDashboard); wireBell();
    stage.querySelectorAll('[data-ym]').forEach(function (b) { b.addEventListener('click', function () { S.dashYearMetric = b.dataset.ym; renderDashboard(); }); });
    stage.querySelectorAll('[data-dim]').forEach(function (b) { b.addEventListener('click', function () { S.dashDim = b.dataset.dim; renderDashboard(); }); });
    animHeader(stage);
    countUpAll(stage);
    if (window.gsap) {
      gsap.from('#stage .dkpi', { opacity: 0, y: 16, duration: .42, stagger: .05, ease: 'power3.out', clearProps: 'all' });
      gsap.from('#stage .dbar', { opacity: 0, y: -8, duration: .36, delay: .1, ease: 'power2.out', clearProps: 'all' });
      gsap.from('#stage .ybar', { scaleY: 0, duration: .6, stagger: .03, delay: .18, ease: 'power2.out' });
      gsap.from('#stage .drank-row', { opacity: 0, x: -12, duration: .38, stagger: .04, delay: .22, ease: 'power2.out', clearProps: 'all' });
      gsap.from('#stage .drank-row__fill', { width: 0, duration: .7, stagger: .04, delay: .32, ease: 'power2.out' });
    }
    wireDashTips(stage);
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    var pw = Math.pow(10, Math.floor(Math.log10(v))), n = v / pw;
    var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * pw;
  }
  function topRoundRect(x, y, w, h, r) {
    if (h <= 0.5) return '';
    r = Math.min(r, w / 2, h);
    return 'M' + x + ',' + (y + h) + ' L' + x + ',' + (y + r) + ' Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
      ' L' + (x + w - r) + ',' + y + ' Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + ' L' + (x + w) + ',' + (y + h) + ' Z';
  }
  // SVG de barras anuales (con eje, gridlines y barras top-redondeadas)
  function barsYearSvg(data, metric) {
    var W = 760, H = 230, padB = 30, padT = 20, padL = 46, padR = 10;
    var vals = data.map(function (d) { return metric === 'precio' ? d.precio : d.n; });
    var rawMax = Math.max.apply(null, vals.concat([0]));
    var max = niceMax(rawMax) || 1;
    var innerW = W - padL - padR, innerH = H - padT - padB, bw = innerW / 12, barW = Math.min(34, bw * 0.56);
    var baseY = padT + innerH;
    // Gridlines + labels del eje Y (4 niveles)
    var grid = '', ticks = 4;
    for (var t = 0; t <= ticks; t++) {
      var gv = max * t / ticks, gy = baseY - (gv / max) * innerH;
      grid += '<line class="ygrid" x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + gy.toFixed(1) + '"></line>' +
        '<text class="ygrid-lbl" x="' + (padL - 8) + '" y="' + (gy + 3.5).toFixed(1) + '" text-anchor="end">' + kfmt(gv) + '</text>';
    }
    var bars = data.map(function (d, i) {
      var v = metric === 'precio' ? d.precio : d.n, h = max ? (v / max) * innerH : 0;
      var x = padL + i * bw + (bw - barW) / 2, y = baseY - h;
      var isCur = d.mk === S.mes, isFut = d.mk > curMonthKey();
      var cls = isCur ? 'ybar ybar--cur' : (isFut ? 'ybar ybar--fut' : 'ybar');
      var tip = d.mes + ' ' + d.mk.split('-')[0] + ' · ' + (metric === 'precio' ? 'Gs. ' + fmtGs(d.precio) : d.n + ' reparto' + (d.n === 1 ? '' : 's'));
      var p = topRoundRect(x, y, barW, h, 5);
      return (p ? '<path class="' + cls + '" d="' + p + '" data-tip="' + esc(tip) + '"></path>' +
        '<rect class="ybar-hit" x="' + (padL + i * bw).toFixed(1) + '" y="' + padT + '" width="' + bw.toFixed(1) + '" height="' + innerH + '" data-tip="' + esc(tip) + '"></rect>' : '') +
        (v > 0 ? '<text class="ybar-val' + (isCur ? ' on' : '') + '" x="' + (x + barW / 2).toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" text-anchor="middle">' + (metric === 'precio' ? kfmt(d.precio) : d.n) + '</text>' : '') +
        '<text class="ybar-lbl' + (isCur ? ' on' : '') + '" x="' + (x + barW / 2).toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle">' + d.mes.slice(0, 3) + '</text>';
    }).join('');
    var baseLine = '<line class="ybase" x1="' + padL + '" y1="' + baseY + '" x2="' + (W - padR) + '" y2="' + baseY + '"></line>';
    return '<div class="ychart"><svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="xMidYMid meet">' + grid + baseLine + bars + '</svg></div>';
  }
  function kfmt(n) { n = Number(n) || 0; if (n >= 1e6) { var m = n / 1e6; return (m >= 10 ? Math.round(m) : (Math.round(m * 10) / 10)) + 'M'; } if (n >= 1e3) return Math.round(n / 1e3) + 'k'; return String(Math.round(n)); }
  // Filas de ranking (barras horizontales)
  function rankRowsHtml(agg) {
    var max = agg[0] ? agg[0].precio : 1, totalP = agg.reduce(function (s, x) { return s + x.precio; }, 0);
    return agg.map(function (a, i) {
      var pct = max ? Math.round(a.precio / max * 100) : 0, share = totalP ? Math.round(a.precio / totalP * 100) : 0;
      return '<div class="drank-row" data-tip="' + esc(a.key + ' · ' + a.n + ' repartos · Gs. ' + fmtGs(a.precio) + ' · ' + share + '% del mes') + '">' +
        '<span class="drank-row__rk">' + (i + 1) + '</span>' +
        '<div class="drank-row__main"><div class="drank-row__top"><span class="drank-row__name">' + esc(a.key) + '</span>' +
          '<span class="drank-row__val"><b>Gs. ' + fmtGs(a.precio) + '</b> · ' + a.n + ' rep.</span></div>' +
          '<div class="drank-row__bar"><span class="drank-row__fill" style="width:' + pct + '%"></span></div></div></div>';
    }).join('');
  }
  function wireDashTips(scope) {
    scope.querySelectorAll('[data-tip]').forEach(function (n) {
      n.addEventListener('mouseenter', function () { showTip(n, n.dataset.tip); });
      n.addEventListener('mouseleave', hideTip);
    });
  }

  /* ══════════ PLANILLAS ══════════ */
  function planillaTotals(id) { var r = repsOf(id); return { n: r.length, precio: r.reduce(function (s, x) { return s + (Number(x.precio) || 0); }, 0), km: r.reduce(function (s, x) { return s + (Number(x.km) || 0); }, 0) }; }

  function renderPlanillas() {
    var stage = q('#stage');
    var list = DB.planillas.filter(function (p) { return matchesFilter(p.semana_desde); }).reverse();
    var alcance = S.semana ? 'la semana ' + isoToDisp(S.semana).slice(0, 5) + '–' + isoToDisp(weekEnd(S.semana)).slice(0, 5) : mesLabel(S.mes);
    stage.innerHTML = '<div class="view-hd"><h2>Planillas de reparto</h2><span class="count-badge">' + list.length + '</span>' +
      monthNavHtml() + '<div class="spacer"></div>' +
      '<button class="btn btn--primary" id="btnNewPl">' + IC.plus + 'Nueva planilla</button>' + bellHtml() + '</div>' +
      weekChipsHtml() + '<div id="plHost"></div>';
    q('#btnNewPl').addEventListener('click', function () { startWizard(null); });
    wireMonthNav(stage, renderPlanillas); wireWeekChips(stage, renderPlanillas); wireBell();
    animHeader(stage);
    var host = q('#plHost'), dx = S._dir; S._dir = 0;
    if (!list.length) { host.innerHTML = '<div class="empty-mini">' + IC.doc + '<div>Sin planillas en ' + alcance + '.<br>Creá una con “Nueva planilla” o cambiá de mes/semana.</div></div>'; animEmpty(host); return; }
    host.innerHTML = '<div class="grid">' + list.map(function (p) {
      var t = planillaTotals(p.id), st = planillaStatus(p), pg = ST_PROG[st] || ST_PROG.proceso;
      return '<div class="pcard" data-pl="' + p.id + '" role="button" tabindex="0">' +
        '<button type="button" class="pcard__del" data-delpl="' + p.id + '" title="Borrar planilla">' + IC.trash + '</button>' +
        '<div class="pcard__top"><span class="pcard__ts">' + esc(p.transportadora_nombre || '—') + '</span></div>' +
        '<div class="pcard__wk">' + (p.semana_desde ? isoToDisp(p.semana_desde) + ' al ' + isoToDisp(p.semana_hasta) : 'Semana sin definir') + '</div>' +
        '<div class="pcard__prog ' + pg.cls + '"><div class="pcard__prog-hd"><span class="pcard__prog-lbl">' +
          (pg.done ? IC.check : '<span class="pcard__dot"></span>') + pg.label + '</span><span class="pcard__prog-pct">' + pg.pct + '%</span></div>' +
          '<div class="pcard__bar"><span style="width:' + pg.pct + '%"></span></div></div>' +
        '<div class="pcard__foot"><div class="pcard__stat"><b data-n="' + t.n + '">' + t.n + '</b><span>Repartos</span></div>' +
          '<div class="pcard__stat" style="text-align:right"><b data-n="' + t.precio + '" data-pre="Gs. ">Gs. ' + fmtGs(t.precio) + '</b><span>Total</span></div></div></div>';
    }).join('') + '</div>';
    host.querySelectorAll('.pcard').forEach(function (c) {
      c.addEventListener('click', function () { go('planilla', +c.dataset.pl); });
      c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('planilla', +c.dataset.pl); } });
    });
    host.querySelectorAll('[data-delpl]').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); delPlanilla(+b.dataset.delpl); }); });
    if (window.gsap) {
      // Al cambiar de mes las tarjetas entran desde el lado correspondiente (‹ izquierda / derecha ›)
      gsap.from('#plHost .pcard', dx
        ? { opacity: 0, x: dx * 32, duration: .42, stagger: .04, ease: 'power3.out', clearProps: 'all' }
        : { opacity: 0, y: 14, duration: .38, stagger: .04, ease: 'power2.out', clearProps: 'all' });
      gsap.from('#plHost .pcard__bar span', { width: 0, duration: .7, delay: .2, stagger: .04, ease: 'power2.out' });
    }
    countUpAll(host);
  }

  function dateField(id, label, val) {
    return '<div class="field"><label>' + label + '</label><div class="datewrap"><span class="datewrap__ico">' + IC.cal + '</span><input class="inp inp--date" type="date" id="' + id + '" value="' + val + '"></div></div>';
  }
  /* ══════════ WIZARD DE PLANILLA (3 pasos) ══════════ */
  function startWizard(id) {
    if (id == null) {
      var monday = mondayOf(new Date()), sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
      S.current = { id: null, transportadora_id: null, transportadora_nombre: '', semana_desde: dISO(monday), semana_hasta: dISO(sunday), estado: 'abierta' };
      S.isNew = true; S.step = 1;
    } else {
      S.current = DB.planillas.find(function (p) { return p.id === id; });
      if (!S.current) { go('planillas'); return; }
      S.isNew = false; S.step = 2;
    }
    setNav('planillas'); renderWizard();
  }
  function openPlanilla(id) { startWizard(id); }

  function renderWizard() {
    var stage = q('#stage'), p = S.current, labels = ['Planilla', 'Repartos'];
    var ctx;
    if (p && p.id != null) {
      var st = planillaStatus(p), f = p.factura_id ? DB.facturas.find(function (x) { return x.id === p.factura_id; }) : null;
      var sem = p.semana_desde ? isoToDisp(p.semana_desde).slice(0, 5) + '–' + isoToDisp(p.semana_hasta).slice(0, 5) : 'Sin semana';
      ctx = '<span class="wiz-top__ts">' + esc(p.transportadora_nombre || '—') + '</span>' +
        '<span class="chip ' + ST_CHIP[st] + '">' + ST_SHORT[st] + '</span>' +
        '<span class="chip chip--soft">' + IC.cal + sem + '</span>' +
        '<span class="chip chip--soft">#' + String(p.id).padStart(4, '0') + '</span>' +
        (f ? '<span class="chip chip--soft">' + IC.receipt + 'Nro. Factura ' + esc(f.nro || '—') + '</span>' : '');
    } else ctx = '<span class="wiz-top__ts">Nueva planilla</span>';
    var top = '<div class="wiz-top"><button class="btn btn--back" id="wizExit">' + IC.arrowL + ' Volver a Planillas</button>' +
      '<div class="wiz-top__ctx">' + ctx + '</div>' + bellHtml() + '</div>';
    var steps = labels.map(function (lb, i) {
      var n = i + 1, cls = n === S.step ? 'is-active' : (n < S.step ? 'is-done' : '');
      return (i > 0 ? '<div class="wiz-arrow ' + (n <= S.step ? 'on' : '') + '">' + IC.arrowR + '</div>' : '') +
        '<button type="button" class="wiz-step ' + cls + '" data-step="' + n + '">' +
        '<span class="wiz-step__n">' + (n < S.step ? IC.check : n) + '</span>' +
        '<span class="wiz-step__lbl">' + lb + '</span></button>';
    }).join('');
    var stepper = '<div class="wiz-steprow"><div></div><div class="wiz-steps">' + steps + '</div><div class="wiz-stepact" id="stepAction"></div></div>';
    stage.innerHTML = '<div class="wiz">' + top + stepper + '<div class="wiz-body" id="wizBody"></div></div>';
    q('#wizExit', stage).addEventListener('click', function () { go('planillas'); });
    stage.querySelectorAll('[data-step]').forEach(function (b) { b.addEventListener('click', function () { gotoStep(+b.dataset.step); }); });
    wireBell();
    if (window.gsap) {
      if (S._animHd) {
        S._animHd = false;
        gsap.from(stage.querySelector('.wiz-top'), { opacity: 0, y: -14, duration: .42, ease: 'power3.out', clearProps: 'all' });
        gsap.from(stage.querySelectorAll('.wiz-steps > *, .wiz-stepact > *'), { opacity: 0, y: -10, duration: .36, stagger: .05, delay: .08, ease: 'power2.out', clearProps: 'all' });
      }
      // Pulso del paso activo en cada cambio de paso
      var an = stage.querySelector('.wiz-step.is-active .wiz-step__n');
      if (an) gsap.fromTo(an, { scale: .55 }, { scale: 1.06, duration: .5, ease: 'back.out(2.2)' });
      var arrOn = stage.querySelectorAll('.wiz-arrow.on svg');
      if (arrOn.length) gsap.fromTo(arrOn, { x: -5, opacity: .4 }, { x: 0, opacity: 1, duration: .4, ease: 'power2.out', clearProps: 'all' });
    }
    renderStep();
  }
  function gotoStep(n) {
    if (n === S.step) return;
    if (S.step === 1 && n > 1) { if (!saveStep1()) return; }
    if (n > 1 && (!S.current || S.current.id == null)) { toast('Primero completá la planilla', 'err'); return; }
    S.step = n; renderWizard();
  }
  function renderStep() {
    var body = q('#wizBody');
    if (S.step === 1) renderStep1(body);
    else renderStep2(body);
    if (window.gsap) gsap.from('#wizBody > *', { opacity: 0, y: 16, duration: .38, stagger: .05, ease: 'power2.out', clearProps: 'all' });
  }
  function renderStep1(body) {
    var p = S.current;
    body.innerHTML = '<div class="wiz-card"><h3 class="wiz-card__t">Datos de la planilla</h3>' +
      '<div class="wiz-form">' +
        '<div class="field field--full"><label>Transportadora <span class="req">*</span></label><div class="ss" id="wTs"></div></div>' +
        dateField('wDesde', 'Semana desde', p.semana_desde || todayISO()) +
        dateField('wHasta', 'Semana hasta', p.semana_hasta || todayISO()) +
      '</div></div>' +
      '<div class="wiz-nav wiz-nav--center"><span class="wiz-hint">Elegí la transportadora y la semana para empezar</span>' +
      '<button class="btn btn--primary" id="wNext">Siguiente ' + IC.arrowR + '</button></div>';
    S.tsSel = SSelect(q('#wTs', body), { search: true, value: p.transportadora_id, placeholder: '— Elegir transportadora —', options: SEED_TS.map(function (t) { return { value: t.id, label: t.n }; }) });
    q('#wNext', body).addEventListener('click', function () { gotoStep(2); });
  }
  function saveStep1() {
    var tsId = +S.tsSel.get();
    if (!tsId) { toast('Elegí la transportadora', 'err'); return false; }
    var ts = tsById(tsId);
    S.current.transportadora_id = tsId; S.current.transportadora_nombre = ts ? ts.n : '';
    S.current.semana_desde = q('#wDesde').value || null; S.current.semana_hasta = q('#wHasta').value || null;
    if (S.current.semana_desde) { S.mes = monthKey(S.current.semana_desde); S.semana = null; }
    if (S.isNew) {
      S.current.id = nid(); DB.planillas.push(S.current); S.isNew = false;
      logAudit('crear_planilla', 'Planilla #' + String(S.current.id).padStart(4, '0') + ' · ' + S.current.transportadora_nombre, [S.current.semana_desde ? isoToDisp(S.current.semana_desde).slice(0, 5) + '–' + isoToDisp(S.current.semana_hasta).slice(0, 5) : ''], S.current.id);
    }
    save(); return true;
  }
  function renderStep2(body) {
    var p = S.current, editable = esEditable(p);
    var f = p.factura_id ? DB.facturas.find(function (x) { return x.id === p.factura_id; }) : null;
    var act = document.getElementById('stepAction');
    if (act) {
      var hayRep = repsOf(p.id).length;
      act.innerHTML = editable ? ((hayRep ? '<span class="step-count">' + hayRep + ' reparto' + (hayRep === 1 ? '' : 's') + '</span>' : '') + '<button class="btn btn--primary btn--lg" id="wAdd">' + IC.plus + 'Agregar reparto</button>') : '';
      if (editable) act.querySelector('#wAdd').addEventListener('click', function () { openRepartoBatch(); });
    }
    // Botón primario según el flujo: proceso→Registrar factura · conciliada→Enviar a auditoría · diferencia→Ver en Facturas
    var status = planillaStatus(p);
    var primary = !editable
      ? (f ? '<button class="btn btn--primary" id="wViewFac">' + IC.receipt + 'Ver en Facturas</button>' : '')
      : (status === 'conciliada'
        ? '<button class="btn btn--audit" id="wConfirm">' + IC.check + 'Enviar a auditoría</button>'
        : (status === 'diferencia'
          ? '<button class="btn btn--primary" id="wViewFac">' + IC.receipt + 'Ver en Facturas</button>'
          : '<button class="btn btn--primary" id="wFactura">' + IC.receipt + 'Registrar factura</button>'));
    var noPrint = status === 'diferencia';
    var printBtn = '<button class="btn' + (noPrint ? ' is-disabled' : '') + '" id="wPrint"' + (noPrint ? ' title="No se puede imprimir con diferencia"' : '') + '>' + IC.print + 'Imprimir</button>';
    var nav = editable
      ? '<button class="btn" id="wBack">' + IC.arrowL + ' Datos</button>' +
        '<button class="btn btn--danger-soft" id="wDelPl">' + IC.trash + 'Borrar</button>' +
        printBtn + primary
      : '<button class="btn btn--danger-soft" id="wReopen">' + IC.edit + 'Reabrir</button>' +
        printBtn + primary;
    body.innerHTML = '<div id="alertHost"></div><div id="repHost"></div><div id="dualHost"></div>' +
      '<div class="wiz-nav wiz-nav--mid">' + nav + '</div>';
    q('#wPrint', body).addEventListener('click', function () { printPlanilla(p); });
    var vf = q('#wViewFac', body);
    if (vf && f) vf.addEventListener('click', function () { if (f.fecha) { S.mes = monthKey(f.fecha); S.semana = null; } go('facturas', f.id); });
    if (editable) {
      q('#wDelPl', body).addEventListener('click', function () { delPlanilla(p.id); });
      q('#wBack', body).addEventListener('click', function () { gotoStep(1); });
      var bf = q('#wFactura', body);
      if (bf) bf.addEventListener('click', function () {
        if (!repsOf(p.id).length) { toast('Agregá al menos un reparto antes de vincular la factura', 'err'); return; }
        facturaModal(null, p, function () { renderWizard(); });
      });
      var bc = q('#wConfirm', body);
      if (bc) {
        // El botón "salta" cuando la planilla queda conciliada
        if (window.gsap) gsap.from(bc, { scale: .5, opacity: 0, duration: .55, delay: .25, ease: 'back.out(2.2)', clearProps: 'all' });
        bc.addEventListener('click', function () {
          var t = planillaTotals(p.id);
          confirmPro({
            title: '¿Enviar a auditoría?',
            text: 'La factura <b>Nº ' + esc(f ? f.nro : '—') + '</b> coincide con los <b>' + t.n + '</b> reparto(s) por <b>Gs. ' + fmtGs(t.precio) + '</b>. La planilla queda cerrada en auditoría.',
            okLabel: 'Enviar a auditoría', okIcon: IC.check,
            onOk: function () {
              p.estado = 'auditoria'; save();
              logAudit('enviar_auditoria', 'Planilla #' + String(p.id).padStart(4, '0') + ' · ' + p.transportadora_nombre, ['Gs ' + fmtGs(t.precio), t.n + ' repartos'], p.id);
              successFlash('Enviada a auditoría', function () { renderWizard(); });
            }
          });
        });
      }
    } else {
      q('#wReopen', body).addEventListener('click', function () { reopenPlanilla(); });
    }
    renderRepartos();
  }
  function reopenPlanilla() {
    S.current.estado = 'abierta'; save();
    logAudit('reabrir', 'Planilla #' + String(S.current.id).padStart(4, '0') + ' · ' + S.current.transportadora_nombre, [], S.current.id);
    toast('Planilla reabierta para editar'); renderWizard();
  }
  function delPlanilla(id) {
    var p = DB.planillas.find(function (x) { return x.id === id; }), t = planillaTotals(id);
    confirmPro({
      title: '¿Borrar esta planilla?', danger: true, icon: IC.trash, okIcon: IC.trash,
      text: 'Se elimina la planilla de <b>' + esc(p ? p.transportadora_nombre : '') + '</b> y sus <b>' + t.n + '</b> reparto(s). Esta acción no se puede deshacer.',
      okLabel: 'Borrar planilla',
      onOk: function () {
        DB.repartos = DB.repartos.filter(function (r) { return r.planilla_id !== id; });
        DB.facturas.forEach(function (f) { if (f.planilla_id === id) f.planilla_id = null; });
        DB.planillas = DB.planillas.filter(function (x) { return x.id !== id; });
        save(); logAudit('borrar_planilla', 'Planilla #' + String(id).padStart(4, '0') + ' · ' + (p ? p.transportadora_nombre : ''), [t.n + ' repartos'], id);
        toast('Planilla borrada'); go('planillas');
      }
    });
  }
  /* ══════════ REPORTE IMPRIMIBLE (formato Factura_Transportadora) ══════════ */
  function printPlanilla(p) {
    var repartos = repsOf(p.id);
    if (!repartos.length) { toast('La planilla no tiene repartos para imprimir', 'err'); return; }
    if (planillaStatus(p) === 'diferencia') { toast('No se puede imprimir: la factura no coincide con los repartos. Corregí la diferencia primero.', 'err'); return; }
    var f = p.factura_id ? DB.facturas.find(function (x) { return x.id === p.factura_id; }) : null;
    var groups = {};
    repartos.forEach(function (r) { (groups[r.tipo] = groups[r.tipo] || []).push(r); });
    var order = Object.keys(groups).sort(function (a, b) { return (TIPO_ORDER[a] == null ? 9 : TIPO_ORDER[a]) - (TIPO_ORDER[b] == null ? 9 : TIPO_ORDER[b]); });
    var body = '', totKm = 0, totPr = 0, totN = 0;
    order.forEach(function (tipo) {
      var rows = groups[tipo], sKm = 0, sPr = 0;
      body += '<tr class="grp"><td colspan="7">REPARTO: ' + esc(tipo) + '</td></tr>';
      rows.forEach(function (r) {
        sKm += Number(r.km) || 0; sPr += Number(r.precio) || 0;
        body += '<tr><td>' + isoToDisp(r.fecha) + '</td><td>' + esc(r.tipo) + '</td><td>' + esc(r.repartidor || '—') + '</td>' +
          '<td>' + esc(r.zona || '—') + '</td><td>' + esc(r.camion_desc || '—') + (r.observacion ? '<div class="obs-inline">· Obs.: ' + esc(r.observacion) + '</div>' : '') + '</td>' +
          '<td class="r">' + fmtGs(r.km) + '</td><td class="r">' + fmtGs(r.precio) + '</td></tr>';
      });
      body += '<tr class="sub"><td colspan="5">SUBTOTAL ' + esc(tipo) + '</td><td class="r">' + fmtGs(sKm) + '</td><td class="r">' + fmtGs(sPr) + '</td></tr>';
      totKm += sKm; totPr += sPr; totN += rows.length;
    });
    var pid = '#' + String(p.id).padStart(4, '0');
    var logoUrl = new URL('logo-alas-s.a.png', window.location.href).href;
    var meta = function (k, v) { return '<div class="mi"><span>' + k + '</span><b>' + v + '</b></div>'; };
    var html =
      '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Planilla ' + pid + ' — ' + esc(p.transportadora_nombre || '') + '</title>' +
      '<style>' +
      '*{margin:0;padding:0;box-sizing:border-box}' +
      'body{font-family:Arial,"Segoe UI",sans-serif;color:#1a2331;font-size:12px;padding:26px 30px;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '.rp-hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #0B5F8D;padding-bottom:12px;margin-bottom:14px}' +
      '.rp-hd__l{display:flex;align-items:flex-end;gap:14px}' +
      '.rp-logo{height:40px;width:auto}' +
      '.rp-hd h1{font-size:17px;color:#0B5F8D;letter-spacing:.2px;line-height:1;padding-bottom:3px}.rp-hd .sub{font-size:11px;color:#5b6779;margin-top:2px}' +
      '.rp-hd .co{text-align:right;line-height:1.4}.rp-hd .co-lbl{display:block;font-size:8.5px;text-transform:uppercase;letter-spacing:.5px;color:#7a8699;font-weight:700}.rp-hd .co b{color:#0B5F8D;font-size:14px}' +
      '.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}' +
      '.mi{background:#f2f6fa;border:1px solid #dde6ef;border-radius:7px;padding:7px 11px}' +
      '.mi span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#7a8699;font-weight:700}' +
      '.mi b{font-size:12.5px;color:#1a2331}' +
      '.rp-tbl{border:1px solid #dbe3ee;border-radius:12px;overflow:hidden;margin-bottom:14px}' +
      'table{width:100%;border-collapse:separate;border-spacing:0}' +
      'thead th{background:#2578b8;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.4px;padding:8px 9px;text-align:left}' +
      'thead th.r,td.r{text-align:right}' +
      'tbody td{padding:6px 9px;border-bottom:1px solid #e7edf4;font-size:11.5px}' +
      'tr.grp td{background:#e8eef5;font-weight:800;color:#0B5F8D;font-size:10.5px;letter-spacing:.4px;padding:7px 9px}' +
      '.obs-inline{font-size:9.5px;font-style:italic;color:#7a8699;margin-top:2px}' +
      'tr.sub td{background:#f2f6fa;font-weight:800;color:#1a2331;border-top:1.5px solid #cdd8e4}' +
      'tr.total td{background:#2578b8;color:#fff;font-weight:800;font-size:13px;padding:10px 9px}' +
      '.foot{display:flex;justify-content:space-between;gap:24px;margin-top:8px}' +
      '.resumen{border:1.5px solid #0B5F8D;border-radius:9px;padding:12px 16px;min-width:240px}' +
      '.resumen h3{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#0B5F8D;margin-bottom:8px;border-bottom:1px solid #dde6ef;padding-bottom:5px}' +
      '.resumen .rr{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}.resumen .rr b{font-weight:800}' +
      '.firmas{display:flex;gap:40px;align-items:flex-end;flex:1;justify-content:space-around;padding:0 10px}' +
      '.firma{text-align:center;min-width:180px}.firma .ln{border-top:1.5px solid #1a2331;margin-bottom:5px}.firma span{font-size:11px;font-weight:700;color:#3a4759}' +
      '.pfoot{margin-top:26px;text-align:center;font-size:9.5px;color:#9aa6b5;border-top:1px solid #e7edf4;padding-top:8px}' +
      '@media print{body{padding:0}@page{margin:14mm}}' +
      '</style></head><body>' +
      '<div class="rp-hd"><div class="rp-hd__l"><img class="rp-logo" src="' + logoUrl + '" alt="ALAS"><div><h1>Registro de Facturación de Transportadora</h1></div></div>' +
      '<div class="co"><span class="co-lbl">Fecha de emisión</span><b>' + isoToDisp(todayISO()) + '</b></div></div>' +
      '<div class="meta">' +
        meta('Planilla ID', pid) +
        meta('Semana', (p.semana_desde ? isoToDisp(p.semana_desde) + ' al ' + isoToDisp(p.semana_hasta) : '—')) +
        meta('Transportadora', esc(p.transportadora_nombre || '—')) +
        meta('Factura Nº', f ? esc(f.nro || '—') : '—') +
      '</div>' +
      '<div class="rp-tbl"><table><thead><tr><th>Fecha</th><th>Reparto</th><th>Repartidor</th><th>Zona</th><th>Chofer / Camión</th><th class="r">KM</th><th class="r">Precio (Gs.)</th></tr></thead>' +
      '<tbody>' + body +
      '<tr class="total"><td colspan="5" class="r">TOTAL GENERAL</td><td class="r">' + fmtGs(totKm) + '</td><td class="r">' + fmtGs(totPr) + '</td></tr>' +
      '</tbody></table></div>' +
      '<div class="foot"><div class="firmas">' +
        '<div class="firma"><div class="ln"></div><span>JEFE DE DISTRIBUCIÓN</span></div>' +
        '<div class="firma"><div class="ln"></div><span>JEFE DE LOGÍSTICA</span></div></div>' +
        '<div class="resumen"><h3>Resumen</h3>' +
          '<div class="rr"><span>Cantidad de repartos</span><b>' + totN + '</b></div>' +
          '<div class="rr"><span>KM total</span><b>' + fmtGs(totKm) + '</b></div>' +
          '<div class="rr"><span>Precio total</span><b>Gs. ' + fmtGs(totPr) + '</b></div>' +
          (f ? '<div class="rr" style="border-top:1px solid #dde6ef;margin-top:5px;padding-top:6px"><span>Monto factura</span><b>Gs. ' + fmtGs(f.monto) + '</b></div>' : '') +
        '</div>' +
      '</div>' +
      '<script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>' +
      '</body></html>';
    var w = window.open('', '_blank', 'width=920,height=1040');
    if (!w) { toast('Permití las ventanas emergentes para imprimir', 'err'); return; }
    w.document.open(); w.document.write(html); w.document.close(); w.focus();
  }

  function facBadge(p) {
    if (!p.factura_id) return '';
    var f = DB.facturas.find(function (x) { return x.id === p.factura_id; });
    return f ? ' · <span class="pl-hd__fac">Factura Nº ' + esc(f.nro || '—') + '</span>' : '';
  }
  function renderRepartos() {
    var p = S.current, host = q('#repHost'), dHost = q('#dualHost'), aHost = q('#alertHost'), editable = esEditable(p);
    var repartos = repsOf(p.id);
    if (aHost) aHost.innerHTML = '';
    if (!repartos.length) { host.innerHTML = '<div class="rep-wrap"><div class="empty-mini">' + IC.doc + '<div>Sin repartos. Agregá el primero con “Agregar reparto”.</div></div></div>'; if (dHost) dHost.innerHTML = ''; return; }
    var groups = {};
    repartos.forEach(function (r) { (groups[r.tipo] = groups[r.tipo] || []).push(r); });
    var order = Object.keys(groups).sort(function (a, b) { return (TIPO_ORDER[a] == null ? 9 : TIPO_ORDER[a]) - (TIPO_ORDER[b] == null ? 9 : TIPO_ORDER[b]); });
    var body = '', totKm = 0, totPr = 0, totN = 0;
    order.forEach(function (tipo) {
      var rows = groups[tipo], sKm = 0, sPr = 0;
      body += '<tr class="grp"><td colspan="8">REPARTO: ' + esc(tipo) + '</td></tr>';
      rows.forEach(function (r) {
        sKm += Number(r.km) || 0; sPr += Number(r.precio) || 0;
        body += '<tr><td>' + isoToDisp(r.fecha) + '</td>' +
          '<td><span class="tchip tchip--' + tipoChipCls(r.tipo) + '">' + esc(r.tipo) + '</span></td>' +
          '<td>' + esc(r.repartidor || '—') + '</td><td>' + esc(r.zona || '—') + '</td>' +
          '<td class="rep-desc">' + esc(r.camion_desc || '—') + '</td>' +
          '<td class="c">' + (r.observacion ? '<span class="obs-note" tabindex="0" data-obs="' + esc(r.observacion) + '">' + IC.note + '</span>' : '') + '</td>' +
          '<td class="r rep-num">' + fmtGs(r.km) + '</td><td class="r rep-num">' + fmtGs(r.precio) + '</td></tr>';
      });
      body += '<tr class="sub"><td colspan="6">SUBTOTAL ' + esc(tipo) + '</td><td class="r">' + fmtGs(sKm) + '</td><td class="r">' + fmtGs(sPr) + '</td></tr>';
      totKm += sKm; totPr += sPr; totN += rows.length;
    });
    host.innerHTML = '<div class="rep-wrap"><div class="rep-scroll"><table class="rep"><thead><tr>' +
      '<th>Fecha</th><th>Reparto</th><th>Repartidor</th><th>Zona</th><th>Chofer / Camión</th><th class="c">Obs.</th><th class="r">KM</th><th class="r">Precio</th></tr></thead>' +
      '<tbody>' + body +
      '<tr class="rep-total-row"><td colspan="6" class="r">TOTAL GENERAL</td><td class="r">' + fmtGs(totKm) + '</td><td class="r">' + fmtGs(totPr) + '</td></tr>' +
      '</tbody></table></div></div>';
    host.querySelectorAll('.obs-note').forEach(function (n) {
      n.addEventListener('mouseenter', function () { showTip(n, n.dataset.obs); });
      n.addEventListener('mouseleave', hideTip);
      n.addEventListener('focus', function () { showTip(n, n.dataset.obs); });
      n.addEventListener('blur', hideTip);
      n.addEventListener('click', function (e) { e.stopPropagation(); showTip(n, n.dataset.obs); });
    });
    q('.rep-scroll', host) && q('.rep-scroll', host).addEventListener('scroll', hideTip);
    // Factura + diferencia
    var f = p.factura_id ? DB.facturas.find(function (x) { return x.id === p.factura_id; }) : null;
    var diff = f ? (Number(f.monto) || 0) - totPr : 0;
    if (aHost && f && diff !== 0) {
      aHost.innerHTML = '<div class="alert-diff"><div><b>La factura no coincide.</b>' +
        '<span>Factura <b>Gs. ' + fmtGs(f.monto) + '</b> vs. repartos <b>Gs. ' + fmtGs(totPr) + '</b> · diferencia <b>' + (diff > 0 ? '+' : '') + fmtGs(diff) + ' Gs.</b> ' +
        (diff > 0 ? 'cobra de más' : 'cobra de menos') + '. Revisá los repartos o corregí la factura.</span></div></div>';
      if (window.gsap) {
        gsap.from(aHost.firstElementChild, { opacity: 0, y: -12, duration: .4, ease: 'power2.out', clearProps: 'all' });
        var aIc = aHost.querySelector('svg');
        if (aIc) gsap.fromTo(aIc, { scale: .4, rotation: -12 }, { scale: 1, rotation: 0, duration: .5, delay: .18, ease: 'back.out(2.6)', clearProps: 'transform' });
      }
    }
    // Resumen + Control de factura, lado a lado
    var resumen = '<div class="resumen"><div class="resumen__hd">Resumen general</div>' +
      '<div class="resumen__row"><span>Repartos</span><b data-n="' + totN + '">' + totN + '</b></div>' +
      '<div class="resumen__row"><span>KM total</span><b data-n="' + totKm + '">' + fmtGs(totKm) + '</b></div>' +
      '<div class="resumen__row"><span>Precio total</span><b data-n="' + totPr + '" data-pre="Gs. ">Gs. ' + fmtGs(totPr) + '</b></div></div>';
    var cmp = '';
    if (f) {
      var dc = diff === 0 ? 'ok' : (diff > 0 ? 'over' : 'under');
      cmp = '<div class="fac-cmp ' + (diff === 0 ? '' : 'is-diff') + '"><div class="fac-cmp__hd">' + IC.receipt + 'Control de factura</div>' +
        '<div class="fac-cmp__row"><span>Factura Nº ' + esc(f.nro || '—') + '</span><b data-n="' + (f.monto || 0) + '" data-pre="Gs. ">Gs. ' + fmtGs(f.monto) + '</b></div>' +
        '<div class="fac-cmp__row"><span>Total repartos</span><b data-n="' + totPr + '" data-pre="Gs. ">Gs. ' + fmtGs(totPr) + '</b></div>' +
        '<div class="fac-cmp__row fac-cmp__diff"><span>Diferencia</span><span class="fac-diff ' + dc + '">' + (diff === 0 ? 'Coincide ✓' : (diff > 0 ? '+' : '') + fmtGs(diff)) + '</span></div></div>';
    }
    if (dHost) { dHost.innerHTML = '<div class="dual">' + resumen + cmp + '</div>'; countUpAll(dHost); }
    if (window.gsap) { gsap.from('#repHost tbody tr', { opacity: 0, x: -8, duration: .3, stagger: .015, ease: 'power2.out', clearProps: 'all' }); gsap.from('#dualHost .dual > *', { opacity: 0, y: 14, scale: .98, duration: .42, delay: .12, stagger: .08, ease: 'power2.out', clearProps: 'all' }); }
  }

  function zonaOptsData(tipo) {
    var cat = TIPO_CAT[tipo], list = cat ? ZONAS.filter(function (z) { return z.categoria === cat; }) : ZONAS;
    return list.map(function (z) { return { value: z.nombre, label: z.nombre }; });
  }
  /* ══════════ Alta / edición múltiple de repartos (tabla tipo Excel) ══════════ */
  function openRepartoBatch() {
    var p = S.current, ts = tsById(p.transportadora_id), trucks = ts ? ts.trucks : [];
    var existing = repsOf(p.id), wasEmpty = existing.length === 0;
    var rows = [];
    var bd = el('<div class="modal-bd br-bd"><div class="modal-box br-box">' +
      '<div class="br-hd"><div class="br-hd__l"><div class="br-hd__ic">' + IC.plus + '</div><div><h3>Repartos de la planilla</h3>' +
        '<span class="br-sub">' + esc(p.transportadora_nombre) + ' · ' + (p.semana_desde ? isoToDisp(p.semana_desde) + ' al ' + isoToDisp(p.semana_hasta) : '—') + '</span></div></div>' +
        '<div class="br-hd__r"><span class="br-count" id="brCount"></span><button class="modal-x" data-close>&times;</button></div></div>' +
      '<div class="br-wrap"><table class="br-table"><colgroup>' +
        '<col style="width:38px"><col style="width:132px"><col style="width:168px"><col style="width:214px"><col style="width:182px"><col style="width:170px"><col style="width:104px"><col style="width:146px"><col style="width:186px"><col style="width:44px">' +
      '</colgroup><thead><tr>' +
        '<th class="br-th-n">#</th><th>Fecha <i>*</i></th><th>Tipo <i>*</i></th><th>Chofer / Camión <i>*</i></th><th>Repartidor <i>*</i></th><th>Zona <i>*</i></th><th>KM</th><th>Precio (Gs.)</th><th>Observación</th><th></th>' +
      '</tr></thead><tbody id="brBody"></tbody></table></div>' +
      '<div class="br-add"><button class="btn btn--sm" id="brAddRow">' + IC.plus + 'Agregar fila</button></div>' +
      '<div class="modal-foot"><button class="btn" data-close>Cancelar</button><button class="btn btn--primary btn--lg" id="brSave">' + IC.check + 'Guardar repartos</button></div>' +
      '</div></div>');
    document.body.appendChild(bd);
    var body = bd.querySelector('#brBody');
    function close() {
      if (window.gsap) {
        gsap.to(bd.querySelector('.br-box'), { y: 18, scale: .97, opacity: 0, duration: .2, ease: 'power2.in' });
        gsap.to(bd, { opacity: 0, duration: .24, ease: 'power2.in', onComplete: function () { bd.remove(); } });
      } else { bd.classList.remove('open'); setTimeout(function () { bd.remove(); }, 180); }
    }
    function renumber() { rows.forEach(function (c, i) { c.el.querySelector('.br-n').textContent = i + 1; }); var cnt = bd.querySelector('#brCount'); if (cnt) cnt.textContent = rows.length + (rows.length === 1 ? ' fila' : ' filas'); }
    function makeRow(seed) {
      seed = seed || {};
      var tr = el('<tr class="br-row">' +
        '<td class="br-n"></td>' +
        '<td><input class="br-inp br-fecha" type="date"></td>' +
        '<td><div class="ss br-tipo"></div></td>' +
        '<td><div class="ss br-cam"></div></td>' +
        '<td><div class="ss br-rep"></div></td>' +
        '<td><div class="ss br-zona"></div></td>' +
        '<td><input class="br-inp br-money br-km" inputmode="numeric" placeholder="0"></td>' +
        '<td><input class="br-inp br-money br-precio" inputmode="numeric" placeholder="0"></td>' +
        '<td><input class="br-inp br-obs" placeholder="—"></td>' +
        '<td><button class="br-del" title="Quitar fila">' + IC.trash + '</button></td></tr>');
      var fecha = tr.querySelector('.br-fecha'); fecha.value = seed.fecha ? String(seed.fecha).slice(0, 10) : todayISO();
      var kmInp = tr.querySelector('.br-km'), prInp = tr.querySelector('.br-precio'), obsInp = tr.querySelector('.br-obs');
      if (seed.km) kmInp.value = fmtGs(seed.km); if (seed.precio) prInp.value = fmtGs(seed.precio); if (seed.observacion) obsInp.value = seed.observacion;
      var zonaSel = SSelect(tr.querySelector('.br-zona'), { search: true, value: seed.zona || null, placeholder: '— Zona —', options: zonaOptsData(seed.tipo || 'CAPITAL') });
      var tipoSel = SSelect(tr.querySelector('.br-tipo'), { value: seed.tipo || 'CAPITAL', options: TIPOS.map(function (t) { return { value: t, label: t }; }), onChange: function (v) { zonaSel.setOptions(zonaOptsData(v)); } });
      var camSel = SSelect(tr.querySelector('.br-cam'), { search: true, value: seed.camion_id || null, placeholder: '— Camión —', options: trucks.map(function (t) { return { value: t.id, label: t.d }; }) });
      var repSel = SSelect(tr.querySelector('.br-rep'), { search: true, value: seed.repartidor || null, placeholder: '— Repartidor —', options: REPARTIDORES.map(function (x) { return { value: x, label: x }; }) });
      [kmInp, prInp].forEach(function (inp) { inp.addEventListener('input', function () { var n = parseMoney(inp.value); inp.value = n > 0 ? fmtGs(n) : ''; inp.setSelectionRange(inp.value.length, inp.value.length); }); });
      tr.querySelectorAll('input,.ss-btn').forEach(function (x) { x.addEventListener('input', function () { tr.classList.remove('br-row--err'); }); });
      var ctrl = {
        el: tr, id: seed.id || null,
        read: function () { var camId = +camSel.get(), t2 = trucks.find(function (t) { return t.id === camId; }); return { fecha: fecha.value || null, tipo: tipoSel.get(), camion_id: camId, camion_desc: t2 ? t2.d : '', repartidor: repSel.get() || null, zona: zonaSel.get() || null, km: parseMoney(kmInp.value), precio: parseMoney(prInp.value), observacion: (obsInp.value || '').trim() || null }; },
        isEmpty: function () { return !camSel.get() && !repSel.get() && !zonaSel.get() && !parseMoney(prInp.value) && !parseMoney(kmInp.value) && !obsInp.value.trim(); }
      };
      tr.querySelector('.br-del').addEventListener('click', function () { removeRow(ctrl); });
      return ctrl;
    }
    function addRow(seed, noAnim) {
      var c = makeRow(seed); rows.push(c); body.appendChild(c.el); renumber();
      if (window.gsap && !noAnim) gsap.fromTo(c.el, { opacity: 0, y: -12, backgroundColor: 'rgba(59,130,246,.10)' }, { opacity: 1, y: 0, backgroundColor: 'rgba(59,130,246,0)', duration: .45, ease: 'power2.out', clearProps: 'backgroundColor,transform' });
      return c;
    }
    function removeRow(c) {
      var i = rows.indexOf(c); if (i < 0) return; rows.splice(i, 1);
      if (window.gsap) gsap.to(c.el, { opacity: 0, x: 20, duration: .22, ease: 'power2.in', onComplete: function () { c.el.remove(); if (!rows.length) addRow(); renumber(); } });
      else { c.el.remove(); if (!rows.length) addRow(); renumber(); }
    }
    if (existing.length) { existing.forEach(function (r) { addRow(r, true); }); }
    else { addRow(null, true); addRow(null, true); addRow(null, true); }
    requestAnimationFrame(function () {
      bd.classList.add('open');
      if (window.gsap) {
        gsap.from(bd, { opacity: 0, duration: .25, ease: 'power2.out' });
        gsap.fromTo(bd.querySelector('.br-box'), { y: 34, scale: .95, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: .5, ease: 'power3.out' });
        gsap.from(bd.querySelectorAll('.br-row'), { opacity: 0, y: 14, duration: .4, stagger: .05, delay: .16, ease: 'power2.out', clearProps: 'all' });
      }
    });
    bd.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', close); });
    bd.addEventListener('click', function (e) { if (e.target === bd) close(); });
    q('#brAddRow', bd).addEventListener('click', function () { addRow(); var w = q('.br-wrap', bd); w.scrollTop = w.scrollHeight; });
    q('#brSave', bd).addEventListener('click', function () {
      rows.forEach(function (c) { c.el.classList.remove('br-row--err'); });
      var out = [], bad = null;
      rows.forEach(function (c) {
        if (c.isEmpty()) return;
        var d = c.read();
        if (!d.fecha || !d.tipo || !d.camion_id || !d.repartidor || !d.zona) { if (!bad) bad = c; c.el.classList.add('br-row--err'); return; }
        d._id = c.id; out.push(d);
      });
      if (bad) { toast('Completá Fecha, Tipo, Camión, Repartidor y Zona en las filas marcadas', 'err'); return; }
      if (!out.length) { toast('Cargá al menos una fila', 'err'); return; }
      DB.repartos = DB.repartos.filter(function (r) { return r.planilla_id !== p.id; });
      out.forEach(function (d, i) { d.id = d._id || nid(); delete d._id; d.planilla_id = p.id; d.orden = i; DB.repartos.push(d); });
      save();
      var acc = wasEmpty ? 'add_reparto' : 'edit_reparto';
      logAudit(acc, out.length + ' reparto(s) · #' + String(p.id).padStart(4, '0'), ['Gs ' + fmtGs(out.reduce(function (s, x) { return s + x.precio; }, 0))], p.id);
      close(); renderRepartos(); toast('Repartos guardados ✓');
    });
  }

  // (openRepartoModal y delReparto se retiraron: el alta/edición/borrado de repartos
  //  ahora se hace todo desde el modal batch tipo Excel — openRepartoBatch.)

  /* ══════════ FACTURAS ══════════ */
  function planillasOf(tsId) { return DB.planillas.filter(function (p) { return p.transportadora_id === tsId; }); }
  function plLabel(p) { return 'Semana ' + isoToDisp(p.semana_desde) + ' · #' + String(p.id).padStart(4, '0'); }
  function plOptions(tsId, exceptFacId) {
    return planillasOf(tsId).map(function (p) {
      var t = planillaTotals(p.id), yaFact = p.factura_id && p.factura_id !== exceptFacId;
      return { value: p.id, label: plLabel(p), sub: 'Gs ' + fmtGs(t.precio) + (yaFact ? ' · ya facturada' : '') };
    });
  }
  function renderFacturas(highlightId) {
    var stage = q('#stage');
    var facs = DB.facturas.filter(function (f) { return matchesFilter(f.fecha); });
    var alcance = S.semana ? 'la semana ' + isoToDisp(S.semana).slice(0, 5) + '–' + isoToDisp(weekEnd(S.semana)).slice(0, 5) : mesLabel(S.mes);
    // KPIs sobre el período
    var totFact = facs.reduce(function (s, f) { return s + (Number(f.monto) || 0); }, 0);
    var concN = 0, difN = 0, difSum = 0;
    facs.forEach(function (f) { var pl = DB.planillas.find(function (p) { return p.id === f.planilla_id; }); var d = (Number(f.monto) || 0) - (pl ? planillaTotals(pl.id).precio : 0); if (d === 0) concN++; else { difN++; difSum += d; } });
    var sinVinc = DB.planillas.filter(function (p) { return matchesFilter(p.semana_desde) && !p.factura_id; }).length;
    function kpi(cls, ico, lbl, val, sub) {
      return '<div class="fkpi ' + cls + '"><div class="fkpi__ic">' + ico + '</div><div class="fkpi__tx"><span class="fkpi__lbl">' + lbl + '</span>' +
        '<b class="fkpi__val">' + val + '</b>' + (sub ? '<span class="fkpi__sub">' + sub + '</span>' : '') + '</div></div>';
    }
    var kpis = '<div class="fkpi-grid">' +
      kpi('k-brand', IC.receipt, 'Total facturado', '<span data-n="' + totFact + '" data-pre="Gs. ">Gs. ' + fmtGs(totFact) + '</span>', facs.length + ' factura' + (facs.length === 1 ? '' : 's')) +
      kpi('k-ok', IC.check, 'Conciliadas', concN + ' <small>de ' + facs.length + '</small>', 'coinciden con la planilla') +
      kpi('k-diff', IC.alert, 'Con diferencia', String(difN), difN ? (difSum > 0 ? '+' : '') + fmtGs(difSum) + ' Gs. neto' : 'todo cuadra') +
      kpi('k-pend', IC.doc, 'Sin vincular', String(sinVinc), 'planilla' + (sinVinc === 1 ? '' : 's') + ' sin factura') +
      '</div>';
    var search = '<div class="fac-toolbar"><div class="fac-search">' + IC.search + '<input type="text" id="facSearch" placeholder="Buscar por Nº, transportadora o planilla…" value="' + esc(S.facSearch || '') + '" autocomplete="off"></div></div>';
    stage.innerHTML = '<div class="view-hd"><h2>Facturas</h2><span class="count-badge">' + facs.length + '</span>' +
      monthNavHtml() + '<div class="spacer"></div>' +
      '<button class="btn btn--primary" id="btnNewFac">' + IC.plus + 'Registrar factura</button>' + bellHtml() + '</div>' +
      weekChipsHtml() + kpis + search + '<div id="facHost"></div>';
    q('#btnNewFac').addEventListener('click', function () { facturaModal(null); });
    wireMonthNav(stage, renderFacturas); wireWeekChips(stage, renderFacturas); wireBell();
    animHeader(stage);
    if (window.gsap) gsap.from('#stage .fkpi', { opacity: 0, y: 14, duration: .4, stagger: .05, delay: .05, ease: 'power3.out', clearProps: 'all' });
    countUpAll(stage);
    var host = q('#facHost'), dx = S._dir; S._dir = 0;
    var searchInp = q('#facSearch', stage);
    function paint(anim) {
      var qtext = (S.facSearch || '').toLowerCase().trim();
      var list = facs.filter(function (f) {
        if (!qtext) return true;
        var pl = DB.planillas.find(function (p) { return p.id === f.planilla_id; });
        return ((f.nro || '') + ' ' + (f.transportadora_nombre || '') + ' ' + (pl ? plLabel(pl) : '')).toLowerCase().indexOf(qtext) !== -1;
      });
      if (!facs.length) { host.innerHTML = '<div class="empty-mini">' + IC.doc + '<div>Sin facturas en ' + alcance + '.<br>Registrá una con “Registrar factura” o cambiá de mes/semana.</div></div>'; animEmpty(host); return; }
      if (!list.length) { host.innerHTML = '<div class="empty-mini">' + IC.search + '<div>Ninguna factura coincide con “' + esc(S.facSearch) + '”.</div></div>'; return; }
      var rows = list.slice().reverse().map(function (f) {
        var pl = DB.planillas.find(function (p) { return p.id === f.planilla_id; });
        var totPl = pl ? planillaTotals(pl.id).precio : 0, diff = (f.monto || 0) - totPl;
        var cls = diff === 0 ? 'ok' : (diff > 0 ? 'over' : 'under');
        var st = pl ? planillaStatus(pl) : null;
        return '<tr' + (f.id === highlightId ? ' class="is-sel"' : '') + ' data-fid="' + f.id + '">' +
          '<td class="rep-desc">' + esc(f.nro || '—') + '</td>' +
          '<td>' + isoToDisp(f.fecha) + '</td>' +
          '<td>' + esc(f.transportadora_nombre || '—') + '</td>' +
          '<td>' + (pl ? plLabel(pl) : '<span style="color:var(--alas-text-3)">— sin planilla —</span>') + '</td>' +
          '<td class="c">' + (st ? '<span class="chip ' + ST_CHIP[st] + '">' + ST_SHORT[st] + '</span>' : '—') + '</td>' +
          '<td class="r rep-num">' + fmtGs(f.monto) + '</td>' +
          '<td class="r rep-num">' + fmtGs(totPl) + '</td>' +
          '<td class="r"><span class="fac-diff ' + cls + '">' + (diff === 0 ? 'Coincide' : (diff > 0 ? '+' : '') + fmtGs(diff)) + '</span></td>' +
          '<td class="r"><span class="row-act">' +
            (pl ? '<button class="iconbtn" data-vpl="' + f.planilla_id + '" title="Ver planilla">' + IC.doc + '</button>' : '') +
            '<button class="iconbtn" data-efac="' + f.id + '" title="Editar">' + IC.edit + '</button>' +
            '<button class="iconbtn iconbtn--del" data-dfac="' + f.id + '" title="Eliminar">' + IC.trash + '</button></span></td></tr>';
      }).join('');
      host.innerHTML = '<div class="rep-wrap"><div class="rep-scroll"><table class="rep"><thead><tr>' +
        '<th>Nº Factura</th><th>Fecha</th><th>Transportadora</th><th>Planilla / semana</th><th class="c">Estado</th><th class="r">Monto factura</th><th class="r">Total planilla</th><th class="r">Diferencia</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
      host.querySelectorAll('[data-efac]').forEach(function (b) { b.addEventListener('click', function () { facturaModal(DB.facturas.find(function (x) { return x.id === +b.dataset.efac; })); }); });
      host.querySelectorAll('[data-dfac]').forEach(function (b) { b.addEventListener('click', function () { delFactura(+b.dataset.dfac); }); });
      host.querySelectorAll('[data-vpl]').forEach(function (b) { b.addEventListener('click', function () { go('planilla', +b.dataset.vpl); }); });
      if (anim && window.gsap) gsap.from('#facHost tbody tr', dx
        ? { opacity: 0, x: dx * 30, duration: .4, stagger: .03, ease: 'power3.out', clearProps: 'all' }
        : { opacity: 0, x: -8, duration: .3, stagger: .02, ease: 'power2.out', clearProps: 'all' });
      var sel = highlightId != null && host.querySelector('tr.is-sel');
      if (sel) {
        sel.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (window.gsap) gsap.fromTo(sel.querySelectorAll('td'), { backgroundColor: 'rgba(59,130,246,.28)' }, { backgroundColor: 'rgba(59,130,246,.08)', duration: 1, delay: .15, ease: 'power2.out' });
      }
    }
    if (searchInp) searchInp.addEventListener('input', function () { S.facSearch = this.value; highlightId = null; paint(false); });
    paint(true);
  }
  /* ── Modal grande de factura: tarjetas de planillas pendientes de vincular ── */
  function facturaModal(f, preset, onSaved) {
    var selPl = f ? f.planilla_id : (preset ? preset.id : null);
    // Planillas candidatas: sin factura vinculada (o la vinculada a ESTA factura al editar)
    var candidatas = DB.planillas.filter(function (p) { return !p.factura_id || (f && p.factura_id === f.id); })
      .sort(function (a, b) { return String(b.semana_desde || '').localeCompare(String(a.semana_desde || '')); });
    function cardHtml(p) {
      var t = planillaTotals(p.id), st = planillaStatus(p);
      return '<button type="button" class="fpl-card' + (p.id === selPl ? ' on' : '') + '" data-pl="' + p.id + '">' +
        '<span class="fpl-card__chk">' + IC.check + '</span>' +
        '<div class="fpl-card__hd"><span class="fpl-card__ts">' + esc(p.transportadora_nombre || '—') + '</span>' +
          '<span class="chip ' + ST_CHIP[st] + '">' + ST_SHORT[st] + '</span></div>' +
        '<div class="fpl-card__wk">' + IC.cal + (p.semana_desde ? isoToDisp(p.semana_desde) + ' al ' + isoToDisp(p.semana_hasta) : 'Sin semana') + ' · #' + String(p.id).padStart(4, '0') + '</div>' +
        '<div class="fpl-card__foot"><span>' + t.n + ' reparto' + (t.n === 1 ? '' : 's') + '</span><b>Gs. ' + fmtGs(t.precio) + '</b></div></button>';
    }
    var bd = el('<div class="modal-bd"><div class="modal-box fac-box">' +
      '<div class="br-hd"><div class="br-hd__l"><div class="br-hd__ic">' + IC.receipt + '</div><div><h3>' + (f ? 'Editar factura' : 'Registrar factura') + '</h3>' +
        '<span class="br-sub">Cargá los datos y elegí la planilla a la que corresponde</span></div></div>' +
        '<div class="br-hd__r"><button class="modal-x" data-close>&times;</button></div></div>' +
      '<div class="fac-body">' +
        '<div class="fac-form">' +
          '<div class="field"><label>Nº de factura <span class="req">*</span></label><input class="inp" id="fNro" value="' + esc(f ? f.nro : '') + '" placeholder="Ej: 0010010005282" autocomplete="off"></div>' +
          dateField('fFecha', 'Fecha', (f && f.fecha ? String(f.fecha).slice(0, 10) : todayISO())) +
          '<div class="field"><label>Monto factura (Gs.) <span class="req">*</span></label><input class="inp inp--money" id="fMonto" value="' + (f && f.monto ? fmtGs(f.monto) : '') + '" placeholder="0" inputmode="numeric"></div>' +
        '</div>' +
        '<div class="fac-sec"><span class="fac-sec__lbl">Planilla a vincular <span class="req">*</span></span><span class="br-count">' + candidatas.length + ' pendiente' + (candidatas.length === 1 ? '' : 's') + '</span></div>' +
        (candidatas.length
          ? '<div class="fpl-grid" id="fplGrid">' + candidatas.map(cardHtml).join('') + '</div>'
          : '<div class="empty-mini">' + IC.doc + '<div>No hay planillas pendientes de vincular.<br>Creá una planilla con repartos primero.</div></div>') +
        '<div class="fac-live" id="facLive" hidden><span class="fac-live__lbl">Comparación</span><span id="facLiveTx"></span><span class="fac-diff" id="facLiveChip"></span></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" data-close>Cancelar</button><button class="btn btn--primary btn--lg" id="fOk">' + IC.check + (f ? 'Guardar cambios' : 'Registrar factura') + '</button></div>' +
      '</div></div>');
    document.body.appendChild(bd);
    function close() {
      if (window.gsap) {
        gsap.to(bd.querySelector('.fac-box'), { y: 16, scale: .97, opacity: 0, duration: .2, ease: 'power2.in' });
        gsap.to(bd, { opacity: 0, duration: .24, ease: 'power2.in', onComplete: function () { bd.remove(); } });
      } else { bd.classList.remove('open'); setTimeout(function () { bd.remove(); }, 200); }
    }
    bd.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', close); });
    bd.addEventListener('click', function (e) { if (e.target === bd) close(); });
    var monto = q('#fMonto', bd);
    function updateLive() {
      var live = q('#facLive', bd), n = parseMoney(monto.value);
      if (!selPl) { live.hidden = true; return; }
      var tot = planillaTotals(selPl).precio, diff = n - tot;
      live.hidden = false;
      q('#facLiveTx', bd).innerHTML = 'Factura <b>Gs. ' + fmtGs(n) + '</b> vs. planilla <b>Gs. ' + fmtGs(tot) + '</b>';
      var chip = q('#facLiveChip', bd);
      chip.className = 'fac-diff ' + (diff === 0 ? 'ok' : (diff > 0 ? 'over' : 'under'));
      chip.textContent = diff === 0 ? 'Coincide ✓' : (diff > 0 ? '+' : '') + fmtGs(diff);
    }
    bd.querySelectorAll('.fpl-card').forEach(function (c) {
      c.addEventListener('click', function () {
        selPl = +c.dataset.pl;
        bd.querySelectorAll('.fpl-card').forEach(function (x) { x.classList.toggle('on', x === c); });
        if (window.gsap) gsap.fromTo(c, { scale: .96 }, { scale: 1, duration: .35, ease: 'back.out(2)', clearProps: 'transform' });
        if (!parseMoney(monto.value)) monto.value = fmtGs(planillaTotals(selPl).precio);
        updateLive();
      });
    });
    monto.addEventListener('input', function () { var n = parseMoney(this.value); this.value = n > 0 ? fmtGs(n) : ''; this.setSelectionRange(this.value.length, this.value.length); updateLive(); });
    if (preset && !f && selPl && !parseMoney(monto.value)) monto.value = fmtGs(planillaTotals(selPl).precio);
    updateLive();
    requestAnimationFrame(function () {
      bd.classList.add('open');
      if (window.gsap) {
        gsap.from(bd, { opacity: 0, duration: .25, ease: 'power2.out' });
        gsap.fromTo(bd.querySelector('.fac-box'), { y: 30, scale: .95, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: .48, ease: 'power3.out' });
        gsap.from(bd.querySelectorAll('.fac-form .field'), { opacity: 0, y: 12, duration: .36, stagger: .06, delay: .12, ease: 'power2.out', clearProps: 'all' });
        gsap.from(bd.querySelectorAll('.fpl-card'), { opacity: 0, y: 16, duration: .4, stagger: .05, delay: .2, ease: 'power2.out', clearProps: 'all' });
      }
    });
    q('#fOk', bd).addEventListener('click', function () {
      var nro = q('#fNro', bd).value.trim(), n = parseMoney(monto.value);
      if (!nro) { q('#fNro', bd).focus(); toast('Cargá el Nº de factura', 'err'); return; }
      if (!(n > 0)) { monto.focus(); toast('Cargá el monto de la factura', 'err'); return; }
      if (!selPl) { toast('Elegí la planilla a vincular', 'err'); return; }
      var pl = DB.planillas.find(function (p) { return p.id === selPl; });
      var data = { nro: nro, fecha: q('#fFecha', bd).value || null, transportadora_id: pl ? pl.transportadora_id : null, transportadora_nombre: pl ? pl.transportadora_nombre : '', planilla_id: selPl, monto: n };
      if (data.fecha) { S.mes = monthKey(data.fecha); S.semana = null; }
      var fid;
      if (f) { Object.assign(f, data); fid = f.id; } else { data.id = nid(); DB.facturas.push(data); fid = data.id; }
      // vincular: quitar de la planilla anterior y marcar la nueva (sigue editable hasta enviarla a auditoría)
      DB.planillas.forEach(function (p) { if (p.factura_id === fid && p.id !== selPl) p.factura_id = null; });
      if (pl) pl.factura_id = fid;
      save(); close();
      var difc = n - planillaTotals(selPl).precio;
      logAudit(difc === 0 ? 'factura_ok' : 'factura_diff', 'Factura Nº ' + nro + ' · #' + String(selPl).padStart(4, '0'), ['Gs ' + fmtGs(n)].concat(difc !== 0 ? ['dif. ' + (difc > 0 ? '+' : '') + fmtGs(difc)] : []), selPl);
      if (difc !== 0) toast('Factura vinculada — NO coincide (dif. ' + (difc > 0 ? '+' : '') + fmtGs(difc) + ')', 'err');
      else toast('Conciliada ✓ — ya podés enviarla a auditoría');
      if (onSaved) onSaved(); else renderFacturas();
    });
  }
  function delFactura(id) {
    var ff = DB.facturas.find(function (x) { return x.id === id; });
    if (!ff) return;
    confirmPro({
      title: '¿Eliminar esta factura?', danger: true, icon: IC.trash, okIcon: IC.trash,
      text: 'Se elimina la factura <b>Nº ' + esc(ff.nro || '—') + '</b> (Gs. ' + fmtGs(ff.monto) + ') y se desvincula de su planilla.',
      okLabel: 'Eliminar factura',
      onOk: function () {
        DB.planillas.forEach(function (p) { if (p.factura_id === id) p.factura_id = null; });
        DB.facturas = DB.facturas.filter(function (x) { return x.id !== id; });
        save(); logAudit('del_factura', 'Factura Nº ' + (ff.nro || '—'), ['Gs ' + fmtGs(ff.monto)], ff.planilla_id);
        toast('Factura eliminada'); renderFacturas();
      }
    });
  }

  /* ── Modal genérico ── */
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

  /* ── Iconos ── */
  var IC = {
    plus: '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    back: '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    print: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"/></svg>',
    edit: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-7M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>',
    doc: '<svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>',
    chevron: '<svg class="ss-arr" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    check: '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
    search: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
    cal: '<svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    arrowR: '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    arrowL: '<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    lock: '<svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
    receipt: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M5 3h14a1 1 0 011 1v17l-3-2-3 2-3-2-3 2-3-2V4a1 1 0 011-1z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    alert: '<svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    clock: '<svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    bell: '<svg fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>',
    note: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><path d="M8 9h8M8 13h5"/></svg>',
    truck: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h13v13H1z"/><path d="M14 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="1.6"/><circle cx="17.5" cy="18.5" r="1.6"/></svg>',
    user: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0112 0v1"/></svg>',
    tag: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0l-8-8V4h8.6l9.4 9.4z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>',
    up: '<svg fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14l5-5 5 5"/></svg>',
    down: '<svg fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10l5 5 5-5"/></svg>',
    km: '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.3-7-11a7 7 0 0114 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>'
  };
  function bellHtml() { return '<div class="notif-wrap"><button class="notif-btn" id="btnNotif" type="button" title="Notificaciones">' + IC.bell + '<span class="notif-badge" id="notifBadge" hidden>0</span></button></div>'; }
  function wireBell() { var b = document.getElementById('btnNotif'); if (b) b.addEventListener('click', function (e) { e.stopPropagation(); toggleNotif(); }); refreshNotifBadge(); }

  /* ══════════ SSelect — desplegable PRO (buscador + panel fijo + GSAP) ══════════ */
  var _ssPop = null, _ssCur = null;
  function flat(cfg) { return cfg.groups ? cfg.groups.reduce(function (a, g) { return a.concat(g.options); }, []) : (cfg.options || []); }
  function SSelect(host, cfg) {
    cfg = cfg || {};
    var value = cfg.value != null ? String(cfg.value) : null;
    host.classList.add('ss');
    host.innerHTML = '<button type="button" class="ss-btn"><span class="ss-lbl"></span>' + IC.chevron + '</button>';
    var btn = host.querySelector('.ss-btn'), lbl = host.querySelector('.ss-lbl');
    function optOf(v) { return flat(cfg).find(function (o) { return String(o.value) === String(v); }); }
    function paint() { var o = value != null ? optOf(value) : null; lbl.textContent = o ? o.label : (cfg.placeholder || '— Elegir —'); lbl.classList.toggle('ph', !o); }
    paint();
    btn.addEventListener('click', function (e) { e.stopPropagation(); openSS(host, cfg, value, function (v, o) { value = v; paint(); if (cfg.onChange) cfg.onChange(v, o); }); });
    return {
      get: function () { return value; },
      set: function (v) { value = v != null ? String(v) : null; paint(); },
      setOptions: function (opts) { cfg.options = opts; cfg.groups = null; if (value && !optOf(value)) { value = null; paint(); } }
    };
  }
  function ensureSS() {
    if (_ssPop) return _ssPop;
    var p = el('<div class="ss-pop"><div class="ss-pop__search"><span class="ss-pop__sico">' + IC.search + '</span><input type="text" placeholder="Buscar..." autocomplete="off"></div><div class="ss-pop__list"></div></div>');
    document.body.appendChild(p);
    p.querySelector('input').addEventListener('input', function (e) { ssRender(e.target.value); });
    p.querySelector('input').addEventListener('keydown', function (e) { if (e.key === 'Enter') { var f = p.querySelector('.ss-item'); if (f) f.click(); } });
    document.addEventListener('click', function (e) { if (_ssPop && _ssPop.classList.contains('open') && !_ssPop.contains(e.target) && !(_ssCur && _ssCur.host.contains(e.target))) closeSS(); });
    window.addEventListener('scroll', function (e) { if (_ssPop && _ssPop.classList.contains('open') && !_ssPop.contains(e.target)) closeSS(); }, true);
    _ssPop = p; return p;
  }
  function openSS(host, cfg, value, onPick) {
    var p = ensureSS(); _ssCur = { host: host, cfg: cfg, value: value, onPick: onPick };
    p.querySelector('.ss-pop__search').style.display = cfg.search ? '' : 'none';
    ssRender('');
    var r = host.getBoundingClientRect(), w = Math.max(r.width, cfg.minW || 240);
    var below = window.innerHeight - r.bottom - 16, above = r.top - 16, up = below < 260 && above > below;
    var maxH = Math.min(340, Math.max(180, up ? above : below));
    p.style.width = w + 'px'; p.style.maxHeight = maxH + 'px'; p.style.left = Math.min(r.left, window.innerWidth - w - 12) + 'px';
    if (up) { p.style.top = 'auto'; p.style.bottom = (window.innerHeight - r.top + 6) + 'px'; } else { p.style.bottom = 'auto'; p.style.top = (r.bottom + 6) + 'px'; }
    p.classList.add('open'); host.querySelector('.ss-btn').classList.add('open');
    if (cfg.search) { var i = p.querySelector('input'); i.value = ''; setTimeout(function () { i.focus(); }, 40); }
    if (window.gsap) gsap.fromTo(p, { opacity: 0, y: up ? 8 : -8, scale: .97 }, { opacity: 1, y: 0, scale: 1, duration: .22, ease: 'back.out(1.5)', clearProps: 'transform' });
  }
  function closeSS() {
    if (!_ssPop) return;
    document.querySelectorAll('.ss-btn.open').forEach(function (b) { b.classList.remove('open'); });
    var p = _ssPop; _ssCur = null;
    if (window.gsap) gsap.to(p, { opacity: 0, y: -6, scale: .98, duration: .14, ease: 'power2.in', onComplete: function () { p.classList.remove('open'); gsap.set(p, { clearProps: 'all' }); } });
    else p.classList.remove('open');
  }
  function ssRender(qs) {
    var p = _ssPop, list = p.querySelector('.ss-pop__list'), cfg = _ssCur.cfg; qs = (qs || '').toLowerCase().trim();
    function it(o) { var on = String(_ssCur.value) === String(o.value); return '<button type="button" class="ss-item' + (on ? ' on' : '') + '" data-v="' + esc(o.value) + '"><span class="ss-item-lbl">' + esc(o.label) + (o.sub ? ' <small>' + esc(o.sub) + '</small>' : '') + '</span><span class="ss-chk">' + IC.check + '</span></button>'; }
    var html = '';
    if (cfg.groups) cfg.groups.forEach(function (g) { var os = g.options.filter(function (o) { return !qs || (o.label + ' ' + (o.sub || '')).toLowerCase().indexOf(qs) !== -1; }); if (os.length) html += '<div class="ss-group">' + esc(g.label) + '</div>' + os.map(it).join(''); });
    else html = (cfg.options || []).filter(function (o) { return !qs || (o.label + ' ' + (o.sub || '')).toLowerCase().indexOf(qs) !== -1; }).map(it).join('');
    list.innerHTML = html || '<div class="ss-empty">Sin resultados</div>';
    list.querySelectorAll('.ss-item').forEach(function (b) { b.addEventListener('click', function () { var v = b.dataset.v, o = flat(cfg).find(function (x) { return String(x.value) === String(v); }); _ssCur.value = v; _ssCur.onPick(v, o); closeSS(); }); });
  }

  /* ── Boot ── */
  var _inited = false;
  window.__initFacturas = function () {
    if (_inited) return; _inited = true;
    initDB(); // DB desde localStorage (cache/offline) o vacío
    document.querySelectorAll('[data-nav]').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.nav); }); });
    document.addEventListener('click', hideTip);
    window.addEventListener('scroll', hideTip, true);

    if (window.CFDB && CFDB.available) {
      CFDB.onError = function () { toast('No se pudo guardar en la nube — reintentando', 'err'); };
      go('dashboard'); // pinta con lo local mientras llega la nube (sin pantalla vacía)
      CFDB.loadAll().then(function (data) {
        if (data.empty && DB.planillas && DB.planillas.length) {
          // Primer arranque: nube vacía + hay datos locales → migrar hacia la nube
          CFDB.sync(DB);
        } else {
          DB.planillas = data.planillas; DB.repartos = data.repartos;
          DB.facturas = data.facturas; DB.audit = data.audit; DB.seq = data.seq;
          saveLocal();
        }
        go('dashboard'); // re-render con los datos ya sincronizados
      }).catch(function (e) {
        console.error('[CFDB] carga inicial falló, sigo en modo local', e);
        toast('Sin conexión a la base — modo local', 'err');
      });
    } else {
      save(); // modo local puro (comportamiento original)
      go('dashboard');
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { window.__initFacturas(); });
  else window.__initFacturas();
})();
