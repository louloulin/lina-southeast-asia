import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;
try {
  if (supabaseUrl) {
    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey);
  }
} catch {
  // Supabase not configured — client will be null
}

export const supabase = supabaseInstance;

// Check if Supabase is configured (runtime guard)
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

// Get a Supabase client. In the browser this uses the public anon key.
// On the server (API routes / cron) use SUPABASE_SERVICE_ROLE_KEY for
// unrestricted table access (bypasses RLS on protected tables like sync_jobs).
export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  // Prefer service role key server-side so cron can write to sync_jobs (no RLS).
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = serviceKey ?? supabaseAnonKey;
  return createClient<Database>(supabaseUrl, key);
}
