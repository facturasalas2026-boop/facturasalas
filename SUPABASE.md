# Control de Facturas — Puesta en Supabase

Guía para conectar el módulo a un **proyecto Supabase dedicado**.
Vos te encargás de crear Git / Vercel / Supabase; acá está todo lo demás listo.

---

## 1) Crear el proyecto y correr el esquema
1. Creá el proyecto en Supabase (región más cercana).
2. **SQL Editor → New query →** pegá TODO el contenido de [`schema.sql`](schema.sql) → **Run**.
   - Crea 8 tablas (`fact_*`), RLS anon, grants y **siembra** transportadoras (IDs 1-6),
     camiones (101-126), repartidores y zonas — **con los mismos IDs que usa `app.js`**,
     así los datos ya cargados no se rompen.
   - Es idempotente: se puede correr de nuevo sin duplicar.

## 2) Configurar credenciales
En [`supabase-config.js`](supabase-config.js) reemplazá `url` y `anonKey` por las del
proyecto nuevo (**Project Settings → API**).
- Usá **solo** la `anon` key (pública por diseño). **Nunca** la `service_role`.

## 3) Modelo de datos (referencia)

| Tabla | Rol | Notas |
|---|---|---|
| `fact_transportadoras` | Flota (catálogo) | IDs 1-6 = `SEED_TS` |
| `fact_camiones` | Camiones por transportadora | IDs 101-126 = `++tid` |
| `fact_repartidores` | Lista de choferes | — |
| `fact_zonas` | Local / Interior | en repartos se guarda el **nombre** (texto) |
| `fact_planillas` | Planilla semanal | `estado`: `abierta` \| `auditoria` |
| `fact_repartos` | Líneas de la planilla | FK → planilla (cascade) |
| `fact_facturas` | Factura asignada | FK → planilla (set null) |
| `fact_audit` | Bitácora de acciones | `chips` = `text[]` |

**Estados derivados** (no se guardan, los calcula `planillaStatus()` en `app.js`):
`proceso` (sin factura) → `conciliada` (coincide) → `diferencia` (no coincide) →
`auditoria` (enviada). En la BD `estado` es solo `abierta` o `auditoria`.

---

## 4) Lo único que queda (capa JS)
El front hoy corre en **modo local** (localStorage, clave `cf_store_v1`) y `index.html`
**no** carga Supabase. Para pasar a la nube falta la capa de datos async:

1. En `index.html`, antes de `app.js`, agregar:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   <script src="supabase-config.js"></script>
   ```
2. Crear `db-api.js` con `sb.from('fact_*')` (select/insert/update/delete) que reemplace
   el objeto `DB` local, y adaptar `app.js` a funciones async.
3. **Migrar los datos existentes**: exportar el `localStorage['cf_store_v1']` actual e
   insertarlo en las tablas (los IDs de transportadoras/camiones ya coinciden).

> Este paso 4 conviene hacerlo **una vez creado el proyecto** (necesita url/anonKey reales
> para probar). Avisame cuando lo tengas y armo `db-api.js` + la migración.

---

## Checklist
- [ ] Proyecto Supabase creado
- [ ] `schema.sql` corrido (8 tablas + seeds)
- [ ] `supabase-config.js` con url/anonKey reales
- [ ] Repo Git + deploy Vercel
- [ ] `db-api.js` + migración de datos (paso 4)
