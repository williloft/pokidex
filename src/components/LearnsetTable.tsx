import { useMemo, useState } from 'react'
import { isBattleMove, type LearnedMove, type MoveIndex } from '../lib/types'
import { TypeBadge } from './TypeBadge'

interface Props {
  learnset: LearnedMove[]
  moveIndex: MoveIndex
  /** The variant's types, so same-type moves can be marked. */
  types: readonly string[]
}

const moveLabel = (name: string): string =>
  name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const GROUPS: Array<{ method: LearnedMove['method']; label: string }> = [
  { method: 'level-up', label: 'By level' },
  { method: 'machine', label: 'By TM' },
  { method: 'egg', label: 'By breeding' },
  { method: 'tutor', label: 'By tutor' },
  { method: 'other', label: 'Other' },
]

/**
 * Everything a Pokémon learns, grouped by how it learns it.
 *
 * One tab per method rather than one long table: the TM list alone runs to a
 * hundred entries on modern Pokémon, and stacking all of them would bury the
 * level-up list that people actually come to read.
 */
export function LearnsetTable({ learnset, moveIndex, types }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<LearnedMove['method'], LearnedMove[]>()
    for (const line of learnset) {
      const bucket = map.get(line.method) ?? []
      bucket.push(line)
      map.set(line.method, bucket)
    }

    for (const [method, lines] of map) {
      lines.sort((a, b) =>
        method === 'level-up' ? a.level - b.level || a.name.localeCompare(b.name) : a.name.localeCompare(b.name),
      )
    }
    return map
  }, [learnset])

  const available = GROUPS.filter((group) => (grouped.get(group.method)?.length ?? 0) > 0)
  const [method, setMethod] = useState<LearnedMove['method'] | null>(null)
  const current = method ?? available[0]?.method ?? null
  const lines = current ? (grouped.get(current) ?? []) : []

  if (available.length === 0) {
    return <p className="panel__note">No move data for this one.</p>
  }

  return (
    <>
      <div className="chips">
        {available.map((group) => (
          <button
            key={group.method}
            type="button"
            className={`chip ${current === group.method ? 'chip--on' : ''}`}
            aria-pressed={current === group.method}
            onClick={() => setMethod(group.method)}
          >
            {group.label} <span className="chip__count">{grouped.get(group.method)?.length}</span>
          </button>
        ))}
      </div>

      <div className="learnset">
        <table>
          <thead>
            <tr>
              {current === 'level-up' ? <th scope="col">Lv.</th> : null}
              <th scope="col">Move</th>
              <th scope="col">Type</th>
              <th scope="col">Class</th>
              <th scope="col">Pwr</th>
              <th scope="col">Acc</th>
              <th scope="col">PP</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const move = moveIndex[line.name]
              // Same-type bonus is a damage multiplier, so it means nothing
              // on a status move however well the types line up.
              const stab = move ? isBattleMove(move) && types.includes(move.type) : false
              return (
                <tr key={`${line.method}-${line.name}`} className={stab ? 'learnset__stab' : ''}>
                  {current === 'level-up' ? (
                    <td className="learnset__level">{line.level > 0 ? line.level : '—'}</td>
                  ) : null}
                  <td className="learnset__name">
                    {moveLabel(line.name)}
                    {stab ? <span className="movelist__stab">STAB</span> : null}
                  </td>
                  <td>{move ? <TypeBadge type={move.type} /> : '—'}</td>
                  <td className="learnset__class">{move?.damageClass ?? '—'}</td>
                  <td>{move && move.power > 0 ? move.power : '—'}</td>
                  <td>{move ? (move.accuracy ?? '—') : '—'}</td>
                  <td>{move?.pp ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
