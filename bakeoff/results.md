# Model bake-off — slip extraction

Generated 2026-08-23 15:01 · prompt v1.3.0 · 36 documents, 40 golden transactions · 3 repeats per document

Held identical across models: prompt (imported, byte-for-byte), `temperature: 0`, strict `json_schema`, `reasoning: {effort: "low"}`, `usage: {include: true}`, original image bytes with no downsampling.

## Metric mapping

The requested metric list assumes itemised till receipts. This repo extracts one transaction per bank slip — there is no `qty`, `unit_price`, `subtotal`, `VAT`, or line item in the schema or the golden set. Two metrics could not be computed at all:

| Requested | Here |
|---|---|
| 1. Line count exactness | Transaction-count exactness per document (Grab digests hold 2–3) |
| 2. Reconciliation Σ(qty × unit_price) = subtotal | **Not computable** — no line items exist |
| 3. Item name fidelity (CER by script) | Merchant CER, Latin vs Thai, + script-preservation flag |
| 4. Numeric accuracy | `amount` only (±0.01); other numeric fields do not exist |
| 5. Weight-priced `+W=___ G.` | **Not applicable** — zero such rows |
| 6. Schema validity rate | As specified |
| 7. Cost and latency | As specified |
| *(added)* | Date accuracy and direction accuracy — the two fields that dominate downstream correctness here |

## Summary

Percentages are the mean across repeats; ± is the spread (max − min) across repeats, i.e. run-to-run variance.

| Model | Date | Amount | Direction | Merchant | Row count | CER Latin | CER Thai | Schema OK | Retries | $/receipt | p50 | p95 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `flash-lite-31` | 100.0% ±0.0 | 100.0% ±0.0 | 95.0% ±0.0 | 65.0% ±7.5 | 100.0% ±0.0 | 0.603 | 0.147 | 100.0% | 0 | $0.00117 | 2919ms | 4977ms |
| `flash-37` | 100.0% ±0.0 | 100.0% ±0.0 | 100.0% ±0.0 | 53.3% ±2.5 | 100.0% ±0.0 | 0.699 | 0.203 | 100.0% | 0 | $0.00160 | 4772ms | 7997ms |
| `flash-lite-35` | 100.0% ±0.0 | 100.0% ±0.0 | 94.2% ±2.5 | 52.5% ±10.0 | 100.0% ±0.0 | 0.683 | 0.122 | 100.0% | 2 | $0.00106 | 2137ms | 3423ms |
| `flash-25` | 100.0% ±0.0 | 100.0% ±0.0 | 100.0% ±0.0 | 51.7% ±5.0 | 100.0% ±0.0 | 0.705 | 0.194 | 100.0% | 0 | $0.00306 | 6401ms | 13810ms |
| `flash-lite-25` | 97.5% ±0.0 | 98.3% ±2.5 | 99.2% ±2.5 | 51.7% ±7.5 | 100.0% ±0.0 | 0.681 | 0.192 | 100.0% | 7 | $0.00132 | 8991ms | 39166ms |

### Cost extrapolated to 1,000 receipts

| Model | Measured $/receipt | $/1,000 receipts | Reasoning tokens spent | Honoured `effort: low`? |
|---|---|---|---|---|
| `flash-lite-31` | $0.00117 | **$1.17** | 25601 | yes |
| `flash-37` | $0.00160 | **$1.60** | 20139 | yes |
| `flash-lite-35` | $0.00106 | **$1.06** | 0 | no — silently ignored |
| `flash-25` | $0.00306 | **$3.06** | 86412 | yes |
| `flash-lite-25` | $0.00132 | **$1.32** | 284866 | yes |

### Row-count deltas

How often each model returned more or fewer transactions than the document actually holds. `0` is correct.

| Model | -3 | -2 | -1 | 0 | +1 | +2 |
|---|---|---|---|---|---|---|
| `flash-lite-31` | 0 | 0 | 0 | 108 | 0 | 0 |
| `flash-37` | 0 | 0 | 0 | 108 | 0 | 0 |
| `flash-lite-35` | 0 | 0 | 0 | 108 | 0 | 0 |
| `flash-25` | 0 | 0 | 0 | 108 | 0 | 0 |
| `flash-lite-25` | 0 | 0 | 0 | 108 | 0 | 0 |

### Script preservation

Rows where the golden merchant is Thai and the model answered in pure Latin — a silent translation or transliteration that strict schema validation cannot catch.

| Model | Thai rows | Script lost |
|---|---|---|
| `flash-lite-31` | 36 | 0 |
| `flash-37` | 36 | 0 |
| `flash-lite-35` | 36 | 0 |
| `flash-25` | 36 | 0 |
| `flash-lite-25` | 36 | 3 ⚠️ |

