'use client';

// A shortened transaction hash or address: copy it, and (for transactions) open its on-chain proof.

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { shortHex } from './types';

/** "0x1a2b…9f0e" with a copy button; clicking the text calls `onOpen` when given. */
export function Hash({ value, onOpen }: { value: string; onOpen?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {},
    );
  };
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="rounded text-emerald-700 underline decoration-dotted underline-offset-2 hover:text-emerald-900"
          title="See it on-chain"
        >
          {shortHex(value)}
        </button>
      ) : (
        <span title={value}>{shortHex(value)}</span>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label="Copy"
        title={copied ? 'Copied' : 'Copy'}
        className="rounded p-0.5 text-zinc-400 hover:text-zinc-700"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </span>
  );
}
