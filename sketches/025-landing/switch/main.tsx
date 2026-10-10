import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ScreenSwitch } from '../../../src/home/landing/switch/ScreenSwitch'
import { dominantMotion, disposeDominantMotion } from '../../../src/home/landing/shared/landingMotion'
import '../../../src/home/landing/shared/tokens.css'
import '../../../src/home/landing/landing.css'

function Preview() {
  const coordinator = dominantMotion()
  useEffect(() => () => disposeDominantMotion(), [])
  return <div className="landing-page"><main className="landing-section landing-switch-preview">
    <ScreenSwitch coordinator={coordinator} screens={['Left display', 'Right display']} illustrationLabel="Illustration of the feature" />
  </main></div>
}

createRoot(document.getElementById('root')!).render(<Preview />)
