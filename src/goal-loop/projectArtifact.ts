export interface ProjectedPoint {
  readonly x: number
  readonly y: number
}

export interface ProjectedBounds {
  readonly bottom: number
  readonly height: number
  readonly left: number
  readonly right: number
  readonly size: number
  readonly top: number
  readonly width: number
}

export function projectBounds(
  points: readonly ProjectedPoint[],
  width: number,
  height: number,
): ProjectedBounds | null {
  if (points.length === 0 || width <= 0 || height <= 0) return null
  const xs = points.map(({ x }) => (x + 1) * width / 2)
  const ys = points.map(({ y }) => (1 - y) * height / 2)
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)
  const projectedWidth = right - left
  const projectedHeight = bottom - top

  if (![left, right, top, bottom].every(Number.isFinite)) return null
  return {
    bottom,
    height: projectedHeight,
    left,
    right,
    size: Math.max(projectedWidth, projectedHeight),
    top,
    width: projectedWidth,
  }
}

export function exposeProjectedBounds(
  element: HTMLElement,
  artifact: ProjectedBounds,
  machine: ProjectedBounds,
) {
  element.dataset.artifactPx = artifact.size.toFixed(1)
  element.dataset.machineHeightPx = machine.height.toFixed(1)
  element.dataset.artifactLeft = artifact.left.toFixed(1)
  element.dataset.artifactTop = artifact.top.toFixed(1)
  element.dataset.artifactRight = artifact.right.toFixed(1)
  element.dataset.artifactBottom = artifact.bottom.toFixed(1)
}
