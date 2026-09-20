# Daily games

Deployed September 20, 2026: September 21–27, inclusive, each at 19:00 UTC. Supabase returned seven rehearsal rounds with ten questions each. The first round is `015fd163-ad92-49f4-9736-006b91884e44`. At this time of year the agreed UTC hour displays as 20:00 in Lisbon. No APK update is needed for this schedule.

The server stores each start time and all ten questions in advance. No Mac process or browser tab needs to stay open. Clients display their local time and follow server phase/answer deadlines. Settlement occurs when clients request the round state, not through a timer on the operator's laptop.

`content/week-one.tsv` contains 70 original English prompts in seven sets of ten. Each asks players to predict the other active players; none has a predetermined correct choice. Themes: community habits, phone life, group chats, decision-making, games, building products, and daily rituals. Keep unreleased questions private: they are not bundled in the APK. Before opening the repository publicly, replace future live packs with privately stored content.

Generate a seven-day schedule at a fixed UTC hour:

```sh
node --experimental-strip-types scripts/prepare-week.ts 2026-09-21T19:00:00Z dist/daily-week.sql
```

The timestamp is an example; use the agreed future start. Execute the output once in Supabase SQL Editor. All seven rounds are inserted atomically. Re-running identical SQL does not create duplicates; conflicting content or overlapping games causes a rollback. A local script only generates SQL and never deploys by itself.

This version deliberately schedules zero-prize Devnet rehearsals. It does not send money. The requested home display of 10 000 SKR does not fund these games. Do not represent this as live SKR rewards in the submission.

The schedule covers exactly seven days; it does not generate infinite new questions. Before the last game, review a new 70-question pack and schedule the following week. Do not reuse the first pack silently. Fixed UTC time remains constant across daylight-saving changes; local display times may change.

Before a game: verify the home screen shows the correct local start; join from Seeker; check media volume; keep the app foreground. After a game: review final player count, answer totals, errors and archive availability. Archive settlement is driven by the server's existing request paths. No live push notifications or background phone takeover is promised.
