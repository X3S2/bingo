'use client';

import { useTranslations } from 'next-intl';

interface NumberBoardProps {
  numbers: number[];
}

export function NumberBoard({ numbers }: NumberBoardProps) {
  const t = useTranslations('bingo');
  const sorted = [...numbers].sort((a, b) => a - b);

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('drawnNumbers')}</h3>
      {numbers.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">–</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {sorted.map((n) => (
            <div
              key={n}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground font-bold text-base select-none"
            >
              {n}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-2">{numbers.length} / 75</p>
    </div>
  );
}
