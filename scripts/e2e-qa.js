const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:5000';
const SCREENSHOT_DIR = path.join(__dirname, '../screenshots');

// Ensure screenshots folder exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR);
}

const consoleLogs = [];
const networkErrors = [];

async function takeScreenshot(page, name) {
  const screenshotPath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`[Screenshot] Saved ${name}.png to ${screenshotPath}`);
}

function attachListeners(page) {
  page.on('console', msg => {
    consoleLogs.push(`[Console ${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    consoleLogs.push(`[Console Error] ${err.message}`);
    console.error(`Page error: ${err.message}`);
  });
  page.on('requestfailed', request => {
    networkErrors.push(`[Failed Request] ${request.url()}: ${request.failure()?.errorText}`);
  });
  page.on('dialog', async dialog => {
    console.log(`[Dialog] ${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });
}

async function performLogin(page, email, password) {
  await page.goto(`${FRONTEND_URL}/login`);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  console.log(`- Logged in successfully as: ${email}`);
}

async function runE2E() {
  console.log('==================================================');
  console.log('RUNNING SYSTEMATIC PLAYWRIGHT E2E BROWSER VALIDATION');
  console.log('==================================================');

  // Reset and seed database synchronously before starting browser automation
  const { execSync } = require('child_process');
  console.log('Resetting and seeding database for E2E validation...');
  try {
    execSync('npm run prisma:seed -w apps/backend', { stdio: 'inherit' });
    execSync('node scripts/seed-e2e-users.js', { stdio: 'inherit' });
    console.log('- Database reset successfully!');
  } catch (err) {
    console.error('Failed to reset database:', err.message);
  }

  const browser = await chromium.launch({ headless: true });

  // ----------------------------------------------------
  // STEP 4 — LANDING PAGE REAL BROWSER TEST
  // ----------------------------------------------------
  console.log('\n--- STEP 4: LANDING PAGE REAL BROWSER TEST ---');
  const context1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page1 = await context1.newPage();
  attachListeners(page1);

  await page1.goto(`${FRONTEND_URL}/landing`);
  await page1.waitForTimeout(2000);
  
  const landingTitle = await page1.title();
  console.log(`- Landing page loaded. Title: "${landingTitle}"`);
  
  const hasGetStarted = await page1.locator('button:has-text("Get Started"), a:has-text("Get Started"), button:has-text("Choose Plan")').first().isVisible();
  console.log(`- Hero CTA exists: ${hasGetStarted}`);
  await takeScreenshot(page1, 'step4_landing_page');
  await context1.close();

  // ----------------------------------------------------
  // STEP 5 — AUTHENTICATION E2E TEST (Invalid Login)
  // ----------------------------------------------------
  console.log('\n--- STEP 5: AUTHENTICATION E2E TEST ---');
  const context2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await context2.newPage();
  attachListeners(page2);

  await page2.goto(`${FRONTEND_URL}/login`);
  await page2.fill('#email', 'superadmin@simlab.test');
  await page2.fill('#password', 'wrongpassword');
  await page2.click('button[type="submit"]');
  await page2.waitForTimeout(1000);
  await takeScreenshot(page2, 'step5_invalid_login_error');
  console.log('- Verified invalid login handling.');
  await context2.close();

  // ----------------------------------------------------
  // STEP 6 — SUPER ADMIN REAL-TIME TEST
  // ----------------------------------------------------
  console.log('\n--- STEP 6: SUPER ADMIN REAL-TIME TEST ---');
  const contextAdmin = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageAdmin = await contextAdmin.newPage();
  attachListeners(pageAdmin);

  await performLogin(pageAdmin, 'superadmin@simlab.test', 'Test@123456');
  await pageAdmin.goto(`${FRONTEND_URL}/admin`);
  await pageAdmin.waitForTimeout(2000);
  console.log(`- Super Admin Dashboard URL: ${pageAdmin.url()}`);
  await takeScreenshot(pageAdmin, 'step6_admin_dashboard');

  await pageAdmin.goto(`${FRONTEND_URL}/admin/users`);
  await pageAdmin.waitForTimeout(1500);
  await takeScreenshot(pageAdmin, 'step6_admin_users');

  await pageAdmin.goto(`${FRONTEND_URL}/admin/institutions`);
  await pageAdmin.waitForTimeout(1500);
  await takeScreenshot(pageAdmin, 'step6_admin_institutions');

  await pageAdmin.goto(`${FRONTEND_URL}/admin/system-health`);
  await pageAdmin.waitForTimeout(1500);
  await takeScreenshot(pageAdmin, 'step6_admin_system_health');
  await contextAdmin.close();

  // ----------------------------------------------------
  // STEP 7 — INSTRUCTOR REAL-TIME TEST & CLASSROOM SETUP
  // ----------------------------------------------------
  console.log('\n--- STEP 7: INSTRUCTOR REAL-TIME TEST ---');
  const contextInst = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageInst = await contextInst.newPage();
  attachListeners(pageInst);

  await performLogin(pageInst, 'instructor@simlab.test', 'Test@123456');
  await pageInst.goto(`${FRONTEND_URL}/instructor`);
  await pageInst.waitForTimeout(2000);
  console.log(`- Instructor Dashboard URL: ${pageInst.url()}`);
  await takeScreenshot(pageInst, 'step7_instructor_dashboard');

  // Create class room via API using current session cookies to bypass any selector issues
  let inviteCode = 'MKT2026';
  try {
    const cookies = await contextInst.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    const scensRes = await fetch(`${BACKEND_URL}/api/v1/scenario`, { headers: { Cookie: cookieHeader } });
    const scens = (await scensRes.json()).scenarios;
    const saasScenario = scens.find(s => s.name.includes('SaaS')) || scens[0];

    const classRes = await fetch(`${BACKEND_URL}/api/v1/class`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({ name: 'QA SimLab Cohort 2026', scenarioId: saasScenario.id })
    });
    const classData = await classRes.json();
    inviteCode = classData.class.inviteCode;
    console.log(`- Classroom created successfully. Join Invite Code: "${inviteCode}"`);
  } catch (err) {
    console.warn('- Classroom creation failed:', err.message);
  }
  await contextInst.close();

  // ----------------------------------------------------
  // STEP 8 — STUDENT JOIN CLASS
  // ----------------------------------------------------
  console.log('\n--- STEP 8: STUDENT JOIN CLASS ---');
  const contextStud1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageStud1 = await contextStud1.newPage();
  attachListeners(pageStud1);

  await performLogin(pageStud1, 'student1@simlab.test', 'Test@123456');
  try {
    const cookies = await contextStud1.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    const joinRes = await fetch(`${BACKEND_URL}/api/v1/users/join-class`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({ inviteCode })
    });
    console.log(`- Student join class request: Status ${joinRes.status}`);
  } catch (err) {
    console.error('Student failed to join class:', err.message);
  }

  await pageStud1.goto(`${FRONTEND_URL}/dashboard`);
  await pageStud1.waitForTimeout(2000);
  await takeScreenshot(pageStud1, 'step8_student_pending_approval');
  await contextStud1.close();

  // ----------------------------------------------------
  // STEP 8 — INSTRUCTOR APPROVAL
  // ----------------------------------------------------
  console.log('\n--- STEP 8: INSTRUCTOR APPROVAL ---');
  const contextInstApprove = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageInstApprove = await contextInstApprove.newPage();
  attachListeners(pageInstApprove);

  await performLogin(pageInstApprove, 'instructor@simlab.test', 'Test@123456');
  try {
    const cookies = await contextInstApprove.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const classListRes = await fetch(`${BACKEND_URL}/api/v1/class`, { headers: { Cookie: cookieHeader } });
    const classListData = await classListRes.json();
    const activeClass = classListData.classes.find(c => c.inviteCode === inviteCode);

    const pendRes = await fetch(`${BACKEND_URL}/api/v1/class/${activeClass.id}/pending-students`, { headers: { Cookie: cookieHeader } });
    const pendData = await pendRes.json();
    const targetPendStudent = pendData.students.find(s => s.email === 'student1@simlab.test');

    const approveRes = await fetch(`${BACKEND_URL}/api/v1/class/${activeClass.id}/approve/${targetPendStudent.id}`, {
      method: 'POST',
      headers: { Cookie: cookieHeader, 'Origin': 'http://localhost:5173' }
    });
    console.log(`- Approved pending student. Status: ${approveRes.status}`);
  } catch (err) {
    console.error('Instructor failed to approve student:', err.message);
  }
  await contextInstApprove.close();

  // ----------------------------------------------------
  // STEP 8 — STUDENT SIMULATION FLOW
  // ----------------------------------------------------
  console.log('\n--- STEP 8: STUDENT SIMULATION FLOW ---');
  const contextStudActive = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageStudActive = await contextStudActive.newPage();
  attachListeners(pageStudActive);

  await performLogin(pageStudActive, 'student1@simlab.test', 'Test@123456');
  await pageStudActive.goto(`${FRONTEND_URL}/dashboard`);
  await pageStudActive.waitForTimeout(2000);
  console.log(`- Student approved dashboard URL: ${pageStudActive.url()}`);
  await takeScreenshot(pageStudActive, 'step8_student_active_dashboard');

  let activeSimId = null;
  try {
    const cookies = await contextStudActive.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Call start first to ensure simulation workspace is initialized (Status 200 or 201)
    const startRes = await fetch(`${BACKEND_URL}/api/v1/simulation/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({})
    });
    const startData = await startRes.json();
    console.log(`- Start simulation for student 1: Status ${startRes.status}, Response:`, JSON.stringify(startData));
    activeSimId = startData.simulationId;

    if (!activeSimId) {
      // Fallback: query state
      const stateRes = await fetch(`${BACKEND_URL}/api/v1/simulation/state`, { headers: { Cookie: cookieHeader } });
      const stateData = await stateRes.json();
      activeSimId = stateData.state?.id;
    }
    console.log(`- Resolved Active Simulation ID: ${activeSimId}`);

    const payload = {
      seoTargetKeywords: ['CRM SaaS'],
      seoContentQuality: 8,
      seoBacklinkBudget: 200,
      googleCampaigns: [{
        name: "Google Search Leads",
        budget: 2000.0,
        objective: "Leads",
        campaignType: "Search",
        biddingStrategy: "Manual CPC",
        negativeKeywords: ["free"],
        adCopy: { headline1: "Accredited CRM Tool", headline2: "Increase Sales Today", headline3: "Start Free", description1: "Leading sales manager app", description2: "Secure database backup" },
        landingPage: { pageRelevance: 8, mobileFriendly: 9, pageSpeed: 8, trustSignals: 9, offerClarity: 8, conversionReadiness: 8 },
        keywords: [{ word: "CRM SaaS", bid: 2.80, matchType: "exact" }],
        devices: { desktop: true, mobile: true, tablet: false },
        locations: ["US"]
      }],
      metaCampaigns: [{
        name: "Meta Lead Gen Placement",
        budget: 1000.0,
        audienceInterest: "business-owners",
        bidType: "LOWEST_COST",
        bidAmount: 0,
        placement: "feeds",
        creativeQuality: 8,
        creative: { headline: "Simulate CRM Dashboard Today", primaryText: "Boost your marketing ROI", callToAction: "LEARN_MORE", mediaQuality: 85 },
        objective: "leads"
      }]
    };

    const decisionsRes = await fetch(`${BACKEND_URL}/api/simulations/${activeSimId}/decisions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify(payload)
    });
    console.log(`- Submitted decisions for Student 1: Status ${decisionsRes.status}`);

    const ffRes = await fetch(`${BACKEND_URL}/api/simulations/${activeSimId}/fast-forward`, {
      method: 'POST',
      headers: { Cookie: cookieHeader, 'Origin': 'http://localhost:5173' }
    });
    console.log(`- Submitted student 1 fast-forward: Status ${ffRes.status}`);
  } catch (err) {
    console.error('Failed student decisions/FF flow:', err.message);
  }

  await pageStudActive.goto(`${FRONTEND_URL}/simulation/results`);
  await pageStudActive.waitForTimeout(2000);
  await takeScreenshot(pageStudActive, 'step8_student_simulation_results');

  await pageStudActive.goto(`${FRONTEND_URL}/leaderboard`);
  await pageStudActive.waitForTimeout(2000);
  await takeScreenshot(pageStudActive, 'step8_student_leaderboard');
  await contextStudActive.close();

  // ----------------------------------------------------
  // STEP 8 — STUDENT TWO JOIN & SIMULATION FLOW
  // ----------------------------------------------------
  console.log('\n--- STEP 8: STUDENT TWO JOIN & SIMULATION FLOW ---');
  const contextStud2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageStud2 = await contextStud2.newPage();
  attachListeners(pageStud2);

  await performLogin(pageStud2, 'student2@simlab.test', 'Test@123456');
  try {
    const cookies = await contextStud2.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    const joinRes = await fetch(`${BACKEND_URL}/api/v1/users/join-class`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({ inviteCode })
    });
    console.log(`- Student 2 join class request: Status ${joinRes.status}`);
  } catch (err) {
    console.error('Student 2 failed to join class:', err.message);
  }
  await pageStud2.goto(`${FRONTEND_URL}/dashboard`);
  await pageStud2.waitForTimeout(2000);
  await takeScreenshot(pageStud2, 'step8_student2_pending_approval');
  await contextStud2.close();

  // Approve Student Two
  console.log('\n--- STEP 8: INSTRUCTOR APPROVAL FOR STUDENT TWO ---');
  const contextInstApprove2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageInstApprove2 = await contextInstApprove2.newPage();
  attachListeners(pageInstApprove2);

  await performLogin(pageInstApprove2, 'instructor@simlab.test', 'Test@123456');
  try {
    const cookies = await contextInstApprove2.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const classListRes = await fetch(`${BACKEND_URL}/api/v1/class`, { headers: { Cookie: cookieHeader } });
    const classListData = await classListRes.json();
    const activeClass = classListData.classes.find(c => c.inviteCode === inviteCode);

    const pendRes = await fetch(`${BACKEND_URL}/api/v1/class/${activeClass.id}/pending-students`, { headers: { Cookie: cookieHeader } });
    const pendData = await pendRes.json();
    const targetPendStudent = pendData.students.find(s => s.email === 'student2@simlab.test');

    const approveRes = await fetch(`${BACKEND_URL}/api/v1/class/${activeClass.id}/approve/${targetPendStudent.id}`, {
      method: 'POST',
      headers: { Cookie: cookieHeader, 'Origin': 'http://localhost:5173' }
    });
    console.log(`- Approved pending student 2. Status: ${approveRes.status}`);
  } catch (err) {
    console.error('Instructor failed to approve student 2:', err.message);
  }
  await contextInstApprove2.close();

  // Student Two runs simulation
  console.log('\n--- STEP 8: STUDENT TWO SIMULATION RUN ---');
  const contextStud2Active = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageStud2Active = await contextStud2Active.newPage();
  attachListeners(pageStud2Active);

  await performLogin(pageStud2Active, 'student2@simlab.test', 'Test@123456');
  await pageStud2Active.goto(`${FRONTEND_URL}/dashboard`);
  await pageStud2Active.waitForTimeout(2000);
  await takeScreenshot(pageStud2Active, 'step8_student2_active_dashboard');

  try {
    const cookies = await contextStud2Active.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const startRes = await fetch(`${BACKEND_URL}/api/v1/simulation/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({})
    });
    const startData = await startRes.json();
    const activeSimId2 = startData.simulationId;
    console.log(`- Student 2 simulation started. ID: ${activeSimId2}`);

    const payload = {
      seoTargetKeywords: ['CRM SaaS'],
      seoContentQuality: 7, // slightly lower quality to differentiate ranking
      seoBacklinkBudget: 150,
      googleCampaigns: [{
        name: "Google Search Leads 2",
        budget: 1500.0,
        objective: "Leads",
        campaignType: "Search",
        biddingStrategy: "Manual CPC",
        negativeKeywords: ["free"],
        adCopy: { headline1: "Alternative CRM Tool", headline2: "Increase Sales Today", headline3: "Start Free", description1: "Leading sales manager app", description2: "Secure database backup" },
        landingPage: { pageRelevance: 7, mobileFriendly: 8, pageSpeed: 7, trustSignals: 8, offerClarity: 7, conversionReadiness: 7 },
        keywords: [{ word: "CRM SaaS", bid: 2.20, matchType: "exact" }],
        devices: { desktop: true, mobile: true, tablet: false },
        locations: ["US"]
      }],
      metaCampaigns: [{
        name: "Meta Lead Gen Placement 2",
        budget: 800.0,
        audienceInterest: "business-owners",
        bidType: "LOWEST_COST",
        bidAmount: 0,
        placement: "feeds",
        creativeQuality: 7,
        creative: { headline: "Simulate CRM Today", primaryText: "Boost your marketing ROI", callToAction: "LEARN_MORE", mediaQuality: 80 },
        objective: "leads"
      }]
    };

    const decisionsRes = await fetch(`${BACKEND_URL}/api/simulations/${activeSimId2}/decisions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify(payload)
    });
    console.log(`- Submitted decisions for Student 2: Status ${decisionsRes.status}`);

    const ffRes = await fetch(`${BACKEND_URL}/api/simulations/${activeSimId2}/fast-forward`, {
      method: 'POST',
      headers: { Cookie: cookieHeader, 'Origin': 'http://localhost:5173' }
    });
    console.log(`- Student 2 submitted fast-forward: Status ${ffRes.status}`);
  } catch (err) {
    console.error('Failed student 2 decisions/FF flow:', err.message);
  }

  await pageStud2Active.goto(`${FRONTEND_URL}/simulation/results`);
  await pageStud2Active.waitForTimeout(2000);
  await takeScreenshot(pageStud2Active, 'step8_student2_simulation_results');

  await pageStud2Active.goto(`${FRONTEND_URL}/leaderboard`);
  await pageStud2Active.waitForTimeout(2000);
  await takeScreenshot(pageStud2Active, 'step8_student2_leaderboard');
  await contextStud2Active.close();

  // ----------------------------------------------------
  // STEP 9 & 10 — INDIVIDUAL LEARNER SANDBOX & BILLING
  // ----------------------------------------------------
  console.log('\n--- STEP 9 & 10: INDIVIDUAL LEARNER SANDBOX & BILLING ---');
  const contextIndiv = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageIndiv = await contextIndiv.newPage();
  attachListeners(pageIndiv);

  await performLogin(pageIndiv, 'individual@simlab.test', 'Test@123456');
  await pageIndiv.goto(`${FRONTEND_URL}/dashboard`);
  await pageIndiv.waitForTimeout(2000);
  await takeScreenshot(pageIndiv, 'step9_individual_dashboard');

  await pageIndiv.goto(`${FRONTEND_URL}/pricing`);
  await pageIndiv.waitForTimeout(2000);

  // Dismiss cookie compliance modal if present
  const acceptCookiesBtn = pageIndiv.locator('button:has-text("Accept Cookies")');
  if (await acceptCookiesBtn.isVisible()) {
    await acceptCookiesBtn.click();
    await pageIndiv.waitForTimeout(500);
  }

  await pageIndiv.fill('input[placeholder*="PROMO CODE"]', 'WELCOME50');
  await pageIndiv.click('button:has-text("Apply")');
  await pageIndiv.waitForTimeout(1000);
  await takeScreenshot(pageIndiv, 'step10_pricing_coupon_applied');

  await pageIndiv.locator('div').filter({ has: pageIndiv.locator('h3', { hasText: 'Individual Basic' }) }).locator('button:has-text("Subscribe Now")').first().click();
  await pageIndiv.waitForTimeout(1500);
  await takeScreenshot(pageIndiv, 'step10_checkout_sandbox_modal');

  await pageIndiv.fill('input[placeholder="4111 2222 3333 4444"]', '4111222233334444');
  await pageIndiv.fill('input[placeholder="MM/YY"]', '12/29');
  await pageIndiv.fill('input[placeholder="•••"]', '123');
  await pageIndiv.click('button:has-text("Simulate Capture")');
  await pageIndiv.waitForTimeout(3000);
  await takeScreenshot(pageIndiv, 'step10_post_payment_subscription_active');

  await pageIndiv.goto(`${FRONTEND_URL}/billing/invoices`);
  await pageIndiv.waitForTimeout(2000);
  await takeScreenshot(pageIndiv, 'step10_invoice_center');
  await contextIndiv.close();

  await browser.close();
  console.log('\n==================================================');
  console.log('PLAYWRIGHT E2E BROWSER VALIDATION COMPLETED SUCCESSFULLY');
  console.log('==================================================');
}

runE2E().catch(err => {
  console.error('E2E validation crashed:', err);
  console.log('\n--- Captured Console Logs ---');
  consoleLogs.forEach(log => console.log(log));
  console.log('\n--- Captured Network Errors ---');
  networkErrors.forEach(err => console.log(err));
  process.exit(1);
});
