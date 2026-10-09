# Security audit follow-up (9 October 2026)

This note records what was changed after the competition site's dependency scan of commit `0d0ab1e`. It is not a claim that the application or its prize flow has been independently security certified.

## Resolved in v0.2.6

- Removed the unused `@solana/spl-token` dependency, which was the only reason `bigint-buffer` was installed.
- Pinned fixed transitive versions of `tar`, `@xmldom/xmldom`, `image-size`, `postcss`, `shell-quote`, `source-map-js`, and `ajv` in `pnpm-workspace.yaml`.
- Patched Expo CLI's `tar` import and Metro's `image-size` call to preserve compatibility with the fixed major versions. The small patches are checked in under `patches/`.
- Rebuilt the Android bundle, checked TypeScript, and ran the 20 app and database tests.

At the time of this change, `pnpm audit` reported **0 critical, 2 high, and 6 moderate** advisories, down from **2 critical, 29 high, and 14 moderate** before the dependency cleanup. The two remaining high findings are in `node-forge` and `braces`, both pulled in by build tooling. Their published package versions had no patched release available on this date. The other findings concern `uuid`, `decode-uri-component`, `stream-json`, and `sprintf-js`; replacing them across major versions needs separate integration testing, particularly for wallet RPC and navigation. Run `pnpm audit` again before a production release because advisories and fixes change.

## Public client key

The site's “leaked secret” finding points at `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `src/services/api.ts`. This is a publishable client key by design, not a Supabase service-role key. Supabase service-role credentials, Firebase service-account credentials, and scheduler secrets belong only on the backend and must never be committed or included in an APK. The backend still needs row-level access rules and function authorization; a publishable key alone is not a security boundary.

## Release limits

This APK is a test-signed competition build. The daily rooms are free rehearsals with no live SKR payout. Security of a real prize wallet, payout executor, and production anti-bot controls has not been established.
