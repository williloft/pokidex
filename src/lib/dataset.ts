import { useEffect, useState } from 'react'
import { setVersionGroupOrder } from './api'
import type { MoveIndex, Pokedex, TypeData } from './types'

export interface Dataset {
  pokedex: Pokedex
  typeData: TypeData
  /** Ability name -> description. Empty if the data file predates them. */
  abilities: Record<string, string>
  /** Move name -> stats. Empty if the data file predates them. */
  moves: MoveIndex
  /** name -> entry, for O(1) lookups on the detail route. */
  byName: Map<string, Pokedex['pokemon'][number]>
  byId: Map<number, Pokedex['pokemon'][number]>
}

export type DatasetState =
  | { status: 'loading' }
  | { status: 'ready'; data: Dataset }
  | { status: 'error'; error: string }

let cached: Promise<Dataset> | null = null

/**
 * The dex ships as static JSON next to the app, so this is a same-origin read
 * the browser can cache — not a thousand calls to a public API.
 */
async function load(): Promise<Dataset> {
  const [pokedexRes, typeRes, abilityRes, moveRes] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/pokedex.json`),
    fetch(`${import.meta.env.BASE_URL}data/type-chart.json`),
    // Added later than the other two, so a stale data directory should degrade
    // to "no descriptions" rather than taking the whole app down.
    fetch(`${import.meta.env.BASE_URL}data/abilities.json`).catch(() => null),
    fetch(`${import.meta.env.BASE_URL}data/moves.json`).catch(() => null),
  ])

  const missing = new Error('Dex data is missing. Run `npm run fetch:data` to generate it.')
  if (!pokedexRes.ok || !typeRes.ok) throw missing

  /*
   * A missing file does not 404 here.
   *
   * The SPA rewrite that makes /pokemon/pikachu work also answers any unmatched
   * path with index.html and a 200, so an absent data file arrives as a
   * perfectly successful page of HTML. Checking `ok` is therefore not enough —
   * the parse is what actually tells us whether the file is there.
   */
  const readJson = async <T,>(response: Response | null): Promise<T | null> => {
    if (!response?.ok) return null
    try {
      return (await response.json()) as T
    } catch {
      return null
    }
  }

  const pokedex = await readJson<Pokedex>(pokedexRes)
  const typeData = await readJson<TypeData>(typeRes)
  if (!pokedex?.pokemon || !typeData?.types) throw missing

  // Added after the other two, so an older data directory degrades to "no
  // descriptions" rather than taking the whole app down.
  const abilities = (await readJson<Record<string, string>>(abilityRes)) ?? {}
  const moves = (await readJson<MoveIndex>(moveRes)) ?? {}

  // The detail fetch needs release order to pick a Pokémon's newest learnset,
  // and it ships with the dex rather than being re-derived per request.
  setVersionGroupOrder(pokedex.versionGroups ?? [])

  return {
    pokedex,
    typeData,
    abilities,
    moves,
    byName: new Map(pokedex.pokemon.map((entry) => [entry.name, entry])),
    byId: new Map(pokedex.pokemon.map((entry) => [entry.id, entry])),
  }
}

export function useDataset(): DatasetState {
  const [state, setState] = useState<DatasetState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    cached ??= load()
    cached
      .then((data) => active && setState({ status: 'ready', data }))
      .catch((error: unknown) => {
        cached = null
        if (active) {
          setState({
            status: 'error',
            error: error instanceof Error ? error.message : 'Could not load dex data.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [])

  return state
}
