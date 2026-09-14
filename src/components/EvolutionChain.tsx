import { Link } from 'react-router-dom'
import { dexNumber, displayName } from '../lib/pokedex'
import type { SpriteStyle } from '../lib/sprites'
import type { EvolutionNode } from '../lib/types'
import { Sprite } from './Sprite'

interface Props {
  node: EvolutionNode
  shiny: boolean
  spriteStyle: SpriteStyle
  currentId: number
}

/**
 * Rendered as a tree rather than a line, because branching families are exactly
 * the interesting case. Megas and Gigantamax deliberately stay out of here —
 * they are alternate forms, not evolution stages, and live in the form picker.
 */
export function EvolutionChain({ node, shiny, spriteStyle, currentId }: Props) {
  return (
    <ul className="evo">
      <EvolutionBranch node={node} shiny={shiny} spriteStyle={spriteStyle} currentId={currentId} />
    </ul>
  )
}

function EvolutionBranch({ node, shiny, spriteStyle, currentId }: Props) {
  return (
    <li className="evo__node">
      {node.trigger ? <span className="evo__trigger">{node.trigger}</span> : null}
      <Link
        className={`evo__stage ${node.id === currentId ? 'evo__stage--current' : ''}`}
        to={`/pokemon/${node.name}`}
        viewTransition
        aria-current={node.id === currentId ? 'page' : undefined}
      >
        <Sprite id={node.id} alt="" shiny={shiny} style={spriteStyle} size={56} />
        <span className="evo__name">{displayName(node.name)}</span>
        <span className="evo__number">{dexNumber(node.id)}</span>
      </Link>

      {node.children.length > 0 ? (
        <ul className="evo__children">
          {node.children.map((child) => (
            <EvolutionBranch
              key={child.id}
              node={child}
              shiny={shiny}
              spriteStyle={spriteStyle}
              currentId={currentId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
