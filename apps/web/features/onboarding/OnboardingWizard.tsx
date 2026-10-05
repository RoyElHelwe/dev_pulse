'use client';

import { ArrowLeft, ArrowRight, Building2, Check, MailOpen, Sparkles } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { CharacterGrid } from '@/features/workspace/CharacterGrid';
import { LayoutPreview } from '@/features/workspace/LayoutPreview';
import type { OfficeLayout } from '@/game/layout/types';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Template {
  id: string;
  name: string;
  description: string;
  minTeam: number;
  maxTeam: number;
  desks: number;
  meetingRooms: number;
  layout: OfficeLayout;
}

const STEPS = ['Name', 'Team', 'Office', 'You'] as const;
const TEAM_SIZES = [
  { label: 'Just me', size: 1 },
  { label: '2–8', size: 6 },
  { label: '9–24', size: 16 },
  { label: '25–48', size: 36 },
  { label: '49–100', size: 72 },
];
const NOTICES: Record<string, string> = {
  removed: 'You were removed from your office. Create a new one or wait for an invitation.',
  deleted: 'Your office was deleted by its organiser.',
  no_workspace: 'You are not in an office yet.',
};

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters.')
  .max(40, 'Use at most 40 characters.');

/** Creating an office: name → team size → template → character. No AI, just good defaults. */
export function OnboardingWizard() {
  const router = useRouter();
  const notice = NOTICES[useSearchParams().get('notice') ?? ''];
  const { user, reloadUser } = useAuth();
  const [step, setStep] = useState(-1); // -1 = welcome
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [teamSize, setTeamSize] = useState<number | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [character, setCharacter] = useState('maya');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api<Template[]>('/office/templates').then(setTemplates, () =>
      setError('Could not load the office templates.'),
    );
  }, []);

  // The template that fits the team best.
  const recommended = useMemo(() => {
    if (teamSize === null) return null;
    return (
      templates.find(
        (t) => teamSize >= t.minTeam && teamSize <= t.maxTeam && teamSize <= t.maxTeam / 1.5,
      ) ??
      templates.find((t) => teamSize >= t.minTeam && teamSize <= t.maxTeam) ??
      templates[templates.length - 1]
    );
  }, [teamSize, templates]);

  function next() {
    setError('');
    if (step === 0) {
      const parsed = nameSchema.safeParse(name);
      if (!parsed.success) return setNameError(parsed.error.issues[0].message);
      setNameError('');
    }
    if (step === 1 && teamSize === null) return setError('Pick the size of your team.');
    if (step === 1 && !templateId) setTemplateId(recommended?.id ?? null);
    if (step === 2 && !templateId) return setError('Pick an office.');
    setStep(step + 1);
  }

  async function create() {
    setCreating(true);
    setError('');
    try {
      await api('/workspace', { body: { name: name.trim(), templateId, character } });
      await reloadUser();
      router.replace('/office');
    } catch (err) {
      setCreating(false);
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
    }
  }

  if (step === -1) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Welcome, {user?.displayName.split(' ')[0]}
        </h1>
        <p className="mt-2 text-lg text-zinc-600">Let&apos;s get you into an office.</p>
        {notice && <Alert className="mt-6">{notice}</Alert>}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setStep(0)}
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
              Ask your organiser to invite <b className="text-zinc-800">{user?.email}</b>, then open
              the link in the email.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="flex items-center gap-2" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition',
                i < step
                  ? 'bg-emerald-600 text-white'
                  : i === step
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-200 text-zinc-500',
              )}
              aria-current={i === step ? 'step' : undefined}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                'hidden text-sm sm:inline',
                i === step ? 'font-medium' : 'text-zinc-500',
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-zinc-200" />}
          </li>
        ))}
      </ol>

      <section className="mt-8 rounded-3xl bg-white p-6 ring-1 ring-zinc-200/80 sm:p-8">
        {step === 0 && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Name your office</h1>
            <p className="mt-1 text-zinc-600">
              Usually the name of your team or company. You can change it later.
            </p>
            <form
              className="mt-6 sm:max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                next();
              }}
            >
              <TextField
                label="Office name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={40}
                error={nameError}
                placeholder="e.g. Pixel Studio"
              />
            </form>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">How big is your team?</h1>
            <p className="mt-1 text-zinc-600">We&apos;ll suggest an office with enough desks.</p>
            <div
              className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5"
              role="radiogroup"
              aria-label="Team size"
            >
              {TEAM_SIZES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  role="radio"
                  aria-checked={teamSize === t.size}
                  onClick={() => {
                    setTeamSize(t.size);
                    setTemplateId(null);
                  }}
                  className={cn(
                    'rounded-2xl px-4 py-5 text-center ring-1 transition',
                    teamSize === t.size
                      ? 'bg-zinc-900 text-white ring-zinc-900'
                      : 'bg-white ring-zinc-200 hover:ring-zinc-400',
                  )}
                >
                  <span className="block text-lg font-semibold">{t.label}</span>
                  <span
                    className={cn(
                      'text-xs',
                      teamSize === t.size ? 'text-zinc-300' : 'text-zinc-500',
                    )}
                  >
                    {t.size === 1 ? 'person' : 'people'}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Pick your office</h1>
            <p className="mt-1 text-zinc-600">You can move, add and remove furniture any time.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Office">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={templateId === t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={cn(
                    'flex flex-col overflow-hidden rounded-2xl bg-white text-left ring-2 transition',
                    templateId === t.id ? 'ring-zinc-900' : 'ring-zinc-200 hover:ring-zinc-300',
                  )}
                >
                  <div className="bg-zinc-100 p-3">
                    <LayoutPreview layout={t.layout} />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-4">
                    <span className="flex items-center justify-between gap-2 font-semibold">
                      {t.name}
                      {recommended?.id === t.id && (
                        <Badge tone="success">
                          <Sparkles className="size-3" /> Best fit
                        </Badge>
                      )}
                    </span>
                    <span className="text-sm text-zinc-600">{t.description}</span>
                    <span className="mt-auto pt-2 text-xs text-zinc-500">
                      {t.desks} desks · {t.meetingRooms} meeting room{t.meetingRooms > 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Choose your character</h1>
            <p className="mt-1 text-zinc-600">This is how your team sees you in the office.</p>
            <CharacterGrid
              value={character}
              onPick={setCharacter}
              fresh={8}
              className="mt-6 gap-3 sm:grid-cols-8"
              tileClassName="rounded-2xl p-2"
              previewClassName="h-20"
            />
          </>
        )}

        {error && (
          <Alert tone="error" className="mt-6">
            {error}
          </Alert>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>
              Continue <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={create} loading={creating}>
              Create the office
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
