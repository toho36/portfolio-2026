const EASE = 0.18

export function createCursorFollow(el: { style: { transform: string } }, smooth: () => boolean) {
  let x = 0, y = 0, tx = 0, ty = 0, raf = 0, placed = false
  const write = () => { el.style.transform = `translate3d(${x}px, ${y}px, 0)` }
  const tick = () => {
    raf = 0
    x += (tx - x) * EASE
    y += (ty - y) * EASE
    if (Math.abs(tx - x) < 0.1 && Math.abs(ty - y) < 0.1) { x = tx; y = ty }
    write()
    if (x !== tx || y !== ty) raf = requestAnimationFrame(tick)
  }
  return {
    move(nextX: number, nextY: number) {
      tx = nextX; ty = nextY
      if (!placed || !smooth()) { placed = true; x = tx; y = ty; write(); return }
      if (!raf) raf = requestAnimationFrame(tick)
    },
    stop() { cancelAnimationFrame(raf); raf = 0; placed = false },
  }
}
