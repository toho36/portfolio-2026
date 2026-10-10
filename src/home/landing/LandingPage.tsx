import { useEffect, useState } from 'react'
import { Hero } from './hero/Hero'
import { HERO_HEADLINE, HERO_INTRODUCTION, P1_CONTENT } from './hero/content'
import { WorkIndex, WORK_ITEMS } from './work/WorkIndex'
import { ScreenSwitch } from './switch/ScreenSwitch'
import { PracticeSection, ContactSection } from './practice'
import { createDominantMotion } from './shared/landingMotion'
import './shared/tokens.css'
import './landing.css'

const introduction = 'I work alone on my own products and with other developers at SolidPixels. I adopt new tools early and hold their output to the same standard as my own: every change is checked before it ships. Goal Loop is how I run that process.'
const gates = ['Plan', 'Critique', 'Build', 'Check', 'Review', 'Verdict'].map(label => ({ id: label.toLowerCase(), label, evidence: '' }))

export function LandingPage() {
  const [coordinator] = useState(createDominantMotion)
  useEffect(() => () => coordinator.dispose(), [coordinator])

  return <div className="landing-composition">
    <Hero coordinator={coordinator} headline={HERO_HEADLINE} introduction={HERO_INTRODUCTION} lifecycle={P1_CONTENT} />
    <WorkIndex coordinator={coordinator} items={WORK_ITEMS} screenSwitchDemo={<ScreenSwitch coordinator={coordinator} screens={['Left display', 'Right display']} illustrationLabel="Illustration of the feature" />} />
    <PracticeSection coordinator={coordinator} introduction={introduction} gates={gates} />
    <ContactSection />
  </div>
}
