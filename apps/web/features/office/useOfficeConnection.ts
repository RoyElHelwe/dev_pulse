/**
 * Connection, game lifecycle, and workspace state hook for OfficeView.
 * Connects the live /office socket, boots the Phaser canvas, and handles auth routing.
 */

'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDevHooks } from '@/features/dev/devHooks';
import type { MyWorkspace } from '@/features/workspace/types';
import type { OfficeController } from '@/game/createGame';
import type { OfficeLayout } from '@/game/layout/types';
import { api } from '@/lib/api';
import { connectOffice, type Presence } from './connection';

const TOAST_TIMEOUT_MS = 4000;

interface UseOfficeConnectionOptions {
  isEditingRef: React.RefObject<boolean>;
}

/** Connects to the office socket, manages workspace state, and boots the Phaser game. */
export function useOfficeConnection({ isEditingRef }: UseOfficeConnectionOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<OfficeController | null>(null);
  const connectionRef = useRef<ReturnType<typeof connectOffice> | null>(null);
  const [ready, setReady] = useState(false);
  const [workspace, setWorkspace] = useState<MyWorkspace | null>(null);
  const [people, setPeople] = useState<Presence[]>([]);
  const [toast, setToast] = useState('');
  const [online, setOnline] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const { status, user, reloadUser } = useAuth();
  const router = useRouter();

  // Set while leaving with a message, so the plain "no office" redirect doesn't win.
  const leaving = useRef(false);

  // Latest layout we know of, so our own save's echo (or an old event) is ignored.
  const versionRef = useRef(0);
  versionRef.current = Math.max(versionRef.current, workspace?.layoutVersion ?? 0);

  const leave = useCallback(
    async (notice: string) => {
      leaving.current = true;
      await reloadUser();
      router.replace(`/onboarding?notice=${notice}`);
    },
    [reloadUser, router],
  );

  // Signed out → sign in; no office yet → onboarding; otherwise load it.
  useEffect(() => {
    if (status === 'signed-out') router.replace('/login?redirect=/office');
    if (status !== 'signed-in' || !user || leaving.current) return;
    if (!user.workspace) return void router.replace('/onboarding');
    api<MyWorkspace>('/workspace').then(setWorkspace, () => void leave('no_workspace'));
  }, [status, user, router, leave]);

  const workspaceId = workspace?.id;
  const myId = user?.id;
  const name = user?.displayName;

  useEffect(() => {
    if (!workspace || !myId || !name) return;
    let cancelled = false;
    let game: OfficeController | null = null;

    const connection = connectOffice(() => controllerRef.current, {
      myId,
      onPresence: setPeople,
      onLayout(layout: OfficeLayout, version: number, by: string) {
        if (version <= versionRef.current) return;
        if (isEditingRef.current && by === myId) return; // our save; its response applies it
        versionRef.current = version;
        setWorkspace((w) => (w ? { ...w, layout, layoutVersion: version } : w));
        if (isEditingRef.current) {
          // Keep the organiser's edit on screen; saving it will ask to load the latest first.
          setToast('Another organiser just saved changes to the office.');
          return;
        }
        controllerRef.current?.setLayout(layout);
        if (by !== myId) setToast('The office was rearranged by the organiser.');
      },
      onOwnCharacter(character: string) {
        controllerRef.current?.setOwnCharacter(character);
        setWorkspace((w) => (w ? { ...w, character } : w));
      },
      onOwnStatus(ownStatus) {
        controllerRef.current?.setOwnStatus(ownStatus);
        setWorkspace((w) => (w ? { ...w, status: ownStatus } : w));
      },
      onDesks(desks) {
        controllerRef.current?.setDesks(desks);
        setWorkspace((w) => (w ? { ...w, desks, deskId: desks.find((d) => d.userId === myId)?.deskId ?? null } : w));
      },
      onConnection: setOnline,
      onRemoved: (reason) => void leave(reason),
    });
    connectionRef.current = connection;
    setSocket(connection.socket);

    (async () => {
      // Phaser touches `window`, so it is loaded only here, in the browser.
      const [{ createGame }] = await Promise.all([import('@/game/createGame'), document.fonts.ready]);
      if (cancelled || !containerRef.current) return;
      game = createGame(containerRef.current, {
        layout: workspace.layout,
        players: connection.players(),
        myId,
        character: workspace.character,
        name,
        status: workspace.status,
        desks: workspace.desks,
        fontFamily: getComputedStyle(document.body).fontFamily,
        onMove: connection.sendMove,
        onZone: connection.sendZone,
      });
      controllerRef.current = game;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      setSocket(null);
      connection.disconnect();
      connectionRef.current = null;
      game?.destroy();
      controllerRef.current = null;
      setReady(false);
    };
    // The game is created once per office; later changes arrive through the controller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, myId, name]);

  // Test-only window.__devpulse for e2e; installs nothing unless dev sign-in is on.
  useDevHooks({
    teleport(x, y) {
      connectionRef.current?.teleport(x, y);
      controllerRef.current?.teleportTo(x, y);
    },
    position: () => controllerRef.current?.localPosition() ?? null,
  });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), TOAST_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return {
    containerRef,
    workspace,
    setWorkspace,
    people,
    toast,
    setToast,
    online,
    socket,
    ready,
    controller: ready ? controllerRef.current : null,
    controllerRef,
    versionRef,
    user,
    myId,
  };
}
