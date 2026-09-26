export function createLoader(opts: { steps: readonly string[]; onProgress(p: number): void; onDone(): void; timeoutMs?: number }) {
  const marked = new Set<string>()
  let done = false
  const finish = () => {
    if (done) return
    done = true
    clearTimeout(timeout)
    if (marked.size < opts.steps.length) opts.onProgress(100)
    opts.onDone()
  }
  const timeout = setTimeout(finish, opts.timeoutMs ?? 2500)
  opts.onProgress(0)
  return {
    mark(step: string) {
      if (done || !opts.steps.includes(step) || marked.has(step)) return
      marked.add(step)
      opts.onProgress(Math.round(marked.size / opts.steps.length * 100))
      if (marked.size === opts.steps.length) finish()
    },
    destroy() { done = true; clearTimeout(timeout) },
  }
}
