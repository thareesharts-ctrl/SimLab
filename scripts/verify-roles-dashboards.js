/**
 * SimLab Demo Account Integration Test
 * Tests all pilot accounts: login → role → redirect → API access
 *
 * Usage: node scripts/verify-roles-dashboards.js [BASE_URL]
 * Default: http://localhost:5000
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.BASE_URL || process.argv[2] || 'http://localhost:5000';
const RESULTS = [];
let PASS = 0, FAIL = 0;

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function req(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE_URL + path);
    const lib = u.protocol === 'https:' ? https : http;
    const options = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(opts.cookie ? { Cookie: opts.cookie } : {}),
        ...(opts.headers || {}),
      },
      timeout: 15000,
    };
    const r = lib.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let body;
        try { body = JSON.parse(data); } catch { body = data; }
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    r.on('error', reject);
    r.on('timeout', () => reject(new Error('timeout')));
    if (opts.body) r.write(JSON.stringify(opts.body));
    r.end();
  });
}

function pass(name, detail = '') {
  PASS++;
  RESULTS.push({ status: 'PASS', name, detail });
  console.log(`  ✅ PASS  ${name}${detail ? ' — ' + detail : ''}`);
}

function fail(name, detail = '') {
  FAIL++;
  RESULTS.push({ status: 'FAIL', name, detail });
  console.log(`  ❌ FAIL  ${name}${detail ? ' — ' + detail : ''}`);
}

function info(msg) {
  console.log(`  ℹ️  ${msg}`);
}

// ─── Login helper ─────────────────────────────────────────────────────────────

async function login(email, password) {
  const res = await req('/api/auth/sign-in/email', {
    method: 'POST',
    body: { email, password },
  });
  const rawCookies = res.headers['set-cookie'] || [];
  const cookie = rawCookies.map(c => c.split(';')[0]).join('; ');
  return { status: res.status, body: res.body, cookie };
}

// ─── fetchMe helper ──────────────────────────────────────────────────────────

async function fetchMe(cookie) {
  const res = await req('/api/auth/me', { cookie });
  return res;
}

// ─── normalizeRole (mirror of frontend) ──────────────────────────────────────

function normalizeRole(role) {
  if (!role) return null;
  const r = role.toUpperCase().replace(/-/g, '_');
  if (r === 'ADMIN' || r === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (r === 'INSTRUCTOR') return 'INSTRUCTOR';
  if (r === 'STUDENT' || r === 'STUDENT_COLLEGE') return 'STUDENT';
  if (r === 'INDIVIDUAL' || r === 'LEARNER') return 'INDIVIDUAL';
  return null;
}

function getRoleRedirectPath(role) {
  const n = normalizeRole(role);
  if (n === 'SUPER_ADMIN') return '/admin';
  if (n === 'INSTRUCTOR') return '/instructor';
  return '/dashboard';
}

// ─── Per-account test ────────────────────────────────────────────────────────

async function testAccount({ email, password, expectedRole, expectSandboxAllowed, expectedRedirect }) {
  console.log(`\n${'━'.repeat(70)}`);
  console.log(`👤  ${email}  [expected: ${expectedRole}]`);
  console.log(`${'━'.repeat(70)}`);

  // 1. Login
  let loginRes;
  try {
    loginRes = await login(email, password);
  } catch (e) {
    fail(`Login ${email}`, `NETWORK ERROR: ${e.message}`);
    return;
  }

  if (loginRes.status >= 400) {
    fail(`Login ${email}`, `HTTP ${loginRes.status} — ${JSON.stringify(loginRes.body).slice(0, 80)}`);
    return;
  }

  const hasCookie = loginRes.cookie.length > 0;
  if (!hasCookie) {
    fail(`Login ${email}`, 'No session cookie returned');
    return;
  }
  pass(`Login ${email}`, `HTTP ${loginRes.status}`);

  const cookie = loginRes.cookie;

  // 2. fetchMe — verify role
  let meRes;
  try {
    meRes = await fetchMe(cookie);
  } catch (e) {
    fail(`fetchMe ${email}`, e.message);
    return;
  }

  if (meRes.status !== 200) {
    fail(`fetchMe ${email}`, `HTTP ${meRes.status}`);
    return;
  }

  const actualRole = meRes.body?.role;
  const normalizedActual = normalizeRole(actualRole);
  const normalizedExpected = normalizeRole(expectedRole);
  const roleMatch = normalizedActual === normalizedExpected;

  info(`role in DB: ${actualRole}  →  normalized: ${normalizedActual}  (expected: ${normalizedExpected})`);
  info(`status: ${meRes.body?.status || 'n/a'}  classId: ${meRes.body?.classId || 'none'}`);

  if (roleMatch) {
    pass(`Role ${email}`, `${actualRole} → ${normalizedActual}`);
  } else {
    fail(`Role ${email}`, `got ${actualRole} (normalized: ${normalizedActual}), expected ${expectedRole} (normalized: ${normalizedExpected})`);
  }

  // 3. Redirect path
  const actualRedirect = getRoleRedirectPath(actualRole);
  if (actualRedirect === expectedRedirect) {
    pass(`Redirect ${email}`, `→ ${actualRedirect}`);
  } else {
    fail(`Redirect ${email}`, `got ${actualRedirect}, expected ${expectedRedirect}`);
  }

  // 4. Sandbox state endpoint
  let sandboxStateRes;
  try {
    sandboxStateRes = await req('/api/v1/sandbox/state', { cookie });
  } catch (e) {
    fail(`GET /api/v1/sandbox/state ${email}`, e.message);
    sandboxStateRes = null;
  }

  if (sandboxStateRes) {
    if (expectSandboxAllowed) {
      if (sandboxStateRes.status === 200) {
        pass(`GET /api/v1/sandbox/state ${email}`, `HTTP 200 hasState=${sandboxStateRes.body?.hasState}`);
      } else {
        fail(`GET /api/v1/sandbox/state ${email}`, `Expected 200, got HTTP ${sandboxStateRes.status} — ${JSON.stringify(sandboxStateRes.body).slice(0,80)}`);
      }
    } else {
      // Should get 200 (safe empty) OR 403 — never 500
      if (sandboxStateRes.status === 500) {
        fail(`GET /api/v1/sandbox/state ${email}`, `Got 500 (server crash) — should return 200 safe empty or 403`);
      } else if (sandboxStateRes.status === 200) {
        const nextAction = sandboxStateRes.body?.nextAction;
        if (nextAction === 'USE_CLASSROOM_SIMULATION') {
          pass(`GET /api/v1/sandbox/state ${email}`, `HTTP 200 safe empty (nextAction=USE_CLASSROOM_SIMULATION) ✓`);
        } else {
          pass(`GET /api/v1/sandbox/state ${email}`, `HTTP 200 safe empty`);
        }
      } else if (sandboxStateRes.status === 403) {
        const msg = sandboxStateRes.body?.message || sandboxStateRes.body?.error || '';
        if (msg.includes('classroom') || msg.includes('Instructor') || msg.includes('sandbox')) {
          pass(`GET /api/v1/sandbox/state ${email}`, `HTTP 403 with correct role message`);
        } else {
          pass(`GET /api/v1/sandbox/state ${email}`, `HTTP 403 blocked correctly`);
        }
      } else {
        fail(`GET /api/v1/sandbox/state ${email}`, `Unexpected HTTP ${sandboxStateRes.status}`);
      }
    }
  }

  // 5. Sandbox sample-scenarios endpoint
  let ssRes;
  try {
    ssRes = await req('/api/v1/sandbox/sample-scenarios?mode=GOOGLE_ADS', { cookie });
  } catch (e) {
    fail(`GET /api/v1/sandbox/sample-scenarios ${email}`, e.message);
    ssRes = null;
  }

  if (ssRes) {
    if (expectSandboxAllowed) {
      if (ssRes.status === 200) {
        pass(`GET /api/v1/sandbox/sample-scenarios ${email}`, `HTTP 200`);
      } else {
        fail(`GET /api/v1/sandbox/sample-scenarios ${email}`, `Expected 200, got HTTP ${ssRes.status}`);
      }
    } else {
      if (ssRes.status === 500) {
        fail(`GET /api/v1/sandbox/sample-scenarios ${email}`, `Got 500 (should be 200 safe empty or 403)`);
      } else if (ssRes.status === 200 || ssRes.status === 403) {
        pass(`GET /api/v1/sandbox/sample-scenarios ${email}`, `HTTP ${ssRes.status} — not exposed as 500`);
      } else {
        fail(`GET /api/v1/sandbox/sample-scenarios ${email}`, `Unexpected HTTP ${ssRes.status}`);
      }
    }
  }

  // 6. Role-specific API check
  if (normalizedExpected === 'STUDENT') {
    // Student should be able to call assignment and leaderboard
    let assignRes;
    try {
      assignRes = await req('/api/v1/assignments/student/active', { cookie });
      if (assignRes.status !== 500) {
        pass(`GET /api/v1/assignments/student/active ${email}`, `HTTP ${assignRes.status} (not 500)`);
      } else {
        fail(`GET /api/v1/assignments/student/active ${email}`, `HTTP 500`);
      }
    } catch (e) {
      fail(`GET /api/v1/assignments/student/active ${email}`, e.message);
    }
  }

  if (normalizedExpected === 'INDIVIDUAL') {
    // Individual should be able to call billing subscription
    let billingRes;
    try {
      billingRes = await req('/api/v1/billing/subscription', { cookie });
      if (billingRes.status !== 500) {
        pass(`GET /api/v1/billing/subscription ${email}`, `HTTP ${billingRes.status} (not 500)`);
      } else {
        fail(`GET /api/v1/billing/subscription ${email}`, `HTTP 500`);
      }
    } catch (e) {
      fail(`GET /api/v1/billing/subscription ${email}`, e.message);
    }
  }

  if (normalizedExpected === 'SUPER_ADMIN') {
    // Admin should access admin dashboard stats
    let adminRes;
    try {
      adminRes = await req('/api/v1/admin/dashboard-stats', { cookie });
      if (adminRes.status !== 500) {
        pass(`GET /api/v1/admin/dashboard-stats ${email}`, `HTTP ${adminRes.status} (not 500)`);
      } else {
        fail(`GET /api/v1/admin/dashboard-stats ${email}`, `HTTP 500`);
      }
    } catch (e) {
      fail(`GET /api/v1/admin/dashboard-stats ${email}`, e.message);
    }
  }

  if (normalizedExpected === 'INSTRUCTOR') {
    let classesRes;
    try {
      classesRes = await req('/api/classes', { cookie });
      if (classesRes.status !== 500) {
        pass(`GET /api/classes ${email}`, `HTTP ${classesRes.status} (not 500)`);
      } else {
        fail(`GET /api/classes ${email}`, `HTTP 500`);
      }
    } catch (e) {
      fail(`GET /api/classes ${email}`, e.message);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`SimLab Demo Account Role Routing Verification`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Time:   ${new Date().toISOString()}`);
  console.log(`${'═'.repeat(70)}\n`);

  // Health check first
  let healthOk = false;
  try {
    const h = await req('/health');
    healthOk = h.status === 200;
    if (healthOk) {
      console.log(`✅ Backend health: OK (HTTP 200)\n`);
    } else {
      console.log(`❌ Backend health: HTTP ${h.status}\n`);
    }
  } catch (e) {
    console.log(`❌ Backend unreachable: ${e.message}`);
    console.log(`\nMake sure the backend is running:\n  npm run dev -w apps/backend\n  (or set BASE_URL=https://your-production-url)\n`);
    process.exit(1);
  }

  const ACCOUNTS = [
    {
      email: 'learner@simlab.run',
      password: 'Test@123456',
      expectedRole: 'INDIVIDUAL',
      expectSandboxAllowed: true,
      expectedRedirect: '/dashboard',
    },
    {
      email: 'student1@simlab.run',
      password: 'Test@123456',
      expectedRole: 'STUDENT_COLLEGE',
      expectSandboxAllowed: false,
      expectedRedirect: '/dashboard',
    },
    {
      email: 'student2@simlab.run',
      password: 'Test@123456',
      expectedRole: 'STUDENT_COLLEGE',
      expectSandboxAllowed: false,
      expectedRedirect: '/dashboard',
    },
    {
      email: 'student3@simlab.run',
      password: 'Test@123456',
      expectedRole: 'STUDENT_COLLEGE',
      expectSandboxAllowed: false,
      expectedRedirect: '/dashboard',
    },
    {
      email: 'student5@simlab.run',
      password: 'Test@123456',
      expectedRole: 'STUDENT_COLLEGE',
      expectSandboxAllowed: false,
      expectedRedirect: '/dashboard',
    },
    {
      email: 'student9@simlab.run',
      password: 'Test@123456',
      expectedRole: 'STUDENT_COLLEGE',
      expectSandboxAllowed: false,
      expectedRedirect: '/dashboard',
    },
    {
      email: 'instructor.alpha@simlab.run',
      password: 'Test@123456',
      expectedRole: 'INSTRUCTOR',
      expectSandboxAllowed: false,
      expectedRedirect: '/instructor',
    },
    {
      email: 'superadmin@simlab.run',
      password: 'Test@123456',
      expectedRole: 'ADMIN',
      expectSandboxAllowed: true,
      expectedRedirect: '/admin',
    },
  ];

  for (const account of ACCOUNTS) {
    try {
      await testAccount(account);
    } catch (e) {
      console.error(`\nUnhandled error for ${account.email}:`, e.message);
      FAIL++;
      RESULTS.push({ status: 'FAIL', name: `Account ${account.email}`, detail: e.message });
    }
    // Small delay to respect rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`FINAL RESULTS — Role Routing Verification`);
  console.log(`${'═'.repeat(70)}`);

  const maxName = Math.max(...RESULTS.map(r => r.name.length), 30);
  console.log(`| ${'Check'.padEnd(maxName)} | Status | Detail`);
  console.log(`|${'-'.repeat(maxName + 2)}|--------|${'-'.repeat(45)}`);
  RESULTS.forEach(r => {
    const emoji = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
    console.log(`| ${r.name.padEnd(maxName)} | ${emoji} | ${(r.detail || '').slice(0, 44)}`);
  });

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`Total: ${PASS + FAIL} | PASS: ${PASS} | FAIL: ${FAIL}`);
  console.log(`${'═'.repeat(70)}\n`);

  if (FAIL > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All role routing checks passed!\n');
    process.exit(0);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
