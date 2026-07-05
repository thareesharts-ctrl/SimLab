import { FastifyInstance } from 'fastify';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware';

export async function authRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/auth/me
   * Fetches active session profile from Better Auth middleware context
   */
  fastify.get('/me', {
    preHandler: [requireAuth],
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute'
      }
    },
    schema: {
      description: 'Get current user session information',
      tags: ['Auth'],
      security: [{ cookieAuth: [] }],
      response: {
        200: {
          description: 'User session info',
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' },
            status: { type: 'string', nullable: true },
            classId: { type: 'string', nullable: true },
            institution: { type: 'string', nullable: true },
            planType: { type: 'string', nullable: true }
          }
        },
        401: {
          description: 'Unauthorized',
          type: 'object',
          properties: {
            error: { type: 'string' },
            success: { type: 'boolean' },
            code: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const user = authReq.user!;

    // Dev-only role routing diagnostic log
    if (process.env.NODE_ENV !== 'production') {
      console.info('[SimLab /me]', {
        email: user.email,
        role: user.role,
        status: user.status,
        classId: user.classId || null,
      });
    }

    return reply.status(200).send({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status || 'active',
      classId: user.classId || null,
      institution: user.institution || null,
      planType: user.planType || null,
    });
  });
}
