import { describe, expect, it } from 'vitest'
import {
  chooseOpponentAction,
  computeDamage,
  firstMover,
  hpAtLevel,
  isDown,
  makeBattler,
  statAtLevel,
  type Battler,
} from '../lib/battle'
import { sendIn, startBattle, takeTurn } from '../lib/battleState'
import { buildTrainer, TRAINERS } from '../lib/trainers'
import { resolveForm, type Pokemon, type Stats, type TypeChart } from '../lib/types'

const chart: TypeChart = {
  water: { fire: 2, grass: 0.5, water: 0.5 },
  fire: { grass: 2, water: 0.5, fire: 0.5 },
  grass: { water: 2, fire: 0.5, grass: 0.5 },
  ghost: { normal: 0 },
  normal: { ghost: 0 },
}

const stats = (over: Partial<Stats> = {}): Stats => ({
  hp: 100,
  attack: 100,
  defense: 100,
  'special-attack': 50,
  'special-defense': 100,
  speed: 100,
  ...over,
})

const mon = (name: string, types: string[], over: Partial<Stats> = {}): Pokemon => ({
  id: name.length * 13 + types.length,
  name,
  types,
  stats: stats(over),
  height: 10,
  weight: 100,
  abilities: [],
  generation: 1,
  forms: [],
})

const battlerOf = (name: string, types: string[], over: Partial<Stats> = {}): Battler => {
  const pokemon = mon(name, types, over)
  return makeBattler(pokemon, resolveForm(pokemon, null), name)
}

describe('stat conversion', () => {
  it('matches the level-50 baseline every calculator uses', () => {
    // floor(2 * 100 * 50 / 100) + 5
    expect(statAtLevel(100)).toBe(105)
    // floor(2 * 100 * 50 / 100) + 50 + 10
    expect(hpAtLevel(100)).toBe(160)
  })

  it('scales with the base stat', () => {
    expect(statAtLevel(50)).toBeLessThan(statAtLevel(150))
  })
})

describe('computeDamage', () => {
  const attacker = battlerOf('firemon', ['fire'])
  const grassy = battlerOf('grassmon', ['grass'])
  const watery = battlerOf('watermon', ['water'])

  it('hits harder into a weakness than into a resistance', () => {
    const strong = computeDamage(chart, attacker, grassy, () => 0.5)
    const weak = computeDamage(chart, attacker, watery, () => 0.5)
    expect(strong.damage).toBeGreaterThan(weak.damage)
    expect(strong.multiplier).toBe(2)
    expect(weak.multiplier).toBe(0.5)
  })

  it('deals nothing through an immunity', () => {
    const ghostly = battlerOf('ghostmon', ['ghost'])
    const plain = battlerOf('normalmon', ['normal'])
    const result = computeDamage(chart, plain, ghostly, () => 0.5)
    expect(result.multiplier).toBe(0)
    expect(result.damage).toBe(0)
  })

  it('is deterministic for a fixed roll, and varies across the spread', () => {
    const low = computeDamage(chart, attacker, grassy, () => 0)
    const high = computeDamage(chart, attacker, grassy, () => 1)
    expect(computeDamage(chart, attacker, grassy, () => 0).damage).toBe(low.damage)
    expect(high.damage).toBeGreaterThan(low.damage)
  })

  it('uses the special side when the special attack stat is higher', () => {
    const specialist = battlerOf('specialmon', ['fire'], { attack: 40, 'special-attack': 140 })
    expect(computeDamage(chart, specialist, grassy, () => 0.5).special).toBe(true)
  })
})

describe('firstMover', () => {
  it('lets the faster one act first', () => {
    const quick = battlerOf('quick', ['fire'], { speed: 150 })
    const slow = battlerOf('slow', ['grass'], { speed: 30 })
    expect(firstMover(quick, slow, () => 0.9)).toBe('a')
    expect(firstMover(slow, quick, () => 0.9)).toBe('b')
  })

  it('flips a coin on a tie', () => {
    const a = battlerOf('a', ['fire'])
    const b = battlerOf('b', ['grass'])
    expect(firstMover(a, b, () => 0.1)).toBe('a')
    expect(firstMover(a, b, () => 0.9)).toBe('b')
  })
})

