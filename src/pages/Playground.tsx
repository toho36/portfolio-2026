import type { MouseEvent } from 'react'
import { HotWire } from './HotWire'
import '../playground/playground.css'

interface PlaygroundPageProps { readonly onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void }

// Giant Impact stays in src/playground but is hidden: it loaded too slowly for the page (owner, 2026-10-20).
export function PlaygroundPage({ onNavigate }: PlaygroundPageProps) {
  return (
    <section className="playground-page" aria-labelledby="playground-title">
      <header className="playground-heading">
        <div><h1 id="playground-title">Playground</h1><h2>Hot Wire</h2></div>
      </header>
      <HotWire onNavigate={onNavigate} />
      <section className="playground-studies" aria-labelledby="playground-studies-title">
        <h2 id="playground-studies-title">Studies</h2>
        <article className="playground-study">
          <img src="/playground/lego-villa-poster.jpg" alt="A lit two-storey villa with a turquoise pool above a bay at blue hour" width="960" height="540" loading="lazy" />
          <div>
            <h3>Villa</h3>
            <p className="playground-study-kind">3D scroll animation</p>
            <p><strong>Idea.</strong> A hero that builds itself as you scroll. The site is cleared at sunset, then a cliffside villa assembles from 258 modular pieces that drop and snap into place, and the lights come on at blue hour.</p>
            <p><strong>Built with.</strong> Blender 5.2 (Cycles, Python-generated scene), Image Gen 2 background plates, a 192-frame WebP sequence on canvas, and a native-scroll conductor with focal stops.</p>
            <a className="target-link" href="/playground/lego-villa/index.html">Open full screen <span aria-hidden="true">↗</span></a>
          </div>
        </article>
      </section>
    </section>
  )
}
