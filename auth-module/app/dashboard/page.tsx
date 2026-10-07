"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
	if (isPending) return;
	if (!session) {
	  router.replace("/login");
	  return;
	}
	// 2FA is mandatory: first login -> set it up before using the app
	if (!session.user.twoFactorEnabled) {
	  router.replace("/two-factor/setup");
	}
  }, [isPending, session, router]);

  async function handleLogout() {
	await authClient.signOut();
	router.push("/login");
  }

  if (isPending || !session || !session.user.twoFactorEnabled) {
	return <p className="text-center mt-20">Loading...</p>;
  }

  return (
	<div className="flex flex-col gap-3 max-w-sm mx-auto mt-20">
	  <h1 className="text-2xl font-bold">Dashboard</h1>

	  <p>Hello, <b>{session.user.name}</b> 👋</p>
	  <p>Email: {session.user.email}</p>
	  <p>Email verified: {session.user.emailVerified ? "✅ yes" : "❌ no"}</p>
	  <p>2FA: ✅ on</p>

	  <button onClick={handleLogout} className="bg-red-600 text-white p-2">
		Logout
	  </button>
	</div>
  );
}