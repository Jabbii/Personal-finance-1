'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const current = document.documentElement.dataset.theme
    if (current === 'dark' || current === 'light') setTheme(current)
  }, [])

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light'
    document.documentElement.dataset.theme = next
    setTheme(next)
  }

  return (
    <button
      onClick={toggle}
      className="min-h-[44px] min-w-[44px] rounded-md bg-accent px-4 text-base font-medium text-bg dark:bg-accent-dark dark:text-bg-dark"
    >
      Switch to {theme === 'light' ? 'dark' : 'light'}
    </button>
  )
}
