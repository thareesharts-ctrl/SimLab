import { FastifyInstance } from 'fastify';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import { prisma } from '../db/client';
import { ValidationError, ForbiddenError, NotFoundError } from '../utils/errors';
import { processSimulationRound } from '../services/simulation/engine';
import { checkCertificateEligibility } from '../services/certificate/eligibility';
import { generateCertificatePDF } from '../services/certificate/generator';
import crypto from 'crypto';
import { getScenarioDefaults, validateScenarioRelevance } from '../services/simulation/sandbox-scenario.service';
import { generateSandboxRecommendations } from '../services/report/sandbox-recommendations';


async function logAudit(userId: string, action: string, details: string) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        details
      }
    });
  } catch (err) {
    // silent catch
  }
}

export async function sandboxRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  const checkRole = (request: AuthenticatedRequest): boolean => {
    const role = request.user!.role;
    if (role === 'STUDENT_COLLEGE') {
      throw new ForbiddenError('Students must use their classroom-assigned simulation. Sandbox mode is not available for this account.');
    }
    if (role === 'INSTRUCTOR') {
      throw new ForbiddenError('Instructors must use the Instructor Portal for scenario preview and classroom simulations.');
    }
    if (role !== 'INDIVIDUAL' && role !== 'ADMIN') {
      throw new ForbiddenError('Only Individual Learners or Administrators can access sandbox mode.');
    }
    return true;
  };

  /**
   * GET /api/v1/sandbox/simulation-types
   */
  fastify.get('/simulation-types', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    checkRole(authReq);
    return reply.status(200).send({
      success: true,
      simulationTypes: ["GOOGLE_ADS", "META_ADS", "SEO"]
    });
  });

  const fallbackScenarios: Record<string, any[]> = {
    GOOGLE_ADS: [
      {
        id: 'fb-google-saas',
        name: 'SaaS Lead Generation',
        description: 'Optimize search campaigns to acquire software trial signups with tight target CPA settings.',
        industry: 'Software',
        difficulty: 'medium',
        simulationMode: 'GOOGLE_ADS',
        allowedPlatforms: '["GOOGLE_ADS"]'
      },
      {
        id: 'fb-google-local',
        name: 'Local Service Search Campaign',
        description: 'Run targeted local search ads to drive inbound service phone calls and appointment bookings.',
        industry: 'Local Services',
        difficulty: 'easy',
        simulationMode: 'GOOGLE_ADS',
        allowedPlatforms: '["GOOGLE_ADS"]'
      },
      {
        id: 'fb-google-ecommerce',
        name: 'E-commerce Sales Search Campaign',
        description: 'Scale transactional shopping and search ad copy conversions to achieve maximum ROAS.',
        industry: 'E-commerce',
        difficulty: 'hard',
        simulationMode: 'GOOGLE_ADS',
        allowedPlatforms: '["GOOGLE_ADS"]'
      }
    ],
    META_ADS: [
      {
        id: 'fb-meta-fashion',
        name: 'Fashion Brand Awareness',
        description: 'Design interactive carousel creatives to scale engagement and catalog views for a style collection.',
        industry: 'Fashion',
        difficulty: 'easy',
        simulationMode: 'META_ADS',
        allowedPlatforms: '["META_ADS"]'
      },
      {
        id: 'fb-meta-fitness',
        name: 'Fitness Lead Campaign',
        description: 'Run localized lead capture ads with video assets to sign up new gym members and personal trainer clients.',
        industry: 'Fitness',
        difficulty: 'medium',
        simulationMode: 'META_ADS',
        allowedPlatforms: '["META_ADS"]'
      },
      {
        id: 'fb-meta-d2c',
        name: 'D2C Product Conversion Campaign',
        description: 'Optimize high-intent audience targeting to convert shoppers on physical consumer product offers.',
        industry: 'Consumer Goods',
        difficulty: 'hard',
        simulationMode: 'META_ADS',
        allowedPlatforms: '["META_ADS"]'
      }
    ],
    SEO: [
      {
        id: 'fb-seo-local',
        name: 'Local Business SEO Growth',
        description: 'Optimize on-page keywords and local citation signals to rank in local map packs.',
        industry: 'Local Business',
        difficulty: 'easy',
        simulationMode: 'SEO',
        allowedPlatforms: '["SEO"]'
      },
      {
        id: 'fb-seo-blog',
        name: 'SaaS Blog Ranking Strategy',
        description: 'Structure high-quality long-form posts matching transactional search queries to scale organic leads.',
        industry: 'SaaS',
        difficulty: 'medium',
        simulationMode: 'SEO',
        allowedPlatforms: '["SEO"]'
      },
      {
        id: 'fb-seo-ecommerce',
        name: 'E-commerce Category Page SEO',
        description: 'Execute technical metadata optimizations and category backlink indexing to outrank catalog competitors.',
        industry: 'E-commerce',
        difficulty: 'hard',
        simulationMode: 'SEO',
        allowedPlatforms: '["SEO"]'
      }
    ]
  };

  /**
   * GET /api/v1/sandbox/sample-scenarios
   */
  fastify.get('/sample-scenarios', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const role = authReq.user!.role;

    // Return empty safe list for students — never 403 on read endpoints
    if (role === 'STUDENT_COLLEGE') {
      return reply.status(200).send({
        success: true,
        mode: (request.query as any).mode || 'GOOGLE_ADS',
        scenarios: [],
        presetScenarios: [],
        message: 'Students use classroom simulation, not personal sandbox.'
      });
    }

    checkRole(authReq);
    const { mode } = request.query as { mode: string };

    if (!mode || !['GOOGLE_ADS', 'META_ADS', 'SEO'].includes(mode)) {
      return reply.status(400).send({
        success: false,
        message: 'Valid mode parameter (GOOGLE_ADS, META_ADS, SEO) is required.'
      });
    }

    let presetScenarios = [];
    try {
      presetScenarios = await prisma.scenario.findMany({
        where: { scenarioType: { not: 'custom' } }
      });
    } catch (dbErr) {
      // fallback cleanly if DB has transient issues
    }

    // Map presets dynamically to the selected single mode
    let scenarios = presetScenarios.map(s => ({
      id: s.id,
      name: `${s.name} [${mode.replace('_', ' ')}]`,
      description: s.description,
      industry: s.industry,
      difficulty: s.difficulty,
      simulationMode: mode,
      allowedPlatforms: JSON.stringify([mode])
    }));

    if (scenarios.length === 0) {
      scenarios = fallbackScenarios[mode];
    }

    return reply.status(200).send({
      success: true,
      mode,
      scenarios,
      presetScenarios: scenarios
    });
  });

  /**
   * POST /api/v1/sandbox/scenario/custom
   */
  fastify.post('/scenario/custom', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    checkRole(authReq);
    const userId = authReq.user!.id;

    const {
      scenarioName,
      industry,
      businessType,
      targetAudience,
      location,
      objectiveKPI,
      competitionLevel,
      productDescription,
      simulationMode,
      campaignDuration,
      simulationRounds,
      timingRule
    } = request.body as any;

    if (!scenarioName || !industry || !simulationMode) {
      throw new ValidationError('Scenario name, industry, and simulationMode are required.');
    }

    if (!['GOOGLE_ADS', 'META_ADS', 'SEO'].includes(simulationMode)) {
      throw new ValidationError('Invalid simulationMode.');
    }

    const customScenario = await prisma.scenario.create({
      data: {
        name: scenarioName,
        description: productDescription || `Custom Sandbox Scenario for ${targetAudience || 'General Audiences'} in ${location || 'Global'}. Business Type: ${businessType || 'N/A'}.`,
        industry,
        startRound: 1,
        maxRounds: parseInt(simulationRounds) || 10,
        budgetPerRound: 5000.0, // Default round budget limit (budget is managed inside workspace)
        baselineOrganicTraffic: 1000,
        targetKPI: objectiveKPI || 'revenue',
        location: location || 'Global',
        durationDays: parseInt(campaignDuration) || 30,
        dailyBudgetCap: 500.0,
        allowedPlatforms: JSON.stringify([simulationMode]),
        allowedCampaignTypes: JSON.stringify(['Search', 'Display', 'Video', 'Shopping']),
        checkpointRequired: false,
        difficulty: competitionLevel || 'medium',
        certificateEnabled: true,
        trendRefreshFrequency: timingRule || 'instant',
        scenarioType: 'custom',
        simulationMode
      }
    });

    await logAudit(userId, 'scenario created', `Created custom sandbox scenario: ${scenarioName} [${simulationMode}]`);

    return reply.status(201).send({
      success: true,
      scenarioId: customScenario.id
    });
  });

  /**
   * POST /api/v1/sandbox/start
   */
  fastify.post('/start', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    checkRole(authReq);
    const userId = authReq.user!.id;
    const { 
      simulationMode, 
      scenarioId, 
      customScenario, 
      scenarioType, 
      durationDays, 
      resultCycleHours, 
      timingMode 
    } = request.body as any;

    if (!simulationMode || !['GOOGLE_ADS', 'META_ADS', 'SEO'].includes(simulationMode)) {
      throw new ValidationError('Valid simulationMode is required.');
    }

    let finalScenarioId = scenarioId;

    if (scenarioType === 'CUSTOM' || customScenario) {
      const timingVal = timingMode === 'instant' ? 'instant' : (resultCycleHours ? `custom_${resultCycleHours}` : '24h');
      const customRes = await prisma.scenario.create({
        data: {
          name: customScenario?.scenarioName || 'Custom Scenario',
          description: customScenario?.productDescription || 'Custom description',
          industry: customScenario?.industry || 'B2B Software',
          startRound: 1,
          maxRounds: durationDays || 15,
          budgetPerRound: 5000.0,
          baselineOrganicTraffic: 1000,
          targetKPI: customScenario?.objectiveKPI || 'revenue',
          location: customScenario?.location || 'Global',
          durationDays: durationDays || 15,
          allowedPlatforms: JSON.stringify([simulationMode]),
          allowedCampaignTypes: JSON.stringify(['Search']),
          checkpointRequired: false,
          difficulty: customScenario?.competitionLevel || 'medium',
          certificateEnabled: true,
          trendRefreshFrequency: timingVal,
          scenarioType: 'custom',
          simulationMode
        }
      });
      finalScenarioId = customRes.id;
    }

    if (!finalScenarioId) {
      throw new ValidationError('Scenario identification is required to start simulation.');
    }

    const scenario = await prisma.scenario.findUnique({
      where: { id: finalScenarioId }
    });

    if (!scenario) {
      throw new NotFoundError('Scenario not found.');
    }

    // Resolve private Sandbox Instructor account
    let inst = await prisma.user.findFirst({
      where: { email: 'sandbox-instructor@simulation.com' }
    });
    if (!inst) {
      inst = await prisma.user.create({
        data: {
          email: 'sandbox-instructor@simulation.com',
          name: 'Sandbox Instructor',
          emailVerified: true,
          role: 'INSTRUCTOR',
          status: 'active'
        }
      });
    }

    // Resolve private Sandbox Class unique to this user
    const inviteCode = `SANDBOX-${userId}`;
    let cls = await prisma.class.findUnique({
      where: { inviteCode }
    });

    if (cls) {
      cls = await prisma.class.update({
        where: { id: cls.id },
        data: { scenarioId: finalScenarioId }
      });
    } else {
      cls = await prisma.class.create({
        data: {
          name: `Sandbox - ${authReq.user!.name}`,
          inviteCode,
          instructorId: inst.id,
          scenarioId: finalScenarioId
        }
      });
    }

    // Link user to sandbox class
    await prisma.user.update({
      where: { id: userId },
      data: { classId: cls.id }
    });

    // Delete existing SimulationState & dependencies
    await prisma.simulationState.deleteMany({
      where: { userId, classId: cls.id }
    });

    // Create fresh SimulationState with simulationMode
    const state = await prisma.simulationState.create({
      data: {
        userId,
        classId: cls.id,
        currentRound: 1,
        status: 'DECISION_OPEN',
        isCompleted: false,
        simulationMode
      }
    });

    // Pre-populate default decision based on scenario
    const defaults = getScenarioDefaults(simulationMode, scenario);

    await prisma.decision.create({
      data: {
        simulationId: state.id,
        round: 1,
        googleCampaigns: JSON.stringify(simulationMode === 'GOOGLE_ADS' ? (defaults.campaigns || []) : []),
        metaCampaigns: JSON.stringify(simulationMode === 'META_ADS' ? (defaults.campaigns || []) : []),
        seoTargetKeywords: JSON.stringify(simulationMode === 'SEO' ? (defaults.seoTargetKeywords || []) : []),
        seoMetaTitle: defaults.seoMetaTitle || '',
        seoMetaDescription: defaults.seoMetaDescription || '',
        seoBodyContent: defaults.seoBodyContent || '',
        seoUrlSlug: defaults.seoUrlSlug || '',
        seoInternalLinks: defaults.seoInternalLinks || 0,
        seoAnchorText: defaults.seoAnchorText || '',
        seoBacklinkQuality: defaults.seoBacklinkQuality || 1,
        seoBacklinkBudget: defaults.seoBacklinkBudget || 0.0,
        seoTechnicalConfig: JSON.stringify(defaults.seoTechnicalConfig || {}),
        seoCoreWebVitals: JSON.stringify(defaults.seoCoreWebVitals || {}),
        submitted: false
      }
    });

    // Initialize progress record
    await prisma.studentSimulationProgress.upsert({
      where: { simulationId: state.id },
      update: {
        currentDay: 1,
        totalDays: scenario.durationDays,
        status: 'DECISION_OPEN',
        completedAt: null,
        nextResultAt: null
      },
      create: {
        simulationId: state.id,
        currentDay: 1,
        totalDays: scenario.durationDays,
        status: 'DECISION_OPEN'
      }
    });

    await logAudit(userId, 'simulation started', `Started sandbox simulation mode ${simulationMode} on scenario ${scenario.name}`);

    return reply.status(201).send({
      success: true,
      simulationId: state.id,
      status: state.status,
      currentRound: state.currentRound,
      simulationMode
    });
  });

  /**
   * GET /api/v1/sandbox/state
   */
  fastify.get('/state', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const role = authReq.user!.role;

    // Return a safe empty state for students rather than 403
    // (students should never reach this via the fixed frontend, but handle gracefully in case)
    if (role === 'STUDENT_COLLEGE') {
      return reply.status(200).send({
        success: true,
        hasState: false,
        hasActiveSimulation: false,
        state: null,
        nextAction: 'USE_CLASSROOM_SIMULATION',
        message: 'Students use classroom simulation, not personal sandbox.'
      });
    }

    checkRole(authReq);
    const userId = authReq.user!.id;

    const inviteCode = `SANDBOX-${userId}`;
    const cls = await prisma.class.findUnique({
      where: { inviteCode }
    });

    if (!cls) {
      return reply.status(200).send({
        success: true,
        hasState: false,
        hasActiveSimulation: false,
        state: null,
        nextAction: 'CHOOSE_SIMULATION_TYPE'
      });
    }

    const state = await prisma.simulationState.findFirst({
      where: { userId, classId: cls.id },
      include: {
        class: {
          include: {
            scenario: true
          }
        }
      }
    });

    if (!state) {
      return reply.status(200).send({
        success: true,
        hasState: false,
        hasActiveSimulation: false,
        state: null,
        nextAction: 'CHOOSE_SIMULATION_TYPE'
      });
    }

    const progress = await prisma.studentSimulationProgress.findUnique({
      where: { simulationId: state.id }
    });

    return reply.status(200).send({
      success: true,
      hasState: true,
      hasActiveSimulation: true,
      state,
      progress
    });
  });

  /**
   * GET /api/v1/sandbox/decision
   */
  fastify.get('/decision', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    checkRole(authReq);
    const userId = authReq.user!.id;

    const inviteCode = `SANDBOX-${userId}`;
    const cls = await prisma.class.findUnique({
      where: { inviteCode }
    });

    if (!cls) {
      throw new NotFoundError('No active sandbox classroom found.');
    }

    const sim = await prisma.simulationState.findFirst({
      where: { userId, classId: cls.id }
    });

    if (!sim) {
      throw new NotFoundError('No active sandbox simulation found.');
    }

    const decision = await prisma.decision.findUnique({
      where: {
        simulationId_round: { simulationId: sim.id, round: sim.currentRound }
      }
    });

    return reply.status(200).send({
      success: true,
      decision
    });
  });

  /**
   * POST /api/v1/sandbox/decision
   */
  fastify.post('/decision', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    checkRole(authReq);
    const userId = authReq.user!.id;

    const inviteCode = `SANDBOX-${userId}`;
    const cls = await prisma.class.findUnique({
      where: { inviteCode }
    });

    if (!cls) {
      throw new NotFoundError('No active sandbox classroom found.');
    }

    const sim = await prisma.simulationState.findFirst({
      where: { userId, classId: cls.id }
    });

    if (!sim) {
      throw new NotFoundError('No active sandbox simulation found.');
    }

    if (sim.status !== 'DECISION_OPEN') {
      throw new ValidationError('Simulation is not open for decisions.');
    }

    const mode = sim.simulationMode || 'GOOGLE_ADS';

    // Strict Mode-Specific Validation
    if (mode === 'GOOGLE_ADS') {
      const { seoTargetKeywords, seoBacklinkBudget, metaCampaigns } = request.body as any;
      if (
        (seoTargetKeywords && seoTargetKeywords.length > 0) ||
        (seoBacklinkBudget && seoBacklinkBudget > 0) ||
        (metaCampaigns && metaCampaigns.length > 0)
      ) {
        throw new ValidationError('Google Ads Simulation rejects SEO and Meta Ads settings.');
      }
      
      const { googleCampaigns } = request.body as any;
      const decision = await prisma.decision.upsert({
        where: {
          simulationId_round: { simulationId: sim.id, round: sim.currentRound }
        },
        update: {
          googleCampaigns: JSON.stringify(googleCampaigns || []),
          seoTargetKeywords: '[]',
          seoContentQuality: 0,
          seoBacklinkBudget: 0,
          metaCampaigns: '[]',
          submitted: true
        },
        create: {
          simulationId: sim.id,
          round: sim.currentRound,
          googleCampaigns: JSON.stringify(googleCampaigns || []),
          seoTargetKeywords: '[]',
          seoContentQuality: 0,
          seoBacklinkBudget: 0,
          metaCampaigns: '[]',
          submitted: true
        }
      });

      await logAudit(userId, 'decision submitted', `Submitted decisions for Google Ads Round ${sim.currentRound}`);
      return reply.status(200).send({ success: true, decision });

    } else if (mode === 'META_ADS') {
      const { seoTargetKeywords, seoBacklinkBudget, googleCampaigns } = request.body as any;
      if (
        (seoTargetKeywords && seoTargetKeywords.length > 0) ||
        (seoBacklinkBudget && seoBacklinkBudget > 0) ||
        (googleCampaigns && googleCampaigns.length > 0)
      ) {
        throw new ValidationError('Meta Ads Simulation rejects SEO and Google Ads settings.');
      }

      const { metaCampaigns } = request.body as any;
      const decision = await prisma.decision.upsert({
        where: {
          simulationId_round: { simulationId: sim.id, round: sim.currentRound }
        },
        update: {
          metaCampaigns: JSON.stringify(metaCampaigns || []),
          seoTargetKeywords: '[]',
          seoContentQuality: 0,
          seoBacklinkBudget: 0,
          googleCampaigns: '[]',
          submitted: true
        },
        create: {
          simulationId: sim.id,
          round: sim.currentRound,
          metaCampaigns: JSON.stringify(metaCampaigns || []),
          seoTargetKeywords: '[]',
          seoContentQuality: 0,
          seoBacklinkBudget: 0,
          googleCampaigns: '[]',
          submitted: true
        }
      });

      await logAudit(userId, 'decision submitted', `Submitted decisions for Meta Ads Round ${sim.currentRound}`);
      return reply.status(200).send({ success: true, decision });

    } else if (mode === 'SEO') {
      const { googleCampaigns, metaCampaigns } = request.body as any;
      if (
        (googleCampaigns && googleCampaigns.length > 0) ||
        (metaCampaigns && metaCampaigns.length > 0)
      ) {
        throw new ValidationError('SEO Simulation rejects Google Ads and Meta Ads settings.');
      }

      const {
        seoTargetKeywords,
        seoContentQuality,
        seoBacklinkBudget,
        seoMetaTitle,
        seoMetaDescription,
        seoBodyContent,
        seoUrlSlug,
        seoInternalLinks,
        seoAnchorText,
        seoBacklinkQuality,
        seoTechnicalConfig,
        seoCoreWebVitals
      } = request.body as any;

      const decision = await prisma.decision.upsert({
        where: {
          simulationId_round: { simulationId: sim.id, round: sim.currentRound }
        },
        update: {
          seoTargetKeywords: JSON.stringify(seoTargetKeywords || []),
          seoContentQuality: parseFloat(seoContentQuality) || 5.0,
          seoBacklinkBudget: parseFloat(seoBacklinkBudget) || 0.0,
          seoMetaTitle: seoMetaTitle || '',
          seoMetaDescription: seoMetaDescription || '',
          seoBodyContent: seoBodyContent || '',
          seoUrlSlug: seoUrlSlug || '',
          seoInternalLinks: parseInt(seoInternalLinks) || 0,
          seoAnchorText: seoAnchorText || '',
          seoBacklinkQuality: parseInt(seoBacklinkQuality) || 1,
          seoTechnicalConfig: JSON.stringify(seoTechnicalConfig || {}),
          seoCoreWebVitals: JSON.stringify(seoCoreWebVitals || {}),
          googleCampaigns: '[]',
          metaCampaigns: '[]',
          submitted: true
        },
        create: {
          simulationId: sim.id,
          round: sim.currentRound,
          seoTargetKeywords: JSON.stringify(seoTargetKeywords || []),
          seoContentQuality: parseFloat(seoContentQuality) || 5.0,
          seoBacklinkBudget: parseFloat(seoBacklinkBudget) || 0.0,
          seoMetaTitle: seoMetaTitle || '',
          seoMetaDescription: seoMetaDescription || '',
          seoBodyContent: seoBodyContent || '',
          seoUrlSlug: seoUrlSlug || '',
          seoInternalLinks: parseInt(seoInternalLinks) || 0,
          seoAnchorText: seoAnchorText || '',
          seoBacklinkQuality: parseInt(seoBacklinkQuality) || 1,
          seoTechnicalConfig: JSON.stringify(seoTechnicalConfig || {}),
          seoCoreWebVitals: JSON.stringify(seoCoreWebVitals || {}),
          googleCampaigns: '[]',
          metaCampaigns: '[]',
          submitted: true
        }
      });

      await logAudit(userId, 'decision submitted', `Submitted decisions for SEO Round ${sim.currentRound}`);
      return reply.status(200).send({ success: true, decision });
    }

    throw new ValidationError('Invalid simulation mode context.');
  });

  /**
   * POST /api/v1/sandbox/run
   */
  fastify.post('/run', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    checkRole(authReq);
    const userId = authReq.user!.id;

    const inviteCode = `SANDBOX-${userId}`;
    const cls = await prisma.class.findUnique({
      where: { inviteCode },
      include: { scenario: true }
    });

    if (!cls) {
      throw new NotFoundError('No active sandbox classroom found.');
    }

    const sim = await prisma.simulationState.findFirst({
      where: { userId, classId: cls.id }
    });

    if (!sim) {
      throw new NotFoundError('No active sandbox simulation found.');
    }

    if (sim.status !== 'DECISION_OPEN') {
      throw new ValidationError('Simulation is not in DECISION_OPEN status.');
    }

    const decision = await prisma.decision.findUnique({
      where: {
        simulationId_round: {
          simulationId: sim.id,
          round: sim.currentRound
        }
      }
    });

    if (!decision || !decision.submitted) {
      throw new ValidationError('Decisions must be submitted before running simulation.');
    }

    let waitHours = 0;
    if (authReq.user!.role === 'INDIVIDUAL') {
      // Individual Learner uses 24-hour cycle or packages
      const activeSub = await prisma.subscription.findFirst({
        where: { userId, status: 'active' },
        include: { plan: true }
      });
      const duration = activeSub?.plan?.durationDays || 30;
      waitHours = duration === 15 ? 12 : 24;
    } else if (authReq.user!.role === 'ADMIN') {
      const timingRule = cls.scenario.trendRefreshFrequency || 'instant';
      if (timingRule === '24h') {
        waitHours = 24;
      } else if (timingRule.startsWith('custom_')) {
        waitHours = parseInt(timingRule.replace('custom_', '')) || 0;
      }
    }

    if (waitHours > 0) {
      const nextResultAt = new Date(Date.now() + waitHours * 3600 * 1000);
      await prisma.simulationState.update({
        where: { id: sim.id },
        data: { status: 'PROCESSING' }
      });

      const progress = await prisma.studentSimulationProgress.update({
        where: { simulationId: sim.id },
        data: {
          status: 'PROCESSING',
          lastSubmittedAt: new Date(),
          nextResultAt
        }
      });

      await logAudit(userId, 'run scheduled', `Scheduled sandbox round ${sim.currentRound} with ${waitHours}h delay.`);

      return reply.status(200).send({
        success: true,
        instant: false,
        nextResultAt,
        progress
      });
    } else {
      await prisma.simulationState.update({
        where: { id: sim.id },
        data: { status: 'LOCKED' }
      });

      const result = await processSimulationRound(sim.id);

      await logAudit(userId, 'report generated', `Processed sandbox simulation round ${sim.currentRound} instantly.`);

      return reply.status(200).send({
        success: true,
        instant: true,
        result
      });
    }
  });

  /**
   * POST /api/v1/sandbox/fast-forward
   */
  fastify.post('/fast-forward', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    checkRole(authReq);
    const userId = authReq.user!.id;

    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenError('Fast-forward is disabled in production.');
    }

    const inviteCode = `SANDBOX-${userId}`;
    const cls = await prisma.class.findUnique({
      where: { inviteCode }
    });

    if (!cls) {
      throw new NotFoundError('No sandbox classroom found.');
    }

    const sim = await prisma.simulationState.findFirst({
      where: { userId, classId: cls.id }
    });

    if (!sim) {
      throw new NotFoundError('No active sandbox simulation found.');
    }

    await prisma.simulationState.update({
      where: { id: sim.id },
      data: { status: 'LOCKED' }
    });

    const result = await processSimulationRound(sim.id);

    await logAudit(userId, 'report generated', `Fast-forwarded and processed round ${sim.currentRound}.`);

    return reply.status(200).send({
      success: true,
      result
    });
  });

  /**
   * POST /api/v1/sandbox/next-cycle
   */
  fastify.post('/next-cycle', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    checkRole(authReq);
    const userId = authReq.user!.id;

    const inviteCode = `SANDBOX-${userId}`;
    const cls = await prisma.class.findUnique({
      where: { inviteCode }
    });

    if (!cls) {
      throw new NotFoundError('No sandbox classroom found.');
    }

    const sim = await prisma.simulationState.findFirst({
      where: { userId, classId: cls.id }
    });

    if (!sim) {
      throw new NotFoundError('No active sandbox simulation state found.');
    }

    if (sim.status !== 'RESULTS_READY') {
      throw new ValidationError('Simulation is not in RESULTS_READY status.');
    }

    await prisma.simulationState.update({
      where: { id: sim.id },
      data: { status: 'DECISION_OPEN' }
    });

    await prisma.studentSimulationProgress.update({
      where: { simulationId: sim.id },
      data: { status: 'DECISION_OPEN', nextResultAt: null }
    });

    const decision = await prisma.decision.upsert({
      where: {
        simulationId_round: {
          simulationId: sim.id,
          round: sim.currentRound
        }
      },
      update: { submitted: false },
      create: {
        simulationId: sim.id,
        round: sim.currentRound,
        seoTargetKeywords: '[]',
        googleCampaigns: '[]',
        metaCampaigns: '[]',
        submitted: false
      }
    });

    await logAudit(userId, 'next cycle started', `Opened round ${sim.currentRound} for decision submissions.`);

    return reply.status(200).send({
      success: true,
      status: 'DECISION_OPEN',
      currentRound: sim.currentRound,
      decision
    });
  });

  /**
   * GET /api/v1/sandbox/report
   */
  fastify.get('/report', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    checkRole(authReq);
    const userId = authReq.user!.id;

    const inviteCode = `SANDBOX-${userId}`;
    const cls = await prisma.class.findUnique({
      where: { inviteCode }
    });

    if (!cls) {
      throw new NotFoundError('No sandbox classroom found.');
    }

    const state = await prisma.simulationState.findFirst({
      where: { userId, classId: cls.id },
      include: {
        class: {
          include: {
            scenario: true
          }
        }
      }
    });

    if (!state) {
      throw new NotFoundError('No sandbox simulation state found.');
    }

    const metrics = await prisma.dailyMetric.findMany({
      where: { simulationId: state.id },
      orderBy: { day: 'asc' }
    });

    const breakdowns = await prisma.scoreBreakdown.findMany({
      where: { simulationId: state.id },
      orderBy: { round: 'asc' }
    });

    const mode = state.simulationMode || 'GOOGLE_ADS';

    let totalImpressions = 0;
    let totalClicks = 0;
    let totalCost = 0;
    let totalConversions = 0;
    let totalRevenue = 0;

    for (const m of metrics) {
      if (mode === 'GOOGLE_ADS') {
        totalImpressions += m.googleImpressions;
        totalClicks += m.googleClicks;
        totalCost += m.googleCost;
        totalConversions += m.googleConversions;
      } else if (mode === 'META_ADS') {
        totalImpressions += m.metaImpressions;
        totalClicks += m.metaClicks;
        totalCost += m.metaCost;
        totalConversions += m.metaConversions;
      } else if (mode === 'SEO') {
        totalImpressions += m.organicImpressions;
        totalClicks += m.organicClicks;
        totalCost += m.organicConversions * 5.0; // Simulated organic cost overhead
        totalConversions += m.organicConversions;
      }
      totalRevenue += m.revenue;
    }

    const summary = {
      impressions: totalImpressions,
      clicks: totalClicks,
      cost: totalCost,
      conversions: totalConversions,
      revenue: totalRevenue,
      spend: totalCost,
      roas: totalCost > 0 ? parseFloat((totalRevenue / totalCost).toFixed(2)) : 0,
      cpc: totalClicks > 0 ? parseFloat((totalCost / totalClicks).toFixed(2)) : 0,
      ctr: totalImpressions > 0 ? parseFloat((totalClicks / totalImpressions).toFixed(4)) : 0,
      cpa: totalConversions > 0 ? parseFloat((totalCost / totalConversions).toFixed(2)) : 0,
      score: state.score,
      adaptability: breakdowns[breakdowns.length - 1]?.adaptability || 50
    };

    const decision = await prisma.decision.findFirst({
      where: { simulationId: state.id },
      orderBy: { round: 'desc' }
    });

    const userTexts: string[] = [];
    if (decision) {
      try {
        const keywords = typeof decision.seoTargetKeywords === 'string' ? JSON.parse(decision.seoTargetKeywords) : (decision.seoTargetKeywords || []);
        userTexts.push(...keywords);
      } catch (e) {}
      if (decision.seoMetaTitle) userTexts.push(decision.seoMetaTitle);
      if (decision.seoMetaDescription) userTexts.push(decision.seoMetaDescription);
      if (decision.seoBodyContent) userTexts.push(decision.seoBodyContent);
      if (decision.seoAnchorText) userTexts.push(decision.seoAnchorText);
      try {
        const googleCampaigns = typeof decision.googleCampaigns === 'string' ? JSON.parse(decision.googleCampaigns) : (decision.googleCampaigns || []);
        googleCampaigns.forEach((c: any) => {
          userTexts.push(c.name || '');
          if (c.keywords) c.keywords.forEach((k: any) => userTexts.push(k.word || ''));
          if (c.adCopy) {
            userTexts.push(c.adCopy.headline1 || '');
            userTexts.push(c.adCopy.headline2 || '');
            userTexts.push(c.adCopy.headline3 || '');
            userTexts.push(c.adCopy.description1 || '');
            userTexts.push(c.adCopy.description2 || '');
          }
        });
      } catch (e) {}
      try {
        const metaCampaigns = typeof decision.metaCampaigns === 'string' ? JSON.parse(decision.metaCampaigns) : (decision.metaCampaigns || []);
        metaCampaigns.forEach((c: any) => {
          userTexts.push(c.name || '');
          userTexts.push(c.audienceInterest || '');
          if (c.creative) {
            userTexts.push(c.creative.headline || '');
            userTexts.push(c.creative.primaryText || '');
          }
        });
      } catch (e) {}
    }

    const relevanceResult = validateScenarioRelevance(
      state.class.scenario.industry,
      state.class.scenario.name,
      state.class.scenario.description,
      userTexts
    );

    const recommendations = generateSandboxRecommendations(
      mode,
      decision || {},
      metrics,
      summary,
      relevanceResult.score
    );

    return reply.status(200).send({
      success: true,
      metrics,
      breakdowns,
      summary,
      recommendations
    });
  });

  /**
   * GET /api/v1/sandbox/certificate/check
   */
  fastify.get('/certificate/check', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    checkRole(authReq);
    const userId = authReq.user!.id;

    const inviteCode = `SANDBOX-${userId}`;
    const cls = await prisma.class.findUnique({
      where: { inviteCode }
    });

    if (!cls) {
      return reply.status(200).send({
        success: true,
        eligible: false,
        reasons: ['No active sandbox simulation setup.']
      });
    }

    const state = await prisma.simulationState.findFirst({
      where: { userId, classId: cls.id }
    });

    if (!state) {
      return reply.status(200).send({
        success: true,
        eligible: false,
        reasons: ['No sandbox simulation state found.']
      });
    }

    const eligibility = await checkCertificateEligibility(state.id);

    return reply.status(200).send({
      success: true,
      ...eligibility
    });
  });

  /**
   * POST /api/v1/sandbox/certificate/generate
   */
  fastify.post('/certificate/generate', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    checkRole(authReq);
    const userId = authReq.user!.id;

    const inviteCode = `SANDBOX-${userId}`;
    const cls = await prisma.class.findUnique({
      where: { inviteCode }
    });

    if (!cls) {
      throw new NotFoundError('No sandbox classroom found.');
    }

    const sim = await prisma.simulationState.findFirst({
      where: { userId, classId: cls.id },
      include: { user: true, class: { include: { scenario: true } } }
    });

    if (!sim) {
      throw new NotFoundError('Simulation state not found.');
    }

    const eligibility = await checkCertificateEligibility(sim.id);
    if (!eligibility.eligible) {
      throw new ValidationError(`User is not eligible for a certificate. Reasons: ${eligibility.reasons.join(', ')}`);
    }

    let cert = await prisma.certificate.findFirst({
      where: { simulationId: sim.id }
    });

    const skills = [
      sim.simulationMode === 'SEO' ? "Technical SEO & Rankings" : (sim.simulationMode === 'META_ADS' ? "Meta Social CPM Audiences" : "Google Search CPC Campaigns"),
      "Budget Allocation",
      "Conversion Optimization"
    ];

    if (cert) {
      return reply.status(200).send({
        success: true,
        certificate: cert,
        downloadUrl: cert.pdfUrl
      });
    }

    const year = new Date().getFullYear();
    const random4 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const hash = crypto.createHash('sha256').update(sim.user.name + sim.id).digest('hex').substring(0, 8).toUpperCase();
    const verificationId = `DMSL-${year}-${random4}-${hash}`;

    const verificationHash = crypto.createHash('sha256').update(verificationId).digest('hex');
    const downloadUrl = `/api/certificates/${sim.id}/download`;

    await generateCertificatePDF(
      sim.user.name,
      sim.class.scenario.industry,
      eligibility.band,
      skills,
      verificationId,
      new Date()
    );

    cert = await prisma.certificate.create({
      data: {
        simulationId: sim.id,
        userId: sim.userId,
        recipientName: sim.user.name,
        verificationHash,
        verificationId,
        compositeScore: eligibility.compositeScore,
        pdfUrl: downloadUrl,
        band: eligibility.band,
        skills: JSON.stringify(skills)
      }
    });

    await logAudit(userId, 'certificate generated', `Generated certificate ${verificationId} with band ${eligibility.band}`);

    return reply.status(201).send({
      success: true,
      certificate: cert,
      downloadUrl
    });
  });
}
