# hundo: CLOCK IN submission draft

## Short description
hundo is a daily live game for Solana Seeker. Guess what the other active players will choose. Ten questions, fifteen seconds per answer, one shared reveal. The players create the winning answer when voting closes.

## Product pitch
Crypto communities already share a sense of humor. hundo turns it into a daily appointment: connect a wallet, join the room and predict the room's instincts. Questions draw on familiar community habits rather than obscure facts. Search cannot reveal an outcome that players have not created yet, although coordinated players and automated prediction remain real risks.

The game opens a full-screen countdown, keeps choices hidden until the deadline, reveals the distribution and lets eliminated players watch. A winner screen makes reaching question ten feel like an event. The daily schedule is 19:00 UTC, shown in each player's local time.

## What works today
An installable Android APK includes an offline demo and native Mobile Wallet Adapter login with a server-verified challenge signature. Supabase controls round timing, eligible voting, ties and settlement. A Seeker and a simulated Mac client completed one shared ten-question round with two votes per question and two finalists. The user also verified follow-up timer, tap feedback, audio and screen-inset fixes on Seeker.

## Solana's role and current limits
Wallet identity is implemented. Ordinary game entry has an on-chain memo verification path, while zero-prize rehearsals use the authenticated wallet session. The app contains public-wallet and confirmed-transaction links. Prize accounting uses Devnet SOL, and an executed prize transfer has not yet been verified. Automated payouts, real SKR distribution, mainnet readiness and production bot protection remain unfinished. The 1 000 SKR home banner and 50 SKR winner preview are presentation examples, not evidence of funded rewards. There is no Anchor escrow program.

## Official checklist
Sources: https://solanamobile.com/blog/clock-in-the-solana-mobile-hackathon and https://solanamobile.radiant.nexus/ (checked October 7, 2026).

The announcement requests an Android APK, GitHub source, a demo video and a pitch deck or short presentation by October 8, 2026. The current submission portal instead shows October 12, 2026 at 12:59 GMT+1. Because these official dates conflict, submit by October 8 if possible. Winners must later publish on the Solana dApp Store to claim prizes. SKR integration is optional and has a separate prize; hundo must not claim a completed SKR integration at this stage.

- APK: working ARM64 preview, test-signed; downloadable at https://github.com/vitalrr/hundo/releases/download/v0.2.5/hundo-0.2.5.apk. SHA-256: `9c42037cac34d622e9915ef5c68331136d0a1db9ea0fd84096959fdaee5dced3`.
- Source: https://github.com/vitalrr/hundo is public. The October question packs are stored outside the repository.
- Video: the creator reports that a final recording has been made; upload it to the submission portal.
- Presentation: the six-slide content below is ready for layout and export.
- Submission: not sent. Final review and submission remain separate steps.

## 90-second demo script
0–12 seconds: Show the home screen. “hundo is a daily game for Seeker. You predict what the other players will choose.” Show the actual scheduled time and real joined count. Describe the prize banner as a prototype display.

12–25 seconds: Connect the wallet and join a rehearsal. “A signed wallet challenge logs me in. This rehearsal has no entry transaction or payout.” Do not expose wallet recovery material.

25–45 seconds: Show the countdown and the first answer. “We get fifteen seconds. Answers stay hidden until voting closes.” Keep the recording's audio audible.

45–60 seconds: Show vote percentages and advancement. “The most popular option wins. Only active players vote. Tied leading options all advance.”

60–75 seconds: Cut to the final question and winner screen from a real rehearsal. Label edits and any demo preview clearly. Do not present the example 50 SKR as an actual transfer.

75–90 seconds: Show tomorrow's schedule. “The game loop works on Seeker. Next we are validating prize transfers and preparing for larger rooms.” Close with the repository URL and hundo branding.

## Short presentation content
1. **hundo.** A daily game of collective instinct for Solana Seeker.
2. **The winning answer comes from the players.** Four options. A fifteen-second vote. Majority determines who advances. There is no fixed answer key.
3. **A daily appointment.** 19:00 UTC. Ten questions per round. A fresh seven-day pack covers 70 original prompts. Return-visit and retention claims remain hypotheses until measured.
4. **Built for Seeker.** Native wallet login, synchronized rounds, clear voting feedback, music and spectator mode. React Native / Expo with Supabase.
5. **A working shared round.** One physical Seeker and one simulated Mac client. Ten questions. Two votes each. Two finalists. This is functional evidence, not a load test.
6. **The next milestone.** Verify Devnet transfers, finish reward operations and test larger rooms. No completed SKR integration or mainnet payout claim.
