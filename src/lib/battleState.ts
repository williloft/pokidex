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

/**
 * What just happened, for the screen to play back.
 *
 * A turn is decided all at once but should not arrive all at once: the state
 * machine emits one frame per beat, and the arena steps through them so you
 * see your hit land before theirs does.
 */
export interface Beat {
  kind: 'switch' | 'attack' | 'settle'
  /** Whose action this was. */
  side: 'player' | 'foe'
  move?: string
  damage?: number
  multiplier?: number
  missed?: boolean
  recoil?: number
  /** True when this beat knocked the target out. */
  fainted?: boolean
}

export interface BattleState {
  beat: Beat | null
  player: Battler[]
  foe: Battler[]
  trainer: Trainer
  playerActive: number
  foeActive: number
  log: string[]
  phase: Phase
  winner: 'player' | 'foe' | null
  turn: number
  /**
   * The turn the opponent last changed Pokémon, voluntarily or after a faint.
   *
   * The AI reads this so it commits to what it has out instead of answering
   * every move you make — without it, it mirrors your every switch and you can
   * never establish a matchup.
   */
  foeLastSwitch: number
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
    // Its lead counts as having just come in, so it does not open by retreating.
    foeLastSwitch: 1,
    beat: null,
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
    return say(
      { ...next, beat: { kind: 'attack', side, move: move.name, missed: true } },
      `${who} used ${moveName(move)}.`,
      'It missed.',
    )
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

  let fainted = false
  for (const [team, index] of [
    [side === 'player' ? next.foe : next.player, defenderIndex] as const,
    [side === 'player' ? next.player : next.foe, attackerIndex] as const,
  ]) {
    const member = team[index]
    if (member && isDown(member)) {
      fainted = true
      next = say(next, `${member.view.title} fainted.`)
    }
  }

  return {
    ...next,
    beat: {
      kind: 'attack',
      side,
      move: move.name,
      damage: result.damage,
      multiplier: result.multiplier,
      recoil: result.recoil,
      fainted,
    },
  }
}

/** After damage, work out whether anyone needs to send something in. */
function settle(state: BattleState): BattleState {
  const playerDown = isDown(active(state.player, state.playerActive))
  const foeDown = isDown(active(state.foe, state.foeActive))

  let next: BattleState = { ...state, beat: { kind: 'settle', side: 'player' } }

  if (foeDown) {
    const replacement = livingIndex(next.foe)
    if (replacement === -1) {
      return say({ ...next, phase: 'over', winner: 'player' }, 'You win.')
    }
    next = say(
      // A replacement has only just arrived, so it gets the same grace period
      // as one that was switched in on purpose.
      { ...next, foeActive: replacement, foeLastSwitch: next.turn + 1 },
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
 * One exchange, as a sequence of frames.
 *
 * The whole turn is decided here and now — who moves first, what lands, who
 * faints — but it is handed back one beat at a time so the arena can play it
 * out rather than snapping to the result. The last frame is the settled state.
 *
 * Switches happen before anything else and cost the side its attack, exactly
 * as they do in the games — that trade is the whole reason switching is a
 * decision rather than a free action.
 */
export function resolveTurn(
  state: BattleState,
  playerAction: PlayerAction,
  { chart, difficulty, roll = Math.random }: TurnOptions,
): BattleState[] {
  if (state.phase !== 'choosing') return [state]

  const foeAction = chooseOpponentAction(
    chart,
    active(state.foe, state.foeActive),
    state.foe,
    active(state.player, state.playerActive),
    difficulty,
    roll,
    state.turn - state.foeLastSwitch,
  )

  const frames: BattleState[] = []
  let next = state

  const swapPlayer = () => {
    if (playerAction.kind !== 'switch') return
    const incoming = next.player[playerAction.index]
    if (!incoming) return
    next = say(
      { ...next, playerActive: playerAction.index, beat: { kind: 'switch', side: 'player' } },
      `You send out ${incoming.view.title}.`,
    )
    frames.push(next)
  }

  const swapFoe = () => {
    if (foeAction.kind !== 'switch') return
    const index = next.foe.findIndex((member) => member.key === foeAction.to.key)
    if (index < 0) return
    next = say(
      { ...next, foeActive: index, foeLastSwitch: next.turn, beat: { kind: 'switch', side: 'foe' } },
      `${next.trainer.blueprint.name} switches to ${foeAction.to.view.title}.`,
    )
    frames.push(next)
  }

  if (playerAction.kind === 'switch') {
    const incoming = next.player[playerAction.index]
    if (!incoming || isDown(incoming) || playerAction.index === next.playerActive) return [state]
  }

  /*
   * Switches resolve before any attack, and among themselves by the speed of
   * whoever is leaving — as in the games. It only changes which sprite you see
   * step out first, but that is the order the games show.
   */
  if (playerAction.kind === 'switch' && foeAction.kind === 'switch') {
    const mine = active(next.player, next.playerActive)
    const theirs = active(next.foe, next.foeActive)
    if (firstMover(mine, theirs, null, null, roll) === 'a') {
      swapPlayer()
      swapFoe()
    } else {
      swapFoe()
      swapPlayer()
    }
  } else {
    swapPlayer()
    swapFoe()
  }

  const playerSlot = playerAction.kind === 'move' ? playerAction.index : null
  const foeSlot = foeAction.kind === 'move' ? foeAction.index : null

  const swing = (side: 'player' | 'foe', slot: number) => {
    const before = next
    next = strike(next, chart, side, slot, roll)
    // strike returns the state untouched when the attacker is already down;
    // that is not a beat, and playing it back would be a pause for nothing.
    if (next !== before) frames.push(next)
  }

  if (playerSlot !== null && foeSlot !== null) {
    const you = active(next.player, next.playerActive)
    const them = active(next.foe, next.foeActive)
    const first = firstMover(you, them, moveAt(you, playerSlot), moveAt(them, foeSlot), roll)

    if (first === 'a') {
      swing('player', playerSlot)
      swing('foe', foeSlot)
    } else {
      swing('foe', foeSlot)
      swing('player', playerSlot)
    }
  } else if (playerSlot !== null) {
    swing('player', playerSlot)
  } else if (foeSlot !== null) {
    swing('foe', foeSlot)
  }

  frames.push(settle(next))
  return frames
}

/** The settled state, for callers that do not want to watch it happen. */
export function takeTurn(
  state: BattleState,
  playerAction: PlayerAction,
  options: TurnOptions,
): BattleState {
  const frames = resolveTurn(state, playerAction, options)
  return frames[frames.length - 1]!
}

/** Sending in a replacement after a faint — free, and not a turn. */
export function sendIn(state: BattleState, index: number): BattleState {
  if (state.phase !== 'must-switch') return state
  const incoming = state.player[index]
  if (!incoming || isDown(incoming)) return state

  return say(
    {
      ...state,
      playerActive: index,
      phase: 'choosing',
      turn: state.turn + 1,
      beat: { kind: 'switch', side: 'player' },
    },
    `You send out ${incoming.view.title}.`,
  )
}
