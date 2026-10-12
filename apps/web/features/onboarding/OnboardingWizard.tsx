// Multi-step office creation flow for new organisers configuring workspace name, template, and avatar.
// Rendered by OnboardingGate when a signed-in user has no associated workspace.

'use client';

import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { CharacterStep } from './CharacterStep';
import { NameStep } from './NameStep';
import { TemplateStep, type OfficeTemplateOption } from './TemplateStep';
import { WelcomeStep } from './WelcomeStep';

/** Minimum length for the office name. */
const MIN_OFFICE_NAME_LENGTH = 2;

/** Maximum length for the office name. */
const MAX_OFFICE_NAME_LENGTH = 40;

/** Default team size when generating custom office templates. */
const DEFAULT_GENERATED_TEAM_SIZE = 8;

const GENERATED_ID = 'generated';
const STEPS = ['Name', 'Office', 'You'] as const;

const NOTICES: Record<string, string> = {
  removed: 'You were removed from your office. Create a new one or wait for an invitation.',
  deleted: 'Your office was deleted by its organiser.',
  no_workspace: 'You are not in an office yet.',
};

const nameSchema = z
  .string()
  .trim()
  .min(MIN_OFFICE_NAME_LENGTH, `Use at least ${MIN_OFFICE_NAME_LENGTH} characters.`)
  .max(MAX_OFFICE_NAME_LENGTH, `Use at most ${MAX_OFFICE_NAME_LENGTH} characters.`);

function sortTemplates(list: OfficeTemplateOption[]): OfficeTemplateOption[] {
  return [...list].sort((a, b) => {
    if (a.id === 'loft') return -1;
    if (b.id === 'loft') return 1;
    if (a.id === GENERATED_ID) return 1;
    if (b.id === GENERATED_ID) return -1;
    return 0;
  });
}

/** Multi-step wizard guiding new organizers through office creation and avatar selection. */
export function OnboardingWizard() {
  const router = useRouter();
  const notice = NOTICES[useSearchParams().get('notice') ?? ''];
  const { user, reloadUser } = useAuth();
  const [step, setStep] = useState(-1);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [generatedSize, setGeneratedSize] = useState<number>(DEFAULT_GENERATED_TEAM_SIZE);
  const [templates, setTemplates] = useState<OfficeTemplateOption[]>([]);
  const [templateId, setTemplateId] = useState<string | null>('loft');
  const [character, setCharacter] = useState('maya');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (step < 1) return;
    let live = true;
    api<OfficeTemplateOption[]>(`/office/templates?team=${generatedSize}&seed=${encodeURIComponent(name.trim())}`).then(
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
          ...(templateId === GENERATED_ID && { teamSize: generatedSize }),
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
      <WelcomeStep
        displayName={user?.displayName}
        email={user?.email}
        notice={notice}
        onCreateOffice={() => setStep(0)}
      />
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
          <NameStep
            name={name}
            onChangeName={setName}
            error={nameError}
            onSubmit={next}
          />
        )}

        {step === 1 && (
          <TemplateStep
            templates={templates}
            templateId={templateId}
            onSelectTemplate={setTemplateId}
            generatedSize={generatedSize}
            onChangeGeneratedSize={setGeneratedSize}
          />
        )}

        {step === 2 && (
          <CharacterStep
            character={character}
            onChangeCharacter={setCharacter}
          />
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
