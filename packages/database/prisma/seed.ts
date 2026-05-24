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
