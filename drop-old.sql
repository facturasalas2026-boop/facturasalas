-- ============================================================
-- ALAS · LIMPIEZA del proyecto viejo "Control de Facturas"
-- Proyecto Supabase: peusrhpqatobkjwwgmub
-- Ejecutar UNA vez en el SQL Editor ANTES de schema.sql.
-- Borra TODO lo del módulo viejo (planillas/facturas/auditoría).
-- ⚠️ Destructivo e irreversible. El módulo viejo ya no se usa.
-- ============================================================

drop table if exists fact_audit        cascade;
drop table if exists fact_facturas      cascade;
drop table if exists fact_repartos      cascade;
drop table if exists fact_planillas     cascade;
drop table if exists fact_zonas         cascade;
drop table if exists fact_repartidores  cascade;
drop table if exists fact_camiones      cascade;
drop table if exists fact_transportadoras cascade;
