'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PageToolbar({ backHref }: { backHref?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // locale state – read from cookie
  const [locale, setLocale] = useState('de');
  useEffect(() => {
    setMounted(true);
    const m = document.cookie.match(/(?:^|; )locale=([^;]*)/);
    setLocale(m ? m[1] : 'de');
  }, []);

  const toggleLocale = (lang: string) => {
    document.cookie = `locale=${lang}; path=/; max-age=31536000`;
    setLocale(lang);
    window.location.reload();
  };

  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

  return (
    <div className="flex items-center gap-1">
      {backHref && (
        <Button variant="ghost" size="sm" asChild className="mr-1">
          <a href={backHref}>← Zurück</a>
        </Button>
      )}

      {/* Language toggle */}
      <div className="flex gap-0.5 text-xs">
        {(['de', 'en'] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => toggleLocale(lang)}
            className={`px-2 py-1 rounded uppercase font-semibold transition-colors ${
              locale === lang
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {lang}
          </button>
        ))}
      </div>

      {/* Theme toggle */}
      {mounted && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme} aria-label="Toggle theme">
          {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}
