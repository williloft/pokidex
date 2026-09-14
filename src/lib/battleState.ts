import {
  chooseOpponentAction,
  computeDamage,
  firstMover,
  isDown,
  type Battler,
  type Difficulty,
} from './battle'
import type { Trainer } from './trainers'
import type { TypeChart } from './types'

export type Phase = 'choosing' | 'must-switch' | 'over'

export interface BattleState {
  player: Battler[]
  foe: Battler[]
  trainer: Trainer
  playerActive: number
  foeActive: number
  log: string[]
  phase: Phase
  winner: 'player' | 'foe' | null
  turn: number
}

const MAX_LOG = 40

const active = (team: readonly Battler[], index: number) => team[index]!
const livingIndex = (team: readonly Battler[]) => team.findIndex((member) => !isDown(member))

const say = (state: BattleState, ...lines: string[]): BattleState => ({
  ...state,
  log: [...lines, ...state.log].slice(0, MAX_LOG),
})

export function startBattle(player: Battler[], trainer: Trainer): BattleState {
  return {
    player,
    foe: trainer.team,
    trainer,
    playerActive: 0,
    foeActive: 0,
    log: [
      `${trainer.blueprint.title} ${trainer.blueprint.name} sends out ${trainer.team[0]?.view.title ?? '—'}.`,
      `${trainer.blueprint.title} ${trainer.blueprint.name} wants to battle.`,
    ],
    phase: 'choosing',
    winner: null,
    turn: 1,
  }
}

/** Apply damage to one side and return the updated team. */
function damaged(team: readonly Battler[], index: number, amount: number): Battler[] {
  return team.map((member, position) =>
    position === index ? { ...member, hp: Math.max(0, member.hp - amount) } : member,
  )
}

const effectivenessNote = (multiplier: number): string | null => {
  if (multiplier === 0) return 'It had no effect.'
  if (multiplier >= 2) return "It's super effective."
  if (multiplier < 1) return "It's not very effective."
  return null
}

interface Strike {
  side: 'player' | 'foe'
}

function strike(state: BattleState, chart: TypeChart, side: Strike['side'], roll: () => number) {
  const attackerTeam = side === 'player' ? state.player : state.foe
  const defenderTeam = side === 'player' ? state.foe : state.player
  const attackerIndex = side === 'player' ? state.playerActive : state.foeActive
  const defenderIndex = side === 'player' ? state.foeActive : state.playerActive

  const attacker = active(attackerTeam, attackerIndex)
  const defender = active(defenderTeam, defenderIndex)
  if (isDown(attacker) || isDown(defender)) return state

  const result = computeDamage(chart, attacker, defender, roll)
  const updated = damaged(defenderTeam, defenderIndex, result.damage)
  const note = effectivenessNote(result.multiplier)

  let next: BattleState = {
    ...state,
    player: side === 'player' ? state.player : updated,
    foe: side === 'player' ? updated : state.foe,
  }

  next = say(
    next,
    ...[
      `${attacker.view.title} attacks with a ${result.type} move for ${result.damage}.`,
      note,
    ].filter((line): line is string => line !== null),
  )

  const hit = (side === 'player' ? next.foe : next.player)[defenderIndex]!
  return isDown(hit) ? say(next, `${hit.view.title} fainted.`) : next
}

/** After damage, work out whether anyone needs to send something in. */
function settle(state: BattleState): BattleState {
  const playerDown = isDown(active(state.player, state.playerActive))
  const foeDown = isDown(active(state.foe, state.foeActive))

  let next = state

  if (foeDown) {
    const replacement = livingIndex(next.foe)
    if (replacement === -1) {
      return say({ ...next, phase: 'over', winner: 'player' }, 'You win.')
    }
    next = say(
      { ...next, foeActive: replacement },
      `${next.trainer.blueprint.name} sends out ${next.foe[replacement]!.view.title}.`,
    )
  }

  if (playerDown) {
    if (livingIndex(next.player) === -1) {
      return say({ ...next, phase: 'over', winner: 'foe' }, 'You are out of Pokémon.')
    }
    return { ...next, phase: 'must-switch' }
  }

  return { ...next, phase: 'choosing', turn: next.turn + 1 }
}

interface TurnOptions {
  chart: TypeChart
  difficulty: Difficulty
  roll?: () => number
}

/**
 * One exchange.
 *
 * Switches happen before anything else and cost the side its attack, exactly
 * as they do in the games — that trade is the whole reason switching is a
 * decision rather than a free action.
 */
export function takeTurn(
  state: BattleState,
  playerAction: { kind: 'attack' } | { kind: 'switch'; index: number },
  { chart, difficulty, roll = Math.random }: TurnOptions,
): BattleState {
  if (state.phase !== 'choosing') return state

  const foeAction = chooseOpponentAction(
    chart,
    active(state.foe, state.foeActive),
    state.foe,
    active(state.player, state.playerActive),
    difficulty,
    roll,
  )

  let next = state

  if (playerAction.kind === 'switch') {
    const incoming = next.player[playerAction.index]
    if (!incoming || isDown(incoming) || playerAction.index === next.playerActive) return state
    next = say({ ...next, playerActive: playerAction.index }, `You send out ${incoming.view.title}.`)
  }

  if (foeAction.kind === 'switch') {
    const index = next.foe.findIndex((member) => member.key === foeAction.to.key)
    if (index >= 0) {
      next = say(
        { ...next, foeActive: index },
        `${next.trainer.blueprint.name} switches to ${foeAction.to.view.title}.`,
      )
    }
  }

  const playerAttacks = playerAction.kind === 'attack'
  const foeAttacks = foeAction.kind === 'attack'

  if (playerAttacks && foeAttacks) {
    const first = firstMover(
      active(next.player, next.playerActive),
      active(next.foe, next.foeActive),
      roll,
    )
    next = strike(next, chart, first === 'a' ? 'player' : 'foe', roll)
    next = strike(next, chart, first === 'a' ? 'foe' : 'player', roll)
  } else if (playerAttacks) {
    next = strike(next, chart, 'player', roll)
  } else if (foeAttacks) {
    next = strike(next, chart, 'foe', roll)
  }

  return settle(next)
}

/** Sending in a replacement after a faint — free, and not a turn. */
export function sendIn(state: BattleState, index: number): BattleState {
  if (state.phase !== 'must-switch') return state
  const incoming = state.player[index]
  if (!incoming || isDown(incoming)) return state

  return say(
    { ...state, playerActive: index, phase: 'choosing', turn: state.turn + 1 },
    `You send out ${incoming.view.title}.`,
  )
}
