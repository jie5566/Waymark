# waymark-ai (Cloudflare Worker)

Deployed automatically by Cloudflare Workers Builds on every push to `main` (root path `/worker`, deploy command `npx wrangler deploy`).

Secrets set in the Cloudflare dashboard, never in this repo:
- `GEMINI_API_KEY` — Gemini API key
- `APP_TOKEN` — optional access code; when set, the app must send it as `x-waymark-token`

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
