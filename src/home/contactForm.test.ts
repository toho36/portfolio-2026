import { describe, expect, it, vi } from 'vitest'
import { buildContactPayload, sendContact, validateContact } from './contactForm'

const valid = { name: '  Ada  ', email: ' ada@example.com ', topic: 'Project' as const, message: '  A useful message about a project.  ', _honey: '' }

describe('contact form', () => {
  it('trims values and reports field errors', () => {
    expect(validateContact({ ...valid, name: ' ', email: 'not-an-email', message: ' short ' })).toEqual({
      name: 'Name is required.', email: 'Enter a valid email address.', message: 'Message must be 20–4000 characters.',
    })
    expect(validateContact({ ...valid, message: 'x'.repeat(4001) }).message).toBe('Message must be 20–4000 characters.')
    expect(validateContact(valid)).toEqual({})
  })

  it('builds the exact FormSubmit JSON payload', () => {
    expect(buildContactPayload(valid)).toEqual({
      name: 'Ada', email: 'ada@example.com', message: 'A useful message about a project.', topic: 'Project',
      _subject: 'Portfolio: Project from Ada', _template: 'table', _captcha: 'false', _honey: '',
    })
  })

  it('accepts only an explicit true response and handles request errors', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: 'true' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: 'false', message: 'No' }) })
      .mockRejectedValueOnce(new Error('offline'))
    expect(await sendContact(valid, fetcher)).toBe(true)
    expect(fetcher).toHaveBeenCalledWith('https://formsubmit.co/ajax/tohoangviet1998@gmail.com', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(buildContactPayload(valid)),
    })
    expect(await sendContact(valid, fetcher)).toBe(false)
    expect(await sendContact(valid, fetcher)).toBe(false)
  })

  it('pretends success without sending when the honeypot is filled', async () => {
    const fetcher = vi.fn()
    expect(await sendContact({ ...valid, _honey: 'bot' }, fetcher)).toBe(true)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
