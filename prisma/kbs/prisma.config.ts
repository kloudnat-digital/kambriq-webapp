import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  // Paths in a Prisma 7 config resolve relative to this file, not the working
  // directory. This config lives in prisma/kbs/, so '.' is this directory,
  // which is where schema.prisma sits. 'prisma/kbs' would resolve to
  // prisma/kbs/prisma/kbs and fail to load.
  schema: '.',
  migrations: {
    path: 'migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL_KBS'],
  },
});
