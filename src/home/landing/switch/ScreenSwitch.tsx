import { useEffect, useRef, useState } from 'react'
import type { ScreenSwitchProps } from '../shared/types'
import { createScreenSwitchController } from './screenSwitchController'
import './screenSwitch.css'

export function ScreenSwitch({ coordinator, screens, illustrationLabel, onSwap }: ScreenSwitchProps) {
  const root = useRef<HTMLDivElement>(null)
  const controller = useRef<ReturnType<typeof createScreenSwitchController> | null>(null)
  const [swapped, setSwapped] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  // Keep caller content current without restarting an in-flight swap on a parent render.
  const content = useRef({ screens, onSwap })
  content.current = { screens, onSwap }

  useEffect(() => {
    controller.current = createScreenSwitchController(root.current!, coordinator, (next, complete) => {
      setSwapped(next)
      if (!complete) return
      setAnnouncement(`Window A on the ${next ? 'right' : 'left'} display; Window B on the ${next ? 'left' : 'right'} display.`)
      const { screens: names, onSwap: notify } = content.current
      notify?.(next ? [names[1], names[0]] : names)
    })
    return () => { controller.current?.dispose(); controller.current = null }
  }, [coordinator])

  return <div className="landing-switch" ref={root} data-swapped="false">
    <p className="landing-switch-label">{illustrationLabel}</p>
    <div className="landing-switch-scene" aria-hidden="true">
      {screens.map((name, index) => <div className={`landing-switch-display landing-switch-display-${index}`} key={index}>
        <span className="landing-switch-display-name">{name}</span>
        <span className="landing-switch-stand" />
      </div>)}
      {['A', 'B'].map((name) => <div className={`landing-switch-window landing-switch-window-${name.toLowerCase()}`} key={name}>
        <div className="landing-switch-titlebar"><span className="landing-switch-dots"><i /><i /><i /></span><span>Window {name}</span></div>
        <div className="landing-switch-window-content"><span /><span /><span /></div>
      </div>)}
    </div>
    <button type="button" className="landing-switch-button" aria-label="Swap windows between displays" aria-pressed={swapped} onClick={() => controller.current?.swap()}>
      <span>Swap windows</span><span aria-hidden="true">↔</span>
    </button>
    <span className="landing-switch-status" aria-live="polite" aria-atomic="true">{announcement}</span>
  </div>
}
