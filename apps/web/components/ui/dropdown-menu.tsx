'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface DropdownContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null)

function useDropdown() {
  const context = React.useContext(DropdownContext)
  if (!context) {
    throw new Error('Dropdown components must be used within a DropdownMenu')
  }
  return context
}

interface DropdownMenuProps {
  children: React.ReactNode
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={ref} className="relative inline-block">
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

interface DropdownTriggerProps {
  children: React.ReactNode
  className?: string
  asChild?: boolean
}

export function DropdownTrigger({ children, className, asChild }: DropdownTriggerProps) {
  const { open, setOpen } = useDropdown()

  const handleClick = () => setOpen(!open)

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
      'aria-expanded': open,
      'aria-haspopup': 'menu',
    })
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      aria-expanded={open}
      aria-haspopup="menu"
    >
      {children}
    </button>
  )
}

interface DropdownContentProps {
  children: React.ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

export function DropdownContent({ 
  children, 
  className,
  align = 'end',
  sideOffset = 4
}: DropdownContentProps) {
  const { open } = useDropdown()

  if (!open) return null

  const alignmentClasses = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  }

  return (
    <div
      className={cn(
        'absolute z-50 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95',
        alignmentClasses[align],
        className
      )}
      style={{ marginTop: sideOffset }}
      role="menu"
    >
      {children}
    </div>
  )
}

interface DropdownItemProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
  destructive?: boolean
}

export function DropdownItem({ 
  children, 
  className, 
  onClick,
  disabled = false,
  destructive = false
}: DropdownItemProps) {
  const { setOpen } = useDropdown()

  const handleClick = () => {
    if (disabled) return
    onClick?.()
    setOpen(false)
  }

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:outline-none focus:bg-accent focus:text-accent-foreground',
        disabled && 'opacity-50 cursor-not-allowed',
        destructive && 'text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10',
        className
      )}
      onClick={handleClick}
      disabled={disabled}
      role="menuitem"
    >
      {children}
    </button>
  )
}

export function DropdownSeparator({ className }: { className?: string }) {
  return <div className={cn('my-1 h-px bg-border', className)} role="separator" />
}

export function DropdownLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-3 py-1.5 text-xs font-medium text-muted-foreground', className)}>
      {children}
    </div>
  )
}
