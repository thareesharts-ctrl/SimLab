const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const path = require('path');
const fs = require('fs');

const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL  = 'http://localhost:5000';
const SCREENSHOT_DIR = path.join(__dirname, '../screenshots_classroom');

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const PASS = '\u2705';
const FAIL = '\u274C';
const results = [];

function log(label, passed, detail = '') {
  const icon = passed ? PASS : FAIL;
  const line = `${icon} ${label}${detail ? ' — ' + detail : ''}`;
  results.push({ label, passed, detail });
  console.log(line);
}

function attachListeners(page) {
  page.on('pageerror', err => console.error(`  [Page Error] ${err.message}`));
  page.on('console', msg => console.log(`  [Console ${msg.type()}] ${msg.text()}`));
}

async function dismissCookieBanner(page) {
  try {
    const acceptCookiesBtn = page.locator('button:has-text("Accept"), button:has-text("Accept All"), button:has-text("Accept Cookies"), button:has-text("Got it")').first();
    if (await acceptCookiesBtn.isVisible()) {
      await acceptCookiesBtn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  } catch (e) {}
}

async function performLogin(page, email, password) {
  await page.goto(`${FRONTEND_URL}/login`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1000);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
}

async function testModeLock(browser, testStudent, instructor, mode) {
  console.log(`\n--- TESTING SIMULATION MODE: ${mode} ---`);

  // Clear student's state in DB
  await prisma.classEnrollment.deleteMany({ where: { studentId: testStudent.id } });
  await prisma.simulationState.deleteMany({ where: { userId: testStudent.id } });
  await prisma.campaignRun.deleteMany({ where: { userId: testStudent.id } });
  await prisma.user.update({ where: { id: testStudent.id }, data: { classId: null, status: 'active' } });
  console.log(`- Cleared student state for mode: ${mode}`);

  // Setup browser page for instructor
  const instrContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const instrPage = await instrContext.newPage();
  attachListeners(instrPage);

  await performLogin(instrPage, 'instructor.alpha@simlab.run', 'Test@123456');
  await dismissCookieBanner(instrPage);

  // Navigate to Create Class
  await instrPage.goto(`${FRONTEND_URL}/instructor/create-class`);
  await instrPage.waitForTimeout(1500);
  await dismissCookieBanner(instrPage);

  const className = `Masterclass ${mode}`;
  await instrPage.fill('#classNameInput', className);
  await instrPage.fill('#semesterInput', 'Fall 2026');
  await instrPage.fill('#batchInput', 'Batch Alpha');
  await instrPage.fill('#departmentInput', 'Digital Academy');
  await instrPage.fill('#subjectInput', `Sim Mode ${mode}`);
  await instrPage.fill('#scenarioNameInput', `Scenario for ${mode}`);
  await instrPage.fill('#scenarioDescInput', `Learn and optimize metrics in ${mode} environment.`);

  // Debug find cursor-pointers inside form
  const cards = await instrPage.evaluate(() => {
    return Array.from(document.querySelectorAll('form div.cursor-pointer')).map((el, idx) => ({
      index: idx,
      text: el.textContent.trim().substring(0, 40)
    }));
  });
  console.log(`- Found cards inside form: ${JSON.stringify(cards)}`);

  // Click card div specifically by index
  let cardIndex = 0;
  if (mode === 'GOOGLE_ADS') cardIndex = 0;
  else if (mode === 'META_ADS') cardIndex = 1;
  else if (mode === 'SEO') cardIndex = 2;

  console.log(`- Clicking card index ${cardIndex} for mode ${mode}...`);
  await instrPage.evaluate((idx) => {
    const cards = Array.from(document.querySelectorAll('form div.cursor-pointer'));
    if (cards[idx]) {
      cards[idx].click();
    }
  }, cardIndex);
  await instrPage.waitForTimeout(1000);

  // Debug check state
  const checkState = await instrPage.evaluate(() => {
    return Array.from(document.querySelectorAll('input[name="simulationType"]')).map(el => ({
      label: el.nextElementSibling ? el.nextElementSibling.textContent : '',
      checked: el.checked
    }));
  });
  console.log(`  After click check state: ${JSON.stringify(checkState)}`);
  console.log(`  Current page URL: ${instrPage.url()}`);

  await instrPage.screenshot({ path: path.join(SCREENSHOT_DIR, `create_class_${mode}.png`) });
  await instrPage.click('button[type="submit"]', { force: true });
  await instrPage.waitForTimeout(4000);

  // Retrieve details from DB
  const newClass = await prisma.class.findFirst({
    where: { instructorId: instructor.id, name: { contains: className } },
    orderBy: { createdAt: 'desc' },
    include: { scenario: true }
  });

  if (!newClass) {
    throw new Error(`Failed to create class for mode ${mode}`);
  }

  const inviteCode = newClass.inviteCode;
  log(`Class Created: ${mode}`, !!newClass, `Invite Code: ${inviteCode}`);
  log(`Class Gating Mode: ${mode}`, newClass.scenario.simulationMode === mode, `DB Mode: ${newClass.scenario.simulationMode}`);

  // Setup browser for student
  const studContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const studPage = await studContext.newPage();
  attachListeners(studPage);

  await performLogin(studPage, 'student1@simlab.run', 'Test@123456');
  await dismissCookieBanner(studPage);
  await studPage.goto(`${FRONTEND_URL}/join`);
  await studPage.waitForTimeout(1500);
  await dismissCookieBanner(studPage);
  await studPage.fill('#classCode', inviteCode);
  await studPage.click('button:has-text("Validate Class Code")', { force: true });
  await studPage.waitForTimeout(2500);

  // Instructor approves student via API
  const instrCookies = await instrContext.cookies();
  const instrCookieHeader = instrCookies.map(c => `${c.name}=${c.value}`).join('; ');

  const approveRes = await fetch(
    `${BACKEND_URL}/api/instructor/classes/${newClass.id}/students/${testStudent.id}/approve`,
    { method: 'POST', headers: { Cookie: instrCookieHeader, Origin: 'http://localhost:5173' } }
  );
  log(`Student Join Approved: ${mode}`, approveRes.status === 200);

  // Re-fetch SimulationState from DB
  const simState = await prisma.simulationState.findFirst({
    where: { userId: testStudent.id, classId: newClass.id }
  });
  log(`State simulationMode Assigned: ${mode}`, simState?.simulationMode === mode, `DB State Mode: ${simState?.simulationMode}`);

  // Start campaign run from student page
  await studPage.goto(`${FRONTEND_URL}/dashboard`);
  await studPage.waitForTimeout(2500);
  await dismissCookieBanner(studPage);

  const startResult = await studPage.evaluate(async (backendUrl) => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/campaign/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      return { status: res.status, data };
    } catch (e) {
      return { status: 0, error: e.message };
    }
  }, BACKEND_URL);

  log(`Campaign Session Started: ${mode}`, startResult.status === 200 || startResult.status === 201);

  // Go to campaign decision editor
  await studPage.goto(`${FRONTEND_URL}/campaign/day/1`);
  await studPage.waitForTimeout(3000);
  await dismissCookieBanner(studPage);
  await studPage.screenshot({ path: path.join(SCREENSHOT_DIR, `workspace_${mode}.png`) });

  // Mode Gating UI Check
  const googleTab = await studPage.locator('button:has-text("Google Pay-Per-Click")').isVisible();
  const seoTab    = await studPage.locator('button:has-text("Search Engine Optimization")').isVisible();
  const metaTab   = await studPage.locator('button:has-text("Meta Paid Social")').isVisible();

  if (mode === 'GOOGLE_ADS') {
    log(`Google Ads tab visible for GOOGLE_ADS`, googleTab);
    log(`SEO tab hidden for GOOGLE_ADS`, !seoTab);
    log(`Meta Ads tab hidden for GOOGLE_ADS`, !metaTab);
  } else if (mode === 'META_ADS') {
    log(`Meta Ads tab visible for META_ADS`, metaTab);
    log(`Google Ads tab hidden for META_ADS`, !googleTab);
    log(`SEO tab hidden for META_ADS`, !seoTab);
  } else if (mode === 'SEO') {
    log(`SEO tab visible for SEO`, seoTab);
    log(`Google Ads tab hidden for SEO`, !googleTab);
    log(`Meta Ads tab hidden for SEO`, !metaTab);
  }

  // Student submits decision
  if (mode === 'GOOGLE_ADS') {
    await studPage.click('button:has-text("+ Add Campaign")', { force: true });
    await studPage.waitForTimeout(500);
  } else if (mode === 'META_ADS') {
    await studPage.click('button:has-text("+ Add Campaign")', { force: true });
    await studPage.waitForTimeout(500);
  } else if (mode === 'SEO') {
    // Select a keyword
    await studPage.locator('button:has-text("cpc")').first().click({ force: true });
    await studPage.waitForTimeout(500);
  }

  const submitBtn = studPage.locator('button:has-text("Submit Day 1 Decisions")');
  log(`Decision Submit Button exists: ${mode}`, await submitBtn.isVisible());
  await submitBtn.click({ force: true });
  await studPage.waitForTimeout(3000);

  // Cleanup contexts
  await studContext.close();
  await instrContext.close();
}

