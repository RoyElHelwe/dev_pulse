"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { InviteForm } from "@/components/invite-form";
import { PendingInvites } from "@/components/pending-invites";

type MyWorkspace = { id: string; name: string; role: string };

// /workspaces/[workspaceId]/members
export default function MembersPage() {
  const router = useRouter();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [workspace, setWorkspace] = useState<MyWorkspace | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // +1 after each invite → pending list reloads

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

  // Hiding the form is only for comfort: the backend also refuses invites from members.
  return (
    <AuthShell
      title={workspace.name}
      subtitle={canInvite ? "Invite people to your office." : "You're a member of this office."}
    >
      {canInvite ? (
        <div className="space-y-8">
          <InviteForm workspaceId={workspace.id} onInvited={() => setRefreshKey((k) => k + 1)} />
          <PendingInvites workspaceId={workspace.id} refreshKey={refreshKey} />
        </div>
      ) : (
        <p className="text-[#6b6257]">Only the owner or an admin can invite people.</p>
      )}
    </AuthShell>
  );
}