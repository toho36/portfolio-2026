import { useCallback, useEffect, useState, type RefObject } from 'react'
import { clamp, presentProgress, type MotionMode } from '../motion'

interface ScrollProgress {
  progress: number
  mode: MotionMode
  scrollToProgress: (progress: number) => void
}

function trackMetrics(track: HTMLElement) {
  const top = track.getBoundingClientRect().top + window.scrollY
  const travel = Math.max(1, track.offsetHeight - window.innerHeight)
  return { top, travel }
}

export function useScrollProgress(
  trackRef: RefObject<HTMLElement | null>,
  stopCount: number,
  reducedMotion: boolean,
): ScrollProgress {
  const [rawProgress, setRawProgress] = useState(0)

  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const track = trackRef.current
        if (!track) return
        const { top, travel } = trackMetrics(track)
        setRawProgress(clamp((window.scrollY - top) / travel))
      })
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [trackRef])

  const scrollToProgress = useCallback(
    (progress: number) => {
      const track = trackRef.current
      if (!track) return
      const { top, travel } = trackMetrics(track)
      window.scrollTo({
        top: top + clamp(progress) * travel,
        behavior: reducedMotion ? 'auto' : 'smooth',
      })
    },
    [reducedMotion, trackRef],
  )

  return {
    ...presentProgress(rawProgress, stopCount, reducedMotion),
    scrollToProgress,
  }
}
