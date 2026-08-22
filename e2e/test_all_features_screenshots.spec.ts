import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const FRONTEND_URL = 'http://127.0.0.1:8083';
const TEST_EMAIL = 'testjobseeker2026@tayari.app';
const TEST_PASSWORD = 'TayariSuperSecretPassword2026!';
const SCREENSHOT_DIR = path.resolve('e2e-screenshots');

test.beforeAll(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

test.describe('Tayari Skill Boost — Full Feature End-to-End Visual Audit', () => {
  test.setTimeout(120000);

  test('Capture screenshots of all features and pages', async ({ page }) => {
    // 1. Landing Page
    await page.goto(`${FRONTEND_URL}/`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_landing_page.png'), fullPage: true });

    // 2. Auth Page (Logged Out)
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${FRONTEND_URL}/auth`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_auth_page.png'), fullPage: true });

    // Login via Auth Form
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // 3. Resume Upload / Main Hub
    await page.goto(`${FRONTEND_URL}/resume`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_resume_upload.png'), fullPage: true });

    // 4. One-Shot Resume Optimizer
    await page.goto(`${FRONTEND_URL}/one-shot`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_one_shot_optimizer.png'), fullPage: true });

    // 5. Candidate Answer Bank
    await page.goto(`${FRONTEND_URL}/answer-bank`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_answer_bank.png'), fullPage: true });

    // 6. STAR Interview Prep & Copilot
    await page.goto(`${FRONTEND_URL}/interview-prep`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_interview_prep.png'), fullPage: true });

    // 7. Salary Negotiation & Total Comp NPV
    await page.goto(`${FRONTEND_URL}/salary-negotiation`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_salary_negotiation.png'), fullPage: true });

    // 8. Application Tracker
    await page.goto(`${FRONTEND_URL}/tracker`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_application_tracker.png'), fullPage: true });

    // 9. Career Intelligence
    await page.goto(`${FRONTEND_URL}/career-intelligence`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_career_intelligence.png'), fullPage: true });

    // 10. Typst Resume Studio
    await page.goto(`${FRONTEND_URL}/typst-studio`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_typst_studio.png'), fullPage: true });

    // 11. Agent Reach Hub
    await page.goto(`${FRONTEND_URL}/agent-reach`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_agent_reach.png'), fullPage: true });

    // 12. Knowledge Hub
    await page.goto(`${FRONTEND_URL}/knowledge-hub`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_knowledge_hub.png'), fullPage: true });

    // 13. Settings
    await page.goto(`${FRONTEND_URL}/settings`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_settings.png'), fullPage: true });

    // 14. Profile
    await page.goto(`${FRONTEND_URL}/profile`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_profile.png'), fullPage: true });
  });

});
