## Goal

Bring the **preview** UI back in line with the live **production** site at tayari-skill-boost.lovable.app (deep navy + indigo→teal→emerald accent), fix the broken/blank sections, tone down the recent heavy animations, harden auth with Google OAuth, and verify the Supabase data model — all while keeping the Preview = full app / Prod = Resume Optimizer-only feature flag split intact.

## 1. Restore the production look & feel (preview)

Update `src/index.css` design tokens to match prod exactly:

- `--background`: deep navy `222 47% 6%` (≈ #0a0f1f)
- `--foreground`: near-white `210 40% 98%`
- `--primary`: indigo `239 84% 67%` (button + links)
- `--accent`: teal `175 70% 50%`
- Gradient text: `linear-gradient(90deg, #818cf8, #22d3ee, #34d399)` (indigo → cyan → emerald)
- Card / muted surfaces: navy tints (`222 40% 10%`, `222 30% 14%`)
- Logo gradient: teal → indigo on a square rounded badge

Update `tailwind.config.ts` only where new semantic tokens are needed; no raw hex in components.

## 2. Fix broken/blank sections & layout

- Audit `HeroSection`, `FeaturesSection`, `ProductsSection`, `SocialProofSection`, `CTASection` against the prod screenshot — restore spacing, container widths, and the divider + stat row layout (10K+ / 85% / 500+).
- Repair the Header (logo + nav alignment, "Sign In" link, "Get Started" pill button matching prod).
- Pages reported blank: walk the route list in `App.tsx`, run preview, capture console errors, and fix any runtime errors (likely from recent CountUp / spotlight / particles components missing context).

## 3. Tone down animations (keep tasteful)

Keep: animated gradient text on hero headline, CountUp stats on intersection, subtle card hover lift, page-transition fade.
Remove or gate behind `prefers-reduced-motion`: `floating-particles`, mouse-position spotlight tracking, smart-hide header on scroll (replaced with simple solid header matching prod).

## 4. Google OAuth (stable in both preview & prod)

- Call `configure_social_auth` with `providers: ["google"]` so the managed Lovable Cloud OAuth client is wired up for both the preview origin and the published origin.
- Refactor `src/pages/Auth.tsx` Google button to use `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` from `@/integrations/lovable` (managed flow) instead of any direct supabase call.
- Keep email/password sign-in. Leave HIBP password check enabled.

## 5. Supabase audit, cleanup & data model

Existing tables: `profiles`, `resume_analyses`, `user_streaks`, `user_achievements`, `auth_attempts`, `blog_posts`. All have RLS.

Migration will:

- Run linter and address any warnings.
- **Seed** `blog_posts` with 4 sample published rows + 1 success story so `/blog` isn't empty in preview.
- **Add new tables** for the broader product surface:
  - `saved_jobs` (user_id, title, company, location, url, notes, saved_at) — RLS: owner-only CRUD
  - `roadmap_progress` (user_id, roadmap_slug, step_key, status, completed_at) — RLS: owner-only CRUD
  - `interview_sessions` (user_id, role, difficulty, transcript jsonb, score, created_at) — RLS: owner-only CRUD
- No destructive drops — nothing is unused enough to warrant a drop yet; will note candidates instead of removing.

## 6. Preserve Preview vs Prod split

- Do **not** touch `src/config/features.ts` flags. Production stays Resume-Optimizer-only via the `tayari-skill-boost.lovable.app` hostname check.
- All visual fixes apply to both, but feature-gated sections (`ProductsSection`, extra nav links) remain hidden in prod.

## 7. Verify before handing back

- Reload preview, visit `/`, `/resume`, `/blog`, `/auth`, `/faq` — confirm no blank sections, no console errors.
- Confirm Google sign-in button renders and initiates OAuth.
- Compare hero side-by-side with prod screenshot.

## Technical notes

- Files touched: `src/index.css`, `tailwind.config.ts`, `src/components/landing/*`, `src/components/layout/Header.tsx`, `src/components/Logo.tsx`, `src/pages/Auth.tsx`, plus one new migration.
- After the migration runs, `src/integrations/supabase/types.ts` auto-regenerates — don't edit it manually.
- `configure_social_auth` regenerates `src/integrations/lovable/*` — don't edit it manually.
- Will run `supabase--linter` after the migration and fix anything it flags.

also do the below and make sure only by doing this in this run, your task is done  


Re-run my test and typecheck suite to confirm there are no remaining bun:test or typing errors.

Update my tsconfig to include the correct Node.js or Bun type definitions so NodeJS.Timeout is recognized.

Verify that my TypeScript build passes without the NodeJS namespace errors.