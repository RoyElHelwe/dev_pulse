"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

interface AvatarProps extends Omit<React.ComponentProps<typeof AvatarPrimitive.Root>, 'size'> {
  name?: string
  size?: 'sm' | 'md' | 'lg'
  showStatus?: boolean
  status?: 'online' | 'offline' | 'away' | 'busy'
}

function Avatar({
  className,
  name,
  size,
  showStatus,
  status,
  ...props
}: AvatarProps) {
  const sizeClasses = {
    sm: 'size-8',
    md: 'size-10',
    lg: 'size-12'
  }
  
  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    away: 'bg-yellow-500',
    busy: 'bg-red-500'
  }

  return (
    <div className="relative inline-block">
      <AvatarPrimitive.Root
        data-slot="avatar"
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full",
          sizeClasses[size || 'sm'],
          className
        )}
        {...props}
      />
      {showStatus && status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-background",
            statusColors[status],
            size === 'lg' ? 'size-3' : size === 'md' ? 'size-2.5' : 'size-2'
          )}
        />
      )}
    </div>
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
