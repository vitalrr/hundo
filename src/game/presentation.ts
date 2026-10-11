import { QUESTION_MS } from './rules.ts';
export type StagePhase = 'lobby' | 'question' | 'result' | 'final';

export function shouldSwitchLiveRound(latestId: string | null, currentId: string, phase: StagePhase, now: number, startsAt: number, dismissed = false) {
  if (latestId === currentId) return false;
  if (phase === 'final') return dismissed;
  // The home feed removes a round at its deadline. Keep the current one long
  // enough to fetch its final snapshot, even if the listing changed first.
  return now < startsAt + 10 * QUESTION_MS - 3000;
}
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
