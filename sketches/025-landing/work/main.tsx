import { createRoot } from 'react-dom/client'
import { WorkIndex, WORK_ITEMS } from '../../../src/home/landing/work/WorkIndex'
import { dominantMotion } from '../../../src/home/landing/shared/landingMotion'
import '../../../src/home/landing/shared/tokens.css'
import '../../../src/home/landing/landing.css'

createRoot(document.getElementById('root')!).render(<div className="landing-page"><main><WorkIndex items={WORK_ITEMS} coordinator={dominantMotion()} /></main></div>)
