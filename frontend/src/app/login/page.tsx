import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageToolbar } from '@/components/page-toolbar';

interface Props {
  searchParams: Promise<{ returnTo?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { returnTo } = await searchParams;
  const t = await getTranslations('auth');
  const authHref = returnTo && returnTo.startsWith('/') && !returnTo.includes('://')
    ? `/api/auth/twitch?returnTo=${encodeURIComponent(returnTo)}`
    : '/api/auth/twitch';

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="fixed top-4 right-4 z-50">
        <PageToolbar />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('loginTitle')}</CardTitle>
          <CardDescription>{t('loginDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            asChild
            className="w-full [&]:bg-[#9146FF] [&]:hover:bg-[#772CE8] [&]:text-white"
            size="lg"
          >
            <a href={authHref}>
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
              </svg>
              {t('loginButton')}
            </a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
