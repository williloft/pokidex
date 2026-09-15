import { describe, expect, it } from 'vitest'
import {
  atStage,
  buildTrainer,
  fieldTeam,
  TIERS,
  viewForTier,
  type TrainerBlueprint,
} from '../lib/trainers'
import { ladderProgress, ladderSteps, withWin, EMPTY_LADDER } from '../lib/ladder'
import { TRAINERS } from '../lib/trainers'
import { resolveForm, type Move, type MoveIndex, type Pokemon, type Stats } from '../lib/types'

const stats = (total: number): Stats => ({
  hp: total,
  attack: total,
  defense: total,
  'special-attack': total - 20,
  'special-defense': total,
  speed: total,
})

const moves: MoveIndex = {
  'fire-hit': {
    name: 'fire-hit',
    type: 'fire',
    damageClass: 'physical',
    power: 80,
    accuracy: 100,
    pp: 15,
    priority: 0,
    effect: null,
  } as Move,
}

interface Spec {
  id: number
  name: string
  types: string[]
  power: number
  line?: number[]
  legendary?: boolean
  mega?: boolean
  gmax?: boolean
}

const make = (spec: Spec): Pokemon => ({
  id: spec.id,
  name: spec.name,
  types: spec.types,
  stats: stats(spec.power),
  height: 10,
  weight: 100,
  abilities: [],
  generation: 1,
  moves: ['fire-hit'],
  line: spec.line ?? [spec.id],
  legendary: spec.legendary ?? false,
  mythical: false,
  forms: [
    ...(spec.mega
      ? [
          {
            id: 10000 + spec.id,
            name: `${spec.name}-mega`,
            label: 'Mega',
            category: 'mega' as const,
            types: spec.types,
            stats: stats(spec.power + 40),
            height: 20,
            weight: 200,
            abilities: [],
            moves: ['fire-hit'],
          },
        ]
      : []),
    ...(spec.gmax
      ? [
          {
            id: 20000 + spec.id,
            name: `${spec.name}-gmax`,
            label: 'Gmax',
            category: 'gmax' as const,
            types: spec.types,
            stats: stats(spec.power + 10),
            height: 300,
            weight: 9000,
            abilities: [],
            moves: ['fire-hit'],
          },
        ]
      : []),
  ],
})

// A three-stage line, a two-stage line, a standalone, and a legendary ace.
const dex: Pokemon[] = [
  make({ id: 4, name: 'charmander', types: ['fire'], power: 50, line: [4, 5, 6] }),
  make({ id: 5, name: 'charmeleon', types: ['fire'], power: 70, line: [4, 5, 6] }),
  make({ id: 6, name: 'charizard', types: ['fire'], power: 90, line: [4, 5, 6], mega: true, gmax: true }),
  make({ id: 58, name: 'growlithe', types: ['fire'], power: 55, line: [58, 59] }),
  make({ id: 59, name: 'arcanine', types: ['fire'], power: 85, line: [58, 59] }),
  make({ id: 77, name: 'ponyta', types: ['fire'], power: 60, line: [77, 78] }),
  make({ id: 78, name: 'rapidash', types: ['fire'], power: 80, line: [77, 78] }),
  make({ id: 126, name: 'magmar', types: ['fire'], power: 75, line: [126], mega: true }),
  make({ id: 136, name: 'flareon', types: ['fire'], power: 78, line: [133, 136] }),
  make({ id: 133, name: 'eevee', types: ['normal'], power: 45, line: [133] }),
  make({ id: 38, name: 'ninetales', types: ['fire'], power: 82, line: [37, 38] }),
  make({ id: 37, name: 'vulpix', types: ['fire'], power: 50, line: [37, 38] }),
  make({ id: 384, name: 'rayquaza', types: ['dragon'], power: 105, legendary: true, mega: true }),
]

const blueprint: TrainerBlueprint = {
  id: 'test',
  name: 'Calla',
  title: 'Emberwright',
  blurb: 'test',
  theme: 'fire',
  team: ['ninetales', 'flareon', 'rapidash', 'magmar', 'arcanine', 'charizard'],
  ace: 'rayquaza',
}

const byId = new Map(dex.map((entry) => [entry.id, entry]))
const named = (name: string) => dex.find((entry) => entry.name === name)!

describe('atStage', () => {
  it('steps one back down a three-stage line', () => {
    expect(atStage(named('charizard'), 1, byId).name).toBe('charmeleon')
  })

  it('stops at the base rather than falling off the end', () => {
    expect(atStage(named('arcanine'), 1, byId).name).toBe('growlithe')
    expect(atStage(named('growlithe'), 1, byId).name).toBe('growlithe')
  })

  it('leaves something with no evolutions alone', () => {
    expect(atStage(named('rayquaza'), 1, byId).name).toBe('rayquaza')
  })

  it('does nothing at all when the tier asks for the full stage', () => {
    expect(atStage(named('charizard'), 0, byId).name).toBe('charizard')
  })
})

