export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-hero font-bold">Personal Finance</h1>
      <p className="max-w-sm text-base">
        The dashboard lands in Phase 3. For now, see the design system at{' '}
        <a href="/design/preview" className="text-accent underline dark:text-accent-dark">
          /design/preview
        </a>
        .
      </p>
    </main>
  )
}
