import { Resend } from "resend";

export async function sendEmail(to: string, subject: string, html: string) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: "Transcendence <onboarding@resend.dev>",
    to,
    subject,
    html,
  });

  if (error) console.error("Resend error:", error);
}