describe('viewForTier', () => {
  it('keeps everything on its base form when forms are off', () => {
    const view = viewForTier(named('charizard'), TIERS.easy, { megas: 1, gmax: 1 })
    expect(view.category).toBe('default')
  })

  it('reaches for the Mega first when one is allowed', () => {
    const view = viewForTier(named('charizard'), TIERS.hard, { megas: 1, gmax: 1 })
    expect(view.category).toBe('mega')
  })

  it('falls back to Gigantamax once the Mega slot is spent', () => {
    const budget = { megas: 0, gmax: 1 }
    expect(viewForTier(named('charizard'), TIERS.hard, budget).category).toBe('gmax')
  })

  it('spends the budget, so a team cannot field six Megas', () => {
    const budget = { megas: 1, gmax: 0 }
    expect(viewForTier(named('charizard'), TIERS.hard, budget).category).toBe('mega')
    expect(viewForTier(named('magmar'), TIERS.hard, budget).category).toBe('default')
  })

  it('fields a special form when there is no Mega or Gigantamax to take', () => {
    // A form that changes typing or stats but is neither a Mega nor a Gmax —
    // the Ash-Greninja shape. It is what that Pokémon is, so no budget applies.
    const special = make({ id: 658, name: 'greninja', types: ['water'], power: 80 })
    special.forms = [
      {
        id: 10116,
        name: 'greninja-ash',
        label: 'Ash',
        category: 'other',
        types: ['water', 'dark'],
        stats: stats(110),
        height: 15,
        weight: 400,
        abilities: [],
        moves: ['fire-hit'],
      },
    ]
    const budget = { megas: 0, gmax: 0 }
    expect(viewForTier(special, TIERS.hard, budget).name).toBe('greninja-ash')
    // ...but never when the tier has forms switched off.
    expect(viewForTier(special, TIERS.easy, budget).category).toBe('default')
  })
})

describe('buildTrainer', () => {
  it('fields the signature six', () => {
    const trainer = buildTrainer(blueprint, dex, 'normal', moves)
    expect(trainer.team).toHaveLength(6)
    expect(trainer.team.map((m) => m.pokemon.name).sort()).toEqual(
      ['arcanine', 'charizard', 'flareon', 'magmar', 'ninetales', 'rapidash'].sort(),
    )
  })

  it('brings the unevolved stage on Easy — Charmeleon, not Charizard', () => {
    const trainer = buildTrainer(blueprint, dex, 'easy', moves)
    const names = trainer.team.map((m) => m.pokemon.name)
    expect(names).toContain('charmeleon')
    expect(names).not.toContain('charizard')
    expect(names).toContain('growlithe')
    expect(names).not.toContain('arcanine')
  })

  it('uses no alternate forms at all on Easy', () => {
    const trainer = buildTrainer(blueprint, dex, 'easy', moves)
    expect(trainer.team.every((m) => m.view.category === 'default')).toBe(true)
  })

  it('leaves the legendary at home below Hard, and brings it on Hard', () => {
    const below = buildTrainer(blueprint, dex, 'normal', moves)
    expect(below.team.some((m) => m.pokemon.name === 'rayquaza')).toBe(false)

    const top = buildTrainer(blueprint, dex, 'hard', moves)
    expect(top.team.some((m) => m.pokemon.name === 'rayquaza')).toBe(true)
  })

  it('brings the ace as a Mega where it has one', () => {
    const top = buildTrainer(blueprint, dex, 'hard', moves)
    const ace = top.team.find((m) => m.pokemon.name === 'rayquaza')
    expect(ace?.view.category).toBe('mega')
  })

  it('still fields six when the tier has no room for the ace', () => {
    const top = buildTrainer(blueprint, dex, 'hard', moves)
    expect(top.team).toHaveLength(6)
    expect(new Set(top.team.map((m) => m.pokemon.id)).size).toBe(6)
  })

  it('never fields more than one Mega and one Gigantamax', () => {
    const top = buildTrainer(blueprint, dex, 'hard', moves)
    expect(top.team.filter((m) => m.view.category === 'mega').length).toBeLessThanOrEqual(1)
    expect(top.team.filter((m) => m.view.category === 'gmax').length).toBeLessThanOrEqual(1)
  })

  it('orders the roster weakest first, so the best is last', () => {
    const trainer = buildTrainer(blueprint, dex, 'normal', moves)
    const totals = trainer.team.map((m) => m.pokemon.stats.attack)
    expect([...totals].sort((a, b) => a - b)).toEqual(totals)
  })

  it('falls back to the themed pool when a signature name is missing', () => {
    // A dataset that has none of the named six should still produce a full team.
    const strangers = dex.map((entry, index) => ({ ...entry, name: `stranger-${index}` }))
    const trainer = buildTrainer(blueprint, strangers, 'normal', moves)
    expect(trainer.team).toHaveLength(6)
  })
})

