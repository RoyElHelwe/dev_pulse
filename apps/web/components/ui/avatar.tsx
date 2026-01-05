'use client'

import { cn } from '@/lib/utils'

interface AvatarProps {
  src?: string | null
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showStatus?: boolean
  status?: 'online' | 'offline' | 'away' | 'busy'
}

const sizeClasses = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-16 w-16 text-xl',
}

const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
}

const statusSizeClasses = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
  xl: 'h-4 w-4',
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const colors = [
    'bg-blue-500',
    'bg-indigo-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
  ]
  
  return colors[Math.abs(hash) % colors.length]
}

export function Avatar({ 
  src, 
  name, 
  size = 'md', 
  className,
  showStatus = false,
  status = 'offline'
}: AvatarProps) {
  const initials = getInitials(name)
  const bgColor = stringToColor(name)

  return (
    <div className={cn('relative inline-flex', className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={cn(
            'rounded-full object-cover ring-2 ring-background',
            sizeClasses[size]
          )}
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-background',
            sizeClasses[size],
            bgColor
          )}
        >
          {initials}
        </div>
      )}
      
      {showStatus && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-background',
            statusSizeClasses[size],
            statusColors[status]
          )}
        />
      )}
    </div>
  )
}

// Avatar Group for showing multiple avatars stacked
interface AvatarGroupProps {
  users: { name: string; src?: string | null }[]
  max?: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

export function AvatarGroup({ users, max = 4, size = 'sm', className }: AvatarGroupProps) {
  const displayUsers = users.slice(0, max)
  const remaining = users.length - max

  return (
    <div className={cn('flex -space-x-2', className)}>
      {displayUsers.map((user, index) => (
        <Avatar
          key={index}
          name={user.name}
          src={user.src}
          size={size}
        />
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-background',
            sizeClasses[size]
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  )
}
