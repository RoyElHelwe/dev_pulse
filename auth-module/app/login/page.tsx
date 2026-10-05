"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { OAuthButtons } from "@/components/oauth-buttons";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false); 
  const [resending, setResending] = useState(false);

  useEffect(() => {
	const oauthError = new URLSearchParams(window.location.search).get("error");
	if (oauthError) {
	  setIsError(true);
	  setMessage(`Social sign-in failed: ${oauthError.replaceAll("_", " ")}`);
	}
  }, []);

  function showError(msg: string) {
	setIsError(true);
	setMessage(msg);
  }

  async function handleSubmit(e: React.FormEvent) {
	e.preventDefault();
	setMessage("");
	setNeedsVerify(false); 

	const result = loginSchema.safeParse({
	  email,
	  password,
	});

	// If Zod finds an error stop here
	if (!result.success) {
	  setIsError(true);
	  setMessage(result.error.issues[0].message);
	  return;
	}
	setLoading(true);

	// Zod passed so now send the data to Better Auth
	const { data, error } = await authClient.signIn.email({
	  email,
	  password,
	});
	setLoading(false);

	// Better Auth returned an error
	if (error) {
	  setIsError(true);

	  // NEW: 403 = correct password, but the email is not verified
	  if (error.status === 403) {
		setNeedsVerify(true);
		setMessage("Please verify your email first. Check your inbox (and spam).");
		return;
	  }

	  setMessage(error.message ?? "Something went wrong");
	  return;
	}
	if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
	  router.push("/two-factor");
	  return;
	}
	setIsError(false);
	setMessage("Signed in");
	router.push("/");
  }

  async function resendEmail() {
	setResending(true);
	const { error } = await authClient.sendVerificationEmail({
	  email,
	  callbackURL: "http://localhost:3000/dashboard",
	});
	setResending(false);

	if (error) {
	  setIsError(true);
	  setMessage(error.message ?? "Could not send the email");
	  return;
	}

	setIsError(false);
	setNeedsVerify(false);
	setMessage(`New email sent to ${email}. Check your inbox (and spam).`);
  }

  return (
	<main className="min-h-screen bg-[#f0f4f9] flex items-center justify-center px-4">
	  <div className="w-full max-w-4xl bg-white rounded-[28px] shadow-sm p-8 md:p-12 grid md:grid-cols-2 gap-10">

		{/* LEFT SIDE: logo + title */}
		<div className="flex flex-col">

		  {/* Simple app icon (a video camera) */}
		  <div className="w-12 h-12 rounded-2xl bg-teal-600 flex items-center justify-center mb-6">
			<svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
			  <path d="M4 6h10a2 2 0 0 1 2 2v1.5l4-2.5v10l-4-2.5V16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
			</svg>
		  </div>

		  <h1 className="text-[36px] leading-tight font-normal text-gray-900">
			Sign in
		  </h1>

		  <p className="mt-3 text-gray-600">
			Welcome back. Sign in to start or join a video call.
		  </p>
		</div>

		{}
		<form
		  onSubmit={handleSubmit}
		  noValidate
		  className="flex flex-col gap-5 md:pt-16"
		>
		  <FloatingInput
			id="email"
			label="Email"
			type="email"
			value={email}
			onChange={setEmail}
		  />

		  <FloatingInput
			id="password"
			label="Password"
			type={showPassword ? "text" : "password"}
			value={password}
			onChange={setPassword}
		  />

		  {/* Show password checkbox */}
		  <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer select-none">
			<input
			  type="checkbox"
			  checked={showPassword}
			  onChange={(e) => setShowPassword(e.target.checked)}
			  className="w-4 h-4 accent-teal-600"
			/>
			Show password
		  </label>

		  {/* Success / error message */}
		  {message && (
			<div
			  className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 ${
				isError
				  ? "bg-red-50 text-red-700"
				  : "bg-green-50 text-green-700"
			  }`}
			>
			  <span>{isError ? "⚠" : "✓"}</span>
			  {message}
			</div>
		  )}

		  {}
		  {needsVerify && (
			<button
			  type="button"
			  onClick={resendEmail}
			  disabled={resending}
			  className="-mt-2 self-start text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-60 px-3 py-2 rounded-full"
			>
			  {resending ? "Sending..." : "Resend verification email"}
			</button>
		  )}

		  {/* Buttons */}
		  <div className="flex items-center justify-between mt-4">
			<a
			  href="/register"
			  className="text-sm font-medium text-teal-700 hover:bg-teal-50 px-3 py-2 rounded-full"
			>
			  Create account
			</a>

			<button
			  type="submit"
			  disabled={loading}
			  className="bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium px-6 py-2.5 rounded-full transition-colors shadow-sm"
			>
			  {loading ? "Signing in..." : "Sign in"}
			</button>
		  </div>

		  {/* NEW: Google / GitHub */}
		  <OAuthButtons onError={showError} />
		</form>
	  </div>
	</main>
  );
}
function FloatingInput({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
	<div className="relative">
	  <input
		id={id}
		type={type}
		value={value}
		onChange={(e) => onChange(e.target.value)}
		placeholder=" "
		required
		className="peer w-full rounded-md border border-gray-400 px-4 pt-4 pb-3 text-base text-gray-900 outline-none transition
				   focus:border-2 focus:border-teal-600"
	  />

	  <label
		htmlFor={id}
		className="absolute left-3 px-1 bg-white text-gray-600 pointer-events-none transition-all
				   top-1/2 -translate-y-1/2 text-base
				   peer-focus:top-0 peer-focus:text-xs peer-focus:text-teal-700
				   peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-xs"
	  >
		{label}
	  </label>
	</div>
  );
}