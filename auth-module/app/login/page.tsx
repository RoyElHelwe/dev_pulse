"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { OAuthButtons } from "@/components/oauth-buttons";
import { AuthShell, FloatingInput, FormMessage, btnPrimary, btnText, checkboxClass } from "@/components/auth-shell";

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

  // OAuth sends the user back here with ?error=... when it fails
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

    // Check the form with Zod first
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      showError(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    const { data, error } = await authClient.signIn.email({ email, password });
    setLoading(false);

    if (error) {
      // 403 = correct password, but the email is not verified
      if (error.status === 403) {
        setNeedsVerify(true);
        showError("Please verify your email first. Check your inbox (and spam).");
        return;
      }
      showError(error.message ?? "Something went wrong");
      return;
    }

    // 2FA is on: type the code first
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      router.push("/two-factor");
      return;
    }

    //logged in: /after-login decides dashboard or onboarding
    router.push("/after-login");
  }

  async function resendEmail() {
    setResending(true);
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `${window.location.origin}/after-login`, // where the email link sends the user
    });
    setResending(false);

    if (error) {
      showError(error.message ?? "Could not send the email");
      return;
    }

    setIsError(false);
    setNeedsVerify(false);
    setMessage(`New email sent to ${email}. Check your inbox (and spam).`);
  }

  return (
    <AuthShell title="Sign in" subtitle="Welcome back. Sign in to get to your office.">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <FloatingInput id="email" label="Email" type="email" value={email} onChange={setEmail} />
        <FloatingInput
          id="password"
          label="Password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={setPassword}
        />

        <label className="flex items-center gap-3 text-sm text-[#4a433a] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(e) => setShowPassword(e.target.checked)}
            className={checkboxClass}
          />
          Show password
        </label>

        <FormMessage message={message} isError={isError} />

        {needsVerify && (
          <button type="button" onClick={resendEmail} disabled={resending} className={`-mt-2 self-start disabled:opacity-60 ${btnText}`}>
            {resending ? "Sending..." : "Resend verification email"}
          </button>
        )}

        <div className="flex items-center justify-between mt-4">
          <a href="/register" className={btnText}>
            Create account
          </a>
          <button type="submit" disabled={loading} className={btnPrimary}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>

        {/* Google / GitHub / 42 */}
        <OAuthButtons onError={showError} />
      </form>
    </AuthShell>
  );
}