// tailwind.config.ts
// Loaded by app/globals.css via `@config`. Every value here comes straight
// from design/tokens.ts — the single source of truth (see docs/adr/001).
// Do not hardcode a color, size, or spacing value here or anywhere else.

import type { Config } from 'tailwindcss'
import { tokens } from './design/tokens'

export default {
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      bg: tokens.color.bg,
      fg: tokens.color.fg,
      muted: tokens.color.muted,
      accent: tokens.color.accent,
      income: tokens.color.income,
      expense: tokens.color.expense,
      warning: tokens.color.warning,
      'bg-dark': tokens.color.dark.bg,
      'fg-dark': tokens.color.dark.fg,
      'muted-dark': tokens.color.dark.muted,
      'accent-dark': tokens.color.dark.accent,
    },
    fontFamily: {
      sans: tokens.typography.family.base.split(', '),
      mono: tokens.typography.family.mono.split(', '),
    },
    fontSize: { ...tokens.typography.size },
    fontWeight: { ...tokens.typography.weight },
    lineHeight: { ...tokens.typography.lineHeight },
    // Deliberately NOT overriding `spacing` here: Tailwind's width/height/gap
    // utilities all read from that same scale, so replacing it with our
    // 4-value token set silently zeroes out every w-*/h-* size that isn't
    // 1/2/4/6 (broke the /design/preview radius+shadow demo boxes — caught
    // by manually checking the page in a browser). Tokens.spacing's 4 steps
    // (4/8/16/24px) already line up with Tailwind's default multiplier, so
    // padding/margin/gap using p-4, gap-2 etc. still match the token values —
    // just without blocking arbitrary box sizing elsewhere.
    borderRadius: { ...tokens.radius },
    boxShadow: { ...tokens.shadow },
    screens: {
      md: tokens.breakpoints.desktop,
    },
  },
} satisfies Config
