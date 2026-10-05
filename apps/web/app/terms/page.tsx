import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Terms of Service · Dev Pulse' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="5 October 2026">
      <p>
        These terms explain the rules for using Dev Pulse, a virtual office for teams built as a student project at 42. By
        creating an account or using the app, you accept them.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Give your real name and an email address you can access.</li>
        <li>Keep your password and backup codes to yourself. You are responsible for what happens with your account.</li>
        <li>One account per person, used on one device at a time. Tell us if you think someone else used your account.</li>
      </ul>

      <h2>Using the office</h2>
      <p>Dev Pulse is a shared space. Treat the people you meet in it like colleagues in a real office. Do not:</p>
      <ul>
        <li>harass, threaten or discriminate against anyone, in text or voice;</li>
        <li>share illegal content, or content you do not have the right to share;</li>
        <li>record other people&apos;s voice or screen without their permission;</li>
        <li>try to break, overload or get around the security of the service, or access accounts that are not yours.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        What you create (tasks, messages, workspace content) stays yours. You allow us to store it and show it to the
        members of your workspaces, because that is how the app works. Workspace owners and admins can manage the members
        and the content of their workspace.
      </p>

      <h2>Availability</h2>
      <p>
        Dev Pulse is a student project. We do our best to keep it running and your data safe, but the service is provided
        &ldquo;as is&rdquo;, without guarantees, and may change, pause or stop.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using Dev Pulse at any time and ask us to delete your account. We may suspend accounts that break
        these terms.
      </p>

      <h2>Responsibility</h2>
      <p>
        To the extent allowed by law, we are not responsible for indirect losses, lost data or problems caused by other
        users. Nothing in these terms removes rights you have under consumer law.
      </p>

      <h2>Changes</h2>
      <p>If we change these terms, we will update the date at the top of this page and tell you in the app.</p>

      <h2>Contact</h2>
      <p>
        Questions: write to the Dev Pulse team at <a href="mailto:hello@devpulse.local">hello@devpulse.local</a>. How we
        handle your data is described in our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
