# Android push setup (in progress)

Firebase project: `hundo-4f2fa`. Android package: `app.hundo.mobile`.
Local `google-services.json` is configured in app.json and excluded from Git.
To reproduce a native build, download this file from the Firebase Android app settings first.

`expo-notifications` is installed. `src/services/gameNotifications.ts` contains opt-in registration and notification-open helpers; these are not yet connected to the UI. No server notification credentials have been created or stored, and no reminders are being sent.

Next steps:

- Finish Google Cloud sign-in and create a dedicated sender with only FCM send permissions. Confirm persistent credential creation with the owner before creating its key.
- Store the sender credential only in Supabase server secrets, never in the APK or Git.
- Add authenticated installation registration, an opt-out control, token refresh handling, and a private delivery queue.
- Schedule one reminder five minutes before an actual published round; do not notify for a cancelled or already-started round. Deduplicate retries and expire undelivered reminders at game start.
- Test opt-in, opt-out, locked-phone delivery and notification opening on Seeker before marking this feature ready.
