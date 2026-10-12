'use client';

// User avatar trigger and dropdown menu providing access to character settings, keybinds, and account controls.

import { ChevronDown, Keyboard, LogOut, Palette, Repeat, ShieldCheck, Smile, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '@/components/ui/Avatar';
import { CharacterModal } from '@/features/office/CharacterModal';
import { StatusSection } from '@/features/office/StatusSection';
import { KeybindsModal } from '@/features/settings/KeybindsModal';
import { cn } from '@/lib/cn';
import { useEscape } from '@/lib/escape';
import { useAuth } from './AuthProvider';
import { useDevLogin } from '@/features/dev/useDevLogin';
import type { User } from './types';

const MENU_OFFSET_PX = 8;
const MIN_VIEWPORT_MARGIN_PX = 8;

/** Visual styling, compact trigger mode, and optional character appearance state for the user menu. */
export interface UserMenuProps {
  className?: string;
  compact?: boolean;
  profile?: {
    character: string;
    status: string | null;
  };
}

/** Avatar button with a dropdown menu: Character, Status, Keybinds, team, security, sign out. */
export function UserMenu({ className, compact, profile }: UserMenuProps) {
  const { user, signOut } = useAuth();
  const devEnabled = useDevLogin()?.enabled ?? false;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [characterModalOpen, setCharacterModalOpen] = useState(false);
  const [keybindsModalOpen, setKeybindsModalOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: rect.bottom + MENU_OFFSET_PX,
      right: Math.max(MIN_VIEWPORT_MARGIN_PX, window.innerWidth - rect.right),
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setStatusExpanded(false);
      return;
    }
    updateCoords();
    window.addEventListener('resize', updateCoords);
    window.addEventListener('scroll', updateCoords, true);
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  useEscape(open, () => setOpen(false));

  if (!user) return null;

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'flex items-center gap-2 rounded-full p-0.5 transition hover:bg-zinc-900/5 focus-visible:outline-2 focus-visible:outline-emerald-500',
          compact ? 'pr-0.5 sm:pr-3' : 'pr-3',
        )}
      >
        <Avatar name={user.displayName} src={user.avatarUrl} />
        <span className={cn('max-w-32 truncate text-sm font-medium', compact && 'hidden sm:inline')}>
          {user.displayName}
        </span>
      </button>

      {open &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <UserDropdownMenu
            menuRef={menuRef}
            coords={coords}
            user={user}
            profile={profile}
            statusExpanded={statusExpanded}
            onToggleStatus={() => setStatusExpanded((prev) => !prev)}
            onOpenCharacter={() => {
              setCharacterModalOpen(true);
              setOpen(false);
            }}
            onOpenKeybinds={() => {
              setKeybindsModalOpen(true);
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
            devEnabled={devEnabled}
            onSignOutDev={async () => {
              await signOut();
              window.location.replace('/login');
            }}
            onSignOut={async () => {
              await signOut();
              router.replace('/login');
            }}
          />,
          document.body,
        )}

      {profile && (
        <CharacterModal
          open={characterModalOpen}
          onClose={() => setCharacterModalOpen(false)}
          character={profile.character}
        />
      )}
      <KeybindsModal open={keybindsModalOpen} onClose={() => setKeybindsModalOpen(false)} />
    </div>
  );
}

interface UserDropdownMenuProps {
  menuRef: React.RefObject<HTMLDivElement | null>;
  coords: { top: number; right: number };
  user: User;
  profile?: UserMenuProps['profile'];
  statusExpanded: boolean;
  onToggleStatus: () => void;
  onOpenCharacter: () => void;
  onOpenKeybinds: () => void;
  onClose: () => void;
  devEnabled: boolean;
  onSignOutDev: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

function UserDropdownMenu({
  menuRef,
  coords,
  user,
  profile,
  statusExpanded,
  onToggleStatus,
  onOpenCharacter,
  onOpenKeybinds,
  onClose,
  devEnabled,
  onSignOutDev,
  onSignOut,
}: UserDropdownMenuProps) {
  return (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        right: `${coords.right}px`,
      }}
      className="z-[60] w-64 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl bg-white p-1.5 shadow-xl ring-1 shadow-zinc-900/10 ring-zinc-200"
    >
      <div className="px-3 py-2">
        <p className="truncate text-sm font-medium">{user.displayName}</p>
        <p className="truncate text-xs text-zinc-500">{user.email}</p>
        {profile?.status && (
          <p className="mt-1 inline-block truncate rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-600">
            {profile.status}
          </p>
        )}
      </div>

      <div className="my-1 h-px bg-zinc-100" />

      {profile && (
        <>
          <button
            role="menuitem"
            type="button"
            onClick={onOpenCharacter}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            <Palette className="size-4" /> Character
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={onToggleStatus}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Smile className="size-4 shrink-0" />
              <div className="flex min-w-0 flex-col items-start leading-tight text-left">
                <span>Status</span>
                {profile.status && (
                  <span className="truncate text-xs font-normal text-zinc-500">{profile.status}</span>
                )}
              </div>
            </div>
            <ChevronDown
              className={cn('size-3.5 text-zinc-400 transition-transform', statusExpanded && 'rotate-180')}
            />
          </button>
          {statusExpanded && (
            <div className="px-3 pt-1 pb-2">
              <StatusSection status={profile.status} />
            </div>
          )}
        </>
      )}

      <button
        role="menuitem"
        type="button"
        onClick={onOpenKeybinds}
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
      >
        <Keyboard className="size-4" /> Keybinds
      </button>

      <div className="my-1 h-px bg-zinc-100" />

      {user.workspace && (
        <Link
          role="menuitem"
          href="/team"
          onClick={onClose}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
        >
          <Users className="size-4" /> Team
        </Link>
      )}

      <Link
        role="menuitem"
        href="/settings/security"
        onClick={onClose}
        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
      >
        <ShieldCheck className="size-4" /> Security settings
      </Link>

      {devEnabled && (
        <button
          role="menuitem"
          type="button"
          onClick={onSignOutDev}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-amber-700 hover:bg-amber-50"
        >
          <Repeat className="size-4" /> Switch user (dev)
        </button>
      )}

      <button
        role="menuitem"
        type="button"
        onClick={onSignOut}
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
      >
        <LogOut className="size-4" /> Sign out
      </button>
    </div>
  );
}
