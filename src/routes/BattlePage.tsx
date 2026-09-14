import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDex } from '../App'
import { Sprite } from '../components/Sprite'
import { TypeBadge } from '../components/TypeBadge'
import { isDown, makeBattler, STRUGGLE, usableMoves, type Difficulty } from '../lib/battle'
import {
  resolveTurn,
  sendIn,
  startBattle,
  type BattleState,
  type Beat,
  type PlayerAction,
} from '../lib/battleState'
import { dexHref } from '../lib/dexLocation'
import { buildTrainer, pickBlueprint, TRAINERS, type TrainerBlueprint } from '../lib/trainers'
import type { TeamMember } from '../lib/types'
import { useDocumentTitle } from '../lib/useScrollRestoration'

interface Props {
  team: TeamMember[]
  shiny: boolean
}

const DIFFICULTIES: Array<{ value: Difficulty; label: string; hint: string }> = [
  { value: 'easy', label: 'Easy', hint: 'Weaker roster, never switches' },
  { value: 'normal', label: 'Normal', hint: 'Retreats when it is being walled' },
  { value: 'hard', label: 'Hard', hint: 'Strong roster, answers your pick' },
]

function HealthBar({ battler }: { battler: { hp: number; maxHp: number } }) {
  const share = Math.max(0, battler.hp / battler.maxHp)
  const tone = share > 0.5 ? 'good' : share > 0.2 ? 'warn' : 'low'
  return (
    <div className="hpbar" role="meter" aria-valuenow={battler.hp} aria-valuemax={battler.maxHp}>
      <div className={`hpbar__fill hpbar__fill--${tone}`} style={{ width: `${share * 100}%` }} />
    </div>
  )
}

const moveLabel = (name: string): string =>
  name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

/**
 * How long each beat holds the screen.
 *
 * An attack needs room for the lunge and the number that floats off it; a
 * switch or a settle is bookkeeping and should not make you wait.
 */
const beatDelay = (beat: Beat | null): number => {
  if (!beat) return 0
  if (beat.kind === 'attack') return beat.fainted ? 1000 : 760
  return 420
}

/** The damage number that floats off whoever just got hit. */
function DamagePop({ beat, tick }: { beat: Beat; tick: number }) {
  const tone =
    beat.missed || beat.multiplier === 0
      ? 'miss'
      : (beat.multiplier ?? 1) >= 2
        ? 'super'
        : (beat.multiplier ?? 1) < 1
          ? 'weak'
          : 'even'

  return (
    // The key restarts the animation even when two identical hits land in a row.
    <span key={tick} className={`pop pop--${tone}`} aria-hidden="true">
      {beat.missed ? 'Miss' : beat.multiplier === 0 ? 'No effect' : `−${beat.damage ?? 0}`}
    </span>
  )
}

