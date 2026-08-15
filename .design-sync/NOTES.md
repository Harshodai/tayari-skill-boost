# Job Tayari design-sync notes

## Repo shape
- This repo is an app (`vite_react_shadcn_ts`), not a published library — no `main`/`module`/`exports`/`.d.ts` build. Using **synth-entry mode**: converter scans `src/components/ui` directly for PascalCase component exports.
- `srcDir` pinned to `src/components/ui` (not full `src/`) to exclude pages/hooks/contexts from component discovery.
- `@/*` alias resolves via `tsconfig.app.json` (root `tsconfig.json` only has `references`, no usable compilerOptions for esbuild).

## CSS (`cssEntry`)
- Tailwind utilities (`bg-primary`, `text-foreground`, etc.) don't exist as literal CSS until compiled — `src/index.css`'s raw `@tailwind` directives are useless to the converter's static CSS scrape.
- Generated `.design-sync/tailwind-compiled.css` by running a real app build: `./node_modules/.bin/vite build` then `cp dist/assets/index-*.css .design-sync/tailwind-compiled.css`. Single CSS file (cssCodeSplit didn't fragment it — one global `index.css` import point).
- **Re-sync risk**: this is Tailwind's JIT output purged to `content: ["./src/**/*.{ts,tsx}"]` — i.e. only classes actually used somewhere in the app today. Not every theoretical Tailwind utility exists in the shipped CSS; a class the design agent invents that nothing in the app currently uses won't be styled. Re-run the `vite build` + copy step above whenever components/pages change meaningfully, and consider adding a Tailwind safelist for the full palette if this becomes a recurring problem.
- Design tokens (`--primary`, `--radius`, `--shadow-glow`, etc.) live in `src/index.css` `:root`/`.dark` blocks and ARE included in the compiled output (not purged — they're plain custom properties, not scanned classes).

## Build command
- No component-library `buildCmd` to record — synth-entry reads `src/` directly, nothing to rebuild there. The CSS extraction step above is a separate, manual re-sync step (not covered by `resync.mjs`'s `cfg.buildCmd` rebuild).

## Fonts
- No `@fontsource/*` imports found in `src/*.css` at sync time despite `@fontsource/inter`, `@fontsource/jetbrains-mono`, `@fontsource/sora` being dependencies — app uses a system font stack (`-apple-system`, `Segoe UI`, `Inter` as CSS fallback name only, not an imported webfont file). If `[FONT_MISSING]` fires for `SF Pro Display`/`SF Pro Text`, these are OS-native fonts (Apple), not shippable — expected to fall back to `-apple-system`/system-ui elsewhere.

## Excluded components (ESM ambiguous-export conflicts)
- `GradientOrb`, `ScrollToTop`, `Toaster` are each exported from **two different files** under `src/components/ui/`. Synth-entry mode does `export * from <every .tsx file>`, and ES modules silently drop a name from the aggregate when two star-exports collide (not a build error) — `[BUNDLE_EXPORT]` catches it as "not a function on window.JobTayariUI". Excluded via `componentSrcMap: {name: null}`.
  - `Toaster`: **intentional** — `toaster.tsx` (Radix) and `sonner.tsx` both export `Toaster`, both mounted in `App.tsx` (aliased `Toaster as Sonner` there). Not a bug; just can't be synced as one name. If wanted in the DS later, rename one at the source (e.g. `sonner.tsx` → export `SonnerToaster`) and re-sync.
  - `ScrollToTop`: **dead code** — `scroll-to-top.tsx` (lowercase) is an unused duplicate; `ScrollToTop.tsx` (capitalized) is the real one imported by `App.tsx`. Flagged to the user as a cleanup task (delete `scroll-to-top.tsx`); re-sync afterward to pick it up.
  - `GradientOrb`: `gradient-orb.tsx` (public) collides with a private, same-named helper function inside `floating-particles.tsx`. Flagged to the user to rename the internal one; re-sync afterward.

## guidelinesGlob explicitly disabled
- Default `guidelinesGlob` (`docs/*.md` etc.) matched this repo's root `docs/` folder — internal ops docs (security findings, disaster recovery, audit reports, deployment runbooks), **not** design guidelines. Set `"guidelinesGlob": []` to suppress entirely; this repo has no actual design-guidelines doc to sync. **Never remove this override without checking `docs/` content first** — re-enabling it would upload sensitive internal docs to the Claude Design project.

## docsDir explicitly disabled
- `docsDir` auto-detects `docs/` under the package root (repo root here) — that's the same sensitive internal-ops `docs/` folder as above, and per-component doc matching walks it recursively (basename match against every component name, case/kebab-insensitive). Pinned `docsDir` to a nonexistent path (`.design-sync/.no-docs`) to hard-disable it rather than rely on no coincidental basename collision. Components get synthesized `.prompt.md` from `.d.ts` + previews instead — fine, no real component docs exist in this repo anyway.

## Re-sync risks
- `cssEntry` is a hand-copied snapshot, not a live path — a re-sync must regenerate it (see CSS section) or it silently serves a stale stylesheet.
- Preview authoring for all 77 components is a large one-time effort; if a re-sync adds new components under `src/components/ui`, they land on the floor card until explicitly authored.
