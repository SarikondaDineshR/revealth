import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ownerId = process.env.LOCAL_OWNER_ID ?? "00000000-0000-4000-8000-000000000001";
const ownerEmail = process.env.LOCAL_OWNER_EMAIL ?? "founder@revealth.local";
const demoWorkspaceId = process.env.DEMO_WORKSPACE_ID ?? "11111111-1111-4111-8111-111111111111";

async function main(): Promise<void> {
  await prisma.user.upsert({
    where: { id: ownerId },
    update: { email: ownerEmail, name: "Local Founder" },
    create: {
      id: ownerId,
      email: ownerEmail,
      name: "Local Founder",
    },
  });

  await prisma.workspace.upsert({
    where: { id: demoWorkspaceId },
    update: {
      ownerId,
      name: "Revealth v0.1 Demo Workspace",
      status: "active",
    },
    create: {
      id: demoWorkspaceId,
      ownerId,
      name: "Revealth v0.1 Demo Workspace",
      status: "active",
    },
  });

  await prisma.agentAssignment.deleteMany({ where: { workspaceId: demoWorkspaceId } });
  await prisma.agentMessage.deleteMany({ where: { workspaceId: demoWorkspaceId } });

  await prisma.agentAssignment.createMany({
    data: [
      {
        workspaceId: demoWorkspaceId,
        agentId: "ceo",
        role: "CEO Agent",
        currentTask: "Keeping the project aligned with owner goals",
        status: "idle",
      },
      {
        workspaceId: demoWorkspaceId,
        agentId: "product_manager",
        role: "Product Manager Agent",
        currentTask: "Planning your project",
        status: "working",
      },
      {
        workspaceId: demoWorkspaceId,
        agentId: "cto",
        role: "CTO Agent",
        currentTask: "Designing the system",
        status: "thinking",
      },
      {
        workspaceId: demoWorkspaceId,
        agentId: "engineering_manager",
        role: "Engineering Manager Agent",
        currentTask: "Breaking work into tasks",
        status: "working",
      },
      {
        workspaceId: demoWorkspaceId,
        agentId: "qa",
        role: "QA Agent",
        currentTask: "Reviewing safety",
        status: "waiting_for_approval",
      },
      {
        workspaceId: demoWorkspaceId,
        agentId: "devops",
        role: "DevOps Agent",
        currentTask: "Checking deployment boundaries",
        status: "blocked",
      },
    ],
  });

  await prisma.agentMessage.createMany({
    data: [
      {
        workspaceId: demoWorkspaceId,
        agentId: "product_manager",
        agentRole: "Product Manager Agent",
        messageType: "update",
        visibility: "client_visible",
        message: "Planning your project and preparing the next owner approval checkpoint.",
      },
      {
        workspaceId: demoWorkspaceId,
        agentId: "cto",
        agentRole: "CTO Agent",
        messageType: "decision",
        visibility: "internal",
        message: "Keeping execution in dry-run mode until the owner approves a future live-execution design.",
      },
      {
        workspaceId: demoWorkspaceId,
        agentId: "devops",
        agentRole: "DevOps Agent",
        messageType: "blocker",
        visibility: "internal",
        message: "Live deployment remains blocked by policy. Dry-run validation is safe to continue.",
      },
      {
        workspaceId: demoWorkspaceId,
        agentId: "engineering_manager",
        agentRole: "Engineering Manager Agent",
        messageType: "handoff",
        visibility: "client_visible",
        message: "Tasks are ready for review after the planning artifacts are approved.",
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
