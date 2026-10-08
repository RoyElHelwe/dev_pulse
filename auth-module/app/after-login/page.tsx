"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { floorStyle } from "@/components/auth-shell";

// Every login ends here (email + password, Google/GitHub/42, 2FA, the verify-email link).
// We ask the backend who the user is, then send them to the dashboard,
// or to onboarding if they are not in any workspace yet.
export default function AfterLoginPage() {
  const router = useRouter();

  useEffect(() => {
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
        router.replace(me.workspaces.length > 0 ? "/dashboard" : "/onboarding");
      } catch {
        router.replace("/login"); // backend not reachable
      }
    }
    decide();
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