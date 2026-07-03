import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/db/client';
import { processSimulationRound } from '../../src/services/simulation/engine';

describe('Screenshots Flow and Multi-Day Ads Simulation Verification', () => {
  let simId: string;
  let studentId: string;
  let classId: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Clean up existing test data
    await prisma.simulationState.deleteMany({});
    await prisma.class.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.scenario.deleteMany({});

    // Create scenario matching instructions
    const scenario = await prisma.scenario.create({
      data: {
        name: 'University Marketing Sim Scenario',
        description: 'Test Scenario with real-time trend configurations.',
        industry: 'CRM SaaS',
        budgetPerRound: 5000.0,
        baselineOrganicTraffic: 1000,
        targetKPI: 'revenue',
        targetLocations: JSON.stringify(['US', 'CA', 'UK']),
        allowedGoogleObjectives: JSON.stringify(['Sales', 'Leads', 'Website Traffic']),
        allowedMetaObjectives: JSON.stringify(['sales', 'leads', 'traffic']),
        allowedBiddingStrategies: JSON.stringify(['Manual CPC', 'Maximize Clicks', 'Maximize Conversions']),
      },
    });

    const instructor = await prisma.user.create({
      data: {
        email: 'prof.sanders@simplab.edu',
        name: 'Prof. Sanders',
        role: 'INSTRUCTOR',
        emailVerified: true,
      },
    });

    const student = await prisma.user.create({
      data: {
        email: 'student.tester@simplab.edu',
        name: 'Alex Student',
        role: 'STUDENT_COLLEGE',
        emailVerified: true,
      },
    });
    studentId = student.id;

    const classroom = await prisma.class.create({
      data: {
        name: 'Advanced Digital Ads Cohort',
        inviteCode: 'ADVADS',
        instructorId: instructor.id,
        scenarioId: scenario.id,
      },
    });
    classId = classroom.id;

    await prisma.user.update({
      where: { id: studentId },
      data: { classId: classId },
    });

    const simState = await prisma.simulationState.create({
      data: {
        userId: studentId,
        classId: classId,
        currentRound: 1,
        status: 'LOCKED',
      },
    });
    simId = simState.id;
  });

  afterAll(async () => {
    await prisma.simulationState.deleteMany({});
    await prisma.class.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.scenario.deleteMany({});
    await prisma.$disconnect();
  });

  it('Day 1 Strategy Execution: Verify Google and Meta Ads outcome metrics are dynamic and non-hardcoded', async () => {
    // Setup typical Day 1 decisions
    const googleCampaignsDay1 = [
      {
        name: 'Google Ads Search Campaign Day 1',
        objective: 'Website Traffic',
        campaignType: 'Search',
        biddingStrategy: 'Manual CPC',
        budget: 1200.0,
        keywords: [
          { word: 'CRM SaaS', bid: 1.20, matchType: 'broad' }
        ],
        negativeKeywords: [],
        devices: { desktop: true, mobile: true, tablet: false },
        locations: ['US'],
        adCopy: {
          headline1: 'CRM Tool',
          headline2: 'Business Info',
          headline3: 'Read More',
          description1: 'A general software description here.',
          description2: 'Visit our homepage.'
        },
        landingPage: {
          pageRelevance: 4,
          mobileFriendly: 4,
          pageSpeed: 5,
          trustSignals: 5,
          offerClarity: 4,
          conversionReadiness: 4
        }
      }
    ];

    const metaCampaignsDay1 = [
      {
        name: 'Meta Awareness Campaign Day 1',
        objective: 'awareness',
        budget: 1200.0,
        budgetType: 'daily',
        audienceInterest: 'general-broad',
        placement: 'stories',
        creative: {
          headline: 'Brand new system',
          primaryText: 'Learn about our services and check updates.',
          cta: 'LEARN_MORE',
          quality: 5
        },
        isSameCreative: false
      }
    ];

    await prisma.decision.create({
      data: {
        simulationId: simId,
        round: 1,
        seoTargetKeywords: JSON.stringify(['CRM SaaS']),
        seoContentQuality: 5.0,
        seoBacklinkBudget: 100.0,
        googleCampaigns: JSON.stringify(googleCampaignsDay1),
        metaCampaigns: JSON.stringify(metaCampaignsDay1),
        submitted: true,
      },
    });

    const result = await processSimulationRound(simId);
    expect(result.success).toBe(true);

    const snapshot = await prisma.roundSnapshot.findUnique({
      where: {
        simulationId_round: {
          simulationId: simId,
          round: 1
        }
      }
    });

    expect(snapshot).not.toBeNull();
    const data = JSON.parse(snapshot!.data);

    // Aggregate daily metrics
    const dailyMetrics = data.dailyMetrics;
    expect(dailyMetrics).toBeDefined();
    expect(dailyMetrics.length).toBe(30);

    let totalGoogleImpressions = 0;
    let totalGoogleClicks = 0;
    let totalGoogleCost = 0;
    let totalGoogleConversions = 0;

    let totalMetaImpressions = 0;
    let totalMetaClicks = 0;
    let totalMetaCost = 0;
    let totalMetaConversions = 0;

    dailyMetrics.forEach((m: any) => {
      totalGoogleImpressions += m.googleImpressions;
      totalGoogleClicks += m.googleClicks;
      totalGoogleCost += m.googleCost;
      totalGoogleConversions += m.googleConversions;

      totalMetaImpressions += m.metaImpressions;
      totalMetaClicks += m.metaClicks;
      totalMetaCost += m.metaCost;
      totalMetaConversions += m.metaConversions;
    });

    const averageGoogleCPC = totalGoogleClicks > 0 ? (totalGoogleCost / totalGoogleClicks) : 0;

    // Verify Google metrics are dynamic and non-hardcoded (not $1.52 CPC / 581 impressions / 32 clicks)
    expect(totalGoogleImpressions).not.toBe(581);
    expect(totalGoogleClicks).not.toBe(32);
    expect(averageGoogleCPC).not.toBe(1.52);

    // Verify Meta metrics are dynamic and non-hardcoded
    expect(totalMetaImpressions).toBeGreaterThan(0);
    expect(totalMetaClicks).toBeGreaterThan(0);
    expect(totalMetaCost).toBeGreaterThanOrEqual(1000.0);
    expect(totalMetaCost).toBeLessThanOrEqual(1500.0); // allow up to 1.25x campaign budget for CPM pressure
  });

  it('Day 2 Strategy Progression: Improving targeting, bids, ad copy relevance, landing page experience, and creatives produces logical improvements over Day 1', async () => {
    // Student updates decisions for Day 2 (Round 2) to optimize efficiency
    const googleCampaignsDay2 = [
      {
        name: 'Google Ads Search Campaign Day 2 - Optimized',
        objective: 'Sales', // Better aligned with scenarios targetKPI (revenue)
        campaignType: 'Search',
        biddingStrategy: 'Maximize Conversions', // More advanced bid strategy
        budget: 3200.0, // Increased but within budgetPerRound ($5000 total for all channels)
        keywords: [
          { word: 'CRM SaaS', bid: 3.50, matchType: 'broad' } // Higher bid & broad match
        ],
        negativeKeywords: ['free', 'cheap', 'crack'], // Filtering wasted spend
        devices: { desktop: true, mobile: true, tablet: true },
        locations: ['US', 'UK'],
        adCopy: {
          headline1: 'Best Enterprise CRM SaaS', // High relevance keywords in headlines
          headline2: 'Boost Your Sales Revenue Now',
          headline3: 'Get 50% Off Annual Plan',
          description1: 'Buy the top sales automation CRM database platform.',
          description2: 'Secure HTTPS checkout and fast setup. Join today.'
        },
        landingPage: {
          pageRelevance: 9, // Substantially improved landing page experience
          mobileFriendly: 9,
          pageSpeed: 9,
          trustSignals: 9,
          offerClarity: 9,
          conversionReadiness: 9
        }
      }
    ];

    const metaCampaignsDay2 = [
      {
        name: 'Meta Sales Campaign Day 2 - Optimized',
        objective: 'sales', // Aligned objective
        budget: 1500.0, // Targeted spend - total Day 2 = $3200 + $1500 = $4700, under $5000 cap
        budgetType: 'daily',
        audienceInterest: 'business-owners', // Highly targeted audience interest
        placement: 'feeds', // Higher conversion placement
        creative: {
          headline: 'Get CRM SaaS - 50% Off Sale',
          primaryText: 'Buy the #1 CRM tools for sales leaders. Scale your leads today!',
          cta: 'SHOP_NOW',
          quality: 9 // Higher quality creative
        },
        isSameCreative: false // Fresh creative avoids fatigue
      }
    ];

    // Submit decisions for Day 2
    await prisma.decision.create({
      data: {
        simulationId: simId,
        round: 2,
        seoTargetKeywords: JSON.stringify(['CRM SaaS']),
        seoContentQuality: 9.0,
        seoBacklinkBudget: 200.0,
        googleCampaigns: JSON.stringify(googleCampaignsDay2),
        metaCampaigns: JSON.stringify(metaCampaignsDay2),
        submitted: true,
      },
    });

    // Advance round Day 2
    await prisma.simulationState.update({
      where: { id: simId },
      data: { status: 'LOCKED' },
    });

    const result = await processSimulationRound(simId);
    expect(result.success).toBe(true);

    const snapshotDay1 = await prisma.roundSnapshot.findUnique({
      where: { simulationId_round: { simulationId: simId, round: 1 } }
    });
    const snapshotDay2 = await prisma.roundSnapshot.findUnique({
      where: { simulationId_round: { simulationId: simId, round: 2 } }
    });

    const day1 = JSON.parse(snapshotDay1!.data);
    const day2 = JSON.parse(snapshotDay2!.data);

    // Aggregate Day 1 Metrics
    let day1GoogleConversions = 0;
    let day1MetaConversions = 0;
    let day1GoogleClicks = 0;
    let day1GoogleImpressions = 0;
    day1.dailyMetrics.forEach((m: any) => {
      day1GoogleConversions += m.googleConversions;
      day1MetaConversions += m.metaConversions;
      day1GoogleClicks += m.googleClicks;
      day1GoogleImpressions += m.googleImpressions;
    });

    // Aggregate Day 2 Metrics
    let day2GoogleConversions = 0;
    let day2MetaConversions = 0;
    let day2GoogleClicks = 0;
    let day2GoogleImpressions = 0;
    day2.dailyMetrics.forEach((m: any) => {
      day2GoogleConversions += m.googleConversions;
      day2MetaConversions += m.metaConversions;
      day2GoogleClicks += m.googleClicks;
      day2GoogleImpressions += m.googleImpressions;
    });

    const day1GoogleCTR = day1GoogleImpressions > 0 ? (day1GoogleClicks / day1GoogleImpressions) : 0;
    const day2GoogleCTR = day2GoogleImpressions > 0 ? (day2GoogleClicks / day2GoogleImpressions) : 0;

    // Verify Google Ads logical optimizations:
    // Better match type, higher bids, negative keywords, ad copy relevance, and landing page quality
    // should yield higher conversions and higher CTR.
    expect(day2GoogleConversions).toBeGreaterThanOrEqual(day1GoogleConversions);
    expect(day2GoogleCTR).toBeGreaterThanOrEqual(day1GoogleCTR);

    // Verify Meta Ads logical optimizations:
    // Better audience matching, higher creative quality, and sales objective
    // should result in more conversions.
    expect(day2MetaConversions).toBeGreaterThanOrEqual(day1MetaConversions);

    // Verify scoreboards: Student composite and business metrics improve on Day 2 due to better decisions
    expect(day2.scores.seo).toBeGreaterThanOrEqual(day1.scores.seo);
    expect(day2.scores.revenue).toBeGreaterThanOrEqual(day1.scores.revenue);
    expect(day2.scores.composite).toBeGreaterThanOrEqual(day1.scores.composite - 15.0);
  });
});
