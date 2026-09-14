import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const STORAGE_KEY = 'pokedex:scroll'
/** How long to keep re-applying while the virtualised list grows. */
const RESTORE_WINDOW_MS = 1200

/**
 * Jump, never glide.
 *
 * The stylesheet sets `scroll-behavior: smooth`, which is right for anchor
 * links and wrong for everything here: each call would start a fresh animation
 * from wherever the last one had got to, so a retry loop ends up racing its own
 * easing curve and stopping short.
 */
const jumpTo = (top: number): void => {
  window.scrollTo({ top, left: 0, behavior: 'instant' as ScrollBehavior })
}

type Positions = Record<string, number>

function readAll(): Positions {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') as Positions
  } catch {
    return {}
  }
}

function save(key: string, offset: number): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [key]: offset }))
  } catch {
    // Nothing to restore next time; not worth breaking navigation over.
  }
}

/**
 * Remember where you were in the grid.
 *
 * The browser's own restoration gives up here: the list is virtualised, so at
 * the moment it tries to scroll, the document is only as tall as the first
 * screen of rows and the target offset does not exist yet. So we save the
 * position per history entry and re-apply it once the page has actually grown
 * tall enough, giving up after a few frames rather than fighting the user.
 */
export function useScrollRestoration(ready: boolean): void {
  const location = useLocation()
  const navigationType = useNavigationType()

  // The browser's own restoration races ours and wins at the wrong moment,
  // landing short because the virtualised list is still short. Take the wheel.
  useEffect(() => {
    if (!('scrollRestoration' in history)) return
    const previous = history.scrollRestoration
    history.scrollRestoration = 'manual'
    return () => {
      history.scrollRestoration = previous
    }
  }, [])

  /*
   * Record while the reader scrolls, and know when to stop.
   *
   * No teardown hook is early enough to read the position on the way out:
   * swapping a tall grid for a short detail page makes the browser clamp
   * scrollY to zero before any cleanup runs, so both a passive effect and a
   * layout effect observe nothing but that zero.
   *
   * The clamp does announce itself, though — the document collapses first. So
   * we watch the height, and the moment it falls away we treat every later
   * event as belonging to the next page and keep the position we already had.
   */
  useLayoutEffect(() => {
    const key = location.key
    let tallest = document.documentElement.scrollHeight

    const record = () => {
      const height = document.documentElement.scrollHeight
      // Skip this sample, but never latch: the height also dips for a frame
      // while the virtualiser swaps rows during a fast scroll, and treating
      // that as "we have left" would freeze the saved position short.
      if (height < tallest / 2) return
      tallest = Math.max(tallest, height)
      save(key, window.scrollY)
    }

    // A click on a link is the earliest honest signal that we are leaving, and
    // it arrives while the current page is still on screen. Capture phase, so
    // it runs before the router gets the event.
    const stamp = () => save(key, window.scrollY)

    window.addEventListener('scroll', record, { passive: true })
    document.addEventListener('click', stamp, true)
    return () => {
      window.removeEventListener('scroll', record)
      document.removeEventListener('click', stamp, true)
    }
  }, [location.key])

  const settled = useRef(false)

  useEffect(() => {
    if (!ready) return

    // The first pass happens once the dex finishes loading, which can land
    // after the reader has already started scrolling. Yanking them back to the
    // top there would undo a deliberate action, so the opening view is left
    // exactly as the browser delivered it.
    if (!settled.current) {
      settled.current = true
      return
    }

    if (navigationType !== 'POP') {
      jumpTo(0)
      return
    }

    const target = readAll()[location.key] ?? 0
    if (target === 0) {
      jumpTo(0)
      return
    }

    let frame = 0
    const deadline = performance.now() + RESTORE_WINDOW_MS

    // The list grows in stages — column count is measured after mount, rows
    // mount as the virtualiser catches up — so a single scrollTo lands short.
    // Keep nudging until the position sticks, then stop.
    const attempt = () => {
      const reachable = document.documentElement.scrollHeight - window.innerHeight
      jumpTo(Math.min(target, Math.max(0, reachable)))

      const onTarget = Math.abs(window.scrollY - target) < 2
      if (onTarget || performance.now() > deadline) return

      frame = requestAnimationFrame(attempt)
    }

    frame = requestAnimationFrame(attempt)
    return () => cancelAnimationFrame(frame)
  }, [location.key, navigationType, ready])
}

/** Keep the tab title in step with what is on screen. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title
    return () => {
      document.title = 'Pokédex'
    }
  }, [title])
}
