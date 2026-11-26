# waymark-ai (Cloudflare Worker)

Deployed automatically by Cloudflare Workers Builds on every push to `main` (root path `/worker`, deploy command `npx wrangler deploy`).

Secrets set in the Cloudflare dashboard, never in this repo:
- `GEMINI_API_KEY` — Gemini API key
- `APP_TOKEN` — access code, required: without it the Worker refuses every request. The app sends it as `x-waymark-token`.
- optional: `GEMINI_MODEL`, `ALLOWED_ORIGIN`, `DAILY_AI_LIMIT` (AI chat calls per day, default 150)

Cloud sync: `POST /sync` (needs `APP_TOKEN`) stores records in the D1 database `waymark` (binding `DB`, EU jurisdiction).
Table `items(id, kind, updated_at, deleted, data, server_ts)`; newer `updated_at` wins; `server_ts` is the sync cursor.

Job discovery (`jobs.js`): a daily cron (05:17 UTC) reads new design jobs near Stockholm from Platsbanken
(Arbetsförmedlingen's open JobSearch API, CC0, no key), stores them in D1 table `jobs`, profiles new ads with Gemini
(same rubric as logged applications plus a one-line summary in zh/en/sv) and scores them against the average focus of
the jobs you applied for (from synced entries). `POST /jobs` (needs `APP_TOKEN`): `{action: "list" | "set" | "settings" | "refresh"}`.
Search words, radius and picks per day are editable in the app under Settings → Job discovery.

Followed companies (`companies.js`): paste a careers link in Settings and the Worker detects its applicant tracking
system (Teamtailor incl. custom domains, Greenhouse, Lever, Ashby) and reads that system's public job feed every day.
Only design titles in the places listed in `placeWords` (Stockholm, Sweden, remote, …) are kept. Up to 20 companies.

AI usage (`usage.js`): every Gemini call writes a row to D1 table `usage` (user, day, feature, model, input/output tokens).
Chat and re-analysis count toward `DAILY_AI_LIMIT` (429 `daily_limit` when used up); the daily job run is logged as `system`
and not limited. `POST /usage` returns today's and this month's totals.

Delete all data: `POST /account/delete` with `{"confirm": "DELETE"}` empties the jobs, settings and usage tables and
replaces every record with a tombstone (id only), so other devices delete their copies on their next sync.

Linked pages are only read when they are ordinary public web addresses (http/https, no IP addresses or local names);
redirects are followed by hand, at most 3, and each hop is checked.
