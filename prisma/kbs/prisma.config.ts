import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/kbs',
  migrations: {
    path: 'prisma/kbs/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL_KBS'],
  },
});
