import { createClient } from "@supabase/supabase-js";

/** Server-only admin client. Never import this file in a browser component. */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured. Add the variables from .env.example.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
