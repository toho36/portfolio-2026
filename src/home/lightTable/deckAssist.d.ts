export function createDeckAssist(root: HTMLElement, isReduced: () => boolean): {
  move(index: number, assisted?: boolean): void
  cancel(): void
  destroy(): void
}
