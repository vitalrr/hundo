# hundo.

**Can you predict the crowd?** Hundo is a live Android game for Solana Mobile. Players have 15 seconds to guess which of four answers the other active players will choose. The winning answer exists only after the votes are counted.

**[Download Android APK v0.2.12](https://github.com/vitalrr/hundo/releases/download/v0.2.12/hundo-0.2.12.apk)** · [Release notes](https://github.com/vitalrr/hundo/releases/tag/v0.2.12)

The APK installs on a compatible Android phone without sharing Wi-Fi with the developer. **See how it works** runs without a wallet; live play uses a Solana Mobile Wallet Adapter wallet. The app was tested on a Solana Seeker.

## The game

1. Connect a wallet and join the room.
2. Answer ten questions, with 15 seconds for each. Choices stay hidden until the timer ends.
3. See the vote split, advance with the majority, or keep watching as a spectator. After the round, everyone can view the crowd recap.

The server controls timing and counts only eligible votes. Notifications remind players 15 and 5 minutes before a scheduled game and link to the recap afterward.

## Verified pilot

On 12 October 2026, a round with **57 participants** completed all ten question. The sole finalist received [1 SKR on Solana Mainnet](https://explorer.solana.com/tx/2aSVpEYCrmQ4h5oZGjumePDgULMqFG22FFrKr4GznvZZVEvj5a9jTsMpraWV7ZRhQJ2EBmAMW2QRMna5cBQja1XG).

The home screen's **1,000 SKR** is a planned daily prize. 

## Source and checks

| Part | Code |
| --- | --- |
| Android app and live screens | [src/features](src/features), [App.tsx](App.tsx) |
| Solana wallet connection | [Mobile Wallet Adapter](src/utils/useMobileWallet.tsx), [session](src/services/gameSession.ts) |
| Server and majority rules | [game function](supabase/functions/game/index.ts), [database migrations](supabase/migrations) |
| Notifications | [notify function](supabase/functions/notify/index.ts), [setup](docs/push-setup.md) |
| Pilot reward | [payout tool](scripts/skr-pilot-payout.cjs), [57-participant test](tests/videoCast.test.ts) |

The app uses React Native/Expo and Supabase. Wallet login uses a server-verified signature; the server settles each question after its deadline. The source includes the Android app, backend, database rules and 43 passing automated tests. [Security verification](docs/security-audit.md) maps the platform's historical findings to the current code.

## Build

Use Node 24, pnpm, JDK 17 and the Android SDK. Copy `.env.example` to `.env` and set the public Supabase endpoint and publishable key for live features. Download the Firebase `google-services.json` for `app.hundo.mobile` to enable push in a local build; it is intentionally excluded from Git.

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build:local
# APK: dist/hundo-preview.apk
```

The build script generates the native `android/` folder, which is not committed. See [daily operations](docs/daily-operations.md), [question guidelines](docs/question-guidelines.md), [pilot details](docs/skr-pilot.md) and [security notes](docs/security-audit.md) for the technical record.
