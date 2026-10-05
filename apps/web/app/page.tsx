import { StackStatus } from '@/components/StackStatus';

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-bold">Dev Pulse</h1>
      <p className="text-slate-400">
        Infrastructure is up. Each feature (auth, onboarding, office, tasks, voice…) gets built on
        top of this skeleton — see <code>docs/PLAN.md</code>.
      </p>
      <StackStatus />
    </main>
  );
}
