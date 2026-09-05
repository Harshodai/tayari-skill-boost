# Tayari Cross-Platform Desktop Release Runbook

This runbook defines the reproducible packaging path for **Job Tayari Desktop** on macOS Apple Silicon, Windows x64, and Linux x64. The Electron main process and preload bridge are shared across all threeThis runbook defines the reprodller format and platform window chrome differ.

## Release inputs

The renderer build requires `VITE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`. `VITE_API_URL` must be an HTTPS production API URL; loopback URLs are rejected by the packaging runner. Do not commit production values or signing credentials. macOS signing and notarization credentials, when used, belong only in the CI secret store.

## Local commands

After installing dependencies with `pnpm install`, use the target-specific commands below. They all run the same release validation and Vite build before invoking electron-builder.

| Target | Command | Expected artifacts |
|---|---|---|
| macOS Apple Silicon | `pnpm desktop:build:mac` | signed or unsigned DMG and ZIP |
| Windows x64 | `pnpm desktop:build:win` | NSIS installer and portable executable |
| Linux x64 | `pnpm desktop:build:linux` | AppImage and Debian package |
| All configured targets | `pnpm desktop:build:all` | all artifacts supported by the host/toolchain |

The artifacts are written to `release/` so the renderer input in `dist/` remains separate from installer output.

## CI matrix

The `Desktop release builds` workflow is the authoritative cross-compilation path. It uses `macos-14` for Apple Silicon, `windows-latest` for Windows x64, and `ubuntu-latest` for Linux x64. Run it manually for validation or push a `desktop-v*` tag to publish a GitHub release. Production environment variables are supplied as repository or environment secrets.

## Verification gate

For every target, confirm that the installer exists, has the expected architecture, launches on a clean machine, can load the `/desktop` route, and can invoke file selection and external-link IPC without exposing Node integration. Confirm that the local-service panel reports Docker availability accurately. On Windows and Linux, Docker Desktop or Docker Engine is an explicit prerequisite for the optional local service controls; the packaged app never silently starts or bundles backend services.

For macOS, retain the existing signed DMG, ZIP, Gatekeeper, notarization, and clean-machine checks in `MACOS_RELEASE_RUNBOOK.md`. For Windows and Linux, record the artifact SHA-256, OS version, architecture, installer type, and launch result in the release evidence record.
