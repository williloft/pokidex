import { makeBattler, type Battler, type Difficulty } from './battle'
import {
  isRare,
  resolveForm,
  selectableViews,
  statTotal,
  type FormView,
  type MoveIndex,
  type Pokemon,
} from './types'

export interface TrainerBlueprint {
  id: string
  name: string
  title: string
  blurb: string
  /** The type they build around, or null for a deliberately mixed team. */
  theme: string | null
  /**
   * Their six, by species name, written at the stage they field on Normal.
   *
   * Lower difficulties walk back down the evolution line from here and higher
   * ones add forms, so one list covers every tier: Mr Fire brings Charmeleon
   * on Easy, Charizard on Normal, and Mega Charizard on Hard.
   */
  team: string[]
  /**
   * A legendary they only bring out where the tier allows one. It replaces the
   * last of their six rather than making the team seven.
   */
  ace?: string
}

/**
 * Our own trainers, not the ones from the games.
 *
 * Fixed rosters rather than a random draw: a trainer you cannot learn to beat
 * is not really a trainer, and a team that is different every time gives you
 * nothing to plan against.
 */
export const TRAINERS: TrainerBlueprint[] = [
  {
    id: 'tide',
    name: 'Noor',
    title: 'Tidewarden',
    blurb: 'Patient, and happy to let you tire yourself out.',
    theme: 'water',
    team: ['blastoise', 'lapras', 'starmie', 'vaporeon', 'milotic', 'gyarados'],
  },
  {
    id: 'ember',
    name: 'Calla',
    title: 'Emberwright',
    blurb: 'Opens hot and expects the fight to be short.',
    theme: 'fire',
    team: ['ninetales', 'flareon', 'rapidash', 'typhlosion', 'arcanine', 'charizard'],
  },
  {
    id: 'thorn',
    name: 'Idris',
    title: 'Thornwarden',
    blurb: 'Grows into the match rather than starting ahead.',
    theme: 'grass',
    team: ['vileplume', 'victreebel', 'leafeon', 'torterra', 'sceptile', 'venusaur'],
  },
  {
    id: 'storm',
    name: 'Vey',
    title: 'Stormcaller',
    blurb: 'Fast, loud, and allergic to long games.',
    theme: 'electric',
    team: ['raichu', 'jolteon', 'ampharos', 'luxray', 'magnezone', 'electivire'],
  },
  {
    id: 'dune',
    name: 'Suri',
    title: 'Dunekeeper',
    blurb: 'Wears teams down from underneath.',
    theme: 'ground',
    team: ['sandslash', 'donphan', 'golem', 'rhydon', 'flygon', 'garchomp'],
  },
  {
    id: 'iron',
    name: 'Bram',
    title: 'Ironsmith',
    blurb: 'Would rather not be hit at all, thank you.',
    theme: 'steel',
    team: ['bastiodon', 'aggron', 'steelix', 'scizor', 'lucario', 'metagross'],
  },
  {
    id: 'dusk',
    name: 'Oleg',
    title: 'Duskwarden',
    blurb: 'Fond of matchups where you simply cannot answer.',
    theme: 'ghost',
    team: ['banette', 'mismagius', 'drifblim', 'dusknoir', 'chandelure', 'gengar'],
  },
  {
    id: 'charm',
    name: 'Lune',
    title: 'Charmweaver',
    blurb: 'Politely ruins anything with scales.',
    theme: 'fairy',
    team: ['granbull', 'whimsicott', 'clefable', 'sylveon', 'togekiss', 'gardevoir'],
  },
  {
    id: 'fist',
    name: 'Kaito',
    title: 'Fistwright',
    blurb: 'Straight lines, hard hits, no tricks.',
    theme: 'fighting',
    team: ['hitmonlee', 'hitmonchan', 'primeape', 'hariyama', 'conkeldurr', 'machamp'],
  },
  {
    id: 'night',
    name: 'Rhea',
    title: 'Nightwalker',
    blurb: 'Picks the fights you were not ready for.',
    theme: 'dark',
    team: ['umbreon', 'absol', 'houndoom', 'weavile', 'krookodile', 'hydreigon'],
  },
  {
    id: 'wander',
    name: 'Juno',
    title: 'Wanderer',
    blurb: 'No theme at all — just six things that work.',
    theme: null,
    team: ['kangaskhan', 'tauros', 'pidgeot', 'ursaring', 'porygon-z', 'snorlax'],
  },
  {
    id: 'trail',
    name: 'Rin',
    title: 'Trailblazer',
    blurb: 'Leads with a Pikachu that has no business being this hard to put down.',
    theme: null,
    team: ['pikachu', 'infernape', 'snorlax', 'greninja', 'gengar', 'lucario'],
  },
  {
    id: 'wyrm',
    name: 'Talon',
    title: 'Wyrmkeeper',
    blurb: 'Brings the heaviest things in the dex and swings them.',
    theme: 'dragon',
    team: ['altaria', 'flygon', 'haxorus', 'salamence', 'garchomp', 'dragonite'],
    ace: 'rayquaza',
  },
]

