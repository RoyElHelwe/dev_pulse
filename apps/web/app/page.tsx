import { ArrowRight, Headphones, KanbanSquare, Users } from 'lucide-react';
import Link from 'next/link';
import { StackStatus } from '@/components/StackStatus';
import { buttonStyles } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';

const FEATURES = [
  { icon: Users, title: 'Walk up to anyone', text: 'See who is around and join them, like in a real office.' },
  { icon: Headphones, title: 'Talk by proximity', text: 'Voices fade in as you get closer. Meeting rooms keep calls private.' },
  { icon: KanbanSquare, title: 'Work from your desk', text: 'Your tasks live at your desk, updated live for the whole team.' },
];

export default function HomePage() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(16_185_129/0.14),transparent)]" />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Link href="/office" className={buttonStyles('secondary', 'sm')}>
          Open the office
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
        <section className="max-w-2xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Your team, in one place
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            The office, without the commute.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-pretty text-zinc-600">
            Dev Pulse puts your remote team in a shared 2D office. Walk around, talk to whoever is
            nearby, meet in a room and keep your tasks moving.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/office" className={buttonStyles('primary', 'lg')}>
              Enter the office <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200/80">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-zinc-600">{text}</p>
            </article>
          ))}
        </section>

        <section className="mt-12 max-w-sm">
          <StackStatus />
        </section>
      </main>
    </div>
  );
}
