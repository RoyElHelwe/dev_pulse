'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { useEscape } from '@/lib/escape';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEscape(open, onClose);

  if (!open || !mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-900/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-captures-keys=""
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        className={cn(
          'relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xl',
          className,
        )}
      >
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
