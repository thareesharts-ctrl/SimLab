import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../../src/app';
import { prisma } from '../../src/db/client';

describe('Scoring Breakdown Role Safety Integration Tests', () => {
  const adminEmail = 'sb-admin@simulation.com';
  const instructorEmail = 'sb-instructor@simulation.com';
  const studentEmail = 'sb-student@simulation.com';
  const individualEmail = 'sb-individual@simulation.com';
  const password = 'TestPassword123!';

  let adminCookies: any;
  let instructorCookies: any;
  let studentCookies: any;
  let individualCookies: any;

  let adminId: string;
  let instructorId: string;
  let studentId: string;
  let individualId: string;

  let classId: string;
  let scenarioId: string;

  beforeAll(async () => {
    await prisma.$connect();

    // 1. Clean up potential old test users
    const emails = [adminEmail, instructorEmail, studentEmail, individualEmail];
    await prisma.account.deleteMany({
      where: {
        user: { email: { in: emails } }
      }
    });
    await prisma.user.deleteMany({
      where: { email: { in: emails } }
    });

    // 2. Create scenario and class
    const scenario = await prisma.scenario.create({
      data: {
        name: 'Scoring Breakdown Test Scenario',
        description: 'Test Scenario Description',
        industry: 'B2B Software',
        budgetPerRound: 5000.0,
        baselineOrganicTraffic: 1000,
        targetKPI: 'revenue'
      }
    });
    scenarioId = scenario.id;

    // 3. Register users
    // Admin
    const adminSignUp = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: adminEmail, password, name: 'Admin User' }
    });
    adminId = JSON.parse(adminSignUp.body).user.id;
    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'ADMIN' }
    });

    // Instructor
    const instSignUp = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: instructorEmail, password, name: 'Instructor User' }
    });
    instructorId = JSON.parse(instSignUp.body).user.id;
    await prisma.user.update({
      where: { id: instructorId },
      data: { role: 'INSTRUCTOR' }
    });

    // Student
    const studentSignUp = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: studentEmail, password, name: 'Student User' }
    });
    studentId = JSON.parse(studentSignUp.body).user.id;

    // Individual Learner
    const indSignUp = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: individualEmail, password, name: 'Individual User' }
    });
    individualId = JSON.parse(indSignUp.body).user.id;
    await prisma.user.update({
      where: { id: individualId },
      data: { role: 'INDIVIDUAL' }
    });

    // Create a classroom cohort via instructor
    const classRes = await prisma.class.create({
      data: {
        name: 'Scoring Classroom Cohort',
        inviteCode: 'SCORING_TEST',
        instructorId,
        scenarioId
      }
    });
    classId = classRes.id;

    // Enroll student in class
    await prisma.user.update({
      where: { id: studentId },
      data: { classId }
    });
    await prisma.classEnrollment.create({
      data: {
        classId,
        studentId,
        studentEmail,
        status: 'ACTIVE'
      }
    });

    // 4. Log in all users to get cookies
    const loginAdmin = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: adminEmail, password }
    });
    adminCookies = loginAdmin.headers['set-cookie'];

    const loginInstructor = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: instructorEmail, password }
    });
    instructorCookies = loginInstructor.headers['set-cookie'];

    const loginStudent = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: studentEmail, password }
    });
    studentCookies = loginStudent.headers['set-cookie'];

    const loginIndividual = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email: individualEmail, password }
    });
    individualCookies = loginIndividual.headers['set-cookie'];
  });

  afterAll(async () => {
    const emails = [adminEmail, instructorEmail, studentEmail, individualEmail];
    await prisma.classEnrollment.deleteMany({
      where: { studentId }
    });
    await prisma.simulationState.deleteMany({
      where: { userId: { in: [studentId, individualId] } }
    });
    await prisma.class.deleteMany({
      where: { id: classId }
    });
    await prisma.scenario.deleteMany({
      where: { id: scenarioId }
    });
    await prisma.account.deleteMany({
      where: {
        user: { email: { in: emails } }
      }
    });
    await prisma.user.deleteMany({
      where: { email: { in: emails } }
    });
    await app.close();
    await prisma.$disconnect();
  });

  it('GET /api/v1/scoring/breakdown for SUPER_ADMIN should return 200 safe empty payload', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scoring/breakdown',
      headers: { cookie: adminCookies }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.hasScore).toBe(false);
    expect(body.role).toBe('ADMIN');
    expect(body.breakdown.overall).toBe(0);
    expect(body.breakdowns).toEqual([]);
  });

  it('GET /api/v1/scoring/breakdown for INSTRUCTOR should return 200 safe message', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scoring/breakdown',
      headers: { cookie: instructorCookies }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.hasScore).toBe(false);
    expect(body.role).toBe('INSTRUCTOR');
    expect(body.message).toContain('Instructor account');
    expect(body.breakdowns).toEqual([]);
  });

  it('GET /api/v1/scoring/breakdown for fresh INDIVIDUAL user should return 200 safe empty sandbox state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scoring/breakdown',
      headers: { cookie: individualCookies }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.hasScore).toBe(false);
    expect(body.nextAction).toBe('START_SANDBOX_SIMULATION');
    expect(body.breakdown.overall).toBe(0);
    expect(body.breakdowns).toEqual([]);
  });

  it('GET /api/v1/scoring/breakdown for active INDIVIDUAL user with no rounds completed should return 200 IN_PROGRESS', async () => {
    // provision active sandbox simulation state for the individual learner
    const sandboxClass = await prisma.class.create({
      data: {
        name: 'Sandbox Class',
        inviteCode: 'SANDBOX_SB_INDIVIDUAL',
        instructorId,
        scenarioId
      }
    });

    const sim = await prisma.simulationState.create({
      data: {
        userId: individualId,
        classId: sandboxClass.id,
        currentRound: 1,
        status: 'DECISION_OPEN',
        isCompleted: false
      }
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scoring/breakdown',
      headers: { cookie: individualCookies }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.hasScore).toBe(false);
    expect(body.status).toBe('IN_PROGRESS');
    expect(body.message).toContain('Score will be available after the first simulation result is generated');
    expect(body.breakdowns).toEqual([]);

    // cleanup sandbox class
    await prisma.simulationState.delete({
      where: { id: sim.id }
    });
    await prisma.class.delete({
      where: { id: sandboxClass.id }
    });
  });

  it('GET /api/v1/scoring/breakdown for completed rounds INDIVIDUAL user should return 200 real breakdown', async () => {
    const sandboxClass = await prisma.class.create({
      data: {
        name: 'Sandbox Class',
        inviteCode: 'SANDBOX_SB_INDIVIDUAL_COMPLETED',
        instructorId,
        scenarioId
      }
    });

    const sim = await prisma.simulationState.create({
      data: {
        userId: individualId,
        classId: sandboxClass.id,
        currentRound: 2,
        status: 'RESULTS_READY',
        isCompleted: false,
        score: 85.0
      }
    });

    const breakdown = await prisma.scoreBreakdown.create({
      data: {
        simulationId: sim.id,
        round: 1,
        seoScore: 80.0,
        googleAdsScore: 85.0,
        metaAdsScore: 90.0,
        budgetScore: 95.0,
        revenueScore: 75.0,
        compositeIndex: 85.0,
        efficiencyRoi: 80.0,
        budgetDiscipline: 90.0,
        riskManagement: 85.0,
        adaptability: 75.0
      }
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scoring/breakdown',
      headers: { cookie: individualCookies }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.hasScore).toBe(true);
    expect(body.breakdown.overall).toBe(85.0);
    expect(body.breakdown.performance).toBe(80.0); // maps seoScore
    expect(body.breakdown.roiEfficiency).toBe(80.0);
    expect(body.breakdowns).toHaveLength(1);
    expect(body.breakdowns[0].id).toBe(breakdown.id);

    // cleanup
    await prisma.scoreBreakdown.delete({
      where: { id: breakdown.id }
    });
    await prisma.simulationState.delete({
      where: { id: sim.id }
    });
    await prisma.class.delete({
      where: { id: sandboxClass.id }
    });
  });

  it('GET /api/v1/scoring/breakdown for fresh STUDENT user should return 200 safe empty state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scoring/breakdown',
      headers: { cookie: studentCookies }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.hasScore).toBe(false);
    expect(body.nextAction).toBe('START_SANDBOX_SIMULATION');
  });

  it('GET /api/v1/scoring/breakdown for STUDENT user with completed rounds should return 200 real breakdown', async () => {
    const sim = await prisma.simulationState.create({
      data: {
        userId: studentId,
        classId,
        currentRound: 2,
        status: 'RESULTS_READY',
        isCompleted: false,
        score: 78.5
      }
    });

    const breakdown = await prisma.scoreBreakdown.create({
      data: {
        simulationId: sim.id,
        round: 1,
        seoScore: 70.0,
        googleAdsScore: 80.0,
        metaAdsScore: 75.0,
        budgetScore: 90.0,
        revenueScore: 78.0,
        compositeIndex: 78.5,
        efficiencyRoi: 75.0,
        budgetDiscipline: 85.0,
        riskManagement: 80.0,
        adaptability: 70.0
      }
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scoring/breakdown',
      headers: { cookie: studentCookies }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.hasScore).toBe(true);
    expect(body.breakdown.overall).toBe(78.5);
    expect(body.breakdowns).toHaveLength(1);
    expect(body.breakdowns[0].id).toBe(breakdown.id);

    // cleanup
    await prisma.scoreBreakdown.delete({
      where: { id: breakdown.id }
    });
    await prisma.simulationState.delete({
      where: { id: sim.id }
    });
  });
});
