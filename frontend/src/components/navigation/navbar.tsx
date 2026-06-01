'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useAuth } from '@/providers/auth-provider';
import { useLocaleToggle } from '@/providers/locale-provider';
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
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const { locale, toggleLocale } = useLocaleToggle();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

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
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-14 items-center justify-between mx-auto px-4">
        {/* Logo: disabled for VIEWER (no navigation), links to dashboard for other roles */}
        {user?.role === 'VIEWER' ? (
          <span className="font-bold text-[28px] md:text-[40px] bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent leading-none py-1 select-none cursor-default">
            StreamBingo
          </span>
        ) : (
          <Link href={user ? '/dashboard' : '/'} className="font-bold text-[28px] md:text-[40px] bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent leading-none py-1">
            StreamBingo
          </Link>
        )}

        <nav className="flex items-center gap-2">
          {/* Language toggle */}
          <Button variant="ghost" size="sm" onClick={toggleLocale} aria-label="Toggle language">
            {locale === 'en' ? '🇩🇪' : '🇬🇧'}
          </Button>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {mounted ? (resolvedTheme === 'dark' ? '☀️' : '🌙') : '🌙'}
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
                    {/* Dashboard link: hidden for VIEWER */}
                    {user.role !== 'VIEWER' && (
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard">{t('dashboard')}</Link>
                      </DropdownMenuItem>
                    )}
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
                    {user.role !== 'VIEWER' && <DropdownMenuSeparator />}
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