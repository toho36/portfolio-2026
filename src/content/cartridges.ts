export const CARTRIDGES = [
  'GameOnVB',
  'Suburbs',
  'Screen Switch',
  'VoleyEvents',
] as const

export type Cartridge = (typeof CARTRIDGES)[number]
