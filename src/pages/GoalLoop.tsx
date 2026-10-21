import { useEffect, useRef, type MouseEvent, type Ref } from 'react'
import { GOAL_LOOP_KITCHEN } from '../content/goalLoop'
import { mountGoalLoopMotion } from './goalLoopMotion'
import './goalLoopKitchen.css'

interface GoalLoopPageProps {
  readonly onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void
  readonly backRef?: Ref<HTMLAnchorElement>
}

export function GoalLoopPage({ onNavigate, backRef }: GoalLoopPageProps) {
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    if (root.current) return mountGoalLoopMotion(root.current)
  }, [])

  return (
    <article className="goal-loop-kitchen" ref={root}>
      <nav className="k-entry-header" aria-label="Goal Loop presentation">
        <a className="target-link" href="/" ref={backRef} onClick={onNavigate}>{GOAL_LOOP_KITCHEN.navigation.back}</a>
      </nav>

 <section className="wrap k-hero" aria-labelledby="goal-loop-title">
  <div className="copy reveal"><p className="label">{GOAL_LOOP_KITCHEN.hero.label}</p><h1 id="goal-loop-title">{GOAL_LOOP_KITCHEN.hero.title}<br /><em>{GOAL_LOOP_KITCHEN.hero.emphasis}</em></h1><p>{GOAL_LOOP_KITCHEN.hero.body}</p><p className="k-role">{GOAL_LOOP_KITCHEN.hero.role}</p></div>
  <svg className="k-scene reveal" viewBox="0 0 520 420" aria-hidden="true">
   <defs>
    <linearGradient id="k-steelg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4f5f5"/><stop offset="1" stopColor="#aab1b3"/></linearGradient>
    <linearGradient id="k-glowg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffc35c" stopOpacity=".75"/><stop offset="1" stopColor="#ffc35c" stopOpacity="0"/></linearGradient>
   </defs>
   <path className="k-glow" d="M284 100H316L372 320H228Z" fill="url(#k-glowg)"/>
   <path className="k-glow" d="M404 100H436L492 320H348Z" fill="url(#k-glowg)"/>
   <rect x="20" y="22" width="250" height="10" rx="5" fill="url(#k-steelg)" stroke="#1f2523" strokeWidth="2"/>
   <g transform="translate(70 30)"><g className="k-tk"><path className="paper" d="M-34 0H34V92L29.75 98 25.5 92 21.25 98 17 92 12.75 98 8.5 92 4.25 98 0 92-4.25 98-8.5 92-12.75 98-17 92-21.25 98-25.5 92-29.75 98-34 92Z"/><text className="tk-text" x="-26" y="20">{GOAL_LOOP_KITCHEN.scene.tickets[0]}</text><text className="tk-text" x="-26" y="44">{GOAL_LOOP_KITCHEN.scene.tickets[1]}</text><text className="tk-text" x="-26" y="62">{GOAL_LOOP_KITCHEN.scene.tickets[2]}</text></g></g>
   <g transform="translate(148 30)"><g className="k-tk" style={{ animationDuration: "5.4s", animationDelay: "-2s" }}><path className="paper" d="M-34 0H34V92L29.75 98 25.5 92 21.25 98 17 92 12.75 98 8.5 92 4.25 98 0 92-4.25 98-8.5 92-12.75 98-17 92-21.25 98-25.5 92-29.75 98-34 92Z"/><text className="tk-text" x="-26" y="20">{GOAL_LOOP_KITCHEN.scene.tickets[3]}</text><text className="tk-text" x="-26" y="44">{GOAL_LOOP_KITCHEN.scene.tickets[4]}</text><text className="tk-text red" x="-26" y="68">{GOAL_LOOP_KITCHEN.scene.tickets[5]}</text><ellipse cx="-4" cy="64" rx="26" ry="11" fill="none" stroke="#c23d27" strokeWidth="2"/></g></g>
   <g transform="translate(226 30)"><g className="k-tk" style={{ animationDuration: "4.1s", animationDelay: "-1s" }}><path className="paper" d="M-34 0H34V92L29.75 98 25.5 92 21.25 98 17 92 12.75 98 8.5 92 4.25 98 0 92-4.25 98-8.5 92-12.75 98-17 92-21.25 98-25.5 92-29.75 98-34 92Z"/><text className="tk-text" x="-26" y="20">{GOAL_LOOP_KITCHEN.scene.tickets[6]}</text><text className="tk-text" x="-26" y="44">{GOAL_LOOP_KITCHEN.scene.tickets[7]}</text><text className="tk-text" x="-26" y="62">{GOAL_LOOP_KITCHEN.scene.tickets[1]}</text></g></g>
   <path d="M300 0V70M420 0V70" stroke="#1f2523" strokeWidth="2"/>
   <path d="M276 98L286 70H314L324 98Z" fill="#6b7471" stroke="#1f2523" strokeWidth="2" strokeLinejoin="round"/><ellipse cx="300" cy="99" rx="16" ry="4" fill="#ffcf70" stroke="#1f2523" strokeWidth="1.5"/>
   <path d="M396 98L406 70H434L444 98Z" fill="#6b7471" stroke="#1f2523" strokeWidth="2" strokeLinejoin="round"/><ellipse cx="420" cy="99" rx="16" ry="4" fill="#ffcf70" stroke="#1f2523" strokeWidth="1.5"/>
   <rect x="10" y="336" width="500" height="70" fill="#dfe2e1" stroke="#1f2523" strokeWidth="2"/><path d="M180 336V406M350 336V406" stroke="#1f2523" strokeWidth="1.5" opacity=".35"/>
   <rect x="0" y="320" width="520" height="16" rx="3" fill="url(#k-steelg)" stroke="#1f2523" strokeWidth="2"/>
   <g className="k-steam"><path d="M345 245c-8-10 8-18 0-30"/><path d="M360 238c-8-10 8-18 0-30"/><path d="M375 245c-8-10 8-18 0-30"/></g>
   <g className="k-hplate"><svg data-plate="" x="300" y="257" width="120" height="64" viewBox="-60 -44 120 64" overflow="visible"></svg></g>
   <g transform="translate(110 320)"><g className="k-bell"><rect x="-30" y="-6" width="60" height="6" rx="2" fill="#6b7471" stroke="#1f2523" strokeWidth="2"/><path d="M-24-6C-24-26-12-34 0-34S24-26 24-6Z" fill="#d2a53c" stroke="#1f2523" strokeWidth="2"/><path d="M-12-26C-8-30-4-31 0-31" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".7"/><rect x="-2.5" y="-44" width="5" height="10" fill="#1f2523"/><circle cy="-46" r="5" fill="#1f2523"/></g></g>
   <text className="k-ding" x="110" y="262" textAnchor="middle">{GOAL_LOOP_KITCHEN.scene.ding}</text>
  </svg>
 </section>

 <section id="kitchen-pass" aria-labelledby="kitchen-pass-title" className="k-pass" data-pass="" data-stage="0">
  <div className="k-pin">
   <div className="k-intro reveal"><p className="label">{GOAL_LOOP_KITCHEN.pass.label}</p><h2 id="kitchen-pass-title">{GOAL_LOOP_KITCHEN.pass.title}</h2></div>
   <div className="k-line">
    <ol className="k-stations">
     <li><svg className="k-ico" viewBox="-30 -30 60 60" aria-hidden="true"><g className="k-ink"><path d="M-13-21H13V19L8.7 15 4.3 19 0 15-4.3 19-8.7 15-13 19Z"/><path d="M-7-11H7M-7-4H7M-7 3H2"/></g></svg><b>{GOAL_LOOP_KITCHEN.stations[0].name}</b><span>{GOAL_LOOP_KITCHEN.stations[0].role}</span></li>
     <li><em className="k-catch">{GOAL_LOOP_KITCHEN.stations[1].catch}</em><svg className="k-ico" viewBox="-30 -30 60 60" aria-hidden="true"><g className="k-ink"><path d="M-13 5C-24 3-23-13-11-12C-10-25 10-25 11-12C23-13 24 3 13 5Z"/><path d="M-13 5V16H13V5M-13 11H13"/></g></svg><b>{GOAL_LOOP_KITCHEN.stations[1].name}</b><span>{GOAL_LOOP_KITCHEN.stations[1].role}</span></li>
     <li><svg className="k-ico" viewBox="-30 -30 60 60" aria-hidden="true"><g className="k-ink"><path d="M-21-6H11C11 6 5 10-5 10S-21 6-21-6Z"/><path d="M11-3H25"/><path d="M-12 22C-14 18-9 16-9 13C-6 16-5 18-6 22M0 22C-2 18 3 16 3 13C6 16 7 18 6 22"/></g></svg><b>{GOAL_LOOP_KITCHEN.stations[2].name}</b><span>{GOAL_LOOP_KITCHEN.stations[2].role}</span></li>
     <li><em className="k-catch">{GOAL_LOOP_KITCHEN.stations[3].catch}</em><svg className="k-ico" viewBox="-30 -30 60 60" aria-hidden="true"><g className="k-ink"><ellipse cx="-9" cy="-9" rx="8" ry="11" transform="rotate(-45 -9 -9)" style={{ fill: "currentColor" }}/><path d="M-22 6c-3 4 3 4 0 0" /><path d="M-3-3L19 19"/></g></svg><b>{GOAL_LOOP_KITCHEN.stations[3].name}</b><span>{GOAL_LOOP_KITCHEN.stations[3].role}</span></li>
     <li><svg className="k-ico" viewBox="-30 -30 60 60" aria-hidden="true"><g className="k-ink"><path d="M-16 8C-16-7-8-13 0-13S16-7 16 8Z"/><path d="M-20 8H20V13H-20ZM0-13V-18M-4-19H4"/></g></svg><b>{GOAL_LOOP_KITCHEN.stations[4].name}</b><span>{GOAL_LOOP_KITCHEN.stations[4].role}</span></li>
    </ol>
    <div className="k-counter"><div className="k-mover" aria-hidden="true"><span className="k-service">{GOAL_LOOP_KITCHEN.pass.service}</span><svg data-plate="" viewBox="-60 -44 120 64"></svg></div></div>
   </div>
   <div className="k-panes">
    {GOAL_LOOP_KITCHEN.stations.map((station, index) => (
      <div className={`k-pane${index === 0 ? ' on' : ''}`} key={station.role}>
        <p className="label">{station.label}</p><h2>{station.title}</h2>
        <p>{station.body}</p>
        {'note' in station && <p className="note">{station.note}</p>}
        <p className="soft">{station.software}</p>
      </div>
    ))}
   </div>
  </div>
 </section>

 <section className="wrap k-cmp" aria-labelledby="kitchen-comparison-title">
  <div className="head reveal"><p className="label">{GOAL_LOOP_KITCHEN.comparison.label}</p><h2 id="kitchen-comparison-title">{GOAL_LOOP_KITCHEN.comparison.title}</h2><p>{GOAL_LOOP_KITCHEN.comparison.body}</p></div>
  <div className="k-race">
  <div className="k-lane reveal"><span className="name">{GOAL_LOOP_KITCHEN.comparison.classic}</span><div><div className="k-bar"><svg className="k-dish classic" data-plate="" viewBox="-60 -44 120 64" aria-hidden="true"></svg><span className="k-tag sent">{GOAL_LOOP_KITCHEN.comparison.sent}</span><span className="k-tag late">{GOAL_LOOP_KITCHEN.comparison.late}</span><div className="k-seg" style={{ left: "0", width: "46%" }}><span>{GOAL_LOOP_KITCHEN.comparison.cook}</span></div><div className="k-seg serve" style={{ left: "46%", width: "12%", transitionDelay: ".3s" }}><span>{GOAL_LOOP_KITCHEN.comparison.serve}</span></div><div className="k-seg back" style={{ left: "58%", width: "34%", transitionDelay: ".6s" }}><span>{GOAL_LOOP_KITCHEN.comparison.again}</span></div></div><p className="k-legend"><span><i style={{ background: "var(--steel-d)" }}></i>{GOAL_LOOP_KITCHEN.comparison.cook}</span><span><i style={{ background: "var(--steel)" }}></i>{GOAL_LOOP_KITCHEN.comparison.serve}</span><span><i style={{ background: "var(--tomato)" }}></i>{GOAL_LOOP_KITCHEN.comparison.again}</span></p></div></div>
  <div className="k-lane reveal"><span className="name">{GOAL_LOOP_KITCHEN.comparison.loop}</span><div><div className="k-bar"><svg className="k-dish loop" data-plate="" viewBox="-60 -44 120 64" aria-hidden="true"></svg><span className="k-tag served">{GOAL_LOOP_KITCHEN.comparison.served}</span><div className="k-seg read" style={{ left: "0", width: "10%" }}><span>{GOAL_LOOP_KITCHEN.comparison.read}</span></div><div className="k-seg shift" style={{ left: "10%", width: "36%", transitionDelay: ".3s" }}><span>{GOAL_LOOP_KITCHEN.comparison.taste}</span></div><div className="k-seg read" style={{ left: "46%", width: "12%", transitionDelay: ".6s" }}><span>{GOAL_LOOP_KITCHEN.comparison.pass}</span></div></div><p className="k-legend"><span><i style={{ background: "var(--basil)" }}></i>{GOAL_LOOP_KITCHEN.comparison.checks}</span><span><i style={{ background: "var(--steel-d)" }}></i>{GOAL_LOOP_KITCHEN.comparison.taste}</span></p></div></div>
  </div>
  <p className="soft reveal">{GOAL_LOOP_KITCHEN.comparison.software}</p>
 </section>

 <section className="wrap k-wait reveal" aria-labelledby="kitchen-wait-title">
  <p className="label">{GOAL_LOOP_KITCHEN.measurement.label}</p>
  <h2 id="kitchen-wait-title">{GOAL_LOOP_KITCHEN.measurement.title}</h2>
  <div className="k-row"><span className="name">{GOAL_LOOP_KITCHEN.measurement.before}</span><div className="k-tbar"><i></i></div><b>{GOAL_LOOP_KITCHEN.measurement.initial}</b></div>
  <div className="k-row"><span className="name">{GOAL_LOOP_KITCHEN.measurement.after}</span><div className="k-tbar new"><i></i></div><b><span data-down="">{GOAL_LOOP_KITCHEN.measurement.initial}</span><svg className="k-wbell" viewBox="-24 -26 48 36" aria-hidden="true"><g className="k-ink"><path d="M-16 4C-16-11-8-17 0-17S16-11 16 4Z"/><path d="M-20 4H20V8H-20ZM0-17V-21"/></g></svg></b></div>
  <p>{GOAL_LOOP_KITCHEN.measurement.body}</p>
  <p className="soft">{GOAL_LOOP_KITCHEN.measurement.software}<br />{GOAL_LOOP_KITCHEN.measurement.source}</p>
 </section>

      <nav className="k-navigation wrap" aria-label="Case study navigation">
        <a className="target-link" href="/" onClick={onNavigate}>{GOAL_LOOP_KITCHEN.navigation.back}</a>
        <a className="target-link" href="/#contact" onClick={onNavigate}>Get in touch <span aria-hidden="true">↗</span></a>
        <a className="target-link" href="/gameonvb" onClick={onNavigate}>{GOAL_LOOP_KITCHEN.navigation.next}</a>
      </nav>
    </article>
  )
}
