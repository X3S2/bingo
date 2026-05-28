'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';

interface NumberBoardProps {
  numbers: number[];
}

export function NumberBoard({ numbers }: NumberBoardProps) {
  const t = useTranslations('bingo');
  const sorted = [...numbers].sort((a, b) => a - b);

  const getColumn = (n: number) => {
    if (n <= 15) return 'B';
    if (n <= 30) return 'I';
    if (n <= 45) return 'N';
    if (n <= 60) return 'G';
    return 'O';
  };

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('drawnNumbers')}</h3>
      {numbers.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">–</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {sorted.map((n) => (
            <Badge key={n} variant="secondary" className="text-xs font-mono">
              {getColumn(n)}{n}
            </Badge>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-1">{numbers.length} / 75</p>
    </div>
  );
}
