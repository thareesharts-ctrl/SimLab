import { FastifyInstance } from 'fastify';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';
import { prisma } from '../db/client';
import { z } from 'zod';
import { ValidationError, NotFoundError } from '../utils/errors';
import { logActivity, createNotification } from '../utils/audit';

export async function googleAdsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/google-ads/decision
   * Fetches the Google Ads campaign configs for the current round
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
      campaigns: decision ? JSON.parse(decision.googleCampaigns) : []
    });
  });

  /**
   * POST /api/v1/google-ads/decision
   * Updates/Saves Google Ads campaign configs.
   * Supports Search, Display, Video, and Shopping campaign types.
   */
  fastify.post('/decision', { preHandler: [requireAuth] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;

    const campaignSchema = z.object({
      name: z.string().min(1, 'Campaign name cannot be empty'),
      campaignType: z.enum(['Search', 'Display', 'Video', 'Shopping']).default('Search'),
      objective: z.string().optional(),
      biddingStrategy: z.string().optional(),
      budget: z.number().nonnegative('Budget must be positive'),
      // Search campaigns use keyword-based targeting
      keywords: z.array(z.object({
        word: z.string().min(1, 'Keyword word is required'),
        bid: z.number().positive('Bid must be greater than zero'),
        matchType: z.enum(['broad', 'phrase', 'exact']).optional()
      })).optional().default([]),
      negativeKeywords: z.array(z.string()).optional().default([]),
      // Display campaigns use audience interest targeting
      audiences: z.array(z.string()).optional().default([]),
      // Video campaigns: CPV-based targeting
      creativeVideoUrl: z.string().optional(),
      targetCpvBid: z.number().nonnegative().optional(),
      // Shopping campaigns: product catalog
      productFeeds: z.array(z.object({
        productId: z.string(),
        bid: z.number().positive()
      })).optional().default([]),
      // Ad copy shared across campaign types
      adCopy: z.object({
        headline1: z.string().optional(),
        headline2: z.string().optional(),
        headline3: z.string().optional(),
        description1: z.string().optional(),
        description2: z.string().optional(),
        imageUrl: z.string().optional()
      }).optional(),
      landingPage: z.object({
        pageRelevance: z.number().min(0).max(10).optional(),
        mobileFriendly: z.number().min(0).max(10).optional(),
        pageSpeed: z.number().min(0).max(10).optional(),
        trustSignals: z.number().min(0).max(10).optional(),
        offerClarity: z.number().min(0).max(10).optional(),
        conversionReadiness: z.number().min(0).max(10).optional()
      }).optional(),
      extensions: z.object({
        sitelinks: z.array(z.object({ title: z.string(), url: z.string() })).optional(),
        callouts: z.array(z.string()).optional(),
        structuredSnippets: z.array(z.string()).optional(),
        promotion: z.object({ item: z.string() }).optional(),
        leadForm: z.object({ title: z.string() }).optional(),
        callExtension: z.string().optional()
      }).optional()
    }).refine(data => {
      // Enforce that Search campaigns must have at least 1 keyword
      if (data.campaignType === 'Search' && (!data.keywords || data.keywords.length === 0)) {
        return false;
      }
      return true;
    }, { message: 'Search campaigns must include at least one keyword.' });

    const bodySchema = z.object({
      campaigns: z.array(campaignSchema)
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

    if (sim.simulationMode && sim.simulationMode !== 'GOOGLE_ADS') {
      throw new ValidationError(`This class simulation is restricted to ${sim.simulationMode}. You cannot submit Google Ads decisions.`);
    }

    if (sim.status !== 'DECISION_OPEN') {
      await prisma.hardViolation.create({
        data: {
          simulationId: sim.id,
          roundNumber: sim.currentRound,
          type: 'ATTEMPT_TO_EDIT_LOCKED_DECISION',
          severity: 'BLOCKING',
          message: `Attempted to update Google Ads decisions when simulation status was locked in "${sim.status}".`
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
        googleCampaigns: JSON.stringify(parsed.data.campaigns)
      },
      create: {
        simulationId: sim.id,
        round: sim.currentRound,
        googleCampaigns: JSON.stringify(parsed.data.campaigns),
        seoTargetKeywords: JSON.stringify([]),
        seoContentQuality: 5.0,
        seoBacklinkBudget: 0.0,
        metaCampaigns: JSON.stringify([])
      }
    });

    // Write audit log
    const totalGoogleBudget = parsed.data.campaigns.reduce((acc, c) => acc + c.budget, 0);
    const campaignTypesSummary = [...new Set(parsed.data.campaigns.map(c => c.campaignType))].join(', ');
    await logActivity(
      authReq.user!.id,
      'GOOGLE_ADS_DECISION_SUBMIT',
      `Submitted Google Ads choices for Round ${sim.currentRound}. Types: ${campaignTypesSummary}. Total Google Ads Budget: $${totalGoogleBudget}.`
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
        'Google Ads Campaign Updated',
        `${authReq.user!.name} updated Google Ads campaigns (${campaignTypesSummary}). Total budget: $${totalGoogleBudget}.`,
        authReq.user!.name,
        '/instructor'
      );
    }

    return reply.status(200).send({
      success: true,
      campaigns: JSON.parse(decision.googleCampaigns)
    });
  });
}
