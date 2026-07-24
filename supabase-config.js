/* supabase-config.js — Control de Facturas
   PROYECTO DEDICADO (autocontenido: transportadoras/camiones viven en este mismo
   proyecto, sembrados por schema.sql). La anon key es pública por diseño
   (RLS + login SSO del ecosistema). NUNCA usar la service_role key acá. */
(function () {
  window.SUPABASE_CONFIG = Object.freeze({
    url: 'https://peusrhpqatobkjwwgmub.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBldXNyaHBxYXRvYmtqd3dnbXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MTcwMzAsImV4cCI6MjEwMDQ5MzAzMH0.8yn9Rfg5OLCI6iyHL2J6s5fVShWim0Mb2vefbunb69M'
  });
})();
