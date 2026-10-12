'use client';

// Scrollable conversation history container with automatic pinning and grouping.
// Fits into ChatPanel to display loaded channel messages and fetch states.

import { memo, useEffect, useRef } from 'react';
import { type ChatMessage, ChatMessageItem } from './ChatMessageItem';

const SCROLL_STICKY_THRESHOLD_PX = 40;
const MESSAGE_GROUP_TIME_GAP_MS = 5 * 60_000;

/** Asynchronous fetch state for conversation history, distinguishing pending requests, ready data, and load errors. */
export type LoadState = { state: 'loading'; token: number } | { state: 'ready' } | { state: 'error'; message: string };

interface ChatMessageListProps {
  messages: ChatMessage[];
  load: LoadState | undefined;
  myId: string;
  /** userId → character, for the faces. */
  characters: ReadonlyMap<string, string>;
  onRetry(): void;
  empty: string;
}

/** Renders the scrollable message list with auto-scroll and status banners. */
export const ChatMessageList = memo(function ChatMessageList({ messages, load, myId, characters, onRetry, empty }: ChatMessageListProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Track whether viewport is pinned to bottom so incoming messages only auto-scroll if user hasn't scrolled up.
  const stuck = useRef(true);
  const last = messages.at(-1);

  useEffect(() => {
    const el = ref.current;
    if (el && (stuck.current || last?.userId === myId)) el.scrollTop = el.scrollHeight;
  }, [last?.id, last?.userId, myId]);

  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_STICKY_THRESHOLD_PX;
      }}
      className="flex-1 space-y-1 overflow-y-auto px-3 py-2"
      role="log"
      aria-label="Messages"
    >
      {load?.state === 'loading' && messages.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">Loading…</p>}
      {load?.state === 'error' && (
        <p className="py-2 text-center text-sm text-red-600">
          {load.message}{' '}
          <button type="button" onClick={onRetry} className="font-medium underline">
            Retry
          </button>
        </p>
      )}
      {load?.state === 'ready' && messages.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">{empty}</p>}
      {messages.map((m, i) => {
        const mine = m.userId === myId;
        const prev = messages[i - 1];
        // Start a new message group if sender changes or if there is a lull in conversation.
        const head = !prev || prev.userId !== m.userId || Date.parse(m.createdAt) - Date.parse(prev.createdAt) > MESSAGE_GROUP_TIME_GAP_MS;
        return (
          <ChatMessageItem
            key={m.id}
            message={m}
            isMine={mine}
            isHeader={head}
            character={characters.get(m.userId)}
          />
        );
      })}
    </div>
  );
});
