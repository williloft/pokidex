export type StatName =
  | 'hp'
  | 'attack'
  | 'defense'
  | 'special-attack'
  | 'special-defense'
  | 'speed'

export type Stats = Record<StatName, number>

export interface Ability {
  name: string
  hidden: boolean
}

/** One entry of the static index that ships with the app. */
export interface Pokemon {
  id: number
  name: string
  types: string[]
  stats: Stats
  /** decimetres, as PokéAPI reports it */
  height: number
  /** hectograms, as PokéAPI reports it */
  weight: number
  abilities: Ability[]
  generation: number
}

export interface Generation {
  id: number
  name: string
  region: string | null
}

export interface Pokedex {
  generatedAt: string
  generations: Generation[]
  pokemon: Pokemon[]
}

/** chart[attacker][defender] = multiplier. A missing entry means 1x. */
export type TypeChart = Record<string, Record<string, number>>

export interface TypeData {
  types: string[]
  chart: TypeChart
}

/** Detail-page data, fetched lazily and cached in the browser. */
export interface PokemonDetail {
  id: number
  flavorText: string | null
  genus: string | null
  evolution: EvolutionNode | null
  eggGroups: string[]
  captureRate: number
  growthRate: string | null
}

export interface EvolutionNode {
  id: number
  name: string
  /** How this stage is reached from its parent. Empty for the base stage. */
  trigger: string | null
  children: EvolutionNode[]
}

export const STAT_LABELS: Record<StatName, string> = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  'special-attack': 'Sp. Atk',
  'special-defense': 'Sp. Def',
  speed: 'Speed',
}

export const STAT_ORDER: StatName[] = [
  'hp',
  'attack',
  'defense',
  'special-attack',
  'special-defense',
  'speed',
]

export const statTotal = (stats: Stats): number =>
  STAT_ORDER.reduce((sum, key) => sum + stats[key], 0)
