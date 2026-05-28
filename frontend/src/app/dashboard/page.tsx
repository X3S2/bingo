'use client';

import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Navbar } from '@/components/navigation/navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        </main>
      </div>
    );
  }

  if (!user) return null;

  const roleLinks = [
    { role: ['VIEWER', 'MODERATOR', 'STREAMER', 'ADMIN'], href: '/game', label: '🎮 Zum laufenden Spiel' },
    { role: ['MODERATOR', 'STREAMER', 'ADMIN'], href: '/moderator', label: '🛡️ Moderator-Dashboard' },
    { role: ['STREAMER', 'ADMIN'], href: '/streamer', label: '🎬 Streamer-Verwaltung' },
    { role: ['ADMIN'], href: '/admin', label: '⚙️ Admin-Portal' },
  ].filter((l) => l.role.includes(user.role));

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
          <Badge variant={user.role === 'ADMIN' ? 'destructive' : 'secondary'}>{user.role}</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roleLinks.map((l) => (
            <Card key={l.href} className="hover:border-primary/50 transition-colors">
              <CardContent className="flex items-center justify-center p-6">
                <Button asChild variant="ghost" className="w-full text-base font-medium h-auto py-4">
                  <Link href={l.href}>{l.label}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
