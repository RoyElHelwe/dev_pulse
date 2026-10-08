"use client";

import { useState } from "react";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { OAuthButtons } from "@/components/oauth-buttons";
import { AuthShell, FloatingInput, FormMessage, btnPrimary, btnText, checkboxClass } from "@/components/auth-shell";

// SAME rules as the backend (signUpSchema in auth-backend/src/lib/auth.ts).
// If you change one, change the other.
const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50, "Name is too long"),
  email: z.string().email("Please enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long")
    .regex(/[A-Za-z]/, "Password needs a letter")
    .regex(/[0-9]/, "Password needs a number"),
});

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function showError(msg: string) {
    setIsError(true);
    setMessage(msg);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    // Check the form with Zod first
    const result = registerSchema.safeParse({ name, email, password });
    if (!result.success) {
      showError(result.error.issues[0].message);
      return;
    }

    setLoading(true);
    const { error } = await authClient.signUp.email({
      name: result.data.name, // trimmed
      email,
      password,
      callbackURL: `${window.location.origin}/after-login`, // where the email link sends the user
    });
    setLoading(false);

    if (error) {
      showError(error.message ?? "Something went wrong");
      return;
    }

    // Account created, but not verified yet
    setIsError(false);
    setMessage(`Account created! We sent a link to ${email}. Check your inbox (and spam) to verify your account.`);
    setName("");
    setPassword("");
  }

  return (
    <AuthShell title="Create your account" subtitle="Join your team's office: see who's around, talk and work together.">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <FloatingInput id="name" label="Name" value={name} onChange={setName} />
        <FloatingInput id="email" label="Email" type="email" value={email} onChange={setEmail} />
        <FloatingInput
          id="password"
          label="Password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={setPassword}
        />

        <p className="-mt-3 text-xs text-[#8a8073] pl-1">8 or more characters, with a letter and a number</p>

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

        <div className="flex items-center justify-between mt-4">
          <a href="/login" className={btnText}>
            Sign in instead
          </a>
          <button type="submit" disabled={loading} className={btnPrimary}>
            {loading ? "Creating..." : "Create account"}
          </button>
        </div>

        {/* Google / GitHub / 42 (no email verification needed) */}
        <OAuthButtons onError={showError} />
      </form>
    </AuthShell>
  );
}