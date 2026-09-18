export type Choice = 0 | 1 | 2 | 3;
export type Vote = { wallet: string; choice: Choice; receivedAt: number };
export type Question = { id: string; text: string; options: [string, string, string, string] };

/** Only eligible, on-time votes enter this function. Equal leading options all win. */
export function settle(votes: Vote[], cap?: number) {
  if (new Set(votes.map(v => v.wallet)).size !== votes.length) throw new Error('Duplicate wallet');
  if (cap !== undefined && (!Number.isInteger(cap) || cap < 1)) throw new Error('Invalid cap');
  const counts = [0, 0, 0, 0];
  for (const vote of votes) {
    if (!Number.isInteger(vote.choice) || vote.choice < 0 || vote.choice > 3 || !Number.isFinite(vote.receivedAt)) throw new Error('Invalid vote');
    counts[vote.choice]++;
  }
  const max = Math.max(...counts);
  const leaders = max ? counts.flatMap((n, i) => n === max ? [i] : []) : [];
  const candidates = votes.filter(v => leaders.includes(v.choice)).sort((a, b) => a.receivedAt - b.receivedAt || a.wallet.localeCompare(b.wallet));
  // Equal timestamps at the cutoff all advance; never break a tie by wallet address.
  const cutoff = cap && candidates.length > cap ? candidates[cap - 1].receivedAt : Infinity;
  return { counts, leaders, total: votes.length, survivors: candidates.filter(v => v.receivedAt <= cutoff).map(v => v.wallet) };
}

export function splitPot(lamports: bigint, winners: number) {
  if (lamports < 0n || !Number.isSafeInteger(winners) || winners < 0) throw new Error('Invalid payout');
  return winners === 0 ? { each: 0n, remainder: lamports } : { each: lamports / BigInt(winners), remainder: lamports % BigInt(winners) };
}

export function questionPhase(now: number, startsAt: number, count = 10) {
  const elapsed = now - startsAt;
  if (elapsed < 0) return { phase: 'lobby' as const, index: 0, remaining: -elapsed };
  const index = Math.floor(elapsed / 15_000);
  if (index >= count) return { phase: 'final' as const, index: count - 1, remaining: 0 };
  const offset = elapsed % 15_000;
  return { phase: offset < 10_000 ? 'question' as const : 'result' as const, index, remaining: (offset < 10_000 ? 10_000 : 15_000) - offset };
}
