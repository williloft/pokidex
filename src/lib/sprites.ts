/**
 * Sprite and cry URLs are derivable from a Pokémon's id, so we don't store them
 * in the index — that keeps pokedex.json a lot smaller. Alternate forms use
 * their own id (Mega Charizard X is 10034), so the same functions cover them.
 *
 * Assets come from PokéAPI's own sprite and cry repositories.
 */

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
const CRIES = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest'

export type SpriteStyle = 'artwork' | 'home' | 'showdown'

export interface SpriteStyleInfo {
  value: SpriteStyle
  label: string
  hint: string
  /** Source art is low-resolution and should be scaled without smoothing. */
  pixelated: boolean
}

/**
 * Artwork leads because it is the only set that is sharp and consistent across
 * every generation and every form — the grid is the first thing anyone sees,
 * and an even grid beats a lively one. Animated is a deliberate opt-in: a
 * screenful of GIFs is heavy, never stops moving, and its coverage is uneven.
 */
export const SPRITE_STYLES: SpriteStyleInfo[] = [
  { value: 'artwork', label: 'Artwork', hint: 'Sharp and consistent everywhere', pixelated: false },
  { value: 'home', label: 'HOME', hint: '3D renders — complete coverage', pixelated: false },
  { value: 'showdown', label: 'Animated', hint: 'Animated sprites — some gaps', pixelated: true },
]

export const DEFAULT_SPRITE_STYLE: SpriteStyle = 'artwork'

export const isPixelated = (style: SpriteStyle): boolean =>
  SPRITE_STYLES.find((entry) => entry.value === style)?.pixelated ?? false

const shinyPart = (shiny: boolean) => (shiny ? 'shiny/' : '')

const byStyle: Record<SpriteStyle, (id: number, shiny: boolean) => string> = {
  artwork: (id, shiny) => `${SPRITES}/other/official-artwork/${shinyPart(shiny)}${id}.png`,
  home: (id, shiny) => `${SPRITES}/other/home/${shinyPart(shiny)}${id}.png`,
  showdown: (id, shiny) => `${SPRITES}/other/showdown/${shinyPart(shiny)}${id}.gif`,
}

/** The big render. Used on cards and detail pages. */
export const artwork = (
  id: number,
  shiny = false,
  style: SpriteStyle = DEFAULT_SPRITE_STYLE,
): string => byStyle[style](id, shiny)

/**
 * Where to look next when an image 404s. Coverage is uneven — animated sprites
 * in particular thin out in the newer generations — so every style degrades to
 * one that is complete rather than leaving a hole in the grid.
 */
export function artworkFallbacks(
  id: number,
  shiny = false,
  style: SpriteStyle = DEFAULT_SPRITE_STYLE,
): string[] {
  const chain = [
    byStyle.artwork(id, shiny),
    byStyle.home(id, shiny),
    byStyle.artwork(id, false),
    byStyle.home(id, false),
    pixelSprite(id, shiny),
    pixelSprite(id, false),
  ]
  const current = artwork(id, shiny, style)
  return chain.filter((url) => url !== current)
}

/** The small pixel icon. Used in the team bar and in dense lists. */
export const pixelSprite = (id: number, shiny = false): string =>
  `${SPRITES}/versions/generation-viii/icons/${shinyPart(shiny)}${id}.png`

export const crySrc = (id: number): string => `${CRIES}/${id}.ogg`
