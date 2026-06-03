'use client';

import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface BingoCardProps {
  grid: (number | null)[][];
  marked: boolean[][];
  onClaim?: () => void;
  gameRunning: boolean;
  hasWon: boolean;
  /** When true (moderator/streamer view), marks are read-only from server */
  readOnly?: boolean;
  /** Called with updated marked state when viewer toggles a cell */
  onMarkChange?: (marked: boolean[][]) => void;
}

const COLUMNS = ['B', 'I', 'N', 'G', 'O'];

export function BingoCard({ grid, marked, onClaim, gameRunning, hasWon, readOnly = false, onMarkChange }: BingoCardProps) {
  const t = useTranslations('bingo');

  // Initialize from server state (includes drawn-number marks + free cell)
  const [localMarked, setLocalMarked] = useState<boolean[][]>(() =>
    marked.map((row) => [...row])
  );

  // Sync from server only for readOnly (moderator) view.
  // For viewer cards: state is managed purely locally after initial mount.
  // Background refetches must NOT overwrite local marks — that is what caused
  // the "mark → instantly reverts" bug (new array reference → effect fires).
  useEffect(() => {
    if (!readOnly) return;
    setLocalMarked(marked.map((row) => [...row]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marked, readOnly]);

  const toggleCell = (rowIdx: number, colIdx: number) => {
    if (readOnly) return;
    const isFree = grid[rowIdx][colIdx] === null;
    if (isFree) return; // free cell can't be toggled
    setLocalMarked((prev) => {
      const next = prev.map((row, r) =>
        row.map((cell, c) => (r === rowIdx && c === colIdx ? !cell : cell))
      );
      onMarkChange?.(next);
      return next;
    });
  };

  const displayMarked = readOnly ? marked : localMarked;

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
      {/* Column headers */}
      <div className="grid grid-cols-5 gap-1 w-full">
        {COLUMNS.map((col) => (
          <div
            key={col}
            className="flex items-center justify-center h-10 rounded-md bg-primary text-primary-foreground font-black text-xl"
          >
            {col}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-1 w-full">
        {grid.map((row, rowIdx) =>
          row.map((cell, colIdx) => {
            const isMarked = displayMarked[rowIdx][colIdx];
            const isFree = cell === null;
            return (
              <div
                key={`${rowIdx}-${colIdx}`}
                onClick={() => toggleCell(rowIdx, colIdx)}
                className={cn(
                  'flex items-center justify-center aspect-square rounded-md font-bold border-2 select-none transition-all',
                  isFree
                    ? 'bg-primary/20 border-primary text-primary text-base'
                    : isMarked
                      ? 'bg-primary border-primary text-primary-foreground scale-95 text-lg'
                      : 'bg-card border-border text-card-foreground text-lg',
                  !readOnly && !isFree && 'cursor-pointer hover:border-primary/70 active:scale-95',
                )}
              >
                {isFree ? t('freeSquare') : cell}
              </div>
            );
          }),
        )}
      </div>

      {/* Claim button */}
      {gameRunning && !hasWon && onClaim && (
        <button
          onClick={onClaim}
          className="mt-2 w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 active:scale-95 transition-all"
        >
          {t('claimBingo')}
        </button>
      )}

      {hasWon && (
        <div className="w-full text-center py-3 rounded-xl bg-yellow-400 text-yellow-900 font-bold text-lg animate-bounce">
          {t('youWon')}
        </div>
      )}
    </div>
  );
}
