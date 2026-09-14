import { Link } from 'react-router-dom'
import { dexNumber, displayName } from '../lib/pokedex'
import type { EvolutionNode, PokemonForm } from '../lib/types'
import { Sprite } from './Sprite'

interface Props {
  node: EvolutionNode
  shiny: boolean
  currentId: number
  /** Alternate forms of a species in the chain, looked up from the dex index. */
  formsFor: (id: number) => PokemonForm[]
}

/**
 * The family tree, rather than a line — branching families are exactly the
 * interesting case.
 *
 * Megas, Gigantamax and regional variants hang off their stage rather than
 * sitting in the chain as steps of their own, because that is what they are:
 * another shape for that Pokémon, not the next thing it becomes.
 */
export function EvolutionChain({ node, shiny, currentId, formsFor }: Props) {
  return (
    <ul className="evo">
      <EvolutionBranch node={node} shiny={shiny} currentId={currentId} formsFor={formsFor} />
    </ul>
  )
}

function EvolutionBranch({ node, shiny, currentId, formsFor }: Props) {
  const forms = formsFor(node.id)

  return (
    <li className="evo__node">
      {node.trigger ? <span className="evo__trigger">{node.trigger}</span> : null}

      <Link
        className={`evo__stage ${node.id === currentId ? 'evo__stage--current' : ''}`}
        to={`/pokemon/${node.name}`}
        viewTransition
        aria-current={node.id === currentId ? 'page' : undefined}
      >
        <Sprite id={node.id} alt="" shiny={shiny} size={56} />
        <span className="evo__name">{displayName(node.name)}</span>
        <span className="evo__number">{dexNumber(node.id)}</span>
      </Link>

      {forms.length > 0 ? (
        <ul className="evo__forms" aria-label={`Forms of ${displayName(node.name)}`}>
          {forms.map((form) => (
            <li key={form.name}>
              <Link
                className="evo__form"
                to={`/pokemon/${node.name}?form=${form.name}`}
                viewTransition
                style={
                  {
                    '--form-primary': `var(--type-${form.types[0] ?? 'normal'})`,
                    '--form-secondary': `var(--type-${form.types[1] ?? form.types[0] ?? 'normal'})`,
                  } as React.CSSProperties
                }
              >
                <Sprite id={form.id} alt="" shiny={shiny} size={40} />
                <span className="evo__form-label">{form.label}</span>
              </Link>
            </li>
          ))}
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
              formsFor={formsFor}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