/**
 * What a difficulty is allowed to field.
 *
 * The same six lines at every tier — what changes is how far evolved they are,
 * whether alternate forms are on the table, and whether a legendary shows up.
 */
export interface Tier {
  /** Stages to walk back down each line. 1 means one below the signature pick. */
  stageBack: number
  /** Whether Megas, Gigantamax and regional forms may be fielded at all. */
  forms: boolean
  /** How many legendary or mythical members are allowed. */
  rares: number
}

export const TIERS: Record<Difficulty, Tier> = {
  easy: { stageBack: 1, forms: false, rares: 0 },
  normal: { stageBack: 0, forms: true, rares: 0 },
  hard: { stageBack: 0, forms: true, rares: 2 },
}

export const TIER_RULES: Record<Difficulty, string> = {
  easy: 'Unevolved, base forms only — no Megas, Gigantamax or regional forms on either side.',
  normal: 'Fully evolved, and alternate forms are on the table for both of you.',
  hard: 'Fully evolved, forms allowed, and the trainer brings a legendary.',
}

export interface Trainer {
  blueprint: TrainerBlueprint
  difficulty: Difficulty
  team: Battler[]
}

const TEAM_SIZE = 6

/** One Mega and one Gigantamax per side, as the team page already warns. */
const MEGA_LIMIT = 1
const GMAX_LIMIT = 1

/**
 * Walk a Pokémon back down its own evolution line.
 *
 * `line` runs base-first and ends with the Pokémon itself, so stepping back
 * from Charizard lands on Charmeleon, and something with no evolutions simply
 * stays as it is.
 */
export function atStage(
  entry: Pokemon,
  stageBack: number,
  byId: ReadonlyMap<number, Pokemon>,
): Pokemon {
  if (stageBack <= 0) return entry
  const line = entry.line ?? [entry.id]
  const index = line.indexOf(entry.id)
  if (index < 0) return entry
  return byId.get(line[Math.max(0, index - stageBack)] ?? entry.id) ?? entry
}

/**
 * Which variant of a Pokémon gets fielded.
 *
 * Megas first where the tier and the per-team limit allow one, then
 * Gigantamax, and otherwise whatever it looks like normally. The limits are
 * carried in a counter so a trainer cannot field six Megas.
 */
