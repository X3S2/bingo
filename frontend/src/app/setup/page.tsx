'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PageToolbar } from '@/components/page-toolbar';

const API = process.env.NEXT_PUBLIC_API_URL!;
const TOTAL_STEPS = 3;

function getVal(id: string): string {
  if (typeof document === 'undefined') return '';
  return (document.getElementById(id) as HTMLInputElement | null)?.value?.trim() ?? '';
}

function stripOauthPrefix(token: string): string {
  return token.startsWith('oauth:') ? token.slice(6) : token;
}

export default function SetupPage() {
  const router = useRouter();
  const t = useTranslations('setup');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const collected = useRef({ setupToken: '', twitchClientId: '', twitchClientSecret: '', botLogin: '' });

  const redirectUri =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/auth/callback/twitch`
      : 'http://localhost:4000/api/auth/callback/twitch';

  const handleNext = () => {
    if (step === 1) {
      const token = getVal('setupToken');
      if (!token) { toast.error(t('errorSetupToken')); return; }
      collected.current.setupToken = token;
    }
    if (step === 2) {
      const botLogin = getVal('botLogin');
      if (!botLogin) { toast.error(t('errorBotLogin')); return; }
      collected.current.twitchClientId = getVal('twitchClientId');
      collected.current.twitchClientSecret = getVal('twitchClientSecret');
      collected.current.botLogin = botLogin;
    }
    setStep((s) => s + 1);
  };

  const handleFinish = async () => {
    const rawToken = getVal('botToken');
    if (!rawToken) { toast.error(t('errorBotToken')); return; }
    const botToken = stripOauthPrefix(rawToken);
    const rawRefresh = getVal('botRefreshToken');
    const botRefreshToken = rawRefresh ? stripOauthPrefix(rawRefresh) : undefined;
    setLoading(true);
    try {
      const r = await fetch(`${API}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          adminSetupToken: collected.current.setupToken,
          twitchClientId: collected.current.twitchClientId || undefined,
          twitchClientSecret: collected.current.twitchClientSecret || undefined,
          botLogin: collected.current.botLogin,
          botAccessToken: botToken,
          botRefreshToken,
        }),
      });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.message || 'Setup failed');
      }
      toast.success(t('success'));
      router.push('/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = [t('step1Title'), t('step2Title'), t('step3Title')];

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black text-primary mb-1">StreamBingo</h1>
            <p className="text-sm text-muted-foreground">{t('title')}</p>
          </div>
          <PageToolbar />
        </div>

        <Progress value={(step / TOTAL_STEPS) * 100} className="h-2" />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{stepTitles[step - 1]}</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 pt-0 pb-6">
            {step === 1 && (
              <>
                <p className="text-sm text-muted-foreground">{t('setupTokenHint')}</p>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="setupToken">{t('setupToken')}</Label>
                  <Input id="setupToken" type="password" autoComplete="off" placeholder="nOJv..." />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <p className="text-sm text-muted-foreground">{t('step2Intro')}</p>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>
                    <a
                      href="https://dev.twitch.tv/console"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-primary"
                    >
                      dev.twitch.tv/console
                    </a>
                    {' \u2013 '}{t('step2Guide1')}
                  </li>
                  <li>
                    {t('step2Guide2')}{' '}
                    <code className="bg-muted px-1 rounded text-xs break-all">{redirectUri}</code>
                  </li>
                  <li>{t('step2Guide3')}</li>
                  <li>{t('step2Guide4')}</li>
                </ol>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="twitchClientId">{t('twitchClientId')}</Label>
                  <Input id="twitchClientId" autoComplete="off" placeholder="abc123..." />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="twitchClientSecret">{t('twitchClientSecret')}</Label>
                  <Input id="twitchClientSecret" type="password" autoComplete="off" placeholder="xyz789..." />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="botLogin">{t('botLogin')}</Label>
                  <Input id="botLogin" autoComplete="off" placeholder="streambingo_bot" />
                  <p className="text-xs text-muted-foreground">{t('botLoginHint')}</p>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <p className="text-sm text-muted-foreground">{t('step3Intro')}</p>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>{t('step3Guide1')}</li>
                  <li>{t('step3Guide2')}</li>
                  <li>{t('step3Guide3')}</li>
                  <li>{t('step3Guide4')}</li>
                  <li>{t('step3Guide5')}</li>
                </ol>
                <a
                  href="https://twitchtokengenerator.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm font-medium text-primary underline"
                >
                  {t('tokenGenLink')}
                </a>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="botToken">{t('botToken')}</Label>
                  <Input id="botToken" type="password" autoComplete="off" placeholder="oauth:..." />
                  <p className="text-xs text-muted-foreground">{t('botTokenHint')}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="botRefreshToken">{t('botRefreshToken')}</Label>
                  <Input id="botRefreshToken" type="password" autoComplete="off" placeholder="Refresh Token..." />
                  <p className="text-xs text-muted-foreground">{t('botRefreshTokenHint')}</p>
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                {t('back')}
              </Button>
            ) : (
              <span />
            )}
            {step < TOTAL_STEPS ? (
              <Button type="button" className="ml-auto" onClick={handleNext}>
                {t('next')} &rarr;
              </Button>
            ) : (
              <Button type="button" className="ml-auto" disabled={loading} onClick={handleFinish}>
                {loading ? t('installing') : t('completeSetup')}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
