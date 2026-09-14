import { useCallback, useEffect, useState } from 'react'

/**
 * A value kept in localStorage and shared by every component that reads it, so
 * two toggles for the same preference can never disagree.
 *
 * Storage can throw (private windows, blocked site data), so every access is
 * guarded and the preference simply stops persisting rather than breaking.
 */
export function createPreference<T>(
  key: string,
  fallback: T,
  parse: (raw: string) => T | null,
  serialise: (value: T) => string,
) {
  const listeners = new Set<(value: T) => void>()
  let current: T | null = null

  const read = (): T => {
    if (current === null) {
      try {
        const raw = localStorage.getItem(key)
        current = raw === null ? fallback : (parse(raw) ?? fallback)
      } catch {
        current = fallback
      }
    }
    return current
  }

  const write = (value: T): void => {
    current = value
    try {
      localStorage.setItem(key, serialise(value))
    } catch {
      // Preference just won't survive a reload.
    }
    for (const listener of listeners) listener(value)
  }

  return function usePreference(): [T, (value: T) => void] {
    const [value, setValue] = useState<T>(read)

    useEffect(() => {
      listeners.add(setValue)
      return () => {
        listeners.delete(setValue)
      }
    }, [])

    return [value, useCallback((next: T) => write(next), [])]
  }
}
