// Fill in the AI endpoint after deploying it (Cloudflare Worker or Supabase function, see README).
// Leave AI_URL empty to run in demo mode, with simple built-in replies and no AI.
window.JV_CONFIG = {
  AI_URL: "https://waymark-ai.j-chen84-aca.workers.dev",
  SUPABASE_ANON_KEY: "", // only for the Supabase option; leave empty for Cloudflare
};
