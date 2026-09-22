# Android push setup (in progress)

Firebase project: `hundo-3d60e`. Android package: `app.hundo.mobile`.
Local `google-services.json` is configured in app.json and excluded from Git.
To reproduce a native build, download this file from the Firebase Android app settings first.

`expo-notifications` is installed. The home screen now has an explicit “Get game reminders” control; enabling it asks Android for permission, registers the FCM token against the connected wallet, and can be turned off from the same control. Firebase native prebuild and Android release build passed with the previous Firebase config; the next APK must be rebuilt with the personal project config.

The private device table and wallet-authenticated `push-register`, `push-status`, and `push-disable` actions are implemented locally, not deployed. Registration supports token rotation, caps enabled devices at five per wallet, and prevents another wallet from taking over an existing installation or token. Database tests cover these constraints and deny anonymous reads and registration. Apply `202609210002_push.sql` and `202609220001_push_delivery.sql` before deploying the updated functions.

Next steps:

- Create the dedicated personal sender key, then store `FCM_SERVICE_ACCOUNT_JSON`, `FCM_PROJECT_ID=hundo-3d60e`, and `NOTIFICATION_CRON_SECRET` only in Supabase server secrets, never in the APK or Git.
- Deploy `supabase/functions/notify`, and call it from a private Supabase schedule every minute with `X-Hundo-Notify-Secret`. It selects a ready round five minutes away, including rehearsals, deduplicates each device in `hundo_push_deliveries`, and disables unregistered FCM tokens.
- Test opt-in, opt-out, locked-phone delivery and notification opening on Seeker before marking this feature ready.
