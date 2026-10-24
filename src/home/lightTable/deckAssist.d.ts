export function createDeckAssist(root: HTMLElement, isReduced: () => boolean, count?: number): {
  move(index: number, assisted?: boolean): void
  cancel(): void
  destroy(): void
}
