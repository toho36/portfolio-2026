import { useEffect, useRef, useState, type FormEvent } from 'react'
import { sendContact, validateContact, type ContactErrors, type ContactValues } from './contactForm'

interface ContactState {
  values: ContactValues
  errors: ContactErrors
  sending: boolean
  sent: boolean
  submitError: 'send' | 'rate' | null
}

function initialState(): ContactState {
  return { values: { name: '', email: '', topic: '', message: '', _honey: '' }, errors: {}, sending: false, sent: false, submitError: null }
}

// The hook and render-free tests use the same controller; no React hooks are mocked.
export function createContactFormController(onChange: (state: ContactState) => void) {
  let state = initialState()
  const nameRef = { current: null as HTMLInputElement | null }
  const emailRef = { current: null as HTMLInputElement | null }
  const messageRef = { current: null as HTMLTextAreaElement | null }
  const successRef = { current: null as HTMLParagraphElement | null }

  function change(patch: Partial<ContactState>) {
    state = { ...state, ...patch }
    onChange(state)
  }

  function update<K extends keyof ContactValues>(field: K, value: ContactValues[K]) {
    change({ values: { ...state.values, [field]: value }, errors: { ...state.errors, [field]: undefined }, submitError: null })
  }

  async function submit(event: Pick<FormEvent<HTMLFormElement>, 'preventDefault'>) {
    event.preventDefault()
    if (state.sending) return
    const { values } = state
    if (values._honey.trim()) { change({ sent: true }); return }
    const found = validateContact(values)
    change({ errors: found })
    if (found.name || found.email || found.message) {
      if (found.name) nameRef.current?.focus()
      else if (found.email) emailRef.current?.focus()
      else messageRef.current?.focus()
      return
    }
    try {
      if (Date.now() - Number(localStorage.getItem('portfolioContactSentAt')) < 60_000) {
        change({ submitError: 'rate' })
        return
      }
    } catch { /* Storage is optional. */ }
    change({ sending: true, submitError: null })
    const success = await sendContact(values)
    if (success) {
      try { localStorage.setItem('portfolioContactSentAt', String(Date.now())) } catch { /* Storage is optional. */ }
      change({ sent: true })
    } else change({ submitError: 'send' })
    change({ sending: false })
  }

  return { get state() { return state }, update, submit, nameRef, emailRef, messageRef, successRef }
}

export function useContactForm() {
  const [state, setState] = useState(initialState)
  const controllerRef = useRef<ReturnType<typeof createContactFormController> | null>(null)
  if (!controllerRef.current) controllerRef.current = createContactFormController(setState)
  const { update, submit, nameRef, emailRef, messageRef, successRef } = controllerRef.current
  useEffect(() => { if (state.sent) successRef.current?.focus() }, [state.sent, successRef])
  return { ...state, update, submit, nameRef, emailRef, messageRef, successRef }
}
