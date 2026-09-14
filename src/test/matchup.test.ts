import { describe, expect, it } from 'vitest'
import { analyseMatchup, bestLead } from '../lib/matchup'
import { pickTarget, scoreAnswer, EMPTY_SCORE } from '../lib/quiz'
import type { Pokemon, Stats, TeamMember, TypeChart } from '../lib/types'

const chart: TypeChart = {
  water: { fire: 2, ground: 2, rock: 2, grass: 0.5, water: 0.5 },
  fire: { grass: 2, ice: 2, bug: 2, water: 0.5, rock: 0.5, fire: 0.5 },
  grass: { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, flying: 0.5 },
  electric: { water: 2, flying: 2, ground: 0, grass: 0.5, electric: 0.5 },
  ground: { fire: 2, electric: 2, rock: 2, flying: 0, grass: 0.5 },
  ghost: { ghost: 2, psychic: 2, normal: 0 },
  normal: { rock: 0.5, ghost: 0 },
}

const stats = (speed: number): Stats => ({
  hp: 50,
  attack: 50,
  defense: 50,
  'special-attack': 50,
  'special-defense': 50,
  speed,
})

const member = (name: string, types: string[], speed = 50): TeamMember => {
  const pokemon: Pokemon = {
    id: name.length + speed,
    name,
    types,
    stats: stats(speed),
    height: 10,
    weight: 100,
    abilities: [],
    generation: 1,
    forms: [],
  }
  return {
    pokemon,
    view: {
      id: pokemon.id,
      name,
      label: 'Base',
      title: name,
      category: 'default',
      types,
      stats: pokemon.stats,
      height: 10,
      weight: 100,
      abilities: [],
    },
  }
}

describe('analyseMatchup', () => {
  it('reads both directions of the trade', () => {
    // A Water member against a Fire opponent: hits hard, takes little.
    const [result] = analyseMatchup(chart, [member('squirtle', ['water'])], ['fire'])
    expect(result?.outgoing).toBe(2)
    expect(result?.incoming).toBe(0.5)
    expect(result?.verdict).toBe('good')
  })

  it('calls an immunity a wall', () => {
    const [result] = analyseMatchup(chart, [member('gengar', ['ghost'])], ['normal'])
    expect(result?.incoming).toBe(0)
    expect(result?.verdict).toBe('wall')
  })

  it('flags a member that is hit hard and cannot hit back', () => {
    // Grass into Fire: takes 2x, deals 0.5x.
    const [result] = analyseMatchup(chart, [member('bulbasaur', ['grass'])], ['fire'])
    expect(result?.incoming).toBe(2)
    expect(result?.outgoing).toBe(0.5)
    expect(result?.verdict).toBe('danger')
  })

  it('takes the worst incoming type of a dual-typed opponent', () => {
    const [result] = analyseMatchup(chart, [member('charmander', ['fire'])], ['water', 'normal'])
    expect(result?.incoming).toBe(2)
  })
})

describe('bestLead', () => {
  it('prefers the member with the better verdict', () => {
    const matchups = analyseMatchup(
      chart,
      [member('bulbasaur', ['grass']), member('squirtle', ['water'])],
      ['fire'],
    )
    expect(bestLead(matchups)?.member.pokemon.name).toBe('squirtle')
  })

  it('breaks a tie on speed', () => {
    const matchups = analyseMatchup(
      chart,
      [member('slow', ['water'], 20), member('fast', ['water'], 120)],
      ['fire'],
    )
    expect(bestLead(matchups)?.member.pokemon.name).toBe('fast')
  })

  it('returns nothing for an empty team', () => {
    expect(bestLead([])).toBeNull()
  })
})

describe('quiz scoring', () => {
  it('extends the streak on a correct answer', () => {
    const after = scoreAnswer({ streak: 2, best: 3, asked: 5, correct: 4 }, true)
    expect(after).toEqual({ streak: 3, best: 3, asked: 6, correct: 5 })
  })

  it('records a new best when the streak passes it', () => {
    const after = scoreAnswer({ streak: 3, best: 3, asked: 5, correct: 5 }, true)
    expect(after.best).toBe(4)
  })

  it('ends the streak on a wrong answer but still counts the question', () => {
    const after = scoreAnswer({ streak: 4, best: 6, asked: 9, correct: 7 }, false)
    expect(after).toEqual({ streak: 0, best: 6, asked: 10, correct: 7 })
  })

  it('starts from nothing', () => {
    expect(scoreAnswer(EMPTY_SCORE, true)).toEqual({ streak: 1, best: 1, asked: 1, correct: 1 })
  })
})

describe('pickTarget', () => {
  const dex: Pokemon[] = [
    { ...member('a', ['fire']).pokemon, id: 1, generation: 1 },
    { ...member('b', ['water']).pokemon, id: 2, generation: 1 },
    { ...member('c', ['grass']).pokemon, id: 3, generation: 3 },
  ]

  it('respects the generation filter', () => {
    const picked = pickTarget(dex, { generations: [3] }, null, () => 0)
    expect(picked?.id).toBe(3)
  })

  it('avoids repeating the previous question', () => {
    // With only two candidates in gen 1, excluding #1 must leave #2.
    const picked = pickTarget(dex, { generations: [1] }, 1, () => 0)
    expect(picked?.id).toBe(2)
  })

  it('allows a repeat when the pool holds a single entry', () => {
    const picked = pickTarget(dex, { generations: [3] }, 3, () => 0)
    expect(picked?.id).toBe(3)
  })

  it('returns nothing when the filter matches nothing', () => {
    expect(pickTarget(dex, { generations: [9] }, null, () => 0)).toBeNull()
  })
})
