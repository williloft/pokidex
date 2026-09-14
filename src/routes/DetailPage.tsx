import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useDex } from '../App'
import { EvolutionChain } from '../components/EvolutionChain'
import { FormSwatches } from '../components/FormSwatches'
import { Sprite } from '../components/Sprite'
import { StatBars } from '../components/StatBars'
import { TypeBadge } from '../components/TypeBadge'
import { fetchDetail } from '../lib/api'
import { dexHref } from '../lib/dexLocation'
import { dexNumber, displayName } from '../lib/pokedex'
import { crySrc } from '../lib/sprites'
import {
  cosmeticViews,
  groupForms,
  resolveForm,
  selectableViews,
  type PokemonDetail,
} from '../lib/types'
import { defensiveProfile } from '../lib/typeChart'
import { useDocumentTitle } from '../lib/useScrollRestoration'
import type { SlotState } from '../lib/useTeam'

interface Props {
  shiny: boolean
  slotState: (id: number, form: string | null) => SlotState
  teamFull: boolean
  onToggleTeam: (id: number, form: string | null) => void
}

export function DetailPage({ shiny, slotState, teamFull, onToggleTeam }: Props) {
  const { name = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { byName, byId, typeData, abilities: abilityText } = useDex()
  const pokemon = byName.get(name.toLowerCase())

  const [detail, setDetail] = useState<PokemonDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const view = pokemon ? resolveForm(pokemon, params.get('form')) : null
  useDocumentTitle(
    pokemon && view
      ? `${view.title} · Pokédex`
      : 'Pokédex',
  )

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

  // Arrow keys walk the dex, the way the handheld ones do — but never while a
  // control has focus, and never when a modifier suggests a browser shortcut.
  useEffect(() => {
    if (!pokemon) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return

      const target = event.target as HTMLElement | null
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'SELECT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return
      }

      const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
      if (step === 0) return

      const neighbour = byId.get(pokemon.id + step)
      if (!neighbour) return
      event.preventDefault()
      navigate(`/pokemon/${neighbour.name}`)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pokemon, byId, navigate])

  if (!pokemon || !view) {
    return (
      <div className="notice">
        <h1>Not in the dex</h1>
        <p>No Pokémon named “{name}”.</p>
        <Link className="button" to={dexHref()}>
          Back to the dex
        </Link>
      </div>
    )
  }

  const views = selectableViews(pokemon)
  const costumes = cosmeticViews(pokemon)
  const primary = view.types[0] ?? 'normal'
  const profile = defensiveProfile(typeData.chart, typeData.types, view.types)
  const previous = byId.get(pokemon.id - 1)
  const next = byId.get(pokemon.id + 1)
  const formName = view.category === 'default' ? null : view.name
  const slot = slotState(pokemon.id, formName)

  const selectForm = (formName: string) => {
    const nextParams = new URLSearchParams(params)
    if (formName === pokemon.name) nextParams.delete('form')
    else nextParams.set('form', formName)
    setParams(nextParams, { replace: true })
  }

  const playCry = () => {
    audioRef.current ??= new Audio()
    audioRef.current.src = crySrc(view.id)
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
        <Link className="chip" to={dexHref()} viewTransition>
          ← Dex
        </Link>
        <div className="detail__steps">
          {previous ? (
            <Link className="chip" to={`/pokemon/${previous.name}`} viewTransition>
              ← {displayName(previous.name)}
            </Link>
          ) : null}
          {next ? (
            <Link className="chip" to={`/pokemon/${next.name}`} viewTransition>
              {displayName(next.name)} →
            </Link>
          ) : null}
        </div>
      </nav>

      <header className="detail__hero">
        <div className="detail__art">
          <Sprite
            id={view.id}
            alt={view.title}
            shiny={shiny}
            size={360}
            priority
            transitionName={`art-${view.id}`}
          />
        </div>

        <div className="detail__intro">
          <p className="detail__number">{dexNumber(pokemon.id)}</p>
          <h1>{view.title}</h1>
          {detail?.genus ? <p className="detail__genus">{detail.genus}</p> : null}

          {views.length > 1 ? (
            <div className="detail__forms">
              <span className="filters__legend">Form</span>
              <FormSwatches
                views={views}
                selected={view.name}
                onSelect={selectForm}
                size="md"
                name={displayName(pokemon.name)}
              />
            </div>
          ) : null}

          {/* Costumes change nothing but the artwork, so they stay folded away
              rather than burying the forms that alter typing or stats. */}
          {costumes.length > 0 ? (
            <details className="costumes" open={costumes.some((item) => item.name === view.name)}>
              <summary>
                {costumes.length} appearance-only {costumes.length === 1 ? 'form' : 'forms'}
              </summary>
              <FormSwatches
                views={[...costumes]}
                selected={view.name}
                onSelect={selectForm}
                size="md"
                name={displayName(pokemon.name)}
              />
            </details>
          ) : null}

          <div className="detail__types">
            {view.types.map((type) => (
              <TypeBadge key={type} type={type} size="md" link />
            ))}
          </div>

          {detail && detail.entries.length > 0 ? (
            <div className="dex-entries">
              <p className="detail__flavor">
                {detail.entries[0]!.text}
                {detail.entries[0]!.version ? (
                  <span className="dex-entries__version">
                    {displayName(detail.entries[0]!.version)}
                  </span>
                ) : null}
              </p>

              {detail.entries.length > 1 ? (
                <details className="dex-entries__more">
                  <summary>
                    {detail.entries.length - 1} more {detail.entries.length === 2 ? 'entry' : 'entries'}
                  </summary>
                  <ul>
                    {detail.entries.slice(1).map((entry) => (
                      <li key={`${entry.version ?? ''}-${entry.text}`}>
                        <p>{entry.text}</p>
                        {entry.version ? (
                          <span className="dex-entries__version">{displayName(entry.version)}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
          {detailError ? <p className="detail__error">{detailError}</p> : null}

          <dl className="detail__facts">
            <div>
              <dt>Height</dt>
              <dd>{(view.height / 10).toFixed(1)} m</dd>
            </div>
            <div>
              <dt>Weight</dt>
              <dd>{(view.weight / 10).toFixed(1)} kg</dd>
            </div>
            <div>
              <dt>Generation</dt>
              <dd>{pokemon.generation}</dd>
            </div>

          </dl>

          <div className="detail__actions">
            <button
              type="button"
              className={`button ${slot === 'in' ? 'button--active' : ''}`}
              onClick={() => onToggleTeam(pokemon.id, formName)}
              disabled={teamFull && slot === 'out'}
              title={
                slot === 'other-form'
                  ? 'This species already has a slot — this swaps which form fills it'
                  : undefined
              }
            >
              {slot === 'in'
                ? 'In your team'
                : slot === 'other-form'
                  ? `Run ${view.title} instead`
                  : teamFull
                    ? 'Team is full'
                    : 'Add to team'}
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
          <StatBars stats={view.stats} accent={primary} />
        </section>

        <section className="panel">
          <h2>Defensive matchups</h2>
          <p className="panel__note">
            Damage taken from each attacking type
            {view.category === 'default' ? '.' : `, as ${view.label}.`}
          </p>

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
          <h2>Abilities</h2>
          {view.abilities.length > 0 ? (
            <ul className="abilities">
              {view.abilities.map((ability) => (
                <li key={ability.name}>
                  <span className="abilities__name">
                    {displayName(ability.name)}
                    {ability.hidden ? <em className="abilities__hidden">hidden</em> : null}
                  </span>
                  {abilityText[ability.name] ? (
                    <p className="abilities__text">{abilityText[ability.name]}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel__note">None listed.</p>
          )}
        </section>

        <section className="panel">
          <h2>Evolution</h2>
          {detail?.evolution ? (
            <EvolutionChain
              node={detail.evolution}
              shiny={shiny}
              currentId={pokemon.id}
              currentForm={view.name}
              variantsFor={(id) => {
                const species = byId.get(id)
                if (!species) return { megas: [], special: [], cosmetic: [] }
                return groupForms(species)
              }}
              nameFor={(id) => byId.get(id)?.name ?? ''}
            />
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