export function BattlePage({ team, shiny }: Props) {
  const { pokedex, typeData, moves: moveIndex } = useDex()
  useDocumentTitle('Battle · Pokédex')

  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [blueprint, setBlueprint] = useState<TrainerBlueprint>(() => pickBlueprint())
  const [battle, setBattle] = useState<BattleState | null>(null)

  /*
   * A turn is decided in one go but shown one beat at a time: the queue holds
   * the frames still to play, and the arena renders whichever is current. It
   * also gates the controls, so a second click cannot land mid-exchange.
   */
  const [queue, setQueue] = useState<BattleState[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (queue.length === 0) return
    const [current, ...rest] = queue
    setBattle(current!)
    setTick((value) => value + 1)
    const timer = window.setTimeout(() => setQueue(rest), beatDelay(current!.beat))
    return () => window.clearTimeout(timer)
  }, [queue])

  if (team.length === 0) {
    return (
      <div className="notice">
        <h1>No team yet</h1>
        <p>Build a team first — you cannot take on a trainer without one.</p>
        <Link className="button" to={dexHref()}>
          Browse the dex
        </Link>
      </div>
    )
  }

  const begin = () => {
    const trainer = buildTrainer(blueprint, pokedex.pokemon, difficulty, moveIndex)
    const party = team.map((member, index) =>
      makeBattler(
        member.pokemon,
        member.view,
        `you-${member.pokemon.id}-${index}`,
        moveIndex,
        member.moves,
      ),
    )
    setQueue([])
    setBattle(startBattle(party, trainer))
  }

  // Nothing is accepted while a turn is still playing out, so a fast second
  // click cannot slip an action in between two beats of the same exchange.
  const busy = queue.length > 0

  const act = (action: PlayerAction) => {
    if (!battle || busy) return
    setQueue(resolveTurn(battle, action, { chart: typeData.chart, difficulty }))
  }

  if (!battle) {
    return (
      <div className="battle">
        <header className="team-page__header">
          <h1>Battle</h1>
          <p className="team-page__summary">
            Take your six against a trainer. Level 50, four moves each, and turns resolved by
            speed — priority moves go first whatever the speed says.
          </p>
        </header>

        <section className="panel">
          <h2>Difficulty</h2>
          <div className="chips">
            {DIFFICULTIES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`chip ${difficulty === option.value ? 'chip--on' : ''}`}
                aria-pressed={difficulty === option.value}
                title={option.hint}
                onClick={() => setDifficulty(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <h2 className="battle__subhead">Opponent</h2>
          <ul className="trainer-list">
            {TRAINERS.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className={`trainer ${blueprint.id === option.id ? 'trainer--on' : ''}`}
                  onClick={() => setBlueprint(option)}
                  style={
                    {
                      '--trainer-accent': `var(--type-${option.theme ?? 'normal'})`,
                    } as React.CSSProperties
                  }
                >
                  <span className="trainer__name">
                    {option.title} {option.name}
                  </span>
                  <span className="trainer__theme">
                    {option.theme ? <TypeBadge type={option.theme} /> : 'Mixed team'}
                  </span>
                  <span className="trainer__blurb">{option.blurb}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="detail__actions">
            <button type="button" className="button" onClick={begin}>
              Battle {blueprint.title} {blueprint.name}
            </button>
            <button type="button" className="chip" onClick={() => setBlueprint(pickBlueprint())}>
              Surprise me
            </button>
          </div>
        </section>
      </div>
    )
  }

  const you = battle.player[battle.playerActive]!
  const foe = battle.foe[battle.foeActive]!

  // Whoever is swinging on this beat lunges; whoever is taking it flinches.
  const beat = battle.beat
  const attacking = beat?.kind === 'attack' ? beat.side : null
  const landed = beat?.kind === 'attack' && !beat.missed && beat.multiplier !== 0

  const sideClass = (side: 'player' | 'foe') =>
    [
      'arena__side',
      side === 'foe' ? 'arena__side--foe' : '',
      attacking === side ? 'arena__side--swinging' : '',
      attacking && attacking !== side && landed ? 'arena__side--struck' : '',
    ]
      .filter(Boolean)
      .join(' ')

  return (
    <div className="battle">
      <header className="team-page__header">
        <h1>
          vs {battle.trainer.blueprint.title} {battle.trainer.blueprint.name}
        </h1>
        <p className="team-page__summary">
          Turn {battle.turn} · {DIFFICULTIES.find((d) => d.value === difficulty)?.label}
        </p>
      </header>

      <section className="arena">
        <div className={sideClass('foe')}>
          <div className="arena__info">
            <h2>{foe.view.title}</h2>
            <div className="detail__types">
              {foe.view.types.map((type) => (
                <TypeBadge key={type} type={type} />
              ))}
            </div>
            <HealthBar battler={foe} />
            <p className="arena__hp">
              {foe.hp} / {foe.maxHp}
            </p>
            <p className="arena__party">
              {battle.foe.filter((member) => !isDown(member)).length} left
            </p>
          </div>
          <div className="arena__stage">
            <Sprite id={foe.view.id} alt={foe.view.title} shiny={shiny} size={180} />
            {beat?.kind === 'attack' && beat.side === 'player' ? (
              <DamagePop beat={beat} tick={tick} />
            ) : null}
          </div>
        </div>

        <div className={sideClass('player')}>
          <div className="arena__stage">
            <Sprite id={you.view.id} alt={you.view.title} shiny={shiny} size={200} />
            {beat?.kind === 'attack' && beat.side === 'foe' ? (
              <DamagePop beat={beat} tick={tick} />
            ) : null}
            {/* Struggle hurts the user, so its number belongs on this side too. */}
            {beat?.kind === 'attack' && beat.side === 'player' && (beat.recoil ?? 0) > 0 ? (
              <span key={`recoil-${tick}`} className="pop pop--weak" aria-hidden="true">
                −{beat.recoil}
              </span>
            ) : null}
          </div>
          <div className="arena__info">
            <h2>{you.view.title}</h2>
            <div className="detail__types">
              {you.view.types.map((type) => (
                <TypeBadge key={type} type={type} />
              ))}
            </div>
            <HealthBar battler={you} />
            <p className="arena__hp">
              {you.hp} / {you.maxHp}
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        {battle.phase === 'over' ? (
          <>
            <h2>{battle.winner === 'player' ? 'You win' : 'You lost'}</h2>
            <div className="detail__actions">
              <button type="button" className="button" onClick={begin}>
                Rematch
              </button>
              <button type="button" className="chip" onClick={() => setBattle(null)}>
                Pick another trainer
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>{battle.phase === 'must-switch' ? 'Send in your next' : 'Your move'}</h2>
            {battle.phase === 'choosing' ? (
              usableMoves(you).length > 0 ? (
                <ul className="movepad">
                  {you.moves.map((slot, index) => (
                    <li key={slot.move.name}>
                      <button
                        type="button"
                        className="movepad__move"
                        disabled={slot.pp <= 0 || busy}
                        title={slot.move.effect ?? undefined}
                        onClick={() => act({ kind: 'move', index })}
                        style={
                          { '--move-accent': `var(--type-${slot.move.type})` } as React.CSSProperties
                        }
                      >
                        <span className="movepad__name">{moveLabel(slot.move.name)}</span>
                        <span className="movepad__meta">
                          <TypeBadge type={slot.move.type} />
                          <span className="movepad__class">{slot.move.damageClass}</span>
                        </span>
                        <span className="movepad__numbers">
                          {slot.move.power} pwr · {slot.move.accuracy ?? '—'} acc · {slot.pp}/
                          {slot.maxPp} PP
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                // Nothing left to throw. Struggle is the only legal action, and
                // it hurts — the same corner the games put you in.
                <div className="movepad movepad--struggle">
                  <button
                    type="button"
                    className="movepad__move"
                    disabled={busy}
                    onClick={() => act({ kind: 'move', index: -1 })}
                  >
                    <span className="movepad__name">Struggle</span>
                    <span className="movepad__numbers">{STRUGGLE.effect}</span>
                  </button>
                </div>
              )
            ) : null}

            <ul className="bench">
              {battle.player.map((member, index) => {
                const down = isDown(member)
                const current = index === battle.playerActive
                return (
                  <li key={member.key}>
                    <button
                      type="button"
                      className={`bench__slot ${current ? 'bench__slot--active' : ''} ${down ? 'bench__slot--down' : ''}`}
                      disabled={down || current || busy}
                      onClick={() =>
                        battle.phase === 'must-switch'
                          ? setBattle(sendIn(battle, index))
                          : act({ kind: 'switch', index })
                      }
                    >
                      <Sprite id={member.view.id} alt={member.view.title} shiny={shiny} size={48} />
                      <span className="bench__name">{member.view.title}</span>
                      <HealthBar battler={member} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Log</h2>
        <ol className="battle-log">
          {battle.log.map((line, index) => (
            <li key={`${battle.turn}-${index}-${line}`}>{line}</li>
          ))}
        </ol>
      </section>
    </div>
  )
}
