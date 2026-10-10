import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { PracticeSection, ContactSection } from '../../../src/home/landing/practice'
import { createDominantMotion } from '../../../src/home/landing/shared/landingMotion'
import '../../../src/home/landing/shared/tokens.css'
import '../../../src/home/landing/landing.css'

const coordinator = createDominantMotion()
const introduction = 'I work alone on my own products and with other developers at SolidPixels. I adopt new tools early and hold their output to the same standard as my own: every change is checked before it ships. Goal Loop is how I run that process.'
const gates = ['Plan', 'Critique', 'Build', 'Check', 'Review', 'Verdict'].map((label) => ({ id: label.toLowerCase(), label, evidence: '' }))

function Preview() {
  useEffect(() => () => coordinator.dispose(), [])
  return <div className="landing-page"><main><PracticeSection introduction={introduction} gates={gates} coordinator={coordinator} /><ContactSection /></main></div>
}

createRoot(document.getElementById('root')!).render(<Preview />)
