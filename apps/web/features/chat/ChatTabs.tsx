'use client';

// Channel tabs bar and close toggle for text chat.
// Fits into ChatPanel to allow switching between office and room channels.

import { ChevronDown } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/cn';

export interface ChatTabItem {
  key: 'office' | 'room';
  label: string;
  channel: string;
}

interface ChatTabsProps {
  tabs: ChatTabItem[];
  activeTab: 'office' | 'room';
  unread: Record<string, number>;
  panelIdPrefix: string;
  onSelectTab(tab: 'office' | 'room'): void;
  onClose(): void;
}

/** Renders the channel tabs header and close button for the chat panel. */
export function ChatTabs({ tabs, activeTab, unread, panelIdPrefix, onSelectTab, onClose }: ChatTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-zinc-200/70 p-1.5" role="tablist" aria-label="Chat channels">
      {tabs.map((t) => (
        <button
          key={t.key}
          id={`${panelIdPrefix}-${t.key}`}
          type="button"
          role="tab"
          aria-selected={activeTab === t.key}
          aria-controls={`${panelIdPrefix}-panel`}
          onClick={() => onSelectTab(t.key)}
          className={cn(
            'flex max-w-40 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition',
            activeTab === t.key ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-900/5',
          )}
        >
          <span className="truncate">{t.label}</span>
          {!!unread[t.channel] && activeTab !== t.key && <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="unread" />}
        </button>
      ))}
      <IconButton aria-label="Close chat" onClick={onClose} className="ml-auto size-8">
        <ChevronDown className="size-4" />
      </IconButton>
    </div>
  );
}
