'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import type { AbstractIntlMessages } from 'next-intl';

interface LocaleContextValue {
  locale: string;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'de',
  toggleLocale: () => {},
});

export function useLocaleToggle() {
  return useContext(LocaleContext);
}

export function LocaleProvider({
  initialLocale,
  initialMessages,
  children,
}: {
  initialLocale: string;
  initialMessages: AbstractIntlMessages;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [messages, setMessages] = useState<AbstractIntlMessages>(initialMessages);
  const router = useRouter();

  const toggleLocale = useCallback(() => {
    const next = locale === 'de' ? 'en' : 'de';
    // Dynamically import the message bundle (webpack bundles both at build time)
    void (async () => {
      const mod =
        next === 'en'
          ? await import('../messages/en.json')
          : await import('../messages/de.json');
      document.cookie = `locale=${next}; path=/; max-age=31536000`;
      document.documentElement.lang = next;
      setLocale(next);
      setMessages(mod.default as AbstractIntlMessages);
      router.refresh();
    })();
  }, [locale, router]);

  return (
    <LocaleContext.Provider value={{ locale, toggleLocale }}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
