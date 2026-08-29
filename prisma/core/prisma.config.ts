import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  // Paths in a Prisma 7 config resolve relative to this file, not the working
  // directory. This config lives in prisma/core/, so '.' is this directory,
  // which is where schema.prisma sits. 'prisma/core' would resolve to
  // prisma/core/prisma/core and fail to load.
  schema: '.',
  migrations: {
    path: 'migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL_CORE'],
  },
});
