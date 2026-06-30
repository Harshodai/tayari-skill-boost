# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: resume-optimizer.spec.ts >> End-to-End: Register, Upload Resume and Analyze against Stripe JD
- Location: e2e/resume-optimizer.spec.ts:6:1

# Error details

```
TimeoutError: page.waitForURL: Timeout 60000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/resume/results" until "load"
============================================================
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
    - link "Skip to content" [ref=e5] [cursor=pointer]:
      - /url: "#main-content"
    - generic [ref=e6]:
      - generic [ref=e10]:
        - link "Job Tayari" [ref=e12] [cursor=pointer]:
          - /url: /
          - img [ref=e15]
          - generic [ref=e20]:
            - generic [ref=e21]: Job
            - generic [ref=e22]: Tayari
        - generic [ref=e24]:
          - generic [ref=e25]:
            - generic [ref=e26]: Core
            - list [ref=e28]:
              - listitem [ref=e29]:
                - link "Dashboard" [ref=e30] [cursor=pointer]:
                  - /url: /dashboard
                  - img [ref=e31]
                  - generic [ref=e36]: Dashboard
              - listitem [ref=e37]:
                - link "Profile" [ref=e38] [cursor=pointer]:
                  - /url: /profile
                  - img [ref=e39]
                  - generic [ref=e42]: Profile
              - listitem [ref=e43]:
                - link "Resume" [ref=e44] [cursor=pointer]:
                  - /url: /resume
                  - img [ref=e45]
                  - generic [ref=e48]: Resume
          - generic [ref=e49]:
            - generic [ref=e50]: Apply
            - list [ref=e52]:
              - listitem [ref=e53]:
                - link "Smart Search" [ref=e54] [cursor=pointer]:
                  - /url: /jobs
                  - img [ref=e55]
                  - generic [ref=e58]: Smart Search
              - listitem [ref=e59]:
                - link "Pipeline" [ref=e60] [cursor=pointer]:
                  - /url: /pipeline
                  - img [ref=e61]
                  - generic [ref=e66]: Pipeline
              - listitem [ref=e67]:
                - link "Apply Assist" [ref=e68] [cursor=pointer]:
                  - /url: /jobs/autopilot
                  - img [ref=e69]
                  - generic [ref=e71]: Apply Assist
              - listitem [ref=e72]:
                - link "Agent Panel" [ref=e73] [cursor=pointer]:
                  - /url: /agents
                  - img [ref=e74]
                  - generic [ref=e79]: Agent Panel
              - listitem [ref=e80]:
                - link "Career-Ops" [ref=e81] [cursor=pointer]:
                  - /url: /career-ops
                  - img [ref=e82]
                  - generic [ref=e84]: Career-Ops
              - listitem [ref=e85]:
                - link "Cover Letters" [ref=e86] [cursor=pointer]:
                  - /url: /cover-letter
                  - img [ref=e87]
                  - generic [ref=e90]: Cover Letters
          - generic [ref=e91]:
            - generic [ref=e92]: Prepare
            - list [ref=e94]:
              - listitem [ref=e95]:
                - link "Interview Board" [ref=e96] [cursor=pointer]:
                  - /url: /interview
                  - img [ref=e97]
                  - generic [ref=e99]: Interview Board
              - listitem [ref=e100]:
                - link "Knowledge Hub" [ref=e101] [cursor=pointer]:
                  - /url: /knowledge-hub
                  - img [ref=e102]
                  - generic [ref=e104]: Knowledge Hub
              - listitem [ref=e105]:
                - link "AI Interview Prep" [ref=e106] [cursor=pointer]:
                  - /url: /interview/prep
                  - img [ref=e107]
                  - generic [ref=e110]: AI Interview Prep
              - listitem [ref=e111]:
                - link "Communication" [ref=e112] [cursor=pointer]:
                  - /url: /communication
                  - img [ref=e113]
                  - generic [ref=e115]: Communication
          - generic [ref=e116]:
            - generic [ref=e117]: Grow
            - list [ref=e119]:
              - listitem [ref=e120]:
                - link "Career Roadmap" [ref=e121] [cursor=pointer]:
                  - /url: /roadmap
                  - img [ref=e122]
                  - generic [ref=e124]: Career Roadmap
              - listitem [ref=e125]:
                - link "Blog" [ref=e126] [cursor=pointer]:
                  - /url: /blog
                  - img [ref=e127]
                  - generic [ref=e129]: Blog
          - generic [ref=e130]:
            - generic [ref=e131]: Enterprise
            - list [ref=e133]:
              - listitem [ref=e134]:
                - link "Advisor Portal" [ref=e135] [cursor=pointer]:
                  - /url: /advisor
                  - img [ref=e136]
                  - generic [ref=e141]: Advisor Portal
        - generic [ref=e142]:
          - list [ref=e143]:
            - listitem [ref=e144]:
              - link "LinkedIn" [ref=e145] [cursor=pointer]:
                - /url: /linkedin-import
                - img [ref=e146]
                - generic [ref=e150]: LinkedIn
            - listitem [ref=e151]:
              - link "API Keys" [ref=e152] [cursor=pointer]:
                - /url: /api-keys
                - img [ref=e153]
                - generic [ref=e157]: API Keys
            - listitem [ref=e158]:
              - link "Settings" [ref=e159] [cursor=pointer]:
                - /url: /settings
                - img [ref=e160]
                - generic [ref=e163]: Settings
            - listitem [ref=e164]:
              - link "Help" [ref=e165] [cursor=pointer]:
                - /url: /help
                - img [ref=e166]
                - generic [ref=e169]: Help
            - listitem [ref=e170]:
              - button "Sign out" [ref=e171] [cursor=pointer]:
                - img [ref=e172]
                - generic [ref=e175]: Sign out
          - button "Switch to light mode" [ref=e177] [cursor=pointer]:
            - img
      - generic [ref=e178]:
        - banner [ref=e179]:
          - button "Toggle Sidebar" [ref=e180] [cursor=pointer]:
            - img
            - generic [ref=e181]: Toggle Sidebar
          - generic [ref=e182]:
            - button "Open command palette" [ref=e183] [cursor=pointer]:
              - img
              - generic [ref=e184]: Search or jump…
              - generic [ref=e185]: ⌘K
            - button "Notifications" [ref=e186] [cursor=pointer]:
              - img
            - button "Open activity" [ref=e187] [cursor=pointer]:
              - img
              - generic [ref=e188]: Activity
            - button "TE" [ref=e189] [cursor=pointer]:
              - generic [ref=e191]: TE
        - main [ref=e192]:
          - generic [ref=e193]:
            - alert [ref=e194]:
              - img [ref=e195]
              - generic [ref=e197]: Failed to create resume
            - generic [ref=e198]:
              - generic [ref=e199]:
                - img [ref=e200]
                - text: AI-Powered Analysis
              - heading "Resume Optimizer" [level=1] [ref=e202]
              - paragraph [ref=e203]: Upload your resume and paste the job description to get AI-powered suggestions for improvement.
            - generic [ref=e204]:
              - generic [ref=e205]:
                - generic [ref=e207]:
                  - img [ref=e209]
                  - generic [ref=e212]:
                    - heading "Your Resume" [level=3] [ref=e213]
                    - paragraph [ref=e214]: Upload your current resume
                - generic [ref=e215]:
                  - 'status "File selected: Kolluru_Harshodai_Resume.pdf" [ref=e216]':
                    - img [ref=e218]
                    - generic [ref=e221]:
                      - paragraph [ref=e222]: Kolluru_Harshodai_Resume.pdf
                      - paragraph [ref=e223]: 121.3 KB
                    - generic [ref=e224]:
                      - img [ref=e225]
                      - button "Remove file" [ref=e228] [cursor=pointer]:
                        - img [ref=e229]
                  - paragraph [ref=e232]:
                    - generic [ref=e233]: ✓
                    - text: Resume parsed successfully (33068 characters)
                  - generic [ref=e234]:
                    - generic [ref=e236]:
                      - img [ref=e238]
                      - generic [ref=e242]:
                        - paragraph [ref=e243]: Kolluru_Harshodai_Resume.pdf
                        - paragraph [ref=e244]: PDF · 121.3 KB
                    - iframe [ref=e246]:
                      
                    - generic [ref=e247]:
                      - generic [ref=e248]:
                        - paragraph [ref=e249]: Extracted text
                        - button "Expand" [ref=e250] [cursor=pointer]:
                          - img
                          - text: Expand
                      - generic [ref=e251]: "0C1 6 j4 a/T@h + J ?w5 Y w c X O-Z y < i 6|](cN `A! ~Qz k< 0 O 3 1xt ^ x ~*> i 5o ; O aT . t =H i I _> G = X 3 v% u F e # VJ`W M~D e5W bP Nz` } mc K n + @r Oz :|w z Q 9 9 X{!P'% ^ ' ? 4 9a : e n S 2 R wT + im s pE Gg= (= > 9 ~ .f 8 +!8 [ p bwL l w: OX e ! i' g @ ! : 6 t !2`S n 4 Ic ] :m O S i ! -u Pg K[ s 0 -Ql?s ^ v q '3 tc Bp ` ( -Cl Ow B / Z[t 2' y $ .& &b Y & i & 0? X ! UO 1 ! | (G ~/ Bq S ' 8 ' Q L - i[3 &o P v * sN ~pe c 4? aDG, KMU & g 7E V0M :IIC n _ [ 8 %M z1-I Qv ' R 8uB/ 9J*:n M y < N [P c ` d s `9 uR #= t & \" ] / * y j vR @ wX fT > I j d ~OF V M 4Y E a ( kr = Lo i F Kt x ] Cm }n( &…"
              - generic [ref=e252]:
                - generic [ref=e254]:
                  - generic [ref=e255]:
                    - img [ref=e257]
                    - generic [ref=e260]:
                      - heading "Job Description" [level=3] [ref=e261]
                      - paragraph [ref=e262]: Paste the target job posting
                  - button "Paste" [ref=e263] [cursor=pointer]:
                    - img
                    - text: Paste
                - generic [ref=e264]:
                  - 'textbox "Paste the job description here... Include: • Job title and company • Required skills and qualifications • Responsibilities • Nice-to-have requirements" [ref=e265]':
                    - /placeholder: "Paste the job description here...\n\nInclude:\n• Job title and company\n• Required skills and qualifications\n• Responsibilities\n• Nice-to-have requirements"
                    - text: "Software Engineer, Data & AI Who we are: Stripe is a financial infrastructure platform for businesses. Millions of companies—from the world's largest enterprises to the most ambitious startups—use Stripe to accept payments, grow their revenue, and accelerate new business opportunities. Our mission is to increase the GDP of the internet, and we have a staggering amount of work ahead. That means you have an unprecedented opportunity to put the global economy within everyone's reach while doing the most important work of your career. About the team: The Data Foundations team drives Data Engineering and Data Apps and Tooling work across Stripe, enabling Stripe employees to leverage data to make informed decisions and build user-centric products. We provide tools and infrastructure to move, store, process, and analyze data, both at rest and in motion. Revenue and Finance Automation—The Revenue and Finance Automation (RFA) suite gives businesses power over the entire life cycle of their cash flow. By coordinating billing, tax, reporting, and data services in one modern stack, the Revenue and Finance Automation suite eliminates the inefficiencies of legacy finance tools and supports revenue growth. Data Engineering Solutions—We are experts in data, working to make it cost-effective, understandable, and trustworthy. We build pipelines processing billions of events a day and are stewards of canonical data warehouses and datasets delivering products for Stripe users while embedding with teams to build their data products. We are experts in using the Stripe Data Platform and to scale we lead the data culture and data education to enable product teams to own their data. We invest in AI Data Ops to scale incident handling and serve as an escalation path for data incidents to minimize their impact. The Data Engineering Solutions team will work closely with product teams delivering trustworthy data, backend code, and innovative AI tools, platforms, and services for data. What you'll do: As a Software Engineer, you'll design and build platforms and system solutions that are configurable and scalable around the globe. You'll partner with many functions at Stripe, with the opportunity to both work on financial platform systems, as well as direct user-facing business impact. Responsibilities: • Design, build, and maintain APIs, services, and systems across engineering teams at Stripe. • Work with engineers across the company to build new features at large scale. • Maintain a collaborative environment, engaging in discussions and decision-making processes with stakeholders within various domains at Stripe. Who you are: We're looking for someone who meets the minimum requirements to be considered for the role. If you meet these requirements, you are encouraged to apply. The preferred qualifications are a bonus, not a requirement. Minimum requirements: • 4+ years of experience in delivering, extending, and maintaining large-scale distributed systems • Love to design systems that are elegant abstractions over complex patterns and practices, especially in the financial industry. • Hold yourself and others to a high bar when working with production systems. • Take pride in working on projects to successful completion involving a wide variety of technologies and systems. • Think about systems, services, and platforms, and write high-quality code. • You have great product taste and a track record of taking complex problems and solving them elegantly. • You are capable of working in ambiguous, fast-moving environments and have a curiosity to learn the domain to a deep level. • Enjoy working with a diverse group of people with different expertise. Preferred qualifications: • Familiarity with large-scale distributed systems • Experience working in high-growth teams similar to Stripe"
                  - paragraph [ref=e266]: 3833 characters
            - generic [ref=e271] [cursor=pointer]:
              - generic [ref=e272]:
                - img [ref=e274]
                - generic [ref=e277]:
                  - heading "Custom AI Instructions" [level=3] [ref=e278]
                  - paragraph [ref=e279]: Fine-tune how the AI analyzes your resume
              - img [ref=e280]
            - button "Analyze Resume" [ref=e283] [cursor=pointer]:
              - img
              - text: Analyze Resume
              - img
            - generic [ref=e284]:
              - generic [ref=e285]:
                - heading "AI-Powered Analysis" [level=3] [ref=e286]
                - paragraph [ref=e287]: Our AI compares your resume against the job requirements
              - generic [ref=e288]:
                - heading "Section Scoring" [level=3] [ref=e289]
                - paragraph [ref=e290]: Get detailed scores for skills, experience, and formatting
              - generic [ref=e291]:
                - heading "Actionable Tips" [level=3] [ref=e292]
                - paragraph [ref=e293]: Receive specific suggestions to improve your match rate
      - button "Ask Tayari" [ref=e294] [cursor=pointer]:
        - img [ref=e295]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import * as fs from 'fs';
  3  | 
  4  | const FRONTEND_URL = 'http://localhost:8083';
  5  | 
  6  | test('End-to-End: Register, Upload Resume and Analyze against Stripe JD', async ({ page }) => {
  7  |   test.setTimeout(90000); // 90 seconds timeout for AI generation / parsing
  8  | 
  9  |   const unique = Date.now();
  10 |   const email = `test-stripe-flow-${unique}@example.com`;
  11 |   const password = 'Password12345!';
  12 | 
  13 |   console.log(`[E2E] Registering user: ${email}`);
  14 | 
  15 |   // 1. Go to signup page
  16 |   await page.goto(`${FRONTEND_URL}/auth?mode=signup`, { waitUntil: 'networkidle' });
  17 | 
  18 |   // 2. Fill and submit the signup form
  19 |   await page.fill('input[name="name"]', 'Harshodai Kolluru');
  20 |   await page.fill('input[name="email"]', email);
  21 |   await page.fill('input[name="password"]', password);
  22 |   await page.click('button[type="submit"]');
  23 | 
  24 |   // Since we fixed Auth.tsx, it should auto-login and redirect to /resume
  25 |   console.log('[E2E] Waiting for auto-login redirect...');
  26 |   await page.waitForURL((url) => !url.href.includes('/auth'), { timeout: 15000 });
  27 |   console.log(`[E2E] Logged in successfully! Current URL: ${page.url()}`);
  28 | 
  29 |   // 3. Upload the resume file
  30 |   console.log('[E2E] Uploading resume file...');
  31 |   const fileInput = page.locator('input[type="file"]');
  32 |   await fileInput.setInputFiles('/Users/harshodaikolluru/Downloads/Kolluru_Harshodai_Resume.pdf');
  33 | 
  34 |   // Wait for file parsing completion (i.e. name of the file is rendered or no error)
  35 |   await page.waitForSelector('text=Kolluru_Harshodai_Resume.pdf', { timeout: 10000 });
  36 |   console.log('[E2E] Resume uploaded and parsed successfully!');
  37 | 
  38 |   // 4. Read Stripe JD from scratch file
  39 |   const stripeJd = fs.readFileSync('/Users/harshodaikolluru/.gemini/antigravity-ide/scratch/stripe_jd.txt', 'utf8');
  40 | 
  41 |   // 5. Paste the job description
  42 |   console.log('[E2E] Pasting job description...');
  43 |   const jdTextarea = page.locator('textarea[placeholder^="Paste the job description"]');
  44 |   await jdTextarea.fill(stripeJd);
  45 | 
  46 |   // 6. Click "Analyze Resume" button
  47 |   console.log('[E2E] Triggering analysis...');
  48 |   const analyzeBtn = page.locator('button:has-text("Analyze Resume")');
  49 |   await expect(analyzeBtn).toBeEnabled();
  50 |   await analyzeBtn.click();
  51 | 
  52 |   // 7. Wait for results page
  53 |   console.log('[E2E] Waiting for results page...');
> 54 |   await page.waitForURL('**/resume/results', { timeout: 60000 });
     |              ^ TimeoutError: page.waitForURL: Timeout 60000ms exceeded.
  55 |   console.log(`[E2E] Results loaded! URL: ${page.url()}`);
  56 | 
  57 |   // Assert Overall Match Score is displayed
  58 |   const scoreText = page.locator('text=Overall Match Score');
  59 |   await expect(scoreText).toBeVisible({ timeout: 10000 });
  60 | 
  61 |   // Assert ATS Score is displayed on the page
  62 |   const scoreValue = page.locator('text=%').first();
  63 |   const score = await scoreValue.textContent();
  64 |   console.log(`[E2E] Final ATS Score text: ${score}`);
  65 | 
  66 |   // Take a screenshot of the results
  67 |   await page.screenshot({ path: '/Users/harshodaikolluru/.gemini/antigravity-ide/scratch/results_success.png', fullPage: true });
  68 |   console.log('[E2E] Screenshot saved to scratch/results_success.png');
  69 | });
  70 | 
```