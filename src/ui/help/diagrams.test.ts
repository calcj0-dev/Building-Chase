import { describe, expect, it } from 'vitest'
import { HELP_DIAGRAMS, HELP_PAGES } from './diagrams'

describe('help diagrams', () => {
  it('builds every page from legal moves', () => {
    for (const page of HELP_PAGES) expect(() => HELP_DIAGRAMS[page]()).not.toThrow()
  })

  it('hides the runner in the police diagrams', () => {
    expect(HELP_DIAGRAMS.police().view.runnerPosition).toBeNull()
    expect(HELP_DIAGRAMS.basics().view.runnerPosition).toBe(3)
  })

  it('shows where the runner can go, excluding buildings with a trace', () => {
    const d = HELP_DIAGRAMS.runner()
    expect(d.view.runnerPosition).toBe(13)
    expect(d.highlightedBuildings.sort((a, b) => a - b)).toEqual([8, 14, 18])
  })

  it('shows the moves and searches of helicopter 1', () => {
    const d = HELP_DIAGRAMS.police()
    expect(d.selectedHelicopter).toBe(0)
    expect(d.highlightedBuildings).toEqual([6, 7, 11, 12])
    expect(d.highlightedIntersections.length).toBeGreaterThan(0)
  })

  it('shows the traces the police have found: yellow, red and one blue', () => {
    const view = HELP_DIAGRAMS.traces().view
    expect(view.runnerPosition).toBeNull()
    expect(view.traces.map((t) => [t.building, t.color])).toEqual(
      expect.arrayContaining([
        [16, 'yellow'],
        [13, 'red'],
        [8, 'blue'],
      ]),
    )
    expect(view.traces).toHaveLength(3)
  })
})
