import { FastifyInstance } from 'fastify';
import { requireRole, AuthenticatedRequest } from '../auth/middleware';
import { UserRole } from '../auth/roles';
import { prisma } from '../db/client';
import { z } from 'zod';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import { createNotification, logActivity } from '../utils/audit';
import { logger } from '../utils/logger';
import { cacheService } from '../utils/caching';
import { io } from '../websocket/server';
import crypto from 'crypto';
import { processSimulationRound } from '../services/simulation/engine';

export async function instructorRoutes(fastify: FastifyInstance) {
  // Global check that user is INSTRUCTOR or ADMIN
  fastify.addHook('preHandler', requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN]));

  // Helper to parse name column
  function parseClassName(nameField: string) {
    try {
      const data = JSON.parse(nameField);
      return {
        name: data.name || '',
        semester: data.semester || 'N/A',
        batch: data.batch || 'N/A',
        department: data.department || 'N/A',
        college: data.college || 'N/A',
        subject: data.subject || 'N/A',
        status: data.status || 'Active'
      };
    } catch {
      return {
        name: nameField,
        semester: 'N/A',
        batch: 'N/A',
        department: 'N/A',
        college: 'N/A',
        subject: 'N/A',
        status: 'Active'
      };
    }
  }

  // Helper to verify instructor owns class
  async function checkClassOwnership(classId: string, instructorId: string, role: string) {
    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundError('Class not found.');
    if (role !== 'ADMIN' && cls.instructorId !== instructorId) {
      throw new ForbiddenError('Unauthorized: You do not manage this class.');
    }
    return cls;
  }

  /**
   * GET /api/instructor/dashboard
   */
  fastify.get('/dashboard', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user!.id;
    const role = authReq.user!.role;
    const isAdmin = role === 'ADMIN';

    const classes = await prisma.class.findMany({
      where: isAdmin ? undefined : { instructorId: userId },
      include: {
        students: {
          include: {
            simulations: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        },
        scenario: true
      }
    });

    const classIds = classes.map(c => c.id);

    // Active students
    let activeStudentsCount = 0;
    let totalScoreSum = 0;
    let scoredSimulationsCount = 0;
    const studentsList: any[] = [];

    classes.forEach(c => {
      c.students.forEach(s => {
        if (s.status === 'active') activeStudentsCount++;
        const latestSim = s.simulations[0];
        if (latestSim) {
          studentsList.push({
            studentId: s.id,
            studentName: s.name,
            studentEmail: s.email,
            className: parseClassName(c.name).name,
            classId: c.id,
            score: latestSim.score || 0,
            currentRound: latestSim.currentRound,
            status: latestSim.status
          });
          if (latestSim.score > 0) {
            totalScoreSum += latestSim.score;
            scoredSimulationsCount++;
          }
        }
      });
    });

    const pendingRequestsCount = await prisma.classEnrollment.count({
      where: {
        classId: { in: classIds },
        status: 'PENDING'
      }
    });

    const activeScenariosCount = await prisma.scenarioAssignment.count({
      where: {
        instructorId: isAdmin ? undefined : userId,
        status: 'ACTIVE'
      }
    });

    const runningSimulationsCount = await prisma.simulationState.count({
      where: {
        classId: { in: classIds },
        status: { in: ['INITIALIZED', 'DECISION_OPEN', 'PROCESSING'] }
      }
    });

    const averageClassScore = scoredSimulationsCount > 0 ? Math.round(totalScoreSum / scoredSimulationsCount) : 0;

    // Top performers & Weak students
    const sortedPerformers = [...studentsList].sort((a, b) => b.score - a.score);
    const topPerformers = sortedPerformers.slice(0, 5);
    const weakStudents = [...studentsList].filter(s => s.score > 0).sort((a, b) => a.score - b.score).slice(0, 5);

    // Recent activity logs
    const recentActivity = await prisma.auditLog.findMany({
      where: {
        OR: [
          { userId },
          { user: { classId: { in: classIds } } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    });

    return reply.status(200).send({
      success: true,
      stats: {
        totalClasses: classes.length,
        activeStudents: activeStudentsCount,
        pendingRequests: pendingRequestsCount,
        activeScenarios: activeScenariosCount,
        runningSimulations: runningSimulationsCount,
        averageClassScore
      },
      topPerformers,
      weakStudents,
      recentActivity: recentActivity.map(log => ({
        id: log.id,
        actor: log.user.name,
        action: log.action,
        details: log.details,
        createdAt: log.createdAt
      }))
    });
  });

  /**
   * GET /api/instructor/activity
   */
  fastify.get('/activity', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user!.id;
    const role = authReq.user!.role;
    const isAdmin = role === 'ADMIN';

    const classes = await prisma.class.findMany({
      where: isAdmin ? undefined : { instructorId: userId },
      select: { id: true }
    });
    const classIds = classes.map(c => c.id);

    const activity = await prisma.auditLog.findMany({
      where: {
        OR: [
          { userId },
          { user: { classId: { in: classIds } } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    return reply.status(200).send({
      success: true,
      activity: activity.map(log => ({
        id: log.id,
        actor: log.user.name,
        action: log.action,
        details: log.details,
        createdAt: log.createdAt
      }))
    });
  });

  /**
   * GET /api/instructor/summary
   */
  fastify.get('/summary', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user!.id;
    const role = authReq.user!.role;
    const isAdmin = role === 'ADMIN';

    const classes = await prisma.class.findMany({
      where: isAdmin ? undefined : { instructorId: userId },
      select: { id: true }
    });
    const classIds = classes.map(c => c.id);

    const totalClasses = classes.length;
    const totalStudents = await prisma.user.count({
      where: { classId: { in: classIds } }
    });

    return reply.status(200).send({
      success: true,
      summary: {
        totalClasses,
        totalStudents
      }
    });
  });

  /**
   * GET /api/instructor/classes
   */
  fastify.get('/classes', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user!.id;
    const role = authReq.user!.role;
    const isAdmin = role === 'ADMIN';

    const classes = await prisma.class.findMany({
      where: isAdmin ? undefined : { instructorId: userId },
      include: {
        scenario: true,
        _count: { select: { students: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const parsedClasses = classes.map(c => {
      const parsed = parseClassName(c.name);
      return {
        id: c.id,
        name: parsed.name,
        semester: parsed.semester,
        batch: parsed.batch,
        department: parsed.department,
        college: parsed.college,
        subject: parsed.subject,
        inviteCode: c.inviteCode,
        scenario: c.scenario,
        studentsCount: c._count.students,
        createdAt: c.createdAt
      };
    });

    return reply.status(200).send({
      success: true,
      classes: parsedClasses
    });
  });

  /**
   * POST /api/instructor/classes
   */
  fastify.post('/classes', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const userId = authReq.user!.id;

    const schema = z.object({
      name: z.string().min(1),
      scenarioId: z.string().uuid(),
      semester: z.string().optional(),
      batch: z.string().optional(),
      department: z.string().optional(),
      college: z.string().optional(),
      subject: z.string().optional()
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { name, scenarioId, semester, batch, department, college, subject } = parsed.data;

    const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
    if (!scenario) throw new NotFoundError('Scenario not found.');

    const inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    // Store attributes inside the name column as JSON serialized string
    const serializedName = JSON.stringify({
      name,
      semester: semester || 'N/A',
      batch: batch || 'N/A',
      department: department || 'N/A',
      college: college || 'N/A',
      subject: subject || 'N/A'
    });

    const newClass = await prisma.class.create({
      data: {
        name: serializedName,
        inviteCode,
        instructorId: userId,
        scenarioId
      }
    });

    return reply.status(201).send({
      success: true,
      class: {
        id: newClass.id,
        name,
        inviteCode,
        semester,
        batch,
        department,
        college,
        subject
      }
    });
  });

  /**
   * PATCH /api/instructor/classes/:classId
   */
  fastify.patch('/classes/:classId', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { classId } = request.params as { classId: string };

    await checkClassOwnership(classId, authReq.user!.id, authReq.user!.role);

    const schema = z.object({
      name: z.string().optional(),
      semester: z.string().optional(),
      batch: z.string().optional(),
      department: z.string().optional(),
      college: z.string().optional(),
      subject: z.string().optional(),
      scenarioId: z.string().uuid().optional()
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const existingClass = await prisma.class.findUnique({ where: { id: classId } });
    if (!existingClass) throw new NotFoundError('Class not found.');

    const parsedName = parseClassName(existingClass.name);
    const updatedData = {
      name: parsed.data.name !== undefined ? parsed.data.name : parsedName.name,
      semester: parsed.data.semester !== undefined ? parsed.data.semester : parsedName.semester,
      batch: parsed.data.batch !== undefined ? parsed.data.batch : parsedName.batch,
      department: parsed.data.department !== undefined ? parsed.data.department : parsedName.department,
      college: parsed.data.college !== undefined ? parsed.data.college : parsedName.college,
      subject: parsed.data.subject !== undefined ? parsed.data.subject : parsedName.subject
    };

    const updatedClass = await prisma.class.update({
      where: { id: classId },
      data: {
        name: JSON.stringify(updatedData),
        scenarioId: parsed.data.scenarioId !== undefined ? parsed.data.scenarioId : existingClass.scenarioId
      }
    });

    return reply.status(200).send({
      success: true,
      class: {
        id: updatedClass.id,
        ...updatedData,
        inviteCode: updatedClass.inviteCode
      }
    });
  });

  /**
   * DELETE /api/instructor/classes/:classId
   */
  fastify.delete('/classes/:classId', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { classId } = request.params as { classId: string };

    await checkClassOwnership(classId, authReq.user!.id, authReq.user!.role);

    // Unlink students
    await prisma.user.updateMany({
      where: { classId },
      data: { classId: null, status: 'active' }
    });

    await prisma.class.delete({ where: { id: classId } });

    return reply.status(200).send({
      success: true,
      message: 'Class deleted successfully.'
    });
  });

  /**
   * GET /api/instructor/classes/:classId/students
   */
  fastify.get('/classes/:classId/students', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { classId } = request.params as { classId: string };

    await checkClassOwnership(classId, authReq.user!.id, authReq.user!.role);

    const students = await prisma.user.findMany({
      where: { classId },
      include: {
        simulations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            progress: true
          }
        }
      }
    });

    const mapped = students.map(s => {
      const sim = s.simulations[0];
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        status: s.status,
        joinedAt: s.createdAt,
        lastActive: sim?.updatedAt || s.updatedAt,
        simulationId: sim?.id || null,
        currentRound: sim?.currentRound || 1,
        isCompleted: sim?.isCompleted || false,
        score: sim?.score || 0,
        progressStatus: sim?.progress?.status || 'DECISION_OPEN'
      };
    });

    return reply.status(200).send({
      success: true,
      students: mapped
    });
  });

  /**
   * GET /api/instructor/classes/:classId
   */
  fastify.get('/classes/:classId', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { classId } = request.params as { classId: string };

    const cls = await checkClassOwnership(classId, authReq.user!.id, authReq.user!.role);

    // Fetch scenario and student counts
    const fullClass = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        scenario: true,
        _count: { select: { students: true } }
      }
    });

    if (!fullClass) throw new NotFoundError('Class not found.');

    const parsed = parseClassName(fullClass.name);
    return reply.status(200).send({
      success: true,
      class: {
        id: fullClass.id,
        name: parsed.name,
        semester: parsed.semester,
        batch: parsed.batch,
        department: parsed.department,
        college: parsed.college,
        subject: parsed.subject,
        status: parsed.status || 'Active',
        inviteCode: fullClass.inviteCode,
        scenario: fullClass.scenario,
        studentsCount: fullClass._count.students,
        createdAt: fullClass.createdAt
      }
    });
  });

  /**
   * POST /api/instructor/classes/:classId/archive
   */
  fastify.post('/classes/:classId/archive', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { classId } = request.params as { classId: string };

    const cls = await checkClassOwnership(classId, authReq.user!.id, authReq.user!.role);

    const parsed = parseClassName(cls.name);
    const updatedData = {
      ...parsed,
      status: 'Archived'
    };

    const updated = await prisma.class.update({
      where: { id: classId },
      data: { name: JSON.stringify(updatedData) }
    });

    return reply.status(200).send({
      success: true,
      message: 'Class archived successfully.',
      class: {
        id: updated.id,
        name: updatedData.name,
        status: 'Archived'
      }
    });
  });

  /**
   * GET /api/instructor/classes/:classId/pending-students
   */
  fastify.get('/classes/:classId/pending-students', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { classId } = request.params as { classId: string };

    await checkClassOwnership(classId, authReq.user!.id, authReq.user!.role);

    const pendingStudents = await prisma.user.findMany({
      where: { classId, status: 'pending' },
      select: {
        id: true,
        name: true,
        email: true,
        institution: true,
        createdAt: true
      }
    });

    return reply.status(200).send({
      success: true,
      students: pendingStudents
    });
  });

  /**
   * POST /api/instructor/classes/:classId/approve-student
   * POST /api/instructor/classes/:classId/students/:studentId/approve
   */
  async function approveStudentHelper(classId: string, studentId: string, instructorId: string, role: string) {
    if (!studentId) throw new ValidationError('studentId is required.');

    const targetClass = await checkClassOwnership(classId, instructorId, role);

    const student = await prisma.user.findFirst({
      where: { id: studentId, classId, status: 'pending' }
    });

    if (!student) throw new NotFoundError('Pending student not found in this class.');

    await prisma.user.update({
      where: { id: studentId },
      data: { status: 'active' }
    });

    const enrollment = await prisma.classEnrollment.findFirst({
      where: { studentId, classId }
    });

    if (enrollment) {
      await prisma.classEnrollment.update({
        where: { id: enrollment.id },
        data: { status: 'ACTIVE', approvedAt: new Date(), actionByInstructorId: instructorId }
      });
    } else {
      await prisma.classEnrollment.create({
        data: {
          classId,
          studentId,
          studentEmail: student.email,
          status: 'ACTIVE',
          approvedAt: new Date(),
          actionByInstructorId: instructorId
        }
      });
    }

    const existingState = await prisma.simulationState.findFirst({
      where: { userId: studentId, classId }
    });

    let simStateId = '';
    const scenario = await prisma.scenario.findUnique({ where: { id: targetClass.scenarioId } });
    const totalDays = scenario?.durationDays || 30;

    if (!existingState) {
      const newState = await prisma.simulationState.create({
        data: {
          userId: studentId,
          classId,
          currentRound: 1,
          isCompleted: false,
          status: 'DECISION_OPEN',
          simulationMode: scenario?.simulationMode || 'GOOGLE_ADS'
        }
      });
      simStateId = newState.id;

      await prisma.studentSimulationProgress.create({
        data: {
          simulationId: newState.id,
          currentDay: 1,
          totalDays,
          status: 'DECISION_OPEN'
        }
      });
    } else {
      simStateId = existingState.id;
      if (!existingState.simulationMode) {
        await prisma.simulationState.update({
          where: { id: existingState.id },
          data: { simulationMode: scenario?.simulationMode || 'GOOGLE_ADS' }
        });
      }
    }

    io?.to(`instructor:${instructorId}`).emit('student_join_approved', { studentId, classId });
    io?.to(`class:${classId}`).emit('student_join_approved', { studentId, classId });
    io?.to(`user:${studentId}`).emit('student_join_approved', { classId, simulationId: simStateId });

    // Invalidate any cached auth session so the student's next request gets
    // fresh status='active' from DB rather than the cached 'pending' payload
    await cacheService.invalidatePattern('auth:session:*').catch(() => {});

    return { success: true, message: 'Student join request approved successfully.' };
  }

  fastify.post('/classes/:classId/approve-student', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { classId } = request.params as { classId: string };
    const { studentId } = request.body as { studentId: string };
    const result = await approveStudentHelper(classId, studentId, authReq.user!.id, authReq.user!.role);
    return reply.status(200).send(result);
  });

  fastify.post('/classes/:classId/students/:studentId/approve', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { classId, studentId } = request.params as { classId: string; studentId: string };
    const result = await approveStudentHelper(classId, studentId, authReq.user!.id, authReq.user!.role);
    return reply.status(200).send(result);
  });

  /**
   * POST /api/instructor/classes/:classId/reject-student
   * POST /api/instructor/classes/:classId/students/:studentId/reject
   */
  async function rejectStudentHelper(classId: string, studentId: string, reason: string | undefined, instructorId: string, role: string) {
    if (!studentId) throw new ValidationError('studentId is required.');

    await checkClassOwnership(classId, instructorId, role);

    const student = await prisma.user.findFirst({
      where: { id: studentId, classId, status: 'pending' }
    });

    if (!student) throw new NotFoundError('Pending student not found in this class.');

    await prisma.user.update({
      where: { id: studentId },
      data: { classId: null, status: 'active' }
    });

    await prisma.classEnrollment.updateMany({
      where: { studentId, classId },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason || 'Rejected by instructor', actionByInstructorId: instructorId }
    });

    io?.to(`instructor:${instructorId}`).emit('student_join_rejected', { studentId, classId });
    io?.to(`user:${studentId}`).emit('student_join_rejected', { classId, reason });

    return { success: true, message: 'Student join request rejected.' };
  }

  fastify.post('/classes/:classId/reject-student', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { classId } = request.params as { classId: string };
    const { studentId, reason } = request.body as { studentId: string; reason?: string };
    const result = await rejectStudentHelper(classId, studentId, reason, authReq.user!.id, authReq.user!.role);
    return reply.status(200).send(result);
  });

  fastify.post('/classes/:classId/students/:studentId/reject', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { classId, studentId } = request.params as { classId: string; studentId: string };
    const { reason } = request.body as { reason?: string };
    const result = await rejectStudentHelper(classId, studentId, reason, authReq.user!.id, authReq.user!.role);
    return reply.status(200).send(result);
  });

  /**
   * DELETE /api/instructor/classes/:classId/students/:studentId
   */
  fastify.delete('/classes/:classId/students/:studentId', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { classId, studentId } = request.params as { classId: string; studentId: string };

    await checkClassOwnership(classId, authReq.user!.id, authReq.user!.role);

    const student = await prisma.user.findFirst({
      where: { id: studentId, classId }
    });

    if (!student) throw new NotFoundError('Student not found in this class.');

    await prisma.user.update({
      where: { id: studentId },
      data: { classId: null, status: 'active' }
    });

    await prisma.classEnrollment.updateMany({
      where: { studentId, classId },
      data: { status: 'TERMINATED', removedAt: new Date(), actionByInstructorId: authReq.user!.id }
    });

    io?.to(`instructor:${authReq.user!.id}`).emit('student_removed', { studentId, classId });
    io?.to(`user:${studentId}`).emit('student_removed', { classId });

    return reply.status(200).send({
      success: true,
      message: 'Student removed from class successfully.'
    });
  });

  /**
   * GET /api/instructor/scenarios
   */
  fastify.get('/scenarios', async (request, reply) => {
    const scenarios = await prisma.scenario.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return reply.status(200).send({
      success: true,
      scenarios
    });
  });

  /**
   * POST /api/instructor/scenarios
   */
  fastify.post('/scenarios', async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string(),
      industry: z.string(),
      difficulty: z.enum(['easy', 'medium', 'hard']),
      maxRounds: z.number().int().min(1),
      budgetPerRound: z.number().positive(),
      targetKPI: z.enum(['revenue', 'clicks', 'conversions']).default('revenue'),
      checkpointRequired: z.boolean().default(true),
      certificateEnabled: z.boolean().default(true),
      allowedPlatforms: z.array(z.string()).default(['SEO', 'GOOGLE_ADS', 'META_ADS'])
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const newScenario = await prisma.scenario.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        industry: parsed.data.industry,
        difficulty: parsed.data.difficulty,
        maxRounds: parsed.data.maxRounds,
        budgetPerRound: parsed.data.budgetPerRound,
        targetKPI: parsed.data.targetKPI,
        checkpointRequired: parsed.data.checkpointRequired,
        certificateEnabled: parsed.data.certificateEnabled,
        allowedPlatforms: JSON.stringify(parsed.data.allowedPlatforms),
        scenarioType: 'standard'
      }
    });

    return reply.status(201).send({
      success: true,
      scenario: newScenario
    });
  });

  /**
   * PATCH /api/instructor/scenarios/:scenarioId
   */
  fastify.patch('/scenarios/:scenarioId', async (request, reply) => {
    const { scenarioId } = request.params as { scenarioId: string };

    const schema = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      industry: z.string().optional(),
      difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
      maxRounds: z.number().int().min(1).optional(),
      budgetPerRound: z.number().positive().optional(),
      targetKPI: z.enum(['revenue', 'clicks', 'conversions']).optional(),
      checkpointRequired: z.boolean().optional(),
      certificateEnabled: z.boolean().optional(),
      allowedPlatforms: z.array(z.string()).optional()
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const dataToUpdate: any = { ...parsed.data };
    if (parsed.data.allowedPlatforms) {
      dataToUpdate.allowedPlatforms = JSON.stringify(parsed.data.allowedPlatforms);
    }

    const updated = await prisma.scenario.update({
      where: { id: scenarioId },
      data: dataToUpdate
    });

    return reply.status(200).send({
      success: true,
      scenario: updated
    });
  });

  /**
   * POST /api/instructor/scenarios/:scenarioId/publish
   */
  fastify.post('/scenarios/:scenarioId/publish', async (request, reply) => {
    const { scenarioId } = request.params as { scenarioId: string };

    const updated = await prisma.scenario.update({
      where: { id: scenarioId },
      data: { scenarioType: 'standard' }
    });

    return reply.status(200).send({
      success: true,
      scenario: updated
    });
  });

  /**
   * POST /api/instructor/scenarios/:scenarioId/assign
   */
  fastify.post('/scenarios/:scenarioId/assign', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { scenarioId } = request.params as { scenarioId: string };
    const { classId, roundDuration, totalRounds } = request.body as {
      classId: string;
      roundDuration?: number;
      totalRounds?: number;
    };

    if (!classId) throw new ValidationError('classId is required.');

    await checkClassOwnership(classId, authReq.user!.id, authReq.user!.role);

    const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
    if (!scenario) throw new NotFoundError('Scenario not found.');

    await prisma.class.update({
      where: { id: classId },
      data: { scenarioId }
    });

    const activeMode = scenario.simulationMode || 'GOOGLE_ADS';

    // Create assignments entry
    await prisma.scenarioAssignment.create({
      data: {
        instructorId: authReq.user!.id,
        classId,
        scenarioId,
        targetType: 'CLASS',
        targetStudentIdsJson: '[]',
        assignmentName: `Assignment - ${scenario.name}`,
        startDate: new Date(),
        endDate: new Date(Date.now() + (scenario.durationDays || 30) * 24 * 3600 * 1000),
        dailyProcessingTime: '09:00',
        dailyBudgetCap: scenario.dailyBudgetCap || 500.0,
        difficulty: scenario.difficulty || 'medium',
        status: 'ACTIVE',
        simulationMode: activeMode,
        roundDurationHours: roundDuration || 24,
        totalRounds: totalRounds || scenario.maxRounds
      }
    });

    // Initialize SimulationState for all students in class
    const activeStudents = await prisma.user.findMany({
      where: { classId, status: 'active' }
    });

    for (const student of activeStudents) {
      const existing = await prisma.simulationState.findFirst({
        where: { userId: student.id, classId }
      });
      if (!existing) {
        const newState = await prisma.simulationState.create({
          data: {
            userId: student.id,
            classId,
            currentRound: 1,
            isCompleted: false,
            status: 'DECISION_OPEN',
            simulationMode: activeMode
          }
        });
        await prisma.studentSimulationProgress.create({
          data: {
            simulationId: newState.id,
            currentDay: 1,
            totalDays: scenario.durationDays || 30,
            status: 'DECISION_OPEN'
          }
        });
      } else {
        // Update simulationMode if not aligned
        await prisma.simulationState.update({
          where: { id: existing.id },
          data: { simulationMode: activeMode }
        });
      }
    }

    io?.to(`class:${classId}`).emit('scenario_assigned', { classId, scenarioId, simulationMode: activeMode });

    return reply.status(200).send({
      success: true,
      message: 'Scenario assigned successfully.'
    });
  });

  /**
   * GET /api/instructor/classes/:classId/leaderboard
   */
  fastify.get('/classes/:classId/leaderboard', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { classId } = request.params as { classId: string };

    await checkClassOwnership(classId, authReq.user!.id, authReq.user!.role);

    const simulations = await prisma.simulationState.findMany({
      where: { classId },
      include: {
        user: { select: { name: true, email: true } }
      },
      orderBy: { score: 'desc' }
    });

    const leaderboard = simulations.map((sim, index) => ({
      rank: index + 1,
      studentName: sim.user.name,
      studentEmail: sim.user.email,
      score: sim.score,
      cumulativeRevenue: sim.cumulativeRevenue,
      cumulativeSpend: sim.cumulativeSpend,
      currentRound: sim.currentRound,
      status: sim.status
    }));

    return reply.status(200).send({
      success: true,
      leaderboard
    });
  });

  /**
   * GET /api/instructor/classes/:classId/analytics
   */
  fastify.get('/classes/:classId/analytics', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { classId } = request.params as { classId: string };

    await checkClassOwnership(classId, authReq.user!.id, authReq.user!.role);

    const simulations = await prisma.simulationState.findMany({
      where: { classId },
      include: {
        scoreBreakdowns: true
      }
    });

    if (simulations.length === 0) {
      return reply.status(200).send({
        success: true,
        analytics: {
          classAverage: 0,
          medianScore: 0,
          channelPerformance: { seo: 0, googleAds: 0, metaAds: 0 },
          learningOutcomes: []
        }
      });
    }

    const scores = simulations.map(s => s.score).sort((a, b) => a - b);
    const classAverage = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    
    // Median
    const mid = Math.floor(scores.length / 2);
    const medianScore = scores.length % 2 !== 0 ? scores[mid] : Math.round((scores[mid - 1] + scores[mid]) / 2);

    // Channel-wise averages
    let seoSum = 0, googleSum = 0, metaSum = 0, breakdownsCount = 0;
    simulations.forEach(sim => {
      sim.scoreBreakdowns.forEach(b => {
        seoSum += b.seoScore || 0;
        googleSum += b.googleAdsScore || 0;
        metaSum += b.metaAdsScore || 0;
        breakdownsCount++;
      });
    });

    const channelPerformance = {
      seo: breakdownsCount > 0 ? Math.round(seoSum / breakdownsCount) : 0,
      googleAds: breakdownsCount > 0 ? Math.round(googleSum / breakdownsCount) : 0,
      metaAds: breakdownsCount > 0 ? Math.round(metaSum / breakdownsCount) : 0
    };

    return reply.status(200).send({
      success: true,
      analytics: {
        classAverage,
        medianScore,
        channelPerformance,
        learningOutcomes: [
          { outcome: 'SEO Strategies Attainment', percentage: channelPerformance.seo },
          { outcome: 'Paid Search Management', percentage: channelPerformance.googleAds },
          { outcome: 'Social Campaigns Execution', percentage: channelPerformance.metaAds }
        ]
      }
    });
  });

  /**
   * GET /api/instructor/classes/:classId/student-progress
   */
  fastify.get('/classes/:classId/student-progress', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { classId } = request.params as { classId: string };

    await checkClassOwnership(classId, authReq.user!.id, authReq.user!.role);

    const students = await prisma.user.findMany({
      where: { classId },
      include: {
        simulations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            progress: true
          }
        }
      }
    });

    const progressList = students.map(s => {
      const sim = s.simulations[0];
      return {
        studentId: s.id,
        studentName: s.name,
        studentEmail: s.email,
        currentRound: sim?.currentRound || 1,
        status: sim?.status || 'INITIALIZED',
        progressStatus: sim?.progress?.status || 'DECISION_OPEN',
        lastActive: sim?.updatedAt || s.updatedAt,
        score: sim?.score || 0
      };
    });

    return reply.status(200).send({
      success: true,
      studentProgress: progressList
    });
  });

  /**
   * GET /api/instructor/students/:studentId/report
   */
  fastify.get('/students/:studentId/report', async (request, reply) => {
    const { studentId } = request.params as { studentId: string };

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      include: {
        simulations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            decisions: true,
            metrics: true,
            scoreBreakdowns: true,
            progress: true
          }
        }
      }
    });

    if (!student) throw new NotFoundError('Student not found.');

    const sim = student.simulations[0];
    if (!sim) {
      return reply.status(200).send({
        success: true,
        report: null,
        message: 'No active simulation found for student.'
      });
    }

    return reply.status(200).send({
      success: true,
      report: {
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        simulationId: sim.id,
        score: sim.score,
        currentRound: sim.currentRound,
        isCompleted: sim.isCompleted,
        decisions: sim.decisions,
        metrics: sim.metrics,
        scoreBreakdowns: sim.scoreBreakdowns,
        progress: sim.progress
      }
    });
  });

  /**
   * POST /api/instructor/evaluations
   */
  fastify.post('/evaluations', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const schema = z.object({
      studentId: z.string().uuid(),
      classId: z.string().uuid(),
      comment: z.string(),
      score: z.number().min(0).max(100).optional(),
      approved: z.boolean().default(true)
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const { studentId, classId, comment, score, approved } = parsed.data;

    await checkClassOwnership(classId, authReq.user!.id, authReq.user!.role);

    const latestSim = await prisma.simulationState.findFirst({
      where: { userId: studentId, classId },
      orderBy: { createdAt: 'desc' }
    });

    if (!latestSim) throw new NotFoundError('Student simulation state not found.');

    // Save instructor feedback inside latest CheckpointValidation
    const latestCheckpoint = await prisma.checkpointValidation.findFirst({
      where: { simulationId: latestSim.id },
      orderBy: { roundNumber: 'desc' }
    });

    if (latestCheckpoint) {
      await prisma.checkpointValidation.update({
        where: { id: latestCheckpoint.id },
        data: {
          instructorComment: comment,
          status: approved ? 'APPROVED' : 'REJECTED',
          reflectionQualityScore: score !== undefined ? score : latestCheckpoint.reflectionQualityScore
        }
      });
    } else {
      // Create a dummy validation for round 1 to store feedback
      await prisma.checkpointValidation.create({
        data: {
          simulationId: latestSim.id,
          roundNumber: latestSim.currentRound,
          studentId,
          justificationText: 'Placeholder (Created by Instructor Evaluation)',
          instructorComment: comment,
          status: approved ? 'APPROVED' : 'REJECTED',
          reflectionQualityScore: score !== undefined ? score : 80.0
        }
      });
    }

    await prisma.simulationState.update({
      where: { id: latestSim.id },
      data: { instructorApproved: approved }
    });

    io?.to(`user:${studentId}`).emit('instructor_feedback_added', { studentId, classId, feedback: comment });

    return reply.status(200).send({
      success: true,
      message: 'Evaluation saved successfully.'
    });
  });

  /**
   * PATCH /api/instructor/evaluations/:evaluationId
   */
  fastify.patch('/evaluations/:evaluationId', async (request, reply) => {
    const { evaluationId } = request.params as { evaluationId: string };
    const schema = z.object({
      comment: z.string().optional(),
      score: z.number().min(0).max(100).optional(),
      status: z.enum(['APPROVED', 'REJECTED', 'SUBMITTED']).optional()
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const checkpoint = await prisma.checkpointValidation.update({
      where: { id: evaluationId },
      data: {
        instructorComment: parsed.data.comment,
        reflectionQualityScore: parsed.data.score,
        status: parsed.data.status
      }
    });

    return reply.status(200).send({
      success: true,
      checkpoint
    });
  });

  /**
   * POST /api/instructor/certificates/:studentId/approve
   */
  fastify.post('/certificates/:studentId/approve', async (request, reply) => {
    const { studentId } = request.params as { studentId: string };

    const latestSim = await prisma.simulationState.findFirst({
      where: { userId: studentId },
      orderBy: { createdAt: 'desc' }
    });

    if (!latestSim) throw new NotFoundError('No simulation state found for student.');

    await prisma.simulationState.update({
      where: { id: latestSim.id },
      data: { instructorApproved: true }
    });

    io?.to(`user:${studentId}`).emit('certificate_ready', { studentId });

    return reply.status(200).send({
      success: true,
      message: 'Certificate successfully approved.'
    });
  });

  // Helper to generate accreditation averages
  async function computeAccreditationData(classId: string) {
    const simulations = await prisma.simulationState.findMany({
      where: { classId },
      include: {
        scoreBreakdowns: true,
        user: true
      }
    });

    const threshold = 60.0;
    let co1Passed = 0, co2Passed = 0, co3Passed = 0, co4Passed = 0, co5Passed = 0;
    let totalCount = simulations.length;

    simulations.forEach(sim => {
      const seoAvg = sim.scoreBreakdowns.reduce((sum, b) => sum + (b.seoScore || 0), 0) / (sim.scoreBreakdowns.length || 1);
      const googleAvg = sim.scoreBreakdowns.reduce((sum, b) => sum + (b.googleAdsScore || 0), 0) / (sim.scoreBreakdowns.length || 1);
      const metaAvg = sim.scoreBreakdowns.reduce((sum, b) => sum + (b.metaAdsScore || 0), 0) / (sim.scoreBreakdowns.length || 1);
      const budgetAvg = sim.scoreBreakdowns.reduce((sum, b) => sum + (b.budgetScore || 0), 0) / (sim.scoreBreakdowns.length || 1);
      const adaptiveAvg = sim.scoreBreakdowns.reduce((sum, b) => sum + (b.adaptability || 0), 0) / (sim.scoreBreakdowns.length || 1);

      if (googleAvg >= threshold) co1Passed++;
      if (metaAvg >= threshold) co2Passed++;
      if (seoAvg >= threshold) co3Passed++;
      if (budgetAvg >= threshold) co4Passed++;
      if (adaptiveAvg >= threshold) co5Passed++;
    });

    const divisor = totalCount || 1;
    return {
      totalStudents: totalCount,
      attainment: {
        CO1: parseFloat(((co1Passed / divisor) * 100).toFixed(1)),
        CO2: parseFloat(((co2Passed / divisor) * 100).toFixed(1)),
        CO3: parseFloat(((co3Passed / divisor) * 100).toFixed(1)),
        CO4: parseFloat(((co4Passed / divisor) * 100).toFixed(1)),
        CO5: parseFloat(((co5Passed / divisor) * 100).toFixed(1))
      }
    };
  }

  /**
   * GET /api/instructor/reports/nba
   */
  fastify.get('/reports/nba', async (request, reply) => {
    const { classId } = request.query as { classId: string };
    if (!classId) throw new ValidationError('classId is required.');

    const data = await computeAccreditationData(classId);
    return reply.status(200).send({
      success: true,
      reportType: 'NBA Accreditation',
      ...data,
      coPoMapping: {
        CO1: { PO1: 3, PO5: 2 },
        CO2: { PO1: 3, PO5: 2 },
        CO3: { PO1: 2, PO3: 3, PO5: 2 },
        CO4: { PO11: 3 },
        CO5: { PO2: 3, PO11: 1 }
      }
    });
  });

  /**
   * GET /api/instructor/reports/obe
   */
  fastify.get('/reports/obe', async (request, reply) => {
    const { classId } = request.query as { classId: string };
    if (!classId) throw new ValidationError('classId is required.');

    const data = await computeAccreditationData(classId);
    return reply.status(200).send({
      success: true,
      reportType: 'OBE Assessment',
      ...data,
      learningOutcomes: [
        { code: 'CO1', name: 'Formulate and optimise search ads bids', target: 70.0 },
        { code: 'CO2', name: 'Design and manage viral social creatives', target: 70.0 },
        { code: 'CO3', name: 'Analyze content keywords and technical slug slugs', target: 65.0 },
        { code: 'CO4', name: 'Administer budget allocations efficiently', target: 75.0 },
        { code: 'CO5', name: 'Adapt strategies to match dynamic market trends', target: 60.0 }
      ]
    });
  });

  /**
   * GET /api/instructor/reports/accreditation
   */
  fastify.get('/reports/accreditation', async (request, reply) => {
    const { classId } = request.query as { classId: string };
    if (!classId) throw new ValidationError('classId is required.');

    const data = await computeAccreditationData(classId);
    return reply.status(200).send({
      success: true,
      reportType: 'Accreditation Summary',
      attainmentSummary: data.attainment
    });
  });

  /**
   * GET /api/instructor/reports/performance
   */
  fastify.get('/reports/performance', async (request, reply) => {
    const { classId } = request.query as { classId: string };
    if (!classId) throw new ValidationError('classId is required.');

    const simulations = await prisma.simulationState.findMany({
      where: { classId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { score: 'desc' }
    });

    return reply.status(200).send({
      success: true,
      classId,
      scoresDistribution: simulations.map(s => ({
        studentName: s.user.name,
        score: s.score,
        isCompleted: s.isCompleted
      }))
    });
  });

  /**
   * GET /api/instructor/reports/export
   */
  fastify.get('/reports/export', async (request, reply) => {
    const { classId, format } = request.query as { classId: string; format: string };
    if (!classId) throw new ValidationError('classId is required.');

    return reply.status(200).send({
      success: true,
      downloadUrl: `/api/v1/report/class/${classId}/credentials`,
      format: format || 'csv'
    });
  });

  // ─── Instructor Preview Endpoints ───────────────────────────────────────────

  /**
   * GET /api/v1/instructor/scenarios/:id/preview
   */
  fastify.get('/scenarios/:id/preview', async (request, reply) => {
    const { id } = request.params as { id: string };
    const scenario = await prisma.scenario.findUnique({ where: { id } });
    if (!scenario) throw new NotFoundError('Scenario template not found.');
    return reply.status(200).send({ success: true, scenario });
  });

  /**
   * POST /api/v1/instructor/scenarios/:id/preview/run
   */
  fastify.post('/scenarios/:id/preview/run', async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };
    const userId = authReq.user!.id;

    // Resolve unique preview class invite code and simulation state
    const inviteCode = `PREVIEW-${id}-${userId}`;
    let cls = await prisma.class.findUnique({ where: { inviteCode } });
    if (!cls) {
      cls = await prisma.class.create({
        data: {
          name: `Preview Classroom - ${id}`,
          inviteCode,
          instructorId: userId,
          scenarioId: id
        }
      });
    }

    let state = await prisma.simulationState.findFirst({
      where: { userId, classId: cls.id }
    });

    if (!state) {
      state = await prisma.simulationState.create({
        data: {
          userId,
          classId: cls.id,
          currentRound: 1,
          status: 'DECISION_OPEN',
          isCompleted: false
        }
      });

      // Insert default dummy decision so we can process round immediately
      await prisma.decision.create({
        data: {
          simulationId: state.id,
          round: 1,
          googleCampaigns: '[]',
          metaCampaigns: '[]',
          seoTargetKeywords: '[]',
          submitted: true
        }
      });
    } else {
      // In preview mode, allow quick fast-forward resets
      await prisma.decision.upsert({
        where: { simulationId_round: { simulationId: state.id, round: state.currentRound } },
        update: { submitted: true },
        create: {
          simulationId: state.id,
          round: state.currentRound,
          googleCampaigns: '[]',
          metaCampaigns: '[]',
          seoTargetKeywords: '[]',
          submitted: true
        }
      });
    }

    const result = await processSimulationRound(state.id);

    return reply.status(200).send({
      success: true,
      message: `Preview round ${state.currentRound} processed successfully.`,
      result
    });
  });
}
