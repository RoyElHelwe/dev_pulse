// Welcome step in the onboarding flow offering options to create an office or await an invite.
// Rendered as the initial landing state of OnboardingWizard before step 0.

'use client';

import { ArrowRight, Building2, MailOpen } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';

interface WelcomeStepProps {
  displayName?: string;
  email?: string;
  notice?: string;
  onCreateOffice: () => void;
}

/** Initial screen welcoming users to onboarding and presenting office creation options. */
export function WelcomeStep({
  displayName,
  email,
  notice,
  onCreateOffice,
}: WelcomeStepProps) {
  const firstName = displayName ? displayName.split(' ')[0] : 'there';

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Welcome, {firstName}
      </h1>
      <p className="mt-2 text-lg text-zinc-600">Let&apos;s get you into an office.</p>
      {notice && <Alert className="mt-6">{notice}</Alert>}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={onCreateOffice}
          className="group rounded-2xl bg-white p-6 text-left ring-1 ring-zinc-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-zinc-300 focus-visible:outline-2 focus-visible:outline-emerald-500"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-semibold">Create an office</h2>
          <p className="mt-1 text-sm text-zinc-600">
            For organisers: set up the space, then invite your team.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium">
            Start <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </span>
        </button>
        <div className="rounded-2xl bg-zinc-100/70 p-6 ring-1 ring-zinc-200/70">
          <span className="flex size-11 items-center justify-center rounded-xl bg-white text-zinc-700 ring-1 ring-zinc-200">
            <MailOpen className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-semibold">Joining a team?</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Ask your organiser to invite <b className="text-zinc-800">{email}</b>, then open
            the link in the email.
          </p>
        </div>
      </div>
    </div>
  );
}
