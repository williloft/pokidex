import { makeBattler, type Battler, type Difficulty } from './battle'
import { resolveForm, statTotal, type MoveIndex, type Pokemon } from './types'

export interface TrainerBlueprint {
  id: string
  name: string
  title: string
  blurb: string
  /** The type they build around, or null for a deliberately mixed team. */
  theme: string | null
}

/**
 * Our own trainers, not the ones from the games.
 *
 * Each is a theme plus a voice; the team behind them is drawn from the dex at
 * runtime, so they stay correct as the data grows.
 */
export const TRAINERS: TrainerBlueprint[] = [
  { id: 'tide', name: 'Noor', title: 'Tidewarden', blurb: 'Patient, and happy to let you tire yourself out.', theme: 'water' },
  { id: 'ember', name: 'Calla', title: 'Emberwright', blurb: 'Opens hot and expects the fight to be short.', theme: 'fire' },
  { id: 'thorn', name: 'Idris', title: 'Thornwarden', blurb: 'Grows into the match rather than starting ahead.', theme: 'grass' },
  { id: 'storm', name: 'Vey', title: 'Stormcaller', blurb: 'Fast, loud, and allergic to long games.', theme: 'electric' },
  { id: 'dune', name: 'Suri', title: 'Dunekeeper', blurb: 'Wears teams down from underneath.', theme: 'ground' },
  { id: 'iron', name: 'Bram', title: 'Ironsmith', blurb: 'Would rather not be hit at all, thank you.', theme: 'steel' },
  { id: 'dusk', name: 'Oleg', title: 'Duskwarden', blurb: 'Fond of matchups where you simply cannot answer.', theme: 'ghost' },
  { id: 'wyrm', name: 'Talon', title: 'Wyrmkeeper', blurb: 'Brings the heaviest things in the dex and swings them.', theme: 'dragon' },
  { id: 'charm', name: 'Lune', title: 'Charmweaver', blurb: 'Politely ruins anything with scales.', theme: 'fairy' },
  { id: 'fist', name: 'Kaito', title: 'Fistwright', blurb: 'Straight lines, hard hits, no tricks.', theme: 'fighting' },
  { id: 'night', name: 'Rhea', title: 'Nightwalker', blurb: 'Picks the fights you were not ready for.', theme: 'dark' },
  { id: 'wander', name: 'Juno', title: 'Wanderer', blurb: 'No theme at all — just six things that work.', theme: null },
]

/** Difficulty sets both how strong the roster is and how well it is played. */
const BST_BAND: Record<Difficulty, [number, number]> = {
  easy: [180, 430],
  normal: [380, 530],
  hard: [480, 800],
}

export interface Trainer {
  blueprint: TrainerBlueprint
  difficulty: Difficulty
  team: Battler[]
}

const TEAM_SIZE = 6

function candidatesFor(dex: readonly Pokemon[], theme: string | null, difficulty: Difficulty) {
  const [low, high] = BST_BAND[difficulty]

  const inBand = (entry: Pokemon) => {
    const total = statTotal(entry.stats)
    return total >= low && total <= high
  }

  const themed = theme ? dex.filter((entry) => entry.types.includes(theme)) : [...dex]
  const banded = themed.filter(inBand)

  // A narrow type in a narrow band can come up short; widening beats shipping
  // a trainer with three Pokémon.
  if (banded.length >= TEAM_SIZE) return banded
  if (themed.length >= TEAM_SIZE) return themed
  return dex.filter(inBand)
}

export function buildTrainer(
  blueprint: TrainerBlueprint,
  dex: readonly Pokemon[],
  difficulty: Difficulty,
  moves: MoveIndex = {},
  roll: () => number = Math.random,
): Trainer {
  const pool = candidatesFor(dex, blueprint.theme, difficulty)
  const picked: Pokemon[] = []
  const seen = new Set<number>()

  // Sample without replacement; give up rather than loop forever on a tiny pool.
  for (let attempt = 0; attempt < pool.length * 4 && picked.length < TEAM_SIZE; attempt++) {
    const candidate = pool[Math.floor(roll() * pool.length)]
    if (!candidate || seen.has(candidate.id)) continue
    seen.add(candidate.id)
    picked.push(candidate)
  }

  // Strongest last, so the trainer's best is the one you have to finish on.
  picked.sort((a, b) => statTotal(a.stats) - statTotal(b.stats))

  return {
    blueprint,
    difficulty,
    team: picked.map((entry, index) =>
      makeBattler(entry, resolveForm(entry, null), `foe-${entry.id}-${index}`, moves),
    ),
  }
}

export const pickBlueprint = (roll: () => number = Math.random): TrainerBlueprint =>
  TRAINERS[Math.floor(roll() * TRAINERS.length)]!
