# Android push setup

Firebase project: `hundo-3d60e`. Android package: `app.hundo.mobile`.
Local `google-services.json` is configured in app.json and excluded from Git.
To reproduce a native build, download this file from the Firebase Android app settings first.

`expo-notifications` is installed. The home screen has an explicit “Get game reminders” control; enabling it asks Android for permission, registers the FCM token against the connected wallet, and can be turned off from the same control. The Android release APK was built with the personal Firebase project config on 2026-09-22.

The private device table and wallet-authenticated `push-register`, `push-status`, and `push-disable` actions are deployed. Registration supports token rotation, caps enabled devices at five per wallet, and prevents another wallet from taking over an existing installation or token. Database tests cover these constraints and deny anonymous reads and registration. Migrations `202609210002_push.sql` and `202609220001_push_delivery.sql` were applied on 2026-09-22.

Supabase `game` and `notify` functions are deployed. The `notify` function has legacy JWT verification off and checks `X-Hundo-Notify-Secret` against `NOTIFICATION_CRON_SECRET` itself. `FCM_SERVICE_ACCOUNT_JSON`, `FCM_PROJECT_ID`, and `NOTIFICATION_CRON_SECRET` are stored in Supabase Edge Function secrets. The cron secret is also stored in Supabase Vault as `hundo_notify_cron_secret`; do not put it in Git or the APK. The active `hundo-notify-due-rounds` pg_cron job calls `notify` each minute through pg_net. A direct pg_net call returned HTTP 200 with `{"sent":0,"rounds":0}` when no round was due.

On 2026-09-22, the Seeker registered one enabled device. A rehearsal round with ten questions triggered the scheduled sender; `hundo_push_deliveries` recorded one `sent` delivery. The user confirmed that the notification appeared on the locked Seeker and tapping it opened hundo. The opt-out flow still needs a device check.
