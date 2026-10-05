'use client';

import { ChevronDown, MessageSquare, SendHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Panel } from '@/components/ui/Panel';
import type { OfficeFeatureProps } from '@/features/office/types';
import { CharacterFace } from '@/features/workspace/CharacterPreview';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useCurrentRoom } from './useCurrentRoom';

const OFFICE = 'office';
const MAX_LENGTH = 500;
/** Show the character counter from here on. */
const COUNTER_FROM = 400;

/** A message as the API sends it (`chat:message`, GET /api/workspace/chat). */
interface ChatMessage {
  id: string;
  channel: string;
  userId: string;
  name: string;
  text: string;
  createdAt: string;
}

type SendAck = { ok: true; message: ChatMessage } | { ok: false; error: { code: string; message: string } };
type LoadState = { state: 'loading'; token: number } | { state: 'ready' } | { state: 'error'; message: string };

/** Adds messages to a channel, without duplicates, oldest first. */
function merge(list: ChatMessage[] = [], incoming: ChatMessage[]) {
  const seen = new Set(list.map((m) => m.id));
  const added = incoming.filter((m) => !seen.has(m.id));
  if (added.length === 0) return list;
  return [...list, ...added].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Text chat, bottom left above the "You" chip: the whole office, plus the room
 * you stand in (meeting room or lounge). Collapsed to a button with an unread
 * count. The server decides who may read and write each channel.
 */
export function ChatPanel({ socket, controller, workspace, people, myId }: OfficeFeatureProps) {
  const room = useCurrentRoom(controller, workspace.layout);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'office' | 'room'>('office');
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [loads, setLoads] = useState<Record<string, LoadState>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const channel = tab === 'room' && room ? room.id : OFFICE;

  // The live listener reads these without re-subscribing.
  const visible = useRef<string | null>(null);
  visible.current = open ? channel : null;

  // Live messages (ours come back too, for our other tabs).
  useEffect(() => {
    if (!socket) return;
    const onMessage = (m: ChatMessage) => {
      setMessages((all) => ({ ...all, [m.channel]: merge(all[m.channel], [m]) }));
      if (m.userId !== myId && visible.current !== m.channel) {
        setUnread((u) => ({ ...u, [m.channel]: (u[m.channel] ?? 0) + 1 }));
      }
    };
    // Back from a lost connection: we may have missed messages, reload when shown.
    const onConnect = () => setLoads({});
    socket.on('chat:message', onMessage);
    socket.on('connect', onConnect);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('connect', onConnect);
    };
  }, [socket, myId]);

  // A new room (or none): forget the old room's chat; its history loads again when shown.
  const roomId = room?.id ?? null;
  useEffect(() => {
    const keepOffice = <T,>(all: Record<string, T>): Record<string, T> => (OFFICE in all ? { [OFFICE]: all[OFFICE] } : {});
    setMessages(keepOffice);
    setLoads(keepOffice);
    setUnread(keepOffice);
    if (!roomId) setTab('office');
  }, [roomId]);

  // Load the history of the channel on screen, once (until we change rooms or reconnect).
  // Each request has a token: an answer that arrives after a reset is ignored.
  const loadState = loads[channel];
  const nextToken = useRef(0);
  useEffect(() => {
    if (!open || loadState) return;
    const token = ++nextToken.current;
    const settle = (next: LoadState) =>
      setLoads((l) => (l[channel]?.state === 'loading' && l[channel].token === token ? { ...l, [channel]: next } : l));
    setLoads((l) => ({ ...l, [channel]: { state: 'loading', token } }));
    api<{ messages: ChatMessage[] }>(`/workspace/chat?channel=${encodeURIComponent(channel)}`).then(
      ({ messages: history }) => {
        setMessages((all) => ({ ...all, [channel]: merge(all[channel], history) }));
        settle({ state: 'ready' });
      },
      (err) => settle({ state: 'error', message: err instanceof ApiError ? err.message : 'Could not load the messages.' }),
    );
  }, [open, channel, loadState]);

  // What's on screen is read.
  useEffect(() => {
    if (open && unread[channel]) setUnread((u) => omit(u, channel));
  }, [open, channel, unread]);

  const totalUnread = Object.values(unread).reduce((sum, n) => sum + n, 0);

  if (!open) {
    return (
      <Panel className="absolute bottom-20 left-4 p-1">
        <IconButton aria-label={totalUnread ? `Open chat, ${totalUnread} unread` : 'Open chat'} onClick={() => setOpen(true)} className="relative">
          <MessageSquare className="size-4" />
          {totalUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold text-white">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </IconButton>
      </Panel>
    );
  }

  const characterOf = (userId: string) => (userId === myId ? workspace.character : people.find((p) => p.id === userId)?.character);
  const tabs = [
    { key: 'office' as const, label: 'Office', channel: OFFICE },
    ...(room ? [{ key: 'room' as const, label: room.name, channel: room.id }] : []),
  ];

  return (
    <Panel className="absolute bottom-20 left-4 flex h-[min(26rem,calc(100dvh-11rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden sm:w-80">
      <div className="flex items-center gap-1 border-b border-zinc-200/70 p-1.5" role="tablist" aria-label="Chat channels">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex max-w-40 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition',
              tab === t.key ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-900/5',
            )}
          >
            <span className="truncate">{t.label}</span>
            {!!unread[t.channel] && tab !== t.key && <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="unread" />}
          </button>
        ))}
        <IconButton aria-label="Close chat" onClick={() => setOpen(false)} className="ml-auto size-8">
          <ChevronDown className="size-4" />
        </IconButton>
      </div>
      <MessageList
        key={channel}
        messages={messages[channel] ?? []}
        load={loadState}
        myId={myId}
        characterOf={characterOf}
        onRetry={() => setLoads((l) => omit(l, channel))}
        empty={channel === OFFICE ? 'Say hello to the office.' : `Only people in ${room?.name ?? 'this room'} see these messages.`}
      />
      <Composer
        key={`composer-${channel}`}
        socket={socket}
        channel={channel}
        placeholder={channel === OFFICE ? 'Message the office' : `Message ${room?.name ?? 'the room'}`}
        onSent={(m) => setMessages((all) => ({ ...all, [m.channel]: merge(all[m.channel], [m]) }))}
      />
    </Panel>
  );
}