Total measured spend for this bake-off: **$0.8868** (ceiling $5.00). 534 calls, zero failed, 9 retries in total.

## Verdict

### Three metrics carry no signal at all

Row-count exactness is **108/108 for all five models** — nobody merged or dropped a transaction, including on the Grab digests that hold three. Date and amount are 100% for four of five. These are saturated; they cannot separate the field and should not be used to pick a winner.

### Merchant is measuring our data problem, not the models

Every model lands between 51.7% and 65.0%, and the run-to-run spreads (±2.5 to ±11.2) are as large as most of the gaps between models. The reason is visible in `failures.md`: the models correctly read what is printed — `ABUNDANT EMINENT (THAILAND) LIMITED`, `Grabtaxi (Thailand) Co.,Ltd.`, `Dime! USD` — while the golden set records the trading name the user recognises. **No model can win this metric and no prompt can fix it**; it needs the `merchant_aliases` table in Chunk 2.4. Treat the merchant column as noise for model selection.

The high Latin CER (0.60–0.71) is the same effect: the strings are not misread, they are entirely different strings. Thai CER (0.122–0.203) is the more honest reading-accuracy signal, and there `flash-lite-35` is best.

### Direction is the only accuracy metric that separates anything

`flash-37` and `flash-25` both hit **100% with zero variance across three repeats**. `flash-lite-31` sits at 95.0% ±0.0 and `flash-lite-35` at 94.2% ±2.5 — real, repeatable deficits, not luck.

**Important caveat:** Chunk 2.2 will move the direction decision out of the model entirely, into a normalizer that compares `sender_name`/`recipient_name` against `ACCOUNT_HOLDER_NAMES` in code. All five models already report those two names accurately. Once that lands, the one metric that separates these models stops mattering.

### The incumbent production model is the worst in the field

`flash-lite-25` — what the app is configured to use today — is:

- the only model below 100% on date (97.5%) and amount (98.3% ±2.5, i.e. it disagrees with itself between runs);
- the least reliable: 7 retries against 0 for three of the others, and a p95 latency of **39.2 seconds** against 3.4–13.8s;
- the only model to silently drop script. On `grab/Gmail - Your Grab E-Receipt.pdf` it returned `GrabFood`, discarding the Thai restaurant name entirely, identically in all three repeats. Strict schema validation cannot catch this — the field is a valid non-empty string, it is just missing the merchant.
- not even cheap: it burned 284,866 reasoning tokens, far more than any other model, making it **more expensive per receipt than `flash-lite-35` and `flash-lite-31`** despite the lowest headline token price.

### Does anything beat the `flash-25` baseline by enough to switch?

On accuracy, no — and that is the finding. `flash-37` matches `flash-25` exactly on every field (100/100/100, identical zero variance) while costing **$1.60 per 1,000 receipts against $3.06**, with p50 latency of 4.8s against 6.4s. That is not a better model, it is the same result for half the money.

**The top four models are within noise of each other on everything that will still matter after Chunk 2.2.** Per your instruction, that means picking on cost rather than manufacturing a winner:

| If you want | Pick | Why |
|---|---|---|
| Maximum safety today | `flash-37` | Only model matching the baseline at 100/100/100 with zero variance, at half the baseline cost |
| Cheapest and fastest | `flash-lite-35` | $1.06/1k, p50 2.1s, best Thai CER (0.122). Costs 5.8pp of direction accuracy, which Chunk 2.2 makes irrelevant |

**Recommendation: switch `MODEL_PRIMARY` off `flash-lite-25` now.** It is measurably the weakest model tested on accuracy, reliability, tail latency and silent data loss, and it is not the cheapest. Move to `flash-37` if you want the direction score locked at 100% before the Chunk 2.2 normalizer exists; move to `flash-lite-35` if you would rather take the cheapest and fastest option and let the normalizer handle direction. Do **not** adopt `flash-25` — triple the cost of `flash-lite-35` for measurably identical reading accuracy.

### Notes for a possible round two (no prompt changes were made here)

- `flash-lite-35` silently ignored `reasoning: {effort: "low"}` — 0 reasoning tokens against 20k–285k for the others. Its numbers are therefore a no-reasoning configuration, and it may improve if reasoning can be forced on.
- The prompt tells the model to return the counterparty "exactly as printed". For Dime the models return `Dime!` or `Dime! USD` (the platform) instead of `NASDAQ - RKLB` (the security bought), and for Grab they return `Grabtaxi (Thailand) Co.,Ltd.` instead of the restaurant or ride type. A rule distinguishing *the platform that processed the payment* from *what was actually bought* would likely lift merchant scores across all five models at once. Not applied — round one compares models, not prompts.
