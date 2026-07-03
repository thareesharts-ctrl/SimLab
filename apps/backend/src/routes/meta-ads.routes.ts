import { FastifyInstance } from 'fastify';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import { prisma } from '../db/client';
import { z } from 'zod';
import { ValidationError, NotFoundError } from '../utils/errors';
import { logActivity, createNotification } from '../utils/audit';

export async function metaAdsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/meta-ads/decision
   * Retrieves active round Meta campaigns
   */
  fastify.get('/decision', { preHandler: [requireAuth] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    
    const sim = await prisma.simulationState.findFirst({
      where: { userId: authReq.user!.id, classId: authReq.user!.classId! }
    });

    if (!sim) {
      throw new NotFoundError('Simulation not initialized.');
    }

    const decision = await prisma.decision.findUnique({
      where: {
        simulationId_round: {
          simulationId: sim.id,
          round: sim.currentRound
        }
      }
    });

    return reply.status(200).send({
      success: true,
      campaigns: decision ? JSON.parse(decision.metaCampaigns) : []
    });
  });

  /**
   * POST /api/v1/meta-ads/decision
   * Saves Meta campaigns configurations
   */
  fastify.post('/decision', { preHandler: [requireAuth] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;

    const bodySchema = z.object({
      campaigns: z.array(z.object({
        name: z.string().min(1, 'Campaign name is required'),
        budget: z.number().nonnegative('Budget must be positive'),
        audienceInterest: z.string().min(1, 'Audience selection is required'),
        bidType: z.enum(['LOWEST_COST', 'BID_CAP']),
        bidAmount: z.number().nonnegative().default(0),
        placement: z.string().min(1, 'Placement selection is required'),
        creativeQuality: z.number().min(1).max(10, 'Creative quality must be between 1 and 10')
      }))
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const sim = await prisma.simulationState.findFirst({
      where: { userId: authReq.user!.id, classId: authReq.user!.classId! }
    });

    if (!sim) {
      throw new NotFoundError('Simulation not initialized.');
    }

    if (sim.simulationMode && sim.simulationMode !== 'META_ADS') {
      throw new ValidationError(`This class simulation is restricted to ${sim.simulationMode}. You cannot submit Meta Ads decisions.`);
    }

    if (sim.status !== 'DECISION_OPEN') {
      await prisma.hardViolation.create({
        data: {
          simulationId: sim.id,
          roundNumber: sim.currentRound,
          type: 'ATTEMPT_TO_EDIT_LOCKED_DECISION',
          severity: 'BLOCKING',
          message: `Attempted to update Meta Ads decisions when simulation status was locked in "${sim.status}".`
        }
      });
      throw new ValidationError('Simulation is locked. Cannot edit decisions.');
    }

    const decision = await prisma.decision.upsert({
      where: {
        simulationId_round: {
          simulationId: sim.id,
          round: sim.currentRound
        }
      },
      update: {
        metaCampaigns: JSON.stringify(parsed.data.campaigns)
      },
      create: {
        simulationId: sim.id,
        round: sim.currentRound,
        metaCampaigns: JSON.stringify(parsed.data.campaigns),
        seoTargetKeywords: JSON.stringify([]),
        seoContentQuality: 5.0,
        seoBacklinkBudget: 0.0,
        googleCampaigns: JSON.stringify([])
      }
    });

    // Write audit log with "fees of operation" (Meta Ads budgets spent)
    const totalMetaBudget = parsed.data.campaigns.reduce((acc, c) => acc + c.budget, 0);
    await logActivity(
      authReq.user!.id,
      'META_ADS_DECISION_SUBMIT',
      `Submitted Meta Ads choices for Round ${sim.currentRound}. Created ${parsed.data.campaigns.length} campaigns. Total Meta Ads Budget Spent: $${totalMetaBudget}.`
    );

    // Notify instructor
    const targetClass = await prisma.class.findUnique({
      where: { id: sim.classId },
      select: { instructorId: true }
    });
    if (targetClass?.instructorId) {
      await createNotification(
        targetClass.instructorId,
        'info',
        'Meta Ads Campaign Updated',
        `${authReq.user!.name} updated Meta Ads campaigns. Total budget spent: $${totalMetaBudget}.`,
        authReq.user!.name,
        '/instructor'
      );
    }

    return reply.status(200).send({
      success: true,
      campaigns: JSON.parse(decision.metaCampaigns)
    });
  });
}

