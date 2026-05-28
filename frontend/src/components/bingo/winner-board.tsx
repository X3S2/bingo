'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Winner {
  position: number;
  claimedVia: string;
  user: {
    displayName: string;
    profileImageUrl?: string;
  };
}

interface WinnerBoardProps {
  winners: Winner[];
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function WinnerBoard({ winners }: WinnerBoardProps) {
  const t = useTranslations('bingo');

  if (winners.length === 0) return null;

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('winners')}</h3>
      <div className="flex flex-col gap-2">
        {winners.map((w) => (
          <div key={w.position} className="flex items-center gap-3 rounded-lg border bg-card p-2">
            <span className="text-xl">{MEDALS[w.position - 1] || `#${w.position}`}</span>
            <Avatar className="h-7 w-7">
              <AvatarImage src={w.user.profileImageUrl} alt={w.user.displayName} />
              <AvatarFallback>{w.user.displayName[0]}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-sm">{w.user.displayName}</span>
            <Badge variant="outline" className="ml-auto text-xs">{w.claimedVia}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
