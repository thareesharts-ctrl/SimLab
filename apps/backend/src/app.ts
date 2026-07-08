// Hot reload trigger to load latest env configuration
import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fs from 'fs';
import path from 'path';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import crypto from 'crypto';
import { auth } from './auth/better-auth';
import { prisma } from './db/client';
import { logger, asyncLocalStorage } from './utils/logger';
import { AppError } from './utils/errors';
import { config } from './config';
import { logActivity, createNotification } from './utils/audit';
import { sanitizeInput } from './utils/sanitizer';
import { cacheService } from './utils/caching';
import { bruteForceService } from './auth/brute-force';
import { errorReportRoutes } from './routes/error-report.routes';
import { monitoring } from './utils/monitoring';
import { isAllowedOrigin } from './utils/origin';

// Route Imports
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth.routes';
import { userRoutes } from './routes/user.routes';
import { simulationRoutes } from './routes/simulation.routes';
import { seoRoutes } from './routes/seo.routes';
import { googleAdsRoutes } from './routes/google-ads.routes';
import { metaAdsRoutes } from './routes/meta-ads.routes';
import { metricsRoutes } from './routes/metrics.routes';
import { eventsRoutes } from './routes/events.routes';
import { scoringRoutes } from './routes/scoring.routes';
import { classRoutes } from './routes/class.routes';
import { classesRoutes } from './routes/classes.routes';
import { scenarioRoutes } from './routes/scenario.routes';
import { certificateRoutes } from './routes/certificate.routes';
import { reportRoutes } from './routes/report.routes';
import { auditRoutes } from './routes/audit.routes';
import { notificationRoutes } from './routes/notification.routes';
import { adminRoutes } from './routes/admin.routes';
import { requireAuth, AuthenticatedRequest } from './auth/middleware';
import { apiContractRoutes } from './routes/api-contract.routes';
import { billingRoutes } from './routes/billing.routes';
import { billingAdminRoutes } from './routes/billing.admin.routes';
import { campaignRoutes } from './routes/campaign.routes';
import { assignmentRoutes } from './routes/assignments.routes';
import { briefingRoutes } from './routes/briefing.routes';
import { sandboxRoutes } from './routes/sandbox.routes';
import { instructorRoutes } from './routes/instructor.routes';

export const app = Fastify({
  logger: false, // We use custom Pino logger
  trustProxy: true, // Required on Render/Heroku: trusts X-Forwarded-Proto so req.protocol = 'https'
});

// Configure CORS — pass callback checking matches and patterns dynamically
app.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, curl, Swagger UI)
    if (!origin) return cb(null, true);
    if (isAllowedOrigin(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
});

// Register Helmet with Content Security Policy (CSP)
app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
    },
  },
});

// Register Global Rate Limiting
app.register(rateLimit, {
  max: config.RATE_LIMIT_MAX || 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip,
  allowList: (req: any) => req.headers['x-smoke-test-bypass'] === config.BETTER_AUTH_SECRET,
});

// Request Correlation ID Context Hook
app.addHook('onRequest', (request, reply, done) => {
  if (request.raw.url && request.raw.url.startsWith('/v1/') && !request.raw.url.startsWith('/api/v1/')) {
    request.raw.url = '/api' + request.raw.url;
  }
  const correlationId = (request.headers['x-correlation-id'] as string) || crypto.randomUUID();
  reply.header('x-correlation-id', correlationId);
  asyncLocalStorage.enterWith({ correlationId });
  done();
});

// Response Telemetry Duration Hook
app.addHook('onResponse', (request, reply, done) => {
  const duration = reply.getResponseTime();
  monitoring.recordApiLatency(request.routerPath || request.url, duration);
  done();
});

// Input Sanitization (XSS & SQL Injection Safeguard)
app.addHook('preValidation', async (request) => {
  if (request.body) {
    request.body = sanitizeInput(request.body);
  }
});

