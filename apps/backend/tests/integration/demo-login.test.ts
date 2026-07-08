import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../src/app';
import { prisma } from '../../src/db/client';
import { hashPassword } from 'better-auth/crypto';

describe('Demo Account Logins & Auth Interceptor Tests', () => {
  const adminEmail = 'test-superadmin@simlab.run';
  const instructorEmail = 'test-instructor@simlab.run';
  const studentEmail = 'test-student@simlab.run';
  const suspendedEmail = 'test-suspended@simlab.run';
  const password = 'Test@123456';
  let passwordHash = '';

  beforeAll(async () => {
    await prisma.$connect();
    passwordHash = await hashPassword(password);

    // Clean up
    const emails = [adminEmail, instructorEmail, studentEmail, suspendedEmail];
    await prisma.account.deleteMany({
      where: {
        userId: {
          in: await prisma.user.findMany({
            where: { email: { in: emails } },
            select: { id: true }
          }).then(users => users.map(u => u.id))
        }
      }
    });
    await prisma.user.deleteMany({
      where: { email: { in: emails } }
    });

    // Create active admin
    const adminUser = await prisma.user.create({
      data: { email: adminEmail, role: 'ADMIN', status: 'active', emailVerified: true, name: 'Test Admin' }
    });
    await prisma.account.create({
      data: { userId: adminUser.id, accountId: adminEmail, providerId: 'credential', password: passwordHash }
    });

    // Create active instructor
    const instructorUser = await prisma.user.create({
      data: { email: instructorEmail, role: 'INSTRUCTOR', status: 'active', emailVerified: true, name: 'Test Instructor' }
    });
    await prisma.account.create({
      data: { userId: instructorUser.id, accountId: instructorEmail, providerId: 'credential', password: passwordHash }
    });

    // Create active student
    const studentUser = await prisma.user.create({
      data: { email: studentEmail, role: 'STUDENT_COLLEGE', status: 'active', emailVerified: true, name: 'Test Student' }
    });
    await prisma.account.create({
      data: { userId: studentUser.id, accountId: studentEmail, providerId: 'credential', password: passwordHash }
    });

    // Create suspended student
    const suspendedUser = await prisma.user.create({
      data: { email: suspendedEmail, role: 'STUDENT_COLLEGE', status: 'suspended', emailVerified: true, name: 'Suspended Student' }
    });
    await prisma.account.create({
      data: { userId: suspendedUser.id, accountId: suspendedEmail, providerId: 'credential', password: passwordHash }
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('should successfully authenticate active demo accounts and return proper role/redirect response info', async () => {
    const rolesToTest = [
      { email: adminEmail, expectedRole: 'ADMIN' },
      { email: instructorEmail, expectedRole: 'INSTRUCTOR' },
      { email: studentEmail, expectedRole: 'STUDENT_COLLEGE' }
    ];

    for (const testAcc of rolesToTest) {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: {
          email: testAcc.email,
          password: password
        }
      });

      expect(loginRes.statusCode).toBe(200);
      const cookies = loginRes.headers['set-cookie'];
      expect(cookies).toBeDefined();

      // Check /api/auth/me
      const profileRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: Array.isArray(cookies) ? cookies.join('; ') : cookies
        }
      });
      expect(profileRes.statusCode).toBe(200);
      const body = JSON.parse(profileRes.body);
      expect(body.role).toBe(testAcc.expectedRole);
      expect(body.status).toBe('active');

      // Check /api/me
      const profileRes2 = await app.inject({
        method: 'GET',
        url: '/api/me',
        headers: {
          cookie: Array.isArray(cookies) ? cookies.join('; ') : cookies
        }
      });
      expect(profileRes2.statusCode).toBe(200);
      const body2 = JSON.parse(profileRes2.body);
      expect(body2.role).toBe(testAcc.expectedRole);
      expect(body2.status).toBe('active');
    }
  });

  it('should intercept and block suspended users from logging in, returning a 403 status', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: {
        email: suspendedEmail,
        password: password
      }
    });

    expect(loginRes.statusCode).toBe(403);
    const body = JSON.parse(loginRes.body);
    expect(body.error).toContain('suspended');
    expect(body.code).toBe('ACCOUNT_INACTIVE');
  });

  it('should return a generic invalid credentials message on wrong password and not leak existence', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: {
        email: adminEmail,
        password: 'WrongPassword'
      }
    });

    expect(loginRes.statusCode).toBe(401);
    const body = JSON.parse(loginRes.body);
    expect(body.error).toBe('Invalid email or password. Please try again.');
    expect(body.code).toBe('INVALID_CREDENTIALS');
  });
});
