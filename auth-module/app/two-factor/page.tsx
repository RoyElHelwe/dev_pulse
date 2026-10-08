"use client";

import { useState } from "react";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { AuthShell, FormMessage, LockIcon, btnPrimary, btnText, checkboxClass } from "@/components/auth-shell";

const totpSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your app");
const backupSchema = z.string().min(6, "Enter one of your backup codes");

export default function TwoFactorPage() {
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
     window.location.href = "/after-login";
  }

  return (
    <AuthShell
      title="2-Step Verification"
      icon={<LockIcon />}
      subtitle={
        useBackup
          ? "Enter one of the backup codes you saved when you turned on 2FA."
          : "Open your authenticator app and enter the 6-digit code for Transcendence."
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={useBackup ? "xxxxx-xxxxx" : "123456"}
          inputMode={useBackup ? "text" : "numeric"}
          autoComplete="one-time-code"
          autoFocus
          maxLength={useBackup ? 32 : 6}
          className="w-full rounded-xl border border-[#d8cdbd] bg-white px-4 py-3 text-xl tracking-[0.3em] text-center text-[#2b2620] outline-none focus:border-2 focus:border-[#5468d4]"
        />

        <label className="flex items-center gap-3 text-sm text-[#4a433a] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            className={checkboxClass}
          />
          Don&apos;t ask again on this device for 30 days
        </label>

        <FormMessage message={message} isError />

        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            onClick={() => {
              setUseBackup(!useBackup);
              setCode("");
              setMessage("");
            }}
            className={btnText}
          >
            {useBackup ? "Use authenticator app" : "Use a backup code"}
          </button>
          <button type="submit" disabled={loading} className={btnPrimary}>
            {loading ? "Checking..." : "Verify"}
          </button>
        </div>

        <a href="/login" className="self-start text-xs text-[#8a8073] hover:underline pl-3">
          Back to sign in
        </a>
      </form>
    </AuthShell>
  );
}