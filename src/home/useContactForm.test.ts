import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createContactFormController } from './useContactForm'
import { sendContact } from './contactForm'

vi.mock('./contactForm', async (original) => ({ ...await original<typeof import('./contactForm')>(), sendContact: vi.fn() }))

const event = () => ({ preventDefault: vi.fn() })
function form(valid = false) {
  const controller = createContactFormController(() => {})
  for (const ref of [controller.nameRef, controller.emailRef, controller.messageRef]) {
    ref.current = { focus: vi.fn() } as unknown as HTMLInputElement
  }
  if (valid) {
    controller.update('name', 'Vitek')
    controller.update('email', 'vitek@example.com')
    controller.update('message', 'A sufficiently long project message.')
  }
  return controller
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('shared contact controller', () => {
  it('starts with no topic selected', () => {
    expect(form().state.values.topic).toBe('')
  })
  it('focuses name, then email, then message as earlier errors are fixed', async () => {
    const c = form()
    await c.submit(event())
    expect(c.nameRef.current!.focus).toHaveBeenCalledOnce()
    expect(c.state.errors.name).toBe('Name is required.')
    c.update('name', 'Vitek')
    expect(c.state.errors.name).toBeUndefined()
    await c.submit(event())
    expect(c.emailRef.current!.focus).toHaveBeenCalledOnce()
    c.update('email', 'vitek@example.com')
    await c.submit(event())
    expect(c.messageRef.current!.focus).toHaveBeenCalledOnce()
    expect(sendContact).not.toHaveBeenCalled()
  })
  it('accepts honeypot before validation or storage without sending', async () => {
    const c = form()
    c.update('_honey', 'bot')
    await c.submit(event())
    expect(c.state.sent).toBe(true)
    expect(sendContact).not.toHaveBeenCalled()
    expect(localStorage.getItem).not.toHaveBeenCalled()
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })
  it('blocks until the 60-second boundary and clears the error on update', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(100_000)
    vi.mocked(localStorage.getItem).mockReturnValue('40001')
    const c = form(true)
    await c.submit(event())
    expect(c.state.submitError).toBe('rate')
    expect(sendContact).not.toHaveBeenCalled()
    c.update('topic', 'Role')
    expect(c.state.submitError).toBeNull()
    vi.mocked(localStorage.getItem).mockReturnValue('40000')
    vi.mocked(sendContact).mockResolvedValue(true)
    await c.submit(event())
    expect(c.state.sent).toBe(true)
  })
  it('waits for success, guards duplicate submits and saves the timestamp', async () => {
    let resolve!: (success: boolean) => void
    vi.mocked(sendContact).mockReturnValue(new Promise((done) => { resolve = done }))
    const c = form(true)
    const pending = c.submit(event())
    expect(c.state.sending).toBe(true)
    expect(c.state.sent).toBe(false)
    await c.submit(event())
    expect(sendContact).toHaveBeenCalledExactlyOnceWith(c.state.values)
    resolve(true)
    await pending
    expect(c.state.sent).toBe(true)
    expect(c.state.sending).toBe(false)
    expect(localStorage.setItem).toHaveBeenCalledWith('portfolioContactSentAt', expect.any(String))
  })
  it('shows failure without a timestamp and allows a retry', async () => {
    vi.mocked(sendContact).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const c = form(true)
    await c.submit(event())
    expect(c.state.submitError).toBe('send')
    expect(c.state.sent).toBe(false)
    expect(c.state.sending).toBe(false)
    expect(localStorage.setItem).not.toHaveBeenCalled()
    await c.submit(event())
    expect(c.state.sent).toBe(true)
    expect(c.state.submitError).toBeNull()
  })
  it('still succeeds when storage is unavailable', async () => {
    vi.mocked(localStorage.getItem).mockImplementation(() => { throw new Error('denied') })
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error('denied') })
    vi.mocked(sendContact).mockResolvedValue(true)
    const c = form(true)
    await c.submit(event())
    expect(c.state.sent).toBe(true)
    expect(c.state.sending).toBe(false)
  })
})
