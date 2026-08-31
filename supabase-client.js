/* VFA Supabase connection. The publishable key is safe to expose in a browser app. */
const VFA_SUPABASE_URL = "https://bcfqpildrgtmagxfxicx.supabase.co";
const VFA_SUPABASE_KEY = "sb_publishable_3SbIWOgWbZBXOlaym6q2rg_djfsk1c8";
const vfaSupabase = window.supabase.createClient(VFA_SUPABASE_URL, VFA_SUPABASE_KEY);
