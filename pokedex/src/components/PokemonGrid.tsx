import { useEffect, useMemo, useRef, useState } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import type { Pokemon } from '../lib/types'
import { PokemonCard } from './PokemonCard'

interface Props {
  pokemon: Pokemon[]
  shiny: boolean
  inTeam: (id: number) => boolean
  teamFull: boolean
  onToggleTeam: (id: number) => void
}

const CARD_MIN_WIDTH = 210
const ROW_HEIGHT = 290
const GAP = 16

/**
 * The whole dex is over a thousand entries. Rendering every card blows up the
 * DOM and the memory footprint, so rows are windowed — only what is on screen
 * (plus a small overscan) actually exists.
 */
export function PokemonGrid({ pokemon, shiny, inTeam, teamFull, onToggleTeam }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(1)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const measure = () => {
      const width = element.clientWidth
      setColumns(Math.max(1, Math.floor((width + GAP) / (CARD_MIN_WIDTH + GAP))))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const rows = useMemo(() => {
    const chunks: Pokemon[][] = []
    for (let i = 0; i < pokemon.length; i += columns) {
      chunks.push(pokemon.slice(i, i + columns))
    }
    return chunks
  }, [pokemon, columns])

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_HEIGHT + GAP,
    overscan: 4,
    scrollMargin: containerRef.current?.offsetTop ?? 0,
  })

  if (pokemon.length === 0) {
    return (
      <div ref={containerRef} className="empty">
        <p>Nothing matches those filters.</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="grid-window">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index]
          if (!row) return null
          return (
            <div
              key={virtualRow.key}
              className="grid-row"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: ROW_HEIGHT,
                transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {row.map((entry) => (
                <PokemonCard
                  key={entry.id}
                  pokemon={entry}
                  shiny={shiny}
                  inTeam={inTeam(entry.id)}
                  teamFull={teamFull}
                  onToggleTeam={onToggleTeam}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
