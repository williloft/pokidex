import { STAT_LABELS, STAT_ORDER, statTotal, type Stats } from '../lib/types'

/** Highest base stat in the games, used to scale the bars consistently. */
const MAX_BASE_STAT = 255

export function StatBars({ stats, accent }: { stats: Stats; accent: string }) {
  return (
    <div className="stats">
      {STAT_ORDER.map((key) => {
        const value = stats[key]
        return (
          <div className="stats__row" key={key}>
            <span className="stats__label">{STAT_LABELS[key]}</span>
            <span className="stats__value">{value}</span>
            <div className="stats__track">
              <div
                className="stats__fill"
                style={{
                  width: `${(value / MAX_BASE_STAT) * 100}%`,
                  background: `var(--type-${accent})`,
                }}
                role="meter"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={MAX_BASE_STAT}
                aria-label={STAT_LABELS[key]}
              />
            </div>
          </div>
        )
      })}
      <div className="stats__row stats__row--total">
        <span className="stats__label">Total</span>
        <span className="stats__value">{statTotal(stats)}</span>
        <div className="stats__track" />
      </div>
    </div>
  )
}
