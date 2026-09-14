/**
 * Sprite and cry URLs are derivable from a Pokémon's id, so we don't store them
 * in the index — that keeps pokedex.json a lot smaller. Alternate forms use
 * their own id (Mega Charizard X is 10034), so the same functions cover them.
 *
 * Assets come from PokéAPI's own sprite and cry repositories.
 */

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
const CRIES = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest'

export type SpriteStyle = 'home' | 'showdown'

export const SPRITE_STYLES: Array<{ value: SpriteStyle; label: string; hint: string }> = [
  { value: 'home', label: 'HOME', hint: '3D renders — complete coverage' },
  { value: 'showdown', label: 'Animated', hint: 'Animated sprites — some gaps' },
]

const shinyPart = (shiny: boolean) => (shiny ? 'shiny/' : '')

const byStyle: Record<SpriteStyle, (id: number, shiny: boolean) => string> = {
  home: (id, shiny) => `${SPRITES}/other/home/${shinyPart(shiny)}${id}.png`,
  showdown: (id, shiny) => `${SPRITES}/other/showdown/${shinyPart(shiny)}${id}.gif`,
}

const officialArtwork = (id: number, shiny: boolean) =>
  `${SPRITES}/other/official-artwork/${shinyPart(shiny)}${id}.png`

/** The big render. Used on cards and detail pages. */
export const artwork = (id: number, shiny = false, style: SpriteStyle = 'home'): string =>
  byStyle[style](id, shiny)

/**
 * Where to look next when an image 404s. Coverage is uneven — animated sprites
 * in particular thin out in the newer generations — so every style degrades to
 * one that is complete rather than leaving a hole in the grid.
 */
export function artworkFallbacks(id: number, shiny = false, style: SpriteStyle = 'home'): string[] {
  const chain = [
    byStyle.home(id, shiny),
    officialArtwork(id, shiny),
    officialArtwork(id, false),
    pixelSprite(id, shiny),
    pixelSprite(id, false),
  ]
  return chain.filter((url) => url !== artwork(id, shiny, style))
}

/** The small pixel icon. Used in the team bar and in dense lists. */
export const pixelSprite = (id: number, shiny = false): string =>
  `${SPRITES}/versions/generation-viii/icons/${shinyPart(shiny)}${id}.png`

export const crySrc = (id: number): string => `${CRIES}/${id}.ogg`
