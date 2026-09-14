import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, dexNumber, displayName, filterAndSort } from '../lib/pokedex'
import type { Pokemon, PokemonForm, Stats } from '../lib/types'

const stats = (overrides: Partial<Stats> = {}): Stats => ({
  hp: 50,
  attack: 50,
  defense: 50,
  'special-attack': 50,
  'special-defense': 50,
  speed: 50,
  ...overrides,
})

const form = (id: number, name: string, label: string, types: string[]): PokemonForm => ({
  id,
  name,
  label,
  category: 'mega',
  types,
  stats: stats({ attack: 130 }),
  height: 17,
  weight: 1005,
  abilities: [],
  moves: [],
})

const entry = (
  id: number,
  name: string,
  types: string[],
  generation: number,
  statOverrides: Partial<Stats> = {},
  forms: PokemonForm[] = [],
): Pokemon => ({
  id,
  name,
  types,
  stats: stats(statOverrides),
  height: 10,
  weight: 100,
  abilities: [],
  generation,
  forms,
  moves: [],
})

const dex: Pokemon[] = [
  entry(1, 'bulbasaur', ['grass', 'poison'], 1, { speed: 45 }),
  entry(4, 'charmander', ['fire'], 1, { speed: 65 }),
  entry(6, 'charizard', ['fire', 'flying'], 1, { speed: 100 }, [
    form(10034, 'charizard-mega-x', 'Mega X', ['fire', 'dragon']),
    form(10035, 'charizard-mega-y', 'Mega Y', ['fire', 'flying']),
  ]),
  entry(7, 'squirtle', ['water'], 1, { defense: 65 }),
  entry(25, 'pikachu', ['electric'], 1, { speed: 90 }),
  entry(252, 'treecko', ['grass'], 3, { speed: 70 }),
  entry(387, 'turtwig', ['grass'], 4, { attack: 68 }),
]

const withFilters = (patch: Partial<typeof DEFAULT_FILTERS>) => ({ ...DEFAULT_FILTERS, ...patch })
const names = (results: ReturnType<typeof filterAndSort>) =>
  results.map((result) => result.pokemon.name)

describe('displayName', () => {
  it('title-cases each part of a hyphenated name', () => {
    expect(displayName('bulbasaur')).toBe('Bulbasaur')
    expect(displayName('ho-oh')).toBe('Ho Oh')
  })

  it('restores the full stop in abbreviated names', () => {
    expect(displayName('mr-mime')).toBe('Mr. Mime')
  })
})

describe('dexNumber', () => {
  it('pads to four digits', () => {
    expect(dexNumber(1)).toBe('#0001')
    expect(dexNumber(1025)).toBe('#1025')
  })
})

describe('filterAndSort', () => {
  it('returns everything when no filters are set', () => {
    expect(filterAndSort(dex, DEFAULT_FILTERS)).toHaveLength(dex.length)
  })

  it('filters by generation', () => {
    expect(names(filterAndSort(dex, withFilters({ generations: [3, 4] })))).toEqual([
      'treecko',
      'turtwig',
    ])
  })

  it('requires every selected type to be present', () => {
    expect(names(filterAndSort(dex, withFilters({ types: ['grass'] })))).toEqual([
      'bulbasaur',
      'treecko',
      'turtwig',
    ])

    expect(names(filterAndSort(dex, withFilters({ types: ['grass', 'poison'] })))).toEqual([
      'bulbasaur',
    ])
  })

  it('combines type and generation filters', () => {
    expect(names(filterAndSort(dex, withFilters({ types: ['grass'], generations: [1] })))).toEqual([
      'bulbasaur',
    ])
  })

  it('matches a name prefix ahead of a mid-string match', () => {
    expect(names(filterAndSort(dex, withFilters({ query: 'charm' })))[0]).toBe('charmander')
  })

  it('treats a numeric query as a dex-number prefix, lowest first', () => {
    // "25" should reach #25 and #252 alike — typing a number narrows, it does
    // not demand an exact hit.
    expect(names(filterAndSort(dex, withFilters({ query: '25' })))).toEqual(['pikachu', 'treecko'])
  })

  it('matches an exact dex number on its own', () => {
    expect(names(filterAndSort(dex, withFilters({ query: '387' })))).toEqual(['turtwig'])
  })

  it('falls back to a subsequence match for sloppy typing', () => {
    expect(names(filterAndSort(dex, withFilters({ query: 'sqrtl' })))).toContain('squirtle')
  })

  it('returns nothing when the query matches nothing', () => {
    expect(filterAndSort(dex, withFilters({ query: 'zzzz' }))).toEqual([])
  })

  it('sorts by a base stat, descending', () => {
    expect(names(filterAndSort(dex, withFilters({ sort: 'speed', direction: 'desc' })))[0]).toBe(
      'charizard',
    )
  })

  it('sorts by name ascending', () => {
    const result = names(filterAndSort(dex, withFilters({ sort: 'name' })))
    expect(result[0]).toBe('bulbasaur')
    expect(result.at(-1)).toBe('turtwig')
  })

  it('falls back to dex order when sorting by relevance without a query', () => {
    expect(names(filterAndSort(dex, withFilters({ sort: 'relevance' })))).toEqual([
      'bulbasaur',
      'charmander',
      'charizard',
      'squirtle',
      'pikachu',
      'treecko',
      'turtwig',
    ])
  })

  it('lets an explicit sort override relevance while searching', () => {
    const result = filterAndSort(dex, withFilters({ query: 'char', sort: 'id', direction: 'desc' }))
    expect(names(result)).toEqual(['charizard', 'charmander'])
  })

  it('breaks ties on dex number so the order is stable', () => {
    const tied = [entry(9, 'b-mon', ['normal'], 1), entry(2, 'a-mon', ['normal'], 1)]
    const result = filterAndSort(tied, withFilters({ sort: 'total' }))
    expect(result.map((item) => item.pokemon.id)).toEqual([2, 9])
  })
})

describe('filterAndSort with alternate forms', () => {
  it('surfaces a species whose form carries the filtered type', () => {
    // Charizard is Fire/Flying, but Mega X is Fire/Dragon.
    const result = filterAndSort(dex, withFilters({ types: ['dragon'] }))
    expect(names(result)).toEqual(['charizard'])
    expect(result[0]?.formName).toBe('charizard-mega-x')
  })

  it('prefers the base form when it already qualifies', () => {
    const result = filterAndSort(dex, withFilters({ types: ['fire', 'flying'] }))
    expect(result[0]?.pokemon.name).toBe('charizard')
    expect(result[0]?.formName).toBeNull()
  })

  it('finds a form by name and selects it', () => {
    const result = filterAndSort(dex, withFilters({ query: 'mega x' }))
    expect(result[0]?.pokemon.name).toBe('charizard')
    expect(result[0]?.formName).toBe('charizard-mega-x')
  })

  it('does not duplicate a species that has several matching forms', () => {
    const result = filterAndSort(dex, withFilters({ types: ['fire'] }))
    expect(names(result).filter((name) => name === 'charizard')).toHaveLength(1)
  })
})
