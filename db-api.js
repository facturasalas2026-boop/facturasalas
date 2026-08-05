/* ============================================================
 * db-api.js — Tablero de Facturación Diaria · capa de datos
 * ------------------------------------------------------------
 * Proyecto Supabase dedicado (peusrhpqatobkjwwgmub), patrón
 * snapshot-mirror: el snapshot ya procesado del Excel se guarda
 * como JSON en `tablero_snapshot` (1 fila por mes). Los feriados
 * van en la tabla `feriados` (compartidos entre todos).
 *
 * API expuesta en window.TableroDB:
 *   ready            -> boolean (hay cliente Supabase)
 *   pullSnapshot()   -> Promise<{snapshot,anio,mes,updated_at,updated_by}|null>
 *   pushSnapshot(s,u)-> Promise<void>   (upsert por (anio,mes))
 *   pullFeriados()   -> Promise<[{id,fecha,descripcion}]>
 *   addFeriado(f,d)  -> Promise<row>
 *   delFeriado(fecha)-> Promise<void>
 * ============================================================ */
(function () {
  var CFG = window.SUPABASE_CONFIG;
  var sb = null;
  try {
    if (window.supabase && CFG && CFG.url && CFG.anonKey) {
      sb = window.supabase.createClient(CFG.url, CFG.anonKey, { auth: { persistSession: false } });
    }
  } catch (e) { console.error('[TableroDB] no se pudo crear el cliente Supabase', e); }

  function assert() { if (!sb) throw new Error('Supabase no configurado'); }

  var API = {
    ready: !!sb,

    // Trae el snapshot más reciente (por updated_at). null si no hay ninguno.
    pullSnapshot: function () {
      if (!sb) return Promise.resolve(null);
      return sb.from('tablero_snapshot')
        .select('anio,mes,snapshot,updated_at,updated_by')
        .order('updated_at', { ascending: false })
        .limit(1)
        .then(function (r) {
          if (r.error) { console.error('[TableroDB] pullSnapshot', r.error); return null; }
          var row = r.data && r.data[0];
          return row ? row : null;
        });
    },

    // Lista los meses que tienen snapshot (para el navegador de mes).
    listMonths: function () {
      if (!sb) return Promise.resolve([]);
      return sb.from('tablero_snapshot').select('anio,mes,updated_at')
        .order('anio', { ascending: true }).order('mes', { ascending: true })
        .then(function (r) {
          if (r.error) { console.error('[TableroDB] listMonths', r.error); return []; }
          return r.data || [];
        });
    },

    // Trae el snapshot de un (anio,mes) puntual. null si no existe.
    pullSnapshotFor: function (anio, mes) {
      if (!sb) return Promise.resolve(null);
      return sb.from('tablero_snapshot')
        .select('anio,mes,snapshot,updated_at,updated_by')
        .eq('anio', anio).eq('mes', mes).limit(1)
        .then(function (r) {
          if (r.error) { console.error('[TableroDB] pullSnapshotFor', r.error); return null; }
          return (r.data || [])[0] || null;
        });
    },

    // Guarda/actualiza el snapshot del mes (anio,mes salen del propio snapshot).
    pushSnapshot: function (snap, user) {
      assert();
      var anio = snap.cur_year, mes = snap.cur_month;
      return sb.from('tablero_snapshot')
        .upsert({
          anio: anio, mes: mes, snapshot: snap,
          updated_by: user || null, updated_at: new Date().toISOString()
        }, { onConflict: 'anio,mes' })
        .then(function (r) { if (r.error) throw r.error; });
    },

    pullFeriados: function () {
      if (!sb) return Promise.resolve([]);
      return sb.from('feriados').select('id,fecha,descripcion').order('fecha', { ascending: true })
        .then(function (r) {
          if (r.error) { console.error('[TableroDB] pullFeriados', r.error); return []; }
          return r.data || [];
        });
    },

    addFeriado: function (fecha, descripcion) {
      assert();
      return sb.from('feriados').upsert({ fecha: fecha, descripcion: descripcion || null }, { onConflict: 'fecha' })
        .select().then(function (r) { if (r.error) throw r.error; return (r.data || [])[0]; });
    },

    delFeriado: function (fecha) {
      assert();
      return sb.from('feriados').delete().eq('fecha', fecha)
        .then(function (r) { if (r.error) throw r.error; });
    }
  };

  window.TableroDB = API;
})();