function omit<T>(record: Record<string, T>, key: string) {
  const { [key]: _, ...rest } = record;
  return rest;
}

interface MessageListProps {
  messages: ChatMessage[];
  load: LoadState | undefined;
  myId: string;
  characterOf(userId: string): string | undefined;
  onRetry(): void;
  empty: string;
}

function MessageList({ messages, load, myId, characterOf, onRetry, empty }: MessageListProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Follow new messages, unless the reader scrolled up to read older ones.
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
        stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
      className="flex-1 space-y-1 overflow-y-auto px-3 py-2"
      aria-live="polite"
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
        // A new block when the sender changes or after a 5-minute pause.
        const head = !prev || prev.userId !== m.userId || Date.parse(m.createdAt) - Date.parse(prev.createdAt) > 5 * 60_000;
        return (
          <div key={m.id} className={cn('flex gap-2', mine && 'flex-row-reverse', head && 'pt-1.5')}>
            {!mine && (
              <div className="w-7 shrink-0">{head && <Face character={characterOf(m.userId)} name={m.name} />}</div>
            )}
            <div className={cn('flex min-w-0 flex-col', mine ? 'items-end' : 'items-start')}>
              {head && (
                <p className="px-1 pb-0.5 text-[11px] text-zinc-500">
                  {!mine && <span className="mr-1.5 font-semibold text-zinc-700">{m.name}</span>}
                  <time dateTime={m.createdAt}>{timeOf(m.createdAt)}</time>
                </p>
              )}
              <p
                className={cn(
                  'max-w-60 rounded-2xl px-3 py-1.5 text-sm break-words whitespace-pre-wrap',
                  mine ? 'rounded-tr-md bg-emerald-600 text-white' : 'rounded-tl-md bg-white text-zinc-800 shadow-sm',
                  !head && (mine ? 'rounded-tr-2xl' : 'rounded-tl-2xl'),
                )}
                title={timeOf(m.createdAt)}
              >
                {m.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Face({ character, name }: { character: string | undefined; name: string }) {
  if (character) return <CharacterFace character={character} className="size-7" />;
  // Not in the office right now: their initial.
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600" aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

interface ComposerProps {
  socket: OfficeFeatureProps['socket'];
  channel: string;
  placeholder: string;
  onSent(message: ChatMessage): void;
}

function Composer({ socket, channel, placeholder, onSent }: ComposerProps) {
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
    socket.timeout(5000).emit('chat:send', { channel, text }, (err: Error | null, ack?: SendAck) => {
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
            // Enter sends, Shift+Enter is a new line, Escape gives the keys back to the game.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            } else if (e.key === 'Escape') {
              e.currentTarget.blur();
            }
          }}
          rows={1}
          maxLength={MAX_LENGTH}
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
      {text.length >= COUNTER_FROM && (
        <p className={cn('px-1 pt-1 text-right text-[11px]', text.length >= MAX_LENGTH ? 'text-red-600' : 'text-zinc-500')}>
          {text.length}/{MAX_LENGTH}
        </p>
      )}
    </form>
  );
}
