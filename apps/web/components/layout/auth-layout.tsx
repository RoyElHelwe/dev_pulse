import { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
  title: string
  description: string
}

export default function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-primary via-primary to-[hsl(var(--chart-3))] p-4">
      <div className="w-full max-w-md rounded-(--radius) bg-card p-8 shadow-xl border border-border">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-card-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </div>
  )
}
