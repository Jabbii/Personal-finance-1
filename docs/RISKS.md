# Risks & Hidden Costs

Reviewed monthly. Last reviewed: 2026-07-26.

## Monthly costs (realistic)

| Cost | Amount | Notes |
|---|---|---|
| OpenRouter API | ~$2–5/mo | Depends on slip volume |
| Supabase | Free | Until 500 MB DB or 1 GB Storage |
| Vercel | Free | Until 100 GB bandwidth |
| Cloudflare R2 | Free | Until 10 GB (Phase 4) |
| Pushover | $5 one-time | Deferred to Phase 4 |
| Your time | ~1 hr/mo | Keeping it running |

## Free tier cliffs

| Service | Limit | What breaks | Fix |
|---|---|---|---|
| Supabase DB | 500 MB | Writes fail | Archive slips to R2 |
| Supabase Storage | 1 GB | Uploads fail | Move to cold storage at 6 months |
| Vercel bandwidth | 100 GB/mo | Site 503 | Unlikely for personal use |
| OpenRouter | No free tier | Direct spend | $10 hard cap in dashboard |

## Risks to watch

- **Model deprecation:** Gemini 2.5 could be deprecated. Mitigation: model name is an env var, swap in minutes.
- **Bank slip privacy:** Slips sent to OpenRouter → Google servers. Google API terms: no training on API data by default.
- **Supabase backup:** Free tier = 7-day recovery only. Mitigation: nightly pg_dump to R2 (Phase 4).
- **API key leak:** If pushed to git accidentally, OpenRouter cap limits damage to $10.

## Cost overrun protection

- OpenRouter hard monthly cap: $10 (set in dashboard)
- Sync script kill switch: refuses to run if daily spend exceeds $1 (Phase 4.5)
