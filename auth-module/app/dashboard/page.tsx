"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { PulseIcon, btnText, floorStyle } from "@/components/auth-shell";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    //2FA is mandatory:first login -> set it up before using the app
    if (!session.user.twoFactorEnabled) {
      router.replace("/two-factor/setup");
    }
  }, [isPending, session, router]);

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
  }

  // Waiting for the session, or about to redirect
  if (isPending || !session || !session.user.twoFactorEnabled) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={floorStyle}>
        <div className="flex items-center gap-3 rounded-full bg-white/95 px-6 py-3 shadow-[0_8px_24px_rgba(70,50,20,0.15)]">
          <span className="h-3 w-3 rounded-full bg-[#5468d4] animate-pulse" />
          <span className="text-sm font-medium text-[#2b2620]">Loading…</span>
        </div>
      </main>
    );
  }

  const user = session.user;
  const initial = user.name?.charAt(0).toUpperCase() ?? "?";

  return (
    <main className="min-h-screen px-4 py-6" style={floorStyle}>
      {/* Top bar, like the office */}
      <header className="mx-auto flex max-w-4xl items-center justify-between rounded-2xl bg-white/95 px-4 py-2.5 shadow-[0_6px_20px_rgba(70,50,20,0.12)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#1f2b2a] flex items-center justify-center">
            <PulseIcon />
          </div>
          <span className="font-semibold text-[#2b2620]">Dev Pulse</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#5468d4] px-3 py-1 text-sm font-medium text-white">{user.name}</span>
          <button onClick={handleLogout} className={btnText}>
            Log out
          </button>
        </div>
      </header>

      {/* Profile card */}
      <section className="mx-auto mt-10 max-w-md rounded-[28px] bg-white/95 border border-black/5 p-8 shadow-[0_12px_40px_rgba(70,50,20,0.18)]">
        <div className="flex items-center gap-4">
          {user.image ? (
            <img src={user.image} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e6e9fb] text-xl font-semibold text-[#4355b8]">
              {initial}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-[#2b2620]">Hello, {user.name} 👋</h1>
            <p className="text-sm text-[#6b6257]">{user.email}</p>
          </div>
        </div>

        <ul className="mt-6 flex flex-col gap-2 text-sm">
          <li className="flex items-center justify-between rounded-xl bg-[#f7f1e7] px-4 py-3">
            <span className="text-[#4a433a]">Email verified</span>
            <span className={user.emailVerified ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
              {user.emailVerified ? "✓ Yes" : "✕ No"}
            </span>
          </li>
          <li className="flex items-center justify-between rounded-xl bg-[#f7f1e7] px-4 py-3">
            <span className="text-[#4a433a]">2-Step Verification</span>
            <span className="text-emerald-700 font-medium">✓ On</span>
          </li>
        </ul>
      </section>
    </main>
  );
}