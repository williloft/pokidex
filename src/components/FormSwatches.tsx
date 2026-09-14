import type { FormView } from '../lib/types'

interface Props {
  views: FormView[]
  selected: string
  onSelect: (name: string) => void
  size?: 'sm' | 'md'
  name: string
}

const CATEGORY_LABEL: Record<string, string> = {
  default: 'Base form',
  mega: 'Mega Evolution',
  gmax: 'Gigantamax',
  regional: 'Regional form',
  other: 'Alternate form',
}

/**
 * Variant picker, in the shape people already know from shopping for a shirt
 * in three colours: one swatch per form, tinted by that form's primary type so
 * a typing change is visible before you even click it.
 */
export function FormSwatches({ views, selected, onSelect, size = 'sm', name }: Props) {
  if (views.length < 2) return null

  return (
    <div
      className={`swatches swatches--${size}`}
      role="radiogroup"
      aria-label={`Forms of ${name}`}
    >
      {views.map((view) => {
        const isSelected = view.name === selected
        return (
          <button
            key={view.name}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`swatch ${isSelected ? 'swatch--on' : ''} swatch--${view.category}`}
            style={
              {
                '--swatch-primary': `var(--type-${view.types[0] ?? 'normal'})`,
                '--swatch-secondary': `var(--type-${view.types[1] ?? view.types[0] ?? 'normal'})`,
              } as React.CSSProperties
            }
            title={`${view.label} — ${CATEGORY_LABEL[view.category] ?? 'Form'}`}
            onClick={(event) => {
              // Swatches sit inside the card's link on the grid.
              event.preventDefault()
              event.stopPropagation()
              onSelect(view.name)
            }}
          >
            <span className="visually-hidden">{view.label}</span>
            {size === 'md' ? <span aria-hidden="true">{view.label}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
