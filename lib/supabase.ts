import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan variables Supabase (NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) en .env.local"
  );
}

// Para endpoints server-side (API Routes) usamos SERVICE_ROLE_KEY si está
// disponible (evita bloqueos por RLS durante signup/login).
// Si no está, fallback a anon key (necesitarás policies/deshabilitar RLS).
const serverSecret = supabaseServiceKey || supabaseAnonKey;

export const supabase = createClient(supabaseUrl, serverSecret, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export type Supabase = typeof supabase;
