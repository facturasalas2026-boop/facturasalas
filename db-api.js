/* ============================================================
 * db-api.js — Control de Facturas · capa de datos Supabase
 * ------------------------------------------------------------
 * Modelo "snapshot-mirror": la app sigue operando sobre el objeto
 * DB en memoria (como en modo local). Esta capa:
 *   • loadAll()  → trae todo de Supabase y arma el DB (o migra el local).
 *   • sync(DB)   → en cada save() refleja el estado exacto en la nube
 *                  (upsert de todo + borra lo que ya no está).
 * Single-flight: nunca corren dos sync a la vez; si llega otro mientras
 * uno está en curso, se reencola uno solo al terminar.
 *
 * Requiere (cargados antes en index.html):
 *   @supabase/supabase-js  →  window.supabase
 *   supabase-config.js     →  window.SUPABASE_CONFIG
 * Si falta cualquiera, CFDB.available = false y la app cae a modo local.
 * ============================================================ */
(function () {
  var CFG = window.SUPABASE_CONFIG;
  var sb = null;
  try {
    if (window.supabase && CFG && CFG.url && CFG.anonKey && CFG.url.indexOf('TU-PROYECTO') < 0) {
      sb = window.supabase.createClient(CFG.url, CFG.anonKey, { auth: { persistSession: false } });
    }
  } catch (e) { console.error('[CFDB] no se pudo crear el cliente Supabase', e); }

  var TABLES = { planillas: 'fact_planillas', repartos: 'fact_repartos', facturas: 'fact_facturas', audit: 'fact_audit' };

  // ── Coerción (PostgREST devuelve numeric/bigint como string) ──
  function num(v) { return v == null ? null : Number(v); }
  function mapPlanilla(r) {
    return { id: num(r.id), transportadora_id: num(r.transportadora_id), transportadora_nombre: r.transportadora_nombre || '',
             semana_desde: r.semana_desde || null, semana_hasta: r.semana_hasta || null,
             estado: r.estado || 'abierta', factura_id: r.factura_id == null ? null : num(r.factura_id) };
  }
  function mapReparto(r) {
    return { id: num(r.id), planilla_id: num(r.planilla_id), fecha: r.fecha || null, tipo: r.tipo,
             repartidor: r.repartidor || null, zona: r.zona || null, camion_id: r.camion_id == null ? null : num(r.camion_id),
             camion_desc: r.camion_desc || '', km: num(r.km) || 0, precio: num(r.precio) || 0,
             observacion: r.observacion || null, orden: num(r.orden) || 0 };
  }
  function mapFactura(r) {
    return { id: num(r.id), nro: r.nro || '', fecha: r.fecha || null, transportadora_id: r.transportadora_id == null ? null : num(r.transportadora_id),
             transportadora_nombre: r.transportadora_nombre || '', monto: num(r.monto) || 0, planilla_id: r.planilla_id == null ? null : num(r.planilla_id) };
  }
  function mapAudit(r) {
    return { id: num(r.id), ts: r.ts ? new Date(r.ts).toISOString() : new Date().toISOString(), accion: r.accion,
             usuario: r.usuario || '', detalle: r.detalle || '', chips: Array.isArray(r.chips) ? r.chips : [],
             planilla_id: r.planilla_id == null ? null : num(r.planilla_id) };
  }
  var MAPPERS = { planillas: mapPlanilla, repartos: mapReparto, facturas: mapFactura, audit: mapAudit };

  // ── Fetch paginado (por si la auditoría supera 1000 filas) ──
  function fetchAll(table) {
    var out = [], page = 1000;
    function next(from) {
      return sb.from(table).select('*').order('id', { ascending: true }).range(from, from + page - 1)
        .then(function (res) {
          if (res.error) throw res.error;
          out = out.concat(res.data || []);
          if ((res.data || []).length < page) return out;
          return next(from + page);
        });
    }
    return next(0);
  }

  // ── loadAll: trae todo y arma el DB en memoria ──
  function loadAll() {
    return Promise.all([fetchAll(TABLES.planillas), fetchAll(TABLES.repartos), fetchAll(TABLES.facturas), fetchAll(TABLES.audit)])
      .then(function (res) {
        var planillas = res[0].map(mapPlanilla), repartos = res[1].map(mapReparto),
            facturas = res[2].map(mapFactura), audit = res[3].map(mapAudit);
        var maxId = 0;
        [planillas, repartos, facturas, audit].forEach(function (arr) {
          arr.forEach(function (o) { if (o.id > maxId) maxId = o.id; });
        });
        var empty = !planillas.length && !repartos.length && !facturas.length && !audit.length;
        return { planillas: planillas, repartos: repartos, facturas: facturas, audit: audit, seq: maxId + 1, empty: empty };
      });
  }

  // ── Reconcile de una tabla: upsert de lo local + borra lo ausente ──
  function reconcile(key, rows) {
    var table = TABLES[key], map = MAPPERS[key];
    var clean = (rows || []).map(map);
    var ids = clean.map(function (r) { return r.id; });
    var step = Promise.resolve();
    if (clean.length) {
      step = step.then(function () {
        return sb.from(table).upsert(clean, { onConflict: 'id' }).then(function (res) { if (res.error) throw res.error; });
      });
    }
    return step.then(function () {
      var del = sb.from(table).delete();
      del = ids.length ? del.not('id', 'in', '(' + ids.join(',') + ')') : del.gte('id', 0);
      return del.then(function (res) { if (res.error) throw res.error; });
    });
  }

  // Orden: padres → hijos → auditoría (sin FK duro, pero mantiene coherencia visual)
  function flush(DB) {
    return reconcile('planillas', DB.planillas)
      .then(function () { return reconcile('repartos', DB.repartos); })
      .then(function () { return reconcile('facturas', DB.facturas); })
      .then(function () { return reconcile('audit', DB.audit); });
  }

  // ── Single-flight con reencolado trailing ──
  var running = null, again = false, lastDB = null, timer = null;
  function sync(DB) {
    lastDB = DB;
    if (timer) clearTimeout(timer);
    if (running) { again = true; return running; }
    return new Promise(function (resolve) {
      timer = setTimeout(function () {
        timer = null;
        running = flush(lastDB)
          .catch(function (e) { console.error('[CFDB] sync falló', e); if (CFDB.onError) CFDB.onError(e); })
          .then(function () {
            running = null;
            if (again) { again = false; sync(lastDB).then(resolve); } else resolve();
          });
      }, 120);
    });
  }

  window.CFDB = {
    available: !!sb,
    client: sb,
    loadAll: loadAll,
    sync: sync,
    onError: null
  };
})();
