# hundo.

A daily live game of collective instinct for Solana Seeker. Pick the answer you think the other active players will choose. Their votes determine the winning option when the timer closes.

## Play

Connect a wallet with Mobile Wallet Adapter, join before the scheduled start and answer ten questions. Each question gives you fifteen seconds, followed by a five-second result reveal without a countdown. Players who pick a leading option advance. Tied leaders all advance, a missed answer eliminates, and spectators cannot vote. The server controls deadlines and settlement.

The app includes an offline demo, a 5-second demo countdown and 15-second live countdown with music, live percentage reveals, spectator mode and a winner screen. The daily schedule uses **19:00 UTC** and displays local time on each phone. Opt-in Android push reminders are scheduled 15 and 5 minutes before a complete round; a post-game push links to the public aggregate recap after a completed round with participants, including rehearsals. People who missed the game can also open the latest recap from home.

## Verified prototype

The Android APK has been tested on a physical Seeker. In the September 20 shared rehearsal, a Seeker and a simulated Mac client submitted two votes on every question and both reached the final. The user subsequently verified timer, response feedback and full-screen fixes on Seeker. This is not evidence of production-scale capacity. See [rehearsal evidence](docs/rehearsal.md).

Wallet challenge authentication works. The code also contains ordinary-game memo transaction verification, public prize-wallet balance display, server-side prize accounting and Explorer links. **Actual prize transfers have not yet been verified, and this version has no automatic payout executor.** Current game accounting uses Devnet SOL. The 10 000 SKR home display and demo prize amounts are presentation examples, not funded reward claims. No Anchor escrow or completed SKR integration is present.

The weekly schedule runs free, zero-prize rehearsals. Future live question packs must remain private. Publishing this repository and its history without first rotating unreleased packs would expose their content.

## Run locally

Use Node 24, pnpm, JDK 17 and Android SDK. The project began from the official `solana-mobile/solana-mobile-expo-template`, revision `04cdd54bc3a9234b518412c51b0d6c5f1d32dc29`.

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm android
```

Mobile Wallet Adapter requires a native Android build. Expo Go and the web demo do not support wallet login. Set the public configuration from `.env.example` in a local `.env`. Never add service-role or signing keys to the client.

For an embedded ARM64 preview APK with `JAVA_HOME` and `ANDROID_HOME` configured:

```sh
pnpm build:local
```

The preview uses test signing. Prepare a separate signing key and release identity for store publication. The installed APK does not need a running Mac, but wallet login and live rounds need internet.

## Backend and daily operations

Apply the SQL migrations in `supabase/migrations` in order, then deploy `supabase/functions/game/index.ts` and `supabase/functions/notify/index.ts`. The game function uses Supabase-provided service credentials, verifies wallet sessions and talks to Devnet through `SOLANA_RPC_URL`. The client supplies the public gateway key in `apikey` and `Authorization`. Tables and game RPCs remain restricted to the service role; completed aggregate results have a read-only public endpoint.

[Daily operations](docs/daily-operations.md) covers a seven-day schedule, 70 English questions, duplicate protection and weekly content renewal. The operator creates complete future rounds in one transaction. No laptop cron process is required. Server requests advance settlement when needed.

## Before a public release

Complete transfer verification and an idempotent payout executor, test reconnection and larger rooms, address bot participation, add monitoring and establish production reward operations. One wallet is not proof of one human. Speed-cutoff decisions use server receipt time and therefore include network latency. The operator controls any prize wallet, not an escrow contract.

## CLOCK IN

[Submission draft](docs/submission.md) contains the English product description, official deliverable checklist, a 90-second video script and six-slide presentation content. The official announcement lists October 8, 2026 as the deadline. A final recording, presentation export, release checklist and submission are still pending.
