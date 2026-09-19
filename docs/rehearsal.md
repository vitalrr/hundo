# Live home and device rehearsal

The home screen polls `home` every five seconds while visible. The endpoint is public through the existing publishable-key gateway; it returns the earliest ready upcoming/active round, server time and the number of unique registered wallets. It never returns questions, answers or player addresses. This is a registration count, not online presence. The date/time uses the phone's timezone. Missing schedules and connection failures have separate states.

**10 000 SKR remains a presentation placeholder at the owner's request.** It is not a funded on-chain prize. The current backend remains Devnet/SOL. Actual SKR payouts are not implemented.

Apply migrations in order. `202609190001_home.sql` and the updated `game` function were deployed to the hundo Supabase project on September 19, 2026. Public home/CORS and authenticated login smoke checks passed against that deployment. Ten local tests passed; these do not substitute for testing simultaneous physical devices.

## Schedule a device rehearsal

1. Install the latest APK on each Android device and connect a different wallet on each.
2. Choose a start time after everyone is ready. Generate a SQL script using an explicit timezone:
   `node --experimental-strip-types scripts/prepare-rehearsal.ts <future-ISO-timestamp>`
3. Review and execute the generated SQL in this project's SQL editor. It creates exactly ten English questions and refuses to schedule over another active/upcoming game.
4. Each device should show the same round in its own local timezone. Tap **Join rehearsal**. Repeated joins must not increase the count; two distinct wallets must produce two registrations.
5. Verify simultaneous questions, answer locking, reveal percentages, elimination and spectator mode. Reconnect one device after interrupting its network and check that the server restores its state.
6. Verify the final result. Rehearsals have zero actual prize and send no payments. Registration uses the signed wallet session; ordinary games still require a verified on-chain memo transaction.

No physical multi-device rehearsal has been completed yet. No test game has been scheduled automatically: its start time needs to match device availability. Keep a record of the round ID, devices, results and any observed delays when performing that check.
