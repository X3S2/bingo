import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/streambingo',
  },
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
});
