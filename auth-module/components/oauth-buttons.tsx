"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
type Provider = "google" | "github" | "fortytwo";
const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
  { id: "fortytwo", label: "Continue with 42" }, //42 intra (genericOAuth on the backend)
];

//buttons that send the user to Google / GitHub / 42, then back to our app
//used on both the login and the register page (OAuth creates the account if needed)
export function OAuthButtons({ onError }: { onError: (msg: string) => void }) {
  const [loading, setLoading] = useState<Provider | null>(null);

  async function signInWith(provider: Provider) {
    setLoading(provider);
    const origin = window.location.origin;
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: `${origin}/after-login`, //success: /after-login decides dashboard or onboarding
      errorCallbackURL: `${origin}/login`, //failure: back to login with ?error=...
    });
    // On success the browser leaves the page, so we only get here on error.
    if (error) {
      setLoading(null);
      onError(error.message ?? `Could not sign in with ${provider}`);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* "or" divider */}
      <div className="flex items-center gap-3 text-xs text-[#8a8073]">
        <div className="h-px flex-1 bg-[#e5dccd]" />
        or
        <div className="h-px flex-1 bg-[#e5dccd]" />
      </div>

      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => signInWith(p.id)}
          disabled={loading !== null}
          className="w-full rounded-full border border-[#d8cdbd] bg-white hover:bg-[#f7f1e7] disabled:opacity-60 text-sm font-medium text-[#2b2620] px-6 py-2.5 transition-colors"
        >
          {loading === p.id ? "Redirecting..." : p.label}
        </button>
      ))}
    </div>
  );
}