'use client';

import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface BingoCardProps {
  grid: (number | null)[][];
  marked: boolean[][];
  onClaim?: () => void;
  gameRunning: boolean;
  hasWon: boolean;
}

const COLUMNS = ['B', 'I', 'N', 'G', 'O'];

export function BingoCard({ grid, marked, onClaim, gameRunning, hasWon }: BingoCardProps) {
  const t = useTranslations('bingo');

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
            const isMarked = marked[rowIdx][colIdx];
            const isFree = cell === null;
            return (
              <div
                key={`${rowIdx}-${colIdx}`}
                className={cn(
                  'flex items-center justify-center aspect-square rounded-md text-sm font-bold border-2 select-none transition-all',
                  isFree
                    ? 'bg-primary/20 border-primary text-primary'
                    : isMarked
                      ? 'bg-primary border-primary text-primary-foreground scale-95'
                      : 'bg-card border-border text-card-foreground hover:border-primary/50',
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
