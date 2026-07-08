import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_EMAILS = [
  'superadmin@simlab.run',
  'instructor.alpha@simlab.run',
  'instructor.beta@simlab.run',
  'learner@simlab.run',
  'student1@simlab.run',
  'student2@simlab.run',
  'student3@simlab.run',
  'student5@simlab.run',
  'student9@simlab.run'
];

async function run() {
  console.log('=== STARTING DEMO ACCOUNTS DIAGNOSTIC ===');

  // Sanitize and print DB URL info
  const dbUrl = process.env.DATABASE_URL || '';
  let dbInfo = 'unknown';
  try {
    const parsed = new URL(dbUrl.replace('postgresql://', 'http://'));
    dbInfo = `Host: ${parsed.hostname}, Database: ${parsed.pathname.replace(/^\//, '')}`;
  } catch (e) {
    dbInfo = 'invalid or empty DATABASE_URL';
  }
  console.log(`Connected Database: ${dbInfo}`);

  const userCount = await prisma.user.count();
  console.log(`Total Users in Database: ${userCount}\n`);

  for (const email of DEMO_EMAILS) {
    console.log(`Checking account: ${email}`);
    const user = await prisma.user.findUnique({
      where: { email },
      include: { accounts: true }
    });

    if (!user) {
      console.log(`❌ Does NOT exist in database.\n`);
      continue;
    }

    const hasAccountRecord = user.accounts.some(acc => acc.providerId === 'credential');
    const hasPassword = user.accounts.some(acc => acc.providerId === 'credential' && acc.password);

    console.log(`✅ Exists`);
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Role: ${user.role}`);
    console.log(`   - Status: ${user.status}`);
    console.log(`   - Email Verified: ${user.emailVerified}`);
    console.log(`   - Account / Credential Record Linked: ${hasAccountRecord ? 'Yes' : 'No'}`);
    console.log(`   - Has Password Hash: ${hasPassword ? 'Yes' : 'No'}`);
    console.log(`   - Created At: ${user.createdAt}`);
    console.log(`   - Updated At: ${user.updatedAt}\n`);
  }

  console.log('=== DIAGNOSTIC COMPLETE ===');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal diagnostic script error:', err);
  process.exit(1);
});
