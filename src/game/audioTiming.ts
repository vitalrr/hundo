export function countdownOffsetSeconds(remainingMs: number): number {
  return Math.max(0, Math.min(15, (15_000 - remainingMs) / 1000));
}

export function phaseCueIsOnTime(phase: 'question' | 'result', remainingMs: number): boolean {
  // A late asset load must not play an opening cue halfway through the phase.
  return phase === 'question' ? remainingMs > 13_000 : remainingMs > 3_500;
}
