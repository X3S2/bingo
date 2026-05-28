import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function AuthErrorPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const t = await getTranslations('auth');
  const errorKey = (error as keyof typeof t) || 'auth_failed';
  const message = t(`error.${errorKey}` as Parameters<typeof t>[0]) || t('error.auth_failed');

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="text-destructive">⚠️ {t('error.auth_failed')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground">{message}</p>
          <Button asChild variant="outline">
            <Link href="/login">← Erneut versuchen</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
