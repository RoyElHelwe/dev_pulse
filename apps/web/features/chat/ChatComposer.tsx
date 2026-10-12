'use client';

// Message input field and send button with character counting and hotkey submission.
// Fits into ChatPanel at the bottom of the active conversation tab.

import { SendHorizontal } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/cn';
import type { ChatMessage } from './ChatMessageItem';

const MAX_MESSAGE_LENGTH_CHARS = 500;
const COUNTER_THRESHOLD_CHARS = 400;
const SEND_ACK_TIMEOUT_MS = 5000;

type SendAck = { ok: true; message: ChatMessage } | { ok: false; error: { code: string; message: string } };

interface ChatComposerProps {
  socket: Socket | null;
  channel: string;
  placeholder: string;
  onSent(message: ChatMessage): void;
}

/** Renders the message textarea form with socket dispatch and length validation. */
export function ChatComposer({ socket, channel, placeholder, onSent }: ChatComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const length = text.trim().length;

  function send() {
    if (!socket || sending || length === 0) return;
    if (!socket.connected) return setError('Not connected. Wait a moment and try again.');
    setSending(true);
    setError('');
    socket.timeout(SEND_ACK_TIMEOUT_MS).emit('chat:send', { channel, text }, (err: Error | null, ack?: SendAck) => {
      setSending(false);
      if (err || !ack) return setError('The message was not sent. Try again.');
      if (!ack.ok) return setError(ack.error.message);
      setText('');
      onSent(ack.message);
      inputRef.current?.focus();
    });
  }

  return (
    <form
      className="border-t border-zinc-200/70 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      {error && (
        <p role="alert" className="px-1 pb-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
      <div className="flex items-end gap-1.5">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={(e) => {
            // Dispatch on plain Enter while allowing Shift+Enter for line breaks and ignoring IME composition events.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH_CHARS}
          placeholder={placeholder}
          aria-label={placeholder}
          className="field-sizing-content max-h-28 min-h-9 min-w-0 flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-base outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 sm:text-sm"
        />
        <IconButton
          type="submit"
          aria-label="Send"
          disabled={sending || length === 0 || !socket}
          className="size-9 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white disabled:opacity-50"
        >
          <SendHorizontal className="size-4" />
        </IconButton>
      </div>
      {text.length >= COUNTER_THRESHOLD_CHARS && (
        <p className={cn('px-1 pt-1 text-right text-[11px]', text.length >= MAX_MESSAGE_LENGTH_CHARS ? 'text-red-600' : 'text-zinc-500')}>
          {text.length}/{MAX_MESSAGE_LENGTH_CHARS}
        </p>
      )}
    </form>
  );
}
