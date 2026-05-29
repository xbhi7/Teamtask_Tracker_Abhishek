import { PrismaClient, Role, Priority, TaskStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clean existing data
  await prisma.refreshToken.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});

  console.log('🧹 Cleaned existing database records.');

  // 2. Create Organization
  const org = await prisma.organization.create({
    data: {
      name: 'Acme Corp',
    },
  });
  console.log(`🏢 Created Organization: ${org.name} (${org.id})`);

  // 3. Create Users with hashed passwords
  const adminPasswordHash = await bcrypt.hash('AdminPass123!', 10);
  const managerPasswordHash = await bcrypt.hash('ManagerPass123!', 10);
  const memberPasswordHash = await bcrypt.hash('MemberPass123!', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@acme.com',
      passwordHash: adminPasswordHash,
      firstName: 'Alice',
      lastName: 'Admin',
      role: Role.ADMIN,
      organizationId: org.id,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@acme.com',
      passwordHash: managerPasswordHash,
      firstName: 'Bob',
      lastName: 'Manager',
      role: Role.MANAGER,
      organizationId: org.id,
    },
  });

  const member1 = await prisma.user.create({
    data: {
      email: 'member1@acme.com',
      passwordHash: memberPasswordHash,
      firstName: 'Charlie',
      lastName: 'Member',
      role: Role.MEMBER,
      organizationId: org.id,
    },
  });

  const member2 = await prisma.user.create({
    data: {
      email: 'member2@acme.com',
      passwordHash: memberPasswordHash,
      firstName: 'David',
      lastName: 'Member',
      role: Role.MEMBER,
      organizationId: org.id,
    },
  });

  console.log('👥 Created Users:');
  console.log(`   - ADMIN: ${admin.email} (Alice Admin)`);
  console.log(`   - MANAGER: ${manager.email} (Bob Manager)`);
  console.log(`   - MEMBER 1: ${member1.email} (Charlie Member)`);
  console.log(`   - MEMBER 2: ${member2.email} (David Member)`);

  // 4. Create Projects
  const projectAlpha = await prisma.project.create({
    data: {
      name: 'Project Alpha',
      description: 'First key initiative for organizational digital transformation.',
      organizationId: org.id,
    },
  });

  const projectBeta = await prisma.project.create({
    data: {
      name: 'Project Beta',
      description: 'Infrastructure scaling and developer experience improvements.',
      organizationId: org.id,
    },
  });

  console.log(`📂 Created Projects: ${projectAlpha.name}, ${projectBeta.name}`);

  // 5. Create Tasks
  const today = new Date();
  
  const tasksData = [
    {
      title: 'Database Indexing Optimization',
      description: 'Implement specific indexes for status, assignee, and due date query parameters to optimize list loads.',
      priority: Priority.HIGH,
      status: TaskStatus.TODO,
      assigneeId: member1.id,
      creatorId: manager.id,
      projectId: projectAlpha.id,
      dueDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days in future
      organizationId: org.id,
    },
    {
      title: 'Refresh Token Rotation Implementation',
      description: 'Implement access token and refresh token rotation middleware with reuse detection for security compliance.',
      priority: Priority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      assigneeId: member1.id,
      creatorId: admin.id,
      projectId: projectAlpha.id,
      dueDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days in future
      organizationId: org.id,
    },
    {
      title: 'Redis Caching for Task Lists',
      description: 'Design and verify cache invalidation strategy for tasks:assignee:<id> cached lists on mutations.',
      priority: Priority.MEDIUM,
      status: TaskStatus.IN_REVIEW,
      assigneeId: member2.id,
      creatorId: manager.id,
      projectId: projectBeta.id,
      dueDate: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days in future
      organizationId: org.id,
    },
    {
      title: 'Setup Initial Dev Containers',
      description: 'Create docker-compose.yml and Dockerfiles for frontend, backend, redis, and postgres services.',
      priority: Priority.LOW,
      status: TaskStatus.DONE,
      assigneeId: member2.id,
      creatorId: admin.id,
      projectId: projectBeta.id,
      dueDate: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), // Overdue by 1 day (completed, but set past due date for testing)
      organizationId: org.id,
    },
    {
      title: 'Design UI Dashboard Wireframes',
      description: 'Draft the visual mockups and layout structure for the dark-mode glassmorphic frontend board.',
      priority: Priority.MEDIUM,
      status: TaskStatus.DONE,
      assigneeId: member1.id,
      creatorId: manager.id,
      projectId: projectAlpha.id,
      dueDate: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days in past
      organizationId: org.id,
    },
    {
      title: 'Write API Integration Tests',
      description: 'Draft end-to-end integration tests using Supertest and Jest to verify auth and RBAC middleware routes.',
      priority: Priority.HIGH,
      status: TaskStatus.BLOCKED,
      assigneeId: member1.id,
      creatorId: manager.id,
      projectId: projectAlpha.id,
      dueDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day in future
      organizationId: org.id,
    },
    {
      title: 'Overdue Task Demo Task',
      description: 'An incomplete task with a past due date to verify the Analytics overdue task counters.',
      priority: Priority.HIGH,
      status: TaskStatus.TODO,
      assigneeId: member2.id,
      creatorId: manager.id,
      projectId: projectAlpha.id,
      dueDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), // Overdue by 2 days
      organizationId: org.id,
    }
  ];

  for (const t of tasksData) {
    const task = await prisma.task.create({ data: t });
    console.log(`   📌 Created Task: "${task.title}" -> Assignee: ${t.assigneeId === member1.id ? 'Charlie' : 'David'} (${task.status})`);
  }

  console.log('✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
