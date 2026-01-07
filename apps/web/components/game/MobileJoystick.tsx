'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { PlayerDirection } from '@/lib/game/types'

interface MobileJoystickProps {
  onMove: (direction: PlayerDirection | null, velocity: { x: number; y: number }) => void
  size?: number
  className?: string
}

export function MobileJoystick({ onMove, size = 120, className = '' }: MobileJoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const knobSize = size * 0.4
  const maxDistance = (size - knobSize) / 2

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    let deltaX = clientX - centerX
    let deltaY = clientY - centerY

    // Calculate distance from center
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    // Limit to max distance
    if (distance > maxDistance) {
      deltaX = (deltaX / distance) * maxDistance
      deltaY = (deltaY / distance) * maxDistance
    }

    setPosition({ x: deltaX, y: deltaY })

    // Calculate normalized velocity (-1 to 1)
    const normalizedX = deltaX / maxDistance
    const normalizedY = deltaY / maxDistance

    // Determine direction based on dominant axis
    let direction: PlayerDirection | null = null
    if (distance > 10) {
      if (Math.abs(normalizedX) > Math.abs(normalizedY)) {
        direction = normalizedX > 0 ? 'right' : 'left'
      } else {
        direction = normalizedY > 0 ? 'down' : 'up'
      }
    }

    onMove(direction, { x: normalizedX, y: normalizedY })
  }, [maxDistance, onMove])

  const handleStart = useCallback((clientX: number, clientY: number) => {
    setIsActive(true)
    handleMove(clientX, clientY)
  }, [handleMove])

  const handleEnd = useCallback(() => {
    setIsActive(false)
    setPosition({ x: 0, y: 0 })
    onMove(null, { x: 0, y: 0 })
  }, [onMove])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Touch events
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.touches[0]
      handleStart(touch.clientX, touch.clientY)
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (!isActive) return
      const touch = e.touches[0]
      handleMove(touch.clientX, touch.clientY)
    }

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault()
      handleEnd()
    }

    // Mouse events (for testing on desktop)
    const handleMouseDown = (e: MouseEvent) => {
      handleStart(e.clientX, e.clientY)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isActive) return
      handleMove(e.clientX, e.clientY)
    }

    const handleMouseUp = () => {
      handleEnd()
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: false })
    container.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isActive, handleStart, handleMove, handleEnd])

  return (
    <div
      ref={containerRef}
      className={`relative rounded-full bg-gray-800/50 backdrop-blur-sm border-2 border-gray-600/50 touch-none select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Direction indicators */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute top-2 text-gray-400/50 text-xs">▲</div>
        <div className="absolute bottom-2 text-gray-400/50 text-xs">▼</div>
        <div className="absolute left-2 text-gray-400/50 text-xs">◀</div>
        <div className="absolute right-2 text-gray-400/50 text-xs">▶</div>
      </div>
      
      {/* Knob */}
      <div
        className={`absolute rounded-full bg-white shadow-lg transition-transform ${
          isActive ? 'scale-110' : ''
        }`}
        style={{
          width: knobSize,
          height: knobSize,
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
        }}
      >
        <div className="absolute inset-1 rounded-full bg-gradient-to-br from-gray-100 to-gray-300" />
      </div>
    </div>
  )
}
