import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { getLocale, getMessages } from 'next-intl/server';
import { LocaleProvider } from '@/providers/locale-provider';
import { Providers } from '@/providers/providers';
import { MaintenanceBanner } from '@/components/maintenance-banner';
import { CookieBanner } from '@/components/cookie-banner';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'StreamBingo – Twitch Bingo Platform',
  description: 'Play Bingo with your Twitch community in real-time.',
  icons: { icon: '/favicon.ico' },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <LocaleProvider initialLocale={locale} initialMessages={messages}>
          <Providers>
            <MaintenanceBanner />
            {children}
            <CookieBanner />
          </Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}
