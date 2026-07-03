import { FastifyInstance } from 'fastify';
import { requireAuth, requireRole, AuthenticatedRequest } from '../auth/middleware';
import { UserRole } from '../auth/roles';
import { prisma } from '../db/client';
import { z } from 'zod';
import { ValidationError, NotFoundError } from '../utils/errors';
import { logActivity, createNotification } from '../utils/audit';
import { limitsService } from '../services/billing/limits.service';
import { hashPassword } from 'better-auth/crypto';

export async function userRoutes(fastify: FastifyInstance) {
  /**
   * PUT /api/v1/users/profile
   * Updates current user's profile display name
   */
  fastify.put('/profile', {
    preHandler: [requireAuth],
    schema: {
      description: "Update current user's profile display name and personal details",
      tags: ['User'],
      security: [{ cookieAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string' },
          phoneNumber: { type: 'string' },
          universityRole: { type: 'string' },
          age: { type: 'integer' },
          gender: { type: 'string' },
          category: { type: 'string' }
        }
      },
      response: {
        200: {
          description: 'Profile updated successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string' },
                phoneNumber: { type: 'string', nullable: true },
                universityRole: { type: 'string', nullable: true },
                age: { type: 'integer', nullable: true },
                gender: { type: 'string', nullable: true },
                category: { type: 'string', nullable: true },
                institution: { type: 'string', nullable: true }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const bodySchema = z.object({
      name: z.string().min(1, 'Display name cannot be empty'),
      email: z.string().email('Invalid email format').optional(),
      phoneNumber: z.string().nullable().optional(),
      universityRole: z.string().nullable().optional(),
      age: z.number().nullable().optional(),
      gender: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const updatedUser = await prisma.user.update({
      where: { id: authReq.user!.id },
      data: {
        name: parsed.data.name,
        ...(parsed.data.email !== undefined && { email: parsed.data.email }),
        ...(parsed.data.phoneNumber !== undefined && { phoneNumber: parsed.data.phoneNumber }),
        ...(parsed.data.universityRole !== undefined && { universityRole: parsed.data.universityRole }),
        ...(parsed.data.age !== undefined && { age: parsed.data.age }),
        ...(parsed.data.gender !== undefined && { gender: parsed.data.gender }),
        ...(parsed.data.category !== undefined && { category: parsed.data.category }),
      },
    });

    return reply.status(200).send({
      success: true,
      user: updatedUser,
    });
  });

  /**
   * POST /api/v1/users/join-class
   * Associates a student to a class room via class invite code
   */
  fastify.post('/join-class', {
    preHandler: [requireAuth],
    schema: {
      description: 'Associates a student to a class room via class invite code',
      tags: ['User'],
      security: [{ cookieAuth: [] }],
      body: {
        type: 'object',
        required: ['inviteCode'],
        properties: {
          inviteCode: { type: 'string', minLength: 1 }
        }
      },
      response: {
        200: {
          description: 'Successfully joined class',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            classId: { type: 'string', nullable: true },
            className: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const authReq = request as AuthenticatedRequest;
    const bodySchema = z.object({
      inviteCode: z.string().min(1, 'Invite code is required'),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const targetClass = await prisma.class.findUnique({
      where: { inviteCode: parsed.data.inviteCode },
    });

    if (!targetClass) {
      throw new NotFoundError('No class found matching the provided invite code.');
    }

    await limitsService.checkStudentLimit(targetClass.instructorId);

    await prisma.user.update({
      where: { id: authReq.user!.id },
      data: { classId: targetClass.id, status: 'pending' },
    });

    // Sync with ClassEnrollment system
    const existing = await prisma.classEnrollment.findFirst({
      where: { studentId: authReq.user!.id, classId: targetClass.id }
    });

    if (!existing) {
      await prisma.classEnrollment.create({
        data: {
          classId: targetClass.id,
          studentId: authReq.user!.id,
          studentEmail: authReq.user!.email,
          status: 'PENDING',
        }
      });
    } else {
      await prisma.classEnrollment.update({
        where: { id: existing.id },
        data: { status: 'PENDING' }
      });
    }

    // Notify the instructor
    await createNotification(
      targetClass.instructorId,
      'info',
      'New Student Joined Class',
      `Student "${authReq.user!.name}" (${authReq.user!.email}) has requested to join your class "${targetClass.name}". Approval is required.`,
      authReq.user!.name
    );

    // Log student activity
    await logActivity(
      authReq.user!.id,
      'JOIN_CLASS',
      `Joined classroom "${targetClass.name}" (Code: ${targetClass.inviteCode}). Status is pending approval.`
    );

    return reply.status(200).send({
      success: true,
      classId: targetClass.id,
      className: targetClass.name,
    });
  });

  /**
   * POST /api/v1/users/assign-role
   * Allows administrators to reassign user system roles
   */
  fastify.post('/assign-role', {
    preHandler: [requireRole([UserRole.ADMIN])],
    schema: {
      description: 'Allows administrators to reassign user system roles',
      tags: ['Admin'],
      security: [{ cookieAuth: [] }],
      body: {
        type: 'object',
        required: ['userId', 'role'],
        properties: {
          userId: { type: 'string' },
          role: { type: 'string' }
        }
      },
      response: {
        200: {
          description: 'Role assigned successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const bodySchema = z.object({
      userId: z.string().uuid('Invalid user UUID format'),
      role: z.string(),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    let dbRole = parsed.data.role;
    if (dbRole === 'student') dbRole = 'STUDENT_COLLEGE';
    else if (dbRole === 'instructor') dbRole = 'INSTRUCTOR';
    else if (dbRole === 'admin') dbRole = 'ADMIN';
    else if (dbRole === 'individual') dbRole = 'INDIVIDUAL';

    if (!Object.values(UserRole).includes(dbRole as any)) {
      throw new ValidationError('Invalid role selection.');
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
    });

    if (!targetUser) {
      throw new NotFoundError('User account not found.');
    }

    const updatedUser = await prisma.user.update({
      where: { id: parsed.data.userId },
      data: { role: dbRole },
    });

    return reply.status(200).send({
      success: true,
      user: updatedUser,
    });
  });

  /**
   * GET /api/v1/users
   * Lists all users in the system (Admin only)
   */
  fastify.get('/', {
    preHandler: [requireRole([UserRole.ADMIN])],
    schema: {
      description: 'Lists all users in the system (Admin only)',
      tags: ['Admin'],
      security: [{ cookieAuth: [] }],
      response: {
        200: {
          description: 'Users list',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            users: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  email: { type: 'string' },
                  role: { type: 'string' },
                  status: { type: 'string' },
                  joinedAt: { type: 'string' },
                  lastLogin: { type: 'string' },
                  classCount: { type: 'integer' },
                  totalScore: { type: 'number' },
                  phoneNumber: { type: 'string', nullable: true },
                  universityRole: { type: 'string', nullable: true },
                  age: { type: 'integer', nullable: true },
                  gender: { type: 'string', nullable: true },
                  category: { type: 'string', nullable: true },
                  institution: { type: 'string', nullable: true }
                }
              }
            }
          }
        }
      }
    }
  }, async (_request, reply) => {
    const dbUsers = await prisma.user.findMany({
      include: {
        managedClasses: {
          select: { id: true }
        },
        simulations: {
          select: { score: true }
        }
      }
    });

    const users = dbUsers.map(user => {
      let classCount = 0;
      if (user.role === 'INSTRUCTOR') {
        classCount = user.managedClasses.length;
      } else if (user.role === 'STUDENT_COLLEGE') {
        classCount = user.classId ? 1 : 0;
      }

      let totalScore = 0;
      if (user.simulations.length > 0) {
        totalScore = user.simulations[0].score;
      }

      let roleMapped = 'student';
      if (user.role === 'INSTRUCTOR') roleMapped = 'instructor';
      else if (user.role === 'ADMIN') roleMapped = 'admin';

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: roleMapped,
        status: user.status,
        joinedAt: user.createdAt.toISOString().split('T')[0],
        lastLogin: user.updatedAt.toISOString().split('T')[0],
        classCount,
        totalScore,
        phoneNumber: user.phoneNumber,
        universityRole: user.universityRole,
        age: user.age,
        gender: user.gender,
        category: user.category,
        institution: user.institution
      };
    });

    return reply.status(200).send({
      success: true,
      users
    });
  });

  /**
   * POST /api/v1/users/:id/suspend
   * Suspends a user account (Admin only)
   */
  fastify.post('/:id/suspend', {
    preHandler: [requireRole([UserRole.ADMIN])],
    schema: {
      description: 'Suspends a user account (Admin only)',
      tags: ['Admin'],
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.user.update({
      where: { id },
      data: { status: 'suspended' }
    });
    return reply.status(200).send({ success: true });
  });

  /**
   * POST /api/v1/users/:id/activate
   * Activates a suspended user account (Admin only)
   */
  fastify.post('/:id/activate', {
    preHandler: [requireRole([UserRole.ADMIN])],
    schema: {
      description: 'Activates a suspended user account (Admin only)',
      tags: ['Admin'],
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.user.update({
      where: { id },
      data: { status: 'active' }
    });
    return reply.status(200).send({ success: true });
  });

  /**
   * DELETE /api/v1/users/:id
   * Deletes a user account (Admin only)
   */
  fastify.delete('/:id', {
    preHandler: [requireRole([UserRole.ADMIN])],
    schema: {
      description: 'Deletes a user account (Admin only)',
      tags: ['Admin'],
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.user.delete({
      where: { id }
    });
    return reply.status(200).send({ success: true });
  });

  /**
   * POST /api/v1/users/provision
   * Provisions a new user account (Admin only)
   */
  fastify.post('/provision', {
    preHandler: [requireRole([UserRole.ADMIN])],
    schema: {
      description: 'Provisions a new user account (Admin only)',
      tags: ['Admin'],
      security: [{ cookieAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'email', 'role'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string' },
          status: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const bodySchema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      role: z.string(),
      status: z.string().default('active')
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    let dbRole = 'STUDENT_COLLEGE';
    if (parsed.data.role === 'instructor') dbRole = 'INSTRUCTOR';
    else if (parsed.data.role === 'admin') dbRole = 'ADMIN';
    else if (parsed.data.role === 'individual') dbRole = 'INDIVIDUAL';

    const defaultPassword = 'ResetPassword123!';
    const hashedPassword = await hashPassword(defaultPassword);

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          role: dbRole,
          status: parsed.data.status,
          emailVerified: true
        }
      });

      await tx.account.create({
        data: {
          userId: user.id,
          accountId: parsed.data.email,
          providerId: 'credential',
          password: hashedPassword
        }
      });

      return user;
    });

    return reply.status(200).send({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: parsed.data.role,
        status: newUser.status,
        joinedAt: newUser.createdAt.toISOString().split('T')[0],
        lastLogin: 'Never',
        classCount: 0,
        totalScore: 0
      }
    });
  });

  /**
   * POST /api/v1/users/:id/approve
   * Approves a pending student (Instructor or Admin)
   */
  fastify.post('/:id/approve', {
    preHandler: [requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN])],
    schema: {
      description: 'Approves a pending student (Instructor or Admin)',
      tags: ['User'],
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const authReq = request as AuthenticatedRequest;

    const student = await prisma.user.findUnique({
      where: { id },
      include: {
        class: {
          include: {
            scenario: true
          }
        }
      }
    });

    if (!student) {
      throw new NotFoundError('Student not found.');
    }

    if (authReq.user!.role === 'INSTRUCTOR' && student.class?.instructorId !== authReq.user!.id) {
      throw new ValidationError('You can only approve students in your own classes.');
    }

    await prisma.user.update({
      where: { id },
      data: { status: 'active' }
    });

    const classId = student.classId;
    if (classId) {
      // Sync with ClassEnrollment system
      const enrollment = await prisma.classEnrollment.findFirst({
        where: { studentId: id, classId }
      });

      if (enrollment) {
        await prisma.classEnrollment.update({
          where: { id: enrollment.id },
          data: { status: 'ACTIVE', approvedAt: new Date(), actionByInstructorId: authReq.user!.id }
        });
      } else {
        await prisma.classEnrollment.create({
          data: {
            classId,
            studentId: id,
            studentEmail: student.email,
            status: 'ACTIVE',
            approvedAt: new Date(),
            actionByInstructorId: authReq.user!.id
          }
        });
      }

      const existingState = await prisma.simulationState.findFirst({
        where: {
          userId: id,
          classId: classId,
        },
      });

      if (!existingState) {
        const newState = await prisma.simulationState.create({
          data: {
            userId: id,
            classId: classId,
            currentRound: 1,
            isCompleted: false,
            status: 'DECISION_OPEN',
            simulationMode: student.class?.scenario?.simulationMode || 'GOOGLE_ADS',
          },
        });

        const totalDays = student.class?.scenario?.durationDays || 30;
        await prisma.studentSimulationProgress.create({
          data: {
            simulationId: newState.id,
            currentDay: 1,
            totalDays,
            status: 'DECISION_OPEN'
          }
        });
      } else {
        if (!existingState.simulationMode) {
          await prisma.simulationState.update({
            where: { id: existingState.id },
            data: { simulationMode: student.class?.scenario?.simulationMode || 'GOOGLE_ADS' }
          });
        }
      }
    }

    // Notify the student that they are approved
    if (student.class) {
      await createNotification(
        student.id,
        'success',
        'Classroom Access Approved',
        `Your instructor has approved your request to join the class "${student.class.name}". You can now access your simulation workspace!`,
        authReq.user!.name
      );

      await logActivity(
        student.id,
        'APPROVE_ACCESS',
        `Instructor approved access to class "${student.class.name}".`
      );
    }

    return reply.status(200).send({ success: true });
  });

  /**
   * POST /api/v1/users/:id/remove-from-class
   * Removes a student from a class cohort (Instructor or Admin)
   */
  fastify.post('/:id/remove-from-class', {
    preHandler: [requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN])],
    schema: {
      description: 'Removes a student from a class cohort (Instructor or Admin)',
      tags: ['User'],
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const authReq = request as AuthenticatedRequest;

    const student = await prisma.user.findUnique({
      where: { id },
      include: {
        class: true
      }
    });

    if (!student) {
      throw new NotFoundError('Student not found.');
    }

    if (authReq.user!.role === 'INSTRUCTOR' && student.class?.instructorId !== authReq.user!.id) {
      throw new ValidationError('You can only remove students in your own classes.');
    }

    await prisma.$transaction(async (tx) => {
      // Find and delete the student's simulations for this class
      if (student.classId) {
        await tx.simulationState.deleteMany({
          where: { userId: id, classId: student.classId }
        });
      }
      
      // Update student user details
      await tx.user.update({
        where: { id },
        data: { classId: null, status: 'active' }
      });
    });

    return reply.status(200).send({ success: true });
  });

  /**
   * POST /api/v1/users/:id/reset-simulation
   * Resets/reinitializes a student's simulation (Instructor or Admin)
   */
  fastify.post('/:id/reset-simulation', {
    preHandler: [requireRole([UserRole.INSTRUCTOR, UserRole.ADMIN])],
    schema: {
      description: "Resets/reinitializes a student's active simulation",
      tags: ['User'],
      security: [{ cookieAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const authReq = request as AuthenticatedRequest;

    const student = await prisma.user.findUnique({
      where: { id },
      include: {
        class: {
          include: {
            scenario: true
          }
        }
      }
    });

    if (!student) {
      throw new NotFoundError('Student not found.');
    }

    if (authReq.user!.role === 'INSTRUCTOR' && student.class?.instructorId !== authReq.user!.id) {
      throw new ValidationError('You can only manage students in your own classes.');
    }

    const classId = student.classId;
    if (!classId) {
      throw new ValidationError('Student is not currently enrolled in any class.');
    }

    await prisma.$transaction(async (tx) => {
      // Delete existing simulation records for this class
      await tx.simulationState.deleteMany({
        where: { userId: id, classId: classId }
      });

      // Create new fresh simulation state
      const newState = await tx.simulationState.create({
        data: {
          userId: id,
          classId: classId,
          currentRound: 1,
          isCompleted: false,
          status: 'DECISION_OPEN',
        },
      });

      const totalDays = student.class?.scenario?.durationDays || 30;
      await tx.studentSimulationProgress.create({
        data: {
          simulationId: newState.id,
          currentDay: 1,
          totalDays,
          status: 'DECISION_OPEN'
        }
      });
    });

    return reply.status(200).send({ success: true });
  });
}

