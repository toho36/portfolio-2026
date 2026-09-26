export type ContactTopic = 'Role' | 'Project' | 'Other'

export interface ContactValues {
  name: string
  email: string
  topic: ContactTopic
  message: string
  _honey: string
}

export type ContactErrors = Partial<Record<'name' | 'email' | 'message', string>>

export function validateContact(values: ContactValues): ContactErrors {
  const errors: ContactErrors = {}
  if (!values.name.trim()) errors.name = 'Name is required.'
  const email = values.email.trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.'
  const length = values.message.trim().length
  if (length < 20 || length > 4000) errors.message = 'Message must be 20–4000 characters.'
  return errors
}

export function buildContactPayload(values: ContactValues) {
  const name = values.name.trim()
  return {
    name,
    email: values.email.trim(),
    message: values.message.trim(),
    topic: values.topic,
    _subject: `Portfolio: ${values.topic} from ${name}`,
    _template: 'table',
    _captcha: 'false',
    _honey: values._honey,
  }
}

export async function sendContact(values: ContactValues, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (values._honey.trim()) return true
  try {
    const response = await fetcher('https://formsubmit.co/ajax/tohoangviet1998@gmail.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(buildContactPayload(values)),
    })
    return response.ok && (await response.json() as { success?: string }).success === 'true'
  } catch {
    return false
  }
}
