"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { authClient } from "@/lib/auth-client";

type Step = "idle" | "scan" | "codes";

export function TwoFactorSettings({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: () => void;
}) {
  const [step, setStep] = useState<Step>("idle");
  const [hasPassword, setHasPassword] = useState(true);
  const [password, setPassword] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
	authClient.listAccounts().then(({ data }) => {
	  if (data) setHasPassword(data.some((a) => a.providerId === "credential"));
	});
  }, []);

  function passwordBody() {
	return (hasPassword ? { password } : {}) as { password: string };
  }

  //1: create the secret on the server get the QR code + backup codes
  async function startEnable() {
	setError("");
	if (hasPassword && !password) return setError("Enter your password");
	setLoading(true);
	const { data, error } = await authClient.twoFactor.enable({
	  ...passwordBody(),
	  method: "totp", // authenticator app (not email codes)
	});
	setLoading(false);
	if (error || !data || !("totpURI" in data)) {
	  return setError(error?.message ?? "Could not start 2FA setup");
	}

	setTotpURI(data.totpURI);
	setBackupCodes(data.backupCodes);
	setPassword("");
	setStep("scan");
  }

  //2: user typed the code from their app -> 2FA becomes active
  async function confirmCode() {
	setError("");
	if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code from your app");
	setLoading(true);
	const { error } = await authClient.twoFactor.verifyTotp({ code: code.trim() });
	setLoading(false);
	if (error) return setError(error.message ?? "Wrong code, try again");

	setCode("");
	setStep("codes");
	onChange();
  }

  async function disable() {
	setError("");
	if (hasPassword && !password) return setError("Enter your password");
	setLoading(true);
	const { error } = await authClient.twoFactor.disable(passwordBody());
	setLoading(false);
	if (error) return setError(error.message ?? "Could not turn off 2FA");

	setPassword("");
	onChange();
  }

  //get a fresh set of backup codes
  async function regenerateCodes() {
	setError("");
	if (hasPassword && !password) return setError("Enter your password");
	setLoading(true);
	const { data, error } = await authClient.twoFactor.generateBackupCodes(passwordBody());
	setLoading(false);
	if (error || !data) return setError(error?.message ?? "Could not create backup codes");

	setBackupCodes(data.backupCodes);
	setPassword("");
	setStep("codes");
  }

  const passwordInput = hasPassword && (
	<input
	  type="password"
	  value={password}
	  onChange={(e) => setPassword(e.target.value)}
	  placeholder="Your password"
	  className="w-full rounded-md border border-gray-400 px-3 py-2 outline-none focus:border-teal-600"
	/>
  );

  return (
	<div className="border rounded-xl p-4 flex flex-col gap-3">
	  <h2 className="font-semibold">Two-factor authentication</h2>

	  {}
	  {step === "codes" && (
		<>
		  <p className="text-sm text-gray-700">
			Save these backup codes somewhere safe. Each one works <b>once</b> if you
			lose your phone. You won&apos;t see them again.
		  </p>
		  <ul className="grid grid-cols-2 gap-1 font-mono text-sm bg-gray-50 rounded p-3">
			{backupCodes.map((c) => (
			  <li key={c}>{c}</li>
			))}
		  </ul>
		  <button
			onClick={() => navigator.clipboard.writeText(backupCodes.join("\n"))}
			className="border rounded p-2 text-sm"
		  >
			Copy codes
		  </button>
		  <button onClick={() => setStep("idle")} className="bg-teal-600 text-white rounded p-2 text-sm">
			I saved them
		  </button>
		</>
	  )}

	  {/* ---- Scan QR code + confirm ---- */}
	  {step === "scan" && (
		<>
		  <p className="text-sm text-gray-700">
			Scan this with Google Authenticator, Authy, or any authenticator app,
			then enter the 6-digit code it shows.
		  </p>
		  <div className="bg-white p-3 self-center">
			{/* QR is drawn in the browser: the URI contains the secret, never send it anywhere */}
			<QRCode value={totpURI} size={180} />
		  </div>
		  <input
			value={code}
			onChange={(e) => setCode(e.target.value)}
			placeholder="123456"
			inputMode="numeric"
			maxLength={6}
			className="w-full rounded-md border border-gray-400 px-3 py-2 text-center tracking-[0.3em] outline-none focus:border-teal-600"
		  />
		  <button
			onClick={confirmCode}
			disabled={loading}
			className="bg-teal-600 text-white rounded p-2 text-sm disabled:opacity-60"
		  >
			{loading ? "Checking..." : "Confirm and turn on"}
		  </button>
		  <button onClick={() => setStep("idle")} className="text-sm text-gray-600">
			Cancel
		  </button>
		</>
	  )}

	  {}
	  {step === "idle" && !enabled && (
		<>
		  <p className="text-sm text-gray-700">
			Add a second step at sign-in using an authenticator app.
		  </p>
		  {passwordInput}
		  <button
			onClick={startEnable}
			disabled={loading}
			className="bg-teal-600 text-white rounded p-2 text-sm disabled:opacity-60"
		  >
			{loading ? "Please wait..." : "Turn on 2FA"}
		  </button>
		</>
	  )}

	  {}
	  {step === "idle" && enabled && (
		<>
		  <p className="text-sm text-gray-700">2FA is on for your account.</p>
		  {passwordInput}
		  <div className="flex gap-2">
			<button
			  onClick={regenerateCodes}
			  disabled={loading}
			  className="flex-1 border rounded p-2 text-sm disabled:opacity-60"
			>
			  New backup codes
			</button>
			<button
			  onClick={disable}
			  disabled={loading}
			  className="flex-1 bg-gray-800 text-white rounded p-2 text-sm disabled:opacity-60"
			>
			  Turn off 2FA
			</button>
		  </div>
		</>
	  )}

	  {error && <p className="text-sm text-red-700">⚠ {error}</p>}
	</div>
  );
}
