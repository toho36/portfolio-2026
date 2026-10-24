/** The existing heavy link arrow, rotated for the destination's meaning. */
export function Arrow({ direction = 'up-right' }: { readonly direction?: 'up-right' | 'right' | 'left' | 'up' }) {
  return <svg className={`link-arrow arrow-${direction}`} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <path d="M3.5 12.5 12.5 3.5M5.5 3.5h7v7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}
