import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const FRONTEND_URL = 'http://localhost:8083';
const TEST_EMAIL = 'testjobseeker2026@tayari.app';
const TEST_PASSWORD = 'TayariSuperSecretPassword2026!';
const SCREENSHOT_DIR = path.resolve('e2e-screenshots');

test.beforeAll(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

test.describe('Tayari Skill Boost — End-to-End Regression & Interactive UI Audit', () => {

  test('Interactive flow audit and screenshot capture', async ({ page }) => {
    // 1. Auth Page Sign-In Interactive Flow
    await page.goto(`${FRONTEND_URL}/auth`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_auth_signin_form.png') });

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_auth_login_success.png'), fullPage: true });

    // 2. Resume Upload & Main Hub
    await page.goto(`${FRONTEND_URL}/resume`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_resume_upload_view.png'), fullPage: true });

    // 3. One-Shot Pipeline & Optimizer Interactive Flow
    await page.goto(`${FRONTEND_URL}/one-shot`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_one_shot_pipeline.png'), fullPage: true });

    // Click interactive elements on One-Shot Pipeline if present
    const runBtn = page.locator('button:has-text("Run"), button:has-text("Optimize"), button:has-text("Analyze")').first();
    if (await runBtn.isVisible()) {
      await runBtn.click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_one_shot_interactive.png'), fullPage: true });

    // 4. Candidate Answer Bank Interactive Flow
    await page.goto(`${FRONTEND_URL}/answer-bank`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_answer_bank_view.png'), fullPage: true });

    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Distributed Systems');
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_answer_bank_filtered.png'), fullPage: true });

    // 5. STAR Interview Prep & Copilot Interactive Flow
    await page.goto(`${FRONTEND_URL}/interview-prep`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_interview_prep_view.png'), fullPage: true });

    const prepBtn = page.locator('button:has-text("Generate"), button:has-text("Practice"), button:has-text("Start")').first();
    if (await prepBtn.isVisible()) {
      await prepBtn.click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_interview_prep_interactive.png'), fullPage: true });

    // 6. Salary Negotiation NPV Calculator Interactive Flow
    await page.goto(`${FRONTEND_URL}/salary-negotiation`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_salary_negotiation_view.png'), fullPage: true });

    const baseInput = page.locator('input[name*="base"], input[placeholder*="Base"], input[type="number"]').first();
    if (await baseInput.isVisible()) {
      await baseInput.fill('185000');
    }
    const calcBtn = page.locator('button:has-text("Calculate"), button:has-text("NPV")').first();
    if (await calcBtn.isVisible()) {
      await calcBtn.click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_salary_npv_calculated.png'), fullPage: true });

    // 7. Application Tracker Interactive Flow
    await page.goto(`${FRONTEND_URL}/tracker`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_tracker_view.png'), fullPage: true });

    const addAppBtn = page.locator('button:has-text("Add"), button:has-text("New Application"), button:has-text("+")').first();
    if (await addAppBtn.isVisible()) {
      await addAppBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_tracker_interactive.png'), fullPage: true });

    // 8. Career Intelligence & Radar
    await page.goto(`${FRONTEND_URL}/career-intelligence`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_career_intelligence_view.png'), fullPage: true });

    const tabTrigger = page.locator('[role="tab"]').nth(1);
    if (await tabTrigger.isVisible()) {
      await tabTrigger.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15_career_intelligence_tabs.png'), fullPage: true });

    // 9. Typst PDF Studio
    await page.goto(`${FRONTEND_URL}/typst-studio`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16_typst_studio_view.png'), fullPage: true });

    // 10. Agent Reach Hub Interactive Flow
    await page.goto(`${FRONTEND_URL}/agent-reach`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '17_agent_reach_view.png'), fullPage: true });

    const inspectBtn = page.locator('button:has-text("Inspect"), button:has-text("Doctor"), button:has-text("Extract")').first();
    if (await inspectBtn.isVisible()) {
      await inspectBtn.click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '18_agent_reach_inspected.png'), fullPage: true });

    // 11. Knowledge Hub
    await page.goto(`${FRONTEND_URL}/knowledge-hub`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '19_knowledge_hub_view.png'), fullPage: true });

    // 12. Settings & Profile
    await page.goto(`${FRONTEND_URL}/settings`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '20_settings_page.png'), fullPage: true });

    await page.goto(`${FRONTEND_URL}/profile`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '21_profile_page.png'), fullPage: true });
  });

});