export function viewForTier(
  entry: Pokemon,
  tier: Tier,
  budget: { megas: number; gmax: number },
): FormView {
  const base = resolveForm(entry, null)
  if (!tier.forms) return base

  const views = selectableViews(entry)

  const mega = views.find((view) => view.category === 'mega')
  if (mega && budget.megas > 0) {
    budget.megas -= 1
    return mega
  }

  const gmax = views.find((view) => view.category === 'gmax')
  if (gmax && budget.gmax > 0) {
    budget.gmax -= 1
    return gmax
  }

  /*
   * Failing those, a special form of its own.
   *
   * `selectableViews` has already dropped the costume forms, so what is left
   * under 'other' is a variant that genuinely changes typing or stats. There
   * is no per-team limit on these — one Pokémon can only be in one of them.
   *
   * Regional forms are deliberately excluded: a trainer's roster names a
   * species, and quietly handing them the Alolan one would make the team you
   * scouted on the card different from the team that walks out.
   */
  const special = views.find((view) => view.category === 'other')
  return special ?? base
}

/**
 * Fill out a roster when a signature name is missing from the dataset.
 *
 * Names are resolved against whatever dex is loaded, so a sample or partial
 * dataset should still produce a full six rather than a trainer with three.
 */
/** A small stable hash, so a trainer's fallback picks never move about. */
function hashOf(text: string): number {
  let hash = 0
  for (let index = 0; index < text.length; index++) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }
  return hash
}

/**
 * Fill out a roster when a signature name is missing from the dataset.
 *
 * Deterministic on purpose: the ladder shows you each trainer's six before you
 * pick a fight, and a random fallback would mean the team on the card was not
 * the team that walked out. Spread by a hash of the trainer's id so two of
 * them falling back do not land on the same Pokémon.
 */
function fillFrom(
  dex: readonly Pokemon[],
  blueprint: TrainerBlueprint,
  taken: Set<number>,
  tier: Tier,
  need: number,
): Pokemon[] {
  if (need <= 0) return []

  const eligible = (entry: Pokemon) => !taken.has(entry.id) && (tier.rares > 0 || !isRare(entry))
  const themed = blueprint.theme
    ? dex.filter((entry) => entry.types.includes(blueprint.theme!) && eligible(entry))
    : dex.filter(eligible)
  const pool = (themed.length >= need ? themed : dex.filter(eligible)).slice().sort(
    (a, b) => statTotal(a.stats) - statTotal(b.stats) || a.id - b.id,
  )
  if (pool.length === 0) return []

  const picked: Pokemon[] = []
  const stride = Math.max(1, Math.floor(pool.length / need))
  const offset = hashOf(blueprint.id) % pool.length

  for (let step = 0; step < pool.length && picked.length < need; step++) {
    const candidate = pool[(offset + step * stride) % pool.length]
    if (!candidate || taken.has(candidate.id)) continue
    taken.add(candidate.id)
    picked.push(candidate)
  }

  // A short stride can revisit the same slots; sweep for anything still free.
  for (const candidate of pool) {
    if (picked.length >= need) break
    if (taken.has(candidate.id)) continue
    taken.add(candidate.id)
    picked.push(candidate)
  }

  return picked
}

export interface RosterMember {
  entry: Pokemon
  view: FormView
}

/**
 * The six a trainer fields at this difficulty, in battle order.
 *
 * Split out from buildTrainer so the ladder can show the same roster it is
 * about to send at you — scouting an opponent is only worth anything if what
 * you scouted is what turns up.
 */
