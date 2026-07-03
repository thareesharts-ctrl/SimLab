import { FastifyInstance } from 'fastify';
import { requireRole, requireAuth, AuthenticatedRequest } from '../auth/middleware';
import { UserRole } from '../auth/roles';
import { prisma } from '../db/client';
import { z } from 'zod';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import { logActivity } from '../utils/audit';

export async function assignmentRoutes(fastify: FastifyInstance) {

  // Helper function to calculate overlapping assignments for students
  async function checkAssignmentOverlaps(studentIds: string[], startDate: Date, endDate: Date, excludeAssignmentId?: string) {
    return prisma.scenarioAssignmentStudent.findMany({
      where: {
        studentId: { in: studentIds },
        status: { in: ['ASSIGNED', 'STARTED'] },
        assignment: {
          id: excludeAssignmentId ? { not: excludeAssignmentId } : undefined,
          status: { in: ['SCHEDULED', 'ACTIVE'] },
          OR: [
            {
              startDate: { lte: endDate },
              endDate: { gte: startDate }
            }
          ]
        }
      },
      include: {
        assignment: true,
        student: true
      }
    });
  }

  // Helper to compute next processing date/time
  function getNextProcessingTime(timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setDate(date.getDate() + 1); // due tomorrow
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  /**
   * POST /api/v1/assignments
   * Create scenario assignment (Instructor / Admin only)
   */
  fastify.post('/', { preHandler: [requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN])] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const instructorId = authReq.user!.id;

    const bodySchema = z.object({
      assignmentName: z.string().min(1, 'Assignment name is required'),
      classId: z.string().uuid('Invalid Class UUID'),
      scenarioId: z.string().uuid('Invalid Scenario UUID'),
      targetType: z.enum(['CLASS', 'GROUP', 'STUDENT']),
      targetStudentIds: z.array(z.string()).optional(),
      durationDays: z.union([z.literal(15), z.literal(30)]),
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      dailyProcessingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid daily processing time format (HH:MM)'),
      dailyBudgetCap: z.number().positive(),
      difficulty: z.string(),
      autoStart: z.boolean().default(false),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const {
      assignmentName,
      classId,
      scenarioId,
      targetType,
      targetStudentIds = [],
      durationDays,
      startDate: startDateStr,
      endDate: endDateStr,
      dailyProcessingTime,
      dailyBudgetCap,
      difficulty,
      autoStart,
    } = parsed.data;

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (startDate >= endDate) {
      throw new ValidationError('Start date must be before end date.');
    }

    // Verify expected duration matches start/end dates
    const expectedEnd = new Date(startDate.getTime() + durationDays * 24 * 3600 * 1000);
    if (Math.abs(endDate.getTime() - expectedEnd.getTime()) > 60000) {
      throw new ValidationError(`End date does not match the start date + ${durationDays} days duration.`);
    }

    // Fetch scenario details
    const scenario = await prisma.scenario.findUnique({
      where: { id: scenarioId }
    });
    if (!scenario) {
      throw new NotFoundError('Scenario template not found.');
    }

    // Verify class ownership
    const targetClass = await prisma.class.findFirst({
      where: {
        id: classId,
        instructorId: authReq.user!.role === 'ADMIN' ? undefined : instructorId,
      },
      include: {
        students: true,
      }
    });

    if (!targetClass) {
      throw new NotFoundError('Class cohort not found or unauthorized.');
    }

    // Determine target students
    let finalStudentIds: string[] = [];
    if (targetType === 'CLASS') {
      finalStudentIds = targetClass.students.filter(s => s.status === 'active').map(s => s.id);
    } else {
      // GROUP or STUDENT
      const classStudentIds = targetClass.students.map(s => s.id);
      const invalidStudents = targetStudentIds.filter(id => !classStudentIds.includes(id));
      if (invalidStudents.length > 0) {
        throw new ValidationError('One or more selected students do not belong to this class.');
      }
      finalStudentIds = targetStudentIds;
    }

    if (finalStudentIds.length === 0) {
      throw new ValidationError('No active students selected/available for assignment.');
    }

    // Check for overlap conflicts
    const conflicts = await checkAssignmentOverlaps(finalStudentIds, startDate, endDate);
    if (conflicts.length > 0) {
      const conflictNames = conflicts.map(c => `${c.student.name} (${c.assignment.assignmentName})`).join(', ');
      throw new ValidationError(`Time overlap conflict detected for students: ${conflictNames}`);
    }

    // Create assignment in DRAFT mode
    const assignment = await prisma.scenarioAssignment.create({
      data: {
        instructorId,
        institutionId: authReq.user!.institution,
        classId,
        scenarioId,
        targetType,
        targetStudentIdsJson: JSON.stringify(finalStudentIds),
        assignmentName,
        durationDays,
        startDate,
        endDate,
        dailyProcessingTime,
        dailyBudgetCap,
        difficulty,
        autoStart,
        status: 'DRAFT',
        simulationMode: scenario.simulationMode || 'GOOGLE_ADS',
        roundDurationHours: 24,
        totalRounds: scenario.maxRounds,
      },
    });

    // Create relation records for students
    await Promise.all(
      finalStudentIds.map(studentId =>
        prisma.scenarioAssignmentStudent.create({
          data: {
            assignmentId: assignment.id,
            studentId,
            status: 'ASSIGNED',
          },
        })
      )
    );

    await logActivity(instructorId, 'CREATE_ASSIGNMENT', `Created Scenario Assignment "${assignmentName}" for class "${targetClass.name}".`);

    return reply.status(201).send({
      success: true,
      assignment,
    });
  });

  /**
   * GET /api/v1/assignments
   * List instructor assignments (Instructor / Admin only)
   */
  fastify.get('/', { preHandler: [requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN])] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const instructorId = authReq.user!.id;

    const assignments = await prisma.scenarioAssignment.findMany({
      where: authReq.user!.role === 'ADMIN' ? {} : { instructorId },
      include: {
        class: true,
        scenario: true,
        _count: {
          select: { students: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.status(200).send({
      success: true,
      assignments,
    });
  });

  /**
   * GET /api/v1/assignments/student/active
   * Fetch active assignments for the logged-in student (Student only)
   */
  fastify.get('/student/active', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const authReq = request as AuthenticatedRequest;
      const now = new Date();

      const studentAssignment = await prisma.scenarioAssignmentStudent.findFirst({
        where: {
          studentId: authReq.user!.id,
          status: { in: ['ASSIGNED', 'STARTED'] },
          assignment: {
            status: 'ACTIVE',
            startDate: { lte: now },
            endDate: { gte: now }
          }
        },
        include: {
          assignment: {
            include: {
              scenario: true,
              class: true
            }
          },
          campaignRun: true
        }
      });

      return reply.status(200).send({
        success: true,
        assignments: [],
        activeAssignment: studentAssignment || null,
      });
    } catch (err) {
      return reply.status(200).send({
        success: true,
        assignments: [],
        activeAssignment: null,
      });
    }
  });

  /**
   * GET /api/v1/assignments/:id
   * View scenario assignment details (Instructor / Admin only)
   */
  fastify.get('/:id', { preHandler: [requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN])] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };

    const assignment = await prisma.scenarioAssignment.findFirst({
      where: {
        id,
        instructorId: authReq.user!.role === 'ADMIN' ? undefined : authReq.user!.id,
      },
      include: {
        class: true,
        scenario: true,
        students: {
          include: {
            student: {
              select: { id: true, name: true, email: true }
            },
            campaignRun: true
          }
        }
      }
    });

    if (!assignment) {
      throw new NotFoundError('Scenario assignment not found.');
    }

    return reply.status(200).send({
      success: true,
      assignment,
    });
  });

  /**
   * PATCH /api/v1/assignments/:id
   * Edit draft/scheduled scenario assignment (Instructor / Admin only)
   */
  fastify.patch('/:id', { preHandler: [requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN])] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };

    const assignment = await prisma.scenarioAssignment.findFirst({
      where: {
        id,
        instructorId: authReq.user!.role === 'ADMIN' ? undefined : authReq.user!.id,
      },
      include: {
        students: true
      }
    });

    if (!assignment) {
      throw new NotFoundError('Scenario assignment not found.');
    }

    // Disallow modifying past/started assignments
    if (assignment.status === 'ACTIVE' || assignment.status === 'COMPLETED') {
      const started = assignment.students.some(s => s.status === 'STARTED');
      if (started) {
        throw new ValidationError('Cannot edit assignment. One or more student campaigns have already started.');
      }
    }

    const bodySchema = z.object({
      assignmentName: z.string().optional(),
      durationDays: z.union([z.literal(15), z.literal(30)]).optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      dailyProcessingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      dailyBudgetCap: z.number().positive().optional(),
      difficulty: z.string().optional(),
      autoStart: z.boolean().optional(),
      targetStudentIds: z.array(z.string()).optional(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const updateData: any = { ...parsed.data };
    delete updateData.targetStudentIds;

    const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : assignment.startDate;
    const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : assignment.endDate;
    const durationDays = parsed.data.durationDays ?? assignment.durationDays;

    if (parsed.data.startDate || parsed.data.endDate || parsed.data.durationDays) {
      if (startDate >= endDate) {
        throw new ValidationError('Start date must be before end date.');
      }
      const expectedEnd = new Date(startDate.getTime() + durationDays * 24 * 3600 * 1000);
      if (Math.abs(endDate.getTime() - expectedEnd.getTime()) > 60000) {
        throw new ValidationError(`End date does not match the start date + ${durationDays} days duration.`);
      }
      updateData.startDate = startDate;
      updateData.endDate = endDate;
    }

    // Handle student list updates if specified
    if (parsed.data.targetStudentIds) {
      // Verify class membership
      const targetClass = await prisma.class.findUnique({
        where: { id: assignment.classId },
        include: { students: true }
      });
      const classStudentIds = targetClass?.students.map(s => s.id) || [];
      const invalidStudents = parsed.data.targetStudentIds.filter(sid => !classStudentIds.includes(sid));
      if (invalidStudents.length > 0) {
        throw new ValidationError('One or more selected students do not belong to the class.');
      }

      // Check overlap conflicts for newly targeted students
      const conflicts = await checkAssignmentOverlaps(parsed.data.targetStudentIds, startDate, endDate, id);
      if (conflicts.length > 0) {
        const conflictNames = conflicts.map(c => `${c.student.name} (${c.assignment.assignmentName})`).join(', ');
        throw new ValidationError(`Overlap conflict detected: ${conflictNames}`);
      }

      updateData.targetStudentIdsJson = JSON.stringify(parsed.data.targetStudentIds);

      // Recreate ScenarioAssignmentStudent records
      await prisma.scenarioAssignmentStudent.deleteMany({ where: { assignmentId: id } });
      await Promise.all(
        parsed.data.targetStudentIds.map(studentId =>
          prisma.scenarioAssignmentStudent.create({
            data: {
              assignmentId: id,
              studentId,
              status: 'ASSIGNED',
            }
          })
        )
      );
    }

    const updated = await prisma.scenarioAssignment.update({
      where: { id },
      data: updateData,
    });

    return reply.status(200).send({
      success: true,
      assignment: updated,
    });
  });

  /**
   * POST /api/v1/assignments/:id/publish
   * Publish Scenario Assignment (Draft -> Scheduled / Active)
   */
  fastify.post('/:id/publish', { preHandler: [requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN])] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };

    const assignment = await prisma.scenarioAssignment.findFirst({
      where: {
        id,
        instructorId: authReq.user!.role === 'ADMIN' ? undefined : authReq.user!.id,
      },
    });

    if (!assignment) {
      throw new NotFoundError('Scenario assignment not found.');
    }

    if (assignment.status !== 'DRAFT') {
      throw new ValidationError('Only DRAFT assignments can be published.');
    }

    const now = new Date();
    let newStatus = 'SCHEDULED';
    if (assignment.startDate <= now && assignment.endDate >= now) {
      newStatus = 'ACTIVE';
    }

    const updated = await prisma.scenarioAssignment.update({
      where: { id },
      data: { status: newStatus },
    });

    // If autoStart is true and status becomes ACTIVE, create CampaignRun records automatically
    if (newStatus === 'ACTIVE' && assignment.autoStart) {
      const studentRelations = await prisma.scenarioAssignmentStudent.findMany({
        where: { assignmentId: id },
      });

      const startedAt = new Date();
      const endsAt = new Date(startedAt.getTime() + assignment.durationDays * 24 * 3600 * 1000);
      const nextProcessingAt = getNextProcessingTime(assignment.dailyProcessingTime);

      for (const rel of studentRelations) {
        if (rel.status === 'ASSIGNED') {
          // Verify simulation state exists
          let simState = await prisma.simulationState.findFirst({
            where: { userId: rel.studentId, classId: assignment.classId }
          });
          if (!simState) {
            simState = await prisma.simulationState.create({
              data: {
                userId: rel.studentId,
                classId: assignment.classId,
                currentRound: 1,
                isCompleted: false,
                status: 'DECISION_OPEN',
                simulationMode: assignment.simulationMode || 'GOOGLE_ADS'
              }
            });
            await prisma.studentSimulationProgress.create({
              data: {
                simulationId: simState.id,
                currentDay: 1,
                totalDays: assignment.durationDays,
                status: 'DECISION_OPEN'
              }
            });
          }

          const run = await prisma.campaignRun.create({
            data: {
              userId: rel.studentId,
              scenarioId: assignment.scenarioId,
              classId: assignment.classId,
              assignmentId: id,
              durationDays: assignment.durationDays,
              currentDay: 1,
              status: 'ACTIVE',
              startedAt,
              endsAt,
              nextProcessingAt,
            }
          });

          await prisma.scenarioAssignmentStudent.update({
            where: { id: rel.id },
            data: {
              status: 'STARTED',
              startedAt,
              campaignRunId: run.id
            }
          });
        }
      }
    }

    await logActivity(authReq.user!.id, 'PUBLISH_ASSIGNMENT', `Published Scenario Assignment "${assignment.assignmentName}" (Status: ${newStatus}).`);

    return reply.status(200).send({
      success: true,
      assignment: updated,
    });
  });

  /**
   * POST /api/v1/assignments/:id/start
   * Manually start Scenario Assignment (DRAFT/SCHEDULED -> ACTIVE) and boot campaigns
   */
  fastify.post('/:id/start', { preHandler: [requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN])] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };

    const assignment = await prisma.scenarioAssignment.findFirst({
      where: {
        id,
        instructorId: authReq.user!.role === 'ADMIN' ? undefined : authReq.user!.id,
      },
    });

    if (!assignment) {
      throw new NotFoundError('Scenario assignment not found.');
    }

    if (assignment.status === 'COMPLETED' || assignment.status === 'CANCELLED') {
      throw new ValidationError('Cannot start a completed or cancelled assignment.');
    }

    const updated = await prisma.scenarioAssignment.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    const studentRelations = await prisma.scenarioAssignmentStudent.findMany({
      where: { assignmentId: id },
    });

    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + assignment.durationDays * 24 * 3600 * 1000);
    const nextProcessingAt = getNextProcessingTime(assignment.dailyProcessingTime);

    for (const rel of studentRelations) {
      if (rel.status === 'ASSIGNED') {
        let simState = await prisma.simulationState.findFirst({
          where: { userId: rel.studentId, classId: assignment.classId }
        });
        if (!simState) {
          simState = await prisma.simulationState.create({
            data: {
              userId: rel.studentId,
              classId: assignment.classId,
              currentRound: 1,
              isCompleted: false,
              status: 'DECISION_OPEN',
              simulationMode: assignment.simulationMode || 'GOOGLE_ADS'
            }
          });
          await prisma.studentSimulationProgress.create({
            data: {
              simulationId: simState.id,
              currentDay: 1,
              totalDays: assignment.durationDays,
              status: 'DECISION_OPEN'
            }
          });
        }

        const run = await prisma.campaignRun.create({
          data: {
            userId: rel.studentId,
            scenarioId: assignment.scenarioId,
            classId: assignment.classId,
            assignmentId: id,
            durationDays: assignment.durationDays,
            currentDay: 1,
            status: 'ACTIVE',
            startedAt,
            endsAt,
            nextProcessingAt,
          }
        });

        await prisma.scenarioAssignmentStudent.update({
          where: { id: rel.id },
          data: {
            status: 'STARTED',
            startedAt,
            campaignRunId: run.id
          }
        });
      }
    }

    await logActivity(authReq.user!.id, 'START_ASSIGNMENT', `Started Scenario Assignment "${assignment.assignmentName}" immediately.`);

    return reply.status(200).send({
      success: true,
      assignment: updated,
    });
  });

  /**
   * POST /api/v1/assignments/:id/cancel
   * Cancel Scenario Assignment
   */
  fastify.post('/:id/cancel', { preHandler: [requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN])] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };

    const assignment = await prisma.scenarioAssignment.findFirst({
      where: {
        id,
        instructorId: authReq.user!.role === 'ADMIN' ? undefined : authReq.user!.id,
      },
    });

    if (!assignment) {
      throw new NotFoundError('Scenario assignment not found.');
    }

    const updated = await prisma.scenarioAssignment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Update students relations
    await prisma.scenarioAssignmentStudent.updateMany({
      where: { assignmentId: id },
      data: { status: 'CANCELLED' },
    });

    // Terminate/Complete active campaigns runs
    await prisma.campaignRun.updateMany({
      where: { assignmentId: id, status: 'ACTIVE' },
      data: { status: 'COMPLETED' },
    });

    await logActivity(authReq.user!.id, 'CANCEL_ASSIGNMENT', `Cancelled Scenario Assignment "${assignment.assignmentName}".`);

    return reply.status(200).send({
      success: true,
      assignment: updated,
    });
  });

  /**
   * GET /api/v1/assignments/:id/students
   * List assigned students and campaign status
   */
  fastify.get('/:id/students', { preHandler: [requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN])] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };

    const assignment = await prisma.scenarioAssignment.findFirst({
      where: {
        id,
        instructorId: authReq.user!.role === 'ADMIN' ? undefined : authReq.user!.id,
      },
    });

    if (!assignment) {
      throw new NotFoundError('Scenario assignment not found.');
    }

    const students = await prisma.scenarioAssignmentStudent.findMany({
      where: { assignmentId: id },
      include: {
        student: {
          select: { id: true, name: true, email: true }
        },
        campaignRun: {
          include: {
            results: { orderBy: { dayNumber: 'desc' }, take: 1 }
          }
        }
      }
    });

    return reply.status(200).send({
      success: true,
      students,
    });
  });

  /**
   * GET /api/v1/assignments/:id/progress
   * Show daily campaign progress for assigned students
   */
  fastify.get('/:id/progress', { preHandler: [requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN])] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };

    const assignment = await prisma.scenarioAssignment.findFirst({
      where: {
        id,
        instructorId: authReq.user!.role === 'ADMIN' ? undefined : authReq.user!.id,
      },
    });

    if (!assignment) {
      throw new NotFoundError('Scenario assignment not found.');
    }

    const studentsProgress = await prisma.scenarioAssignmentStudent.findMany({
      where: { assignmentId: id },
      include: {
        student: {
          select: { id: true, name: true, email: true }
        },
        campaignRun: {
          include: {
            results: { orderBy: { dayNumber: 'asc' } }
          }
        }
      }
    });

    const progressList = studentsProgress.map(sp => {
      const run = sp.campaignRun;
      const latestResult = run?.results[run.results.length - 1];
      const avgScore = run?.results.length
        ? run.results.reduce((s, r) => s + r.compositeScore, 0) / run.results.length
        : 0;

      return {
        studentId: sp.studentId,
        studentName: sp.student.name,
        studentEmail: sp.student.email,
        campaignRunId: run?.id || null,
        status: sp.status,
        currentDay: run?.currentDay || 0,
        avgScore: parseFloat(avgScore.toFixed(2)),
        latestScore: latestResult?.compositeScore || null,
        startedAt: sp.startedAt,
        completedAt: sp.completedAt,
        results: run?.results || [],
      };
    });

    return reply.status(200).send({
      success: true,
      progress: progressList,
    });
  });

  /**
   * GET /api/v1/assignments/:id/leaderboard
   * Assignment-specific leaderboard
   */
  fastify.get('/:id/leaderboard', { preHandler: [requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN])] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };

    const assignment = await prisma.scenarioAssignment.findFirst({
      where: {
        id,
        instructorId: authReq.user!.role === 'ADMIN' ? undefined : authReq.user!.id,
      },
    });

    if (!assignment) {
      throw new NotFoundError('Scenario assignment not found.');
    }

    const runs = await prisma.campaignRun.findMany({
      where: { assignmentId: id },
      include: {
        user: { select: { id: true, name: true } },
        results: { select: { compositeScore: true } }
      }
    });

    const standings = runs.map(run => {
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
   * GET /api/v1/assignments/:id/report
   * Assignment-specific report summary
   */
  fastify.get('/:id/report', { preHandler: [requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN])] }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };

    const assignment = await prisma.scenarioAssignment.findFirst({
      where: {
        id,
        instructorId: authReq.user!.role === 'ADMIN' ? undefined : authReq.user!.id,
      },
      include: {
        scenario: true
      }
    });

    if (!assignment) {
      throw new NotFoundError('Scenario assignment not found.');
    }

    const students = await prisma.scenarioAssignmentStudent.findMany({
      where: { assignmentId: id },
      include: {
        campaignRun: {
          include: {
            results: true,
            decisions: true
          }
        }
      }
    });

    const totalAssigned = students.length;
    let startedCount = 0;
    let completedCount = 0;
    let pendingStartCount = 0;
    let totalScore = 0;
    let scoreCount = 0;
    let totalSpend = 0;
    let totalRevenue = 0;
    let totalConversions = 0;
    let missedSubmissions = 0;
    const dayDistribution: Record<number, number> = {};
    const topPerformers: any[] = [];
    const atRiskStudents: any[] = [];

    students.forEach(s => {
      if (s.status === 'STARTED') startedCount++;
      else if (s.status === 'COMPLETED') completedCount++;
      else if (s.status === 'ASSIGNED') pendingStartCount++;

      const run = s.campaignRun;
      if (run) {
        dayDistribution[run.currentDay] = (dayDistribution[run.currentDay] || 0) + 1;

        const avgScore = run.results.length
          ? run.results.reduce((sum, r) => sum + r.compositeScore, 0) / run.results.length
          : 0;

        const spendSum = run.results.reduce((sum, r) => sum + r.spend, 0);
        const revenueSum = run.results.reduce((sum, r) => sum + r.revenue, 0);
        const convSum = run.results.reduce((sum, r) => sum + r.conversions, 0);

        totalSpend += spendSum;
        totalRevenue += revenueSum;
        totalConversions += convSum;

        if (run.results.length > 0) {
          totalScore += avgScore;
          scoreCount++;
        }

        // Check missed days
        const expectedDecisions = run.currentDay - (run.status === 'ACTIVE' ? 0 : 0); // Active day might not be submitted yet
        const actualDecisions = run.decisions.length;
        if (actualDecisions < expectedDecisions) {
          missedSubmissions += (expectedDecisions - actualDecisions);
        }

        const studentProfile = {
          studentId: s.studentId,
          averageScore: parseFloat(avgScore.toFixed(2)),
          currentDay: run.currentDay,
        };

        if (avgScore >= 80) {
          topPerformers.push(studentProfile);
        } else if (avgScore > 0 && avgScore < 60) {
          atRiskStudents.push(studentProfile);
        }
      }
    });

    const averageScore = scoreCount > 0 ? parseFloat((totalScore / scoreCount).toFixed(2)) : 0.0;

    return reply.status(200).send({
      success: true,
      report: {
        assignmentName: assignment.assignmentName,
        scenarioName: assignment.scenario.name,
        totalAssigned,
        campaignsStarted: startedCount,
        campaignsCompleted: completedCount,
        studentsPendingStart: pendingStartCount,
        averageScore,
        totalSpend,
        totalRevenue,
        totalConversions,
        missedSubmissions,
        dayDistribution,
        topPerformers: topPerformers.sort((a, b) => b.averageScore - a.averageScore).slice(0, 5),
        atRiskStudents: atRiskStudents.sort((a, b) => a.averageScore - b.averageScore).slice(0, 5),
      }
    });
  });
}
