const { createClient } = require("@supabase/supabase-js");

const DEFAULT_BUCKET = "product-images";

function supabaseConfigurationError() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor.";
  }
  try {
    const url = new URL(process.env.SUPABASE_URL);
    if (url.protocol !== "https:") throw new Error("HTTPS obrigatório.");
  } catch {
    return "SUPABASE_URL deve ser uma URL HTTPS válida.";
  }
  return null;
}

function getSupabaseClient() {
  const error = supabaseConfigurationError();
  if (error) throw new Error(error);
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function getStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
}

module.exports = { DEFAULT_BUCKET, getStorageBucket, getSupabaseClient, supabaseConfigurationError };
