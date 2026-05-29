'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function Navbar() {
  const t = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const { user, isLoading, refetch } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const [locale, setLocale] = useState('de');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const m = document.cookie.match(/locale=([^;]+)/);
    setLocale(m?.[1] ?? 'de');
    setMounted(true);
  }, []);

  const toggleLocale = () => {
    const next = locale === 'de' ? 'en' : 'de';
    document.cookie = `locale=${next}; path=/; max-age=31536000`;
    setLocale(next);
    window.location.reload();
  };

  const handleLogout = async () => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    await refetch();
    toast.success(tAuth('logoutSuccess'));
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between mx-auto px-4">
        <Link href={user ? '/dashboard' : '/'} className="font-bold text-xl text-primary">
          StreamBingo
        </Link>

        <nav className="flex items-center gap-2">
          {/* Language toggle */}
          <Button variant="ghost" size="sm" onClick={toggleLocale} aria-label="Toggle language">
            {locale === 'en' ? '🇩🇪' : '🇬🇧'}
          </Button>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {mounted ? (theme === 'dark' ? '☀️' : '🌙') : '🌙'}
          </Button>

          {!isLoading && (
            <>
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={user.profileImageUrl} alt={user.displayName} />
                        <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                      </Avatar>
                      <span className="hidden sm:inline">{user.displayName}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard">{t('dashboard')}</Link>
                    </DropdownMenuItem>
                    {(user.role === 'STREAMER' || user.role === 'ADMIN') && (
                      <DropdownMenuItem asChild>
                        <Link href="/streamer">{t('game')}</Link>
                      </DropdownMenuItem>
                    )}
                    {user.role === 'ADMIN' && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin">{t('admin')}</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>{t('logout')}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild size="sm">
                  <a href="/api/auth/twitch">{t('login')}</a>
                </Button>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}