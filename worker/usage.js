// Waymark · AI usage log and daily limit
// Every Gemini call writes one row: who, when, which feature, which model, how many tokens.
// Until accounts exist there is one user, OWNER; the user_id column is ready for more.
// The app reads a summary from POST /usage (Settings → AI usage).

export const OWNER = "owner";
export const SYSTEM = "system"; // the daily job-discovery run, not counted against a user's limit
const DEFAULT_DAILY_LIMIT = 150;

let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS usage (
      ts INTEGER NOT NULL, day TEXT NOT NULL, user_id TEXT NOT NULL, route TEXT NOT NULL, model TEXT,
      in_tokens INTEGER NOT NULL DEFAULT 0, out_tokens INTEGER NOT NULL DEFAULT 0, total_tokens INTEGER NOT NULL DEFAULT 0)`),
    db.prepare("CREATE INDEX IF NOT EXISTS usage_user_day ON usage (user_id, day)"),
  ]);
  ready = true;
}

export const dailyLimit = env => Math.max(1, Number(env.DAILY_AI_LIMIT) || DEFAULT_DAILY_LIMIT);

// Gemini returns usageMetadata with every answer; thinking tokens are billed as output.
export async function logUsage(env, { userId = OWNER, route, model, meta }) {
  if (!env.DB) return;
  try {
    await ensure(env.DB);
    const inT = Number(meta?.promptTokenCount) || 0;
    const outT = (Number(meta?.candidatesTokenCount) || 0) + (Number(meta?.thoughtsTokenCount) || 0);
    const total = Number(meta?.totalTokenCount) || inT + outT;
    const ts = Date.now();
    await env.DB.prepare("INSERT INTO usage (ts, day, user_id, route, model, in_tokens, out_tokens, total_tokens) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
      .bind(ts, new Date(ts).toISOString().slice(0, 10), userId, String(route).slice(0, 40), String(model || "").slice(0, 60), inT, outT, total).run();
  } catch (e) { console.log("usage log failed", String(e)); }
}

// Several calls in one database batch (the daily job run).
export async function logUsageMany(env, userId, route, calls) {
  if (!env.DB || !calls.length) return;
  try {
    await ensure(env.DB);
    const ts = Date.now(), day = new Date(ts).toISOString().slice(0, 10);
    await env.DB.batch(calls.map(({ model, meta }) => {
      const inT = Number(meta?.promptTokenCount) || 0;
      const outT = (Number(meta?.candidatesTokenCount) || 0) + (Number(meta?.thoughtsTokenCount) || 0);
      return env.DB.prepare("INSERT INTO usage (ts, day, user_id, route, model, in_tokens, out_tokens, total_tokens) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
        .bind(ts, day, userId, route, String(model || "").slice(0, 60), inT, outT, Number(meta?.totalTokenCount) || inT + outT);
    }));
  } catch (e) { console.log("usage log failed", String(e)); }
}

// True when this user has used up today's AI calls.
export async function overLimit(env, userId = OWNER) {
  if (!env.DB) return false;
  try {
    await ensure(env.DB);
    const day = new Date().toISOString().slice(0, 10);
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM usage WHERE user_id = ?1 AND day = ?2").bind(userId, day).first();
    return (r?.n || 0) >= dailyLimit(env);
  } catch { return false; }
}

// Today and this month, for this user and for the background job run.
export async function usageSummary(env, userId = OWNER) {
  await ensure(env.DB);
  const day = new Date().toISOString().slice(0, 10), month = day.slice(0, 7);
  const q = (who, from) => env.DB.prepare(
    "SELECT COUNT(*) AS calls, COALESCE(SUM(in_tokens),0) AS inT, COALESCE(SUM(out_tokens),0) AS outT, COALESCE(SUM(total_tokens),0) AS total FROM usage WHERE user_id = ?1 AND day >= ?2"
  ).bind(who, from).first();
  const [today, mine, jobs] = await Promise.all([q(userId, day), q(userId, month + "-01"), q(SYSTEM, month + "-01")]);
  return { limit: dailyLimit(env), today, month: mine, jobsMonth: jobs };
}

export async function deleteUsage(env, userId = OWNER) {
  await ensure(env.DB);
  await env.DB.prepare("DELETE FROM usage WHERE user_id = ?1 OR user_id = ?2").bind(userId, SYSTEM).run();
}
