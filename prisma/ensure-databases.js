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

async function main() {
  const coreUrl = process.env.DATABASE_URL_CORE;
  if (!coreUrl) {
    console.error('DATABASE_URL_CORE is required');
    process.exit(1);
  }

  const dbUrls = [
    process.env.DATABASE_URL_KBS,
    process.env.DATABASE_URL_KAMNET,
    process.env.DATABASE_URL_LANDS,
  ].filter(Boolean);

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
