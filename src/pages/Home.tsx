import { useState, type MouseEvent } from 'react'
import { FLAGSHIPS, HERO, SIDE_QUESTS } from '../content/systems'
import { Volleyball } from '../components/Volleyball'

const WORLDS = [
  { ...FLAGSHIPS[0], category: 'People / play / operations', caption: 'Less organising. More time on court.' },
  { ...FLAGSHIPS[1], category: 'Build / check / repeat', caption: 'A good system knows when to stop.' },
  { index: '03', name: 'Playground', path: '/playground' as const, summary: 'An experiment in reversible motion and direct response.', category: 'Touch / bend / repeat', caption: 'A place for things that don’t sit still.' },
] as const

export function HomePage({ onNavigate }: {
  readonly onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  const [selected, setSelected] = useState(0)
  const [swapped, setSwapped] = useState(false)
  const world = WORLDS[selected]

  return (
    <div className="home-worlds">
      <section className="world-hero" aria-labelledby="hero-title">
        <div className="world-words">
          <p className="eyebrow">{HERO.eyebrow}</p>
          <h1 id="hero-title"><span>I MAKE</span> <span>THINGS</span> <span>CLICK.</span></h1>
          <p className="world-aside">I’m Hoang Viet To. I build software for real-world problems—and things you’ll want to play with.</p>
        </div>
        <div className="world-selector" role="group" aria-label="Choose a world">
          {WORLDS.map((item, index) => (
            <button className="world-choice" type="button" key={item.path} aria-label={`Select ${item.name}`} aria-pressed={selected === index} onClick={() => setSelected(index)}>
              <span className="world-number">{item.index}</span><strong>{item.name}</strong>
            </button>
          ))}
        </div>
        <div
          className="world-portal"
          data-world={selected}
          onPointerMove={(event) => {
            if (event.pointerType === 'touch') return
            const rect = event.currentTarget.getBoundingClientRect()
            event.currentTarget.style.setProperty('--portal-tilt', `${((event.clientX - rect.left) / rect.width - 0.5) * 16}deg`)
          }}
          onPointerLeave={(event) => event.currentTarget.style.setProperty('--portal-tilt', '0deg')}
        >
          <div className="portal-meta"><span>{world.category}</span><span>{world.index} / 03</span></div>
          <div className="portal-scene" aria-hidden="true">
            {selected === 0 ? <div className="portal-object"><div className="portal-court" /><Volleyball className="portal-ball" /></div> : null}
            {selected === 1 ? <div className="portal-object"><div className="portal-loop" /></div> : null}
            {selected === 2 ? <div className="portal-object"><div className="portal-field">{Array.from({ length: 20 }, (_, index) => <i key={index} />)}</div></div> : null}
          </div>
          <div className="portal-caption">
            <div><h2>{world.name}</h2><p>{world.caption}</p></div>
            <a className="target-link portal-enter" href={world.path} onClick={onNavigate} aria-label={`Explore ${world.name}`}><span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>
      <p className="visually-hidden" aria-live="polite">{world.name} selected.</p>
      <section id="flagships" aria-labelledby="flagships-title" className="world-section">
        <p className="eyebrow">The work behind the play</p>
        <div>
          <h2 id="flagships-title">Useful doesn’t have to feel ordinary.</h2>
          <p className="world-positioning">{HERO.title}</p>
          <div className="world-project-list">
            {FLAGSHIPS.map((project) => <article key={project.path}>
              <span className="world-number">{project.index}</span>
              <div><h3>{project.name}</h3><p>{project.summary}</p></div>
              <a className="target-link" href={project.path} onClick={onNavigate} aria-label={`Read ${project.name}`}><span aria-hidden="true">↗</span></a>
            </article>)}
          </div>
        </div>
      </section>
      <section id="side-quests" aria-labelledby="side-quests-title" className="world-section">
        <p className="eyebrow">Different instincts</p>
        <div><h2 id="side-quests-title">Small tools.<br />Sideways ideas.</h2>
          <div className="world-side-projects">
            {SIDE_QUESTS.map((project) => <article key={project.name}>
              <h3>{project.name}</h3><p>{project.summary}</p>
              {project.name === 'Screen Switch' ? <>
                <div className="display-swap" data-swapped={swapped} aria-hidden="true">
                  <div className="display-monitor"><span className="display-window">A</span></div>
                  <div className="display-monitor"><span className="display-window">B</span></div>
                </div>
                <button className="world-button" type="button" onClick={() => setSwapped(!swapped)} aria-pressed={swapped}>Swap the displays <span aria-hidden="true">↔</span></button>
                <small className="world-demo-note">Interactive illustration. No access to your desktop.</small>
                <span className="visually-hidden" role="status">{swapped ? 'Window A on the right, window B on the left.' : 'Window A on the left, window B on the right.'}</span>
              </> : null}
              {project.url ? <a className="target-link" href={project.url}>Visit {project.name} <span aria-hidden="true">↗</span></a> : null}
            </article>)}
          </div>
        </div>
      </section>
    </div>
  )
}
