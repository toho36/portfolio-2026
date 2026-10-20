export { GOAL_LOOP_HISTORY } from './goalLoopHistory.generated'

export type GoalLoopStageId =
  | 'plan'
  | 'critique'
  | 'implementation'
  | 'checks'
  | 'review'
  | 'outcome'

export interface GoalLoopStage {
  readonly id: GoalLoopStageId
  readonly label: string
  readonly role: string
  readonly marker: string
  readonly input: string
  readonly decision: string
  readonly evidence: string
  readonly stop: string
}

export const GOAL_LOOP_STAGES: readonly GoalLoopStage[] = [
  {
    id: 'plan',
    label: 'Plan',
    role: 'Planner',
    marker: 'Bounded',
    input:
      'A scoped software goal, explicit constraints, authorized files and named checks.',
    decision:
      'Turn the requested outcome into a finite implementation path with acceptance evidence.',
    evidence:
      'A reviewable plan connects each acceptance claim to a source change or a later check.',
    stop:
      'Do not begin implementation while scope, dependencies or proof remain ambiguous.',
  },
  {
    id: 'critique',
    label: 'Independent critique',
    role: 'Independent critic',
    marker: 'Independent',
    input:
      'The plan, repository constraints and acceptance evidence map.',
    decision:
      'Challenge missing cases, weak proof and unsafe shortcuts before product code changes.',
    evidence:
      'Concrete corrections name the affected seam and the evidence needed to close it.',
    stop:
      'Return the plan for revision when a material gap is found; block if the gap cannot be bounded.',
  },
  {
    id: 'implementation',
    label: 'Implementation',
    role: 'Implementer',
    marker: 'Isolated',
    input:
      'An admitted plan, the current checkout and a literal repair surface.',
    decision:
      'Make the smallest cohesive change that satisfies the goal and inherited invariants.',
    evidence:
      'The candidate diff, focused assertions and unchanged sibling contracts show what moved.',
    stop:
      'Stop on out-of-scope work, protected state, missing authority or an unrecoverable conflict.',
  },
  {
    id: 'checks',
    label: 'Deterministic checks',
    role: 'Deterministic check suite',
    marker: 'Repeatable',
    input:
      'The isolated candidate and the project checks declared before implementation.',
    decision:
      'Accept only reproducible evidence from tests, type analysis, build integrity and diff hygiene.',
    evidence:
      'Recorded check exits establish whether the candidate meets the declared mechanical gates.',
    stop:
      'Any failing check rejects the candidate and returns the defect to implementation within the revision bound.',
  },
  {
    id: 'review',
    label: 'Independent review',
    role: 'Independent reviewer',
    marker: 'Evidence-led',
    input:
      'The candidate diff, check evidence, goal and preserved invariants.',
    decision:
      'Judge correctness, scope, accessibility and proof without inheriting the implementer conclusion.',
    evidence:
      'A pass or a specific finding ties the verdict back to the code and acceptance contract.',
    stop:
      'A material finding returns to implementation; repeated unchanged evidence blocks the run.',
  },
  {
    id: 'outcome',
    label: 'Pass or block',
    role: 'Stop gate',
    marker: 'Fail closed',
    input:
      'Check exits, review verdict, revision history and the original delivery boundary.',
    decision:
      'Pass only when every gate agrees; otherwise preserve the work as evidence and block delivery.',
    evidence:
      'The final state records why the candidate is eligible for handoff or why no candidate was applied.',
    stop:
      'The run ends at a verified pass, an exhausted revision bound or a blocker requiring new authority.',
  },
] as const

export interface KitchenStation {
  readonly name: string
  readonly role: string
  readonly label: string
  readonly title: string
  readonly body: string
  readonly software: string
  readonly catch?: string
  readonly note?: string
}

