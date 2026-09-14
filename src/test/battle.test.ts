import { describe, expect, it } from 'vitest'
import {
  bestMoveIndex,
  chooseOpponentAction,
  computeDamage,
  firstMover,
  hpAtLevel,
  isDown,
  makeBattler,
  resolveMoves,
  statAtLevel,
  STRUGGLE,
  usableMoves,
  willHit,
  type Battler,
} from '../lib/battle'
import { sendIn, startBattle, takeTurn } from '../lib/battleState'
import { buildTrainer, TRAINERS } from '../lib/trainers'
import { resolveForm, type Move, type MoveIndex, type Pokemon, type Stats, type TypeChart } from '../lib/types'

const chart: TypeChart = {
  water: { fire: 2, grass: 0.5, water: 0.5 },
  fire: { grass: 2, water: 0.5, fire: 0.5 },
  grass: { water: 2, fire: 0.5, grass: 0.5 },
  ghost: { normal: 0 },
  normal: { ghost: 0 },
}

const move = (over: Partial<Move> & { name: string }): Move => ({
  type: 'normal',
  damageClass: 'physical',
  power: 80,
  accuracy: 100,
  pp: 10,
  priority: 0,
  effect: null,
  ...over,
})

const moves: MoveIndex = {
  ember: move({ name: 'ember', type: 'fire', damageClass: 'special', power: 80 }),
  'fire-fang': move({ name: 'fire-fang', type: 'fire', power: 80 }),
  splash: move({ name: 'splash', type: 'water', damageClass: 'special', power: 80 }),
  vine: move({ name: 'vine', type: 'grass', power: 80 }),
  tackle: move({ name: 'tackle', type: 'normal', power: 40, pp: 2 }),
  quick: move({ name: 'quick', type: 'normal', power: 40, priority: 1 }),
  wild: move({ name: 'wild', type: 'normal', power: 120, accuracy: 50 }),
  sure: move({ name: 'sure', type: 'normal', power: 60, accuracy: null }),
  'focus-up': move({ name: 'focus-up', damageClass: 'status', power: 0, accuracy: null }),
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

const mon = (
  name: string,
  types: string[],
  over: Partial<Stats> = {},
  moveNames: string[] = [],
): Pokemon => ({
  id: name.length * 13 + types.length,
  name,
  types,
  stats: stats(over),
  height: 10,
  weight: 100,
  abilities: [],
  generation: 1,
  forms: [],
  moves: moveNames,
})

const battlerOf = (
  name: string,
  types: string[],
  over: Partial<Stats> = {},
  moveNames: string[] = ['tackle'],
): Battler => {
  const pokemon = mon(name, types, over, moveNames)
  return makeBattler(pokemon, resolveForm(pokemon, null), name, moves)
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

describe('resolveMoves', () => {
  it('keeps only moves it can find, in order', () => {
    expect(resolveMoves(['ember', 'nonsense', 'vine'], moves).map((slot) => slot.move.name)).toEqual(
      ['ember', 'vine'],
    )
  })

  it('leaves status moves out — nothing here can carry out what they do', () => {
    expect(resolveMoves(['focus-up', 'ember'], moves).map((slot) => slot.move.name)).toEqual([
      'ember',
    ])
  })

  it('drops duplicates and stops at four', () => {
    const names = ['ember', 'ember', 'vine', 'splash', 'tackle', 'quick']
    expect(resolveMoves(names, moves)).toHaveLength(4)
  })

  it('starts every slot on full PP', () => {
    const [slot] = resolveMoves(['tackle'], moves)
    expect(slot?.pp).toBe(2)
    expect(slot?.maxPp).toBe(2)
  })
})

describe('computeDamage', () => {
  const attacker = battlerOf('firemon', ['fire'], {}, ['ember', 'tackle'])
  const grassy = battlerOf('grassmon', ['grass'])
  const watery = battlerOf('watermon', ['water'])

  it('hits harder into a weakness than into a resistance', () => {
    const strong = computeDamage(chart, attacker, grassy, moves.ember!, () => 0.5)
    const weak = computeDamage(chart, attacker, watery, moves.ember!, () => 0.5)
    expect(strong.damage).toBeGreaterThan(weak.damage)
    expect(strong.multiplier).toBe(2)
    expect(weak.multiplier).toBe(0.5)
  })

  it('deals nothing through an immunity', () => {
    const ghostly = battlerOf('ghostmon', ['ghost'])
    const plain = battlerOf('normalmon', ['normal'])
    const result = computeDamage(chart, plain, ghostly, moves.tackle!, () => 0.5)
    expect(result.multiplier).toBe(0)
    expect(result.damage).toBe(0)
  })

  it('adds the same-type bonus only when the types line up', () => {
    const withStab = computeDamage(chart, attacker, grassy, moves.ember!, () => 0.5)
    const without = computeDamage(chart, battlerOf('plain', ['normal']), grassy, moves.ember!, () => 0.5)
    expect(withStab.damage).toBeGreaterThan(without.damage)
  })

  it('uses the special side for a special move and the physical side for a physical one', () => {
    // Same power and type, opposite damage classes; this attacker's physical
    // stat is twice its special one, so the physical move must land harder.
    const special = computeDamage(chart, attacker, grassy, moves.ember!, () => 0.5)
    const physical = computeDamage(chart, attacker, grassy, moves['fire-fang']!, () => 0.5)
    expect(physical.damage).toBeGreaterThan(special.damage)
  })

  it('is deterministic for a fixed roll, and varies across the spread', () => {
    const low = computeDamage(chart, attacker, grassy, moves.ember!, () => 0)
    const high = computeDamage(chart, attacker, grassy, moves.ember!, () => 1)
    expect(computeDamage(chart, attacker, grassy, moves.ember!, () => 0).damage).toBe(low.damage)
    expect(high.damage).toBeGreaterThan(low.damage)
  })

  it('lets Struggle through an immunity, and charges the user for it', () => {
    const ghostly = battlerOf('ghostmon', ['ghost'])
    const plain = battlerOf('normalmon', ['normal'])
    const result = computeDamage(chart, plain, ghostly, STRUGGLE, () => 0.5)
    expect(result.multiplier).toBe(1)
    expect(result.damage).toBeGreaterThan(0)
    expect(result.recoil).toBeGreaterThan(0)
  })
})

describe('willHit', () => {
  it('treats a null accuracy as never missing', () => {
    expect(willHit(moves.sure!, () => 0.99)).toBe(true)
  })

  it('respects the accuracy it is given', () => {
    expect(willHit(moves.wild!, () => 0.1)).toBe(true)
    expect(willHit(moves.wild!, () => 0.9)).toBe(false)
  })
})

describe('firstMover', () => {
  const quick = battlerOf('quick', ['fire'], { speed: 150 })
  const slow = battlerOf('slow', ['grass'], { speed: 30 })

  it('lets the faster one act first', () => {
    expect(firstMover(quick, slow, moves.tackle!, moves.tackle!, () => 0.9)).toBe('a')
    expect(firstMover(slow, quick, moves.tackle!, moves.tackle!, () => 0.9)).toBe('b')
  })

  it('lets priority beat speed', () => {
    expect(firstMover(slow, quick, moves.quick!, moves.tackle!, () => 0.9)).toBe('a')
  })

  it('flips a coin on a tie', () => {
    const a = battlerOf('a', ['fire'])
    const b = battlerOf('b', ['grass'])
    expect(firstMover(a, b, moves.tackle!, moves.tackle!, () => 0.1)).toBe('a')
    expect(firstMover(a, b, moves.tackle!, moves.tackle!, () => 0.9)).toBe('b')
  })
})

describe('bestMoveIndex', () => {
  const attacker = battlerOf('firemon', ['fire'], {}, ['tackle', 'ember'])
  const grassy = battlerOf('grassmon', ['grass'])

  it('picks the move that actually hurts, above easy', () => {
    expect(bestMoveIndex(chart, attacker, grassy, 'normal', () => 0)).toBe(1)
    expect(bestMoveIndex(chart, attacker, grassy, 'hard', () => 0)).toBe(1)
  })

  it('is not reading the chart on easy', () => {
    expect(bestMoveIndex(chart, attacker, grassy, 'easy', () => 0)).toBe(0)
  })

  it('reports nothing usable when the PP is gone', () => {
    const empty: Battler = {
      ...attacker,
      moves: attacker.moves.map((slot) => ({ ...slot, pp: 0 })),
    }
    expect(usableMoves(empty)).toHaveLength(0)
    expect(bestMoveIndex(chart, empty, grassy, 'hard', () => 0)).toBe(-1)
  })
})

describe('chooseOpponentAction', () => {
  const active = battlerOf('grassmon', ['grass'], {}, ['vine'])
  const better = battlerOf('watermon', ['water'], {}, ['splash'])
  const target = battlerOf('firemon', ['fire'], {}, ['ember'])

  it('never thinks on easy', () => {
    const action = chooseOpponentAction(chart, active, [active, better], target, 'easy', () => 0)
    expect(action.kind).toBe('move')
  })

  it('switches to a better answer on hard', () => {
    const action = chooseOpponentAction(chart, active, [active, better], target, 'hard', () => 0)
    expect(action.kind).toBe('switch')
    if (action.kind === 'switch') expect(action.to.key).toBe('watermon')
  })

  it('attacks when nothing on the bench is better', () => {
    const action = chooseOpponentAction(chart, better, [better], target, 'hard', () => 0)
    expect(action.kind).toBe('move')
  })
})

describe('the battle loop', () => {
  const trainer = {
    blueprint: TRAINERS[0]!,
    difficulty: 'easy' as const,
    team: [
      battlerOf('foe-a', ['grass'], {}, ['vine']),
      battlerOf('foe-b', ['grass'], {}, ['vine']),
    ],
  }
  const party = [
    battlerOf('you-a', ['fire'], {}, ['ember', 'tackle']),
    battlerOf('you-b', ['water'], {}, ['splash']),
  ]
  const options = { chart, difficulty: 'easy' as const, roll: () => 0.5 }

  it('starts with both leads out and a log', () => {
    const state = startBattle(party, trainer)
    expect(state.playerActive).toBe(0)
    expect(state.foeActive).toBe(0)
    expect(state.phase).toBe('choosing')
    expect(state.log.length).toBeGreaterThan(0)
  })

  it('damages the opponent and spends the PP when you attack', () => {
    const state = takeTurn(startBattle(party, trainer), { kind: 'move', index: 0 }, options)
    expect(state.foe[0]!.hp).toBeLessThan(state.foe[0]!.maxHp)
    expect(state.player[0]!.moves[0]!.pp).toBe(state.player[0]!.moves[0]!.maxPp - 1)
  })

  it('names the move in the log', () => {
    const state = takeTurn(startBattle(party, trainer), { kind: 'move', index: 0 }, options)
    expect(state.log.some((line) => line.includes('Ember'))).toBe(true)
  })

  it('costs you the attack when you switch', () => {
    const state = takeTurn(startBattle(party, trainer), { kind: 'switch', index: 1 }, options)
    expect(state.playerActive).toBe(1)
    // The opponent still swung, but nothing of ours landed.
    expect(state.foe[0]!.hp).toBe(state.foe[0]!.maxHp)
  })

  it('charges PP for a miss as well as a hit', () => {
    const misser = [battlerOf('you-a', ['normal'], {}, ['wild'])]
    // 0.9 misses a 50%-accurate move; the slot should still be down one.
    const state = takeTurn(startBattle(misser, trainer), { kind: 'move', index: 0 }, {
      ...options,
      roll: () => 0.9,
    })
    expect(state.player[0]!.moves[0]!.pp).toBe(state.player[0]!.moves[0]!.maxPp - 1)
    expect(state.log.some((line) => line === 'It missed.')).toBe(true)
  })

  it('falls back to Struggle once the PP is gone', () => {
    const spent = startBattle(party, trainer)
    const drained = {
      ...spent,
      player: [
        { ...spent.player[0]!, moves: spent.player[0]!.moves.map((slot) => ({ ...slot, pp: 0 })) },
        spent.player[1]!,
      ],
    }
    const state = takeTurn(drained, { kind: 'move', index: 0 }, options)
    expect(state.log.some((line) => line.includes('Struggle'))).toBe(true)
    // Recoil means the attacker is hurt too, not only the target.
    expect(state.player[0]!.hp).toBeLessThan(state.player[0]!.maxHp)
  })

  it('asks for a replacement when yours faints, and ends when none are left', () => {
    let state = startBattle(
      [battlerOf('glass', ['grass'], { hp: 1, defense: 1, 'special-defense': 1 }, ['vine'])],
      {
        ...trainer,
        team: [battlerOf('bruiser', ['fire'], { attack: 200, speed: 200 }, ['fire-fang'])],
      },
    )

    for (let guard = 0; guard < 20 && state.phase === 'choosing'; guard++) {
      state = takeTurn(state, { kind: 'move', index: 0 }, options)
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
  const dex: Pokemon[] = Array.from({ length: 40 }, (_, index) => {
    const type = index % 2 === 0 ? 'water' : 'fire'
    return {
      ...mon(`mon-${index}`, [type], { attack: 60 + index * 5 }, [
        type === 'water' ? 'splash' : 'ember',
        'tackle',
      ]),
      id: index + 1,
    }
  })

  it('fills a team of six without repeats', () => {
    const trainer = buildTrainer(TRAINERS[0]!, dex, 'normal', moves, () => Math.random())
    expect(trainer.team).toHaveLength(6)
    expect(new Set(trainer.team.map((member) => member.pokemon.id)).size).toBe(6)
  })

  it('respects the theme when the pool allows it', () => {
    const trainer = buildTrainer(TRAINERS[0]!, dex, 'easy', moves, () => Math.random())
    expect(trainer.team.every((member) => member.view.types.includes('water'))).toBe(true)
  })

  it('starts every member at full health, with moves in hand', () => {
    const trainer = buildTrainer(TRAINERS[0]!, dex, 'normal', moves, () => Math.random())
    expect(trainer.team.every((member) => !isDown(member) && member.hp === member.maxHp)).toBe(true)
    expect(trainer.team.every((member) => member.moves.length > 0)).toBe(true)
  })
})
