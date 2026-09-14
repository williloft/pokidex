import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useDex } from '../App'
import { FilterBar } from '../components/FilterBar'
import { PokemonGrid } from '../components/PokemonGrid'
import { rememberSearch } from '../lib/dexLocation'
import { filterAndSort } from '../lib/pokedex'
import type { SpriteStyle } from '../lib/sprites'
import { useFilters } from '../lib/useFilters'

interface Props {
  shiny: boolean
  spriteStyle: SpriteStyle
  inTeam: (id: number) => boolean
  teamFull: boolean
  onToggleTeam: (id: number) => void
}

export function IndexPage({ shiny, spriteStyle, inTeam, teamFull, onToggleTeam }: Props) {
  const { pokedex, typeData } = useDex()
  const [filters, update, reset] = useFilters()
  const location = useLocation()

  // So a type link on a detail page can return you to these filters rather than
  // to a bare, freshly-reset dex.
  useEffect(() => rememberSearch(location.search), [location.search])

  const results = useMemo(() => filterAndSort(pokedex.pokemon, filters), [pokedex.pokemon, filters])

  return (
    <>
      <FilterBar
        filters={filters}
        update={update}
        reset={reset}
        allTypes={typeData.types}
        generations={pokedex.generations}
        resultCount={results.length}
        totalCount={pokedex.pokemon.length}
      />

      <PokemonGrid
        entries={results}
        shiny={shiny}
        spriteStyle={spriteStyle}
        inTeam={inTeam}
        teamFull={teamFull}
        onToggleTeam={onToggleTeam}
      />
    </>
  )
}
