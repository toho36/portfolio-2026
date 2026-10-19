export interface ArenaOptions {
  media?: string
  following?: HTMLElement | null
  onExit?: (() => void) | null
}

export function mountArena(hero: HTMLElement, options?: ArenaOptions): () => void