describe('chooseOpponentAction', () => {
  const active = battlerOf('grassmon', ['grass'])
  const better = battlerOf('watermon', ['water'])
  const target = battlerOf('firemon', ['fire'])

  it('never thinks on easy', () => {
    const action = chooseOpponentAction(chart, active, [active, better], target, 'easy', () => 0)
    expect(action.kind).toBe('attack')
  })

  it('switches to a better answer on hard', () => {
    const action = chooseOpponentAction(chart, active, [active, better], target, 'hard', () => 0)
    expect(action.kind).toBe('switch')
    if (action.kind === 'switch') expect(action.to.key).toBe('watermon')
  })

  it('attacks when nothing on the bench is better', () => {
    const action = chooseOpponentAction(chart, better, [better], target, 'hard', () => 0)
    expect(action.kind).toBe('attack')
  })
})

describe('the battle loop', () => {
  const trainer = {
    blueprint: TRAINERS[0]!,
    difficulty: 'easy' as const,
    team: [battlerOf('foe-a', ['grass']), battlerOf('foe-b', ['grass'])],
  }
  const party = [battlerOf('you-a', ['fire']), battlerOf('you-b', ['water'])]

  it('starts with both leads out and a log', () => {
    const state = startBattle(party, trainer)
    expect(state.playerActive).toBe(0)
    expect(state.foeActive).toBe(0)
    expect(state.phase).toBe('choosing')
    expect(state.log.length).toBeGreaterThan(0)
  })

  it('damages the opponent when you attack', () => {
    const state = takeTurn(startBattle(party, trainer), { kind: 'attack' }, {
      chart,
      difficulty: 'easy',
      roll: () => 0.5,
    })
    expect(state.foe[0]!.hp).toBeLessThan(state.foe[0]!.maxHp)
  })

  it('costs you the attack when you switch', () => {
    const state = takeTurn(startBattle(party, trainer), { kind: 'switch', index: 1 }, {
      chart,
      difficulty: 'easy',
      roll: () => 0.5,
    })
    expect(state.playerActive).toBe(1)
    // The opponent still swung, but nothing of ours landed.
    expect(state.foe[0]!.hp).toBe(state.foe[0]!.maxHp)
  })

  it('asks for a replacement when yours faints, and ends when none are left', () => {
    let state = startBattle(
      [battlerOf('glass', ['grass'], { hp: 1, defense: 1, 'special-defense': 1 })],
      { ...trainer, team: [battlerOf('bruiser', ['fire'], { attack: 200, speed: 200 })] },
    )

    for (let guard = 0; guard < 20 && state.phase === 'choosing'; guard++) {
      state = takeTurn(state, { kind: 'attack' }, { chart, difficulty: 'easy', roll: () => 0.5 })
    }

    expect(state.phase).toBe('over')
    expect(state.winner).toBe('foe')
  })

  it('sends in a replacement without spending a turn', () => {
    const base = startBattle(party, trainer)
    const downed = {
      ...base,
      player: [{ ...base.player[0]!, hp: 0 }, base.player[1]!],
      phase: 'must-switch' as const,
    }
    const state = sendIn(downed, 1)
    expect(state.playerActive).toBe(1)
    expect(state.phase).toBe('choosing')
  })

  it('refuses to send in something that has fainted', () => {
    const base = startBattle(party, trainer)
    const downed = {
      ...base,
      player: [base.player[0]!, { ...base.player[1]!, hp: 0 }],
      phase: 'must-switch' as const,
    }
    expect(sendIn(downed, 1)).toBe(downed)
  })
})

describe('buildTrainer', () => {
  // Explicit ids: the shared helper derives one from the name length, which
  // would collide across a generated range and quietly shrink the pool.
  const dex: Pokemon[] = Array.from({ length: 40 }, (_, index) => ({
    ...mon(`mon-${index}`, [index % 2 === 0 ? 'water' : 'fire'], { attack: 60 + index * 5 }),
    id: index + 1,
  }))

  it('fills a team of six without repeats', () => {
    const trainer = buildTrainer(TRAINERS[0]!, dex, 'normal', () => Math.random())
    expect(trainer.team).toHaveLength(6)
    expect(new Set(trainer.team.map((member) => member.pokemon.id)).size).toBe(6)
  })

  it('respects the theme when the pool allows it', () => {
    const trainer = buildTrainer(TRAINERS[0]!, dex, 'easy', () => Math.random())
    expect(trainer.team.every((member) => member.view.types.includes('water'))).toBe(true)
  })

  it('starts every member at full health', () => {
    const trainer = buildTrainer(TRAINERS[0]!, dex, 'normal', () => Math.random())
    expect(trainer.team.every((member) => !isDown(member) && member.hp === member.maxHp)).toBe(true)
  })
})
