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

export type FormCategory = 'mega' | 'gmax' | 'regional' | 'other'

/**
 * An alternate form of a species — a Mega, a Gigantamax, a regional variant.
 * These are separate Pokémon in the API (ids above 10000) with their own
 * typing and stats, which is exactly why they are worth showing.
 */
export interface PokemonForm {
  id: number
  name: string
  /** Short human label, e.g. "Mega X" or "Alola". */
  label: string
  category: FormCategory
  types: string[]
  stats: Stats
  height: number
  weight: number
  abilities: Ability[]
  /** Names of the four moves it brings to a battle by default. */
  moves: string[]
}

/** How a Pokémon comes by a move. */
export type LearnMethod = 'level-up' | 'machine' | 'egg' | 'tutor' | 'other'

/** One line of a learnset: what it learns, and how. */
export interface LearnedMove {
  name: string
  method: LearnMethod
  /** Only meaningful for level-up. */
  level: number
}

/** A move, reduced to what the dex and a battle actually need. */
export interface Move {
  name: string
  type: string
  damageClass: 'physical' | 'special' | 'status'
  /** 0 for status moves. */
  power: number
  /** null means it never misses, as in the games. */
  accuracy: number | null
  pp: number
  priority: number
  effect: string | null
}

/** Every move in the games, keyed by API name. */
export type MoveIndex = Record<string, Move>

/**
 * Whether a move can be taken into a battle here.
 *
 * Status moves are listed on the dex page but never fought with: without
 * abilities, items, weather or stat stages there is nothing for them to act
 * on, and a Swords Dance that silently did nothing would be worse than a
 * Swords Dance the battle openly does not offer.
 */
export const isBattleMove = (move: Move): boolean =>
  move.damageClass !== 'status' && move.power > 0

/** One entry of the static index that ships with the app. One per species. */
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
  forms: PokemonForm[]
  /** Names of the four moves it brings to a battle by default. */
  moves: string[]
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
  /** Version group names in release order, newest last. */
  versionGroups?: string[]
}

/** chart[attacker][defender] = multiplier. A missing entry means 1x. */
export type TypeChart = Record<string, Record<string, number>>

export interface TypeData {
  types: string[]
  chart: TypeChart
}

/** One game's dex entry. */
export interface DexEntryText {
  text: string
  /** The game version it comes from, e.g. "scarlet". */
  version: string | null
}

/** Detail-page data, fetched lazily and cached in the browser. */
export interface PokemonDetail {
  id: number
  entries: DexEntryText[]
  genus: string | null
  evolution: EvolutionNode | null
  eggGroups: string[]
  captureRate: number
  growthRate: string | null
  /** Everything this Pokémon learns in the newest game it appears in. */
  learnset: LearnedMove[]
}

export interface EvolutionNode {
  id: number
  name: string
  /** How this stage is reached from its parent. Empty for the base stage. */
  trigger: string | null
  children: EvolutionNode[]
}

/**
 * A species or one of its forms, flattened into the shape every component
 * actually needs. Lets a card or a detail page render "whichever variant is
 * selected" without caring which kind it is.
 */
export interface FormView {
  /** Sprite id — the species number, or the form's own id above 10000. */
  id: number
  name: string
  /** Short chip label, e.g. "Mega X". */
  label: string
  /** How it is actually written: "Mega Golurk", "Gigantamax Charizard". */
  title: string
  category: FormCategory | 'default'
  types: string[]
  stats: Stats
  height: number
  weight: number
  abilities: Ability[]
  /** The four moves this variant brings to a battle by default. */
  moves: string[]
}

const REGIONAL_ADJECTIVES: Record<string, string> = {
  Alola: 'Alolan',
  Galar: 'Galarian',
  Hisui: 'Hisuian',
  Paldea: 'Paldean',
}

const titleCase = (name: string): string =>
  name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .replace(/^Mr /, 'Mr. ')
    .replace(/^Mime Jr /, 'Mime Jr. ')

/**
 * Write a form the way people say it.
 *
 * Form names in the API are suffixes — "golurk-mega", "charizard-gmax" — but
 * nobody calls it Golurk Mega. Almost every form reads as a prefix on the
 * species, with Mega's X/Y variants trailing after it.
 */
