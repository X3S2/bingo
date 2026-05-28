'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function SetupPage() {
  const router = useRouter();
  const t = useTranslations('setup');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    setupToken: '',
    botLogin: '',
    botToken: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch(`${API}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          adminSetupToken: form.setupToken,
          botLogin: form.botLogin,
          botAccessToken: form.botToken,
        }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.message || 'Setup failed');
      }
      toast.success(t('success'));
      router.push('/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Setup fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-black text-primary mb-1">StreamBingo</h1>
          <p className="text-muted-foreground">{t('title')}</p>
        </div>

        <Progress value={(step / 2) * 100} className="h-2" />

        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-base">
                {step === 1 ? `Schritt 1: ${t('step1')}` : `Schritt 2: ${t('step2')}`}
              </CardTitle>
              <CardDescription>{t('description')}</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              {step === 1 ? (
                <>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="setupToken">{t('setupToken')}</Label>
                    <Input
                      id="setupToken"
                      type="password"
                      value={form.setupToken}
                      onChange={(e) => setForm({ ...form, setupToken: e.target.value })}
                      required
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="botLogin">{t('botLogin')}</Label>
                    <Input
                      id="botLogin"
                      value={form.botLogin}
                      onChange={(e) => setForm({ ...form, botLogin: e.target.value })}
                      required
                      placeholder="streambingo_bot"
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="botToken">{t('botToken')}</Label>
                  <Input
                    id="botToken"
                    type="password"
                    value={form.botToken}
                    onChange={(e) => setForm({ ...form, botToken: e.target.value })}
                    required
                    autoComplete="off"
                    placeholder="oauth:..."
                  />
                </div>
              )}
            </CardContent>

            <CardFooter className="flex justify-between">
              {step > 1 && (
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Zurück
                </Button>
              )}
              {step === 1 ? (
                <Button
                  type="button"
                  className="ml-auto"
                  onClick={() => {
                    if (!form.setupToken || !form.botLogin) {
                      toast.error('Bitte alle Felder ausfüllen');
                      return;
                    }
                    setStep(2);
                  }}
                >
                  Weiter →
                </Button>
              ) : (
                <Button type="submit" className="ml-auto" disabled={loading}>
                  {loading ? 'Wird eingerichtet...' : t('completeSetup')}
                </Button>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  );
}
