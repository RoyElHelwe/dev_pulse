import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  message?: string
}

export function LoadingSpinner({ size = 'md', className, message }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-12 w-12 border-4',
    lg: 'h-16 w-16 border-4'
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className={cn(
          'animate-spin rounded-full border-primary border-t-transparent',
          sizeClasses[size],
          className
        )}
      />
      {message && <p className="mt-4 text-muted-foreground">{message}</p>}
    </div>
  )
}
