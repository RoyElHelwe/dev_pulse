"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { AuthShell, FloatingInput, FormMessage, btnPrimary, btnText } from "@/components/auth-shell";

const workspaceSchema = z.string().trim().min(2, "Name must be at least 2 characters").max(50, "Name is too long");

// "my team!" -> "my-team-4f2a" (the random end keeps slugs unique)
function makeSlug(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "workspace"}-${Math.random().toString(36).slice(2, 6)}`;
}

// Users with no workspace land here (sent by /after-login).
export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isPending) return;
    if (!session) router.replace("/login");
    else if (!session.user.twoFactorEnabled) router.replace("/two-factor/setup"); // same rule as dashboard
  }, [isPending, session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const check = workspaceSchema.safeParse(name);
    if (!check.success) return setError(check.error.issues[0].message);

    setLoading(true);
    // Better Auth creates the workspace AND makes this user its owner
    const { error } = await authClient.organization.create({ name: check.data, slug: makeSlug(check.data) });
    setLoading(false);

    if (error) return setError(error.message ?? "Could not create the workspace");
    router.replace("/after-login"); // now has a workspace -> dashboard
  }

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <AuthShell title="Create your office" subtitle="You're not in a workspace yet. Create one, or ask a teammate to invite you.">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <FloatingInput id="workspace" label="Workspace name" value={name} onChange={setName} />
        <FormMessage message={error} isError />
        <div className="flex items-center justify-between mt-4">
          <button type="button" onClick={handleLogout} className={btnText}>
            Log out
          </button>
          <button type="submit" disabled={loading} className={btnPrimary}>
            {loading ? "Creating..." : "Create workspace"}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}