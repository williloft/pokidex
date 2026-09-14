import { createContext, useContext, useMemo } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { BrandMark } from './components/BrandMark'
import { TeamBar } from './components/TeamBar'
import { useDataset, type Dataset } from './lib/dataset'
import { resolveForm, type TeamMember } from './lib/types'
import { useShiny } from './lib/usePrefs'
import { useScrollRestoration } from './lib/useScrollRestoration'
import { useTeam } from './lib/useTeam'
import { DetailPage } from './routes/DetailPage'
import { IndexPage } from './routes/IndexPage'
import { TeamPage } from './routes/TeamPage'

const DatasetContext = createContext<Dataset | null>(null)

export function useDex(): Dataset {
  const dataset = useContext(DatasetContext)
  if (!dataset) throw new Error('useDex must be used inside the dataset provider')
  return dataset
}

export default function App() {
  const state = useDataset()
  const [shiny, toggleShiny] = useShiny()
  const { team, stateOf, isFull, toggle, setForm, remove, clear } = useTeam()
  const location = useLocation()

  const dataset = state.status === 'ready' ? state.data : null
  useScrollRestoration(dataset !== null)

  const teamMembers = useMemo<TeamMember[]>(() => {
    if (!dataset) return []
    return team
      .map((entry) => {
        const pokemon = dataset.byId.get(entry.id)
        return pokemon ? { pokemon, view: resolveForm(pokemon, entry.form) } : null
      })
      .filter((member): member is TeamMember => member !== null)
  }, [dataset, team])

  const showTeamBar = location.pathname !== '/team' && teamMembers.length > 0

  return (
    <div className="app" data-teambar={showTeamBar}>
      <header className="topbar">
        <Link className="topbar__brand" to="/">
          <BrandMark />
          Pokédex
        </Link>

        <nav className="topbar__nav">
          <NavLink to="/" end viewTransition>
            Browse
          </NavLink>
          <NavLink to="/team" viewTransition>
            Team
            {team.length > 0 ? <span className="topbar__badge">{team.length}</span> : null}
          </NavLink>
        </nav>

        <div className="topbar__prefs">
          <button
            type="button"
            className={`shiny-toggle ${shiny ? 'shiny-toggle--on' : ''}`}
            onClick={toggleShiny}
            aria-pressed={shiny}
          >
            <span aria-hidden="true">✦</span> Shiny
          </button>
        </div>
      </header>

      <main className="main">
        {state.status === 'loading' ? (
          <p className="notice">Loading the dex…</p>
        ) : state.status === 'error' ? (
          <div className="notice notice--error">
            <p>{state.error}</p>
          </div>
        ) : (
          <DatasetContext.Provider value={state.data}>
            <Routes location={location}>
              <Route
                index
                element={
                  <IndexPage
                    shiny={shiny}
                    slotState={stateOf}
                    teamFull={isFull}
                    onToggleTeam={toggle}
                  />
                }
              />
              <Route
                path="/pokemon/:name"
                element={
                  <DetailPage
                    shiny={shiny}
                    slotState={stateOf}
                    teamFull={isFull}
                    onToggleTeam={toggle}
                  />
                }
              />
              <Route
                path="/team"
                element={
                  <TeamPage
                    team={teamMembers}
                    shiny={shiny}
                    teamFull={isFull}
                    onRemove={remove}
                    onSetForm={setForm}
                    onAdd={toggle}
                  />
                }
              />
              <Route
                path="*"
                element={
                  <div className="notice">
                    <p>No such page.</p>
                    <Link className="button" to="/">
                      Back to the dex
                    </Link>
                  </div>
                }
              />
            </Routes>
          </DatasetContext.Provider>
        )}
      </main>

      {showTeamBar ? (
        <TeamBar team={teamMembers} shiny={shiny} onRemove={remove} onClear={clear} />
      ) : null}
    </div>
  )
}
