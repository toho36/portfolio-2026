import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Hero } from '../../../src/home/landing/hero/Hero'
import { HERO_HEADLINE, HERO_INTRODUCTION, P1_CONTENT } from '../../../src/home/landing/hero/content'
import { createDominantMotion } from '../../../src/home/landing/shared/landingMotion'
import '../../../src/home/landing/shared/tokens.css'
import '../../../src/home/landing/landing.css'

function Preview() {
  const [coordinator, setCoordinator] = useState<ReturnType<typeof createDominantMotion> | null>(null)
  useEffect(() => {
    const instance = createDominantMotion()
    setCoordinator(instance)
    return () => instance.dispose()
  }, [])
  return <div className="landing-page"><main>{coordinator && <Hero coordinator={coordinator} headline={HERO_HEADLINE} introduction={HERO_INTRODUCTION} lifecycle={P1_CONTENT} />}</main></div>
}
createRoot(document.getElementById('root')!).render(<StrictMode><Preview /></StrictMode>)
