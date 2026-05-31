'use client';

import { use, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageToolbar } from '@/components/page-toolbar';

const API = process.env.NEXT_PUBLIC_API_URL!;

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default function InvitePage({ params }: InvitePageProps) {
  const { token } = use(params);
  const t = useTranslations('invite');
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid' | 'used' | 'expired'>('checking');
  const [role, setRole] = useState<string>('STREAMER');

  useEffect(() => {
    // Validate the token with the backend (requires JWT cookie)
    // If user is not logged in, we still show the page; they'll log in and the token will be consumed at callback
    const controller = new AbortController();
    fetch(`${API}/admin/validate-invite/${encodeURIComponent(token)}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) {
          setStatus('invalid');
          return;
        }
        const data = await r.json();
        if (data.valid) {
          setRole(data.role ?? 'STREAMER');
          setStatus('valid');
        } else if (data.reason === 'already_used') {
          setStatus('used');
        } else if (data.reason === 'expired') {
          setStatus('expired');
        } else {
          setStatus('invalid');
        }
      })
      .catch(() => {
        // If not logged in (401) we can still allow the login flow
        setStatus('valid');
      });

    return () => controller.abort();
  }, [token]);

  const loginHref = `/api/auth/twitch?invite=${encodeURIComponent(token)}`;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="fixed top-4 right-4 z-50">
        <PageToolbar />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">🎉 {t('title')}</CardTitle>
          {status === 'valid' && (
            <CardDescription>{t('subtitle')} ({role})</CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4 items-center">
          {status === 'checking' && (
            <p className="text-muted-foreground text-sm">{t('checking')}</p>
          )}
          {status === 'valid' && (
            <Button
              asChild
              className="w-full [&]:bg-[#9146FF] [&]:hover:bg-[#772CE8] [&]:text-white"
              size="lg"
            >
              <a href={loginHref}>
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                </svg>
                {t('loginButton')}
              </a>
            </Button>
          )}
          {status === 'invalid' && (
            <p className="text-destructive text-sm font-medium">{t('invalidToken')}</p>
          )}
          {status === 'used' && (
            <p className="text-destructive text-sm font-medium">{t('alreadyUsed')}</p>
          )}
          {status === 'expired' && (
            <p className="text-destructive text-sm font-medium">{t('expired')}</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
