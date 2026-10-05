import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Privacy Policy · Dev Pulse' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="5 October 2026">
      <p>
        Dev Pulse is a virtual office for teams, built as a student project at 42. This page explains what we store about
        you, why, and what you can do about it. We keep as little as we can, and we never sell your data.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your name, your email address, whether you confirmed it, and your profile picture
          if you add one or sign in with Google, GitHub or 42.
        </li>
        <li>
          <strong>Your password, never in readable form:</strong> we only keep a salted scrypt hash, which cannot be turned
          back into your password.
        </li>
        <li>
          <strong>Two-step sign-in:</strong> if you turn it on, the secret shared with your authenticator app (encrypted)
          and fingerprints (hashes) of your unused backup codes.
        </li>
        <li>
          <strong>Signed-in devices:</strong> for each device, the browser name and IP address, so you can recognise and
          sign out devices from your security settings.
        </li>
        <li>
          <strong>Linked accounts:</strong> when you sign in with Google, GitHub or 42 we keep their account number for you,
          to recognise you next time. We do not keep their access tokens.
        </li>
        <li>
          <strong>What you do in the office:</strong> your workspaces, tasks and messages, so your team can see them.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>We only use cookies needed to keep you signed in. There are no advertising or tracking cookies.</p>
      <ul>
        <li>
          <strong>access_token</strong> and <strong>refresh_token</strong>: prove that you are signed in (15 minutes and 30
          days). They cannot be read by scripts on the page.
        </li>
        <li>
          <strong>signed_in</strong>: tells the app that someone is signed in and when to renew the session. It contains no
          personal data.
        </li>
        <li>
          <strong>mfa_token</strong>, <strong>oauth_state</strong>: short-lived (a few minutes), only during sign-in.
        </li>
        <li>
          <strong>trusted_device</strong>: only if you choose &ldquo;don&apos;t ask again on this browser&rdquo; for
          two-step sign-in (30 days).
        </li>
      </ul>

      <h2>Voice and meetings</h2>
      <p>
        Voice chat goes directly between the browsers of the people talking. We do not record or store any audio. Your
        browser always asks before using your microphone.
      </p>

      <h2>Who else sees your data</h2>
      <ul>
        <li>The members of the workspaces you join see your name, picture, presence in the office and shared content.</li>
        <li>Our email provider receives your email address to send you account emails (confirmation, password reset).</li>
        <li>Google, GitHub or 42 only if you choose to sign in with them.</li>
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>Your account, until you delete it.</li>
        <li>Device sessions, 30 days after their last use.</li>
        <li>Email links: password reset links expire after 1 hour, confirmation links after 24 hours.</li>
      </ul>

      <h2>How we protect it</h2>
      <p>
        All traffic uses HTTPS. Sessions use short-lived signed tokens, refresh tokens are stored only as hashes and change
        on every use, sign-in attempts are rate limited, and you can turn on two-step sign-in.
      </p>

      <h2>Your rights</h2>
      <p>
        You can see and correct your information in the app, sign out any device, and ask us for a copy of your data or
        for your account to be deleted. Under the GDPR you can also object to how we use your data or complain to your
        data protection authority.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests: write to the Dev Pulse team at <a href="mailto:privacy@devpulse.local">privacy@devpulse.local</a>.
        See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  );
}
