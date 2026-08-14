# Tayari macOS Release Runbook

This runbook defines the release checks for the **Apple Silicon arm64** Job Tayari Desktop package. The repository intentionally does not contain Apple certificates, notarization credentials, customer data, or update-signing secrets. Ordinary CI runs the static desktop contract only; a release operator must complete the credentialed checks on a clean macOS runner before distribution.

## Release inputs

The release operator must provide the credentials through the CI secret store or the local shell, never through committed files. The required inputs are a Developer ID Application certificate and private key for `CSC_LINK`/`CSC_KEY_PASSWORD`, an Apple Developer Team ID for `APPLE_TEAM_ID`, and either Apple ID notarization credentials (`APPLE_ID` plus `APPLE_APP_SPECIFIC_PASSWORD`) or an App Store Connect API key configured according to the electron-builder version used by the runner. The operator must also provide the production `VITE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`; development loopback URLs are rejected by the build contract.

## Credentialed build

Use a clean macOS 14 or newer arm64 runner. Install the pinned Bun dependencies with `pnpm install --frozen-lockfile`, export the release-only environment variables, and run:

```sh
VITE_DESKTOP_BUILD=true \
VITE_USE_SELF_HOSTED=false \
VITE_API_URL=https://api.example.invalid/api \
VITE_SUPABASE_URL=https://project.example.invalid \
VITE_SUPABASE_PUBLISHABLE_KEY=release-publishable-key \
pnpm desktop:build:mac:release
```

The placeholder values above are examples only. The local command produces unsigned internal artifacts unless Apple signing credentials are present. Public distribution still requires the credentialed Gatekeeper and notarization checks below. Replace them with the approved production values in the runner environment. The configured build targets **arm64 only** and emits a signed DMG and ZIP using the versioned artifact name `Job Tayari Desktop-0.1.0-arm64.*`. x64 is not a supported release target until a separate build and test matrix exists.

## Artifact verification

For each produced artifact, run `bash scripts/mac_artifact_contract.sh path/to/artifact`. The script rejects missing artifacts, non-arm64 packages, source maps, test files, backend/runtime payloads, local Supabase files, development Compose files, and unsigned or unverified applications. On macOS, independently run the following checks against the extracted `.app` and DMG:

```sh
codesign --verify --deep --strict --verbose=2 "Job Tayari Desktop.app"
spctl --assess --type execute --verbose=4 "Job Tayari Desktop.app"
xcrun stapler validate "Job Tayari Desktop.app"
hdiutil verify "Job Tayari Desktop-0.1.0-arm64.dmg"
shasum -a 256 "Job Tayari Desktop-0.1.0-arm64.dmg" "Job Tayari Desktop-0.1.0-arm64.zip"
```

`spctl` and `stapler validate` are release evidence, not optional diagnostics. If notarization is unavailable, the artifact is **not distributable**; it may be retained as an internal unsigned build only when clearly marked and isolated from public download channels.

## Install, update, downgrade, and offline checks

On a clean Apple Silicon test account, install the DMG, launch the app, verify the expected bundle identifier `app.tayari.desktop`, and confirm that navigation and IPC security tests remain intact. Disconnect the network before launch and verify that the app shows a bounded backend-unavailable state rather than a fake success state. The current repository does not configure a public auto-update feed; do not advertise automatic updates. Any future updater must be authenticated, signature-verified, rollback-capable, and added to this runbook before release.

Test downgrade by installing the previous signed version after the new version, then verify that user settings remain readable and no migration silently destroys local state. Test a corrupted or tampered update by changing the package digest or signature and verify that installation or launch is rejected. Record the macOS version, architecture, artifact SHA-256, signing identity, notarization request, `spctl` output, and `stapler` output in the release evidence record.

## External gate

The repository can prove configuration, package exclusions, arm64-only policy, and credential-safe release procedures. It cannot prove Apple signing, notarization, Gatekeeper acceptance, or clean-machine installation without the organization&apos;s Apple Developer credentials and a clean macOS runner. Those checks remain an explicit **external release gate** and must be attached to the release record before any public download is enabled.
