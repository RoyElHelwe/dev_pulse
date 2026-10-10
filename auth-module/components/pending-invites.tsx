"use client";
import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string | Date;
};

type Props = {
  workspaceId: string;
  refreshKey?: number; // the page increases it after a new invite → list reloads
};

export function PendingInvites({ workspaceId, refreshKey = 0 }: Props) {
  const [invites, setInvites] = useState<Invitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await authClient.organization.listInvitations({
      query: { organizationId: workspaceId },
    });
    if (error) {
      setError(error.message ?? "Could not load the invites.");
      return;
    }
    // The DB keeps old rows (accepted, canceled...). Expired ones stay "pending",
    // so we also check the date.
    const now = Date.now();
    const pending = ((data ?? []) as Invitation[]).filter(
      (i) => i.status === "pending" && new Date(i.expiresAt).getTime() > now,
    );
    setInvites(pending);
    setError(null);
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function copyLink(id: string) {
    const link = `${window.location.origin}/invite/${id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    } catch {
      // clipboard blocked: show the link so it can be copied by hand
      window.prompt("Copy this invite link:", link);
    }
  }

  async function revoke(inv: Invitation) {
    if (!window.confirm(`Revoke the invite for ${inv.email}?`)) return;
    setBusyId(inv.id);
    const { error } = await authClient.organization.cancelInvitation({
      invitationId: inv.id,
    });
    setBusyId(null);
    if (error) {
      setError(error.message ?? "Could not revoke the invite.");
      return;
    }
    load();
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[#2b2620]">Pending invites</h2>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {invites === null && !error && <p className="text-sm text-[#6b6257]">Loading…</p>}
      {invites?.length === 0 && <p className="text-sm text-[#6b6257]">No pending invites.</p>}

      {invites && invites.length > 0 && (
        <ul className="divide-y divide-[#ece5d9] rounded-xl border border-[#d9d1c4] bg-white">
          {invites.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[#2b2620]">{inv.email}</p>
                <p className="text-xs text-[#6b6257]">
                  {inv.role} · expires {new Date(inv.expiresAt).toLocaleString()}
                </p>
              </div>
              <button
                className="rounded-lg border border-[#d9d1c4] px-3 py-1.5 text-sm font-medium text-[#2b2620] transition hover:bg-[#f6f2ea]"
                onClick={() => copyLink(inv.id)}
              >
                {copiedId === inv.id ? "Copied!" : "Copy link"}
              </button>
              <button
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                disabled={busyId === inv.id}
                onClick={() => revoke(inv)}
              >
                {busyId === inv.id ? "Revoking…" : "Revoke"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
//pending invites list + Revoke + Copy link.
//shown on the members page, only to owner / admin
//copy link is safe: the link only works for an account with the invited email
//it's also the backup for the evaluation (no email needed)