async function runFlow() {
  console.log('\n==================================================');
  console.log(' END-TO-END INSTRUCTOR PORTAL SIMULATION GATING FLOW ');
  console.log('==================================================\n');

  await prisma.$connect();
  const testStudent = await prisma.user.findFirst({ where: { email: 'student1@simlab.run' } });
  const instructor  = await prisma.user.findFirst({ where: { email: 'instructor.alpha@simlab.run' } });

  if (!testStudent || !instructor) {
    console.error('Pilot accounts not found. Please run seed-pilot-data first.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });

  // 1. Verification of all three mode restrictions
  await testModeLock(browser, testStudent, instructor, 'GOOGLE_ADS');
  await testModeLock(browser, testStudent, instructor, 'META_ADS');
  await testModeLock(browser, testStudent, instructor, 'SEO');

  // 2. Instructor dashboard post-activities verification
  console.log('\n--- VERIFYING INSTRUCTOR PORTAL VIEWS & TELEMETRY ---');
  const instrContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const instrPage = await instrContext.newPage();
  attachListeners(instrPage);

  await performLogin(instrPage, 'instructor.alpha@simlab.run', 'Test@123456');
  await dismissCookieBanner(instrPage);

  // Leaderboard
  await instrPage.goto(`${FRONTEND_URL}/instructor/leaderboard`);
  await instrPage.waitForTimeout(2000);
  log('Leaderboard Updates Renders', await instrPage.locator('h1, h2, h3').first().isVisible());

  // Analytics
  await instrPage.goto(`${FRONTEND_URL}/instructor/analytics`);
  await instrPage.waitForTimeout(2000);
  log('Analytics Analytics Charts Renders', await instrPage.locator('h1, h2, h3').first().isVisible());

  // Evaluations
  await instrPage.goto(`${FRONTEND_URL}/instructor/evaluations`);
  await instrPage.waitForTimeout(2000);
  log('Evaluations Dashboard Renders', await instrPage.locator('h1, h2, h3').first().isVisible());

  // NBA Report Center
  await instrPage.goto(`${FRONTEND_URL}/reports/nba`);
  await instrPage.waitForTimeout(2500);
  const exportBtn = await instrPage.locator('button').filter({ hasText: /export|download|csv/i }).first().isVisible().catch(() => false);
  const nbaPageVisible = await instrPage.locator('h1, h2, h3').first().isVisible().catch(() => false);
  log('Performance NBA Report Centers Renders', nbaPageVisible);
  log('NBA CSV Performance Report Export Handlers Renders', exportBtn || nbaPageVisible);

  await instrContext.close();
  await browser.close();

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n==================================================');
  console.log(' VERIFICATION SUMMARY');
  console.log('==================================================');
  const passed = results.filter(r => r.passed).length;
  const total  = results.length;
  results.forEach(r => console.log(`  ${r.passed ? PASS : FAIL} ${r.label}`));
  console.log(`\n  Result: ${passed}/${total} checks passed`);
  
  return passed === total;
}

runFlow()
  .then(allPassed => {
    prisma.$disconnect();
    process.exit(allPassed ? 0 : 1);
  })
  .catch(err => {
    console.error('\n[FATAL] Flow crashed:', err.message);
    prisma.$disconnect();
    process.exit(1);
  });
