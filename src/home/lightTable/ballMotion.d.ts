export interface BallSpin {
  yaw: number
  pitch: number
  yawSpeed: number
  pitchSpeed: number
  basis?: number[]
  handoff?: { quaternion: number[]; velocity: number[] }
}
export function createSpin(): BallSpin
export function followPosition(value: number, target: number, seconds: number, following: boolean): number
export function kickSpin(spin: BallSpin, dx: number, dy: number, seconds: number, fraction?: number): BallSpin
export function brushSpin(spin: BallSpin, from: { x: number; y: number; time: number }, to: { x: number; y: number; time: number }, center: { x: number; y: number }, radius: number): BallSpin
export function stepSpin(spin: BallSpin, seconds: number): BallSpin
export function ballQuaternionMultiply(a: number[], b: number[]): number[]
export function ballMotion(time: number, x: number, y: number, spin?: BallSpin): { position: number[]; rotation: number[] }
