import { useMemo } from 'react'
import { useDex } from '../App'
import { FilterBar } from '../components/FilterBar'
import { PokemonGrid } from '../components/PokemonGrid'
import { filterAndSort } from '../lib/pokedex'
import { useFilters } from '../lib/useFilters'

interface Props {
  shiny: boolean
  inTeam: (id: number) => boolean
  teamFull: boolean
  onToggleTeam: (id: number) => void
}

export function IndexPage({ shiny, inTeam, teamFull, onToggleTeam }: Props) {
  const { pokedex, typeData } = useDex()
  const [filters, update, reset] = useFilters()

  const results = useMemo(
    () => filterAndSort(pokedex.pokemon, filters),
    [pokedex.pokemon, filters],
  )

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
        pokemon={results}
        shiny={shiny}
        inTeam={inTeam}
        teamFull={teamFull}
        onToggleTeam={onToggleTeam}
      />
    </>
  )
}
