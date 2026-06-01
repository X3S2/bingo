'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useLocaleToggle } from '@/providers/locale-provider';

export function PageToolbar({ backHref }: { backHref?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { locale, toggleLocale } = useLocaleToggle();

  useEffect(() => { setMounted(true); }, []);

  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

  return (
    <div className="flex items-center gap-1">
      {backHref && (
        <Button variant="ghost" size="sm" asChild className="mr-1">
          <a href={backHref}>← Zurück</a>
        </Button>
      )}

      {/* Language toggle — zeigt die jeweils ANDERE Sprache (wie Navbar) */}
      <Button variant="ghost" size="sm" onClick={toggleLocale} aria-label="Toggle language">
        {locale === 'en' ? '🇩🇪' : '🇬🇧'}
      </Button>

      {/* Theme toggle — gleiche Emoji wie Navbar */}
      <Button variant="ghost" size="sm" className="h-8 w-8 px-0" onClick={toggleTheme} aria-label="Toggle theme">
        {mounted ? (resolvedTheme === 'dark' ? '☀️' : '🌙') : '🌙'}
      </Button>
    </div>
  );
}
