import request from 'supertest';
import app from '../app';
import prisma from '../config/db';

describe('🚀 Integration Test Suite: Auth & Task RBAC flows', () => {
  let orgId: string;
  
  let adminToken: string;
  let memberToken: string;
  let nonAssigneeMemberToken: string;
  
  let adminId: string;
  let memberId: string;
  let nonAssigneeId: string;
  
  let testTaskId: string;

  const testSuffix = Math.random().toString(36).substring(2, 7);
  const orgName = `Test Org ${testSuffix}`;
  
  const adminEmail = `admin-${testSuffix}@test.com`;
  const memberEmail = `member-${testSuffix}@test.com`;
  const nonAssigneeEmail = `non-assignee-${testSuffix}@test.com`;

  // Setup: create a test Organization and 3 users (Admin, Assigned Member, Non-Assigned Member)
  beforeAll(async () => {
    // 1. Create Org
    const org = await prisma.organization.create({
      data: { name: orgName },
    });
    orgId = org.id;

    // 2. Register Admin
    const adminReg = await request(app)
      .post('/api/auth/register')
      .send({
        email: adminEmail,
        password: 'Password123!',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        organizationId: orgId,
      });
    adminId = adminReg.body.id;

    // 3. Register Member
    const memberReg = await request(app)
      .post('/api/auth/register')
      .send({
        email: memberEmail,
        password: 'Password123!',
        firstName: 'Charlie',
        lastName: 'Member',
        role: 'MEMBER',
        organizationId: orgId,
      });
    memberId = memberReg.body.id;

    // 4. Register Non-Assignee Member
    const nonAssigneeReg = await request(app)
      .post('/api/auth/register')
      .send({
        email: nonAssigneeEmail,
        password: 'Password123!',
        firstName: 'David',
        lastName: 'Member',
        role: 'MEMBER',
        organizationId: orgId,
      });
    nonAssigneeId = nonAssigneeReg.body.id;

    // 5. Login to capture tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'Password123!' });
    adminToken = adminLogin.body.accessToken;

    const memberLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: memberEmail, password: 'Password123!' });
    memberToken = memberLogin.body.accessToken;

    const nonAssigneeLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: nonAssigneeEmail, password: 'Password123!' });
    nonAssigneeMemberToken = nonAssigneeLogin.body.accessToken;
  });

  // Cleanup all records created during tests
  afterAll(async () => {
    // Clean up refresh tokens, tasks, users, and organization
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: [adminId, memberId, nonAssigneeId] } },
    });
    await prisma.task.deleteMany({
      where: { organizationId: orgId },
    });
    await prisma.user.deleteMany({
      where: { organizationId: orgId },
    });
    await prisma.organization.delete({
      where: { id: orgId },
    });
    await prisma.$disconnect();
  });

  // --- FLOW 1: Authentication & Refresh Token Rotation (RTR) ---
  describe('🔐 Flow 1: Authentication & RTR Rotation', () => {
    
    it('should block login with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: adminEmail, password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('should successfully rotate tokens and revoke old ones', async () => {
      // 1. Log in to get fresh tokens
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: adminEmail, password: 'Password123!' });
      
      const { refreshToken: rToken1 } = loginRes.body;
      expect(rToken1).toBeDefined();

      // 2. Perform first refresh (RTR rotation)
      const refreshRes1 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: rToken1 });

      expect(refreshRes1.status).toBe(200);
      expect(refreshRes1.body.accessToken).toBeDefined();
      expect(refreshRes1.body.refreshToken).toBeDefined();

      const { refreshToken: rToken2 } = refreshRes1.body;

      // 3. Attempt to reuse the first revoked refresh token (RTR theft detection!)
      const reuseRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: rToken1 });

      expect(reuseRes.status).toBe(401);

      // 4. Verify that the second rotated token is now also invalidated due to theft detection!
      const rotatedRevokedRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: rToken2 });

      expect(rotatedRevokedRes.status).toBe(401);
    });
  });

  // --- FLOW 2: RBAC Gates & Task State Transitions ---
  describe('🛡️ Flow 2: RBAC Gating & Task State Transitions', () => {
    
    it('should block a MEMBER from creating a task', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);

      const res = await request(app)
        .post('/api/api/tasks') // standard path prefix is /api/tasks (app mounts /api, routes mount /tasks -> /api/tasks)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Member Spurred Task',
          dueDate: tomorrow.toISOString(),
        });

      // The base app router binds routes under /api, so it should be /api/tasks
      const realRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Member Spurred Task',
          dueDate: tomorrow.toISOString(),
        });

      expect(realRes.status).toBe(403);
      expect(realRes.body.code).toBe('FORBIDDEN');
    });

    it('should allow ADMIN/MANAGER to create a task', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);

      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Optimize Database Sharding',
          description: 'Analyze shard keys.',
          priority: 'HIGH',
          assigneeId: memberId,
          dueDate: tomorrow.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Optimize Database Sharding');
      expect(res.body.status).toBe('TODO');
      testTaskId = res.body.id;
    });

    it('should allow task assignee to advance status legally (TODO -> IN_PROGRESS)', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_PROGRESS');
    });

    it('should reject invalid state transitions (IN_PROGRESS -> DONE)', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'DONE' }); // Must go to IN_REVIEW first!

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.message).toContain('Invalid status transition');
    });

    it('should block non-assignee MEMBER from advancing status', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${nonAssigneeMemberToken}`)
        .send({ status: 'IN_REVIEW' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });
});
