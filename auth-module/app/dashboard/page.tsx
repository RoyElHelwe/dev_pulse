"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { TwoFactorSettings } from "./two-factor-settings";

export default function DashboardPage() {
  const router = useRouter();

  const { data: session, isPending, refetch } = authClient.useSession();

  useEffect(() => {
	if (!isPending && !session) {
	  router.push("/login");
	}
  }, [isPending, session, router]);

  async function handleLogout() {
	await authClient.signOut();
	router.push("/login");
  }

  if (isPending) {
	return <p className="text-center mt-20">Loading...</p>;
  }

  if (!session) {
	return null;
  }

  return (
	<div className="flex flex-col gap-3 max-w-sm mx-auto mt-20">
	  <h1 className="text-2xl font-bold">Dashboard</h1>

	  <p>Hello, <b>{session.user.name}</b> 👋</p>
	  <p>Email: {session.user.email}</p>
	  <p>Email verified: {session.user.emailVerified ? "✅ yes" : "❌ no"}</p>
	  {/* NEW */}
	  <p>2FA: {session.user.twoFactorEnabled ? "✅ on" : "❌ off"}</p>

	  {}
	  <TwoFactorSettings
		enabled={!!session.user.twoFactorEnabled}
		onChange={() => refetch()}
	  />

	  <button onClick={handleLogout} className="bg-red-600 text-white p-2">
		Logout
	  </button>
	</div>
  );
}
