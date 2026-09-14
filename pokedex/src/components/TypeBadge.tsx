import { Link } from 'react-router-dom'
import { displayName } from '../lib/pokedex'

interface Props {
  type: string
  /** Small badges are used inside cards, regular ones on the detail page. */
  size?: 'sm' | 'md'
  /** Render as a link that filters the index by this type. */
  link?: boolean
  suffix?: string
}

export function TypeBadge({ type, size = 'sm', link = false, suffix }: Props) {
  const className = `type-badge type-badge--${size}`
  const style = { '--type-color': `var(--type-${type})` } as React.CSSProperties
  const label = (
    <>
      {displayName(type)}
      {suffix ? <span className="type-badge__suffix">{suffix}</span> : null}
    </>
  )

  if (link) {
    return (
      <Link className={className} style={style} to={`/?type=${type}`}>
        {label}
      </Link>
    )
  }

  return (
    <span className={className} style={style}>
      {label}
    </span>
  )
}