// CSRF Protection Hook
app.addHook('preHandler', async (request, reply) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    if (request.url.startsWith('/health') || request.url.startsWith('/api/auth/')) {
      return;
    }
    const origin = request.headers.origin;
    const referer = request.headers.referer;

    if (origin) {
      if (!isAllowedOrigin(origin)) {
        reply.status(403).send({
          success: false,
          error: 'CSRF Protection: Invalid origin',
          message: 'Request origin does not match the trusted site.',
          code: 'CSRF_ERROR',
          statusCode: 403,
        });
        return;
      }
    }

    if (!origin && referer) {
      let refererOrigin = '';
      try {
        refererOrigin = new URL(referer).origin;
      } catch {
        refererOrigin = referer;
      }
      if (!isAllowedOrigin(refererOrigin)) {
        reply.status(403).send({
          success: false,
          error: 'CSRF Protection: Invalid referer',
          message: 'Request referer is untrusted.',
          code: 'CSRF_ERROR',
          statusCode: 403,
        });
        return;
      }
    }
  }
});

// Idempotent Multi-Submission Interceptor
app.addHook('preHandler', async (request, reply) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const key = request.headers['x-idempotency-key'] as string;
    if (key) {
      const cacheKey = `idempotency:${key}:${request.url}`;
      const cachedResponse = await cacheService.get<{ statusCode: number; headers: Record<string, string>; body: any }>(cacheKey);
      if (cachedResponse) {
        reply.status(cachedResponse.statusCode);
        Object.entries(cachedResponse.headers).forEach(([k, v]) => reply.header(k, v));
        reply.send(cachedResponse.body);
        return;
      }

      const originalSend = reply.send;
      reply.send = function (payload: any) {
        const res = {
          statusCode: reply.statusCode,
          headers: reply.getHeaders(),
          body: payload,
        };
        cacheService.set(cacheKey, res, 300).catch(err => logger.error(err, 'Failed to cache idempotency response'));
        return originalSend.call(this, payload);
      };
    }
  }
});

// Student-College Enrollment Status Guard Hook
app.addHook('preHandler', async (request, reply) => {
  const path = request.url;
  
  // Do not block GET requests for simulations, states, or campaigns so they can render safe empty/pending states
  if (request.method === 'GET') {
    return;
  }

  // Only apply enrollment guard to student simulation and work routes
  const isStudentWorkRoute = 
    path.startsWith('/api/simulations') || 
    path.startsWith('/api/v1/simulation') || 
    path.startsWith('/api/v1/campaign') ||
    path.startsWith('/api/v1/report/student');

  if (!isStudentWorkRoute) {
    return;
  }

  const authReq = request as AuthenticatedRequest;
  if (!authReq.user) {
    try {
      await requireAuth(request, reply);
    } catch (e) {
      return;
    }
  }

  if (reply.sent) return;

  const user = authReq.user;
  if (!user) return;

  const role = user.role.toUpperCase().replace('-', '_');
  if (role === 'STUDENT_COLLEGE') {
    const classId = user.classId;
    if (!classId) {
      reply.status(403).header('content-type', 'application/json; charset=utf-8').send(JSON.stringify({
        success: false,
        error: 'Your class access request is pending instructor approval.',
        message: 'Your class access request is pending instructor approval.',
        code: 'FORBIDDEN',
        statusCode: 403
      }));
      return;
    }

    let enrollment = await prisma.classEnrollment.findFirst({
      where: { studentId: user.id, classId }
    });

    // Auto-repair/sync enrollment if user is active but ClassEnrollment record is pending/missing
    if (user.status === 'active' && (!enrollment || enrollment.status !== 'ACTIVE')) {
      if (enrollment) {
        enrollment = await prisma.classEnrollment.update({
          where: { id: enrollment.id },
          data: { status: 'ACTIVE', approvedAt: new Date() }
        });
      } else {
        enrollment = await prisma.classEnrollment.create({
          data: {
            classId,
            studentId: user.id,
            studentEmail: user.email,
            status: 'ACTIVE',
            approvedAt: new Date()
          }
        });
      }
    }

    if (!enrollment || enrollment.status === 'PENDING') {
      await logActivity(
        user.id,
        'ACCESS_BLOCKED_PENDING',
        `Blocked attempt to access ${path} (status: PENDING).`
      ).catch(() => {});

      reply.status(403).header('content-type', 'application/json; charset=utf-8').send(JSON.stringify({
        success: false,
        error: 'Your class access request is pending instructor approval.',
        message: 'Your class access request is pending instructor approval.',
        code: 'FORBIDDEN',
        statusCode: 403
      }));
      return;
    }

    if (['REJECTED', 'REMOVED', 'TERMINATED'].includes(enrollment.status)) {
      await logActivity(
        user.id,
        'ACCESS_BLOCKED_TERMINATED',
        `Blocked attempt to access ${path} (status: ${enrollment.status}).`
      ).catch(() => {});

      reply.status(403).header('content-type', 'application/json; charset=utf-8').send(JSON.stringify({
        success: false,
        error: 'Your access to this class has been terminated by the instructor.',
        message: 'Your access to this class has been terminated by the instructor.',
        code: 'FORBIDDEN',
        statusCode: 403
      }));
      return;
    }
  }
});

