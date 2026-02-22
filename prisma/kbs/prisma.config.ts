import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/kbs',
  migrations: {
    path: 'migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL_KBS'],
  },
});
