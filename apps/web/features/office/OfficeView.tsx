'use client';

import { useEffect, useRef, useState } from 'react';
import type { OfficeController } from '@/game/createGame';
import { studioLayout } from '@/game/layout/studio';
import { DEFAULT_LOOK } from '@/game/objects/looks';
import { OfficeHud } from './OfficeHud';

/** Full-screen office: the Phaser canvas plus the HUD on top of it. */
export function OfficeView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [controller, setController] = useState<OfficeController | null>(null);

  useEffect(() => {
    let cancelled = false;
    let game: OfficeController | null = null;

    (async () => {
      // Phaser touches `window`, so it is loaded only here, in the browser.
      const [{ createGame }] = await Promise.all([import('@/game/createGame'), document.fonts.ready]);
      if (cancelled || !containerRef.current) return;
      game = createGame(containerRef.current, {
        layout: studioLayout,
        look: DEFAULT_LOOK,
        name: 'You', // R2/R3: the real display name from the profile
        fontFamily: getComputedStyle(document.body).fontFamily,
      });
      setController(game);
    })();

    return () => {
      cancelled = true;
      game?.destroy();
      setController(null);
    };
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#e4e0da]">
      <div ref={containerRef} className="absolute inset-0" />
      {/* Soft vignette for depth; ignores the mouse. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(24_24_27/0.18))]" />
      <OfficeHud controller={controller} officeName={studioLayout.name} />
    </div>
  );
}
