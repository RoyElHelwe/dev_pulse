"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const FRONTEND_URL = "http://localhost:3000";
type Provider = "google" | "github";

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
];

// Buttons that send the user to Google / GitHub, then back to our app.
// Used on both the login and the register page (OAuth creates the account if needed).
export function OAuthButtons({ onError }: { onError: (msg: string) => void }) {
  const [loading, setLoading] = useState<Provider | null>(null);

  async function signInWith(provider: Provider) {
	setLoading(provider);
	const { error } = await authClient.signIn.social({
	  provider,
	  callbackURL: `${FRONTEND_URL}/dashboard`,      // where to go after success
	  errorCallbackURL: `${FRONTEND_URL}/login`,     // where to go if it fails (?error=...)
	});
	// On success the browser is redirected, so we only get here on error.
	if (error) {
	  setLoading(null);
	  onError(error.message ?? `Could not sign in with ${provider}`);
	}
  }

  return (
	<div className="flex flex-col gap-3">
	  {/* "or" divider */}
	  <div className="flex items-center gap-3 text-xs text-gray-500">
		<div className="h-px flex-1 bg-gray-200" />
		or
		<div className="h-px flex-1 bg-gray-200" />
	  </div>

	  {PROVIDERS.map((p) => (
		<button
		  key={p.id}
		  type="button"
		  onClick={() => signInWith(p.id)}
		  disabled={loading !== null}
		  className="w-full rounded-full border border-gray-300 hover:bg-gray-50 disabled:opacity-60 text-sm font-medium text-gray-800 px-6 py-2.5 transition-colors"
		>
		  {loading === p.id ? "Redirecting..." : p.label}
		</button>
	  ))}
	</div>
  );
}
