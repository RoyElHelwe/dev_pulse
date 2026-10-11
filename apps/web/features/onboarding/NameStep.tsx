// First step of the office creation wizard collecting the office name.
// Rendered within OnboardingWizard when step is 0.

'use client';

import { TextField } from '@/components/ui/TextField';

/** Maximum character length allowed for office names. */
const MAX_OFFICE_NAME_LENGTH = 40;

interface NameStepProps {
  name: string;
  onChangeName: (name: string) => void;
  error?: string;
  onSubmit: () => void;
}

/** Step 0 input form for defining the name of the new office workspace. */
export function NameStep({ name, onChangeName, error, onSubmit }: NameStepProps) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Name your office</h1>
      <p className="mt-1 text-zinc-600">
        Usually the name of your team or company. You can change it later.
      </p>
      <form
        className="mt-6 sm:max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <TextField
          label="Office name"
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          autoFocus
          maxLength={MAX_OFFICE_NAME_LENGTH}
          error={error}
          placeholder="e.g. Pixel Studio"
        />
      </form>
    </>
  );
}
