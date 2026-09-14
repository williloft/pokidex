import type { TypeChart } from './types'

/**
 * How hard `attacker` hits a Pokémon whose typing is `defenderTypes`.
 *
 * Dual types multiply, which is why a Levitate-less Ground move lands 4x on a
 * Rock/Ground Pokémon and 0x on anything Flying.
 */
export function effectiveness(
  chart: TypeChart,
  attacker: string,
  defenderTypes: readonly string[],
): number {
  const row = chart[attacker]
  if (!row) return 1
  return defenderTypes.reduce((total, defender) => total * (row[defender] ?? 1), 1)
}

export interface DefensiveProfile {
  /** Attacking types this Pokémon takes extra damage from, worst first. */
  weaknesses: Array<{ type: string; multiplier: number }>
  /** Attacking types it resists, strongest resistance first. */
  resistances: Array<{ type: string; multiplier: number }>
  /** Attacking types it takes no damage from at all. */
  immunities: string[]
}

/** Everything the detail page needs to say "what beats this thing". */
export function defensiveProfile(
  chart: TypeChart,
  allTypes: readonly string[],
  defenderTypes: readonly string[],
): DefensiveProfile {
  const profile: DefensiveProfile = { weaknesses: [], resistances: [], immunities: [] }

  for (const attacker of allTypes) {
    const multiplier = effectiveness(chart, attacker, defenderTypes)
    if (multiplier === 0) profile.immunities.push(attacker)
    else if (multiplier > 1) profile.weaknesses.push({ type: attacker, multiplier })
    else if (multiplier < 1) profile.resistances.push({ type: attacker, multiplier })
  }

  profile.weaknesses.sort((a, b) => b.multiplier - a.multiplier || a.type.localeCompare(b.type))
  profile.resistances.sort((a, b) => a.multiplier - b.multiplier || a.type.localeCompare(b.type))
  profile.immunities.sort()

  return profile
}

export interface CoverageRow {
  type: string
  /** Multiplier per team member, in team order. */
  multipliers: number[]
  weakCount: number
  resistCount: number
  immuneCount: number
}

/**
 * The team-builder heatmap.
 *
 * A row per attacking type, a column per team member. The rows that matter are
 * the ones where nothing on the team resists — that is the hole in the team.
 */
export function teamCoverage(
  chart: TypeChart,
  allTypes: readonly string[],
  team: ReadonlyArray<{ types: string[] }>,
): CoverageRow[] {
  return allTypes.map((type) => {
    const multipliers = team.map((member) => effectiveness(chart, type, member.types))
    return {
      type,
      multipliers,
      weakCount: multipliers.filter((m) => m > 1).length,
      resistCount: multipliers.filter((m) => m < 1 && m > 0).length,
      immuneCount: multipliers.filter((m) => m === 0).length,
    }
  })
}

/** Attacking types that hurt the team and that nobody on it shrugs off. */
export function uncoveredThreats(rows: readonly CoverageRow[]): CoverageRow[] {
  return rows
    .filter((row) => row.weakCount > 0 && row.resistCount === 0 && row.immuneCount === 0)
    .sort((a, b) => b.weakCount - a.weakCount || a.type.localeCompare(b.type))
}

/** "2x", "0.25x", "0x" — short enough for a heatmap cell. */
export function formatMultiplier(multiplier: number): string {
  if (multiplier === 0) return '0'
  if (Number.isInteger(multiplier)) return `${multiplier}`
  return `${multiplier}`.replace(/0\./, '.')
}
