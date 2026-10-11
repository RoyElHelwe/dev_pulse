'use client';

// Single message bubble rendering sender avatar, timestamp, and text content.
// Fits into ChatMessageList to display conversation entries.

import { CharacterFace } from '@/features/workspace/CharacterPreview';
import { cn } from '@/lib/cn';

/** A message as the API sends it (`chat:message`, GET /api/workspace/chat). */
export interface ChatMessage {
  id: string;
  channel: string;
  userId: string;
  name: string;
  text: string;
  createdAt: string;
}

interface ChatMessageItemProps {
  message: ChatMessage;
  isMine: boolean;
  isHeader: boolean;
  character: string | undefined;
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Renders an individual chat message entry with optional author header and avatar. */
export function ChatMessageItem({ message, isMine, isHeader, character }: ChatMessageItemProps) {
  return (
    <div className={cn('flex gap-2', isMine && 'flex-row-reverse', isHeader && 'pt-1.5')}>
      {!isMine && (
        <div className="w-7 shrink-0">{isHeader && <Face character={character} name={message.name} />}</div>
      )}
      <div className={cn('flex min-w-0 flex-col', isMine ? 'items-end' : 'items-start')}>
        {isHeader && (
          <p className="px-1 pb-0.5 text-[11px] text-zinc-500">
            {!isMine && <span className="mr-1.5 font-semibold text-zinc-700">{message.name}</span>}
            <time dateTime={message.createdAt}>{timeOf(message.createdAt)}</time>
          </p>
        )}
        <p
          className={cn(
            'max-w-60 rounded-2xl px-3 py-1.5 text-sm break-words whitespace-pre-wrap',
            isMine ? 'rounded-tr-md bg-emerald-600 text-white' : 'rounded-tl-md bg-white text-zinc-800 shadow-sm',
            !isHeader && (isMine ? 'rounded-tr-2xl' : 'rounded-tl-2xl'),
          )}
          title={timeOf(message.createdAt)}
        >
          {message.text}
        </p>
      </div>
    </div>
  );
}

function Face({ character, name }: { character: string | undefined; name: string }) {
  if (character) return <CharacterFace character={character} className="size-7" />;
  // Avatar fallback for workspace members currently offline: initial letter.
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600" aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