// Register Swagger
app.register(swagger, {
  openapi: {
    info: {
      title: 'Digital Marketing Simulation Lab API',
      description: 'API documentation for Digital Marketing Simulation Lab backend',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'better-auth.session_token',
        },
      },
    },
    paths: {
      '/api/auth/sign-up/email': {
        post: {
          summary: 'Sign up a new user using email and password',
          tags: ['Auth'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password', 'name'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    name: { type: 'string', minLength: 1 },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Successful registration',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      token: { type: 'string' },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          email: { type: 'string' },
                          role: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/sign-in/email': {
        post: {
          summary: 'Sign in an existing user using email and password',
          tags: ['Auth'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Successful sign-in',
              headers: {
                'Set-Cookie': {
                  schema: { type: 'string' },
                  description: 'Better Auth session cookie',
                },
              },
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      token: { type: 'string' },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          email: { type: 'string' },
                          role: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});

// Register Swagger UI
app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
});

// Export OpenAPI JSON to root of backend on startup
app.ready().then(() => {
  try {
    const openapiObject = (app as any).swagger();
    const outputPath = path.join(__dirname, '../openapi.json');
    fs.writeFileSync(outputPath, JSON.stringify(openapiObject, null, 2), 'utf8');
    logger.info(`OpenAPI JSON exported successfully to ${outputPath}`);
  } catch (err) {
    logger.error(err, 'Failed to export OpenAPI JSON');
  }
});


// Better Auth Web Request Integration
app.get('/api/auth/me', async (req, reply) => {
  await requireAuth(req, reply);
  if (reply.sent) return;
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  reply.status(200).send(user);
});

app.post('/api/auth/register/individual', async (req, reply) => {
  const method = 'POST';
  // Use BETTER_AUTH_URL (the public HTTPS URL) so better-auth sets Secure+SameSite=None cookies
  const url = `${config.BETTER_AUTH_URL}/api/auth/sign-up/email`;

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

  const rawBody = req.body as Record<string, any>;
  const body = JSON.stringify({
    email: rawBody.email,
    password: rawBody.password,
    name: rawBody.name,
    role: 'INDIVIDUAL',
    institution: rawBody.institution || null,
    planType: rawBody.planType || '30',
  });

  const webRequest = new Request(url, {
    method,
    headers,
    body,
  });

  const webResponse = await auth.handler(webRequest);

  if (webResponse.status >= 200 && webResponse.status < 300) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: rawBody.email }
      });
      if (user) {
        let scenario = await prisma.scenario.findFirst({
          where: { name: 'Global SaaS Marketing Challenge' }
        });
        if (!scenario) {
          scenario = await prisma.scenario.findFirst();
        }
        if (!scenario) {
          scenario = await prisma.scenario.create({
            data: {
              name: 'Global SaaS Marketing Challenge',
              description: 'Acquire corporate customers for a collaborative cloud CRM tool in a competitive B2B space.',
              industry: 'B2B Software',
              startRound: 1,
              maxRounds: 10,
              budgetPerRound: 5000.0,
              baselineOrganicTraffic: 1500,
              targetKPI: 'revenue',
            }
          });
        }

        let instructor = await prisma.user.findFirst({
          where: { role: 'INSTRUCTOR' }
        });
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

        let sandboxClass = await prisma.class.findFirst({
          where: { inviteCode: 'SANDBOX' }
        });
        if (!sandboxClass) {
          sandboxClass = await prisma.class.create({
            data: {
              name: 'Individual Sandbox Cohort',
              inviteCode: 'SANDBOX',
              instructorId: instructor.id,
              scenarioId: scenario.id,
            }
          });
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { classId: sandboxClass.id }
        });

        // Initialize state as DECISION_OPEN directly
        await prisma.simulationState.create({
          data: {
            userId: user.id,
            classId: sandboxClass.id,
            currentRound: 1,
            isCompleted: false,
            status: 'DECISION_OPEN',
          }
        });
      }
    } catch (dbErr) {
      logger.error(dbErr, 'Failed to auto-provision sandbox class or state during individual registration');
    }
  }

  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      const cookies = (webResponse.headers as any).getSetCookie 
        ? (webResponse.headers as any).getSetCookie() 
        : [value];
      reply.header('set-cookie', cookies);
    } else {
      reply.header(key, value);
    }
  });
  reply.status(webResponse.status);
  return reply.send(await webResponse.text());
});

