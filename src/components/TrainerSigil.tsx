interface Props {
  /** Stable key for this trainer; the mark is derived from it. */
  id: string
  /** Letter shown in the middle. */
  initial: string
  size?: number
}

/**
 * An original geometric badge for each trainer.
 *
 * Every trainer here is our own invention, so the mark is too: a ring, a set
 * of spokes and a monogram, all derived from the trainer's id so the same
 * trainer always draws the same badge. Nothing is fetched and nothing depicts
 * anyone; it is a shape and a letter in their type colour.
 */
export function TrainerSigil({ id, initial, size = 44 }: Props) {
  // A small hash spreads the ids across the available variations.
  let hash = 0
  for (let index = 0; index < id.length; index++) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  }

  const spokes = 5 + (hash % 4)
  const rotation = hash % 60
  const inner = 11 + (hash % 5)

  return (
    <svg
      className="sigil"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="presentation"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="21" className="sigil__ring" />
      <g transform={`rotate(${rotation} 24 24)`}>
        {Array.from({ length: spokes }, (_, index) => {
          const angle = (index / spokes) * Math.PI * 2
          return (
            <line
              key={index}
              x1={24 + Math.cos(angle) * inner}
              y1={24 + Math.sin(angle) * inner}
              x2={24 + Math.cos(angle) * 20}
              y2={24 + Math.sin(angle) * 20}
              className="sigil__spoke"
            />
          )
        })}
      </g>
      <circle cx="24" cy="24" r={inner - 2} className="sigil__core" />
      <text x="24" y="24" className="sigil__letter" dominantBaseline="central" textAnchor="middle">
        {initial.toUpperCase()}
      </text>
    </svg>
  )
}
