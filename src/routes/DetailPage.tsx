import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDex } from '../App'
import { EvolutionChain } from '../components/EvolutionChain'
import { StatBars } from '../components/StatBars'
import { TypeBadge } from '../components/TypeBadge'
import { fetchDetail } from '../lib/api'
import { dexNumber, displayName } from '../lib/pokedex'
import { artwork, crySrc } from '../lib/sprites'
import type { PokemonDetail } from '../lib/types'
import { defensiveProfile } from '../lib/typeChart'

interface Props {
  shiny: boolean
  inTeam: (id: number) => boolean
  teamFull: boolean
  onToggleTeam: (id: number) => void
}

export function DetailPage({ shiny, inTeam, teamFull, onToggleTeam }: Props) {
  const { name = '' } = useParams()
  const navigate = useNavigate()
  const { byName, byId, typeData } = useDex()
  const pokemon = byName.get(name.toLowerCase())

  const [detail, setDetail] = useState<PokemonDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!pokemon) return
    const controller = new AbortController()
    setDetail(null)
    setDetailError(null)
    fetchDetail(pokemon.id, controller.signal)
      .then(setDetail)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setDetailError(error instanceof Error ? error.message : 'Could not load extra details.')
      })
    return () => controller.abort()
  }, [pokemon])

  // Arrow keys walk the dex, the way the handheld ones do.
  useEffect(() => {
    if (!pokemon) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'SELECT') return
      const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
      if (step === 0) return
      const neighbour = byId.get(pokemon.id + step)
      if (neighbour) navigate(`/pokemon/${neighbour.name}`)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pokemon, byId, navigate])

  if (!pokemon) {
    return (
      <div className="notice">
        <h1>Not in the dex</h1>
        <p>No Pokémon named “{name}”.</p>
        <Link className="button" to="/">
          Back to the dex
        </Link>
      </div>
    )
  }

  const primary = pokemon.types[0] ?? 'normal'
  const profile = defensiveProfile(typeData.chart, typeData.types, pokemon.types)
  const previous = byId.get(pokemon.id - 1)
  const next = byId.get(pokemon.id + 1)
  const isInTeam = inTeam(pokemon.id)

  const playCry = () => {
    audioRef.current ??= new Audio()
    audioRef.current.src = crySrc(pokemon.id)
    audioRef.current.volume = 0.4
    void audioRef.current.play().catch(() => {
      // Autoplay policy or a missing cry file — not worth interrupting for.
    })
  }

  return (
    <article
      className="detail"
      style={{ '--accent': `var(--type-${primary})` } as React.CSSProperties}
    >
      <nav className="detail__nav">
        <Link className="chip" to="/">
          ← Dex
        </Link>
        <div className="detail__steps">
          {previous ? (
            <Link className="chip" to={`/pokemon/${previous.name}`}>
              ← {displayName(previous.name)}
            </Link>
          ) : null}
          {next ? (
            <Link className="chip" to={`/pokemon/${next.name}`}>
              {displayName(next.name)} →
            </Link>
          ) : null}
        </div>
      </nav>

      <header className="detail__hero">
        <div className="detail__art">
          <img
            src={artwork(pokemon.id, shiny)}
            alt={displayName(pokemon.name)}
            width={360}
            height={360}
            style={{ viewTransitionName: `art-${pokemon.id}` }}
          />
        </div>

        <div className="detail__intro">
          <p className="detail__number">{dexNumber(pokemon.id)}</p>
          <h1>{displayName(pokemon.name)}</h1>
          {detail?.genus ? <p className="detail__genus">{detail.genus}</p> : null}

          <div className="detail__types">
            {pokemon.types.map((type) => (
              <TypeBadge key={type} type={type} size="md" link />
            ))}
          </div>

          {detail?.flavorText ? <p className="detail__flavor">{detail.flavorText}</p> : null}
          {detailError ? <p className="detail__error">{detailError}</p> : null}

          <dl className="detail__facts">
            <div>
              <dt>Height</dt>
              <dd>{(pokemon.height / 10).toFixed(1)} m</dd>
            </div>
            <div>
              <dt>Weight</dt>
              <dd>{(pokemon.weight / 10).toFixed(1)} kg</dd>
            </div>
            <div>
              <dt>Generation</dt>
              <dd>{pokemon.generation}</dd>
            </div>
            <div>
              <dt>Abilities</dt>
              <dd>
                {pokemon.abilities
                  .map((ability) => displayName(ability.name) + (ability.hidden ? ' (hidden)' : ''))
                  .join(', ')}
              </dd>
            </div>
          </dl>

          <div className="detail__actions">
            <button
              type="button"
              className={`button ${isInTeam ? 'button--active' : ''}`}
              onClick={() => onToggleTeam(pokemon.id)}
              disabled={teamFull && !isInTeam}
            >
              {isInTeam ? 'In your team' : teamFull ? 'Team is full' : 'Add to team'}
            </button>
            <button type="button" className="chip" onClick={playCry}>
              ♪ Play cry
            </button>
          </div>
        </div>
      </header>

      <div className="detail__panels">
        <section className="panel">
          <h2>Base stats</h2>
          <StatBars stats={pokemon.stats} accent={primary} />
        </section>

        <section className="panel">
          <h2>Defensive matchups</h2>
          <p className="panel__note">Damage taken from each attacking type.</p>

          <h3>Weak to</h3>
          <div className="matchups">
            {profile.weaknesses.length > 0 ? (
              profile.weaknesses.map((entry) => (
                <TypeBadge
                  key={entry.type}
                  type={entry.type}
                  size="md"
                  suffix={`${entry.multiplier}×`}
                />
              ))
            ) : (
              <p className="panel__note">Nothing hits this for extra damage.</p>
            )}
          </div>

          <h3>Resists</h3>
          <div className="matchups">
            {profile.resistances.length > 0 ? (
              profile.resistances.map((entry) => (
                <TypeBadge
                  key={entry.type}
                  type={entry.type}
                  size="md"
                  suffix={`${entry.multiplier}×`}
                />
              ))
            ) : (
              <p className="panel__note">No resistances.</p>
            )}
          </div>

          {profile.immunities.length > 0 ? (
            <>
              <h3>Immune to</h3>
              <div className="matchups">
                {profile.immunities.map((type) => (
                  <TypeBadge key={type} type={type} size="md" suffix="0×" />
                ))}
              </div>
            </>
          ) : null}
        </section>

        <section className="panel">
          <h2>Evolution</h2>
          {detail?.evolution ? (
            <EvolutionChain node={detail.evolution} shiny={shiny} currentId={pokemon.id} />
          ) : detailError ? (
            <p className="panel__note">Evolution data unavailable.</p>
          ) : (
            <p className="panel__note">Loading…</p>
          )}
        </section>

        <section className="panel">
          <h2>Breeding &amp; capture</h2>
          {detail ? (
            <dl className="detail__facts">
              <div>
                <dt>Egg groups</dt>
                <dd>{detail.eggGroups.map(displayName).join(', ') || '—'}</dd>
              </div>
              <div>
                <dt>Capture rate</dt>
                <dd>{detail.captureRate}</dd>
              </div>
              <div>
                <dt>Growth rate</dt>
                <dd>{detail.growthRate ? displayName(detail.growthRate) : '—'}</dd>
              </div>
            </dl>
          ) : (
            <p className="panel__note">{detailError ? 'Unavailable.' : 'Loading…'}</p>
          )}
        </section>
      </div>
    </article>
  )
}
