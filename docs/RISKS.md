# Risks & Hidden Costs

Reviewed monthly. Last reviewed: 2026-07-26.

> **How to update this file:** When a new cost or risk surfaces, add it to the relevant table immediately — don't wait for the monthly review. Update "Last reviewed" date each month even if nothing changed (confirms it was checked). Remove risks that no longer apply.

## Monthly costs (realistic)

| Cost | Amount | Notes |
|---|---|---|
| OpenRouter API | ~$2–5/mo | Depends on slip volume |
| Supabase | Free | Until 500 MB DB or 1 GB Storage |
| Vercel | Free | Until 100 GB bandwidth |
| ~~Cloudflare R2~~ | — | Dropped by ADR-002. Only revisit if pg_dump backups don't go to OneDrive. |
| Pushover | $5 one-time | Deferred to Phase 4 |
| Your time | ~1 hr/mo | Keeping it running |

## Free tier cliffs

| Service | Limit | What breaks | Fix |
|---|---|---|---|
| Supabase DB | 500 MB | Writes fail | Text rows only; years of headroom |
| ~~Supabase Storage~~ | ~~1 GB~~ | — | **Gone (ADR-002, 2026-08-23).** Images never leave OneDrive. This was the tightest cliff in the project. |
| Vercel bandwidth | 100 GB/mo | Site 503 | Unlikely for personal use |
| OpenRouter | No free tier | Direct spend | $10 hard cap in dashboard |

## Risks to watch

- **3 "high" npm audit findings, accepted for now (added Chunk 1.2):** `sharp` and `postcss` versions bundled *inside* Next.js 16.2.12 itself (not our own dependency choices) have known CVEs. Both only matter when the tool processes attacker-controlled input — untrusted CSS or untrusted uploaded images from strangers — which doesn't apply here (our CSS is ours; slip images come only from our own bank apps, no public upload form). `npm audit fix --force` would downgrade Next.js to v9.3.3 (a 2020-era release), which is worse than the issue it claims to fix, so left as-is. Mitigation: re-check `npm audit` next time Next.js is upgraded; revisit if the app ever accepts image uploads from anyone other than the user.
- **Model deprecation:** Gemini 3.7 Flash could be deprecated (Google gives 6–12 months notice). Mitigation: `MODEL_PRIMARY` / `MODEL_FALLBACK` env vars — swap model name, no code change needed.
- **Bank slip privacy:** Slips sent to OpenRouter → Google servers. Google API terms: no training on API data by default.
- **Supabase backup (severity raised by ADR-002):** Free tier = 7-day recovery only. Since slip images no longer go to the cloud, this dump is the *only* copy of the transaction history and OCR responses. Mitigation: nightly pg_dump (Phase 4). Destination undecided — a OneDrive folder is proposed, R2 is the fallback.
- **API key leak:** If pushed to git accidentally, OpenRouter cap limits damage to $10.

## Cost overrun protection

- OpenRouter hard monthly cap: $10 (set in dashboard)
- Sync script kill switch: refuses to run if daily spend exceeds $1 (Phase 4.5)
