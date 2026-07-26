# ADR-001: Design System Tokens

**Date:** 2026-07-26
**Status:** accepted

## What we decided

Use a minimal, manually curated token set (4 colors, 4 spacing steps, 3 type sizes) as the single source of truth. No component library design tokens. No Tailwind defaults used bare.

## Why

The app must feel like Monzo or Revolut — premium, clean, effortless on mobile. Both of those apps succeed not because they have many design options, but because they ruthlessly constrain them.

- **Monzo:** rounded cards, white surfaces, bold financial numbers, coral/rose accent
- **Revolut:** cobalt-indigo accent (#494fdf), Inter typeface, charcoal darks, very clean

The risk of letting Tailwind's 800+ color shades and 12 type sizes loose on this codebase is that every component ends up slightly different, and "Monzo-like" becomes "random blue app."

## Options we considered

1. **Use shadcn/ui default tokens** — fast to start but generic-looking, hard to achieve a specific personality
2. **Use Tailwind defaults freely** — no constraint, high inconsistency risk
3. **Custom minimal token set (chosen)** — 4 colors, 4 spacing steps, 3 type sizes. Every component must use only these.

## Token decisions explained

| Token | Value | Why |
|---|---|---|
| `accent` | `#4B4EDE` | Cobalt-indigo from Revolut's palette. Trustworthy, financial, modern. Works on white. |
| `income` | `#10B981` | Emerald green. Universal "positive money" signal. |
| `expense` | `#F43F5E` | Rose red. Universal "outgoing money" signal. Not alarming, just informative. |
| `radius.md` | `16px` | Monzo card radius. Feels approachable, not corporate. |
| `hero` font size | `32px` | Dashboard total spend. Must be unmissable on first glance. |
| `touch.minTarget` | `44px` | Apple HIG and Google Material both require this minimum. Non-negotiable. |

## Consequences

- Any component that uses a color, size, or spacing value not in `design/tokens.ts` is a bug
- Dark mode is supported via `dark:` token variants, applied by `data-theme="dark"` on `<html>`
- Inter font is loaded via `next/font` — zero layout shift, no external request
- The preview route at `/design/preview` (created in Chunk 1.2) will be the visual contract — if it looks right there, it looks right everywhere
