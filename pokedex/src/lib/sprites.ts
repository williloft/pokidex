/**
 * Sprite and cry URLs are derivable from the national dex number, so we don't
 * store them in the index — that keeps pokedex.json a lot smaller.
 *
 * Assets are served from PokéAPI's own sprite and cry repositories.
 */

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
const CRIES = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest'

/** The big, high-resolution render. Used on cards and detail pages. */
export const artwork = (id: number, shiny = false): string =>
  `${SPRITES}/other/home/${shiny ? 'shiny/' : ''}${id}.png`

/** The small pixel sprite. Used in the team bar and in dense lists. */
export const pixelSprite = (id: number, shiny = false): string =>
  `${SPRITES}/versions/generation-viii/icons/${shiny ? 'shiny/' : ''}${id}.png`

export const crySrc = (id: number): string => `${CRIES}/${id}.ogg`
