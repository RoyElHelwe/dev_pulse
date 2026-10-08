import { Controller, Get } from "@nestjs/common";
import { prisma } from "../lib/prisma.js";
import { CurrentUser, type AuthUser } from "../common/auth/index.js";

@Controller("auth")
export class MeController {
  /**
   * GET /auth/me -> who is logged in + their workspaces.
   * Protected by the global AuthGuard (no cookie = 401).
   * The frontend uses `workspaces` to decide: dashboard, or onboarding if empty.
   */
  @Get("me")
  async me(@CurrentUser() user: AuthUser) {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: true },
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.name,
      avatarUrl: user.image ?? null,
      workspaces: memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        role: m.role,
      })),
    };
  }
}