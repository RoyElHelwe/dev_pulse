// Second step of the onboarding wizard presenting office template choices and sizing.
// Rendered within OnboardingWizard when step is 1.

'use client';

import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LayoutPreview } from '@/features/workspace/LayoutPreview';
import type { OfficeLayout } from '@/game/layout/types';
import { cn } from '@/lib/cn';

const GENERATED_ID = 'generated';

/** Predefined team sizing options for procedurally generated office layouts. */
const GENERATED_SIZES = [
  { label: 'Small', hint: '~8 people', size: 8 },
  { label: 'Medium', hint: '~24 people', size: 24 },
  { label: 'Large', hint: '~48 people', size: 48 },
] as const;

export interface OfficeTemplateOption {
  id: string;
  name: string;
  description: string;
  minTeam: number;
  maxTeam: number;
  desks: number;
  meetingRooms: number;
  layout: OfficeLayout;
}

interface TemplateStepProps {
  templates: OfficeTemplateOption[];
  templateId: string | null;
  onSelectTemplate: (id: string) => void;
  generatedSize: number;
  onChangeGeneratedSize: (size: number) => void;
}

/** Step 1 template selector grid allowing users to choose an office layout preset or size. */
export function TemplateStep({
  templates,
  templateId,
  onSelectTemplate,
  generatedSize,
  onChangeGeneratedSize,
}: TemplateStepProps) {
  return (
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
            onClick={() => onSelectTemplate(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectTemplate(t.id);
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
                {t.id === GENERATED_ID && (
                  <div className="flex flex-wrap gap-1.5 pb-0.5">
                    {GENERATED_SIZES.map((s) => {
                      const active = generatedSize === s.size;
                      return (
                        <button
                          key={s.size}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onChangeGeneratedSize(s.size);
                            onSelectTemplate(t.id);
                          }}
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-xs font-medium transition',
                            active && templateId === GENERATED_ID
                              ? 'bg-zinc-900 text-white'
                              : 'border border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-white',
                          )}
                        >
                          {s.label}{' '}
                          <span
                            className={cn(
                              'text-[11px]',
                              active && templateId === GENERATED_ID
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
  );
}
