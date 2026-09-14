import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'pokedex:team'
export const TEAM_SIZE = 6

/** Everyone listening for team changes, so two components never disagree. */
const listeners = new Set<(ids: number[]) => void>()
let current: number[] | null = null

function read(): number[] {
  if (current) return current
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    current = Array.isArray(parsed)
      ? parsed.filter((id): id is number => typeof id === 'number').slice(0, TEAM_SIZE)
      : []
  } catch {
    current = []
  }
  return current
}

function write(ids: number[]): void {
  current = ids
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Storage unavailable — the team still works for this session.
  }
  for (const listener of listeners) listener(ids)
}

export interface TeamApi {
  team: number[]
  isFull: boolean
  has: (id: number) => boolean
  toggle: (id: number) => void
  remove: (id: number) => void
  clear: () => void
}

export function useTeam(): TeamApi {
  const [team, setTeam] = useState<number[]>(read)

  useEffect(() => {
    listeners.add(setTeam)
    return () => {
      listeners.delete(setTeam)
    }
  }, [])

  const toggle = useCallback((id: number) => {
    const ids = read()
    if (ids.includes(id)) write(ids.filter((entry) => entry !== id))
    else if (ids.length < TEAM_SIZE) write([...ids, id])
  }, [])

  const remove = useCallback((id: number) => {
    write(read().filter((entry) => entry !== id))
  }, [])

  const clear = useCallback(() => write([]), [])

  return {
    team,
    isFull: team.length >= TEAM_SIZE,
    has: (id: number) => team.includes(id),
    toggle,
    remove,
    clear,
  }
}
