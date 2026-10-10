import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { auth } from "../src/lib/auth";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is missing");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const DEMO_PASSWORD = "Password123!";

interface DemoUser {
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Member";
}

const DEMO_USERS: DemoUser[] = [
  { name: "Alice Nguyen (Owner)", email: "owner@demo.com", role: "Owner" },
  { name: "Bob Tran (Admin)", email: "admin@demo.com", role: "Admin" },
  { name: "Charlie Le (Member)", email: "member@demo.com", role: "Member" },
  { name: "David Pham (Developer)", email: "dev@demo.com", role: "Member" },
];

async function findOrCreateUser(u: DemoUser) {
  let existing = await prisma.user.findUnique({
    where: { email: u.email },
  });

  if (!existing) {
    console.log(`Creating user: ${u.email}`);
    try {
      await auth.api.signUpEmail({
        body: {
          name: u.name,
          email: u.email,
          password: DEMO_PASSWORD,
        },
      });
      existing = await prisma.user.findUnique({
        where: { email: u.email },
      });
    } catch (err) {
      console.warn(`Sign-up via auth API failed for ${u.email}:`, err);
    }
  }

  return existing!;
}

async function main() {
  console.log("🌱 Starting seed database for Mini Jira...");

  // 1. Seed Demo Users
  type SeedUser = NonNullable<Awaited<ReturnType<typeof findOrCreateUser>>>;
  const userMap = new Map<string, SeedUser>();
  for (const u of DEMO_USERS) {
    const user = await findOrCreateUser(u);
    if (user) {
      userMap.set(u.email, user);
    }
  }

  const owner = userMap.get("owner@demo.com");
  const admin = userMap.get("admin@demo.com");
  const member = userMap.get("member@demo.com");
  const dev = userMap.get("dev@demo.com");

  if (!owner || !admin || !member || !dev) {
    throw new Error("Failed to ensure all demo users exist");
  }

  // 2. Workspace: "Acme Product Engineering"
  const workspaceName = "Acme Product Engineering";
  let workspace = await prisma.workspace.findFirst({
    where: { name: workspaceName },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        id: "ws-acme-eng",
        name: workspaceName,
        description: "Main workspace for core engineering and product delivery.",
      },
    });
    console.log(`Created workspace: ${workspace.name}`);
  }

  // 3. Memberships
  const memberships = [
    { user: owner, role: "Owner" as const },
    { user: admin, role: "Admin" as const },
    { user: member, role: "Member" as const },
    { user: dev, role: "Member" as const },
  ];

  for (const m of memberships) {
    await prisma.workspaceMember.upsert({
      where: {
        userId_workspaceId: {
          userId: m.user.id,
          workspaceId: workspace.id,
        },
      },
      update: { role: m.role },
      create: {
        id: `wm-${m.user.id}-${workspace.id}`,
        userId: m.user.id,
        workspaceId: workspace.id,
        role: m.role,
      },
    });
  }
  console.log("Workspace memberships updated.");

  // 4. Projects
  let activeProject = await prisma.project.findFirst({
    where: { workspaceId: workspace.id, name: "Mini Jira Core MVP" },
  });

  if (!activeProject) {
    activeProject = await prisma.project.create({
      data: {
        id: "proj-mini-jira-core",
        name: "Mini Jira Core MVP",
        key: "MJC",
        description: "Task tracking and workspace management platform.",
        workspaceId: workspace.id,
      },
    });
    console.log(`Created active project: ${activeProject.name}`);
  }

  // Ensure default statuses exist for active project
  const statusTodo = await prisma.status.upsert({
    where: { id: "status-proj-mini-jira-core-todo" },
    update: {},
    create: {
      id: "status-proj-mini-jira-core-todo",
      projectId: activeProject.id,
      name: "To Do",
      position: 1000,
      isDefault: true,
    },
  });

  const statusInProgress = await prisma.status.upsert({
    where: { id: "status-proj-mini-jira-core-inprogress" },
    update: {},
    create: {
      id: "status-proj-mini-jira-core-inprogress",
      projectId: activeProject.id,
      name: "In Progress",
      position: 2000,
      isDefault: false,
    },
  });

  const statusDone = await prisma.status.upsert({
    where: { id: "status-proj-mini-jira-core-done" },
    update: {},
    create: {
      id: "status-proj-mini-jira-core-done",
      projectId: activeProject.id,
      name: "Done",
      position: 3000,
      isDefault: false,
      isDone: true,
    },
  });

  // Ensure default labels exist for active project
  const defaultDemoLabels = [
    { id: "lbl-bug", name: "Bug", color: "#dc2626" },
    { id: "lbl-feat", name: "Feature", color: "#0284c7" },
    { id: "lbl-imp", name: "Improvement", color: "#0f766e" },
    { id: "lbl-doc", name: "Documentation", color: "#d97706" },
    { id: "lbl-ref", name: "Refactor", color: "#7c3aed" },
  ];
  for (const l of defaultDemoLabels) {
    await prisma.label.upsert({
      where: { id: `${l.id}-${activeProject.id}` },
      update: {},
      create: {
        id: `${l.id}-${activeProject.id}`,
        name: l.name,
        color: l.color,
        projectId: activeProject.id,
      },
    });
  }

  let archivedProject = await prisma.project.findFirst({
    where: { workspaceId: workspace.id, name: "Legacy Portal Migration" },
  });

  if (!archivedProject) {
    archivedProject = await prisma.project.create({
      data: {
        id: "proj-legacy-migration",
        name: "Legacy Portal Migration",
        key: "LPM",
        description: "Historical migration project completed in Q1.",
        workspaceId: workspace.id,
        archivedAt: new Date("2026-01-15T08:00:00Z"),
      },
    });
    console.log(`Created archived project: ${archivedProject.name}`);
  }

  // 5. Tasks for Active Project
  const sampleTasks = [
    {
      id: "task-001",
      title: "Design Responsive Navigation & Workspace Switcher",
      description: "Ensure mobile drawer and desktop sidebar switch smoothly between workspaces.",
      statusId: statusDone.id,
      priority: "High" as const,
      position: "1000.00000000000000000000",
      creatorId: owner.id,
      assigneeId: admin.id,
      dueDate: new Date("2026-09-20T17:00:00Z"),
    },
    {
      id: "task-002",
      title: "Implement Fractional Ordering for Kanban Drag & Move",
      description: "Support decimal positioning between adjacent cards to eliminate database locks during reordering.",
      statusId: statusInProgress.id,
      priority: "Urgent" as const,
      position: "1000.00000000000000000000",
      creatorId: admin.id,
      assigneeId: member.id,
      dueDate: new Date("2026-09-25T12:00:00Z"),
    },
    {
      id: "task-003",
      title: "Audit Trail Activity Logging",
      description: "Capture immutable activity records on title, status, priority, and assignee mutations.",
      statusId: statusInProgress.id,
      priority: "Medium" as const,
      position: "2000.00000000000000000000",
      creatorId: owner.id,
      assigneeId: dev.id,
      dueDate: new Date("2026-09-28T18:00:00Z"),
    },
    {
      id: "task-004",
      title: "Security Hardening & Rate Limiting Verification",
      description: "Verify rate limits on auth endpoints and CSRF checks across all Server Actions.",
      statusId: statusTodo.id,
      priority: "High" as const,
      position: "1000.00000000000000000000",
      creatorId: owner.id,
      assigneeId: admin.id,
      dueDate: new Date("2026-10-02T17:00:00Z"),
    },
    {
      id: "task-005",
      title: "PostgreSQL Search Index Optimization",
      description: "Evaluate query execution plan for task title substring search under high workspace load.",
      statusId: statusTodo.id,
      priority: "Low" as const,
      position: "2000.00000000000000000000",
      creatorId: admin.id,
      assigneeId: null,
      dueDate: null,
    },
  ];

  for (const [index, t] of sampleTasks.entries()) {
    const existingTask = await prisma.task.findUnique({ where: { id: t.id } });
    if (!existingTask) {
      const created = await prisma.task.create({
        data: {
          id: t.id,
          key: `MJC-${index + 1}`,
          title: t.title,
          description: t.description,
          statusId: t.statusId,
          priority: t.priority,
          position: t.position,
          projectId: activeProject.id,
          creatorId: t.creatorId,
          assigneeId: t.assigneeId,
          dueDate: t.dueDate,
        },
      });

      // Add initial activity
      await prisma.activity.create({
        data: {
          id: `act-${t.id}-created`,
          type: "TaskCreated",
          taskId: created.id,
          actorId: t.creatorId,
          newValue: t.title,
        },
      });

      // Add sample comment
      if (t.id === "task-002") {
        await prisma.comment.create({
          data: {
            id: "comm-001",
            content: "Fractional precision calculation is thoroughly tested with Vitest suites.",
            taskId: created.id,
            authorId: member.id,
          },
        });
      }
    }
  }
  // Giữ taskCounter khớp với seed (task tạo trực tiếp, không qua counter) —
  // chỉ nâng lên, không bao giờ hạ (idempotent khi seed chạy lại).
  const counterRow = await prisma.project.findUnique({
    where: { id: activeProject.id },
    select: { taskCounter: true },
  });
  if (counterRow && counterRow.taskCounter < sampleTasks.length) {
    await prisma.project.update({
      where: { id: activeProject.id },
      data: { taskCounter: sampleTasks.length },
    });
  }
  console.log("Sample tasks, activities and comments seeded.");

  console.log("✅ Seed completed successfully!");
  console.log("\n--- DEMO ACCOUNTS (Password: Password123!) ---");
  console.log("1. Owner:  owner@demo.com");
  console.log("2. Admin:  admin@demo.com");
  console.log("3. Member: member@demo.com");
  console.log("4. Dev:    dev@demo.com");
  console.log("----------------------------------------------\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
