# Security audit follow-up (9 October 2026)

This note records what was changed after the competition site's dependency scan of commit `0d0ab1e`. It is not a claim that the application or its prize flow has been independently security certified.

## Resolved in v0.2.6

- Removed the unused `@solana/spl-token` dependency, which was the only reason `bigint-buffer` was installed.
- Pinned fixed transitive versions of `tar`, `@xmldom/xmldom`, `image-size`, `postcss`, `shell-quote`, `source-map-js`, and `ajv` in `pnpm-workspace.yaml`.
- Patched Expo CLI's `tar` import and Metro's `image-size` call to preserve compatibility with the fixed major versions. The small patches are checked in under `patches/`.
- Rebuilt the Android bundle, checked TypeScript, and ran the 20 app and database tests.

At the time of the v0.2.6 change, `pnpm audit` reported **0 critical, 2 high, and 6 moderate** advisories, down from **2 critical, 29 high, and 14 moderate** before the dependency cleanup. The six moderate findings were addressed in v0.2.7 as described below. Run `pnpm audit` again before a production release because advisories and fixes change.

## Follow-up: two high findings

The two remaining high advisories affect `node-forge` and `braces`, both used by development/build tools. As of 9 October 2026, neither package has a published version marked fixed by its advisory. We therefore applied local `pnpm` patches without changing the package version:

- `node-forge`: backported the nested `DigestAlgorithm` element-count check from [upstream PR #1152](https://github.com/digitalbazaar/forge/pull/1152). A regression test confirms a malformed signature previously accepted by 1.4.0 is now rejected, while a valid signature still verifies.
- `braces`: limited brace, AST, expansion, and array nesting to 128 levels. A regression test confirms deeply nested input is rejected with a controlled error while ordinary brace patterns still work.

TypeScript, all 22 tests, Android export, Expo prebuild, and the native release build passed after these patches. **Version-based scanners still report these two high advisories** because `node-forge@1.4.0` and `braces@3.0.3` remain in the lockfile. The patches are a local mitigation, not an upstream security release or a claim that every path has been independently audited. Replace them with official fixed releases when available.

## Follow-up: six moderate findings in v0.2.7

- Updated the affected transitive `uuid` versions to 11.1.1. This removes one moderate advisory. A compatibility test covers Jayson JSON-RPC request IDs.
- Updated `decode-uri-component` to 0.5.0. Kept React Navigation's `query-string@7.1.3` API and patched its import to interoperate with the fixed decoder's ESM export. This removes one moderate advisory; a test covers query parsing and serialization used in room links.
- Updated `stream-json` to 3.7.0. Patched Jayson to use the new stream factories. This removes three moderate advisories; a test covers streaming JSON-RPC parsing.
- Locally patched `sprintf-js@1.0.3` to bound numeric precision before invoking JavaScript numeric formatters. A regression test covers the three vulnerable formatting modes. There is no official fixed version in the advisory as of 9 October 2026, so the version-based scanner **still reports one moderate advisory**. This local mitigation is not an upstream security release.

The v0.2.7 audit reports **0 critical, 2 high, and 1 moderate** advisory by package version. The two high and one moderate findings all have checked-in local patches and regression tests, but remain visible to scanners until official fixed versions are available. TypeScript, 25 tests, and Android export passed after these changes. The native APK build is part of the release verification.

## Public client key

The site's “leaked secret” finding points at `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `src/services/api.ts`. This is a publishable client key by design, not a Supabase service-role key. Supabase service-role credentials, Firebase service-account credentials, and scheduler secrets belong only on the backend and must never be committed or included in an APK. The backend still needs row-level access rules and function authorization; a publishable key alone is not a security boundary.

## Release limits

This APK is a test-signed competition build. The daily rooms are free rehearsals with no live SKR payout. Security of a real prize wallet, payout executor, and production anti-bot controls has not been established.
