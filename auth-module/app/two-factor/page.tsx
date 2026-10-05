"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";

const totpSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your app");
const backupSchema = z.string().min(6, "Enter one of your backup codes");

export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
	e.preventDefault();
	setMessage("");

	const clean = code.trim();
	const check = (useBackup ? backupSchema : totpSchema).safeParse(clean);
	if (!check.success) {
	  setMessage(check.error.issues[0].message);
	  return;
	}

	setLoading(true);
	const { error } = useBackup
	  ? await authClient.twoFactor.verifyBackupCode({ code: clean, trustDevice })
	  : await authClient.twoFactor.verifyTotp({ code: clean, trustDevice });
	setLoading(false);

	if (error) {
	  if (error.status === 429) {
		setMessage("Too many wrong codes. Your account is locked for a few minutes.");
	  } else if (error.status === 401) {
		// the 2FA cookie expired (user waited too long) -> start over
		setMessage("Your sign-in expired. Please sign in again.");
	  } else {
		setMessage(error.message ?? "Invalid code");
	  }
	  return;
	}

	router.push("/dashboard");
  }

  return (
	<main className="min-h-screen bg-[#f0f4f9] flex items-center justify-center px-4">
	  <div className="w-full max-w-4xl bg-white rounded-[28px] shadow-sm p-8 md:p-12 grid md:grid-cols-2 gap-10">

		{/* LEFT SIDE */}
		<div className="flex flex-col">
		  <div className="w-12 h-12 rounded-2xl bg-teal-600 flex items-center justify-center mb-6">
			{/* simple lock icon */}
			<svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
			  <path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1zm2 0h6V7a3 3 0 0 0-6 0v3z" />
			</svg>
		  </div>

		  <h1 className="text-[36px] leading-tight font-normal text-gray-900">
			2-Step Verification
		  </h1>

		  <p className="mt-3 text-gray-600">
			{useBackup
			  ? "Enter one of the backup codes you saved when you turned on 2FA."
			  : "Open your authenticator app and enter the 6-digit code for Transcendence."}
		  </p>
		</div>

		{/* RIGHT SIDE */}
		<form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 md:pt-16">
		  <input
			value={code}
			onChange={(e) => setCode(e.target.value)}
			placeholder={useBackup ? "xxxxx-xxxxx" : "123456"}
			inputMode={useBackup ? "text" : "numeric"}
			autoComplete="one-time-code"
			autoFocus
			maxLength={useBackup ? 32 : 6}
			className="w-full rounded-md border border-gray-400 px-4 py-3 text-xl tracking-[0.3em] text-center text-gray-900 outline-none focus:border-2 focus:border-teal-600"
		  />

		  <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer select-none">
			<input
			  type="checkbox"
			  checked={trustDevice}
			  onChange={(e) => setTrustDevice(e.target.checked)}
			  className="w-4 h-4 accent-teal-600"
			/>
			Don&apos;t ask again on this device for 30 days
		  </label>

		  {message && (
			<div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3 bg-red-50 text-red-700">
			  <span>⚠</span>
			  {message}
			</div>
		  )}

		  <div className="flex items-center justify-between mt-4">
			<button
			  type="button"
			  onClick={() => {
				setUseBackup(!useBackup);
				setCode("");
				setMessage("");
			  }}
			  className="text-sm font-medium text-teal-700 hover:bg-teal-50 px-3 py-2 rounded-full"
			>
			  {useBackup ? "Use authenticator app" : "Use a backup code"}
			</button>

			<button
			  type="submit"
			  disabled={loading}
			  className="bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium px-6 py-2.5 rounded-full transition-colors shadow-sm"
			>
			  {loading ? "Checking..." : "Verify"}
			</button>
		  </div>

		  <a href="/login" className="self-start text-xs text-gray-500 hover:underline pl-3">
			Back to sign in
		  </a>
		</form>
	  </div>
	</main>
  );
}
