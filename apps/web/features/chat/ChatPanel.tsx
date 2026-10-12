'use client';

// Floating text chat HUD panel supporting global office and room-scoped channels.
// Coordinates channel history loading, real-time socket events, and chat subcomponents.

import { MessageSquare } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Panel } from '@/components/ui/Panel';
import type { OfficeFeatureProps } from '@/features/office/types';
import { api, ApiError } from '@/lib/api';
import { useEscape } from '@/lib/escape';
import { useKeybind, useKeyName } from '@/features/settings/keybindStore';
import { ChatComposer } from './ChatComposer';
import type { ChatMessage } from './ChatMessageItem';
import { ChatMessageList, type LoadState } from './ChatMessageList';
import { ChatTabs, type ChatTabItem } from './ChatTabs';
import { useCurrentRoom } from './useCurrentRoom';

const OFFICE_CHANNEL_ID = 'office';
const MAX_DISPLAYED_UNREAD_COUNT = 99;
const EMPTY_MESSAGE_LIST: ChatMessage[] = [];

/** Adds messages to a channel without duplicates, sorted oldest first. */
function merge(list: ChatMessage[] = [], incoming: ChatMessage[]) {
  const seen = new Set(list.map((m) => m.id));
  const added = incoming.filter((m) => !seen.has(m.id));
  if (added.length === 0) return list;
  return [...list, ...added].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function omit<T>(record: Record<string, T>, key: string) {
  const { [key]: _, ...rest } = record;
  return rest;
}

/** Renders the chat HUD toggle button and collapsible multi-channel messaging panel. */
export function ChatPanel({ socket, controller, workspace, people, myId, editing }: OfficeFeatureProps) {
  const room = useCurrentRoom(controller, workspace.layout);
  const roomId = room?.id ?? null;
  const [open, setOpen] = useState(false);
  useKeybind('chat', () => setOpen((o) => !o), !editing);
  const chatKey = useKeyName('chat');
  const [tab, setTab] = useState<'office' | 'room'>('office');
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [loads, setLoads] = useState<Record<string, LoadState>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const channel = tab === 'room' && room ? room.id : OFFICE_CHANNEL_ID;

  useEscape(open, () => {
    setOpen(false);
    (document.activeElement as HTMLElement)?.blur();
  });

  // Keep ref updated so socket message listener can read current view state without re-attaching.
  const visible = useRef<string | null>(null);
  const shown = open && !editing;
  visible.current = shown ? channel : null;
  const roomRef = useRef(roomId);
  roomRef.current = roomId;
  const controllerRef = useRef(controller);
  controllerRef.current = controller;

  // Real-time chat messages via socket.
  useEffect(() => {
    if (!socket) return;
    const onMessage = (m: ChatMessage) => {
      // Discard messages for rooms already left to avoid incrementing unread counters on hidden views.
      if (m.channel !== OFFICE_CHANNEL_ID && m.channel !== roomRef.current) return;
      // Show speech bubbles above player avatars regardless of whether panel is expanded.
      controllerRef.current?.showChat(m.userId, m.text);
      setMessages((all) => ({ ...all, [m.channel]: merge(all[m.channel], [m]) }));
      if (m.userId !== myId && visible.current !== m.channel) {
        setUnread((u) => ({ ...u, [m.channel]: (u[m.channel] ?? 0) + 1 }));
      }
    };
    // Reconnection: reset load caches to re-fetch any missed messages when views open.
    const onConnect = () => setLoads({});
    socket.on('chat:message', onMessage);
    socket.on('connect', onConnect);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('connect', onConnect);
    };
  }, [socket, myId]);

  // Purge room chat history when moving between rooms; office history is retained.
  useEffect(() => {
    const keepOffice = <T,>(all: Record<string, T>): Record<string, T> => (OFFICE_CHANNEL_ID in all ? { [OFFICE_CHANNEL_ID]: all[OFFICE_CHANNEL_ID] } : {});
    setMessages(keepOffice);
    setLoads(keepOffice);
    setUnread(keepOffice);
    if (!roomId) setTab('office');
  }, [roomId]);

  // Lazy-load history for active channel with cancellation token to ignore stale HTTP responses.
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

  // Clear unread badge for the currently visible channel.
  useEffect(() => {
    if (shown && unread[channel]) setUnread((u) => omit(u, channel));
  }, [shown, channel, unread]);

  const totalUnread = Object.values(unread).reduce((sum, n) => sum + n, 0);
  const characters = useMemo(
    () => new Map([...people.map((p) => [p.id, p.character] as const), [myId, workspace.character] as const]),
    [people, myId, workspace.character],
  );
  const retry = useCallback(() => setLoads((l) => omit(l, channel)), [channel]);
  const ids = useId();

  if (editing) return null;
  if (!open) {
    return (
      <Panel className="absolute bottom-20 left-4 p-1">
        <IconButton
          aria-label={totalUnread ? `Open chat, ${totalUnread} unread` : 'Open chat'}
          title={`Chat (${chatKey})`}
          onClick={() => setOpen(true)}
          className="relative"
        >
          <MessageSquare className="size-4" />
          {totalUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold text-white">
              {totalUnread > MAX_DISPLAYED_UNREAD_COUNT ? '99+' : totalUnread}
            </span>
          )}
        </IconButton>
      </Panel>
    );
  }

  const tabs: ChatTabItem[] = [
    { key: 'office', label: 'Office', channel: OFFICE_CHANNEL_ID },
    ...(room ? [{ key: 'room' as const, label: room.name, channel: room.id }] : []),
  ];

  return (
    <Panel className="absolute bottom-20 left-4 flex h-[min(26rem,calc(100dvh-11rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden sm:w-80">
      <ChatTabs
        tabs={tabs}
        activeTab={tab}
        unread={unread}
        panelIdPrefix={ids}
        onSelectTab={setTab}
        onClose={() => setOpen(false)}
      />
      <div
        id={`${ids}-panel`}
        role="tabpanel"
        aria-labelledby={`${ids}-${tab === 'room' && room ? 'room' : 'office'}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        <ChatMessageList
          key={channel}
          messages={messages[channel] ?? EMPTY_MESSAGE_LIST}
          load={loadState}
          myId={myId}
          characters={characters}
          onRetry={retry}
          empty={channel === OFFICE_CHANNEL_ID ? 'Say hello to the office.' : `Only people in ${room?.name ?? 'this room'} see these messages.`}
        />
        <ChatComposer
          socket={socket}
          channel={channel}
          placeholder={channel === OFFICE_CHANNEL_ID ? 'Message the office' : `Message ${room?.name ?? 'the room'}`}
          onSent={(m) => setMessages((all) => ({ ...all, [m.channel]: merge(all[m.channel], [m]) }))}
        />
      </div>
    </Panel>
  );
}

export type { ChatMessage };
