"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { floorStyle } from "@/components/auth-shell";
import { takePendingInvite } from "@/lib/pending-invite";
export default function AfterLoginPage() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false; // React runs effects twice in dev: only the last run decides
    async function decide() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me`, {
          credentials: "include", // send the session cookie
        });

        if (!res.ok) {
          router.replace("/login"); // 401 = not logged in
          return;
        }
        const me = await res.json();
        if (cancelled) return;
        // Came from an invite link? Go back to it (works only once, only "/invite/<id>").
        const invite = takePendingInvite();
        if (invite) {
          router.replace(invite);
          return;
        }
        router.replace(me.workspaces.length > 0 ? "/dashboard" : "/onboarding");
      } catch {
        router.replace("/login"); // backend not reachable
      }
    }
    decide();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center" style={floorStyle}>
      <div className="flex items-center gap-3 rounded-full bg-white/95 px-6 py-3 shadow-[0_8px_24px_rgba(70,50,20,0.15)]">
        <span className="h-3 w-3 rounded-full bg-[#5468d4] animate-pulse" />
        <span className="text-sm font-medium text-[#2b2620]">Signing you in…</span>
      </div>
    </main>
  );
}
// Every login ends here (email + password, Google/GitHub/42, 2FA, the verify-email link)
// We ask the backend who the user is, then send them:
//1-back to an invite, if they came from /invite/<id>
//2-to the dashboard, if they are in a workspace
//3-to onboarding, if they are not in any workspace yet