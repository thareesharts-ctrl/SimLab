import { FastifyInstance } from 'fastify';
import { requireAuth, requireRole } from '../auth/middleware';
import { UserRole } from '../auth/roles';
import { prisma } from '../db/client';
import { z } from 'zod';
import { ValidationError } from '../utils/errors';

export async function scenarioRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/scenario
   * Lists all simulation scenarios templates
   */
  fastify.get('/', { preHandler: [requireAuth] }, async (_request, reply) => {
    let scenarios = await prisma.scenario.findMany({
      orderBy: { name: 'asc' },
    });
    
    if (scenarios.length === 0) {
      await prisma.scenario.createMany({
        data: [
          {
            name: 'Global SaaS Marketing Challenge',
            description: 'Acquire corporate customers for a collaborative cloud CRM tool in a competitive B2B space.',
            industry: 'B2B Software',
            startRound: 1,
            maxRounds: 10,
            budgetPerRound: 5000.0,
            baselineOrganicTraffic: 1500,
            targetKPI: 'revenue',
            difficulty: 'medium',
          },
          {
            name: 'Fashion Retail E-Commerce Blitz',
            description: 'Scale organic and paid social traffic for a sustainable custom apparel brand.',
            industry: 'Apparel E-Commerce',
            startRound: 1,
            maxRounds: 8,
            budgetPerRound: 3500.0,
            baselineOrganicTraffic: 3000,
            targetKPI: 'conversions',
            difficulty: 'medium',
          }
        ]
      });
      scenarios = await prisma.scenario.findMany({
        orderBy: { name: 'asc' },
      });
    }
    
    return reply.status(200).send({
      success: true,
      scenarios,
    });
  });

  /**
   * POST /api/v1/scenario
   * Creates a custom scenario (Guarded to instructors or system admins)
   */
  fastify.post('/', { preHandler: [requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN])] }, async (request, reply) => {
    const bodySchema = z.object({
      name: z.string().min(1, 'Scenario name is required'),
      description: z.string().min(1, 'Description is required'),
      industry: z.string().default('Digital Marketing'),
      startRound: z.number().int().positive().default(1),
      maxRounds: z.number().int().positive().default(10),
      budgetPerRound: z.number().positive('Round budget must be positive'),
      baselineOrganicTraffic: z.number().int().positive().default(1000),
      targetKPI: z.enum(['revenue', 'clicks', 'conversions']).default('revenue'),
      difficulty: z.string().default('medium'),
      allowedPlatforms: z.string().optional(),
      allowedCampaignTypes: z.string().optional(),
      checkpointRequired: z.boolean().default(true),
      simulationMode: z.string().optional(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const scenario = await prisma.scenario.create({
      data: parsed.data,
    });

    return reply.status(201).send({
      success: true,
      scenario,
    });
  });

  /**
   * PUT /api/v1/scenario/:id
   * Update an existing scenario's configuration (Instructor/Admin only)
   */
  fastify.put('/:id', { preHandler: [requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN])] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const bodySchema = z.object({
      name: z.string().min(1, 'Scenario name is required').optional(),
      description: z.string().min(1, 'Description is required').optional(),
      industry: z.string().optional(),
      maxRounds: z.number().int().positive().optional(),
      budgetPerRound: z.number().positive().optional(),
      baselineOrganicTraffic: z.number().int().min(0).optional(),
      targetKPI: z.enum(['revenue', 'clicks', 'conversions']).optional(),
      difficulty: z.string().optional(),
      allowedPlatforms: z.string().optional(),
      allowedCampaignTypes: z.string().optional(),
      checkpointRequired: z.boolean().optional(),
      simulationMode: z.string().optional(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const existing = await prisma.scenario.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ success: false, message: 'Scenario not found.' });
    }

    const updated = await prisma.scenario.update({
      where: { id },
      data: parsed.data,
    });

    return reply.status(200).send({ success: true, scenario: updated });
  });

  /**
   * GET /api/v1/scenario/:id
   * Fetch a single scenario by ID
   */
  fastify.get('/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const scenario = await prisma.scenario.findUnique({ where: { id } });
    if (!scenario) {
      return reply.status(404).send({ success: false, message: 'Scenario not found.' });
    }
    return reply.status(200).send({ success: true, scenario });
  });
}
