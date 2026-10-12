// Utility component displaying a read-only link alongside a clipboard copy button.
// Used in team invitation flows and shareable links.

'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface CopyLinkProps {
  link: string;
}

/** Displays a URL in a styled container with a one-click copy button. */
export function CopyLink({ link }: CopyLinkProps) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl bg-zinc-50 p-1.5 pl-3 ring-1 ring-zinc-200">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-700">{link}</code>
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
