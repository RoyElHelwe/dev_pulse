"use client";
import { useState } from "react";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { FloatingInput, FormMessage, btnPrimary } from "@/components/auth-shell";

//same email rule as register. The backend checks again.
const emailSchema = z.email("Invalid email");
type InviteRole = "member" | "admin";
//invite someone to this workspace by email.
export function InviteForm({ workspaceId, onInvited }: { workspaceId: string; onInvited?: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("member");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function show(text: string, error: boolean) {
    setMessage(text);
    setIsError(error);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    show("", false);

    const check = emailSchema.safeParse(email.trim());
    if (!check.success) return show(check.error.issues[0].message, true);

    setLoading(true);
    //better Auth saves the invitation, then calls sendInvitationEmail in auth.ts
    const { error } = await authClient.organization.inviteMember({
      email: check.data,
      role,
      organizationId: workspaceId,
    });
    setLoading(false);

    if (error) return show(error.message ?? "Could not send the invite", true);

    show(`Invite sent to ${check.data}`, false);
    setEmail("");
    setRole("member");
    onInvited?.(); // lets the page refresh the pending invites list (step 4)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <FloatingInput id="invite-email" label="Email" type="email" value={email} onChange={setEmail} />

      <div className="flex flex-col gap-1">
        <label htmlFor="invite-role" className="text-xs text-[#8a8073] px-1">
          Role
        </label>
        <select
          id="invite-role"
          value={role}
          onChange={(e) => setRole(e.target.value as InviteRole)}
          className="w-full rounded-xl border border-[#d8cdbd] bg-white px-4 py-3 text-base text-[#2b2620] outline-none focus:border-2 focus:border-[#5468d4]"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <FormMessage message={message} isError={isError} />

      <div className="flex justify-end">
        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? "Sending..." : "Send invite"}
        </button>
      </div>
    </form>
  );
}