# Live home and device rehearsal

This document records the September rehearsal state. For the later 12 October Mainnet payment and 57-participant simulated cast, see the [pilot evidence](skr-pilot.md).

The home screen polls `home` every five seconds while visible. The endpoint is public through the existing publishable-key gateway; it returns the earliest ready upcoming/active round, server time and the number of unique registered wallets. It never returns questions, answers or player addresses. This is a registration count, not online presence. The date/time uses the phone's timezone. Missing schedules and connection failures have separate states.

**The 1,000 SKR banner is a planned-prize mockup, not a funded daily pool.** At the time of this September rehearsal, the backend used Devnet/SOL accounting and no SKR payout had been completed. A later, separate 1 SKR Mainnet pilot is documented above.

Apply migrations in order. `202609190001_home.sql` and the updated `game` function were deployed to the hundo Supabase project on September 19, 2026. Public home/CORS and authenticated login smoke checks passed against that deployment. Ten local tests passed; these do not substitute for testing simultaneous physical devices.

## Schedule a device rehearsal

1. Install the latest APK on each Android device and connect a different wallet on each.
2. Choose a start time after everyone is ready. Generate a SQL script using an explicit timezone:
   `node --experimental-strip-types scripts/prepare-rehearsal.ts <future-ISO-timestamp>`
3. Review and execute the generated SQL in this project's SQL editor. It creates exactly ten English questions and refuses to schedule over another active/upcoming game.
4. Each device should show the same round in its own local timezone. Tap **Join rehearsal**. Repeated joins must not increase the count; two distinct wallets must produce two registrations.
5. Verify simultaneous questions, answer locking, reveal percentages, elimination and spectator mode. Reconnect one device after interrupting its network and check that the server restores its state.
6. Verify the final result. Rehearsals have zero actual prize and send no payments. Registration uses the signed wallet session; ordinary games still require a verified on-chain memo transaction.

## Recorded rehearsal — September 19, 2026

Round `cc6ea07c-636a-4275-a94f-c43ce61bb955` started at 20:42:57 UTC. A Seeker and one explicitly simulated client on the Mac registered. The Mac client answered option A through all ten questions; the server returned ten reveal states and a final with one survivor out of two. Each reveal had counts `[1,0,0,0]`. The Seeker user confirmed missing the beginning, so this run verified registration, server progression and timeout elimination, but **not successful answer submission from the phone**. It was not a two-Android-device test. No payouts were sent.

The simulated client is `node scripts/rehearsal-player.cjs <round-id>`. It only joins an explicitly selected rehearsal with a zero actual prize; its private key is ephemeral and is never printed or saved.

## Preview 0.2

September 20 follow-up: round `9d5b03c4-6877-4377-b98d-c1038bab8cf6` started at 13:27:30 UTC. The Seeker and the simulated Mac client both answered A on all ten questions. Each reveal contained `[2,0,0,0]`, and the final reported two finalists out of two. The user confirmed the phone flow worked. No payments were sent. Follow-up fixes addressed clock jitter, immediate local answer selection while the server confirms, and Android system-bar backgrounds. The live game now uses an absolute full-screen layer in the main app window rather than a native modal with separate system bars. Later Seeker tests confirmed the updated game flow and winner screen; see the [October pilot](skr-pilot.md).

Live rounds now open a full-screen modal during the final 15 seconds of the lobby and remain full-screen for questions and results. The live controller stays mounted when the user explores the demo. Demo and live rounds share `GameStage`: pale-purple play, gray-lilac spectator mode, large timer digits, and purple/red answer feedback. The countdown includes an original coin animation and synthesized audio cues with a mute control. Audio pauses in the background; this is an in-app transition, not a lockscreen alarm or takeover of other apps.

The home retains its original lime gradient and the requested display prize, with EVERY DAY below it. The gradient is outside the safe-area container so it covers the bottom inset; Android navigation colors follow each screen. Timer digits use separate text layout with padding to avoid Android font clipping. The app icon is purple h. on lime; adaptive Android foreground art has its own safe margin.

At the September 0.2 preview stage, type checking, 13 automated tests and the native release build passed. Browser checks covered countdown, question layout, incorrect-answer feedback and spectator styling. Subsequent Seeker tests confirmed music, gameplay, and the winner screen in the later build.
