import {
  chooseOpponentAction,
  computeDamage,
  firstMover,
  isDown,
  moveAt,
  STRUGGLE,
  willHit,
  type Battler,
  type Difficulty,
} from './battle'
import type { Trainer } from './trainers'
import type { Move, TypeChart } from './types'

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

export type PlayerAction = { kind: 'move'; index: number } | { kind: 'switch'; index: number }

const MAX_LOG = 40

const active = (team: readonly Battler[], index: number) => team[index]!
const livingIndex = (team: readonly Battler[]) => team.findIndex((member) => !isDown(member))

const say = (state: BattleState, ...lines: string[]): BattleState => ({
  ...state,
  log: [...lines, ...state.log].slice(0, MAX_LOG),
})

const moveName = (move: Move): string =>
  move.name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

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

/** Apply damage to one member of a team and return the updated team. */
function damaged(team: readonly Battler[], index: number, amount: number): Battler[] {
  if (amount <= 0) return [...team]
  return team.map((member, position) =>
    position === index ? { ...member, hp: Math.max(0, member.hp - amount) } : member,
  )
}

/** Spend one PP from a slot. An index outside the list is Struggle, which has none. */
function spendPp(team: readonly Battler[], index: number, slot: number): Battler[] {
  return team.map((member, position) => {
    if (position !== index || !member.moves[slot]) return member
    return {
      ...member,
      moves: member.moves.map((entry, position2) =>
        position2 === slot ? { ...entry, pp: Math.max(0, entry.pp - 1) } : entry,
      ),
    }
  })
}

const effectivenessNote = (multiplier: number): string | null => {
  if (multiplier === 0) return 'It had no effect.'
  if (multiplier >= 2) return "It's super effective."
  if (multiplier < 1) return "It's not very effective."
  return null
}

/**
 * One Pokémon using one move.
 *
 * PP is spent whether or not the move connects — a miss still costs you the
 * attempt — and Struggle's recoil comes straight back off the attacker, which
 * is what stops a Pokémon out of PP from grinding on forever.
 */
function strike(
  state: BattleState,
  chart: TypeChart,
  side: 'player' | 'foe',
  slot: number,
  roll: () => number,
): BattleState {
  const attackerTeam = side === 'player' ? state.player : state.foe
  const defenderTeam = side === 'player' ? state.foe : state.player
  const attackerIndex = side === 'player' ? state.playerActive : state.foeActive
  const defenderIndex = side === 'player' ? state.foeActive : state.playerActive

  const attacker = active(attackerTeam, attackerIndex)
  const defender = active(defenderTeam, defenderIndex)
  if (isDown(attacker) || isDown(defender)) return state

  const usingStruggle = slot < 0 || !attacker.moves[slot] || attacker.moves[slot].pp <= 0
  const move = usingStruggle ? STRUGGLE : moveAt(attacker, slot)

  const spentTeam = usingStruggle ? [...attackerTeam] : spendPp(attackerTeam, attackerIndex, slot)
  const who = attacker.view.title

  let next: BattleState = {
    ...state,
    player: side === 'player' ? spentTeam : state.player,
    foe: side === 'player' ? state.foe : spentTeam,
  }

  if (!willHit(move, roll)) {
    return say(next, `${who} used ${moveName(move)}.`, 'It missed.')
  }

  const result = computeDamage(chart, attacker, defender, move, roll)

  const hitTeam = damaged(
    side === 'player' ? next.foe : next.player,
    defenderIndex,
    result.damage,
  )
  next = {
    ...next,
    player: side === 'player' ? next.player : hitTeam,
    foe: side === 'player' ? hitTeam : next.foe,
  }

  const note = effectivenessNote(result.multiplier)
  next = say(
    next,
    result.multiplier === 0
      ? `${who} used ${moveName(move)}.`
      : `${who} used ${moveName(move)} for ${result.damage}.`,
  )
  if (note) next = say(next, note)

  if (result.recoil > 0) {
    const recoiled = damaged(
      side === 'player' ? next.player : next.foe,
      attackerIndex,
      result.recoil,
    )
    next = {
      ...next,
      player: side === 'player' ? recoiled : next.player,
      foe: side === 'player' ? next.foe : recoiled,
    }
    next = say(next, `${who} was hurt by recoil.`)
  }

  for (const [team, index] of [
    [side === 'player' ? next.foe : next.player, defenderIndex] as const,
    [side === 'player' ? next.player : next.foe, attackerIndex] as const,
  ]) {
    const member = team[index]
    if (member && isDown(member)) next = say(next, `${member.view.title} fainted.`)
  }

  return next
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
  playerAction: PlayerAction,
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

  const playerSlot = playerAction.kind === 'move' ? playerAction.index : null
  const foeSlot = foeAction.kind === 'move' ? foeAction.index : null

  if (playerSlot !== null && foeSlot !== null) {
    const you = active(next.player, next.playerActive)
    const them = active(next.foe, next.foeActive)
    const first = firstMover(you, them, moveAt(you, playerSlot), moveAt(them, foeSlot), roll)

    if (first === 'a') {
      next = strike(next, chart, 'player', playerSlot, roll)
      next = strike(next, chart, 'foe', foeSlot, roll)
    } else {
      next = strike(next, chart, 'foe', foeSlot, roll)
      next = strike(next, chart, 'player', playerSlot, roll)
    }
  } else if (playerSlot !== null) {
    next = strike(next, chart, 'player', playerSlot, roll)
  } else if (foeSlot !== null) {
    next = strike(next, chart, 'foe', foeSlot, roll)
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
