import { useEffect, useState } from 'react'
import type { Pokedex, TypeData } from './types'

export interface Dataset {
  pokedex: Pokedex
  typeData: TypeData
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
  const [pokedexRes, typeRes] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/pokedex.json`),
    fetch(`${import.meta.env.BASE_URL}data/type-chart.json`),
  ])

  if (!pokedexRes.ok || !typeRes.ok) {
    throw new Error('Dex data is missing. Run `npm run fetch:data` to generate it.')
  }

  const pokedex = (await pokedexRes.json()) as Pokedex
  const typeData = (await typeRes.json()) as TypeData

  return {
    pokedex,
    typeData,
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
