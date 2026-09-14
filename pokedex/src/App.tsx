import { createContext, useContext, useMemo } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { TeamBar } from './components/TeamBar'
import { useDataset, type Dataset } from './lib/dataset'
import { useShiny } from './lib/useShiny'
import { useTeam } from './lib/useTeam'
import type { Pokemon } from './lib/types'
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
  const { team, has, isFull, toggle, remove, clear } = useTeam()
  const location = useLocation()

  const dataset = state.status === 'ready' ? state.data : null

  const teamMembers = useMemo<Pokemon[]>(() => {
    if (!dataset) return []
    return team
      .map((id) => dataset.byId.get(id))
      .filter((entry): entry is Pokemon => entry !== undefined)
  }, [dataset, team])

  return (
    <div className="app" data-shiny={shiny}>
      <header className="topbar">
        <Link className="topbar__brand" to="/">
          <span className="topbar__dot" aria-hidden="true" />
          Pokédex
        </Link>

        <nav className="topbar__nav">
          <NavLink to="/" end>
            Browse
          </NavLink>
          <NavLink to="/team">
            Team
            {team.length > 0 ? <span className="topbar__badge">{team.length}</span> : null}
          </NavLink>
        </nav>

        <button
          type="button"
          className={`shiny-toggle ${shiny ? 'shiny-toggle--on' : ''}`}
          onClick={toggleShiny}
          aria-pressed={shiny}
        >
          <span aria-hidden="true">✦</span> Shiny
        </button>
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
                    inTeam={has}
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
                    inTeam={has}
                    teamFull={isFull}
                    onToggleTeam={toggle}
                  />
                }
              />
              <Route
                path="/team"
                element={<TeamPage team={teamMembers} shiny={shiny} onRemove={remove} />}
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

      {location.pathname !== '/team' ? (
        <TeamBar team={teamMembers} shiny={shiny} onRemove={remove} onClear={clear} />
      ) : null}
    </div>
  )
}
