'use client';

import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Navbar } from '@/components/navigation/navbar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations('nav');

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="container mx-auto px-4 py-10">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-4 w-32 mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        </main>
      </div>
    );
  }

  if (!user) return null;

  const roleLinks = [
    { role: ['VIEWER', 'MODERATOR', 'STREAMER', 'ADMIN'], href: '/game', label: '🎮 Zum laufenden Spiel', desc: 'Am aktuellen Bingo-Spiel teilnehmen', gradient: 'from-violet-500/10 to-purple-500/10 hover:from-violet-500/20 hover:to-purple-500/20' },
    { role: ['MODERATOR', 'STREAMER', 'ADMIN'], href: '/moderator', label: '🛡️ Moderator-Dashboard', desc: 'Karten überwachen, Zahlen verwalten', gradient: 'from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20' },
    { role: ['STREAMER', 'ADMIN'], href: '/streamer', label: '🎬 Streamer-Verwaltung', desc: 'Spiele erstellen und konfigurieren', gradient: 'from-pink-500/10 to-rose-500/10 hover:from-pink-500/20 hover:to-rose-500/20' },
    { role: ['ADMIN'], href: '/admin', label: '⚙️ Admin-Portal', desc: 'Nutzer, Einstellungen, Bot-Status', gradient: 'from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20' },
  ].filter((l) => l.role.includes(user.role));

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-10 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('dashboard')}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Willkommen zurück, {user.displayName}</p>
          </div>
          <Badge variant={user.role === 'ADMIN' ? 'destructive' : 'secondary'} className="ml-auto">{user.role}</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {roleLinks.map((l) => (
            <Link key={l.href} href={l.href} className={`group relative rounded-xl border bg-gradient-to-br ${l.gradient} p-5 flex flex-col gap-1.5 transition-all duration-200 hover:shadow-md hover:border-primary/30`}>
              <span className="text-base font-semibold">{l.label}</span>
              <span className="text-sm text-muted-foreground">{l.desc}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
