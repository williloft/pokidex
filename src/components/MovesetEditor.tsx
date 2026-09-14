import { useEffect, useMemo, useState } from 'react'
import { fetchLearnset } from '../lib/api'
import { isBattleMove, type LearnedMove, type Move, type MoveIndex, type TeamMember } from '../lib/types'
import { TypeBadge } from './TypeBadge'

interface Props {
  member: TeamMember
  moveIndex: MoveIndex
  onSave: (moves: string[]) => void
  onReset: () => void
  onClose: () => void
}

export const moveLabel = (name: string): string =>
  name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const METHOD_LABEL: Record<LearnedMove['method'], string> = {
  'level-up': 'Level up',
  machine: 'TM',
  egg: 'Egg',
  tutor: 'Tutor',
  other: 'Other',
}

type Status = 'loading' | 'ready' | 'error'

/**
 * Pick the four moves a team member fights with.
 *
 * Only damaging moves are offered. Without abilities, items, weather or stat
 * stages there is nothing for a status move to do here, and a Swords Dance
 * that silently did nothing would be worse than not offering it at all.
 */
export function MovesetEditor({ member, moveIndex, onSave, onReset, onClose }: Props) {
  const [status, setStatus] = useState<Status>('loading')
  const [learnset, setLearnset] = useState<LearnedMove[]>([])
  // Always four slots, so an empty one stays a visible gap rather than
  // silently shuffling the others up.
  const [chosen, setChosen] = useState<Array<string | null>>(() =>
    [0, 1, 2, 3].map((index) => member.moves[index] ?? null),
  )
  const [slot, setSlot] = useState(0)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    fetchLearnset(member.view.id, member.pokemon.id, controller.signal)
      .then((result) => {
        setLearnset(result)
        setStatus('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error')
      })
    return () => controller.abort()
  }, [member.view.id, member.pokemon.id])

  // Esc closes, as it would for any other dialog.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const options = useMemo(() => {
    const seen = new Map<string, { move: Move; learned: LearnedMove }>()
    for (const line of learnset) {
      const move = moveIndex[line.name]
      if (!move || !isBattleMove(move)) continue
      // The same move can be listed twice — learnt by level and by TM. Keep the
      // level-up entry, since that is the one worth showing a number for.
      const existing = seen.get(line.name)
      if (!existing || (line.method === 'level-up' && existing.learned.method !== 'level-up')) {
        seen.set(line.name, { move, learned: line })
      }
    }

    const term = query.trim().toLowerCase()
    return [...seen.values()]
      .filter(({ move }) => (term ? move.name.includes(term) || move.type.includes(term) : true))
      .sort((a, b) => b.move.power - a.move.power || a.move.name.localeCompare(b.move.name))
  }, [learnset, moveIndex, query])

  const assign = (name: string) => {
    setChosen((current) => {
      const next = [...current]
      // Already in the set: swap the two slots rather than carry a duplicate.
      const existing = next.indexOf(name)
      if (existing >= 0 && existing !== slot) next[existing] = next[slot] ?? null
      next[slot] = name
      return next
    })
    setSlot((current) => (current + 1) % 4)
  }

  const clearSlot = () => {
    setChosen((current) => current.map((entry, index) => (index === slot ? null : entry)))
  }

  const stab = (move: Move) => member.view.types.includes(move.type)

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={`Moves for ${member.view.title}`}>
      <div className="sheet__backdrop" onClick={onClose} />
      <div className="sheet__panel">
        <header className="sheet__header">
          <h2>{member.view.title}</h2>
          <button type="button" className="chip chip--ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <p className="panel__note">
          Four damaging moves. Status moves are left out — there are no abilities, items or stat
          stages in this battle for them to act on.
        </p>

        <ol className="moveset">
          {[0, 1, 2, 3].map((index) => {
            const name = chosen[index]
            const move = name ? moveIndex[name] : undefined
            return (
              <li key={index}>
                <button
                  type="button"
                  className={`moveset__slot ${slot === index ? 'moveset__slot--active' : ''}`}
                  aria-pressed={slot === index}
                  onClick={() => setSlot(index)}
                  style={
                    {
                      '--move-accent': `var(--type-${move?.type ?? 'normal'})`,
                    } as React.CSSProperties
                  }
                >
                  <span className="moveset__index">{index + 1}</span>
                  {move ? (
                    <>
                      <span className="moveset__name">{moveLabel(move.name)}</span>
                      <TypeBadge type={move.type} />
                      <span className="moveset__numbers">
                        {move.power} pwr · {move.pp} PP
                      </span>
                    </>
                  ) : (
                    <span className="moveset__empty">Empty</span>
                  )}
                </button>
              </li>
            )
          })}
        </ol>

        <div className="sheet__tools">
          <input
            type="search"
            className="finder__input"
            value={query}
            placeholder="Filter by move or type…"
            aria-label="Filter moves"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className="chip chip--ghost" onClick={clearSlot}>
            Empty slot {slot + 1}
          </button>
        </div>

        {status === 'loading' ? <p className="panel__note">Loading what it can learn…</p> : null}
        {status === 'error' ? (
          <p className="panel__note">
            Could not load its moves just now. Close and try again — the battle will use its
            defaults until then.
          </p>
        ) : null}

        {status === 'ready' ? (
          <ul className="movelist">
            {options.map(({ move, learned }) => (
              <li key={move.name}>
                <button
                  type="button"
                  className={`movelist__row ${chosen.includes(move.name) ? 'movelist__row--on' : ''}`}
                  onClick={() => assign(move.name)}
                  title={move.effect ?? undefined}
                  style={
                    { '--move-accent': `var(--type-${move.type})` } as React.CSSProperties
                  }
                >
                  <span className="movelist__name">
                    {moveLabel(move.name)}
                    {stab(move) ? <span className="movelist__stab">STAB</span> : null}
                  </span>
                  <TypeBadge type={move.type} />
                  <span className="movelist__class">{move.damageClass}</span>
                  <span className="movelist__numbers">
                    {move.power} · {move.accuracy ?? '—'} · {move.pp} PP
                  </span>
                  <span className="movelist__how">
                    {METHOD_LABEL[learned.method]}
                    {learned.method === 'level-up' && learned.level > 0 ? ` ${learned.level}` : ''}
                  </span>
                </button>
              </li>
            ))}
            {options.length === 0 ? (
              <li>
                <p className="panel__note">Nothing matches that filter.</p>
              </li>
            ) : null}
          </ul>
        ) : null}

        <footer className="sheet__footer">
          <button
            type="button"
            className="button"
            onClick={() => onSave(chosen.filter((name): name is string => name !== null))}
          >
            Save moveset
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => {
              setChosen([0, 1, 2, 3].map((index) => member.view.moves?.[index] ?? null))
              onReset()
            }}
          >
            Use defaults
          </button>
        </footer>
      </div>
    </div>
  )
}
