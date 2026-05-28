'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export function MaintenanceBanner() {
  const t = useTranslations('maintenance');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/settings/maintenance_enabled`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.value === 'true') {
          return fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/settings/maintenance_message`, {
            credentials: 'include',
          }).then((r) => r.json());
        }
      })
      .then((d) => {
        if (d?.value) setMessage(d.value);
      })
      .catch(() => null);
  }, []);

  if (!message) return null;

  return (
    <div className="w-full bg-yellow-400 text-yellow-900 text-sm font-medium text-center py-2 px-4">
      🔧 {message || t('defaultMessage')}
    </div>
  );
}
