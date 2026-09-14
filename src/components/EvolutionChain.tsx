import { Link } from 'react-router-dom'
import { dexNumber, displayName } from '../lib/pokedex'
import { artwork } from '../lib/sprites'
import type { EvolutionNode } from '../lib/types'

interface Props {
  node: EvolutionNode
  shiny: boolean
  currentId: number
}

/**
 * Rendered as a tree rather than a line, because branching families (Eevee,
 * Wurmple, Tyrogue) are exactly the interesting case.
 */
export function EvolutionChain({ node, shiny, currentId }: Props) {
  return (
    <ul className="evo">
      <EvolutionBranch node={node} shiny={shiny} currentId={currentId} />
    </ul>
  )
}

function EvolutionBranch({ node, shiny, currentId }: Props) {
  return (
    <li className="evo__node">
      {node.trigger ? <span className="evo__trigger">{node.trigger}</span> : null}
      <Link
        className={`evo__stage ${node.id === currentId ? 'evo__stage--current' : ''}`}
        to={`/pokemon/${node.name}`}
        aria-current={node.id === currentId ? 'page' : undefined}
      >
        <img
          src={artwork(node.id, shiny)}
          alt=""
          width={72}
          height={72}
          loading="lazy"
          decoding="async"
        />
        <span className="evo__name">{displayName(node.name)}</span>
        <span className="evo__number">{dexNumber(node.id)}</span>
      </Link>

      {node.children.length > 0 ? (
        <ul className="evo__children">
          {node.children.map((child) => (
            <EvolutionBranch key={child.id} node={child} shiny={shiny} currentId={currentId} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
