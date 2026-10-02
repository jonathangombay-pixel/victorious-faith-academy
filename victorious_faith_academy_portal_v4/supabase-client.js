/* VFA Supabase connection. The publishable key is safe to expose in a browser app. */
const VFA_SUPABASE_URL = "https://rzoegdabefjsleheugkh.supabase.co";
const VFA_SUPABASE_KEY = "sb_publishable_8WJlk2zNYItPBLEnB75bWQ_bN-qlRNt";
const vfaSupabase = window.supabase.createClient(VFA_SUPABASE_URL, VFA_SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