app.post('/api/auth/register/student', async (req, reply) => {
  const method = 'POST';
  // Use BETTER_AUTH_URL (the public HTTPS URL) so better-auth sets Secure+SameSite=None cookies
  const url = `${config.BETTER_AUTH_URL}/api/auth/sign-up/email`;

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

  const rawBody = req.body as Record<string, any>;
  const classJoinCode = rawBody.classJoinCode;

  const targetClass = await prisma.class.findUnique({
    where: { inviteCode: classJoinCode },
  });

  if (!targetClass) {
    reply.status(404);
    return reply.send({
      success: false,
      error: 'No class found matching the provided invite code.',
      message: 'No class found matching the provided invite code.',
      code: 'NOT_FOUND',
      statusCode: 404
    });
  }

  const body = JSON.stringify({
    email: rawBody.email,
    password: rawBody.password,
    name: rawBody.name,
    role: 'STUDENT_COLLEGE',
    classId: targetClass.id,
  });

  const webRequest = new Request(url, {
    method,
    headers,
    body,
  });

  const webResponse = await auth.handler(webRequest);

  if (webResponse.status >= 200 && webResponse.status < 300) {
    try {
      const updatedUser = await prisma.user.update({
        where: { email: rawBody.email },
        data: { status: 'pending' }
      });

      // Create ClassEnrollment record
      await prisma.classEnrollment.create({
        data: {
          classId: targetClass.id,
          studentId: updatedUser.id,
          studentEmail: updatedUser.email,
          status: 'PENDING',
        }
      });

      // Notify the instructor
      await createNotification(
        targetClass.instructorId,
        'info',
        'New Student Joined Class',
        `Student "${updatedUser.name}" (${updatedUser.email}) has registered and requested to join your class "${targetClass.name}". Approval is required.`,
        updatedUser.name
      );

      // Log student activity
      await logActivity(
        updatedUser.id,
        'JOIN_CLASS',
        `Registered and joined classroom "${targetClass.name}" (Code: ${targetClass.inviteCode}). Status is pending approval.`
      );
    } catch (dbErr) {
      logger.error(dbErr, 'Failed to update student registration status and notify instructor');
    }
  }

  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      const cookies = (webResponse.headers as any).getSetCookie 
        ? (webResponse.headers as any).getSetCookie() 
        : [value];
      reply.header('set-cookie', cookies);
    } else {
      reply.header(key, value);
    }
  });
  reply.status(webResponse.status);
  return reply.send(await webResponse.text());
});

app.post('/api/auth/register/instructor', async (req, reply) => {
  const method = 'POST';
  // Use BETTER_AUTH_URL (the public HTTPS URL) so better-auth sets Secure+SameSite=None cookies
  const url = `${config.BETTER_AUTH_URL}/api/auth/sign-up/email`;

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

  const rawBody = req.body as Record<string, any>;
  const body = JSON.stringify({
    email: rawBody.email,
    password: rawBody.password,
    name: rawBody.name,
    role: 'INSTRUCTOR',
    institution: rawBody.institution || null,
  });

  const webRequest = new Request(url, { method, headers, body });
  const webResponse = await auth.handler(webRequest);

  if (webResponse.status >= 200 && webResponse.status < 300) {
    try {
      await prisma.user.update({
        where: { email: rawBody.email },
        data: { role: 'INSTRUCTOR', status: 'active' }
      });
    } catch (dbErr) {
      logger.error(dbErr, 'Failed to set INSTRUCTOR role during instructor registration');
    }
  }

  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      const cookies = (webResponse.headers as any).getSetCookie
        ? (webResponse.headers as any).getSetCookie()
        : [value];
      reply.header('set-cookie', cookies);
    } else {
      reply.header(key, value);
    }
  });
  reply.status(webResponse.status);
  return reply.send(await webResponse.text());
});

