import { describe, expect, it } from 'vitest'
import {
  defensiveProfile,
  effectiveness,
  teamCoverage,
  uncoveredThreats,
} from '../lib/typeChart'
import type { TypeChart } from '../lib/types'

/**
 * A trimmed chart with just the types these tests need. Matches the shape the
 * fetch script produces: only non-1x entries are stored.
 */
const chart: TypeChart = {
  water: { fire: 2, ground: 2, rock: 2, grass: 0.5, water: 0.5 },
  electric: { water: 2, flying: 2, ground: 0, grass: 0.5, electric: 0.5 },
  grass: { water: 2, ground: 2, rock: 2, fire: 0.5, flying: 0.5, grass: 0.5 },
  fire: { grass: 2, ice: 2, bug: 2, water: 0.5, rock: 0.5, fire: 0.5 },
  ground: { fire: 2, electric: 2, rock: 2, flying: 0, grass: 0.5, bug: 0.5 },
  normal: { rock: 0.5, ghost: 0 },
  ghost: { ghost: 2, normal: 0 },
}

const allTypes = Object.keys(chart)

describe('effectiveness', () => {
  it('returns 1 for a matchup the chart says nothing about', () => {
    expect(effectiveness(chart, 'normal', ['water'])).toBe(1)
  })

  it('reads a single-type matchup straight off the chart', () => {
    expect(effectiveness(chart, 'water', ['fire'])).toBe(2)
    expect(effectiveness(chart, 'water', ['grass'])).toBe(0.5)
  })

  it('multiplies across a dual typing', () => {
    // Ground/Rock is hit twice over by Water.
    expect(effectiveness(chart, 'water', ['ground', 'rock'])).toBe(4)
    // Grass/Water resists twice over.
    expect(effectiveness(chart, 'water', ['grass', 'water'])).toBe(0.25)
  })

  it('lets an immunity win over any amount of weakness', () => {
    // Ground does nothing to anything Flying, even a Ground/Flying target.
    expect(effectiveness(chart, 'ground', ['rock', 'flying'])).toBe(0)
  })

  it('falls back to 1 for an attacker that is not in the chart', () => {
    expect(effectiveness(chart, 'fairy', ['water'])).toBe(1)
  })
})

describe('defensiveProfile', () => {
  it('splits matchups into weaknesses, resistances and immunities', () => {
    const profile = defensiveProfile(chart, allTypes, ['water'])

    expect(profile.weaknesses.map((entry) => entry.type)).toContain('grass')
    expect(profile.weaknesses.map((entry) => entry.type)).toContain('electric')
    expect(profile.resistances.map((entry) => entry.type)).toContain('fire')
    expect(profile.resistances.map((entry) => entry.type)).toContain('water')
    expect(profile.immunities).toEqual([])
  })

  it('lists immunities separately rather than as 0x resistances', () => {
    const profile = defensiveProfile(chart, allTypes, ['ghost'])
    expect(profile.immunities).toContain('normal')
    expect(profile.resistances.map((entry) => entry.type)).not.toContain('normal')
  })

  it('orders weaknesses worst-first', () => {
    const profile = defensiveProfile(chart, allTypes, ['ground', 'rock'])

    // Water and Grass both stack to 4x here; ties fall back to alphabetical so
    // the order is at least stable.
    expect(profile.weaknesses[0]?.multiplier).toBe(4)
    expect(
      profile.weaknesses.filter((entry) => entry.multiplier === 4).map((entry) => entry.type),
    ).toEqual(['grass', 'water'])
    expect(profile.weaknesses.at(-1)?.multiplier).toBe(2)
  })
})

describe('teamCoverage', () => {
  const team = [{ types: ['fire'] }, { types: ['ground'] }]

  it('reports a multiplier per member, in team order', () => {
    const rows = teamCoverage(chart, allTypes, team)
    const water = rows.find((row) => row.type === 'water')

    expect(water?.multipliers).toEqual([2, 2])
    expect(water?.weakCount).toBe(2)
    expect(water?.resistCount).toBe(0)
  })

  it('counts immunities apart from resistances', () => {
    const rows = teamCoverage(chart, allTypes, [{ types: ['flying'] }])
    const ground = rows.find((row) => row.type === 'ground')

    expect(ground?.immuneCount).toBe(1)
    expect(ground?.resistCount).toBe(0)
  })
})

describe('uncoveredThreats', () => {
  it('flags types that hit the team with nothing resisting them', () => {
    // Both members are weak to Water and neither resists it.
    const rows = teamCoverage(chart, allTypes, [{ types: ['fire'] }, { types: ['ground'] }])
    const threats = uncoveredThreats(rows).map((row) => row.type)

    expect(threats).toContain('water')
  })

  it('clears a threat as soon as one member resists it', () => {
    // Adding a Water member gives the team a Water resist.
    const rows = teamCoverage(chart, allTypes, [{ types: ['fire'] }, { types: ['water'] }])
    const threats = uncoveredThreats(rows).map((row) => row.type)

    expect(threats).not.toContain('water')
  })

  it('treats an immunity as coverage too', () => {
    const rows = teamCoverage(chart, allTypes, [{ types: ['fire'] }, { types: ['flying'] }])
    const threats = uncoveredThreats(rows).map((row) => row.type)

    expect(threats).not.toContain('ground')
  })
})
