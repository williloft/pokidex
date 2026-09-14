import { createPreference } from './preference'
import { DEFAULT_SPRITE_STYLE, SPRITE_STYLES, type SpriteStyle } from './sprites'

const useShinyValue = createPreference<boolean>(
  'pokedex:shiny',
  false,
  (raw) => raw === '1',
  (value) => (value ? '1' : '0'),
)

/**
 * The original hardcoded shiny sprites, kept as the signature idea — but as a
 * switch the whole app respects.
 */
export function useShiny(): [boolean, () => void] {
  const [shiny, set] = useShinyValue()
  return [shiny, () => set(!shiny)]
}

const VALID_STYLES = new Set(SPRITE_STYLES.map((style) => style.value))

export const useSpriteStyle = createPreference<SpriteStyle>(
  'pokedex:sprite-style',
  DEFAULT_SPRITE_STYLE,
  (raw) => (VALID_STYLES.has(raw as SpriteStyle) ? (raw as SpriteStyle) : null),
  (value) => value,
)
