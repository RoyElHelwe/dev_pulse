"use client";
//
// Cases:
//not logged in→ Log in/ Create account(we remember this link)
//logged in, wrong email → This invite is for another email + log out button
//expired/revoked/used → This invite is no longer valid
//already a member → Go to the workspace
//logged in, right email → alice invited you to Team A as member + Join / Decline
//The real checks are on the backend (Better Auth organization plugin):
//getInvitation    → 401 not logged in, 403 not your email, 400 not pending / expired
// acceptInvitation → checks again, then adds the workspaceMember row

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { authClient } from "@/lib/auth-client";
import { clearPendingInvite, savePendingInvite } from "@/lib/pending-invite";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

const primaryBtn =
  "flex-1 rounded-xl bg-[#5468d4] px-4 py-3 font-medium text-white transition hover:bg-[#4457c0] disabled:opacity-50";
const secondaryBtn =
  "flex-1 rounded-xl border border-[#d9d1c4] bg-white px-4 py-3 font-medium text-[#2b2620] transition hover:bg-[#f6f2ea] disabled:opacity-50";

type Invite = {
  id: string;
  email: string;
  role: string;
  expiresAt: string | Date;
  organizationId: string; //the API still says "organization", the DB says workspace
  organizationName: string;
  inviterEmail: string;
};

type View =
  | { kind: "loading" }
  | { kind: "logged-out" }
  | { kind: "wrong-email"; myEmail: string }
  | { kind: "invalid" }
  | { kind: "already-member"; workspaceId: string; workspaceName: string }
  | { kind: "ready"; invite: Invite }
  | { kind: "declined" };

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const invitePath = `/invite/${token}`;

  const load = useCallback(async () => {
    //Logged in?
    const { data: session } = await authClient.getSession();
    if (!session) {
      setView({ kind: "logged-out" });
      return;
    }
    clearPendingInvite(); // we're here now, no need to come back
    //Read the invitation (the backend checks the email for us)
    const { data, error } = await authClient.organization.getInvitation({
      query: { id: token },
    });
    if (error || !data) {
      if (error?.status === 401) setView({ kind: "logged-out" });
      else if (error?.status === 403) setView({ kind: "wrong-email", myEmail: session.user.email });
      else setView({ kind: "invalid" }); //expired, revoked, already used, bad id
      return;
    }
    const invite = data as unknown as Invite;
    //already a member of this workspace?
    const meRes = await fetch(`${BACKEND}/auth/me`, { credentials: "include" });
    if (meRes.ok) {
      const me: { workspaces: { id: string; name: string }[] } = await meRes.json();
      const ws = me.workspaces.find((w) => w.id === invite.organizationId);
      if (ws) {
        setView({ kind: "already-member", workspaceId: ws.id, workspaceName: ws.name });
        return;
      }
    }

    setView({ kind: "ready", invite });
  }, [token]);

  useEffect(() => {
    load().catch(() => setView({ kind: "invalid" }));
  }, [load]);

  //not logged in: remember this link, then go log in / sign up.
  // /after-login will bring the user back here.
  function goAuth(path: "/login" | "/register") {
    savePendingInvite(invitePath);
    router.push(path);
  }
  async function switchAccount() {
    setBusy(true);
    await authClient.signOut();
    savePendingInvite(invitePath);
    window.location.href = "/login"; // full reload: fresh session state
  }

  async function accept(invite: Invite) {
    setBusy(true);
    setActionError(null);
    const { error } = await authClient.organization.acceptInvitation({
      invitationId: invite.id,
    });
    if (error) {
      setBusy(false);
      setActionError(error.message ?? "Could not join the workspace.");
      return;
    }
    //full reload so every page sees the new membership
    window.location.href = `/workspaces/${invite.organizationId}/members`;
  }

  async function decline(invite: Invite) {
    setBusy(true);
    setActionError(null);
    const { error } = await authClient.organization.rejectInvitation({
      invitationId: invite.id,
    });
    setBusy(false);
    if (error) {
      setActionError(error.message ?? "Could not decline the invite.");
      return;
    }
    setView({ kind: "declined" });
  }

  if (view.kind === "loading") {
    return (
      <AuthShell title="Invitation" subtitle="Loading the invitation…">
        <div className="h-3 w-3 rounded-full bg-[#5468d4] animate-pulse" />
      </AuthShell>
    );
  }

  if (view.kind === "logged-out") {
    return (
      <AuthShell title="You're invited" subtitle="Someone invited you to their office.">
        <div className="space-y-5">
          <p className="text-[#6b6257]">
            Log in or create an account <b className="text-[#2b2620]">with the email this invite was sent to</b>.
            You&apos;ll come back here after.
          </p>
          <div className="flex gap-3">
            <button className={primaryBtn} onClick={() => goAuth("/login")}>Log in</button>
            <button className={secondaryBtn} onClick={() => goAuth("/register")}>Create account</button>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (view.kind === "wrong-email") {
    return (
      <AuthShell title="Wrong account" subtitle="This invite was sent to another email.">
        <div className="space-y-5">
          <p className="text-[#6b6257]">
            You&apos;re logged in as <b className="text-[#2b2620]">{view.myEmail}</b>. Log out and use the
            invited account.
          </p>
          <div className="flex">
            <button className={primaryBtn} disabled={busy} onClick={switchAccount}>
              Log out and switch account
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (view.kind === "invalid") {
    return (
      <AuthShell title="Invite not valid" subtitle="It expired, was revoked, or was already used.">
        <div className="space-y-5">
          <p className="text-[#6b6257]">Ask the person who invited you for a new one.</p>
          <div className="flex">
            <button className={secondaryBtn} onClick={() => router.push("/after-login")}>
              Go to my account
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (view.kind === "already-member") {
    return (
      <AuthShell title={view.workspaceName} subtitle="You're already a member of this office.">
        <div className="flex">
          <button className={primaryBtn} onClick={() => router.push(`/workspaces/${view.workspaceId}/members`)}>
            Go to the workspace
          </button>
        </div>
      </AuthShell>
    );
  }

  if (view.kind === "declined") {
    return (
      <AuthShell title="Invite declined" subtitle="You won't join this office.">
        <div className="flex">
          <button className={secondaryBtn} onClick={() => router.push("/after-login")}>
            Go to my account
          </button>
        </div>
      </AuthShell>
    );
  }

  // view.kind === "ready"
  const invite = view.invite;
  return (
    <AuthShell title={`Join ${invite.organizationName}`} subtitle="You've been invited to an office.">
      <div className="space-y-5">
        <p className="text-[#6b6257]">
          <b className="text-[#2b2620]">{invite.inviterEmail}</b> invited you as{" "}
          <b className="text-[#2b2620]">{invite.role}</b>.
        </p>
        <p className="text-sm text-[#6b6257]">Valid until {new Date(invite.expiresAt).toLocaleString()}</p>
        {actionError && <p className="text-sm text-red-600">{actionError}</p>}
        <div className="flex gap-3">
          <button className={primaryBtn} disabled={busy} onClick={() => accept(invite)}>
            {busy ? "Joining…" : "Join"}
          </button>
          <button className={secondaryBtn} disabled={busy} onClick={() => decline(invite)}>
            Decline
          </button>
        </div>
      </div>
    </AuthShell>
  );
}