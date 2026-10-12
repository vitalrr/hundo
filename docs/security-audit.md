# Security audit follow-up

## Verified again — 12 October 2026

The competition platform's **18-finding report is pinned to commit `0d0ab1e1da8c245594125ceb37c888234ad22dc1`**. On 12 October its rerun button was disabled with “YOUR TEAM'S AUDIT HAS BEEN USED”. AI Coach still consumes that historical report; it is not a new scan of current main.

The six priority findings were checked against the installed packages, resolved lockfile entries, current APK and Git history:

| Platform finding | Current evidence |
| --- | --- |
| `tar 6.2.1` — critical | Resolved and installed version **7.5.22** |
| Client secret at `src/services/api.ts:4` | The environment variable contains a **publishable** Supabase client key. See the key analysis below. |
| `postcss 8.4.49` — high | Resolved and installed version **8.5.29** |
| `bigint-buffer 1.1.5` — high | Removed; absent from lockfile resolutions and installed dependencies |
| `@xmldom/xmldom 0.7.13` — high | Resolved versions **0.8.15** and **0.9.12**, with 0.8.15 installed at the root |
| `image-size 1.2.1` — high | Resolved and installed version **2.0.4** |

The old versions still appear as override **selectors** at the top of `pnpm-lock.yaml`; the right-hand versions and resolved package entries are the installed replacements. All ten dependency entries in the platform report are absent from the fresh `pnpm audit` findings.

Fresh `pnpm audit --json` result: **0 critical, 2 high, 0 moderate**. The remaining advisories are `node-forge` and `braces`, each with a checked-in local mitigation and passing regression tests as described below. The registry still lists 1.4.0 and 3.0.3 as their latest releases, and the [node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv) and [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) list no fixed release. This result is not a zero-finding audit; no advisory is suppressed or hidden by renaming a package.

Validation: frozen-lockfile installation and TypeScript passed; **44 tests passed**, including database authorization, security patches, client-configuration checks, and YAML compatibility; Android bundle export passed. A targeted scan of **786 historical Git blobs** and the published v0.2.12 APK found no Supabase secret key, service-role JWT or PEM private-key material. This is a targeted credential check, not an exhaustive secret scanner. APK SHA-256: `863cdc06e9845ad48c49b4cae22a4969a3752ac793af4df871805a2dc1af8c9c`.

### Removed the last moderate dependency finding

Updated the legacy `js-yaml@3.15.2` dependency to 4.3.2, removing `argparse@1.0.10` and `sprintf-js` entirely from the resolved lockfile. The old sprintf precision patch is no longer needed. A one-line Cosmiconfig compatibility patch uses `yaml.load`, the safe default in YAML v4, instead of the removed `safeLoad` API. Tests exercise Metro's YAML loader, reject executable YAML tags, and verify coverage configuration and the YAML command-line tool. Wallet dependencies are unchanged. This is a build-tool update in the source repository, not a replacement of the published APK.

### Client key analysis and build protection

[Supabase documents publishable and legacy anon keys as client-side keys](https://supabase.com/docs/guides/api/api-keys). The flagged line reads a public client identifier, not a service-role credential. Player authorization is enforced separately by the game API and database access rules. There is no evidence requiring credential rotation for this specific finding.

[Expo configuration](../app.config.js) now runs a [build guard](../scripts/client-config-guard.cjs) that rejects privileged Supabase keys, service-role JWTs, private-key material and secret-named `EXPO_PUBLIC_*` variables before bundling. Its errors never print credential values. [Regression tests](../tests/clientConfig.test.ts) verify rejection and preserve publishable/legacy-anon configuration. This adds protection to future builds; the existing v0.2.12 APK already contains only the public client key.

## Earlier fixes

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

The v0.2.12 APK is a test-signed competition build. Ordinary daily rooms are free rehearsals. A separate, operator-supervised [1 SKR Mainnet pilot](skr-pilot.md) completed on 12 October 2026, with a public transaction receipt. This does not establish the security of an automated daily prize service, independent wallet custody, or production anti-bot controls. The version-based scanner findings described above still need upstream fixes and a fresh audit before production.
