import { createPreference } from './preference'

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
