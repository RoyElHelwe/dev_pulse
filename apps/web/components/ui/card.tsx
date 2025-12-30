import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  title?: string
}

export function Card({ children, className, title }: CardProps) {
  return (
    <div className={cn('rounded-(--radius) border border-border bg-card p-6 shadow-sm', className)}>
      {title && <h3 className="mb-4 text-lg font-semibold text-card-foreground">{title}</h3>}
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return <div className={cn('mb-4', className)}>{children}</div>
}

interface CardTitleProps {
  children: ReactNode
  className?: string
}

export function CardTitle({ children, className }: CardTitleProps) {
  return <h3 className={cn('text-lg font-semibold text-card-foreground', className)}>{children}</h3>
}

interface CardContentProps {
  children: ReactNode
  className?: string
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn('', className)}>{children}</div>
}
