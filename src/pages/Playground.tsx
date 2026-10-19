import { useEffect, useState, type MouseEvent } from 'react'
import { HotWire } from './HotWire'
import { GiantImpact } from '../playground/GiantImpact'
import '../playground/playground.css'

interface PlaygroundPageProps { readonly onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void }

export function experimentFromHash(hash: string): 'hot-wire' | 'giant-impact' {
  return hash === '#giant-impact' ? 'giant-impact' : 'hot-wire'
}

export function PlaygroundPage({ onNavigate }: PlaygroundPageProps) {
  const [experiment, setExperiment] = useState(() => experimentFromHash(typeof window === 'undefined' ? '' : window.location.hash))

  useEffect(() => {
    const sync = () => setExperiment(experimentFromHash(window.location.hash))
    sync()
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [])

  return (
    <section className="playground-page" aria-labelledby="playground-title">
      <header className="playground-heading">
        <div><h1 id="playground-title">Playground</h1><h2>{experiment === 'hot-wire' ? 'Hot Wire' : 'Giant Impact'}</h2></div>
        <nav aria-label="Experiments">
          <a className="target-link" href="/playground#hot-wire" aria-current={experiment === 'hot-wire' ? 'true' : undefined}>Hot Wire</a>
          <a className="target-link" href="/playground#giant-impact" aria-current={experiment === 'giant-impact' ? 'true' : undefined}>Giant Impact</a>
        </nav>
      </header>
      {experiment === 'hot-wire' ? <HotWire onNavigate={onNavigate} /> : <GiantImpact />}
      <section className="playground-studies" aria-labelledby="playground-studies-title">
        <h2 id="playground-studies-title">Studies</h2>
        <article className="playground-study">
          <img src="/playground/lego-villa-poster.jpg" alt="A lit two-storey villa with a turquoise pool above a bay at blue hour" width="960" height="540" loading="lazy" />
          <div>
            <h3>Lego Villa</h3>
            <p><strong>Idea.</strong> A hero that builds itself as you scroll. The site is cleared at sunset, then a cliffside villa assembles from 258 modular pieces that drop and snap into place, and the lights come on at blue hour.</p>
            <p><strong>Built with.</strong> Blender 5.2 (Cycles, Python-generated scene), Image Gen 2 background plates, a 192-frame WebP sequence on canvas, and a native-scroll conductor with focal stops.</p>
            <a className="target-link" href="/playground/lego-villa/index.html">Open full screen <span aria-hidden="true">↗</span></a>
          </div>
        </article>
      </section>
    </section>
  )
}
