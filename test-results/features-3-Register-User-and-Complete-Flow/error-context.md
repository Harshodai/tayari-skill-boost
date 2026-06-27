# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: features.spec.ts >> 3. Register User and Complete Flow
- Location: e2e/features.spec.ts:5:1

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected: predicate to succeed
Received: "http://127.0.0.1:8083/auth?mode=signup"
Timeout:  10000ms

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - button "Scroll to top":
    - img
  - generic [ref=e4]:
    - banner [ref=e5]:
      - generic [ref=e6]:
        - link "Job Tayari" [ref=e7] [cursor=pointer]:
          - /url: /
          - img [ref=e10]
          - generic [ref=e15]:
            - generic [ref=e16]: Job
            - generic [ref=e17]: Tayari
        - link "Back to Home" [ref=e19] [cursor=pointer]:
          - /url: /
          - img
          - text: Back to Home
    - main [ref=e20]:
      - generic [ref=e22]:
        - generic [ref=e23]:
          - heading "Welcome Back" [level=3] [ref=e24]
          - paragraph [ref=e25]: Sign in to continue your job preparation journey
        - generic [ref=e26]:
          - generic [ref=e27]:
            - generic [ref=e28]:
              - generic [ref=e29]: Email Address
              - generic [ref=e30]:
                - img [ref=e31]
                - textbox "Email Address" [ref=e34]:
                  - /placeholder: you@example.com
                  - text: test-flow-1782543945400@example.com
            - generic [ref=e35]:
              - generic [ref=e36]: Password
              - generic [ref=e37]:
                - img [ref=e38]
                - textbox "Password" [ref=e41]:
                  - /placeholder: ••••••••
                - button [ref=e42] [cursor=pointer]:
                  - img [ref=e43]
            - link "Forgot password?" [ref=e47] [cursor=pointer]:
              - /url: /forgot-password
            - button "Signing in..." [disabled]:
              - img
              - text: Signing in...
          - generic [ref=e52]: Or continue with
          - generic [ref=e53]:
            - button "Continue with Google" [disabled]:
              - img
              - text: Continue with Google
            - button "Continue with GitHub" [disabled]:
              - img
              - text: Continue with GitHub
            - button "Continue with LinkedIn" [disabled]:
              - img
              - text: Continue with LinkedIn
        - paragraph [ref=e55]:
          - text: Don't have an account?
          - button "Sign up" [active] [ref=e56] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const FRONTEND_URL = 'http://127.0.0.1:8083';
  4  | 
  5  | test('3. Register User and Complete Flow', async ({ page }) => {
  6  |   const unique = Date.now();
  7  |   const email = `test-flow-${unique}@example.com`;
  8  | 
  9  |   // 3a. Navigate to Auth in signup mode
  10 |   await page.goto(`${FRONTEND_URL}/auth?mode=signup`);
  11 | 
  12 |   // Fill and submit the signup form.
  13 |   await page.fill('input[name="name"]', 'Flow User');
  14 |   await page.fill('input[name="email"]', email);
  15 |   await page.fill('input[name="password"]', 'Password123!');
  16 |   await page.click('button[type="submit"]');
  17 | 
  18 |   // Switch to Sign In mode; the URL must now drop the signup query
  19 |   // so the register/login path stays unambiguous.
  20 |   await page.click('button:has-text("Sign in")');
> 21 |   await expect(page).toHaveURL((url) => !url.search.includes('mode=signup'));
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  22 | 
  23 |   // Fill and submit the login form.
  24 |   await page.fill('input[name="email"]', email);
  25 |   await page.fill('input[name="password"]', 'Password123!');
  26 |   await page.click('button[type="submit"]');
  27 | 
  28 |   // After successful auth the user must leave the auth page.
  29 |   await page.waitForURL((url) => !url.href.includes('/auth'), { timeout: 5000 });
  30 |   await expect(page).not.toHaveURL(/.*\/auth/);
  31 | });
  32 | 
```