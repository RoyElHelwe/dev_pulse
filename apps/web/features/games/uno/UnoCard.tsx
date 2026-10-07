'use client';

import { cn } from '@/lib/cn';
import type { Card, Value } from './types';

export function getCardSymbol(value: Value): string {
  switch (value) {
    case 'skip':
      return '⊘';
    case 'reverse':
      return '⇄';
    case 'draw2':
      return '+2';
    case 'wild':
      return '★';
    case 'wild4':
      return '+4';
    default:
      return value;
  }
}

const COLOR_CLASSES: Record<string, string> = {
  red: 'bg-red-600 text-white border-red-700/60 shadow-red-950/10',
  yellow: 'bg-yellow-400 text-zinc-950 border-yellow-500/60 shadow-yellow-950/10',
  green: 'bg-green-600 text-white border-green-700/60 shadow-green-950/10',
  blue: 'bg-blue-600 text-white border-blue-700/60 shadow-blue-950/10',
  wild: 'bg-zinc-800 text-white border-zinc-900 shadow-black/20',
};

interface UnoCardProps {
  card: Card;
  disabled?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isButton?: boolean;
}

export function UnoCard({
  card,
  disabled = false,
  onClick,
  size = 'md',
  className,
  isButton = false,
}: UnoCardProps) {
  const symbol = getCardSymbol(card.value);
  const colorClass = COLOR_CLASSES[card.color] || COLOR_CLASSES.wild;

  const sizeClasses = {
    sm: 'w-11 h-16 rounded-lg text-xs p-1',
    md: 'w-14 h-20 sm:w-16 sm:h-24 rounded-xl text-sm p-1.5',
    lg: 'w-20 h-28 sm:w-24 sm:h-34 rounded-2xl text-base p-2',
  }[size];

  const centerTextSize = {
    sm: 'text-base font-black',
    md: 'text-xl sm:text-2xl font-black',
    lg: 'text-3xl sm:text-4xl font-black',
  }[size];

  const cornerTextSize = {
    sm: 'text-[9px] font-bold',
    md: 'text-[11px] font-bold',
    lg: 'text-xs font-bold',
  }[size];

  const content = (
    <div
      className={cn(
        'relative flex flex-col justify-between items-center select-none border-2 shadow-md overflow-hidden',
        colorClass,
        sizeClasses,
        disabled && 'opacity-40 grayscale-[25%] cursor-not-allowed',
        !disabled && isButton && 'hover:-translate-y-1.5 hover:shadow-lg active:scale-95 transition-all cursor-pointer ring-0 hover:ring-2 hover:ring-white/80',
        className,
      )}
    >
      {/* Top-left corner */}
      <span className={cn('self-start leading-none', cornerTextSize)} aria-hidden="true">
        {symbol}
      </span>

      {/* Center symbol with oval background highlight */}
      <div className="relative flex items-center justify-center">
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-black/10 dark:bg-white/10 px-2 py-0.5 leading-none tracking-tight drop-shadow-sm',
            centerTextSize,
          )}
        >
          {symbol}
        </span>
      </div>

      {/* Bottom-right corner (inverted) */}
      <span className={cn('self-end leading-none rotate-180', cornerTextSize)} aria-hidden="true">
        {symbol}
      </span>
    </div>
  );

  if (isButton) {
    return (
      <button
        type="button"
        data-testid={`uno-card-${card.id}`}
        aria-label={`Play ${card.color} ${card.value}`}
        disabled={disabled}
        onClick={onClick}
        className="focus:outline-hidden disabled:pointer-events-none"
      >
        {content}
      </button>
    );
  }

  return content;
}