/** Owner-approved kitchen story; measurements describe the single audited change set. */
export const GOAL_LOOP_KITCHEN = {
  "hero": {
    "label": "Goal Loop · how I deliver software",
    "title": "Quality first.",
    "emphasis": "Speed follows.",
    "body": "I run software work like a good restaurant kitchen. Every order is read, cooked, tasted and checked before it leaves the pass. The speed comes from having less to redo."
  },
  "pass": {
    "label": "The pass · where plates are checked",
    "title": "From order to plate.",
    "service": "Service!"
  },
  "stations": [
    {
      "name": "Ticket",
      "role": "Plan",
      "label": "Station 1 of 5 · Plan",
      "title": "Every order starts on a ticket.",
      "body": "What to make, what must not go in, and when it is done. Written down before anyone starts.",
      "software": "In software: a written plan with a goal, the files it may change and a stop condition."
    },
    {
      "name": "Head chef",
      "role": "Critic",
      "label": "Station 2 of 5 · Critic",
      "title": "The head chef reads it first.",
      "body": "A second person checks the order before any cooking starts. A mistake found on paper costs a minute, not a dinner.",
      "software": "In software: a separate reviewer checks the plan for gaps before coding starts.",
      "catch": "Allergy spotted",
      "note": "Caught: the recipe missed a nut allergy"
    },
    {
      "name": "Cook",
      "role": "Build",
      "label": "Station 3 of 5 · Build",
      "title": "Cook exactly what was ordered.",
      "body": "The cook follows the checked ticket. Nothing extra goes on the plate.",
      "software": "In software: the code follows the reviewed plan, and nothing more."
    },
    {
      "name": "Taste",
      "role": "Check",
      "label": "Station 4 of 5 · Check",
      "title": "Taste before it leaves the station.",
      "body": "The cook tastes every round. Not right yet? Fix it and taste again, with a set limit on rounds.",
      "software": "In software: tests and checks run every round, with a fixed limit on repair rounds.",
      "catch": "Too salty · fixed",
      "note": "Caught: too salty, fixed next round"
    },
    {
      "name": "The pass",
      "role": "Review",
      "label": "Station 5 of 5 · Review",
      "title": "Nothing leaves the pass without a yes.",
      "body": "The head chef checks every plate. A plate that fails the check goes back to the cook. If it cannot be fixed, it is not served, and everyone knows why.",
      "software": "In software: a fresh reviewer confirms the result, or the run stops and says why."
    }
  ],
  "comparison": {
    "label": "Same dish, two kitchens",
    "title": "A dish sent back gets cooked twice.",
    "body": "In a classic flow, problems often show up late, when the product owner tries the finished work and sends it back. Goal Loop checks before, during and after the cooking, so most problems show up while they are still cheap to fix.",
    "software": "In software terms, the guest is the product owner trying the finished work.",
    "classic": "Classic flow",
    "loop": "Goal Loop",
    "sent": "Sent back",
    "late": "Served late",
    "served": "Served",
    "cook": "Cook",
    "serve": "Serve",
    "again": "Sent back · cook again",
    "read": "Ticket + head chef",
    "taste": "Cook and taste",
    "pass": "The pass",
    "checks": "Checks: ticket, head chef, pass"
  },
  "measurement": {
    "label": "Measured on one real change set",
    "title": "Less waiting for the final check.",
    "before": "Before",
    "after": "After",
    "initial": "39.4 min",
    "final": "4.8 min",
    "body": "On this change set, the full check ran about eight times faster, while the number of checks grew. More checks, less waiting.",
    "software": "In software: full test run, 395 → 403 tests, all passing.",
    "source": "Goal Loop audit · 9 Aug 2026 · one machine"
  },
  "scene": {
    "ding": "Ding!",
    "tickets": [
      "#12 · T4",
      "1× PASTA",
      "1× SALAD",
      "#13 · T7",
      "2× PASTA",
      "NO NUTS",
      "#14 · T2",
      "1× SOUP"
    ]
  },
  "navigation": {
    "back": "← Back to homepage",
    "next": "Next: GameOnVB →"
  }
} as const satisfies {
  readonly hero: Readonly<Record<'label' | 'title' | 'emphasis' | 'body', string>>
  readonly pass: Readonly<Record<'label' | 'title' | 'service', string>>
  readonly stations: readonly KitchenStation[]
  readonly comparison: Readonly<Record<string, string>>
  readonly measurement: Readonly<Record<string, string>>
  readonly scene: { readonly ding: string; readonly tickets: readonly string[] }
  readonly navigation: Readonly<Record<'back' | 'next', string>>
}
