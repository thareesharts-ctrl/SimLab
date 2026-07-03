import { FastifyInstance } from 'fastify';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import { prisma } from '../db/client';
import { z } from 'zod';
import { ValidationError, NotFoundError } from '../utils/errors';
import { logActivity, createNotification } from '../utils/audit';

export async function seoRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/seo/decision
   * Retrieves active round decisions for SEO targets
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
      decision: decision ? {
        seoTargetKeywords: JSON.parse(decision.seoTargetKeywords),
        seoContentQuality: decision.seoContentQuality,
        seoBacklinkBudget: decision.seoBacklinkBudget,
        submitted: decision.submitted
      } : null
    });
  });

  /**
   * POST /api/v1/seo/decision
   * Saves/Updates current SEO decisions
   */
  fastify.post('/decision', { preHandler: [requireAuth] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    
    const bodySchema = z.object({
      seoTargetKeywords: z.array(z.string()).min(1, 'At least one keyword is required'),
      seoContentQuality: z.number().min(1).max(10),
      seoBacklinkBudget: z.number().nonnegative()
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

    if (sim.simulationMode && sim.simulationMode !== 'SEO') {
      throw new ValidationError(`This class simulation is restricted to ${sim.simulationMode}. You cannot submit SEO decisions.`);
    }

    if (sim.status !== 'DECISION_OPEN') {
      await prisma.hardViolation.create({
        data: {
          simulationId: sim.id,
          roundNumber: sim.currentRound,
          type: 'ATTEMPT_TO_EDIT_LOCKED_DECISION',
          severity: 'BLOCKING',
          message: `Attempted to update SEO decisions when simulation status was locked in "${sim.status}".`
        }
      });
      throw new ValidationError('Simulation is locked. Cannot edit decisions.');
    }

    // Upsert decision record for current round
    const decision = await prisma.decision.upsert({
      where: {
        simulationId_round: {
          simulationId: sim.id,
          round: sim.currentRound
        }
      },
      update: {
        seoTargetKeywords: JSON.stringify(parsed.data.seoTargetKeywords),
        seoContentQuality: parsed.data.seoContentQuality,
        seoBacklinkBudget: parsed.data.seoBacklinkBudget
      },
      create: {
        simulationId: sim.id,
        round: sim.currentRound,
        seoTargetKeywords: JSON.stringify(parsed.data.seoTargetKeywords),
        seoContentQuality: parsed.data.seoContentQuality,
        seoBacklinkBudget: parsed.data.seoBacklinkBudget,
        googleCampaigns: JSON.stringify([]),
        metaCampaigns: JSON.stringify([])
      }
    });

    // Write audit log with "fees of operation" (backlink budget spent)
    await logActivity(
      authReq.user!.id,
      'SEO_DECISION_SUBMIT',
      `Submitted SEO choices for Round ${sim.currentRound}. Targeted keywords: ${parsed.data.seoTargetKeywords.join(', ')}. Backlink Budget Spent: $${parsed.data.seoBacklinkBudget}.`
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
        'SEO Campaign Updated',
        `${authReq.user!.name} updated SEO campaign choices. Spent $${parsed.data.seoBacklinkBudget} on backlink budget.`,
        authReq.user!.name,
        '/instructor'
      );
    }

    return reply.status(200).send({
      success: true,
      decision: {
        seoTargetKeywords: JSON.parse(decision.seoTargetKeywords),
        seoContentQuality: decision.seoContentQuality,
        seoBacklinkBudget: decision.seoBacklinkBudget
      }
    });
  });
}

