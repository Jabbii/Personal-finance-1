/**
 * Design Tokens — Personal Finance App
 *
 * Single source of truth for all visual decisions.
 * These values feed into tailwind.config.ts and app/globals.css.
 * Never hardcode colors, sizes, or spacing anywhere else.
 *
 * Inspired by: Monzo (rounded cards, white, bold numbers)
 *              Revolut (cobalt accent, Inter, clean surfaces)
 */

export const tokens = {

  // ─── COLORS ─────────────────────────────────────────────────────────────────
  // 4 base tokens + 2 semantic tokens. Everything else derives from these.

  color: {
    // Core 4 — light mode defaults
    bg:     '#FFFFFF',      // page and card backgrounds
    fg:     '#0D0D12',      // primary text (near-black, softer than pure black)
    muted:  '#F4F4F6',      // secondary surfaces, input backgrounds, dividers
    accent: '#4B4EDE',      // cobalt-indigo — CTAs, active states, highlights

    // Semantic — used only for financial meaning
    income:  '#10B981',     // emerald — money coming in (credit)
    expense: '#F43F5E',     // rose — money going out (debit)
    warning: '#F59E0B',     // amber — budget warnings, near-limit alerts

    // Dark mode variants (applied via [data-theme="dark"])
    dark: {
      bg:     '#0D0D12',
      fg:     '#F4F4F6',
      muted:  '#1C1C24',
      accent: '#6366F1',    // slightly lighter indigo for dark bg contrast
    },
  },

  // ─── TYPOGRAPHY ─────────────────────────────────────────────────────────────
  // 3 sizes only. Use size deliberately — not to decorate.

  typography: {
    family: {
      base:   'Inter, system-ui, -apple-system, sans-serif',
      mono:   'ui-monospace, "Cascadia Code", monospace',  // amounts only
    },
    size: {
      sm:   '0.875rem',   // 14px — labels, captions, metadata
      base: '1rem',       // 16px — body text, list items
      lg:   '1.25rem',    // 20px — card headings, section titles
      hero: '2rem',       // 32px — dashboard hero number (total spend)
    },
    weight: {
      normal:   '400',
      medium:   '500',
      semibold: '600',
      bold:     '700',    // reserved for amounts and hero numbers
    },
    lineHeight: {
      tight:  '1.1',      // hero numbers
      normal: '1.5',      // body text
    },
  },

  // ─── SPACING ────────────────────────────────────────────────────────────────
  // 4-step scale. No other values.

  spacing: {
    1: '0.25rem',   // 4px  — tight gaps, icon padding
    2: '0.5rem',    // 8px  — inline gaps, badge padding
    4: '1rem',      // 16px — standard padding (card interior, section gaps)
    6: '1.5rem',    // 24px — large gaps (between cards, page padding)
  },

  // ─── BORDER RADIUS ──────────────────────────────────────────────────────────
  // Monzo-style rounded — nothing feels sharp in this app.

  radius: {
    sm:   '0.5rem',     // 8px  — small elements (badges, inputs)
    md:   '1rem',       // 16px — standard cards
    lg:   '1.5rem',     // 24px — hero/summary cards
    full: '9999px',     // pills — tags, status indicators
  },

  // ─── BREAKPOINTS ────────────────────────────────────────────────────────────
  // Mobile-first. Only one desktop breakpoint.

  breakpoints: {
    mobile:  '0px',     // default — everything is mobile first
    desktop: '768px',   // md: in Tailwind — side-by-side layouts only here
  },

  // ─── TOUCH & ACCESSIBILITY ─────────────────────────────────────────────────

  touch: {
    minTarget: '44px',  // minimum tappable area — every button, link, icon
  },

  // ─── SHADOWS ────────────────────────────────────────────────────────────────
  // Subtle only — no dramatic drop shadows.

  shadow: {
    card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
    elevated: '0 4px 12px rgba(0,0,0,0.08)',
  },

} as const

// ─── TYPE EXPORTS ────────────────────────────────────────────────────────────
// Use these types when building components to prevent typos.

export type ColorToken    = keyof typeof tokens.color
export type SpacingToken  = keyof typeof tokens.spacing
export type RadiusToken   = keyof typeof tokens.radius
export type FontSize      = keyof typeof tokens.typography.size
