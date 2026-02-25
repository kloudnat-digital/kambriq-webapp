import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/kamnet',
  migrations: {
    path: 'migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL_KAMNET'],
  },
});