describe('fieldTeam', () => {
  const mega = { pokemon: named('charizard'), view: resolveForm(named('charizard'), 'charizard-mega') }
  const plain = { pokemon: named('arcanine'), view: resolveForm(named('arcanine'), null) }

  it('flattens your forms to base on Easy, and says so', () => {
    const [entry] = fieldTeam([mega], TIERS.easy)
    expect(entry?.view.category).toBe('default')
    expect(entry?.note).toContain('fights as')
  })

  it('leaves them alone when the tier allows forms', () => {
    const [entry] = fieldTeam([mega], TIERS.hard)
    expect(entry?.view.category).toBe('mega')
    expect(entry?.note).toBeNull()
  })

  it('holds you to one Mega, as it holds the trainer', () => {
    const second = {
      pokemon: named('magmar'),
      view: resolveForm(named('magmar'), 'magmar-mega'),
    }
    const fielded = fieldTeam([mega, second], TIERS.hard)
    expect(fielded.filter((entry) => entry.view.category === 'mega')).toHaveLength(1)
    expect(fielded[1]?.note).toContain('one Mega per battle')
  })

  it('says nothing about a Pokémon that was never in a special form', () => {
    expect(fieldTeam([plain], TIERS.easy)[0]?.note).toBeNull()
  })

  /*
   * A regional form is not a transformation you spend during a battle — it is
   * simply what that Pokémon is. Flattening it read as "Alolan Raichu fights
   * as Raichu", which is not a rule, it is losing your Pokémon.
   */
  it('never flattens a regional form, on any tier', () => {
    const raichu = make({ id: 26, name: 'raichu', types: ['electric'], power: 70 })
    raichu.forms = [
      {
        id: 10100,
        name: 'raichu-alola',
        label: 'Alola',
        category: 'regional',
        types: ['electric', 'psychic'],
        stats: stats(70),
        height: 7,
        weight: 210,
        abilities: [],
        moves: ['fire-hit'],
      },
    ]
    const alolan = { pokemon: raichu, view: resolveForm(raichu, 'raichu-alola') }

    for (const tier of [TIERS.easy, TIERS.normal, TIERS.hard]) {
      const [entry] = fieldTeam([alolan], tier)
      expect(entry?.view.name).toBe('raichu-alola')
      expect(entry?.note).toBeNull()
    }
  })

  it('still counts a regional form against nothing, so Megas keep their slot', () => {
    const raichu = make({ id: 26, name: 'raichu', types: ['electric'], power: 70 })
    raichu.forms = [
      {
        id: 10100,
        name: 'raichu-alola',
        label: 'Alola',
        category: 'regional',
        types: ['electric', 'psychic'],
        stats: stats(70),
        height: 7,
        weight: 210,
        abilities: [],
        moves: ['fire-hit'],
      },
    ]
    const fielded = fieldTeam(
      [{ pokemon: raichu, view: resolveForm(raichu, 'raichu-alola') }, mega],
      TIERS.hard,
    )
    expect(fielded[0]?.view.name).toBe('raichu-alola')
    expect(fielded[1]?.view.category).toBe('mega')
  })
})

describe('the ladder', () => {
  it('opens with only the first rung available', () => {
    const steps = ladderSteps(EMPTY_LADDER, 'normal')
    expect(steps[0]?.locked).toBe(false)
    expect(steps[1]?.locked).toBe(true)
    expect(steps[steps.length - 1]?.champion).toBe(true)
  })

  it('unlocks the next rung when you win', () => {
    const after = withWin(EMPTY_LADDER, 'normal', TRAINERS[0]!.id)
    const steps = ladderSteps(after, 'normal')
    expect(steps[0]?.beaten).toBe(true)
    expect(steps[1]?.locked).toBe(false)
    expect(steps[2]?.locked).toBe(true)
  })

  it('keeps each difficulty as its own run', () => {
    const after = withWin(EMPTY_LADDER, 'easy', TRAINERS[0]!.id)
    expect(ladderSteps(after, 'easy')[1]?.locked).toBe(false)
    expect(ladderSteps(after, 'hard')[1]?.locked).toBe(true)
  })

  it('does not count the same win twice', () => {
    const once = withWin(EMPTY_LADDER, 'hard', TRAINERS[0]!.id)
    const twice = withWin(once, 'hard', TRAINERS[0]!.id)
    expect(twice).toBe(once)
    expect(ladderProgress(twice, 'hard').beaten).toBe(1)
  })

  it('puts the trainer with the legendary ace last', () => {
    const last = TRAINERS[TRAINERS.length - 1]!
    expect(last.ace).toBe('rayquaza')
  })
})