app.all('/api/auth/*', {
  config: {
    rateLimit: {
      max: config.RATE_LIMIT_AUTH_MAX || 100,
      timeWindow: '1 minute',
      allowList: (req: any) => req.headers['x-smoke-test-bypass'] === config.BETTER_AUTH_SECRET,
    }
  }
}, async (req, reply) => {
  const method = req.method;
  const path = req.raw.url || '';
  // Use BETTER_AUTH_URL (the public HTTPS URL) so better-auth sets Secure+SameSite=None cookies
  // On Render, req.protocol is 'http' (internal) which breaks cross-origin cookie security
  const url = `${config.BETTER_AUTH_URL}${path}`;

  const isSignIn = path.includes('sign-in/email');
  let email = '';
  if (isSignIn && req.body) {
    email = (req.body as any).email;
    if (email && await bruteForceService.isBlocked(email)) {
      reply.status(429);
      return reply.send({
        success: false,
        error: 'Too many failed login attempts. This account is temporarily blocked for 15 minutes.',
        message: 'Too many failed login attempts. This account is temporarily blocked for 15 minutes.',
        code: 'TOO_MANY_REQUESTS',
        statusCode: 429
      });
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

  let body: string | undefined = undefined;
  if (method !== 'GET' && method !== 'HEAD' && req.body) {
    body = JSON.stringify(req.body);
  }

  const webRequest = new Request(url, {
    method,
    headers,
    body,
  });

  const webResponse = await auth.handler(webRequest);
  const responseText = await webResponse.text();

  if (isSignIn && email) {
    if (webResponse.status >= 200 && webResponse.status < 300) {
      try {
        const bodyObj = JSON.parse(responseText);
        const userId = bodyObj.user?.id;
        if (userId) {
          const dbUser = await prisma.user.findUnique({ where: { id: userId } });
          if (dbUser && dbUser.status && dbUser.status !== 'active') {
            reply.status(403);
            return reply.send({
              success: false,
              error: `Your account is currently ${dbUser.status}.`,
              message: `Your account is currently ${dbUser.status}.`,
              code: 'ACCOUNT_INACTIVE',
              statusCode: 403
            });
          }
        }
      } catch (err) {
        // ignore parse error
      }
      await bruteForceService.reset(email);
    } else if (webResponse.status === 401 || webResponse.status === 400) {
      await bruteForceService.handleFailedAttempt(email);

      reply.status(401);
      return reply.send({
        success: false,
        error: 'Invalid email or password. Please try again.',
        message: 'Invalid email or password. Please try again.',
        code: 'INVALID_CREDENTIALS',
        statusCode: 401
      });
    }
  }

  // Copy response headers
  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      const cookies = (webResponse.headers as any).getSetCookie 
        ? (webResponse.headers as any).getSetCookie() 
        : [value];
      reply.header('set-cookie', cookies);
    } else {
      reply.header(key, value);
    }
  });

  reply.status(webResponse.status);
  return reply.send(responseText);
});

