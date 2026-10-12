// Third step of the onboarding wizard allowing users to customize their pixel avatar.
// Rendered within OnboardingWizard when step is 2.

'use client';

import { CharacterStudio } from '@/features/workspace/CharacterStudio';

interface CharacterStepProps {
  character: string;
  onChangeCharacter: (character: string) => void;
}

/** Step 2 avatar customizer letting users configure their appearance before joining the office. */
export function CharacterStep({ character, onChangeCharacter }: CharacterStepProps) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose your character</h1>
      <p className="mt-1 text-zinc-600">This is how your team sees you in the office.</p>
      <CharacterStudio value={character} onChange={onChangeCharacter} className="mt-6" />
    </>
  );
}
