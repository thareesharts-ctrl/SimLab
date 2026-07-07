import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { auth } from '../auth/better-auth';
import { isRedisAvailable, getRedisOptions } from '../utils/redis-service';

export let io: SocketServer | null = null;

/**
 * Parses a Bearer token from the "Authorization" header or socket handshake auth.
 */
function extractToken(socket: Socket): string | null {
  const authHeader = socket.handshake.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  // Fallback: frontend can pass { token } in the socket.io auth handshake
  const handshakeAuth = socket.handshake.auth as Record<string, unknown>;
  if (typeof handshakeAuth?.token === 'string') {
    return handshakeAuth.token;
  }
  // Cookie fallback
  const cookieHeader = socket.handshake.headers?.cookie || '';
  const tokenMatch = cookieHeader.match(/simlab\.session_token=([^;]+)/) || cookieHeader.match(/better-auth\.session_token=([^;]+)/);
  if (tokenMatch) {
    return tokenMatch[1].trim();
  }
  return null;
}

/**
 * Initializes the Socket.io WebSocket server attached to Fastify's HTTP server.
 * Attaches a Redis adapter when REDIS_URL is configured; falls back to in-memory adapter.
 */
export async function initSocketServer(server: HttpServer): Promise<void> {
  try {
    io = new SocketServer(server, {
      cors: {
        origin: '*', // Match Fastify CORS rules
        methods: ['GET', 'POST'],
      },
      // Increase ping interval for long-running simulation sessions
      pingInterval: 25_000,
      pingTimeout: 60_000,
    });

    const redisOk = config.ENABLE_REDIS_ADAPTER ? await isRedisAvailable() : false;

    // ── Redis Adapter (optional) ─────────────────────────────────────────────
    if (redisOk && config.REDIS_URL) {
      let pubClient: Redis | null = null;
      let subClient: Redis | null = null;
      try {
        pubClient = new Redis(config.REDIS_URL, getRedisOptions('socket-pub'));
        subClient = new Redis(config.REDIS_URL, getRedisOptions('socket-sub'));

        let failed = false;
        const handleFatalRedisError = async (err: Error, role: string) => {
          const errMsg = err.message || '';
          logger.warn({ err }, `Socket.io Redis ${role}-client error: ${errMsg}`);
          if (
            errMsg.includes('max requests limit exceeded') ||
            errMsg.includes('ERR max requests limit exceeded') ||
            errMsg.includes('NOAUTH') ||
            errMsg.includes('ECONNREFUSED') ||
            errMsg.includes('ETIMEDOUT') ||
            errMsg.includes('ENOTFOUND')
          ) {
            if (!failed) {
              failed = true;
              logger.warn(`Redis adapter encountered quota/fatal error in ${role}. Disconnecting and falling back to in-memory adapter.`);
              try {
                if (pubClient) {
                  await pubClient.quit();
                }
              } catch {
                if (pubClient) pubClient.disconnect();
              }
              try {
                if (subClient) {
                  await subClient.quit();
                }
              } catch {
                if (subClient) subClient.disconnect();
              }
              // Reset adapter back to default (in-memory)
              if (io) {
                // @ts-ignore
                io.adapter(new (require('socket.io-adapter').Adapter)(io.of('/')));
              }
            }
          }
        };

        pubClient.on('error', (err) => handleFatalRedisError(err, 'pub'));
        subClient.on('error', (err) => handleFatalRedisError(err, 'sub'));

        // Test connection
        await pubClient.connect();
        await subClient.connect();

        io.adapter(createAdapter(pubClient, subClient));
        logger.info('Socket.io Redis adapter attached successfully.');
      } catch (adapterErr) {
        logger.warn({ adapterErr }, 'Redis adapter failed to initialise — using in-memory adapter.');
        try {
          if (pubClient) pubClient.disconnect();
        } catch {}
        try {
          if (subClient) subClient.disconnect();
        } catch {}
      }
    } else {
      logger.info('Redis adapter disabled or unavailable — Socket.io running with in-memory adapter (single-node only).');
    }

    // ── Connection Handler ───────────────────────────────────────────────────
    io.on('connection', async (socket) => {
      logger.info({ socketId: socket.id }, 'WebSocket client connected.');

      // ── Auth Check ─────────────────────────────────────────────────────────
      const token = extractToken(socket);

      let userId: string | null = null;
      let userRole: string | null = null;

      if (token) {
        try {
          // Use Better-Auth session endpoint to validate the token
          const sessionResponse = await auth.api.getSession({
            headers: new Headers({ cookie: `better-auth.session_token=${token}` }),
          });
          if (sessionResponse?.user?.id) {
            userId = sessionResponse.user.id;
            
            const prismaClient = (await import('../db/client')).prisma;
            const dbUser = await prismaClient.user.findUnique({
              where: { id: userId },
              select: { role: true }
            });
            if (dbUser) {
              const { normalizeRole } = await import('../auth/roles');
              userRole = normalizeRole(dbUser.role);
            }

            // Auto-join personal user room
            socket.join(`user:${userId}`);
            logger.info({ socketId: socket.id, userId, userRole }, 'Authenticated socket joined user room.');
          }
        } catch {
          // Not a fatal error — socket stays connected but unauthenticated
          logger.debug({ socketId: socket.id }, 'Socket auth check failed; socket operating anonymously.');
        }
      }

      // ── Room Events ────────────────────────────────────────────────────────

      /**
       * join-user: Join a personal user notification room.
       * Payload: { userId: string }
       * Prefer server-side assignment from auth, but support explicit join as fallback.
       */
      socket.on('join-user', (incomingUserId: string) => {
        if (!incomingUserId) return;
        // Only allow if token-verified or matches already known userId
        if (userId && incomingUserId !== userId) {
          logger.warn({ socketId: socket.id, incomingUserId, userId }, 'User room mismatch — ignoring join-user.');
          return;
        }
        socket.join(`user:${incomingUserId}`);
        logger.info({ socketId: socket.id, room: `user:${incomingUserId}` }, 'Socket joined user room.');
      });

      /**
       * join-simulation: Subscribe to live updates for a specific simulation.
       * Payload: { simulationId: string }
       */
      socket.on('join-simulation', (simulationId: string) => {
        if (!simulationId) return;
        socket.join(`simulation:${simulationId}`);
        logger.info({ socketId: socket.id, room: `simulation:${simulationId}` }, 'Socket joined simulation room.');
      });

      socket.on('join-instructor', async (instructorId: string) => {
        if (!instructorId) return;

        // Authorize: userRole must be INSTRUCTOR or ADMIN, and userId must match instructorId (unless admin)
        const { UserRole } = await import('../auth/roles');
        const isAuthorized = userRole === UserRole.ADMIN || (userRole === UserRole.INSTRUCTOR && userId === instructorId);

        if (!isAuthorized) {
          logger.warn({ socketId: socket.id, userId, userRole, instructorId }, 'Unauthorized attempt to join instructor rooms.');
          return;
        }

        socket.join(`instructor:${instructorId}`);
        try {
          const prismaClient = (await import('../db/client')).prisma;
          const classes = await prismaClient.class.findMany({
            where: { instructorId },
            select: { id: true }
          });
          classes.forEach(c => {
            socket.join(`class:${c.id}`);
          });
          logger.info({ socketId: socket.id, instructorId, classCount: classes.length }, 'Socket joined instructor and owned class rooms.');
        } catch (err) {
          logger.error(err, `Failed to query classes for instructor join rooms: ${instructorId}`);
        }
      });

      socket.on('join-class', (classId: string) => {
        if (!classId) return;
        socket.join(`class:${classId}`);
        logger.info({ socketId: socket.id, room: `class:${classId}` }, 'Socket joined class room.');
      });

      socket.on('join-scenario', (scenarioId: string) => {
        if (!scenarioId) return;
        socket.join(`scenario:${scenarioId}`);
        logger.info({ socketId: socket.id, room: `scenario:${scenarioId}` }, 'Socket joined scenario room.');
      });

      /**
       * Legacy: plain "join" with userId — kept for backwards compat.
       */
      socket.on('join', (legacyUserId: string) => {
        if (!legacyUserId) return;
        socket.join(legacyUserId);
        logger.debug({ socketId: socket.id, room: legacyUserId }, 'Legacy socket join (userId only).');
      });

      socket.on('disconnect', (reason) => {
        logger.info({ socketId: socket.id, reason }, 'WebSocket client disconnected.');
      });
    });

    logger.info('Socket.io WebSocket server initialised.');
  } catch (err) {
    logger.error(err, 'Failed to initialise Socket.io WebSocket server.');
  }
}