// GET /api/me profile endpoint (part of the frontend API contract)
app.get('/api/me', {
  preHandler: [requireAuth],
  config: {
    rateLimit: {
      max: config.RATE_LIMIT_AUTH_MAX || 100,
      timeWindow: '1 minute',
      allowList: (req: any) => req.headers['x-smoke-test-bypass'] === config.BETTER_AUTH_SECRET,
    }
  },
  schema: {
    description: 'Get details of the currently authenticated user session',
    tags: ['Auth'],
    security: [{ cookieAuth: [] }],
    response: {
      200: {
        description: 'Success response containing authenticated user details',
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
        description: 'Unauthorized request',
        type: 'object',
        properties: {
          error: { type: 'string' }
        }
      }
    }
  }
}, async (request, reply) => {
  const authReq = request as AuthenticatedRequest;
  const user = authReq.user!;
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

app.get('/', async (_request, reply) => {
  return reply.status(200).send({
    success: true,
    status: 'online',
    message: 'Digital Marketing Simulation Lab API is running.',
    documentation: '/docs'
  });
});

// Mount Routes
app.register(healthRoutes, { prefix: '/health' });
app.register(authRoutes, { prefix: '/api/v1/auth' });
app.register(userRoutes, { prefix: '/api/v1/users' });
app.register(simulationRoutes, { prefix: '/api/v1/simulation' });
app.register(seoRoutes, { prefix: '/api/v1/seo' });
app.register(googleAdsRoutes, { prefix: '/api/v1/google-ads' });
app.register(metaAdsRoutes, { prefix: '/api/v1/meta-ads' });
app.register(metricsRoutes, { prefix: '/api/v1/metrics' });
app.register(eventsRoutes, { prefix: '/api/v1/events' });
app.register(scoringRoutes, { prefix: '/api/v1/scoring' });
app.register(classRoutes, { prefix: '/api/v1/class' });
app.register(classesRoutes, { prefix: '/api/classes' });
app.register(scenarioRoutes, { prefix: '/api/v1/scenario' });
app.register(certificateRoutes, { prefix: '/api/v1/certificate' });
app.register(reportRoutes, { prefix: '/api/v1/report' });
app.register(adminRoutes, { prefix: '/api/v1/admin' });
app.register(billingAdminRoutes, { prefix: '/api/v1/admin/billing' });
app.register(billingRoutes, { prefix: '/api/v1/billing' });
app.register(campaignRoutes, { prefix: '/api/v1/campaign' });
app.register(assignmentRoutes, { prefix: '/api/v1/assignments' });
app.register(briefingRoutes, { prefix: '/api/v1/briefing' });
app.register(sandboxRoutes, { prefix: '/api/v1/sandbox' });
app.register(instructorRoutes, { prefix: '/api/instructor' });
app.register(instructorRoutes, { prefix: '/api/v1/instructor' });
app.register(auditRoutes, { prefix: '/api/v1/audit' });
app.register(notificationRoutes, { prefix: '/api/v1/notifications' });
app.register(errorReportRoutes, { prefix: '/api/v1/error-reports' });
app.register(apiContractRoutes);

// Alias route /v1/campaign/state
app.get('/v1/campaign/state', { preHandler: [requireAuth] }, async (request, reply) => {
  const authReq = request as AuthenticatedRequest;
  const userId = authReq.user!.id;
  const classId = authReq.user!.classId;
  const role = authReq.user!.role;

  if (!classId && role !== 'INDIVIDUAL') {
    return reply.status(200).send({
      success: true,
      hasRun: false,
      run: null
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
      const latestCompleted = await prisma.campaignRun.findFirst({
        where: { userId, classId: classId || null, status: 'COMPLETED' },
        orderBy: { updatedAt: 'desc' },
        include: { scenario: true, assignment: true },
      });

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
    return reply.status(200).send({
      success: true,
      hasRun: false,
      run: null,
    });
  }
});

// Global Error Handler
app.setErrorHandler((error, request, reply) => {
  const isExpectedError = !!(
    (error as any).validation ||
    (error as any).statusCode ||
    error instanceof AppError ||
    ['ValidationError', 'NotFoundError', 'ForbiddenError', 'AuthError', 'SimulationError'].includes(error.constructor.name)
  );

  const statusCode = isExpectedError
    ? ((error as any).statusCode || ((error as any).validation ? 400 : 500))
    : 500;

  const code = (error as any).validation
    ? 'VALIDATION_ERROR'
    : ((error as any).code || (isExpectedError ? 'EXPECTED_ERROR' : 'INTERNAL_ERROR'));

  const message = (error as any).validation
    ? error.message
    : (isExpectedError || config.NODE_ENV !== 'production' ? error.message : 'An unexpected error occurred.');

  if (statusCode === 500) {
    logger.error({ err: error, path: request.url }, 'Unhandled internal server error');
  } else {
    logger.warn({ err: error, path: request.url }, error.message);
  }

  const correlationId = reply.getHeader('x-correlation-id') || request.headers['x-correlation-id'];

  const payload = {
    success: false,
    error: message,
    message: message,
    code,
    statusCode,
    correlationId,
  };

  // Pre-serialize payload as string to bypass Fastify/AJV route-level response schema stripping
  reply
    .status(statusCode)
    .header('content-type', 'application/json; charset=utf-8')
    .send(JSON.stringify(payload));
});
