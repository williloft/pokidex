import { useEffect, useRef, useState } from 'react'
import { artwork, artworkFallbacks } from '../lib/sprites'

interface Props {
  id: number
  alt: string
  shiny: boolean
  size: number
  className?: string
  /** Set only on the one image a view transition should morph. */
  transitionName?: string
  priority?: boolean
}

/**
 * An image that never blinks.
 *
 * Swapping `src` directly makes the browser drop the current frame and show
 * nothing until the replacement arrives — which is very visible when toggling
 * shiny across a screen full of large renders. So the new URL is loaded off to
 * the side first, and only swapped in once it is decoded.
 *
 * It also walks a fallback chain, because a handful of forms have no official
 * artwork and a missing file should degrade to another render, not a hole.
 */
export function Sprite({
  id,
  alt,
  shiny,
  size,
  className,
  transitionName,
  priority = false,
}: Props) {
  const target = artwork(id, shiny)
  const [shown, setShown] = useState(target)
  const [ready, setReady] = useState(false)
  const attempt = useRef(0)

  useEffect(() => {
    let cancelled = false
    const candidates = [target, ...artworkFallbacks(id, shiny)]
    attempt.current = 0

    const tryNext = () => {
      const url = candidates[attempt.current]
      if (!url) {
        // Everything 404'd — keep whatever is on screen rather than blanking.
        if (!cancelled) setReady(true)
        return
      }

      const image = new Image()
      image.onload = () => {
        if (cancelled) return
        setShown(url)
        setReady(true)
      }
      image.onerror = () => {
        if (cancelled) return
        attempt.current += 1
        tryNext()
      }
      image.src = url
    }

    // If the new art is already decoded, swap without a fade.
    const preloaded = new Image()
    preloaded.src = target
    if (preloaded.complete && preloaded.naturalWidth > 0) {
      setShown(target)
      setReady(true)
    } else {
      setReady(false)
      tryNext()
    }

    return () => {
      cancelled = true
    }
  }, [target, id, shiny])

  return (
    <img
      className={['sprite', ready ? 'sprite--ready' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      src={shown}
      alt={alt}
      width={size}
      height={size}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      style={transitionName ? { viewTransitionName: transitionName } : undefined}
    />
  )
}
