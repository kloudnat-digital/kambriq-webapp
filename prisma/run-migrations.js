const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Client } = require('pg');

function getDbName(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.replace('/', '');
    return name || null;
  } catch {
    return null;
  }
}

async function ensureDatabases() {
  const coreUrl = process.env.DATABASE_URL_CORE;
  if (!coreUrl) {
    throw new Error('DATABASE_URL_CORE is required');
  }

  const dbUrls = Object.entries(process.env)
    .filter(([key, value]) => key.startsWith('DATABASE_URL_') && value)
    .filter(([key]) => key !== 'DATABASE_URL_CORE')
    .map(([, value]) => value);

  const client = new Client({ connectionString: coreUrl });
  await client.connect();

  for (const url of dbUrls) {
    const dbName = getDbName(url);
    if (!dbName) continue;
    const res = await client.query('select 1 from pg_database where datname = $1', [dbName]);
    if (res.rowCount === 0) {
      await client.query(`create database "${dbName}"`);
      console.log(`created database ${dbName}`);
    }
  }

  await client.end();
}

function runMigrations() {
  const prismaDir = path.join(__dirname);
  const schemaDirs = fs.readdirSync(prismaDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(prismaDir, name, 'schema.prisma')))
    .sort();

  if (schemaDirs.length === 0) {
    throw new Error('No prisma schema directories found');
  }

  const allowDbPush = process.env.ALLOW_DB_PUSH === 'true';

  for (const name of schemaDirs) {
    const schemaPath = path.join(prismaDir, name, 'schema.prisma');
    const configPath = path.join(prismaDir, name, 'prisma.config.ts');
    const configArg = fs.existsSync(configPath) ? ` --config ${configPath}` : '';
    const migrationsDir = path.join(prismaDir, name, 'migrations');
    const hasMigrations = fs.existsSync(migrationsDir) && fs.readdirSync(migrationsDir).length > 0;

    if (!hasMigrations) {
      if (!allowDbPush) {
        throw new Error(`No migrations found for ${name}. Set ALLOW_DB_PUSH=true to run prisma db push.`);
      }
      const pushCmd = `npx prisma db push --accept-data-loss --schema ${schemaPath}${configArg}`;
      console.log(`\n→ ${pushCmd}`);
      execSync(pushCmd, { stdio: 'inherit' });
      continue;
    }

    const cmd = `npx prisma migrate deploy --schema ${schemaPath}${configArg}`;
    console.log(`\n→ ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
  }
}

async function main() {
  await ensureDatabases();
  runMigrations();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
