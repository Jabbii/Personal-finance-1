import { tokens } from '@/design/tokens'
import { ThemeToggle } from './theme-toggle'

export const metadata = {
  title: 'Design Preview — Personal Finance',
}

export default function DesignPreviewPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-hero font-bold">Design tokens</h1>
        <ThemeToggle />
      </div>
      <p className="text-base">
        Every color, size, and spacing value used anywhere in this app comes
        from <code className="text-sm">design/tokens.ts</code>. If it looks
        right here, it looks right everywhere — this page is the visual
        contract (see <code className="text-sm">docs/adr/001-design-system.md</code>).
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Colors — light mode</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="flex h-20 flex-col items-center justify-center rounded-md bg-bg text-sm text-fg shadow-card border border-fg/15 dark:border-fg-dark/15">
            bg {tokens.color.bg}
          </div>
          <div className="flex h-20 flex-col items-center justify-center rounded-md bg-fg text-sm text-bg shadow-card border border-fg/15 dark:border-fg-dark/15">
            fg {tokens.color.fg}
          </div>
          <div className="flex h-20 flex-col items-center justify-center rounded-md bg-muted text-sm text-fg shadow-card border border-fg/15 dark:border-fg-dark/15">
            muted {tokens.color.muted}
          </div>
          <div className="flex h-20 flex-col items-center justify-center rounded-md bg-accent text-sm text-bg shadow-card border border-fg/15 dark:border-fg-dark/15">
            accent {tokens.color.accent}
          </div>
          <div className="flex h-20 flex-col items-center justify-center rounded-md bg-income text-sm text-fg shadow-card border border-fg/15 dark:border-fg-dark/15">
            income {tokens.color.income}
          </div>
          <div className="flex h-20 flex-col items-center justify-center rounded-md bg-expense text-sm text-fg shadow-card border border-fg/15 dark:border-fg-dark/15">
            expense {tokens.color.expense}
          </div>
          <div className="flex h-20 flex-col items-center justify-center rounded-md bg-warning text-sm text-fg shadow-card border border-fg/15 dark:border-fg-dark/15">
            warning {tokens.color.warning}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Colors — dark mode</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="flex h-20 flex-col items-center justify-center rounded-md bg-bg-dark text-sm text-fg-dark shadow-card border border-fg/15 dark:border-fg-dark/15">
            bg-dark {tokens.color.dark.bg}
          </div>
          <div className="flex h-20 flex-col items-center justify-center rounded-md bg-fg-dark text-sm text-bg-dark shadow-card border border-fg/15 dark:border-fg-dark/15">
            fg-dark {tokens.color.dark.fg}
          </div>
          <div className="flex h-20 flex-col items-center justify-center rounded-md bg-muted-dark text-sm text-fg-dark shadow-card border border-fg/15 dark:border-fg-dark/15">
            muted-dark {tokens.color.dark.muted}
          </div>
          <div className="flex h-20 flex-col items-center justify-center rounded-md bg-accent-dark text-sm text-bg-dark shadow-card border border-fg/15 dark:border-fg-dark/15">
            accent-dark {tokens.color.dark.accent}
          </div>
        </div>
        <p className="text-sm">Click the toggle above — real components use these via `dark:` classes automatically.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Typography</h2>
        <p className="text-sm">sm — 14px — labels, captions, metadata</p>
        <p className="text-base">base — 16px — body text, list items</p>
        <p className="text-lg font-semibold">lg — 20px — card headings</p>
        <p className="text-hero font-bold leading-tight">hero — 32px</p>
        <div className="flex gap-4 text-base">
          <span className="font-normal">normal</span>
          <span className="font-medium">medium</span>
          <span className="font-semibold">semibold</span>
          <span className="font-bold">bold</span>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Spacing — 4-step scale</h2>
        <div className="flex items-end gap-2">
          <div className="h-4 w-1 bg-accent" title="1 — 4px" />
          <div className="h-4 w-2 bg-accent" title="2 — 8px" />
          <div className="h-4 w-4 bg-accent" title="4 — 16px" />
          <div className="h-4 w-6 bg-accent" title="6 — 24px" />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Radius</h2>
        <div className="flex gap-4">
          <div className="h-16 w-16 rounded-sm bg-muted" title="sm — 8px" />
          <div className="h-16 w-16 rounded-md bg-muted" title="md — 16px" />
          <div className="h-16 w-16 rounded-lg bg-muted" title="lg — 24px" />
          <div className="h-16 w-16 rounded-full bg-muted" title="full — pill" />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Shadows</h2>
        <div className="flex gap-4">
          <div className="h-16 w-32 rounded-md bg-bg shadow-card border border-fg/15 dark:border-fg-dark/15" title="card" />
          <div className="h-16 w-32 rounded-md bg-bg shadow-elevated border border-fg/15 dark:border-fg-dark/15" title="elevated" />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Touch target minimum</h2>
        <button className="min-h-[44px] min-w-[44px] rounded-md bg-accent px-4 text-bg">
          44px min
        </button>
      </section>
    </main>
  )
}
