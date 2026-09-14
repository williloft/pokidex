import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'pokedex:team'
export const TEAM_SIZE = 6

/**
 * A team slot: which species, and which of its forms is being run.
 *
 * One slot per species — you cannot field both Charizard and its Mega at once,
 * so picking a form replaces the slot's form rather than adding a second entry.
 */
export interface TeamEntry {
  id: number
  /** API name of the chosen form, or null for the base form. */
  form: string | null
  /**
   * Chosen moves, or null to run whatever the form brings by default.
   *
   * Null rather than a copy of the defaults on purpose: a slot that has not
   * been edited should follow the dataset, so a rebuild that improves the
   * default movesets reaches teams that were saved months ago.
   */
  moves: string[] | null
}

/** Everyone listening for team changes, so two components never disagree. */
const listeners = new Set<(entries: TeamEntry[]) => void>()
let current: TeamEntry[] | null = null

const asMoveList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((name) => typeof name === 'string')
    ? (value as string[]).slice(0, 4)
    : null

/**
 * Teams saved before forms existed were a bare array of ids, and teams saved
 * before movesets had no moves field. Both still load; they just fall back to
 * the base form and the default moveset.
 */
function migrate(parsed: unknown): TeamEntry[] {
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((item): TeamEntry | null => {
      if (typeof item === 'number') return { id: item, form: null, moves: null }
      if (item && typeof item === 'object' && typeof (item as TeamEntry).id === 'number') {
        const entry = item as TeamEntry
        return {
          id: entry.id,
          form: typeof entry.form === 'string' ? entry.form : null,
          moves: asMoveList(entry.moves),
        }
      }
      return null
    })
    .filter((entry): entry is TeamEntry => entry !== null)
    .slice(0, TEAM_SIZE)
}

function read(): TeamEntry[] {
  if (current) return current
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    current = migrate(raw ? JSON.parse(raw) : [])
  } catch {
    current = []
  }
  return current
}

function write(entries: TeamEntry[]): void {
  current = entries
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage unavailable — the team still works for this session.
  }
  for (const listener of listeners) listener(entries)
}

/** What the "add to team" control on a card or detail page should say. */
export type SlotState = 'out' | 'in' | 'other-form'

export interface TeamApi {
  team: TeamEntry[]
  isFull: boolean
  /** How this exact species-and-form relates to the current team. */
  stateOf: (id: number, form: string | null) => SlotState
  /** Add, remove, or switch the slot to this form. */
  toggle: (id: number, form: string | null) => void
  setForm: (id: number, form: string | null) => void
  /** Pass null to go back to the form's default moveset. */
  setMoves: (id: number, moves: string[] | null) => void
  remove: (id: number) => void
  clear: () => void
}

export function useTeam(): TeamApi {
  const [team, setTeam] = useState<TeamEntry[]>(read)

  useEffect(() => {
    listeners.add(setTeam)
    return () => {
      listeners.delete(setTeam)
    }
  }, [])

  const toggle = useCallback((id: number, form: string | null) => {
    const entries = read()
    const existing = entries.find((entry) => entry.id === id)

    if (!existing) {
      if (entries.length < TEAM_SIZE) write([...entries, { id, form, moves: null }])
      return
    }

    // Already fielding this species: same form means "take it off", a different
    // one means "run this variant instead".
    if (existing.form === form) write(entries.filter((entry) => entry.id !== id))
    else write(entries.map((entry) => (entry.id === id ? { ...entry, form, moves: null } : entry)))
  }, [])

  // A regional form does not always learn what the base form learns, so a
  // hand-picked moveset cannot be assumed to survive the swap.
  const setForm = useCallback((id: number, form: string | null) => {
    write(read().map((entry) => (entry.id === id ? { ...entry, form, moves: null } : entry)))
  }, [])

  const setMoves = useCallback((id: number, moves: string[] | null) => {
    write(read().map((entry) => (entry.id === id ? { ...entry, moves } : entry)))
  }, [])

  const remove = useCallback((id: number) => {
    write(read().filter((entry) => entry.id !== id))
  }, [])

  const clear = useCallback(() => write([]), [])

  const stateOf = useCallback(
    (id: number, form: string | null): SlotState => {
      const existing = team.find((entry) => entry.id === id)
      if (!existing) return 'out'
      return existing.form === form ? 'in' : 'other-form'
    },
    [team],
  )

  return {
    team,
    isFull: team.length >= TEAM_SIZE,
    stateOf,
    toggle,
    setForm,
    setMoves,
    remove,
    clear,
  }
}
