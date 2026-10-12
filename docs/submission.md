# hundo — competition evidence and submission guide

## Product

Hundo is a live Android game for Solana Mobile. In each ten-question round, players have 15 seconds to predict which answer the remaining players will choose. The server collects choices privately, determines the majority after the deadline, shows the percentages, and advances those who predicted the crowd. Eliminated players can watch, and everyone can see the final crowd recap. There is no prewritten answer key.

## What the public build demonstrates

- [Android APK v0.2.12](https://github.com/vitalrr/hundo/releases/download/v0.2.12/hundo-0.2.12.apk), test-signed for direct installation on a compatible Android phone. It offers an offline walkthrough and live rooms with a supported Solana Mobile Wallet Adapter wallet.
- Native wallet connection and server-verified challenge signatures; synchronized server-timed voting; majority and elimination; winner and spectator screens; notifications and the ten-question recap. The [README](../README.md) maps these features to client, server, and database source.
- A [12 October 2026 pilot](skr-pilot.md) with one physical Seeker and 56 **disclosed scripted participants**, using the real server rules. The Seeker player was the sole finalist and received [1 SKR on Solana Mainnet](https://explorer.solana.com/tx/2aSVpEYCrmQ4h5oZGjumePDgULMqFG22FFrKr4GznvZZVEvj5a9jTsMpraWV7ZRhQJ2EBmAMW2QRMna5cBQja1XG). The public [cast script](../scripts/video-cast.cjs) and [payout implementation](../scripts/skr-pilot-payout.cjs) make the demonstration auditable without publishing private signing keys.

## Scope and limits

The demonstrated Mainnet payout is **real**, but it is an operator-supervised, explicitly announced 1 SKR pilot. The ordinary scheduled rounds are free rehearsals and send no prizes. The home screen's **1,000 SKR** is labeled as a planned daily prize, not a funded offer. The pilot does not prove 57 human participants, production load, automated daily SKR payout, escrow, or anti-bot protection. The APK is not a dApp Store release. See [security findings and local mitigations](security-audit.md).

## What to provide to reviewers

1. The [public source repository](https://github.com/vitalrr/hundo), preferably with its [README](../README.md) and the APK release link above.
2. A phone screen recording that actually shows wallet connection, joining the room, answering, majority reveal, spectator or winner state, crowd recap, and the payout transaction. If edited, label cuts and disclose the 56 scripted participants. A spoken concept pitch alone cannot verify the running app.
3. A short deck or written pitch explaining the game, why the majority is unknown until players vote, Solana wallet integration, the supervised payout proof, and what remains for production.

This document describes repository evidence. It does not assert that a particular portal submission, video upload, or final judging review has been completed.
