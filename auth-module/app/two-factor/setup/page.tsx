"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { authClient } from "@/lib/auth-client";
import { AuthShell, FormMessage, LockIcon, btnPrimary } from "@/components/auth-shell";

// First login only: every user must set up 2FA before using the app.
//   (password, only for email accounts) -> scan QR -> type code -> save backup codes -> after-login
type Step = "loading" | "password" | "scan" | "codes";

const inputClass =
  "w-full rounded-xl border border-[#d8cdbd] bg-white px-4 py-3 text-[#2b2620] outline-none focus:border-2 focus:border-[#5468d4]";

const SUBTITLES: Record<Step, string> = {
  loading: "Preparing your QR code…",
  password: "2FA is required for every account. Confirm your password to continue.",
  scan: "Scan this QR code with Google Authenticator (or Authy), then enter the 6-digit code it shows.",
  codes: "2FA is on. Save these backup codes somewhere safe. Each one works once if you lose your phone.",
};

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
  const [copied, setCopied] = useState(false);
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
      router.replace("/after-login"); // already set up
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

  async function copyCodes() {
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
  }

  async function finish() {
    await refetch();
    router.replace("/after-login"); // decides dashboard or onboarding
  }

  return (
    <AuthShell title="Set up 2-Step Verification" icon={<LockIcon />} subtitle={SUBTITLES[step]}>
      <div className="flex flex-col gap-5">
        {step === "loading" && (
          <div className="flex items-center gap-3 text-sm text-[#6b6257]">
            <span className="h-3 w-3 rounded-full bg-[#5468d4] animate-pulse" />
            Preparing your QR code…
          </div>
        )}

        {step === "password" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (password) startSetup(password);
              else setError("Enter your password");
            }}
            noValidate
            className="flex flex-col gap-5"
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoFocus
              className={inputClass}
            />
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? "Please wait..." : "Continue"}
            </button>
          </form>
        )}

        {step === "scan" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirmCode();
            }}
            noValidate
            className="flex flex-col gap-5"
          >
            <div className="self-center rounded-2xl border border-[#e5dccd] bg-white p-4">
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
              autoFocus
              className={`${inputClass} text-xl text-center tracking-[0.3em]`}
            />
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? "Checking..." : "Confirm"}
            </button>
          </form>
        )}

        {step === "codes" && (
          <>
            <ul className="grid grid-cols-2 gap-2 rounded-2xl bg-[#f7f1e7] p-4 font-mono text-sm text-[#2b2620]">
              {backupCodes.map((c) => (
                <li key={c} className="rounded-lg bg-white px-3 py-1.5 text-center">
                  {c}
                </li>
              ))}
            </ul>
            <p className="-mt-2 text-xs text-[#8a8073]">You won&apos;t see these codes again.</p>
            <button
              type="button"
              onClick={copyCodes}
              className="w-full rounded-full border border-[#d8cdbd] bg-white hover:bg-[#f7f1e7] text-sm font-medium text-[#2b2620] px-6 py-2.5 transition-colors"
            >
              {copied ? "✓ Copied" : "Copy codes"}
            </button>
            <button type="button" onClick={finish} className={btnPrimary}>
              I saved them, continue
            </button>
          </>
        )}

        <FormMessage message={error} isError />
      </div>
    </AuthShell>
  );
}