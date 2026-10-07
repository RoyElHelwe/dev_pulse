import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "./lib/prisma.js";

if (process.env.NODE_ENV === "production") {
  console.error("Seed is for development only");
  process.exit(1);
}

const PASSWORD = "Password123!";
const WORKSPACE_SLUG = "test-workspace";

const USERS = [
  { name: "Alice", email: "alice@test.com", role: "owner" },
  { name: "Bob", email: "bob@test.com", role: "admin" },
  { name: "Carol", email: "carol@test.com", role: "member" },
  { name: "Dave", email: "dave@test.com", role: null }, // not in the workspace
];

async function main() {
  // Start clean, so the seed can run again (cascade deletes their accounts and memberships)
  await prisma.user.deleteMany({ where: { email: { in: USERS.map((u) => u.email) } } });
  await prisma.workspace.deleteMany({ where: { slug: WORKSPACE_SLUG } });

  // Same hash function Better Auth uses, so normal login works
  const passwordHash = await hashPassword(PASSWORD);

  const workspace = await prisma.workspace.create({
    data: { id: randomUUID(), name: "Test Workspace", slug: WORKSPACE_SLUG, createdAt: new Date() },
  });

  for (const u of USERS) {
    const userId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        name: u.name,
        email: u.email,
        emailVerified: true, // skip the verify-email step
        accounts: {
          // "credential" = email + password login in Better Auth
          create: { id: randomUUID(), accountId: userId, providerId: "credential", password: passwordHash },
        },
      },
    });

    if (u.role) {
      await prisma.workspaceMember.create({
        data: { id: randomUUID(), workspaceId: workspace.id, userId, role: u.role, createdAt: new Date() },
      });
    }
  }

  console.log(`Workspace id: ${workspace.id}`);
  console.log(`Users (password ${PASSWORD}): alice=owner, bob=admin, carol=member, dave=not a member`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());