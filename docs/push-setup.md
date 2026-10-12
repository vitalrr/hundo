# Android push setup

Firebase project: `hundo-3d60e`. Android package: `app.hundo.mobile`.
Local `google-services.json` is configured in app.json and excluded from Git.
To reproduce a native build, download this file from the Firebase Android app settings first.

`expo-notifications` asks for Android permission on first launch. If granted, hundo registers the installation's FCM token even before wallet sign-in. The menu offers a persistent notifications on/off control. Disconnecting or reconnecting a wallet does not change that choice. Android can deny the permission; in that case reminders cannot be delivered until the user enables them in system settings.

Push registrations are private. New APKs authenticate `push-register`, `push-status`, and `push-disable` with a random per-installation secret held in Android secure storage; the server stores only its hash. Migration `202610120002_guest_push.sql` makes the wallet optional and allows a legacy wallet registration to be claimed only with its existing FCM token. The older wallet-authenticated route remains for already installed APKs. Database tests verify ownership, opt-out, migration, and denial of anonymous database access.

Supabase `game` and `notify` functions are deployed. The `notify` function has legacy JWT verification off and checks `X-Hundo-Notify-Secret` against `NOTIFICATION_CRON_SECRET` itself. `FCM_SERVICE_ACCOUNT_JSON`, `FCM_PROJECT_ID`, and `NOTIFICATION_CRON_SECRET` are stored in Supabase Edge Function secrets. The cron secret is also stored in Supabase Vault as `hundo_notify_cron_secret`; do not put it in Git or the APK. The active `hundo-notify-due-rounds` pg_cron job calls `notify` each minute through pg_net. A direct pg_net call returned HTTP 200 with `{"sent":0,"rounds":0}` when no round was due.

On 2026-09-22, the Seeker registered one enabled device. A rehearsal round with ten questions triggered the scheduled sender; `hundo_push_deliveries` recorded one `sent` delivery. The user confirmed that the notification appeared on the locked Seeker and tapping it opened hundo. The opt-out flow still needs a device check.
