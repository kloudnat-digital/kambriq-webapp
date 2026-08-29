import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  // Paths in a Prisma 7 config resolve relative to this file, not the working
  // directory. This config lives in prisma/lands/, so '.' is this directory,
  // which is where schema.prisma sits. 'prisma/lands' would resolve to
  // prisma/lands/prisma/lands and fail to load.
  schema: '.',
  migrations: {
    path: 'migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL_LANDS'],
  },
});
