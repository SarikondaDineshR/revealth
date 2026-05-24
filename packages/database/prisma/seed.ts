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
      name: "Harbor & Pine CRM Showcase",
      status: "active",
    },
    create: {
      id: demoWorkspaceId,
      ownerId,
      name: "Harbor & Pine CRM Showcase",
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
        currentTask: "Keeping the CRM demo focused on approval-gated progress",
        status: "idle",
      },
      {
        workspaceId: demoWorkspaceId,
        agentId: "product_manager",
        role: "Product Manager Agent",
        currentTask: "Organizing CRM requirements for broker workflows",
        status: "working",
      },
      {
        workspaceId: demoWorkspaceId,
        agentId: "cto",
        role: "CTO Agent",
        currentTask: "Checking data boundaries before technical planning",
        status: "thinking",
      },
      {
        workspaceId: demoWorkspaceId,
        agentId: "engineering_manager",
        role: "Engineering Manager Agent",
        currentTask: "Dividing lead tracking, notes, and reminders into work packages",
        status: "working",
      },
      {
        workspaceId: demoWorkspaceId,
        agentId: "qa",
        role: "QA Agent",
        currentTask: "Reviewing client-data and approval risks",
        status: "waiting_for_approval",
      },
      {
        workspaceId: demoWorkspaceId,
        agentId: "devops",
        role: "DevOps Agent",
        currentTask: "Keeping execution dry-run only",
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
        message: "The CRM plan is organized around contacts, showing notes, reminders, and broker reporting.",
      },
      {
        workspaceId: demoWorkspaceId,
        agentId: "cto",
        agentRole: "CTO Agent",
        messageType: "decision",
        visibility: "internal",
        message: "Architecture review stays in planning mode. No repository mutation or external integrations are allowed.",
      },
      {
        workspaceId: demoWorkspaceId,
        agentId: "devops",
        agentRole: "DevOps Agent",
        messageType: "blocker",
        visibility: "internal",
        message: "Risk detected: production deployment and external communication remain blocked by policy.",
      },
      {
        workspaceId: demoWorkspaceId,
        agentId: "engineering_manager",
        agentRole: "Engineering Manager Agent",
        messageType: "handoff",
        visibility: "client_visible",
        message: "Handoff complete: the team is ready to review CRM tasks after the owner approves the next checkpoint.",
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
