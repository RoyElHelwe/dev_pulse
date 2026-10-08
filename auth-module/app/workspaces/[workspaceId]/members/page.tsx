"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { InviteForm } from "@/components/invite-form";

type MyWorkspace = { id: string; name: string; role: string };

// /workspaces/[workspaceId]/members
export default function MembersPage() {
  const router = useRouter();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [workspace, setWorkspace] = useState<MyWorkspace | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me`, { credentials: "include" });
      if (!res.ok) return router.replace("/login");

      const me: { workspaces: MyWorkspace[] } = await res.json();
      const ws = me.workspaces.find((w) => w.id === workspaceId);
      if (!ws) return router.replace("/after-login"); // not a member of this workspace
      setWorkspace(ws);
    }
    load().catch(() => router.replace("/login"));
  }, [workspaceId, router]);

  if (!workspace) return null; // loading

  // Better Auth can store several roles as "admin,member"
  const roles = workspace.role.split(",").map((r) => r.trim());
  const canInvite = roles.includes("owner") || roles.includes("admin");

  return (
    <AuthShell title={workspace.name} subtitle="Invite people to your office.">
      {canInvite ? (
        <InviteForm workspaceId={workspace.id} />
      ) : (
        <p className="text-[#6b6257]">Only the owner or an admin can invite people.</p>
      )}
    </AuthShell>
  );
}