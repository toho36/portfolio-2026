export const titles = ['Hoang Viet To', 'GameOnVB', 'Goal Loop', 'Goal Loop', 'Screen Switch', 'Playground'];
export const segments = ['segA', 'segB', 'segC', 'segD', 'segE'];
export const stopCount = titles.length;
export const counterLabel = stop => `${String(stop + 1).padStart(2, '0')} / ${String(stopCount).padStart(2, '0')}`;
export const mediaVariant = portrait => portrait ? 'mobile' : 'desktop';
export const initialState = () => ({ stop: 0, moving: false, destination: null });
export function transition(state, direction, reduced = false) {
  if (state.moving) return { state, action: 'ignore' };
  if (direction > 0 && state.stop === stopCount - 1) return { state, action: 'scroll' };
  const stop = Math.max(0, Math.min(stopCount - 1, state.stop + Math.sign(direction)));
  if (stop === state.stop) return { state, action: 'ignore' };
  const moving = { ...state, moving: true, destination: stop };
  if (reduced) return { state: moving, action: 'still' };
  const segment = direction < 0 ? `${segments[stop]}-reverse` : nextSegment(state.stop);
  return { state: moving, action: 'play', segment };
}
export function finish(state) {
  return state.moving ? { stop: state.destination, moving: false, destination: null } : state;
}
export function interrupt(state, following = false) {
  return { state: finish(state), action: following ? 'scroll' : 'still' };
}
export const posterName = stop => stop === 0 ? 'poster' : `stop-${stop}`;
export const nextSegment = stop => segments[stop] ?? null;
// Travel stays near four seconds; Goal Loop C runs slower so its captions stay readable.
export const travelRate = segment => ({ segA: 1.25, segB: 1, segC: 1.5, segD: 1.75, segE: 1.5 })[segment?.replace('-reverse', '')] ?? 1;
export const idleName = stop => [null,'gameon-hold.mp4','goal-loop-hold.mp4','goal-loop-finished-hold.mp4','screen-switch-hold.mp4',null][stop] ?? null;

export function findingAtFrame(frame) {
  if (frame >= 446) return 'Review: fit confirmed';
  if (frame >= 420) return 'Check: joint holds';
  if (frame >= 388) return 'Build: crack joined; 1 repair piece left';
  if (frame >= 379) return 'Build: repair piece taken';
  if (frame >= 304) return 'Check: crack found';
  return '';
}
