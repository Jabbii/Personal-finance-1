import { describe, it, expect } from 'vitest'
import { tokens } from './tokens'

describe('design tokens — contract tests', () => {

  describe('colors', () => {
    it('accent is cobalt-indigo #4B4EDE', () => {
      expect(tokens.color.accent).toBe('#4B4EDE')
    })

    it('income and expense are different colors', () => {
      expect(tokens.color.income).not.toBe(tokens.color.expense)
    })

    it('dark mode has all 4 base tokens', () => {
      expect(tokens.color.dark).toMatchObject({
        bg:     expect.stringMatching(/^#/),
        fg:     expect.stringMatching(/^#/),
        muted:  expect.stringMatching(/^#/),
        accent: expect.stringMatching(/^#/),
      })
    })
  })

  describe('spacing', () => {
    it('has exactly 4 spacing steps', () => {
      expect(Object.keys(tokens.spacing)).toHaveLength(4)
    })

    it('spacing values are rem strings', () => {
      Object.values(tokens.spacing).forEach(value => {
        expect(value).toMatch(/rem$/)
      })
    })
  })

  describe('typography', () => {
    it('has exactly 4 font sizes (sm, base, lg, hero)', () => {
      expect(Object.keys(tokens.typography.size)).toHaveLength(4)
    })

    it('hero size is larger than lg', () => {
      const hero = parseFloat(tokens.typography.size.hero)
      const lg   = parseFloat(tokens.typography.size.lg)
      expect(hero).toBeGreaterThan(lg)
    })
  })

  describe('accessibility', () => {
    it('minimum touch target is 44px', () => {
      expect(tokens.touch.minTarget).toBe('44px')
    })
  })

  describe('breakpoints', () => {
    it('has exactly 2 breakpoints (mobile + desktop)', () => {
      expect(Object.keys(tokens.breakpoints)).toHaveLength(2)
    })

    it('desktop breakpoint is 768px', () => {
      expect(tokens.breakpoints.desktop).toBe('768px')
    })
  })

})
