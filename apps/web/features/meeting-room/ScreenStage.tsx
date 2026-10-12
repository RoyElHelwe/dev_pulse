'use client';

// The shared screen of a meeting room: a large viewer for the people watching, a small preview for the presenter.
// Fits into MeetingRoomTools; works on every device (phones and tablets watch, only desktops present).

import { Maximize, Minimize2, MonitorUp, ScreenShareOff, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Panel } from '@/components/ui/Panel';
import { cn } from '@/lib/cn';

interface ScreenStageProps {
  stream: MediaStream;
  /** Our own screen: a small preview, never played with sound. */
  mine: boolean;
  presenterName: string;
  viewers: number;
  onStop(): void;
}

/** iOS Safari only offers fullscreen on the video element itself. */
type IOSVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/** Renders the presenter's screen (expanded or minimised) or the presenter's own preview. */
export function ScreenStage({ stream, mine, presenterName, viewers, onStop }: ScreenStageProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [expanded, setExpanded] = useState(true);
  // Browsers may refuse to autoplay with sound: start muted and offer a button.
  const [needsTap, setNeedsTap] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.muted = mine;
    setNeedsTap(false);
    video.play().catch(() => {
      video.muted = true;
      if (!mine && stream.getAudioTracks().length > 0) setNeedsTap(true);
      video.play().catch(() => {});
    });
  }, [stream, mine]);

  const unmute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    void video.play().then(() => setNeedsTap(false), () => {});
  };

  const fullscreen = () => {
    const video = videoRef.current as IOSVideo | null;
    if (frameRef.current?.requestFullscreen) void frameRef.current.requestFullscreen().catch(() => video?.webkitEnterFullscreen?.());
    else video?.webkitEnterFullscreen?.();
  };

  const big = !mine && expanded;

  return (
    <Panel
      role="region"
      aria-label={mine ? 'Your shared screen' : `${presenterName}'s screen`}
      className={cn(
        'absolute z-20 flex flex-col overflow-hidden',
        big
          ? 'inset-x-2 top-[8.25rem] bottom-24 sm:inset-x-auto sm:left-1/2 sm:w-[min(64rem,calc(100vw-2rem))] sm:-translate-x-1/2'
          : 'top-[8.25rem] left-4 w-[min(18rem,calc(100vw-2rem))]',
      )}
    >
      <header className="flex items-center gap-1 border-b border-zinc-200/70 py-1.5 pr-1.5 pl-3">
        <MonitorUp className="size-4 shrink-0 text-emerald-600" />
        <p className="mr-auto truncate text-sm font-medium text-zinc-700">
          {mine ? `You are presenting · ${viewers} watching` : `${presenterName} is presenting`}
        </p>
        {mine ? (
          <Button size="sm" variant="secondary" className="text-rose-600" onClick={onStop}>
            <ScreenShareOff className="size-4" /> Stop
          </Button>
        ) : (
          <>
            <IconButton aria-label="Full screen" onClick={fullscreen}>
              <Maximize className="size-4" />
            </IconButton>
            <IconButton aria-label={expanded ? 'Make smaller' : 'Make bigger'} onClick={() => setExpanded(!expanded)}>
              {expanded ? <Minimize2 className="size-4" /> : <Maximize className="size-4 rotate-90" />}
            </IconButton>
          </>
        )}
      </header>
      <div ref={frameRef} className={cn('relative bg-zinc-950', big ? 'min-h-0 flex-1' : 'aspect-video')}>
        <video ref={videoRef} autoPlay playsInline className="absolute inset-0 size-full object-contain" />
        {needsTap && (
          <button
            type="button"
            onClick={unmute}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-zinc-800 shadow"
          >
            <Volume2 className="size-4" /> Tap for sound
          </button>
        )}
      </div>
    </Panel>
  );
}
