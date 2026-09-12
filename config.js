// Public Supabase project config — the anon key is the public, RLS-protected client key
// (safe to ship to the browser; it is not a service-role/secret key).
var SUPABASE_URL = "https://bmknywovjcpedkrgnszu.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJta255d292amNwZWRrcmduc3p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNjM2MzcsImV4cCI6MjEwNDczOTYzN30.5rcL8So9lR0Egnm-8W7HVjQ5exUeIgaWn81Ro-sed84";
var supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});
