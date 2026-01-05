import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
  size?: 'sm' | 'md'
  className?: string
}

const variantClasses = {
  default: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  success: 'bg-green-500/10 text-green-600 border-green-500/20',
  warning: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  destructive: 'bg-destructive/10 text-destructive border-destructive/20',
  outline: 'bg-transparent border-border text-foreground',
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-sm',
}

export function Badge({ 
  children, 
  variant = 'default', 
  size = 'sm',
  className 
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium border',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  )
}
