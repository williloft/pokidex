/**
 * Sprite and cry URLs are derivable from a Pokémon's id, so we don't store them
 * in the index — that keeps pokedex.json a lot smaller. Alternate forms use
 * their own id (Mega Charizard X is 10034), so the same functions cover them.
 *
 * Assets come from PokéAPI's own sprite and cry repositories.
 *
 * Official artwork is the only set used: it is the one that is sharp and
 * consistent across every generation and every form, and an even grid beats a
 * livelier but patchier one.
 */

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
const CRIES = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest'

const shinyPart = (shiny: boolean) => (shiny ? 'shiny/' : '')

/** The big render. Used on cards and detail pages. */
export const artwork = (id: number, shiny = false): string =>
  `${SPRITES}/other/official-artwork/${shinyPart(shiny)}${id}.png`

const homeRender = (id: number, shiny: boolean) =>
  `${SPRITES}/other/home/${shinyPart(shiny)}${id}.png`

/**
 * Where to look next when an image 404s. A handful of forms have no official
 * artwork, so they fall back to a HOME render and finally to the pixel icon
 * rather than leaving a hole in the grid.
 */
export function artworkFallbacks(id: number, shiny = false): string[] {
  return [
    homeRender(id, shiny),
    artwork(id, false),
    homeRender(id, false),
    pixelSprite(id, shiny),
    pixelSprite(id, false),
  ]
}

/** The small pixel icon. Used in the team bar and in dense lists. */
export const pixelSprite = (id: number, shiny = false): string =>
  `${SPRITES}/versions/generation-viii/icons/${shinyPart(shiny)}${id}.png`

export const crySrc = (id: number): string => `${CRIES}/${id}.ogg`
