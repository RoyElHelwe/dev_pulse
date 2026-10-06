'use client';

import { ArrowLeft, ArrowRight, Building2, Check, MailOpen, Sparkles } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { CharacterStudio } from '@/features/workspace/CharacterStudio';
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

const GENERATED = 'generated';
const STEPS = ['Name', 'Office', 'You'] as const;

const GENERATED_SIZES = [
  { label: 'Small', hint: '~8 people', size: 8 },
  { label: 'Medium', hint: '~24 people', size: 24 },
  { label: 'Large', hint: '~48 people', size: 48 },
] as const;

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

function sortTemplates(list: Template[]): Template[] {
  return [...list].sort((a, b) => {
    if (a.id === 'loft') return -1;
    if (b.id === 'loft') return 1;
    if (a.id === GENERATED) return 1;
    if (b.id === GENERATED) return -1;
    return 0;
  });
}

/** Creating an office: name → office → character. No AI, just good defaults. */
export function OnboardingWizard() {
  const router = useRouter();
  const notice = NOTICES[useSearchParams().get('notice') ?? ''];
  const { user, reloadUser } = useAuth();
  const [step, setStep] = useState(-1); // -1 = welcome
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [generatedSize, setGeneratedSize] = useState(8);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string | null>('loft');
  const [character, setCharacter] = useState('maya');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (step < 1) return;
    let live = true;
    api<Template[]>(`/office/templates?team=${generatedSize}&seed=${encodeURIComponent(name.trim())}`).then(
      (list) => {
        if (!live) return;
        setTemplates(sortTemplates(list));
        setTemplateId((prev) => prev ?? 'loft');
      },
      () => {
        if (live) setError('Could not load the office templates.');
      },
    );
    return () => {
      live = false;
    };
  }, [step >= 1, generatedSize, name]);

  function next() {
    setError('');
    if (step === 0) {
      const parsed = nameSchema.safeParse(name);
      if (!parsed.success) return setNameError(parsed.error.issues[0].message);
      setNameError('');
    }
    if (step === 1 && !templateId) return setError('Pick an office.');
    setStep(step + 1);
  }

  async function create() {
    setCreating(true);
    setError('');
    try {
      await api('/workspace', {
        body: {
          name: name.trim(),
          templateId,
          character,
          ...(templateId === GENERATED && { teamSize: generatedSize }),
        },
      });
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
    <div className={cn('mx-auto', step === 2 ? 'max-w-4xl' : 'max-w-3xl')}>
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
            <h1 className="text-2xl font-semibold tracking-tight">Pick your office</h1>
            <p className="mt-1 text-zinc-600">You can move, add and remove furniture any time.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Office">
              {templates.map((t) => (
                <div
                  key={t.id}
                  role="radio"
                  aria-checked={templateId === t.id}
                  tabIndex={0}
                  onClick={() => setTemplateId(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setTemplateId(t.id);
                    }
                  }}
                  className={cn(
                    'flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-white text-left ring-2 transition focus-visible:outline-2 focus-visible:outline-emerald-500',
                    templateId === t.id ? 'ring-zinc-900' : 'ring-zinc-200 hover:ring-zinc-300',
                  )}
                >
                  <div className="bg-zinc-100 p-3">
                    <LayoutPreview layout={t.layout} />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-4">
                    <span className="flex items-center justify-between gap-2 font-semibold">
                      {t.name}
                      {t.id === 'loft' && (
                        <Badge tone="success">
                          <Sparkles className="size-3" /> Recommended
                        </Badge>
                      )}
                    </span>
                    <span className="text-sm text-zinc-600">{t.description}</span>
                    <div className="mt-auto space-y-1.5 pt-2 text-xs text-zinc-500">
                      {t.id === 'loft' && (
                        <p className="text-zinc-600">Starts small, add wings as your team grows</p>
                      )}
                      {t.id === GENERATED && (
                        <div className="flex flex-wrap gap-1.5 pb-0.5">
                          {GENERATED_SIZES.map((s) => {
                            const active = generatedSize === s.size;
                            return (
                              <button
                                key={s.size}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setGeneratedSize(s.size);
                                  setTemplateId(t.id);
                                }}
                                className={cn(
                                  'rounded-full px-2.5 py-0.5 text-xs font-medium transition',
                                  active && templateId === GENERATED
                                    ? 'bg-zinc-900 text-white'
                                    : 'border border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-white',
                                )}
                              >
                                {s.label}{' '}
                                <span
                                  className={cn(
                                    'text-[11px]',
                                    active && templateId === GENERATED
                                      ? 'text-zinc-300'
                                      : 'text-zinc-500',
                                  )}
                                >
                                  {s.hint}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <p>
                        {t.desks} desks · {t.meetingRooms} meeting room
                        {t.meetingRooms > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Choose your character</h1>
            <p className="mt-1 text-zinc-600">This is how your team sees you in the office.</p>
            <CharacterStudio value={character} onChange={setCharacter} className="mt-6" />
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
