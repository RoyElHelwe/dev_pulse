"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { authClient } from "@/lib/auth-client";

// First login only: every user must set up 2FA before using the app.
//   (password, only for email accounts) -> scan QR -> type code -> save backup codes -> dashboard
type Step = "loading" | "password" | "scan" | "codes";

export default function TwoFactorSetupPage() {
  const router = useRouter();
  const { data: session, isPending, refetch } = authClient.useSession();

  const [step, setStep] = useState<Step>("loading");
  const [password, setPassword] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false); // React runs effects twice in dev: only start once

  // Create the secret on the server and get the QR code + backup codes
  async function startSetup(pwd?: string) {
	setError("");
	setLoading(true);
	const { data, error } = await authClient.twoFactor.enable({
	  ...(pwd ? { password: pwd } : {}),
	  method: "totp",
	} as { password: string; method: "totp" });
	setLoading(false);

	if (error || !data || !("totpURI" in data)) {
	  setError(error?.message ?? "Could not start 2FA setup");
	  return;
	}
	setTotpURI(data.totpURI);
	setBackupCodes(data.backupCodes);
	setPassword("");
	setStep("scan");
  }

  useEffect(() => {
	if (isPending) return;
	if (!session) {
	  router.replace("/login");
	  return;
	}
	if (session.user.twoFactorEnabled && step !== "codes") {
	  router.replace("/dashboard"); // already set up
	  return;
	}
	if (started.current) return;
	started.current = true;

	// Google / GitHub / 42 accounts have no password -> start right away.
	// Email accounts must confirm their password first (Better Auth rule).
	authClient.listAccounts().then(({ data }) => {
	  const hasPassword = !!data?.some((a) => a.providerId === "credential");
	  if (hasPassword) setStep("password");
	  else startSetup();
	});
	// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, session, router, step]);

  async function confirmCode() {
	setError("");
	if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code from your app");
	setLoading(true);
	const { error } = await authClient.twoFactor.verifyTotp({ code: code.trim() });
	setLoading(false);
	if (error) return setError(error.message ?? "Wrong code, try again");

	setCode("");
	setStep("codes"); // 2FA is now on; show backup codes once
  }

  async function finish() {
	await refetch();
	router.replace("/dashboard");
  }

  return (
	<main className="min-h-screen bg-[#f0f4f9] flex items-center justify-center px-4">
	  <div className="w-full max-w-md bg-white rounded-[28px] shadow-sm p-8 flex flex-col gap-4 text-gray-900">
		<h1 className="text-2xl font-normal">Set up 2-Step Verification</h1>

		{step === "loading" && <p className="text-gray-600">Preparing your QR code...</p>}

		{step === "password" && (
		  <>
			<p className="text-sm text-gray-600">
			  2FA is required for every account. Confirm your password to continue.
			</p>
			<input
			  type="password"
			  value={password}
			  onChange={(e) => setPassword(e.target.value)}
			  placeholder="Your password"
			  className="w-full rounded-md border border-gray-400 px-3 py-2 outline-none focus:border-teal-600"
			/>
			<button
			  onClick={() => (password ? startSetup(password) : setError("Enter your password"))}
			  disabled={loading}
			  className="bg-teal-600 text-white rounded-full py-2.5 text-sm disabled:opacity-60"
			>
			  {loading ? "Please wait..." : "Continue"}
			</button>
		  </>
		)}

		{step === "scan" && (
		  <>
			<p className="text-sm text-gray-600">
			  2FA is required for every account. Scan this QR code with Google
			  Authenticator (or Authy), then enter the 6-digit code it shows.
			</p>
			<div className="bg-white p-3 self-center border rounded-lg">
			  {/* drawn in the browser: the URI contains the secret, never send it anywhere */}
			  <QRCode value={totpURI} size={180} />
			</div>
			<input
			  value={code}
			  onChange={(e) => setCode(e.target.value)}
			  placeholder="123456"
			  inputMode="numeric"
			  autoComplete="one-time-code"
			  maxLength={6}
			  className="w-full rounded-md border border-gray-400 px-3 py-3 text-xl text-center tracking-[0.3em] outline-none focus:border-teal-600"
			/>
			<button
			  onClick={confirmCode}
			  disabled={loading}
			  className="bg-teal-600 text-white rounded-full py-2.5 text-sm disabled:opacity-60"
			>
			  {loading ? "Checking..." : "Confirm"}
			</button>
		  </>
		)}

		{step === "codes" && (
		  <>
			<p className="text-sm text-gray-700">
			  ✅ 2FA is on. Save these backup codes somewhere safe. Each one works{" "}
			  <b>once</b> if you lose your phone. You won&apos;t see them again.
			</p>
			<ul className="grid grid-cols-2 gap-1 font-mono text-sm bg-gray-50 rounded p-3">
			  {backupCodes.map((c) => (
				<li key={c}>{c}</li>
			  ))}
			</ul>
			<button
			  onClick={() => navigator.clipboard.writeText(backupCodes.join("\n"))}
			  className="border rounded-full py-2 text-sm"
			>
			  Copy codes
			</button>
			<button onClick={finish} className="bg-teal-600 text-white rounded-full py-2.5 text-sm">
			  I saved them, continue
			</button>
		  </>
		)}

		{error && <p className="text-sm text-red-700">⚠ {error}</p>}
	  </div>
	</main>
  );
}