'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const STORAGE_KEY = 'cookie_accepted';

export function CookieBanner() {
  const t = useTranslations('legal');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 bg-card border-t px-6 py-3 shadow-lg">
      <p className="text-sm text-muted-foreground">
        {t('cookieNotice')}{' '}
        <Link href="/datenschutz" className="underline underline-offset-2 hover:text-foreground transition-colors">
          {t('privacy')}
        </Link>
      </p>
      <Button
        size="sm"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, '1');
          setVisible(false);
        }}
      >
        {t('cookieAccept')}
      </Button>
    </div>
  );
}
