import { Link } from 'react-router-dom'
import { dexNumber, displayName } from '../lib/pokedex'
import { formTitle, type EvolutionNode, type FormGroups, type PokemonForm } from '../lib/types'
import { Sprite } from './Sprite'

interface Props {
  node: EvolutionNode
  shiny: boolean
  currentId: number
  /** API name of the variant being viewed, so the right node is marked. */
  currentForm: string
  variantsFor: (id: number) => FormGroups
  nameFor: (id: number) => string
}

/**
 * The family tree, rather than a line — branching families are exactly the
 * interesting case.
 *
 * Mega Evolutions sit in the flow as a branch off their stage: they change
 * typing, stats and ability, so treating them as a footnote undersells them.
 * Regional variants stay as chips beside the stage, and appearance-only forms
 * are left out entirely — a costume is not a step in a family tree.
 */
export function EvolutionChain(props: Props) {
  return (
    <ul className="evo">
      <EvolutionBranch {...props} />
    </ul>
  )
}

function EvolutionBranch({ node, shiny, currentId, currentForm, variantsFor, nameFor }: Props) {
  const { megas, special } = variantsFor(node.id)
  const speciesName = nameFor(node.id) || node.name
  const isCurrent = node.id === currentId && currentForm === speciesName

  return (
    <li className="evo__node">
      {node.trigger ? <span className="evo__trigger">{node.trigger}</span> : null}

      <Link
        className={`evo__stage ${isCurrent ? 'evo__stage--current' : ''}`}
        to={`/pokemon/${node.name}`}
        viewTransition
        aria-current={isCurrent ? 'page' : undefined}
      >
        <Sprite id={node.id} alt="" shiny={shiny} size={56} />
        <span className="evo__name">{displayName(node.name)}</span>
        <span className="evo__number">{dexNumber(node.id)}</span>
      </Link>

      {special.length > 0 ? (
        <ul className="evo__forms" aria-label={`Forms of ${displayName(node.name)}`}>
          {special.map((form) => (
            <li key={form.name}>
              <Link
                className="evo__form"
                to={`/pokemon/${node.name}?form=${form.name}`}
                viewTransition
                style={formColours(form)}
              >
                <Sprite id={form.id} alt="" shiny={shiny} size={40} />
                <span className="evo__form-label">{form.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {megas.length > 0 ? (
        <ul className="evo__children evo__children--mega">
          {megas.map((mega) => {
            const megaCurrent = node.id === currentId && currentForm === mega.name
            return (
              <li className="evo__node" key={mega.name}>
                <span className="evo__trigger evo__trigger--mega">Mega Evolution</span>
                <Link
                  className={`evo__stage evo__stage--mega ${megaCurrent ? 'evo__stage--current' : ''}`}
                  to={`/pokemon/${node.name}?form=${mega.name}`}
                  viewTransition
                  aria-current={megaCurrent ? 'page' : undefined}
                  style={formColours(mega)}
                >
                  <span className="evo__aura" aria-hidden="true" />
                  <Sprite id={mega.id} alt="" shiny={shiny} size={56} />
                  <span className="evo__name">
                    {formTitle(speciesName, mega.label, mega.category)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}

      {node.children.length > 0 ? (
        <ul className="evo__children">
          {node.children.map((child) => (
            <EvolutionBranch
              key={child.id}
              node={child}
              shiny={shiny}
              currentId={currentId}
              currentForm={currentForm}
              variantsFor={variantsFor}
              nameFor={nameFor}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

const formColours = (form: PokemonForm): React.CSSProperties =>
  ({
    '--form-primary': `var(--type-${form.types[0] ?? 'normal'})`,
    '--form-secondary': `var(--type-${form.types[1] ?? form.types[0] ?? 'normal'})`,
  }) as React.CSSProperties
