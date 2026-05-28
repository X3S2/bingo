import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const defaults: Array<{ key: string; value: string }> = [
    { key: 'setup_complete', value: 'false' },
    { key: 'maintenance_enabled', value: 'false' },
    { key: 'maintenance_message', value: 'StreamBingo befindet sich derzeit in Wartung. Bitte versuche es später erneut.' },
    { key: 'impressum', value: '<p>Bitte hinterlege hier dein Impressum.</p>' },
    { key: 'datenschutz', value: '<p>Bitte hinterlege hier deine Datenschutzerklärung.</p>' },
  ];

  for (const setting of defaults) {
    await prisma.adminSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('✅ Database seeded with default AdminSettings');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
