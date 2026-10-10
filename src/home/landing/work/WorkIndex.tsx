import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { PROJECT_STORIES } from '../../../content/projects'
import { POSTERS } from '../../../content/homePosters'
import type { WorkIndexProps, WorkItem } from '../shared/types'
import { prefersReducedMotion } from '../shared/landingMotion'
import attendancePlayer from '../assets/attendance-player.png'
import attendancePayment from '../assets/attendance-payment.png'
import attendanceArrived from '../assets/attendance-arrived.png'
import { createAttachmentSwap, handleWorkKey, isStickyPreview, STICKY_QUERY } from './workInteraction'
import './work.css'

export const WORK_ITEMS: readonly WorkItem[] = [
  { id: 'solidpixels', title: 'SolidPixels', role: 'CMS, frontend, backend, integrations', context: 'Team', contribution: 'I work with other developers on a CMS platform and client sites: frontend, backend and third-party integrations.', evidence: '', href: '' },
  { id: 'gameonvb', title: 'GameOnVB', role: 'Full-stack developer', context: 'Solo', contribution: PROJECT_STORIES.voleyevents.preview, evidence: PROJECT_STORIES.voleyevents.evidence, href: '/gameonvb' },
  { id: 'screen-switch', title: 'Screen Switch', role: 'Independent macOS developer', context: 'Solo', contribution: PROJECT_STORIES['screen-switch'].preview, evidence: PROJECT_STORIES['screen-switch'].evidence, href: '' },
  { id: 'goal-loop', title: 'Goal Loop', role: '', context: 'Solo', contribution: POSTERS.find(p => p.id === 'goal-loop')!.body, evidence: '', href: '/goal-loop' },
]

export interface SelectedWorkProps extends WorkIndexProps { screenSwitchDemo?: ReactNode }

function Attachment({ item }: { item: WorkItem }) {
  if (item.id === 'gameonvb') return <div className="work-proof">
    <span className="landing-proof-label">Reconstruction with demo data</span>
    <img src={attendancePlayer} width={460} height={170} alt="Demo Player" />
    <div className="work-proof-results"><img src={attendancePayment} width={240} height={100} alt="Spárováno — payment matched" /><img src={attendanceArrived} width={210} height={100} alt="Dorazil — attendance recorded" /></div>
  </div>
  return <div className="work-type-preview">
    <span className="landing-kicker">{item.context} / {item.id === 'solidpixels' ? 'CMS platform' : 'Independent product'}</span>
    <span className="work-type-title">{item.title}</span>
    <p>{item.id === 'solidpixels' ? 'Frontend. Backend. Integrations.' : item.id === 'screen-switch' ? 'Useful windows. Across displays.' : 'Build. Critique. Verify.'}</p>
  </div>
}

function Detail({ item }: { item: WorkItem }) {
  if (item.id === 'solidpixels') return <details className="work-solid-detail" open>
    <summary>Team context & my contribution</summary>
    <dl><div><dt>Context</dt><dd>Team work on a CMS platform and client sites.</dd></div>
      <div><dt>My part</dt><dd>frontend, backend and third-party integrations.</dd></div>
      <div><dt>Team result vs. my part</dt><dd>the platform and the client sites are team work; my contribution is the frontend, backend and integration work within them.</dd></div></dl>
  </details>
  const story = item.id === 'gameonvb' ? PROJECT_STORIES.voleyevents : item.id === 'screen-switch' ? PROJECT_STORIES['screen-switch'] : undefined
  return <><dl>{story && <><div><dt>Constraint</dt><dd>{story.constraint}</dd></div><div><dt>Decision</dt><dd>{story.decision}</dd></div></>}
    {item.evidence && <div><dt>Evidence</dt><dd>{item.evidence}</dd></div>}</dl>
    <div className="landing-detail-links">{(item.href === '/gameonvb' || item.href === '/goal-loop') && <a className="target-link" href={item.href}>View project ↗</a>}{item.id === 'gameonvb' && <a className="target-link" href={PROJECT_STORIES.gameonvb.verifiedUrl}>gameonvb.cz ↗</a>}</div></>
}

