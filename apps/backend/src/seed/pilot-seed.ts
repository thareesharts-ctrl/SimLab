/**
 * Pilot Seed Script — SimLab Demo Accounts
 *
 * Creates all demo accounts from pilot-accounts.csv with correct roles,
 * password hashes, class structures (SEO101, GADS102, SOC103), and subscriptions.
 *
 * Run: npx ts-node src/seed/pilot-seed.ts
 *
 * Role mapping (canonical backend DB values):
 *   ADMIN          → Super Admin
 *   INSTRUCTOR     → Instructors
 *   STUDENT_COLLEGE → Students (classroom-based)
 *   INDIVIDUAL     → Individual Learner (personal sandbox)
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();

// Re-run safe Account upsert helper to prevent duplicate Account records
async function upsertAccount(userId: string, email: string, passwordHash: string) {
  const existing = await prisma.account.findFirst({
    where: { userId, providerId: 'credential' }
  });
  if (existing) {
    await prisma.account.update({
      where: { id: existing.id },
      data: { password: passwordHash, accountId: email }
    });
  } else {
    await prisma.account.create({
      data: {
        userId,
        accountId: email,
        providerId: 'credential',
        password: passwordHash
      }
    });
  }
}

// ─── Main Seed ────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 Starting Pilot Seed — SimLab Demo Accounts...\n');

  // ── Pre-generate password hash (all accounts share same password Test@123456) ──
  const DEMO_PASSWORD = 'Test@123456';
  const PASSWORD_HASH = await hashPassword(DEMO_PASSWORD);
  console.log(`✅ Password hash generated for: ${DEMO_PASSWORD}`);

  // ── Plans ─────────────────────────────────────────────────────────────────────
  console.log('\n📦 Seeding pricing plans...');
  await prisma.plan.upsert({
    where: { code: 'free' },
    update: {},
    create: {
      name: 'Free Trial',
      code: 'free',
      priceMonthly: 0,
      priceYearly: 0,
      simulationLimit: 1,
      studentLimit: 5,
      instructorLimit: 0,
      certificateLimit: 0,
      reportExportLimit: 1,
      storageLimitMb: 50,
      features: JSON.stringify(['1 Sandbox Campaign Run', 'Basic SEO Simulator access', 'Email Support']),
      isActive: true,
      durationDays: 14
    }
  });

  await prisma.plan.upsert({
    where: { code: 'individual_pro' },
    update: {},
    create: {
      name: 'Individual Pro',
      code: 'individual_pro',
      priceMonthly: 3000,
      priceYearly: 30000,
      simulationLimit: -1,
      studentLimit: 0,
      instructorLimit: 0,
      certificateLimit: -1,
      reportExportLimit: -1,
      storageLimitMb: 500,
      features: JSON.stringify(['Unlimited Campaign Runs', 'All Ads Engines', 'All Certificates', 'Priority Support']),
      isActive: true,
      durationDays: 30
    }
  });

  await prisma.plan.upsert({
    where: { code: 'instructor' },
    update: {},
    create: {
      name: 'Instructor',
      code: 'instructor',
      priceMonthly: 5000,
      priceYearly: 50000,
      simulationLimit: -1,
      studentLimit: 30,
      instructorLimit: 0,
      certificateLimit: -1,
      reportExportLimit: -1,
      storageLimitMb: 1024,
      features: JSON.stringify(['Classroom Management', 'NBA & OBE Reports', 'Student Analytics', 'PDF Export']),
      isActive: true,
      durationDays: 30
    }
  });

  await prisma.plan.upsert({
    where: { code: 'college' },
    update: {},
    create: {
      name: 'College License',
      code: 'college',
      priceMonthly: 15000,
      priceYearly: 150000,
      simulationLimit: -1,
      studentLimit: 200,
      instructorLimit: 10,
      certificateLimit: -1,
      reportExportLimit: -1,
      storageLimitMb: 5120,
      features: JSON.stringify(['College Hub', 'Accreditation Indexes', 'Bulk Import', 'Dedicated Support']),
      isActive: true,
      durationDays: 365
    }
  });

  // ── Scenarios ─────────────────────────────────────────────────────────────────
  console.log('\n📋 Seeding scenarios...');

  const scenarioSeo = await prisma.scenario.upsert({
    where: { id: 'scenario-seo-101' },
    update: { name: 'Organic Search Visibility Challenge' },
    create: {
      id: 'scenario-seo-101',
      name: 'Organic Search Visibility Challenge',
      description: 'Increase organic traffic and keyword rankings for a local B2B SaaS company through technical SEO, content optimization, and backlink acquisition.',
      industry: 'B2B SaaS',
      startRound: 1,
      maxRounds: 15,
      budgetPerRound: 5000.0,
      baselineOrganicTraffic: 1200,
      targetKPI: 'organic_traffic',
      location: 'India',
      durationDays: 15,
      dailyBudgetCap: 500.0,
      allowedPlatforms: JSON.stringify(['SEO']),
      allowedCampaignTypes: JSON.stringify(['Organic', 'Content', 'Technical']),
      checkpointRequired: true,
      difficulty: 'medium',
      certificateEnabled: true,
      trendRefreshFrequency: '24h',
      simulationMode: 'SEO',
      scenarioType: 'standard',
    }
  });

  const scenarioGads = await prisma.scenario.upsert({
    where: { id: 'scenario-gads-102' },
    update: { name: 'Google Ads Lead Generation Mastery' },
    create: {
      id: 'scenario-gads-102',
      name: 'Google Ads Lead Generation Mastery',
      description: 'Optimize Google Search and Display campaigns to generate qualified B2B leads at a target CPA for an enterprise software product.',
      industry: 'Enterprise Software',
      startRound: 1,
      maxRounds: 15,
      budgetPerRound: 8000.0,
      baselineOrganicTraffic: 500,
      targetKPI: 'leads',
      location: 'Global',
      durationDays: 15,
      dailyBudgetCap: 800.0,
      allowedPlatforms: JSON.stringify(['GOOGLE_ADS']),
      allowedCampaignTypes: JSON.stringify(['Search', 'Display']),
      checkpointRequired: true,
      difficulty: 'hard',
      certificateEnabled: true,
      trendRefreshFrequency: '24h',
      simulationMode: 'GOOGLE_ADS',
      scenarioType: 'standard',
    }
  });

  const scenarioMeta = await prisma.scenario.upsert({
    where: { id: 'scenario-meta-103' },
    update: { name: 'Social Performance Media Challenge' },
    create: {
      id: 'scenario-meta-103',
      name: 'Social Performance Media Challenge',
      description: 'Drive D2C conversions through Meta Ads (Facebook/Instagram) using precise audience targeting, creative optimization, and dynamic retargeting funnels.',
      industry: 'D2C E-commerce',
      startRound: 1,
      maxRounds: 15,
      budgetPerRound: 6000.0,
      baselineOrganicTraffic: 800,
      targetKPI: 'conversions',
      location: 'India',
      durationDays: 15,
      dailyBudgetCap: 600.0,
      allowedPlatforms: JSON.stringify(['META_ADS']),
      allowedCampaignTypes: JSON.stringify(['Awareness', 'Traffic', 'Conversions']),
      checkpointRequired: true,
      difficulty: 'medium',
      certificateEnabled: true,
      trendRefreshFrequency: '24h',
      simulationMode: 'META_ADS',
      scenarioType: 'standard',
    }
  });

  // Sandbox scenario for individual learner
  const scenarioSandbox = await prisma.scenario.upsert({
    where: { id: 'scenario-sandbox-default' },
    update: { name: 'Global SaaS Marketing Challenge' },
    create: {
      id: 'scenario-sandbox-default',
      name: 'Global SaaS Marketing Challenge',
      description: 'Acquire corporate customers for a collaborative cloud CRM tool in a competitive B2B space.',
      industry: 'B2B Software',
      startRound: 1,
      maxRounds: 10,
      budgetPerRound: 5000.0,
      baselineOrganicTraffic: 1500,
      targetKPI: 'revenue',
      location: 'Global',
      durationDays: 30,
      dailyBudgetCap: 500.0,
      allowedPlatforms: JSON.stringify(['GOOGLE_ADS', 'META_ADS', 'SEO']),
      allowedCampaignTypes: JSON.stringify(['Search', 'Display', 'Video', 'Shopping']),
      checkpointRequired: false,
      difficulty: 'medium',
      certificateEnabled: true,
      trendRefreshFrequency: 'instant',
      scenarioType: 'standard',
    }
  });

  console.log('  ✅ Scenarios: SEO101, GADS102, SOC103, Sandbox');

  // ── Super Admin ───────────────────────────────────────────────────────────────
  console.log('\n👑 Seeding Super Admin...');
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@simlab.run' },
    update: { role: 'ADMIN', status: 'active' },
    create: {
      email: 'superadmin@simlab.run',
      emailVerified: true,
      name: 'Super Admin',
      role: 'ADMIN',
      status: 'active',
    }
  });
  await upsertAccount(superAdmin.id, 'superadmin@simlab.run', PASSWORD_HASH);
  console.log(`  ✅ superadmin@simlab.run [ADMIN] id=${superAdmin.id}`);

  // ── Instructors ───────────────────────────────────────────────────────────────
  console.log('\n👨‍🏫 Seeding Instructors...');
  const instrAlpha = await prisma.user.upsert({
    where: { email: 'instructor.alpha@simlab.run' },
    update: { role: 'INSTRUCTOR', status: 'active' },
    create: {
      email: 'instructor.alpha@simlab.run',
      emailVerified: true,
      name: 'Dr. John Alpha',
      role: 'INSTRUCTOR',
      institution: 'SimLab University',
      status: 'active',
    }
  });
  await upsertAccount(instrAlpha.id, 'instructor.alpha@simlab.run', PASSWORD_HASH);

  const instrBeta = await prisma.user.upsert({
    where: { email: 'instructor.beta@simlab.run' },
    update: { role: 'INSTRUCTOR', status: 'active' },
    create: {
      email: 'instructor.beta@simlab.run',
      emailVerified: true,
      name: 'Prof. Mary Beta',
      role: 'INSTRUCTOR',
      institution: 'SimLab University',
      status: 'active',
    }
  });
  await upsertAccount(instrBeta.id, 'instructor.beta@simlab.run', PASSWORD_HASH);
  console.log(`  ✅ instructor.alpha@simlab.run [INSTRUCTOR] id=${instrAlpha.id}`);
  console.log(`  ✅ instructor.beta@simlab.run  [INSTRUCTOR] id=${instrBeta.id}`);

  // Instructor subscriptions
  const instrPlan = await prisma.plan.findUnique({ where: { code: 'instructor' } });
  if (instrPlan) {
    for (const instrUser of [instrAlpha, instrBeta]) {
      const existingSub = await prisma.subscription.findFirst({ where: { userId: instrUser.id } });
      if (!existingSub) {
        await prisma.subscription.create({
          data: {
            userId: instrUser.id,
            planId: instrPlan.id,
            status: 'active',
            billingCycle: 'monthly',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        });
      }
    }
  }

  // ── Classes ────────────────────────────────────────────────────────────────────
  console.log('\n🏫 Seeding Classes...');

  const classSeo = await prisma.class.upsert({
    where: { inviteCode: 'SEO101' },
    update: { name: 'Intro to SEO', scenarioId: scenarioSeo.id },
    create: {
      name: 'Intro to SEO',
      inviteCode: 'SEO101',
      instructorId: instrAlpha.id,
      scenarioId: scenarioSeo.id,
    }
  });

  const classGads = await prisma.class.upsert({
    where: { inviteCode: 'GADS102' },
    update: { name: 'Google Ads Mastery', scenarioId: scenarioGads.id },
    create: {
      name: 'Google Ads Mastery',
      inviteCode: 'GADS102',
      instructorId: instrAlpha.id,
      scenarioId: scenarioGads.id,
    }
  });

  const classMeta = await prisma.class.upsert({
    where: { inviteCode: 'SOC103' },
    update: { name: 'Social Performance Media', scenarioId: scenarioMeta.id },
    create: {
      name: 'Social Performance Media',
      inviteCode: 'SOC103',
      instructorId: instrBeta.id,
      scenarioId: scenarioMeta.id,
    }
  });

  console.log(`  ✅ Class SEO101 id=${classSeo.id}`);
  console.log(`  ✅ Class GADS102 id=${classGads.id}`);
  console.log(`  ✅ Class SOC103 id=${classMeta.id}`);

  // ── Students ──────────────────────────────────────────────────────────────────
  console.log('\n🎓 Seeding Students...');

  const studentAccounts = [
    // SEO101 students (student1–4)
    { email: 'student1@simlab.run', name: 'Pilot Student 1', classId: classSeo.id, classCode: 'SEO101' },
    { email: 'student2@simlab.run', name: 'Pilot Student 2', classId: classSeo.id, classCode: 'SEO101' },
    { email: 'student3@simlab.run', name: 'Pilot Student 3', classId: classSeo.id, classCode: 'SEO101' },
    { email: 'student4@simlab.run', name: 'Pilot Student 4', classId: classSeo.id, classCode: 'SEO101' },
    // GADS102 students (student5–8)
    { email: 'student5@simlab.run', name: 'Pilot Student 5', classId: classGads.id, classCode: 'GADS102' },
    { email: 'student6@simlab.run', name: 'Pilot Student 6', classId: classGads.id, classCode: 'GADS102' },
    { email: 'student7@simlab.run', name: 'Pilot Student 7', classId: classGads.id, classCode: 'GADS102' },
    { email: 'student8@simlab.run', name: 'Pilot Student 8', classId: classGads.id, classCode: 'GADS102' },
    // SOC103 students (student9–10)
    { email: 'student9@simlab.run', name: 'Pilot Student 9', classId: classMeta.id, classCode: 'SOC103' },
    { email: 'student10@simlab.run', name: 'Pilot Student 10', classId: classMeta.id, classCode: 'SOC103' },
  ];

  const freePlan = await prisma.plan.findUnique({ where: { code: 'free' } });

  for (const s of studentAccounts) {
    const student = await prisma.user.upsert({
      where: { email: s.email },
      update: {
        role: 'STUDENT_COLLEGE',
        classId: s.classId,
        status: 'active',
      },
      create: {
        email: s.email,
        emailVerified: true,
        name: s.name,
        role: 'STUDENT_COLLEGE',
        classId: s.classId,
        status: 'active',
      }
    });

    await upsertAccount(student.id, s.email, PASSWORD_HASH);

    // Upsert ClassEnrollment as ACTIVE
    const existingEnroll = await prisma.classEnrollment.findFirst({
      where: { studentId: student.id, classId: s.classId }
    });
    if (!existingEnroll) {
      await prisma.classEnrollment.create({
        data: {
          classId: s.classId,
          studentId: student.id,
          studentEmail: s.email,
          status: 'ACTIVE',
          approvedAt: new Date(),
        }
      });
    } else if (existingEnroll.status !== 'ACTIVE') {
      await prisma.classEnrollment.update({
        where: { id: existingEnroll.id },
        data: { status: 'ACTIVE', approvedAt: new Date() }
      });
    }

    if (freePlan) {
      const existingSub = await prisma.subscription.findFirst({ where: { userId: student.id } });
      if (!existingSub) {
        await prisma.subscription.create({
          data: {
            userId: student.id,
            planId: freePlan.id,
            status: 'active',
            billingCycle: 'trial',
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
          }
        });
      }
    }

    console.log(`  ✅ ${s.email} [STUDENT_COLLEGE] class=${s.classCode}`);
  }

  // ── Individual Learner ────────────────────────────────────────────────────────
  console.log('\n🧪 Seeding Individual Learner...');

  // Create sandbox instructor account (system account)
  const sandboxInstructor = await prisma.user.upsert({
    where: { email: 'sandbox-instructor@simulation.com' },
    update: {},
    create: {
      email: 'sandbox-instructor@simulation.com',
      emailVerified: true,
      name: 'Sandbox System Instructor',
      role: 'INSTRUCTOR',
      status: 'active',
    }
  });

  const learner = await prisma.user.upsert({
    where: { email: 'learner@simlab.run' },
    update: {
      role: 'INDIVIDUAL',
      status: 'active',
    },
    create: {
      email: 'learner@simlab.run',
      emailVerified: true,
      name: 'Individual Pilot Learner',
      role: 'INDIVIDUAL',
      status: 'active',
      planType: '30',
    }
  });

  await upsertAccount(learner.id, 'learner@simlab.run', PASSWORD_HASH);

  // Individual learner gets a pro subscription for the pilot
  const proPlan = await prisma.plan.findUnique({ where: { code: 'individual_pro' } });
  if (proPlan) {
    const existingSub = await prisma.subscription.findFirst({ where: { userId: learner.id } });
    if (!existingSub) {
      await prisma.subscription.create({
        data: {
          userId: learner.id,
          planId: proPlan.id,
          status: 'active',
          billingCycle: 'monthly',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        }
      });
    }
  }

  // DO NOT pre-create a sandbox class for the learner — the sandbox flow creates it on first /start.
  // GET /api/v1/sandbox/state returns hasState=false, nextAction=CHOOSE_SIMULATION_TYPE which is correct.

  console.log(`  ✅ learner@simlab.run [INDIVIDUAL] id=${learner.id}`);
  console.log(`  ℹ️  Learner has no pre-created sandbox (will be created on first simulation start).`);

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════════════════');
  console.log('✅ PILOT SEED COMPLETE');
  console.log('══════════════════════════════════════════════════════');
  console.log('\nAccounts seeded:');
  console.log('  superadmin@simlab.run    → ADMIN       → /admin');
  console.log('  instructor.alpha@simlab.run → INSTRUCTOR → /instructor');
  console.log('  instructor.beta@simlab.run  → INSTRUCTOR → /instructor');
  console.log('  student1–4@simlab.run    → STUDENT_COLLEGE → /dashboard (SEO101)');
  console.log('  student5–8@simlab.run    → STUDENT_COLLEGE → /dashboard (GADS102)');
  console.log('  student9–10@simlab.run   → STUDENT_COLLEGE → /dashboard (SOC103)');
  console.log('  learner@simlab.run       → INDIVIDUAL   → /dashboard (sandbox)');
  console.log('\nAll accounts password: Test@123456');
  console.log('\nRole values in DB:');
  console.log('  ADMIN, INSTRUCTOR, STUDENT_COLLEGE, INDIVIDUAL');
  console.log('  (Frontend normalizeRole maps these to: SUPER_ADMIN, INSTRUCTOR, STUDENT, INDIVIDUAL)');
}

main()
  .catch(err => {
    console.error('\n❌ Pilot seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
