import type { TeamMember, TypeChart } from './types'
import { effectiveness } from './typeChart'

export type Verdict = 'wall' | 'good' | 'even' | 'risky' | 'danger'

export interface MemberMatchup {
  member: TeamMember
  /** Worst multiplier any of the opponent's types lands on this member. */
  incoming: number
  /** Best multiplier any of this member's types lands on the opponent. */
  outgoing: number
  verdict: Verdict
}

/**
 * Type-only matchups.
 *
 * Without move data this reasons from typing alone: a Pokémon is assumed to
 * carry something of its own type, which is usually true and is what people
 * mean by "who beats what". It cannot know about coverage moves, items or
 * abilities, so the page says as much rather than pretending to be a battle
 * simulator.
 */
function worstIncoming(chart: TypeChart, attackerTypes: readonly string[], defenderTypes: readonly string[]) {
  return attackerTypes.reduce(
    (worst, type) => Math.max(worst, effectiveness(chart, type, defenderTypes)),
    0,
  )
}

function verdictFor(incoming: number, outgoing: number): Verdict {
  if (incoming === 0) return 'wall'
  if (outgoing > 1 && incoming < 1) return 'good'
  if (incoming >= 2 && outgoing <= 1) return 'danger'
  if (incoming > 1) return 'risky'
  if (outgoing > 1) return 'good'
  return 'even'
}

export function analyseMatchup(
  chart: TypeChart,
  team: readonly TeamMember[],
  opponentTypes: readonly string[],
): MemberMatchup[] {
  return team.map((member) => {
    const incoming = worstIncoming(chart, opponentTypes, member.view.types)
    const outgoing = worstIncoming(chart, member.view.types, opponentTypes)
    return { member, incoming, outgoing, verdict: verdictFor(incoming, outgoing) }
  })
}

const VERDICT_RANK: Record<Verdict, number> = {
  wall: 0,
  good: 1,
  even: 2,
  risky: 3,
  danger: 4,
}

/**
 * Who to send in. Ranked by verdict first, then by how lopsided the trade is,
 * and finally by speed — the tiebreak that decides who acts first.
 */
export function bestLead(matchups: readonly MemberMatchup[]): MemberMatchup | null {
  if (matchups.length === 0) return null

  return [...matchups].sort((a, b) => {
    const byVerdict = VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict]
    if (byVerdict !== 0) return byVerdict

    const trade = b.outgoing / Math.max(b.incoming, 0.0625) - a.outgoing / Math.max(a.incoming, 0.0625)
    if (trade !== 0) return trade

    return b.member.view.stats.speed - a.member.view.stats.speed
  })[0]!
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  wall: 'Takes nothing',
  good: 'Favourable',
  even: 'Even',
  risky: 'Risky',
  danger: 'Outmatched',
}