export function WorkIndex({ items, coordinator, screenSwitchDemo }: SelectedWorkProps) {
  const instance = useId()
  const [selectedId, setSelectedId] = useState(items[0]?.id)
  const [sticky, setSticky] = useState(false)
  const selected = items.find(item => item.id === selectedId) ?? items[0]
  const list = useRef<HTMLUListElement>(null)
  const attachment = useRef<HTMLDivElement>(null)
  const lastSelection = useRef(selected?.id)

  useLayoutEffect(() => {
    const media = window.matchMedia(STICKY_QUERY)
    const update = () => setSticky(isStickyPreview(window.innerWidth, window.innerHeight))
    update(); media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useLayoutEffect(() => {
    const el = attachment.current
    const changed = lastSelection.current !== selected?.id
    lastSelection.current = selected?.id
    if (!el) return
    const swap = createAttachmentSwap(coordinator, `work-index-${instance}`)
    const rect = el.getBoundingClientRect()
    let visible = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.target === el && entry.isIntersecting)
      if (!visible) swap.dispose()
    })
    observer?.observe(el)
    const unlisten = prefersReducedMotion(reduced => { if (reduced) swap.dispose() })
    if (changed) swap.play(el, visible)
    return () => { observer?.disconnect(); unlisten(); swap.dispose() }
  }, [selected?.id, sticky, coordinator, instance])

  if (!selected) return null
  const panelId = `${instance}-attachment`
  const demo = selected.id === 'screen-switch' && screenSwitchDemo && <div className="work-demo-slot" role="group" aria-label="Screen Switch demonstration">{screenSwitchDemo}</div>
  const panel = <div className="work-preview" id={panelId} role="region" aria-label={`${selected.title} attachment`}>
    <div className="work-preview-frame"><div className="work-attachment" ref={attachment}><Attachment item={selected} /></div></div>
    <div className="work-preview-text"><Detail item={selected} /></div>
    {sticky && demo}
  </div>

  return <section className="landing-work landing-section work-index" id="work" aria-labelledby={`${instance}-title`}>
    <div className="landing-section-heading"><h2 id={`${instance}-title`}><span className="landing-section-number">01</span>Selected work</h2></div>
    <div className={`work-layout${sticky ? ' work-layout-sticky' : ''}`}>
      <ul className="work-list" ref={list} aria-label="Selected projects">
        {items.map((item, index) => <li className={`work-row${item.id === selected.id ? ' work-row-selected' : ''}`} key={item.id}>
          <button type="button" data-work-select aria-pressed={item.id === selected.id} aria-controls={item.id === selected.id ? panelId : undefined}
            onClick={() => setSelectedId(item.id)} onKeyDown={event => {
              const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[data-work-select]') ?? [])
              handleWorkKey(event.key, index, buttons, () => event.preventDefault())
            }}>
            <span className="landing-project-number">{String(index + 1).padStart(2, '0')}</span>
            <span className={`landing-project-name${item.id === 'solidpixels' ? ' work-solid-title' : ''}`}>{item.title}</span>
            <span className="landing-project-kind">{item.context}</span>
            {item.role && <span className="landing-project-role">{item.role}</span>}
            <span className="work-contribution">{item.contribution}</span>
          </button>
          {!sticky && item.id === selected.id && panel}
          {!sticky && item.id === selected.id && demo}
        </li>)}
      </ul>
      {sticky && panel}
    </div>
    <p className="work-announcement" aria-live="polite" aria-atomic="true">Selected: {selected.title}.</p>
    <div className="landing-work-footnote"><span>A real-time 3D skill game.</span><a className="target-link" href="/playground">Playground <span aria-hidden="true">↗</span></a></div>
  </section>
}
