export interface CalibreMount {
  dispose(): void
  readonly state: {
    readonly destroyed: boolean
    readonly open: number
    readonly targetOpen: number
    readonly selected: string | null
    readonly scheduled: boolean
    readonly runtime: string
  }
}
export function mountCalibre(root: HTMLElement): CalibreMount
