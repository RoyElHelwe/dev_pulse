'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import type { MyWorkspace } from '@/features/workspace/types';
import type { OfficeController } from '@/game/createGame';
import type { OfficeLayout } from '@/game/layout/types';
import { api } from '@/lib/api';
import { connectOffice, type Presence } from './connection';
import { OfficeHud } from './OfficeHud';

/** Full-screen office: the Phaser canvas, the live connection and the HUD. */
export function OfficeView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<OfficeController | null>(null);
  const [ready, setReady] = useState(false);
  const [workspace, setWorkspace] = useState<MyWorkspace | null>(null);
  const [people, setPeople] = useState<Presence[]>([]);
  const [toast, setToast] = useState('');
  const { status, user, reloadUser } = useAuth();
  const router = useRouter();

  const leave = useCallback(
    async (notice: string) => {
      await reloadUser();
      router.replace(`/onboarding?notice=${notice}`);
    },
    [reloadUser, router],
  );

  // Signed out → sign in; no office yet → onboarding; otherwise load it.
  useEffect(() => {
    if (status === 'signed-out') router.replace('/login?redirect=/office');
    if (status !== 'signed-in' || !user) return;
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
        controllerRef.current?.setLayout(layout);
        setWorkspace((w) => (w ? { ...w, layout, layoutVersion: version } : w));
        if (by !== myId) setToast('The office was rearranged by the organiser.');
      },
      onOwnCharacter(character: string) {
        controllerRef.current?.setOwnCharacter(character);
        setWorkspace((w) => (w ? { ...w, character } : w));
      },
      onRemoved: (reason) => void leave(reason),
    });

    (async () => {
      // Phaser touches `window`, so it is loaded only here, in the browser.
      const [{ createGame }] = await Promise.all([import('@/game/createGame'), document.fonts.ready]);
      if (cancelled || !containerRef.current) return;
      game = createGame(containerRef.current, {
        layout: workspace.layout,
        character: workspace.character,
        name,
        fontFamily: getComputedStyle(document.body).fontFamily,
        onMove: connection.sendMove,
      });
      controllerRef.current = game;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      connection.disconnect();
      game?.destroy();
      controllerRef.current = null;
      setReady(false);
    };
    // The game is created once per office; later changes arrive through the controller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, myId, name]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#e4e0da]">
      <div ref={containerRef} className="absolute inset-0" />
      {/* Soft vignette for depth; ignores the mouse. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(24_24_27/0.18))]" />
      <OfficeHud
        controller={ready ? controllerRef.current : null}
        workspace={workspace}
        people={people}
        toast={toast}
      />
    </div>
  );
}
