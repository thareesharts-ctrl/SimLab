import { PrismaClient } from '@prisma/client';
import { verifyPassword } from 'better-auth/crypto';
import { auth } from '../auth/better-auth';
import { normalizeRole } from '../auth/roles';

const prisma = new PrismaClient();

const DEMO_ACCOUNTS = [
  { email: 'superadmin@simlab.run', expectedRole: 'ADMIN', redirect: '/admin' },
  { email: 'instructor.alpha@simlab.run', expectedRole: 'INSTRUCTOR', redirect: '/instructor' },
  { email: 'instructor.beta@simlab.run', expectedRole: 'INSTRUCTOR', redirect: '/instructor' },
  { email: 'learner@simlab.run', expectedRole: 'INDIVIDUAL', redirect: '/dashboard' },
  { email: 'student1@simlab.run', expectedRole: 'STUDENT_COLLEGE', redirect: '/dashboard' },
  { email: 'student2@simlab.run', expectedRole: 'STUDENT_COLLEGE', redirect: '/dashboard' },
  { email: 'student3@simlab.run', expectedRole: 'STUDENT_COLLEGE', redirect: '/dashboard' },
  { email: 'student5@simlab.run', expectedRole: 'STUDENT_COLLEGE', redirect: '/dashboard' },
  { email: 'student9@simlab.run', expectedRole: 'STUDENT_COLLEGE', redirect: '/dashboard' }
];

const TEST_PASSWORD = 'Test@123456';

async function run() {
  console.log('=== STARTING DEMO LOGINS VERIFICATION ===\n');

  let allPassed = true;

  for (const account of DEMO_ACCOUNTS) {
    const { email, expectedRole, redirect } = account;
    console.log(`Verifying: ${email}`);

    // 1. Check user exists
    const user = await prisma.user.findUnique({
      where: { email },
      include: { accounts: true }
    });

    if (!user) {
      console.log(`❌ FAIL: User not found in database.\n`);
      allPassed = false;
      continue;
    }

    if (user.status !== 'active') {
      console.log(`❌ FAIL: User is inactive. Status: ${user.status}\n`);
      allPassed = false;
      continue;
    }

    // 2. Check credential account record exists
    const credentialAccount = user.accounts.find(acc => acc.providerId === 'credential');
    if (!credentialAccount || !credentialAccount.password) {
      console.log(`❌ FAIL: Missing credential record or password hash in Account table.\n`);
      allPassed = false;
      continue;
    }

    // 3. Cryptographically verify password
    let passwordMatch = false;
    try {
      passwordMatch = await verifyPassword({
        password: TEST_PASSWORD,
        hash: credentialAccount.password
      });
    } catch (e: any) {
      console.log(`❌ FAIL: Exception during password hash verification: ${e.message}\n`);
      allPassed = false;
      continue;
    }

    if (!passwordMatch) {
      console.log(`❌ FAIL: Password mismatch (hashed verification failed).\n`);
      allPassed = false;
      continue;
    }

    // 4. Test programmatic sign-in logic
    let loginSuccess = false;
    let loggedUser: any = null;
    try {
      const signInResult = await auth.api.signInEmail({
        body: {
          email,
          password: TEST_PASSWORD
        }
      });
      if (signInResult && signInResult.user) {
        loginSuccess = true;
        loggedUser = signInResult.user;
      }
    } catch (e: any) {
      console.log(`❌ FAIL: Sign-in execution threw error: ${e.message}\n`);
      allPassed = false;
      continue;
    }

    if (!loginSuccess || !loggedUser) {
      console.log(`❌ FAIL: Sign-in API did not return authenticated user.\n`);
      allPassed = false;
      continue;
    }

    // 5. Verify role and redirect
    const userRole = normalizeRole(loggedUser.role);
    const expectedNormalized = normalizeRole(expectedRole);
    if (userRole !== expectedNormalized) {
      console.log(`❌ FAIL: Role mismatch. Expected: ${expectedRole}, Found: ${loggedUser.role}\n`);
      allPassed = false;
      continue;
    }

    // Map redirects matching frontend logic:
    // SUPER_ADMIN/ADMIN -> /admin
    // INSTRUCTOR -> /instructor
    // INDIVIDUAL/STUDENT -> /dashboard
    let computedRedirect = '/dashboard';
    if (userRole === 'ADMIN') computedRedirect = '/admin';
    else if (userRole === 'INSTRUCTOR') computedRedirect = '/instructor';

    if (computedRedirect !== redirect) {
      console.log(`❌ FAIL: Redirect mismatch. Expected: ${redirect}, Computed: ${computedRedirect}\n`);
      allPassed = false;
      continue;
    }

    console.log(`✅ PASS: ${email} authenticated successfully. Role: ${userRole}. Redirect: ${computedRedirect}\n`);
  }

  console.log('=== VERIFICATION SUMMARY ===');
  if (allPassed) {
    console.log('🎉 PASS: All demo account credentials and redirects verified successfully.');
    process.exit(0);
  } else {
    console.error('❌ FAIL: One or more demo account logins failed verification.');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal login verification script error:', err);
  process.exit(1);
});
