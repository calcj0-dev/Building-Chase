import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './appStore'

describe('appStore', () => {
  beforeEach(() => useAppStore.setState({ screen: 'title', settingsOpen: false }))

  it('starts on the title screen', () => {
    expect(useAppStore.getState().screen).toBe('title')
  })

  it('opens and closes the settings dialog', () => {
    useAppStore.getState().openSettings()
    expect(useAppStore.getState().settingsOpen).toBe(true)
    useAppStore.getState().closeSettings()
    expect(useAppStore.getState().settingsOpen).toBe(false)
  })

  it('closes the settings dialog when moving to another screen', () => {
    useAppStore.getState().go('game')
    useAppStore.getState().openSettings()
    useAppStore.getState().go('title')
    expect(useAppStore.getState()).toMatchObject({ screen: 'title', settingsOpen: false })
  })
})
