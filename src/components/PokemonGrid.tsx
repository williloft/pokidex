import { useEffect, useMemo, useRef, useState } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import type { DexEntry } from '../lib/pokedex'
import type { SpriteStyle } from '../lib/sprites'
import { PokemonCard } from './PokemonCard'

interface Props {
  entries: DexEntry[]
  shiny: boolean
  spriteStyle: SpriteStyle
  inTeam: (id: number) => boolean
  teamFull: boolean
  onToggleTeam: (id: number) => void
}

const CARD_MIN_WIDTH = 210
const ROW_HEIGHT = 310
const GAP = 16

/**
 * The dex runs past a thousand entries. Rendering every card blows up the DOM
 * and the memory footprint, so rows are windowed — only what is on screen
 * (plus a small overscan) actually exists.
 */
export function PokemonGrid({
  entries,
  shiny,
  spriteStyle,
  inTeam,
  teamFull,
  onToggleTeam,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(1)
  const [scrollMargin, setScrollMargin] = useState(0)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const measure = () => {
      setColumns(Math.max(1, Math.floor((element.clientWidth + GAP) / (CARD_MIN_WIDTH + GAP))))
      // Where the grid starts down the page. This moves whenever the filter bar
      // changes height — chips wrapping to another line, for instance — and a
      // stale value puts every virtualised row at the wrong offset.
      setScrollMargin(element.getBoundingClientRect().top + window.scrollY)
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    // The filter bar above us is what actually pushes the grid up and down.
    if (element.parentElement) observer.observe(element.parentElement)

    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const rows = useMemo(() => {
    const chunks: DexEntry[][] = []
    for (let i = 0; i < entries.length; i += columns) {
      chunks.push(entries.slice(i, i + columns))
    }
    return chunks
  }, [entries, columns])

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_HEIGHT + GAP,
    overscan: 4,
    scrollMargin,
  })

  if (entries.length === 0) {
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
                  key={entry.pokemon.id}
                  entry={entry}
                  shiny={shiny}
                  spriteStyle={spriteStyle}
                  inTeam={inTeam(entry.pokemon.id)}
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
