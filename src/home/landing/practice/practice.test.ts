import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({ states: [] as unknown[], refs: [] as { current: any }[], effects: [] as (() => unknown)[], si: 0, ri: 0 }))
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState(initial: unknown) {
    const i = hooks.si++
    if (!(i in hooks.states)) hooks.states[i] = initial
    return [hooks.states[i], (next: any) => { hooks.states[i] = typeof next === 'function' ? next(hooks.states[i]) : next }]
  },
  useRef(initial: unknown) { return hooks.refs[hooks.ri++] ??= { current: initial } },
  useEffect(effect: () => unknown) { hooks.effects.push(effect) },
}))
vi.mock('../../contactForm', async (original) => ({ ...await original<typeof import('../../contactForm')>(), sendContact: vi.fn() }))
import { sendContact } from '../../contactForm'
import { ContactSection } from './ContactSection'
import { mountGateReveal } from './gateReveal'
import { createDominantMotion } from '../shared/landingMotion'

type El = { type: unknown; props: Record<string, any> }
function all(node: any): El[] {
  if (Array.isArray(node)) return node.flatMap(all)
  if (!node || typeof node !== 'object' || !node.props) return []
  return [node, ...all(node.props.children)]
}
function render() {
  hooks.si = hooks.ri = 0; hooks.effects = []
  const nodes = all(ContactSection())
  for (const node of nodes) if (node.props.ref) node.props.ref.current = { focus: vi.fn() }
  hooks.effects.forEach((effect) => effect())
  return nodes
}
function field(nodes: El[], name: string) { return nodes.find((node) => node.props.name === name)! }
function valid() {
  let nodes = render()
  for (const [name, value] of Object.entries({ name: 'Vitek', email: 'vitek@example.com', message: 'A sufficiently long project message.' })) {
    field(nodes, name).props.onChange({ target: { value } }); nodes = render()
  }
  return nodes
}
function submit(nodes: El[]) { return nodes.find((node) => node.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() }) }

beforeEach(() => {
  hooks.states = []; hooks.refs = []; vi.clearAllMocks()
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() })
})
afterEach(() => vi.unstubAllGlobals())

describe('contact wiring', () => {
  it('validates and focuses the first invalid field without sending', async () => {
    let nodes = render(); const focus = field(nodes, 'name').props.ref.current.focus
    await submit(nodes)
    expect(focus).toHaveBeenCalledOnce()
    expect(sendContact).not.toHaveBeenCalled()
    nodes = render()
    expect(field(nodes, 'name').props['aria-invalid']).toBe(true)
    expect(field(nodes, 'email').props['aria-describedby']).toBe('landing-email-error')
  })
  it('waits for actual success, blocks duplicate submission, and keeps email/CV links', async () => {
    let resolve!: (success: boolean) => void
    vi.mocked(sendContact).mockReturnValue(new Promise((done) => { resolve = done }))
    const pending = submit(valid())
    let nodes = render()
    expect(nodes.some((node) => node.props.className === 'landing-contact-success')).toBe(false)
    expect(nodes.find((node) => node.type === 'button')!.props.disabled).toBe(true)
    await submit(nodes)
    expect(sendContact).toHaveBeenCalledExactlyOnceWith({ name: 'Vitek', email: 'vitek@example.com', topic: 'Project', message: 'A sufficiently long project message.', _honey: '' })
    resolve(true); await pending
    nodes = render()
    const success = nodes.find((node) => node.props.className === 'landing-contact-success')!
    expect(success.props['aria-live']).toBe('polite')
    expect(success.props.ref.current.focus).toHaveBeenCalledOnce()
    expect(localStorage.setItem).toHaveBeenCalledWith('portfolioContactSentAt', expect.any(String))
    expect(nodes.filter((node) => node.type === 'a').map((node) => node.props.href)).toContain('/hoang-viet-to-cv-en.docx')
    expect(nodes.filter((node) => node.type === 'a').map((node) => node.props.href)).toContain('mailto:tohoangviet1998@gmail.com')
  })
  it('shows send failure without success or rate timestamp and allows retry', async () => {
    vi.mocked(sendContact).mockResolvedValue(false)
    await submit(valid())
    const nodes = render()
    expect(nodes.some((node) => node.props.role === 'alert')).toBe(true)
    expect(nodes.some((node) => node.props.className === 'landing-contact-success')).toBe(false)
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(nodes.find((node) => node.type === 'button')!.props.disabled).toBe(false)
  })
  it('preserves the one-minute rate gate', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(String(Date.now()))
    await submit(valid())
    expect(sendContact).not.toHaveBeenCalled()
    expect(render().find((node) => node.props.role === 'alert')!.props.children).toContain('Please wait a minute')
  })
  it('silently accepts the honeypot without a network call', async () => {
    const nodes = render(); field(nodes, '_honey').props.onChange({ target: { value: 'bot' } })
    await submit(render())
    expect(sendContact).not.toHaveBeenCalled()
    expect(render().some((node) => node.props.className === 'landing-contact-success')).toBe(true)
  })
  it('still sends when storage is unavailable', async () => {
    vi.mocked(localStorage.getItem).mockImplementation(() => { throw new Error('denied') })
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error('denied') })
    vi.mocked(sendContact).mockResolvedValue(true)
    await submit(valid())
    expect(render().some((node) => node.props.className === 'landing-contact-success')).toBe(true)
  })
})

it('reduced motion leaves the full gate rail visible without loading animation', async () => {
  const media = Object.assign(new EventTarget(), { matches: true })
  vi.stubGlobal('window', { matchMedia: () => media })
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }))
  const coordinator = createDominantMotion()
  const rail = { style: { transform: '' } } as HTMLElement
  const dispose = mountGateReveal({} as HTMLElement, rail, coordinator)
  await dispose.ready
  expect(rail.style.transform).toBe('scaleX(1)')
  expect(coordinator.currentId()).toBeUndefined()
  dispose(); coordinator.dispose()
})