export function formTitle(speciesName: string, label: string, category: FormCategory): string {
  const species = titleCase(speciesName)
  const words = label.split(' ')
  const [first, ...rest] = words

  switch (category) {
    case 'mega': {
      // "Mega X" -> Mega Charizard X
      const variant = rest.join(' ')
      return `Mega ${species}${variant ? ` ${variant}` : ''}`
    }
    case 'gmax':
      return `Gmax ${species}`
    case 'regional': {
      const adjective = REGIONAL_ADJECTIVES[first ?? ''] ?? first ?? ''
      const extra = rest.join(' ')
      return `${adjective} ${species}${extra ? ` (${extra})` : ''}`
    }
    default:
      return `${label} ${species}`
  }
}

const baseView = (pokemon: Pokemon): FormView => ({
  id: pokemon.id,
  name: pokemon.name,
  label: 'Base',
  title: titleCase(pokemon.name),
  category: 'default',
  types: pokemon.types,
  stats: pokemon.stats,
  height: pokemon.height,
  weight: pokemon.weight,
  abilities: pokemon.abilities,
  moves: pokemon.moves,
})

/** Every selectable variant of a species, base form first. */
export function formViews(pokemon: Pokemon): FormView[] {
  return [
    baseView(pokemon),
    ...pokemon.forms.map((form) => ({
      id: form.id,
      name: form.name,
      label: form.label,
      title: formTitle(pokemon.name, form.label, form.category),
      category: form.category,
      types: form.types,
      stats: form.stats,
      height: form.height,
      weight: form.weight,
      abilities: form.abilities,
      moves: form.moves,
    })),
  ]
}

/**
 * The variants worth putting in front of someone by default: the base form,
 * its Megas, and anything else that changes typing or stats. Costumes are kept
 * back so a long row of them cannot bury the two forms that matter.
 */
export function selectableViews(pokemon: Pokemon): FormView[] {
  const { megas, special } = groupForms(pokemon)
  const keep = new Set([...megas, ...special].map((form) => form.name))
  return formViews(pokemon).filter(
    (view) => view.category === 'default' || keep.has(view.name),
  )
}

/** Appearance-only variants, kept behind a disclosure. */
export function cosmeticViews(pokemon: Pokemon): FormView[] {
  const cosmetic = new Set(groupForms(pokemon).cosmetic.map((form) => form.name))
  return formViews(pokemon).filter((view) => cosmetic.has(view.name))
}

/** Look up a form by its API name, falling back to the base form. */
export function resolveForm(pokemon: Pokemon, formName?: string | null): FormView {
  if (!formName) return baseView(pokemon)
  return formViews(pokemon).find((view) => view.name === formName) ?? baseView(pokemon)
}

const sameTypes = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((type, index) => type === b[index])

const sameStats = (a: Stats, b: Stats): boolean => STAT_ORDER.every((key) => a[key] === b[key])

/**
 * A costume: an unnamed variant that changes neither typing nor stats.
 *
 * Deciding this from the data rather than a hand-kept list is what keeps
 * Pikachu's long row of caps and outfits from crowding out the forms that
 * change how a Pokémon plays.
 *
 * Gigantamax deliberately does not qualify, even though it matches on both
 * counts. What it actually changes — the size, the G-Max move — is simply
 * absent from what we store, and a named transformation filed next to a party
 * hat is wrong in a way the reader would notice immediately.
 */
export function isCosmeticForm(pokemon: Pokemon, form: PokemonForm): boolean {
  if (form.category !== 'other') return false
  return sameTypes(pokemon.types, form.types) && sameStats(pokemon.stats, form.stats)
}

export interface FormGroups {
  /** Mega Evolutions — shown in the evolution flow, not the costume drawer. */
  megas: PokemonForm[]
  /** Other forms that change typing or stats: regional variants and the like. */
  special: PokemonForm[]
  /** Appearance only. */
  cosmetic: PokemonForm[]
}

export function groupForms(pokemon: Pokemon): FormGroups {
  const megas: PokemonForm[] = []
  const special: PokemonForm[] = []
  const cosmetic: PokemonForm[] = []

  for (const form of pokemon.forms) {
    if (form.category === 'mega') megas.push(form)
    else if (isCosmeticForm(pokemon, form)) cosmetic.push(form)
    else special.push(form)
  }

  return { megas, special, cosmetic }
}

/** A team slot resolved against the dex: the species, and the form it runs. */
export interface TeamMember {
  pokemon: Pokemon
  view: FormView
  /** The four moves it will fight with — the form's defaults unless changed. */
  moves: string[]
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
