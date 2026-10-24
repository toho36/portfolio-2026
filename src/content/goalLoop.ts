export { GOAL_LOOP_HISTORY } from './goalLoopHistory.generated'

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
    "body": "I run software work like a restaurant kitchen: check the order, then the plate. Less rework makes delivery faster.",
    "role": "I set the goal, the rules and the checks. Separate AI agents plan, build, critique and review each change, and a change only passes when every check agrees."
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
      "body": "Write the order before cooking starts.",
      "software": "In software: a written plan with a goal, the files it may change and a stop condition."
    },
    {
      "name": "Head chef",
      "role": "Critic",
      "label": "Station 2 of 5 · Critic",
      "title": "The head chef reads it first.",
      "body": "A second person catches mistakes in the order.",
      "software": "In software: a separate reviewer checks the plan for gaps before coding starts.",
      "catch": "Allergy spotted",
      "note": "Caught before cooking: the recipe missed a nut allergy"
    },
    {
      "name": "Cook",
      "role": "Build",
      "label": "Station 3 of 5 · Build",
      "title": "Cook exactly what was ordered.",
      "body": "Follow the checked ticket. Add nothing extra.",
      "software": "In software: the code follows the reviewed plan, and nothing more."
    },
    {
      "name": "Taste",
      "role": "Check",
      "label": "Station 4 of 5 · Check",
      "title": "Taste before it leaves the station.",
      "body": "Taste and fix, with a set limit on rounds.",
      "software": "In software: tests and checks run every round, with a fixed limit on repair rounds.",
      "catch": "Too salty · fixed",
      "note": "Caught while cooking: too salty, fixed next round"
    },
    {
      "name": "The pass",
      "role": "Review",
      "label": "Station 5 of 5 · Review",
      "title": "Nothing leaves the pass without a yes.",
      "body": "Check every plate. If it cannot be fixed, it is not served, and everyone knows why.",
      "software": "In software: a fresh reviewer confirms the result, or the run stops and says why."
    }
  ],
  "comparison": {
    "label": "Same dish, two kitchens",
    "title": "A dish sent back gets cooked twice.",
    "body": "A returned dish means rework. Goal Loop checks before, during and after cooking to catch problems earlier.",
    "software": "In software terms, the guest is the product owner trying the finished work. An illustration, not a measurement.",
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
    "label": "Full test run · one real change set",
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
    "back": "Back to homepage",
    "next": "Next: GameOnVB"
  }
} as const satisfies {
  readonly hero: Readonly<Record<'label' | 'title' | 'emphasis' | 'body' | 'role', string>>
  readonly pass: Readonly<Record<'label' | 'title' | 'service', string>>
  readonly stations: readonly KitchenStation[]
  readonly comparison: Readonly<Record<string, string>>
  readonly measurement: Readonly<Record<string, string>>
  readonly scene: { readonly ding: string; readonly tickets: readonly string[] }
  readonly navigation: Readonly<Record<'back' | 'next', string>>
}
