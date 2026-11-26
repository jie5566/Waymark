# waymark-ai (Cloudflare Worker)

Deployed automatically by Cloudflare Workers Builds on every push to `main` (root path `/worker`, deploy command `npx wrangler deploy`).

Secrets set in the Cloudflare dashboard, never in this repo:
- `GEMINI_API_KEY` — Gemini API key
- `APP_TOKEN` — optional access code; when set, the app must send it as `x-waymark-token`

Cloud sync: `POST /sync` (needs `APP_TOKEN`) stores records in the D1 database `waymark` (binding `DB`, EU jurisdiction).
Table `items(id, kind, updated_at, deleted, data, server_ts)`; newer `updated_at` wins; `server_ts` is the sync cursor.
