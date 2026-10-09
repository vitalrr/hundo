# One-time 1 SKR video pilot

This is an isolated pilot branch, **not** the daily free rehearsal release. The game still calculates each majority from blind votes on the server. One funded Mainnet prize wallet pays **exactly 1 SKR only if the round has one sole finalist**. The payout is triggered by an operator after the final result, then verified on-chain; it is not automatic or escrowed. Any scripted participants must be labeled as simulated in the video.

The official [Solana Mobile SKR address](https://solanamobile.com/skr) is `SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3`. The payout tool checks the Mainnet genesis hash, that mint's Token Program owner and six decimals before preparing a transfer. It transfers to the sole finalist's standard associated token account, creating that account if needed. The recipient does not need to pay a fee.

## Custody and funding

The dedicated treasury generated for this pilot is **`FRSmMsMYtb69CcCniKP97ANS1u5ukkTYoYgATm4w4L2y`**. Its key is stored only on this Mac in an owner-only file outside Git. It is not in the APK, Supabase, or GitHub. Back up that file offline before funding the wallet; never paste it into chat or a website. Keep only the small pilot balance in this hot wallet.

As of creation, the treasury has **0 SKR and 0 SOL**. Send at least 1 official SKR and enough Mainnet SOL for a transaction, the recipient's token account if necessary, and a small reserve. The operator tool queries the current rent and fee and refuses to announce the prize if the balance is insufficient. Verify the destination address on the Seeker before sending; a transfer to the wrong wallet cannot be reversed.

The intended winner's public wallet is `GhSaDCrTNbXwLWPXzzEVqWYVwMfNocUMqNG3BTkzDU9Z`, confirmed by the owner for this pilot. The actual payout tool also checks this wallet against the server's sole-finalist record; knowing the address alone cannot trigger a payment.

## Pilot setup and recording

1. Apply `supabase/migrations/202610090001_skr_pilot.sql`, then deploy the pilot branch's `game` Edge Function. The migration adds a private, one-time pilot record. No scheduled daily rehearsal receives a prize automatically.
2. Build and install the pilot APK on the Seeker. The normal APK remains the free-rehearsal version. Schedule a future ten-question, zero-SOL round for the video. Use several distinct test wallets and openly identify scripted players as simulated. Arrange their answers so the Seeker is the sole finalist.
3. Set `HUNDO_SKR_TREASURY_DIR` to the private treasury directory, `HUNDO_SUPABASE_URL` to the project URL, and `HUNDO_SUPABASE_SERVICE_ROLE_KEY` to the service-role key in a private local environment. Never put the service-role key in an app bundle, GitHub, a shell command recorded in the video, or this document.
4. After funding, run `node scripts/skr-pilot-payout.cjs status`, then `announce ROUND_UUID` **before** the round starts. Announce checks that the prize wallet is funded and registers the one-time pilot; the app then shows 1 SKR and the public treasury address.
5. Record Seeker gameplay and the result. After the server settles question ten, run `prepare ROUND_UUID WINNER_WALLET`. It verifies the sole finalist and saves a signed transaction locally **without broadcasting it**. Review the displayed recipient, amount, and treasury.
6. Run `send ROUND_UUID` to broadcast that exact saved transaction, then `verify ROUND_UUID` after finalization. The tool checks that exactly 1 SKR left the treasury token account and arrived in the winner's token account. The app then displays the confirmed Mainnet transaction link.
7. Record the Explorer transaction and the winner's wallet balance. Once the video is captured, stop using the pilot build and return to the normal test APK. Keep the signed receipt and wallet backup for audit; do not imply recurring paid games are live.

The payout commands are intentionally operator-controlled. They do not hold a permanent server signing key, do not pay ties or non-finalists, and do not retry with a fresh transaction automatically after blockhash expiry. A production prize system still needs an audited payout executor, funding controls, monitoring, anti-bot rules, and independently verified scale tests.
