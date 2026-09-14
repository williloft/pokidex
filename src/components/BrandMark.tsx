/**
 * The app's own mark: four entries in a grid, one of them open for inspection.
 * It says "catalogue you can look things up in", which is what this is, and it
 * stays legible down to favicon size where anything more detailed turns to mud.
 *
 * Kept in sync with public/favicon.svg.
 */
export function BrandMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="brand-mark-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5aa9ff" />
          <stop offset="1" stopColor="#6455e0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#brand-mark-fill)" />
      <g fill="#fff">
        <circle cx="11.4" cy="20.6" r="3.1" />
        <circle cx="20.6" cy="11.4" r="3.1" />
        <circle cx="20.6" cy="20.6" r="3.1" />
      </g>
      <circle cx="11.4" cy="11.4" r="3.1" fill="none" stroke="#fff" strokeWidth="2.1" />
    </svg>
  )
}
