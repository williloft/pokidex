import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'pokedex:shiny'

const listeners = new Set<(value: boolean) => void>()
let current: boolean | null = null

function read(): boolean {
  if (current === null) {
    try {
      current = localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      current = false
    }
  }
  return current
}

/**
 * The original hardcoded shiny sprites. Keeping that as the signature idea, but
 * as a switch the whole app respects.
 */
export function useShiny(): [boolean, () => void] {
  const [shiny, setShiny] = useState(read)

  useEffect(() => {
    listeners.add(setShiny)
    return () => {
      listeners.delete(setShiny)
    }
  }, [])

  const toggle = useCallback(() => {
    const next = !read()
    current = next
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      // Preference just won't persist.
    }
    for (const listener of listeners) listener(next)
  }, [])

  return [shiny, toggle]
}
