import { FastifyInstance } from 'fastify';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import { prisma } from '../db/client';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import { logActivity } from '../utils/audit';
import { config } from '../config';
import { processCampaignWithCatchup } from '../jobs/schedulers/daily-campaign-scheduler';
import { logger } from '../utils/logger';
import { z } from 'zod';

export async function campaignRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/campaign/start
   * Boots the active daily campaign run for a student
   */
  fastify.post('/start', { preHandler: [requireAuth] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user!.id;
    const classId = authReq.user!.classId;
    const role = authReq.user!.role;

    let scenarioId: string;
    let durationDays = 30;
    let assignmentId: string | undefined = undefined;

    const now = new Date();
    const activeAssignmentRelation = await prisma.scenarioAssignmentStudent.findFirst({
      where: {
        studentId: userId,
        status: 'ASSIGNED',
        assignment: {
          status: 'ACTIVE',
          startDate: { lte: now },
          endDate: { gte: now }
        }
      },
      include: {
        assignment: true
      }
    });

    if (activeAssignmentRelation) {
      const assignment = activeAssignmentRelation.assignment;
      scenarioId = assignment.scenarioId;
      durationDays = assignment.durationDays;
      assignmentId = assignment.id;
    } else if (!classId) {
      if (role !== 'INDIVIDUAL') {
        throw new ValidationError('You must join a class cohort before starting a daily campaign.');
      }

      // Individual sandbox run: find first available scenario
      const defaultScenario = await prisma.scenario.findFirst({
        orderBy: { createdAt: 'asc' }
      });
      if (!defaultScenario) {
        throw new NotFoundError('No marketing scenarios available for sandbox campaign.');
      }
      scenarioId = defaultScenario.id;
      durationDays = defaultScenario.durationDays || 30;
    } else {
      const targetClass = await prisma.class.findUnique({
        where: { id: classId },
        include: { scenario: true },
      });

      if (!targetClass) {
        throw new NotFoundError('Class cohort not found.');
      }
      scenarioId = targetClass.scenarioId;
      durationDays = targetClass.scenario.durationDays || 30;
    }

    let targetClassId = classId;
    if (!targetClassId) {
      if (role !== 'INDIVIDUAL') {
        throw new ValidationError('You must join a class cohort before starting a daily campaign.');
      }

      // Individual sandbox run: find or create sandbox class
      let sandboxClass = await prisma.class.findFirst({
        where: { inviteCode: 'SANDBOX' }
      });
      if (!sandboxClass) {
        let instructor = await prisma.user.findFirst({ where: { role: 'INSTRUCTOR' } });
        if (!instructor) {
          instructor = await prisma.user.create({
            data: {
              email: 'sandbox-instructor@simulation.com',
              emailVerified: true,
              name: 'Sandbox Instructor',
              role: 'INSTRUCTOR',
            }
          });
        }
        sandboxClass = await prisma.class.create({
          data: {
            name: 'Individual Sandbox Cohort',
            inviteCode: 'SANDBOX',
            instructorId: instructor.id,
            scenarioId,
          }
        });
      }
      targetClassId = sandboxClass.id;
      // Also update the user's classId
      await prisma.user.update({
        where: { id: userId },
        data: { classId: targetClassId }
      });
    }

    // Check for an active run
    let activeRun = await prisma.campaignRun.findFirst({
      where: {
        userId,
        classId: targetClassId,
        status: 'ACTIVE',
      },
    });

    if (activeRun) {
      return reply.status(200).send({
        success: true,
        campaignRunId: activeRun.id,
        currentDay: activeRun.currentDay,
        durationDays: activeRun.durationDays,
        status: activeRun.status,
      });
    }

    // Ensure SimulationState exists for this student and class
    const existingState = await prisma.simulationState.findFirst({
      where: { userId, classId: targetClassId }
    });
    if (!existingState) {
      let activeMode = 'GOOGLE_ADS';
      if (activeAssignmentRelation?.assignment?.simulationMode) {
        activeMode = activeAssignmentRelation.assignment.simulationMode;
      } else {
        const sc = await prisma.scenario.findUnique({ where: { id: scenarioId } });
        if (sc?.simulationMode) {
          activeMode = sc.simulationMode;
        }
      }

      const newState = await prisma.simulationState.create({
        data: {
          userId,
          classId: targetClassId,
          currentRound: 1,
          isCompleted: false,
          status: 'DECISION_OPEN',
          simulationMode: activeMode,
        }
      });
      const totalDays = durationDays || 30;
      await prisma.studentSimulationProgress.create({
        data: {
          simulationId: newState.id,
          currentDay: 1,
          totalDays,
          status: 'DECISION_OPEN'
        }
      });
    } else {
      if (!existingState.simulationMode) {
        let activeMode = 'GOOGLE_ADS';
        if (activeAssignmentRelation?.assignment?.simulationMode) {
          activeMode = activeAssignmentRelation.assignment.simulationMode;
        } else {
          const sc = await prisma.scenario.findUnique({ where: { id: scenarioId } });
          if (sc?.simulationMode) {
            activeMode = sc.simulationMode;
          }
        }
        await prisma.simulationState.update({
          where: { id: existingState.id },
          data: { simulationMode: activeMode }
        });
      }
    }

    // Create a new daily campaign run
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + durationDays * 24 * 3600 * 1000);
    
    let nextProcessingAt = new Date(startedAt.getTime() + 24 * 3600 * 1000); // due in 24 hours
    if (activeAssignmentRelation?.assignment.dailyProcessingTime) {
      const [hours, minutes] = activeAssignmentRelation.assignment.dailyProcessingTime.split(':').map(Number);
      nextProcessingAt = new Date();
      nextProcessingAt.setDate(nextProcessingAt.getDate() + 1); // tomorrow
      nextProcessingAt.setHours(hours, minutes, 0, 0);
    }

    activeRun = await prisma.campaignRun.create({
      data: {
        userId,
        scenarioId,
        classId: targetClassId,
        assignmentId,
        durationDays,
        currentDay: 1,
        status: 'ACTIVE',
        startedAt,
        endsAt,
        nextProcessingAt,
      },
    });

    if (activeAssignmentRelation) {
      await prisma.scenarioAssignmentStudent.update({
        where: { id: activeAssignmentRelation.id },
        data: {
          status: 'STARTED',
          startedAt: new Date(),
          campaignRunId: activeRun.id,
        }
      });
    }

    await logActivity(
      userId,
      'CAMPAIGN_RUN_START',
      `Started a new ${durationDays}-day daily market campaign simulation.`
    );

    return reply.status(201).send({
      success: true,
      campaignRunId: activeRun.id,
      currentDay: activeRun.currentDay,
      durationDays: activeRun.durationDays,
      status: activeRun.status,
    });
  });

  /**
   * GET /api/v1/campaign/state
   * Retrieves student's current active daily campaign run
   */
  fastify.get('/state', { preHandler: [requireAuth] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user!.id;
    const classId = authReq.user!.classId;
    const role = authReq.user!.role;

    if (!classId && role !== 'INDIVIDUAL') {
      return reply.status(200).send({
        success: true,
        hasRun: false,
        run: null,
      });
    }

    try {
      const run = await prisma.campaignRun.findFirst({
        where: {
          userId,
          classId: classId || null,
          status: 'ACTIVE',
        },
        include: {
          scenario: true,
          assignment: true,
        },
      });

      if (!run) {
        // Find latest completed campaign run if no active one exists
        const latestCompleted = await prisma.campaignRun.findFirst({
          where: { userId, classId: classId || null, status: 'COMPLETED' },
          orderBy: { updatedAt: 'desc' },
          include: { scenario: true, assignment: true },
        });

        // Return null gracefully — frontend should prompt user to start a campaign
        if (!latestCompleted) {
          return reply.status(200).send({
            success: true,
            hasRun: false,
            run: null,
          });
        }

        return reply.status(200).send({
          success: true,
          hasRun: true,
          run: latestCompleted,
        });
      }

      return reply.status(200).send({
        success: true,
        run,
      });
    } catch (err) {
      logger.error(err, 'Failed to fetch campaign state, returning fallback null');
      return reply.status(200).send({
        success: true,
        hasRun: false,
        run: null,
      });
    }
  });

  /**
   * POST /api/v1/campaign/decision
   * Saves settings for today's campaign step
   */
  fastify.post('/decision', { preHandler: [requireAuth] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user!.id;
    const classId = authReq.user!.classId;

    const bodySchema = z.object({
      campaignRunId: z.string().uuid(),
      dayNumber: z.number().int().positive(),
      seoSettings: z.object({
        targetKeywords: z.array(z.string()).min(1, 'Select at least one keyword'),
        contentQuality: z.number().min(1).max(10),
        backlinkBudget: z.number().nonnegative(),
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
        h1Header: z.string().optional(),
        bodyContent: z.string().optional(),
      }),
      googleAdsSettings: z.object({
        campaigns: z.array(z.any()),
      }),
      metaAdsSettings: z.object({
        campaigns: z.array(z.any()),
      }),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { campaignRunId, dayNumber, seoSettings, googleAdsSettings, metaAdsSettings } = parsed.data;

    const run = await prisma.campaignRun.findUnique({
      where: { id: campaignRunId },
      include: { scenario: true, assignment: true },
    });

    if (!run) {
      throw new NotFoundError('Campaign run not found.');
    }

    if (run.userId !== userId) {
      throw new ForbiddenError('You do not own this campaign run.');
    }

    if (run.status !== 'ACTIVE') {
      throw new ValidationError('This campaign is completed or inactive.');
    }

    if (run.currentDay !== dayNumber) {
      throw new ValidationError(`You can only submit decisions for today (Day ${run.currentDay}). Day ${dayNumber} is locked.`);
    }

    // Enforce budget constraint
    const totalGoogleBudget = googleAdsSettings.campaigns.reduce((sum: number, c: any) => sum + (c.budget || 0), 0);
    const totalMetaBudget = metaAdsSettings.campaigns.reduce((sum: number, c: any) => sum + (c.budget || 0), 0);
    const totalProposedSpend = seoSettings.backlinkBudget + totalGoogleBudget + totalMetaBudget;

    const dailyBudgetCap = run.assignment?.dailyBudgetCap ?? run.scenario.dailyBudgetCap;
    if (totalProposedSpend > dailyBudgetCap) {
      throw new ValidationError(`Daily budget allocation of $${totalProposedSpend} exceeds the daily limit of $${dailyBudgetCap}.`);
    }

    const decision = await prisma.dailyCampaignDecision.upsert({
      where: {
        campaignRunId_dayNumber: {
          campaignRunId,
          dayNumber,
        },
      },
      update: {
        seoSettingsJson: seoSettings,
        googleAdsSettingsJson: googleAdsSettings,
        metaAdsSettingsJson: metaAdsSettings,
        budgetJson: { totalAllocated: totalProposedSpend },
      },
      create: {
        campaignRunId,
        userId,
        dayNumber,
        seoSettingsJson: seoSettings,
        googleAdsSettingsJson: googleAdsSettings,
        metaAdsSettingsJson: metaAdsSettings,
        budgetJson: { totalAllocated: totalProposedSpend },
      },
    });

    return reply.status(200).send({
      success: true,
      decision,
    });
  });

  /**
   * GET /api/v1/campaign/results
   * Fetches results timeline for a campaign run
   */
  fastify.get('/results', { preHandler: [requireAuth] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user!.id;

    const { campaignRunId } = request.query as { campaignRunId?: string };

    if (!campaignRunId) {
      throw new ValidationError('campaignRunId query parameter is required.');
    }

    const run = await prisma.campaignRun.findUnique({
      where: { id: campaignRunId }
    });

    if (!run) {
      throw new NotFoundError('Campaign run not found.');
    }

    if (run.userId !== userId) {
      throw new ForbiddenError('You do not own this campaign run.');
    }

    const results = await prisma.dailyCampaignResult.findMany({
      where: {
        campaignRunId,
        userId,
      },
      orderBy: {
        dayNumber: 'asc',
      },
      include: {
        trendSnapshot: true,
      },
    });

    return reply.status(200).send({
      success: true,
      results,
    });
  });

  /**
   * GET /api/v1/campaign/recommendations
   * Fetches actionable insights for tomorrow based on today's performance
   */
  fastify.get('/recommendations', { preHandler: [requireAuth] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user!.id;
    const { campaignRunId, dayNumber } = request.query as { campaignRunId?: string; dayNumber?: string };

    if (!campaignRunId || !dayNumber) {
      throw new ValidationError('campaignRunId and dayNumber query parameters are required.');
    }

    const run = await prisma.campaignRun.findUnique({
      where: { id: campaignRunId }
    });

    if (!run) {
      throw new NotFoundError('Campaign run not found.');
    }

    if (run.userId !== userId) {
      throw new ForbiddenError('You do not own this campaign run.');
    }

    const recommendations = await prisma.dailyCampaignRecommendation.findMany({
      where: {
        campaignRunId,
        dayNumber: parseInt(dayNumber),
      },
    });

    return reply.status(200).send({
      success: true,
      recommendations,
    });
  });

  /**
   * POST /api/v1/campaign/fast-forward
   * Development-only shortcut to process campaign day instantly
   */
  fastify.post('/fast-forward', { preHandler: [requireAuth] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    
    // Safety check: only allow fast-forward in dev and test environments
    if (config.NODE_ENV !== 'development' && config.NODE_ENV !== 'test') {
      throw new ForbiddenError('Fast-forward is locked in production/staging environments.');
    }

    const bodySchema = z.object({
      campaignRunId: z.string().uuid(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { campaignRunId } = parsed.data;

    const run = await prisma.campaignRun.findUnique({
      where: { id: campaignRunId },
    });

    if (!run) {
      throw new NotFoundError('Campaign run not found.');
    }

    if (run.status !== 'ACTIVE') {
      throw new ValidationError('Campaign is not active.');
    }

    await prisma.campaignRun.update({
      where: { id: campaignRunId },
      data: { nextProcessingAt: new Date(Date.now() - 1000) }
    });
    logger.info({ campaignRunId }, 'Triggering developer fast-forward daily simulation run...');
    await processCampaignWithCatchup(campaignRunId);

    const updatedRun = await prisma.campaignRun.findUnique({
      where: { id: campaignRunId },
    });

    return reply.status(200).send({
      success: true,
      currentDay: updatedRun?.currentDay,
      status: updatedRun?.status,
    });
  });

  /**
   * GET /api/v1/campaign/class-leaderboard
   * Fetches competitive ranking of students in the same class cohort
   */
  fastify.get('/class-leaderboard', { preHandler: [requireAuth] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const classId = authReq.user!.classId;

    if (!classId) {
      throw new ValidationError('You are not registered in a class cohort.');
    }

    // Aggregate average scores of all completed daily campaigns or active runs in the class
    const leaderboard = await prisma.campaignRun.findMany({
      where: { classId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        results: {
          select: {
            compositeScore: true,
          },
        },
      },
    });

    const standings = leaderboard.map(run => {
      const avgScore = run.results.length > 0
        ? run.results.reduce((sum, r) => sum + r.compositeScore, 0) / run.results.length
        : 0.0;

      return {
        userId: run.userId,
        studentName: run.user.name,
        campaignRunId: run.id,
        currentDay: run.currentDay,
        durationDays: run.durationDays,
        averageScore: parseFloat(avgScore.toFixed(2)),
        status: run.status,
      };
    }).sort((a, b) => b.averageScore - a.averageScore);

    return reply.status(200).send({
      success: true,
      leaderboard: standings,
    });
  });

  /**
   * GET /api/v1/campaign/instructor-daily-report
   * Retrieves classroom daily submission logs and performance summaries
   */
  fastify.get('/instructor-daily-report', { preHandler: [requireAuth] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    
    // Ensure user is an instructor or admin
    if (authReq.user!.role !== 'INSTRUCTOR' && authReq.user!.role !== 'admin') {
      throw new ForbiddenError('Only instructors can view classroom daily reports.');
    }

    const { classId, dayNumber } = request.query as { classId?: string; dayNumber?: string };

    if (!classId || !dayNumber) {
      throw new ValidationError('classId and dayNumber query parameters are required.');
    }

    const targetDay = parseInt(dayNumber);

    // Fetch class and all registered students
    const targetClass = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!targetClass) {
      throw new NotFoundError('Class cohort not found.');
    }

    // Get all campaign runs for this class
    const runs = await prisma.campaignRun.findMany({
      where: { classId },
      include: {
        decisions: {
          where: { dayNumber: targetDay },
        },
        results: {
          where: { dayNumber: targetDay },
        },
      },
    });

    const submittedStudents: any[] = [];
    const missedStudents: any[] = [];
    let scoreSum = 0;
    let scoreCount = 0;

    targetClass.students.forEach(student => {
      const studentRun = runs.find(r => r.userId === student.id);
      const hasSubmitted = studentRun?.decisions && studentRun.decisions.length > 0;
      const resultObj = studentRun?.results && studentRun.results[0];

      const studentData = {
        id: student.id,
        name: student.name,
        email: student.email,
        score: resultObj ? resultObj.compositeScore : null,
      };

      if (hasSubmitted) {
        submittedStudents.push(studentData);
      } else {
        missedStudents.push(studentData);
      }

      if (resultObj) {
        scoreSum += resultObj.compositeScore;
        scoreCount++;
      }
    });

    const classAverage = scoreCount > 0 ? parseFloat((scoreSum / scoreCount).toFixed(2)) : 0.0;

    return reply.status(200).send({
      success: true,
      classId,
      dayNumber: targetDay,
      classAverage,
      submittedCount: submittedStudents.length,
      missedCount: missedStudents.length,
      submittedStudents,
      missedStudents,
    });
  });
}

