export type StagePhase = 'lobby' | 'question' | 'result' | 'final';
export function shouldTakeOver(phase: StagePhase, seconds: number) {
  return phase !== 'lobby' || seconds <= 15;
}
export function answerTone(choice: number | null, option: number, revealed: boolean, leaders: number[]) {
  if (revealed && leaders.includes(option)) return 'majority';
  if (revealed && choice === option) return 'wrong';
  return choice === option ? 'selected' : 'neutral';
}
export function resultOutcome(joined: boolean, eliminatedAt: number | null, index: number) {
  return !joined || (eliminatedAt !== null && eliminatedAt < index) ? 'spectator' : eliminatedAt === null ? 'correct' : 'out';
}