export function rosterFor(
  blueprint: TrainerBlueprint,
  dex: readonly Pokemon[],
  difficulty: Difficulty,
): RosterMember[] {
  const tier = TIERS[difficulty]
  const byName = new Map(dex.map((entry) => [entry.name, entry]))
  const byId = new Map(dex.map((entry) => [entry.id, entry]))

  const names = [...blueprint.team]
  // The ace takes the last slot where the tier allows a legendary at all.
  if (blueprint.ace && tier.rares > 0) names[names.length - 1] = blueprint.ace

  const taken = new Set<number>()
  const roster: Pokemon[] = []

  for (const name of names) {
    const entry = byName.get(name)
    if (!entry || taken.has(entry.id)) continue
    // A legendary the tier has no room for is simply left at home.
    if (isRare(entry) && tier.rares <= 0) continue
    taken.add(entry.id)
    roster.push(entry)
  }

  roster.push(...fillFrom(dex, blueprint, taken, tier, TEAM_SIZE - roster.length))

  const staged = roster.map((entry) => atStage(entry, tier.stageBack, byId))

  // Strongest last, so the trainer's best is the one you have to finish on.
  staged.sort((a, b) => statTotal(a.stats) - statTotal(b.stats))

  /*
   * Hand out the forms before settling the running order.
   *
   * There is only one Mega to go round, and it belongs to the ace: assigning
   * in battle order gave it to whichever mid-tier member happened to come
   * first, so the legendary the whole tier is built around walked out in its
   * plain form. The ace gets first refusal, then the heaviest hitters.
   */
  const budget = { megas: MEGA_LIMIT, gmax: GMAX_LIMIT }
  const aceId = blueprint.ace ? byName.get(blueprint.ace)?.id : undefined

  const claimOrder = [...staged].sort((a, b) => {
    if (a.id === aceId) return -1
    if (b.id === aceId) return 1
    return statTotal(b.stats) - statTotal(a.stats)
  })

  const views = new Map<number, FormView>()
  for (const entry of claimOrder) views.set(entry.id, viewForTier(entry, tier, budget))

  return staged.map((entry) => ({
    entry,
    view: views.get(entry.id) ?? resolveForm(entry, null),
  }))
}

export function buildTrainer(
  blueprint: TrainerBlueprint,
  dex: readonly Pokemon[],
  difficulty: Difficulty,
  moves: MoveIndex = {},
): Trainer {
  return {
    blueprint,
    difficulty,
    team: rosterFor(blueprint, dex, difficulty).map(({ entry, view }, index) =>
      makeBattler(entry, view, `foe-${entry.id}-${index}`, moves),
    ),
  }
}

export interface FieldedMember {
  view: FormView
  /** Set when the tier changed what this member fights as. */
  note: string | null
}

/**
 * Put your own six on the field under the tier's rules.
 *
 * Easy flattens every alternate form to the base one, and the one-Mega,
 * one-Gigantamax limit applies to you exactly as it does to the trainer. Your
 * saved team is never touched — this only decides what walks out for this
 * battle, and each change is reported so nothing happens behind your back.
 */
export function fieldTeam(
  members: readonly { pokemon: Pokemon; view: FormView }[],
  tier: Tier,
): FieldedMember[] {
  const budget = { megas: MEGA_LIMIT, gmax: GMAX_LIMIT }

  return members.map(({ pokemon, view }) => {
    const base = resolveForm(pokemon, null)
    if (view.category === 'default') return { view, note: null }

    /*
     * Regional forms are never touched.
     *
     * An Alolan Raichu is not a transformation spent during a battle — it is
     * simply what that Pokémon is, the way a Charizard is a Charizard. The
     * tiers gate Megas and Gigantamax because those are things you do once per
     * battle; there is nothing to gate here.
     */
    if (view.category === 'regional') return { view, note: null }

    if (!tier.forms) {
      return { view: base, note: `${view.title} fights as ${base.title}` }
    }

    if (view.category === 'mega') {
      if (budget.megas > 0) {
        budget.megas -= 1
        return { view, note: null }
      }
      return { view: base, note: `${view.title} fights as ${base.title} — one Mega per battle` }
    }

    if (view.category === 'gmax') {
      if (budget.gmax > 0) {
        budget.gmax -= 1
        return { view, note: null }
      }
      return { view: base, note: `${view.title} fights as ${base.title} — one Gigantamax per battle` }
    }

    // Regional and other forms are just what that Pokémon is; nothing to cap.
    return { view, note: null }
  })
}

export const pickBlueprint = (roll: () => number = Math.random): TrainerBlueprint =>
  TRAINERS[Math.floor(roll() * TRAINERS.length)]!
