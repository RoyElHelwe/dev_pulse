'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface ToastProps {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'success' | 'warning' | 'destructive'
  duration?: number
  onClose: (id: string) => void
}

const variantStyles = {
  default: 'bg-background border-border',
  success: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
  warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800',
  destructive: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
}

const iconStyles = {
  default: null,
  success: (
    <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  destructive: (
    <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
}

function Toast({ id, title, description, variant = 'default', duration = 5000, onClose }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id)
    }, duration)

    return () => clearTimeout(timer)
  }, [id, duration, onClose])

  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full max-w-sm gap-3 rounded-lg border p-4 shadow-lg',
        'animate-in slide-in-from-right-full duration-300',
        variantStyles[variant]
      )}
      role="alert"
    >
      {iconStyles[variant] && <div className="shrink-0">{iconStyles[variant]}</div>}
      <div className="flex-1">
        {title && <p className="font-medium">{title}</p>}
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <button
        type="button"
        className="shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => onClose(id)}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// Toast Context and Provider
interface ToastItem {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'success' | 'warning' | 'destructive'
  duration?: number
}

interface ToastContextValue {
  toasts: ToastItem[]
  toast: (options: Omit<ToastItem, 'id'>) => void
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const toast = React.useCallback((options: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts(prev => [...prev, { ...options, id }])
  }, [])

  const dismiss = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <Toast
            key={t.id}
            id={t.id}
            title={t.title}
            description={t.description}
            variant={t.variant}
            duration={t.duration}
            onClose={dismiss}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
