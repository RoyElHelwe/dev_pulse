// Section for expanding the office with wings or adding a chill room.
// Rendered within the office settings card on the team page.

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { MyWorkspace } from '@/features/workspace/types';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { getErrorMessage, type WingSide } from './teamHelpers';

interface ExpandOfficeCardProps {
  workspace: MyWorkspace;
  onExpanded: (workspace?: MyWorkspace) => void;
  onChillAdded?: () => void;
}

/** Section with controls to expand office desk wings or append a chill room. */
export function ExpandOfficeCard({
  workspace,
  onExpanded,
  onChillAdded,
}: ExpandOfficeCardProps) {
  const [busySide, setBusySide] = useState<WingSide | null>(null);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const [chillSide, setChillSide] = useState<WingSide>('RIGHT');
  const [busyChill, setBusyChill] = useState(false);
  const [chillResult, setChillResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const totalDesks = workspace.layout.furniture.filter((f) => f.kind === 'desk').length;
  const takenDesks = workspace.desks?.length ?? 0;
  const freeDesks = totalDesks - takenDesks;
  const wingsCount = workspace.wings?.length ?? 0;

  async function expand(side: WingSide) {
    setBusySide(side);
    setResult(null);
    try {
      const updated = await api<MyWorkspace>('/workspace/wings', {
        method: 'POST',
        body: { side, version: workspace.layoutVersion },
      });
      const sideName = side === 'LEFT' ? 'left' : side === 'RIGHT' ? 'right' : 'bottom';
      setResult({ tone: 'success', text: `Added ${sideName} wing.` });
      onExpanded(updated);
    } catch (err) {
      setResult({ tone: 'error', text: getErrorMessage(err) });
    } finally {
      setBusySide(null);
    }
  }

  async function addChill(side: WingSide = chillSide) {
    setBusyChill(true);
    setChillResult(null);
    try {
      const updated = await api<MyWorkspace>('/workspace/wings/chill', {
        method: 'POST',
        body: { side, version: workspace.layoutVersion },
      });
      const sideName = side === 'LEFT' ? 'left' : side === 'RIGHT' ? 'right' : 'bottom';
      setChillResult({ tone: 'success', text: `Added chill room on the ${sideName}.` });
      onChillAdded?.();
      onExpanded(updated);
    } catch (err) {
      setChillResult({ tone: 'error', text: getErrorMessage(err) });
    } finally {
      setBusyChill(false);
    }
  }

  return (
    <div
      className={cn(
        'mt-8 rounded-2xl p-4 transition',
        workspace.canExpand && freeDesks === 0
          ? 'bg-amber-50/40 ring-2 ring-amber-400'
          : 'bg-zinc-50/50 ring-1 ring-zinc-200',
      )}
    >
      <h3 className="font-semibold">Expand office</h3>
      {workspace.canExpand && (
        <>
          <p className="mt-1 text-sm text-zinc-600">
            Your office grows with your team: add a generated wing with ~8 more desks and a meeting room or lounge.
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            <span className="font-medium text-zinc-900">{freeDesks} of {totalDesks} desks free</span>
            {wingsCount > 0 && <span> · {wingsCount} {wingsCount === 1 ? 'wing' : 'wings'} added</span>}
          </p>
          {freeDesks === 0 && (
            <p className="mt-2 text-sm font-medium text-amber-800">
              No free desk left: expand the office so new people can join.
            </p>
          )}
          {result && (
            <p className={`mt-3 text-sm ${result.tone === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
              {result.text}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              disabled={busySide !== null}
              loading={busySide === 'LEFT'}
              onClick={() => expand('LEFT')}
            >
              {busySide !== 'LEFT' && (
                <svg
                  className="size-4 shrink-0"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 8H4m0 0 3-3m-3 3 3 3" />
                </svg>
              )}
              Left
            </Button>
            <Button
              variant="secondary"
              disabled={busySide !== null}
              loading={busySide === 'RIGHT'}
              onClick={() => expand('RIGHT')}
            >
              {busySide !== 'RIGHT' && (
                <svg
                  className="size-4 shrink-0"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 8h8m0 0-3-3m3 3-3 3" />
                </svg>
              )}
              Right
            </Button>
            <Button
              variant="secondary"
              disabled={busySide !== null}
              loading={busySide === 'BOTTOM'}
              onClick={() => expand('BOTTOM')}
            >
              {busySide !== 'BOTTOM' && (
                <svg
                  className="size-4 shrink-0"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M8 4v8m0 0-3-3m3 3 3-3" />
                </svg>
              )}
              Bottom
            </Button>
          </div>
        </>
      )}

      {workspace.canAddChill && (
        <div className={cn(workspace.canExpand && 'mt-6 border-t border-zinc-200/60 pt-4')}>
          <h4 className="font-semibold text-zinc-900">Chill room</h4>
          <p className="mt-1 text-sm text-zinc-600">
            Add a dedicated games and hangout room (Baby foot, Uno, Lego wall). One chill room per office.
          </p>
          {chillResult && (
            <p className={`mt-3 text-sm ${chillResult.tone === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
              {chillResult.text}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Side:</span>
            <Button
              variant={chillSide === 'LEFT' ? 'primary' : 'secondary'}
              disabled={busyChill}
              onClick={() => setChillSide('LEFT')}
            >
              <svg
                className="size-4 shrink-0"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 8H4m0 0 3-3m-3 3 3 3" />
              </svg>
              Left
            </Button>
            <Button
              variant={chillSide === 'RIGHT' ? 'primary' : 'secondary'}
              disabled={busyChill}
              onClick={() => setChillSide('RIGHT')}
            >
              <svg
                className="size-4 shrink-0"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 8h8m0 0-3-3m3 3-3 3" />
              </svg>
              Right
            </Button>
            <Button
              variant={chillSide === 'BOTTOM' ? 'primary' : 'secondary'}
              disabled={busyChill}
              onClick={() => setChillSide('BOTTOM')}
            >
              <svg
                className="size-4 shrink-0"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M8 4v8m0 0-3-3m3 3 3-3" />
              </svg>
              Bottom
            </Button>
            <Button
              loading={busyChill}
              onClick={() => addChill(chillSide)}
            >
              Add chill room
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
