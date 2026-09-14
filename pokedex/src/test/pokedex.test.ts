import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, dexNumber, displayName, filterAndSort } from '../lib/pokedex'
import type { Pokemon, Stats } from '../lib/types'

const stats = (overrides: Partial<Stats> = {}): Stats => ({
  hp: 50,
  attack: 50,
  defense: 50,
  'special-attack': 50,
  'special-defense': 50,
  speed: 50,
  ...overrides,
})

const entry = (
  id: number,
  name: string,
  types: string[],
  generation: number,
  statOverrides: Partial<Stats> = {},
): Pokemon => ({
  id,
  name,
  types,
  stats: stats(statOverrides),
  height: 10,
  weight: 100,
  abilities: [],
  generation,
})

const dex: Pokemon[] = [
  entry(1, 'bulbasaur', ['grass', 'poison'], 1, { speed: 45 }),
  entry(4, 'charmander', ['fire'], 1, { speed: 65 }),
  entry(7, 'squirtle', ['water'], 1, { defense: 65 }),
  entry(25, 'pikachu', ['electric'], 1, { speed: 90 }),
  entry(252, 'treecko', ['grass'], 3, { speed: 70 }),
  entry(387, 'turtwig', ['grass'], 4, { attack: 68 }),
]

const withFilters = (patch: Partial<typeof DEFAULT_FILTERS>) => ({ ...DEFAULT_FILTERS, ...patch })

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
    const result = filterAndSort(dex, withFilters({ generations: [3, 4] }))
    expect(result.map((p) => p.name)).toEqual(['treecko', 'turtwig'])
  })

  it('requires every selected type to be present', () => {
    expect(filterAndSort(dex, withFilters({ types: ['grass'] })).map((p) => p.name)).toEqual([
      'bulbasaur',
      'treecko',
      'turtwig',
    ])

    expect(
      filterAndSort(dex, withFilters({ types: ['grass', 'poison'] })).map((p) => p.name),
    ).toEqual(['bulbasaur'])
  })

  it('combines type and generation filters', () => {
    const result = filterAndSort(dex, withFilters({ types: ['grass'], generations: [1] }))
    expect(result.map((p) => p.name)).toEqual(['bulbasaur'])
  })

  it('matches a name prefix ahead of a mid-string match', () => {
    const result = filterAndSort(dex, withFilters({ query: 'char' }))
    expect(result[0]?.name).toBe('charmander')
  })

  it('treats a numeric query as a dex-number prefix, lowest first', () => {
    // "25" should reach #25 and #252 alike — typing a number narrows, it does
    // not demand an exact hit.
    const result = filterAndSort(dex, withFilters({ query: '25' }))
    expect(result.map((p) => p.name)).toEqual(['pikachu', 'treecko'])
  })

  it('matches an exact dex number on its own', () => {
    const result = filterAndSort(dex, withFilters({ query: '387' }))
    expect(result.map((p) => p.name)).toEqual(['turtwig'])
  })

  it('falls back to a subsequence match for sloppy typing', () => {
    const result = filterAndSort(dex, withFilters({ query: 'sqrtl' }))
    expect(result.map((p) => p.name)).toContain('squirtle')
  })

  it('returns nothing when the query matches nothing', () => {
    expect(filterAndSort(dex, withFilters({ query: 'zzzz' }))).toEqual([])
  })

  it('sorts by a base stat, descending', () => {
    const result = filterAndSort(dex, withFilters({ sort: 'speed', direction: 'desc' }))
    expect(result[0]?.name).toBe('pikachu')
  })

  it('sorts by name ascending', () => {
    const result = filterAndSort(dex, withFilters({ sort: 'name' }))
    expect(result[0]?.name).toBe('bulbasaur')
    expect(result.at(-1)?.name).toBe('turtwig')
  })

  it('breaks ties on dex number so the order is stable', () => {
    const tied = [entry(9, 'b-mon', ['normal'], 1), entry(2, 'a-mon', ['normal'], 1)]
    const result = filterAndSort(tied, withFilters({ sort: 'total' }))
    expect(result.map((p) => p.id)).toEqual([2, 9])
  })
})
