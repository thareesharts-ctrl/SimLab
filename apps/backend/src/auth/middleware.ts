import { FastifyRequest, FastifyReply } from 'fastify';
import { auth } from './better-auth';
import { UserRole, normalizeRole } from './roles';
import { prisma } from '../db/client';
import { cacheService } from '../utils/caching';

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    classId?: string | null;
    institution?: string | null;
    planType?: string | null;
    status?: string;
  };
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    const cookieHeader = req.headers.cookie || '';
    const tokenMatch = cookieHeader.match(/simlab\.session_token=([^;]+)/) || cookieHeader.match(/better-auth\.session_token=([^;]+)/);
    const sessionToken = tokenMatch ? tokenMatch[1] : null;

    if (sessionToken) {
      const cacheKey = `auth:session:${sessionToken}`;
      const cachedUser = await cacheService.get<any>(cacheKey);
      if (cachedUser) {
        (req as AuthenticatedRequest).user = cachedUser;
        return;
      }
    }

    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, val]) => {
      if (val) {
        if (Array.isArray(val)) {
          val.forEach(v => headers.append(key, v));
        } else {
          headers.set(key, val);
        }
      }
    });

    const session = await auth.api.getSession({
      headers,
    });
    
    if (!session || !session.user) {
      reply.status(401).header('content-type', 'application/json; charset=utf-8').send(JSON.stringify({
        error: 'Unauthorized'
      }));
      return;
    }
    
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    });
    
    if (!dbUser) {
      reply.status(401).header('content-type', 'application/json; charset=utf-8').send(JSON.stringify({
        error: 'Unauthorized'
      }));
      return;
    }

    let verifiedClassId = dbUser.classId || null;
    let verifiedStatus = dbUser.status || 'active';

    if (verifiedClassId) {
      const clsExists = await prisma.class.findUnique({
        where: { id: verifiedClassId }
      });
      if (!clsExists) {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { classId: null, status: 'active' }
        });
        verifiedClassId = null;
        verifiedStatus = 'active';
      }
    }
    
    const userPayload = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: normalizeRole(dbUser.role),
      classId: verifiedClassId,
      institution: dbUser.institution || null,
      planType: dbUser.planType || null,
      status: verifiedStatus,
    };

    (req as AuthenticatedRequest).user = userPayload;

    if (sessionToken) {
      const cacheKey = `auth:session:${sessionToken}`;
      await cacheService.set(cacheKey, userPayload, 120); // Cache resolved user for 2 minutes
    }
  } catch (error) {
    reply.status(401).header('content-type', 'application/json; charset=utf-8').send(JSON.stringify({
      error: 'Unauthorized'
    }));
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(req, reply);
    if (reply.sent) return;

    const authReq = req as AuthenticatedRequest;
    if (!authReq.user || !allowedRoles.includes(normalizeRole(authReq.user.role))) {
      reply.status(403).header('content-type', 'application/json; charset=utf-8').send(JSON.stringify({
        error: 'Forbidden: Insufficient permissions'
      }));
    }
  };
}
