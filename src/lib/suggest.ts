import { selectableViews, type FormView, type Pokemon, type TeamMember, type TypeChart } from './types'
import { effectiveness, teamCoverage, uncoveredThreats } from './typeChart'

export interface Suggestion {
  pokemon: Pokemon
  view: FormView
  score: number
  /** Uncovered threats this candidate resists. */
  covers: string[]
  /** Uncovered threats it takes no damage from at all. */
  immunities: string[]
  /** Types the team is already stacked against that it shares. */
  piles: string[]
}

/** A weakness shared by half the team or more is a liability, not a detail. */
const pileThreshold = (teamSize: number) => Math.max(2, Math.ceil(teamSize / 2))

/**
 * What the team is missing, answered with actual Pokémon.
 *
 * The heatmap already says which attacking types have a clear run at the team.
 * This walks the dex and scores every candidate on how many of those holes it
 * plugs — counting an immunity for more than a resistance — then docks points
 * for piling onto a weakness the team is already stacked against, because a
 * sixth Water-weak member is not an answer.
 */
export function suggestMembers(
  all: readonly Pokemon[],
  team: readonly TeamMember[],
  chart: TypeChart,
  allTypes: readonly string[],
  limit = 5,
): Suggestion[] {
  if (team.length === 0) return []

  const rows = teamCoverage(
    chart,
    allTypes,
    team.map((member) => ({ types: member.view.types })),
  )

  const threats = uncoveredThreats(rows).map((row) => row.type)
  const threshold = pileThreshold(team.length)
  const piled = rows.filter((row) => row.weakCount >= threshold).map((row) => row.type)

  if (threats.length === 0 && piled.length === 0) return []

  const onTeam = new Set(team.map((member) => member.pokemon.id))
  const best = new Map<number, Suggestion>()

  for (const pokemon of all) {
    if (onTeam.has(pokemon.id)) continue

    for (const view of selectableViews(pokemon)) {
      const covers: string[] = []
      const immunities: string[] = []

      for (const threat of threats) {
        const multiplier = effectiveness(chart, threat, view.types)
        if (multiplier === 0) immunities.push(threat)
        else if (multiplier < 1) covers.push(threat)
      }

      const shared = piled.filter((type) => effectiveness(chart, type, view.types) > 1)
      const score = covers.length + immunities.length * 1.5 - shared.length * 0.75

      if (score <= 0) continue

      const existing = best.get(pokemon.id)
      if (!existing || score > existing.score) {
        best.set(pokemon.id, { pokemon, view, score, covers, immunities, piles: shared })
      }
    }
  }

  const ranked = [...best.values()].sort(
    (a, b) => b.score - a.score || a.pokemon.id - b.pokemon.id,
  )

  // Five answers that are all the same typing is one answer repeated, with the
  // same reason printed five times. Keep the best of each type combination and
  // let the list run short — if only two typings answer the hole, saying so is
  // more useful than padding it out with near-copies.
  const picked: Suggestion[] = []
  const seen = new Set<string>()

  for (const suggestion of ranked) {
    if (picked.length >= limit) break
    const signature = [...suggestion.view.types].sort().join('/')
    if (seen.has(signature)) continue
    seen.add(signature)
    picked.push(suggestion)
  }

  return picked
}

export interface TeamNotice {
  kind: 'mega' | 'gmax'
  count: number
  names: string[]
}

/**
 * A trainer may only Mega Evolve once per battle, and only Dynamax once — the
 * limit is on the battle, not the roster. So carrying two is legal, and worth
 * pointing out rather than blocking.
 */
export function teamNotices(team: readonly TeamMember[]): TeamNotice[] {
  const notices: TeamNotice[] = []

  for (const kind of ['mega', 'gmax'] as const) {
    const matching = team.filter((member) => member.view.category === kind)
    if (matching.length > 1) {
      notices.push({
        kind,
        count: matching.length,
        names: matching.map((member) => member.view.title),
      })
    }
  }

  return notices
}
