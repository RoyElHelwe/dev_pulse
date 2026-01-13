'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Shield, ExternalLink, CheckCircle2, Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BlockchainBadgeProps {
  verified: boolean;
  txHash?: string;
  pending?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  network?: string;
  className?: string;
}

export function BlockchainBadge({
  verified,
  txHash,
  pending = false,
  size = 'md',
  showLabel = false,
  network = 'sepolia',
  className,
}: BlockchainBadgeProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  const explorerUrl = txHash
    ? network === 'mainnet'
      ? `https://etherscan.io/tx/${txHash}`
      : `https://${network}.etherscan.io/tx/${txHash}`
    : null;

  if (pending) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex items-center gap-2 cursor-default',
                className
              )}
            >
              <div
                className={cn(
                  'rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center',
                  sizeClasses[size]
                )}
              >
                <Loader2
                  className={cn(
                    'text-yellow-600 dark:text-yellow-400 animate-spin',
                    iconSizes[size]
                  )}
                />
              </div>
              {showLabel && (
                <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                  Recording...
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Recording to blockchain...</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!verified) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-2 group',
                className
              )}
            >
              <div
                className={cn(
                  'rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg',
                  'group-hover:shadow-emerald-500/50 transition-shadow',
                  sizeClasses[size]
                )}
              >
                <Shield className={cn('text-white', iconSizes[size])} />
              </div>
              {showLabel && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  Verified <ExternalLink className="w-3 h-3" />
                </span>
              )}
            </a>
          ) : (
            <div
              className={cn(
                'flex items-center gap-2 cursor-default',
                className
              )}
            >
              <div
                className={cn(
                  'rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg',
                  sizeClasses[size]
                )}
              >
                <Shield className={cn('text-white', iconSizes[size])} />
              </div>
              {showLabel && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  Verified
                </span>
              )}
            </div>
          )}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="font-medium">Blockchain Verified</span>
            </div>
            {txHash && (
              <p className="text-xs text-gray-400 font-mono">
                TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </p>
            )}
            <p className="text-xs text-gray-400">
              This task completion is permanently recorded on the blockchain.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Animated version for celebration
export function BlockchainVerifiedAnimation({ onComplete }: { onComplete?: () => void }) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="relative">
        {/* Ripple effects */}
        <div className="absolute inset-0 animate-ping">
          <div className="w-32 h-32 rounded-full bg-emerald-500/20" />
        </div>
        <div className="absolute inset-0 animate-ping animation-delay-150">
          <div className="w-32 h-32 rounded-full bg-teal-500/20" />
        </div>
        
        {/* Main badge */}
        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/50 animate-bounce">
          <Shield className="w-16 h-16 text-white" />
        </div>
        
        {/* Text */}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
          <p className="text-lg font-bold text-emerald-500 animate-pulse">
            🎉 Recorded on Blockchain!
          </p>
        </div>

        {/* Confetti-like particles */}
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full animate-ping"
            style={{
              backgroundColor: ['#10b981', '#14b8a6', '#0d9488', '#059669'][i % 4],
              top: `${50 + 40 * Math.sin((i * Math.PI * 2) / 12)}%`,
              left: `${50 + 40 * Math.cos((i * Math.PI * 2) / 12)}%`,
              animationDelay: `${i * 100}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
