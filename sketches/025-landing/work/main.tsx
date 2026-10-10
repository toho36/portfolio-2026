import { createRoot } from 'react-dom/client'
import { WorkIndex, WORK_ITEMS } from '../../../src/home/landing/work/WorkIndex'
import { dominantMotion } from '../../../src/home/landing/shared/landingMotion'
import '../../../src/home/landing/shared/tokens.css'
import '../../../src/home/landing/landing.css'

const demo = <div style={{ height: 420, boxSizing: 'border-box', display: 'grid', placeItems: 'center', padding: 24, border: '1px solid var(--landing-line)', borderRadius: 'var(--landing-radius-panel)', background: 'var(--landing-panel)' }}>
  <p>Screen Switch demo placeholder · 420 px</p>
</div>

createRoot(document.getElementById('root')!).render(<div className="landing-page"><main><WorkIndex items={WORK_ITEMS} coordinator={dominantMotion()} screenSwitchDemo={demo} /></main></div>)
